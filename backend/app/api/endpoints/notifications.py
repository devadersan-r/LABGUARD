from fastapi import APIRouter, Depends, HTTPException, status
from backend.app.schemas import (
    NotificationStatusResponse,
    TestEmailRequest,
    TestEmailResponse,
)
from backend.app.services.email_service import email_service

router = APIRouter(prefix="/notifications", tags=["Notifications & Alerts"])

@router.get("/status", response_model=NotificationStatusResponse)
def get_notification_status():
    """Retrieve the operational status and security parameters of the Gmail SMTP Alert system.
    Sensitive credentials such as passwords and secret keys are strictly redacted.
    """
    data = email_service.get_status()
    return NotificationStatusResponse(**data)

@router.post("/test-email", response_model=TestEmailResponse)
def send_test_email(req: TestEmailRequest = None):
    """Dispatch an operator-initiated test email to verify Gmail SMTP STARTTLS connectivity.
    Does not trigger a tampering incident or increment security alert counters.
    """
    recipient = req.recipient if req and req.recipient else None
    result = email_service.send_test_email(recipient)
    return TestEmailResponse(
        success=result["success"],
        message=result["message"],
        recipient=result["recipient"],
        timestamp=result["timestamp"],
    )
