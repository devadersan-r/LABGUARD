import csv
import datetime
import io
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import RecordingSession, TelemetryRecord
from backend.app.schemas import (
    RecordingSessionOut,
    SessionRecordOut,
    CreateSessionRequest,
)

router = APIRouter(prefix="/sessions", tags=["Recording Sessions"])

@router.get("", response_model=List[RecordingSessionOut])
def list_recording_sessions(
    searchTerm: Optional[str] = Query(None),
    device: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Retrieve all recording sessions matching active filter parameters."""
    query = db.query(RecordingSession)

    if device and device != "All Devices":
        query = query.filter(RecordingSession.device == device)
    if status and status != "All Statuses":
        query = query.filter(RecordingSession.status == status)
    if source and source != "All Sources":
        query = query.filter(RecordingSession.data_source.contains(source))

    sessions = query.order_by(RecordingSession.started_at.desc()).all()

    if searchTerm:
        q = searchTerm.lower()
        sessions = [
            s for s in sessions
            if q in s.id.lower() or q in s.name.lower() or q in s.device.lower()
        ]

    results = []
    for s in sessions:
        records_out = [
            SessionRecordOut(
                id=f"REC-{str(r.seq).zfill(3)}",
                timestamp=r.timestamp_utc,
                channel=f"TEMP_CH0",
                value=f"{r.temp_c} °C",
                hmacDigest=r.hmac_tag[:6] + "..." + r.hmac_tag[-4:] if len(r.hmac_tag) > 10 else r.hmac_tag,
                status="Valid" if r.is_valid else "Invalid",
            )
            for r in s.records[:5]
        ]
        results.append(
            RecordingSessionOut(
                id=s.id,
                name=s.name,
                device=s.device,
                dataSource=s.data_source,
                recordCount=s.record_count,
                duration=s.duration,
                startedAt=s.started_at,
                status=s.status,
                description=s.description,
                sampleRecords=records_out,
            )
        )
    return results

@router.post("", response_model=RecordingSessionOut)
def create_session(req: CreateSessionRequest, db: Session = Depends(get_db)):
    """Initialize a new recording session."""
    now_dt = datetime.datetime.now()
    session_id = f"SES-{now_dt.year}-{secrets_token := str(now_dt.strftime('%m%d%H%M'))}"
    started_at = now_dt.strftime("%Y-%m-%d %H:%M")

    new_session = RecordingSession(
        id=session_id,
        name=req.name.strip(),
        device=req.device,
        data_source=req.dataSource,
        record_count=0,
        duration="0m",
        started_at=started_at,
        status="Valid",
        description=req.description or "Session created by operator.",
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    return RecordingSessionOut(
        id=new_session.id,
        name=new_session.name,
        device=new_session.device,
        dataSource=new_session.data_source,
        recordCount=new_session.record_count,
        duration=new_session.duration,
        startedAt=new_session.started_at,
        status=new_session.status,
        description=new_session.description,
        sampleRecords=[],
    )

@router.get("/{session_id}", response_model=RecordingSessionOut)
def get_session(session_id: str, db: Session = Depends(get_db)):
    """Retrieve full metadata and record preview for a specific session."""
    s = db.query(RecordingSession).filter(RecordingSession.id == session_id).first()
    if not s:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found",
        )

    records_out = [
        SessionRecordOut(
            id=f"REC-{str(r.seq).zfill(3)}",
            timestamp=r.timestamp_utc,
            channel=f"TEMP_CH0",
            value=f"{r.temp_c} °C",
            hmacDigest=r.hmac_tag[:6] + "..." + r.hmac_tag[-4:] if len(r.hmac_tag) > 10 else r.hmac_tag,
            status="Valid" if r.is_valid else "Invalid",
        )
        for r in s.records
    ]

    return RecordingSessionOut(
        id=s.id,
        name=s.name,
        device=s.device,
        dataSource=s.data_source,
        recordCount=s.record_count,
        duration=s.duration,
        startedAt=s.started_at,
        status=s.status,
        description=s.description,
        sampleRecords=records_out,
    )

@router.get("/{session_id}/records")
def get_session_records_for_inspection(session_id: str, db: Session = Depends(get_db)):
    """Retrieve raw authenticated telemetry records formatted for the Record Inspection Console."""
    s = db.query(RecordingSession).filter(RecordingSession.id == session_id).first()
    if not s:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found",
        )

    stream = []
    for r in s.records:
        stream.append({
            "seq": r.seq,
            "time": r.timestamp_utc,
            "probe": r.source,
            "val": r.temp_c,
            "hmac": r.hmac_tag[:6] + "..." + r.hmac_tag[-4:] if len(r.hmac_tag) > 10 else r.hmac_tag,
            "valid": r.is_valid,
        })

    return {
        "session_id": s.id,
        "device": s.device,
        "facility": "Chamber Alpha-7",
        "security_mode": "HMAC-SHA256",
        "records_count": len(stream),
        "telemetry_stream": stream,
    }

@router.get("/{session_id}/export")
def export_session_evidence(
    session_id: str,
    format: str = Query("jsonl", pattern="^(jsonl|csv)$"),
    db: Session = Depends(get_db),
):
    """Export all verified evidence records for a session as JSONL or CSV."""
    s = db.query(RecordingSession).filter(RecordingSession.id == session_id).first()
    if not s:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found",
        )

    if format == "jsonl":
        lines = []
        for r in s.records:
            item = {
                "schema": "labguard-v1",
                "session_id": s.id,
                "device_id": s.device,
                "seq": r.seq,
                "elapsed_ms": r.elapsed_ms,
                "source": r.source,
                "value_centi_c": r.value_centi_c,
                "unit": r.unit,
                "auth": {
                    "algorithm": "HMAC-SHA256",
                    "key_id": r.key_id,
                    "tag": r.hmac_tag,
                }
            }
            lines.append(json.dumps(item, separators=(",", ":")))

        output = "\n".join(lines) + "\n"
        return Response(
            content=output,
            media_type="application/x-ndjson",
            headers={"Content-Disposition": f"attachment; filename={s.id}_evidence.jsonl"},
        )
    else:
        # CSV Export
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["sequence", "timestamp", "channel", "value", "hmac_digest", "status"])
        for r in s.records:
            writer.writerow([r.seq, r.timestamp_utc, r.source, f"{r.temp_c} C", r.hmac_tag, "Valid" if r.is_valid else "Invalid"])

        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={s.id}_export.csv"},
        )
