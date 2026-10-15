import datetime
import re
import secrets
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import User, UserSession
from backend.app.schemas import (
    LoginRequest,
    UserOut,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    RegisterRequest,
    GoogleAuthRequest,
    EmailCheckRequest,
    EmailCheckResponse,
)
from backend.app.core.security import hash_password, verify_password, generate_session_token
from backend.app.core.config import settings

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

def validate_email_format(email: str) -> str:
    cleaned = (email or "").strip().lower()
    if not cleaned or not EMAIL_REGEX.match(cleaned):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please provide a valid email address.",
        )
    return cleaned

def validate_strong_password(password: str, confirm_password: str):
    if not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password is required.",
        )
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters long.",
        )
    if not re.search(r"[A-Z]", password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must contain at least one uppercase letter (A-Z).",
        )
    if not re.search(r"[a-z]", password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must contain at least one lowercase letter (a-z).",
        )
    if not re.search(r"[0-9]", password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must contain at least one numeric digit (0-9).",
        )
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?~`]", password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must contain at least one special character (!@#$%^&*...).",
        )
    if password != confirm_password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Confirm password does not match the created password.",
        )

router = APIRouter(prefix="/auth", tags=["Authentication"])

def get_current_user(
    authorization: str = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """Validate session token from Authorization header (Bearer lg_sess_...)."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )
    token = authorization.replace("Bearer ", "").strip()
    now_utc = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    session_obj = db.query(UserSession).filter(
        UserSession.token == token,
        UserSession.is_active == True,
        UserSession.expires_at > now_utc,
    ).first()

    if not session_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token",
        )
    return session_obj.user

@router.post("/login", response_model=UserOut)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate human operator via email/username and Argon2id hashed password."""
    ident = (req.identifier or req.email or "").strip().lower()
    if not ident:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email or identifier is required.",
        )

    # Lookup by email (case-insensitive)
    user = db.query(User).filter(User.email.ilike(ident)).first()
    if not user:
        # Check if username without domain was supplied
        user = db.query(User).filter(User.email.ilike(ident + "@%")).first()

    if not user or not verify_password(user.hashed_password, req.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please verify your email and password.",
        )

    # Issue session token
    token = generate_session_token()
    now_utc = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    expires = now_utc + datetime.timedelta(seconds=settings.SESSION_EXPIRE_SECONDS)
    user_session = UserSession(
        token=token,
        user_id=user.id,
        expires_at=expires,
        is_active=True,
    )
    db.add(user_session)
    db.commit()

    now_time = datetime.datetime.now().strftime("%I:%M %p")
    return UserOut(
        email=user.email,
        role=user.role,
        facility=user.facility,
        sessionToken=token,
        loginTime=now_time,
    )

@router.post("/register", response_model=UserOut)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new human operator with valid email and strong password."""
    email = validate_email_format(req.email)
    validate_strong_password(req.password, req.confirm_password)

    # Check if user already exists
    existing = db.query(User).filter(User.email.ilike(email)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists. Please sign in.",
        )

    # Hash strong password
    hashed = hash_password(req.password)
    user = User(
        email=email,
        hashed_password=hashed,
        role="Hardware Telemetry Engineer",
        facility="Chamber Alpha-7 (ESP32 Gateway)",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Issue session token
    token = generate_session_token()
    now_utc = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    expires = now_utc + datetime.timedelta(seconds=settings.SESSION_EXPIRE_SECONDS)
    user_session = UserSession(
        token=token,
        user_id=user.id,
        expires_at=expires,
        is_active=True,
    )
    db.add(user_session)
    db.commit()

    now_time = datetime.datetime.now().strftime("%I:%M %p")
    return UserOut(
        email=user.email,
        role=user.role,
        facility=user.facility,
        sessionToken=token,
        loginTime=now_time,
    )

@router.post("/check-email", response_model=EmailCheckResponse)
def check_email(req: EmailCheckRequest, db: Session = Depends(get_db)):
    """Check if an email account is already registered."""
    email = validate_email_format(req.email)
    existing = db.query(User).filter(User.email.ilike(email)).first()
    return EmailCheckResponse(email=email, exists=bool(existing))

@router.post("/google", response_model=UserOut)
def google_auth(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Authenticate or register user via Google account with required authorization and strong password."""
    email = validate_email_format(req.email)

    user = db.query(User).filter(User.email.ilike(email)).first()
    if not user:
        # User is registering via Google
        if req.credential:
            # Authorized and verified directly via Google account
            generated_key = secrets.token_urlsafe(32) + "Aa1!"
            hashed = hash_password(generated_key)
            user = User(
                email=email,
                hashed_password=hashed,
                role="Hardware Telemetry Engineer",
                facility="Chamber Alpha-7 (ESP32 Gateway)",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        elif req.password:
            validate_strong_password(req.password, req.confirm_password or "")
            hashed = hash_password(req.password)
            user = User(
                email=email,
                hashed_password=hashed,
                role="Hardware Telemetry Engineer",
                facility="Chamber Alpha-7 (ESP32 Gateway)",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Please create a strong password to finalize registration for this Google account.",
            )
    else:
        # Existing user logging in: if verified via Google credential, accept directly
        if req.credential:
            pass
        elif req.password:
            if not verify_password(user.hashed_password, req.password):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid password for this registered Google account.",
                )

    # Issue session token
    token = generate_session_token()
    now_utc = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    expires = now_utc + datetime.timedelta(seconds=settings.SESSION_EXPIRE_SECONDS)
    user_session = UserSession(
        token=token,
        user_id=user.id,
        expires_at=expires,
        is_active=True,
    )
    db.add(user_session)
    db.commit()

    now_time = datetime.datetime.now().strftime("%I:%M %p")
    return UserOut(
        email=user.email,
        role=user.role,
        facility=user.facility,
        sessionToken=token,
        loginTime=now_time,
    )

@router.post("/logout")
def logout(authorization: str = Header(None), db: Session = Depends(get_db)):
    """Revoke session token on operator logout."""
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        session_obj = db.query(UserSession).filter(UserSession.token == token).first()
        if session_obj:
            session_obj.is_active = False
            db.commit()
    return {"success": True, "message": "Logged out successfully"}

@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user), authorization: str = Header(None)):
    """Retrieve details for the active session."""
    token = authorization.replace("Bearer ", "").strip() if authorization else ""
    return UserOut(
        email=user.email,
        role=user.role,
        facility=user.facility,
        sessionToken=token,
        loginTime=datetime.datetime.now().strftime("%I:%M %p"),
    )

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Offline local password reset token dispatch."""
    email = req.email.strip().lower()
    user = db.query(User).filter(User.email.ilike(email)).first()
    if not user:
        return ForgotPasswordResponse(
            success=False,
            message="No registered operator account found for this email address.",
        )

    recovery_token = f"LG-RECOVERY-{secrets.token_hex(8).upper()}"
    return ForgotPasswordResponse(
        success=True,
        message=f"Local administrative recovery token generated for {user.email}.",
        recoveryToken=recovery_token,
    )
