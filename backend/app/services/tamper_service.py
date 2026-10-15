import datetime
import json
from typing import Any, Dict, Optional
from backend.app.services.authenticator_service import authenticator_service
from backend.app.services.session_service import session_service
from backend.app.core.logging_config import logger

class TamperService:
    def __init__(self):
        self._nonce = 49210
        self._is_tampered = False
        self._last_check_time = datetime.datetime.now().strftime("%H:%M:%S")

    def ensure_demo_session_initialized(self):
        """Ensure SESSION-TAMPER-DEMO exists in the database with baseline genuine telemetry."""
        from backend.app.database import SessionLocal
        from backend.app.models import RecordingSession
        db = SessionLocal()
        try:
            existing = db.query(RecordingSession).filter(RecordingSession.id == "SESSION-TAMPER-DEMO").first()
            if not existing:
                valid_baseline = authenticator_service.sign_record(
                    session_id="SESSION-TAMPER-DEMO",
                    device_id="LABGUARD_ESP32_01",
                    seq=self._nonce,
                    elapsed_ms=10000,
                    source="DS18B20",
                    value_centi_c=2460,
                    key_id="KEY-001",
                )
                session_service.record_incoming_telemetry(
                    valid_baseline,
                    is_valid=True,
                    error_reason="Cryptographically verified via HMAC-SHA256",
                    is_simulated=True,
                )
                logger.info("Initialized SESSION-TAMPER-DEMO in database with baseline genuine record.")
        except Exception as e:
            logger.warning(f"Could not initialize demo session: {e}")
        finally:
            db.close()

    def get_status(self) -> Dict[str, Any]:
        """Return the current state and cryptographic verification result of the demonstration fixture."""
        self.ensure_demo_session_initialized()
        now_time = datetime.datetime.now().strftime("%H:%M:%S")

        # Base canonical fixture
        val_centi = 2461 if self._is_tampered else 2460

        # Construct original valid record
        valid_record = authenticator_service.sign_record(
            session_id="SESSION-TAMPER-DEMO",
            device_id="LABGUARD_ESP32_01",
            seq=self._nonce,
            elapsed_ms=10000,
            source="DS18B20",
            value_centi_c=2460,
            key_id="KEY-001",
        )
        original_signature = valid_record["auth"]["tag"]

        # If tampered: modify value_centi_c to 2461 while RETAINING original authentication tag
        test_record = dict(valid_record)
        test_record["value_centi_c"] = val_centi
        test_record["auth"] = dict(valid_record["auth"])

        # Run actual cryptographic verifier
        is_valid, status, reason, expected_tag = authenticator_service.verify_single_record(test_record)

        payload_text = json.dumps(test_record, separators=(",", ":"))

        return {
            "isTampered": self._is_tampered,
            "payloadText": payload_text,
            "currentSignature": original_signature,
            "expectedSignature": expected_tag or original_signature,
            "verifiedStatus": "100% INTEGRITY VERIFIED" if is_valid else "INTEGRITY MISMATCH DETECTED",
            "isValid": is_valid,
            "nonce": self._nonce,
            "lastCheckTime": now_time,
            "isDemoFixture": True,
            "sessionId": "SESSION-TAMPER-DEMO",
            "recordedStatus": "RECORDED_AS_TAMPERED" if not is_valid else "RECORDED_AS_VALID",
        }

    def _get_next_nonce(self) -> int:
        from backend.app.database import SessionLocal
        from backend.app.models import TelemetryRecord
        from sqlalchemy import func
        db = SessionLocal()
        try:
            max_seq = db.query(func.max(TelemetryRecord.seq)).filter(TelemetryRecord.session_id == "SESSION-TAMPER-DEMO").scalar()
            if max_seq is not None and max_seq >= self._nonce:
                self._nonce = max_seq
        except Exception:
            pass
        finally:
            db.close()
        self._nonce += 1
        return self._nonce

    def simulate_tamper(self, tamper: bool, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Toggle tamper state, record the tampered or restored frame into SQLite so it appears in Record Inspection, and run actual verifier."""
        self._nonce = self._get_next_nonce()
        self._is_tampered = tamper
        target_session = session_id or "SESSION-TAMPER-DEMO"

        val_centi = 2461 if self._is_tampered else 2460

        # Sign legitimate record for target session
        valid_record = authenticator_service.sign_record(
            session_id=target_session,
            device_id="LABGUARD_ESP32_01",
            seq=self._nonce,
            elapsed_ms=self._nonce * 1000,
            source="DS18B20",
            value_centi_c=2460,
            key_id="KEY-001",
        )

        test_record = dict(valid_record)
        test_record["value_centi_c"] = val_centi
        test_record["auth"] = dict(valid_record["auth"])

        # Run actual cryptographic verifier
        is_valid, status, reason, expected_tag = authenticator_service.verify_single_record(test_record)

        # PERSIST INTO SQLITE: This ensures Record Inspection displays the record accurately!
        session_service.record_incoming_telemetry(
            record=test_record,
            is_valid=is_valid,
            error_reason=reason if not is_valid else "Cryptographically verified via HMAC-SHA256",
            is_simulated=True,
        )

        logger.info(f"Simulate tamper ({tamper}): logged seq={self._nonce} to {target_session} (valid={is_valid})")
        return self.get_status()

tamper_service = TamperService()
