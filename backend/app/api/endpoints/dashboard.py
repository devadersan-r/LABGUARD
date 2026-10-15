from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.schemas import DashboardStatsResponse, TelemetryPointOut
from backend.app.services.session_service import session_service
from backend.app.services.serial_service import serial_service
from backend.app.services.authenticator_service import authenticator_service
from backend.app.models import TelemetryRecord, RecordingSession

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Retrieve live dashboard telemetry metrics calculated strictly from persisted database records."""
    metrics = session_service.get_dashboard_metrics(db)
    serial_status = serial_service.get_status()

    return DashboardStatsResponse(
        hardwareConnected=serial_status["connected"],
        activeSessionId=metrics["activeSessionId"],
        viabilityScore=metrics["viabilityScore"],
        totalRecords=metrics["totalRecords"],
        dataIntegrityScore=metrics["dataIntegrityScore"],
        anomalyCount=metrics["anomalyCount"],
        throughput=metrics["throughput"] if (serial_status["connected"] or serial_status["simulatorActive"]) else 0,
        lastChecksumStatus=metrics["lastChecksumStatus"],
        enclaveHashMatch=metrics["enclaveHashMatch"],
        connectedSince=serial_status["connectedSince"],
        measurementPeriod=metrics["measurementPeriod"],
        recordsDenominator=metrics["recordsDenominator"],
    )

@router.get("/latest", response_model=List[TelemetryPointOut])
def get_latest_telemetry(db: Session = Depends(get_db)):
    """Retrieve recent time-series telemetry points for chart streaming."""
    return session_service.get_recent_points_for_chart(db, limit=16)

@router.post("/scan")
def trigger_deep_scan(db: Session = Depends(get_db)):
    """Run an on-demand cryptographic verification scan over all records in the database."""
    records = db.query(TelemetryRecord).all()
    verified_count = 0
    anomalies_detected = 0

    for rec in records:
        # Re-verify record using authenticator - try lablog-v1 first, then labguard-v1
        device_id = rec.session.device if rec.session else "DEVICE-01"
        payload = {
            "schema": "lablog-v1",
            "session_id": rec.session_id,
            "device_id": device_id,
            "seq": rec.seq,
            "elapsed_ms": rec.elapsed_ms,
            "source": rec.source,
            "value": rec.temp_c,
            "value_centi_c": rec.value_centi_c,
            "unit": rec.unit,
            "auth": {
                "algorithm": "HMAC-SHA256",
                "key_id": rec.key_id,
                "tag": rec.hmac_tag,
            }
        }
        is_valid, status, reason, _ = authenticator_service.verify_single_record(payload)
        if not is_valid:
            # Fallback to standard labguard-v1
            payload_guard = {
                "schema": "labguard-v1",
                "session_id": rec.session_id,
                "device_id": device_id,
                "seq": rec.seq,
                "elapsed_ms": rec.elapsed_ms,
                "source": rec.source,
                "value_centi_c": rec.value_centi_c,
                "unit": rec.unit,
                "auth": {
                    "algorithm": "HMAC-SHA256",
                    "key_id": rec.key_id,
                    "tag": rec.hmac_tag,
                }
            }
            is_valid, status, reason, _ = authenticator_service.verify_single_record(payload_guard)

        if is_valid:
            verified_count += 1
            rec.is_valid = True
            rec.error_reason = None
        else:
            anomalies_detected += 1
            rec.is_valid = False
            rec.error_reason = reason

    # Update recording sessions status based on record validity
    for s in db.query(RecordingSession).all():
        total_s = len(s.records)
        invalid_s = sum(1 for r in s.records if not r.is_valid)
        if total_s == 0 or invalid_s == 0:
            s.status = "Valid"
        elif invalid_s < total_s:
            s.status = "Warning"
        else:
            s.status = "Invalid"

    db.commit()

    total = len(records)
    viability = round((verified_count / total * 100.0), 2) if total > 0 else 0.0

    return {
        "success": True,
        "scannedRecords": total,
        "verifiedCount": verified_count,
        "anomaliesDetected": anomalies_detected,
        "viabilityScore": viability,
    }

@router.post("/reset")
def reset_to_zero_baseline(db: Session = Depends(get_db)):
    """Reset all records, sessions, and serial counters back to pristine zero baseline (values at null)."""
    db.query(TelemetryRecord).delete()
    db.query(RecordingSession).delete()
    db.commit()

    serial_service.reset_stats()
    session_service.set_active_session_id(None)

    return {
        "success": True,
        "message": "Reset to pristine zero baseline. Values are now null.",
        "totalRecords": 0,
        "viabilityScore": None,
        "dataIntegrityScore": None,
    }
