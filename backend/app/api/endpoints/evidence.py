import json
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import VerificationJob
from backend.app.schemas import (
    VerificationReportOut,
    VerifyRecordRequest,
    VerifyRecordResponse,
)
from backend.app.services.authenticator_service import authenticator_service
from backend.app.core.config import WORKSPACE_DIR

router = APIRouter(prefix="/evidence", tags=["Evidence Verification"])

@router.post("/verify", response_model=VerificationReportOut)
async def verify_evidence_file_upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload an evidence file (JSONL or CSV) and execute cryptographic HMAC-SHA256 verification."""
    contents = await file.read()
    content_str = contents.decode("utf-8", errors="replace")

    report_dict = authenticator_service.verify_uploaded_file(content_str, file.filename)

    # Persist verification audit record in database
    job = VerificationJob(
        file_name=report_dict["fileName"],
        file_size=report_dict["fileSize"],
        file_type=report_dict["fileType"],
        verified_at=report_dict["verifiedAt"],
        total_checked=report_dict["totalChecked"],
        valid_count=report_dict["validCount"],
        invalid_count=report_dict["invalidCount"],
        sequence_issues_count=report_dict["sequenceIssuesCount"],
        overall_status=report_dict["overallStatus"],
        report_data=json.dumps(report_dict),
    )
    db.add(job)
    db.commit()

    return report_dict

@router.post("/verify-record", response_model=VerifyRecordResponse)
def verify_record(req: VerifyRecordRequest):
    """Cryptographically verify a single raw evidence JSON record."""
    is_valid, status_str, reason, exp_tag = authenticator_service.verify_single_record(req.record)
    supplied = req.record.get("auth", {}).get("tag")

    return VerifyRecordResponse(
        isValid=is_valid,
        status=status_str,
        reason=reason,
        computedTag=exp_tag,
        suppliedTag=supplied,
    )

@router.get("/sample/{sample_type}")
def get_sample_evidence_file(sample_type: str):
    """Retrieve sample evidence content: 'clean' or 'tampered'."""
    evidence_dir = WORKSPACE_DIR / "LABGUARD" / "evidence"

    if sample_type == "clean":
        path = evidence_dir / "demo_valid.jsonl"
        filename = "LABGUARD_Clean_Export_2026.jsonl"
    elif sample_type == "tampered":
        path = evidence_dir / "demo_tampered.jsonl"
        filename = "LABGUARD_Tampered_Test_Export.jsonl"
    else:
        raise HTTPException(status_code=400, detail="Invalid sample type. Choose 'clean' or 'tampered'")

    if not path.exists():
        raise HTTPException(status_code=404, detail="Sample evidence file not found")

    content = path.read_text(encoding="utf-8")
    report = authenticator_service.verify_uploaded_file(content, filename)
    return report

@router.get("/reports", response_model=List[VerificationReportOut])
def get_verification_reports(db: Session = Depends(get_db)):
    """Retrieve history of past file verification jobs."""
    jobs = db.query(VerificationJob).order_by(VerificationJob.id.desc()).limit(10).all()
    results = []
    for j in jobs:
        try:
            data = json.loads(j.report_data)
            results.append(data)
        except Exception:
            pass
    return results
