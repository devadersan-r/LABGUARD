import datetime
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
)
from backend.app.core.security import verify_password, generate_session_token
from backend.app.core.config import settings

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
    # Lookup by email
    user = db.query(User).filter(User.email == req.identifier.strip()).first()
    if not user:
        # Check if username without domain was supplied
        user = db.query(User).filter(User.email.startswith(req.identifier.strip() + "@")).first()

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
    user = db.query(User).filter(User.email == req.email.strip()).first()
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
