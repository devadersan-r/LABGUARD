from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.schemas import DashboardStatsResponse, TelemetryPointOut
from backend.app.services.session_service import session_service
from backend.app.services.serial_service import serial_service
from backend.app.services.authenticator_service import authenticator_service
from backend.app.models import TelemetryRecord

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
        # Re-verify record using authenticator
        payload = {
            "schema": "labguard-v1",
            "session_id": rec.session_id,
            "device_id": "ESP32-DEV-01",
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
        is_valid, status, reason, _ = authenticator_service.verify_single_record(payload)
        if is_valid:
            verified_count += 1
        else:
            anomalies_detected += 1
            rec.is_valid = False
            rec.error_reason = reason

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
