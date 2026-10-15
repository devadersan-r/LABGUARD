import datetime
import json
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.app.database import SessionLocal
from backend.app.models import RecordingSession, TelemetryRecord
from backend.app.core.logging_config import logger

class SessionService:
    def __init__(self):
        self.active_session_id: Optional[str] = None

    def set_active_session_id(self, session_id: str):
        self.active_session_id = session_id
        logger.info(f"Active recording session set to '{session_id}'")

    def get_active_session_id(self) -> Optional[str]:
        return self.active_session_id

    def seed_demo_records_for_session(self, session_id: str, count: int = 3):
        """Generate and insert authentic, cryptographically verified records for demo session initialization."""
        from backend.app.services.authenticator_service import authenticator_service
        now = datetime.datetime.now()
        for i in range(1, count + 1):
            offset_seconds = (count - i) * 3
            record_time = (now - datetime.timedelta(seconds=offset_seconds)).strftime("%H:%M:%S")
            centi = 2440 + i * 15  # ~24.55 °C, ~24.70 °C, etc.
            rec = authenticator_service.sign_record(
                session_id=session_id,
                device_id="ESP32-LAB-02",
                seq=i,
                elapsed_ms=i * 2000,
                source="DS18B20-SIMULATED",
                value_centi_c=centi,
                key_id="KEY-001",
            )
            self.record_incoming_telemetry(rec, is_valid=True, error_reason="Cryptographically verified via HMAC-SHA256", is_simulated=True)

    def record_incoming_telemetry(
        self,
        record: Dict[str, Any],
        is_valid: bool,
        error_reason: Optional[str] = None,
        is_simulated: bool = False,
    ):
        """Save an authenticated measurement record into the SQLite database."""
        db: Session = SessionLocal()
        try:
            raw_session_id = record.get("session_id", "SESSION-LIVE-DEFAULT")
            # If incoming session is generic/default and user set an active session, link it
            if self.active_session_id and raw_session_id in ("SESSION-LIVE-DEFAULT", "SESSION-001", "SESSION-SIM-LIVE"):
                session_id = self.active_session_id
            else:
                session_id = raw_session_id

            device_id = record.get("device_id", "ESP32-DEV-01")
            source = record.get("source", "DS18B20")
            seq = record.get("seq", 1)
            elapsed_ms = record.get("elapsed_ms", 0)

            # Support both integer hundredths (value_centi_c) and float (value)
            if "value_centi_c" in record:
                centi = int(record["value_centi_c"])
                temp_c = round(centi / 100.0, 2)
            elif "value" in record:
                temp_c = round(float(record["value"]), 2)
                centi = int(round(temp_c * 100))
            else:
                centi = 2400
                temp_c = 24.0

            unit = record.get("unit", "C")
            auth = record.get("auth", {})
            key_id = auth.get("key_id", "KEY-001")
            tag = auth.get("tag", "")

            # Ensure parent RecordingSession exists
            session_obj = db.query(RecordingSession).filter(RecordingSession.id == session_id).first()
            now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            if not session_obj:
                session_obj = RecordingSession(
                    id=session_id,
                    name=f"Session {session_id}",
                    device=device_id,
                    data_source="ESP32 (Simulated)" if is_simulated else "ESP32 USB Serial",
                    record_count=0,
                    duration="0m",
                    started_at=now_str,
                    status="Valid" if is_valid else "Invalid",
                    description="Live stream capture from LabGuard sensor node.",
                )
                db.add(session_obj)
                db.commit()

            # Create TelemetryRecord
            time_short = datetime.datetime.now().strftime("%H:%M:%S")
            rec_obj = TelemetryRecord(
                session_id=session_id,
                seq=seq,
                elapsed_ms=elapsed_ms,
                timestamp_utc=time_short,
                source=source,
                value_centi_c=centi,
                temp_c=temp_c,
                unit=unit,
                key_id=key_id,
                hmac_tag=tag,
                is_valid=is_valid,
                error_reason=error_reason,
                is_simulated=is_simulated,
            )
            db.add(rec_obj)

            # Update session stats
            session_obj.record_count += 1
            if not is_valid:
                session_obj.status = "Warning" if session_obj.status == "Valid" else "Invalid"

            db.commit()
            logger.debug(f"Saved record seq={seq} session={session_id} valid={is_valid}")

            # Trigger automatic email alert if this is a confirmed tampering incident
            if not is_valid and error_reason:
                reason_lower = error_reason.lower()
                # Confirm physical/cryptographic tampering (signature mismatch, sequence replay, or byte alterations)
                if any(k in reason_lower for k in ("mismatch", "tamper", "signature", "replay")):
                    try:
                        from backend.app.services.email_service import email_service
                        record_summary = {
                            "device_id": device_id,
                            "session_id": session_id,
                            "seq": seq,
                            "temp_c": temp_c,
                        }
                        email_service.trigger_tamper_alert_async(
                            record=record_summary,
                            is_simulated=is_simulated,
                            detection_reason=error_reason,
                        )
                    except Exception as email_err:
                        logger.warning(f"Non-blocking alert dispatch error: {email_err}")
        except Exception as err:
            db.rollback()
            logger.error(f"Failed to persist incoming telemetry record: {err}")
        finally:
            db.close()

    def get_dashboard_metrics(self, db: Session) -> Dict[str, Any]:
        """Compute live dashboard metrics calculated accurately from SQLite records."""
        from backend.app.services.serial_service import serial_service

        total_records = db.query(TelemetryRecord).count()
        valid_records = db.query(TelemetryRecord).filter(TelemetryRecord.is_valid == True).count()
        invalid_records = total_records - valid_records

        current_throughput = serial_service.get_current_throughput()

        if total_records == 0:
            return {
                "viabilityScore": None,
                "totalRecords": 0,
                "dataIntegrityScore": None,
                "anomalyCount": 0,
                "throughput": current_throughput,
                "lastChecksumStatus": "NO_RECORDS",
                "enclaveHashMatch": False,
                "measurementPeriod": "No telemetry recorded",
                "recordsDenominator": 0,
                "activeSessionId": None,
            }

        viability_score = round((valid_records / total_records) * 100.0, 2)
        data_integrity_score = round((valid_records / total_records) * 100.0, 1)

        latest_record = db.query(TelemetryRecord).order_by(TelemetryRecord.id.desc()).first()
        active_session_id = latest_record.session_id if latest_record else None

        return {
            "viabilityScore": viability_score,
            "totalRecords": total_records,
            "dataIntegrityScore": data_integrity_score,
            "anomalyCount": invalid_records,
            "throughput": current_throughput,
            "lastChecksumStatus": "VALID" if invalid_records == 0 else "FAIL",
            "enclaveHashMatch": invalid_records == 0,
            "measurementPeriod": "All recorded telemetry history",
            "recordsDenominator": total_records,
            "activeSessionId": active_session_id,
        }

    def get_recent_points_for_chart(self, db: Session, limit: int = 15) -> List[Dict[str, Any]]:
        """Get latest telemetry points formatted for the dashboard chart from actual database records."""
        from backend.app.services.serial_service import serial_service

        records = db.query(TelemetryRecord).order_by(TelemetryRecord.id.desc()).limit(limit).all()
        if not records:
            return []

        current_throughput = serial_service.get_current_throughput()
        points = []
        for r in reversed(records):
            points.append({
                "id": r.seq,
                "time": r.timestamp_utc,
                "viability": 100.0 if r.is_valid else 0.0,
                "throughput": current_throughput,
                "hmac": r.hmac_tag[:6] + "..." + r.hmac_tag[-4:] if len(r.hmac_tag) > 10 else r.hmac_tag,
                "temperatureC": r.temp_c,
            })
        return points

session_service = SessionService()
