from fastapi import APIRouter
from backend.app.schemas import TamperStatusResponse, TamperSimulateRequest
from backend.app.services.tamper_service import tamper_service

router = APIRouter(prefix="/tamper", tags=["Tampering Demonstration"])

@router.get("/status", response_model=TamperStatusResponse)
def get_tamper_demo_status():
    """Retrieve the current state, active payload, and verification tag of the tamper demonstration engine."""
    data = tamper_service.get_status()
    return TamperStatusResponse(
        isTampered=data["isTampered"],
        payloadText=data["payloadText"],
        currentSignature=data["currentSignature"],
        expectedSignature=data["expectedSignature"],
        verifiedStatus=data["verifiedStatus"],
        nonce=data["nonce"],
        lastCheckTime=data["lastCheckTime"],
        sessionId=data.get("sessionId", "SESSION-TAMPER-DEMO"),
        recordedStatus=data.get("recordedStatus"),
    )

@router.post("/simulate", response_model=TamperStatusResponse)
def simulate_tamper(req: TamperSimulateRequest):
    """Execute a deterministic tampering demonstration by altering an authenticated payload field,
    retaining original tag, persisting to the database for Record Inspection, and executing the real verifier.
    """
    data = tamper_service.simulate_tamper(req.tamperPayload, session_id=req.sessionId)
    return TamperStatusResponse(
        isTampered=data["isTampered"],
        payloadText=data["payloadText"],
        currentSignature=data["currentSignature"],
        expectedSignature=data["expectedSignature"],
        verifiedStatus=data["verifiedStatus"],
        nonce=data["nonce"],
        lastCheckTime=data["lastCheckTime"],
        sessionId=data.get("sessionId", "SESSION-TAMPER-DEMO"),
        recordedStatus=data.get("recordedStatus"),
    )
