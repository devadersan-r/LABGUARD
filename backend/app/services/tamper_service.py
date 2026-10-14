import datetime
from typing import Any, Dict
from backend.app.services.authenticator_service import authenticator_service

class TamperService:
    def __init__(self):
        self._nonce = 49210
        self._is_tampered = False
        self._last_check_time = datetime.datetime.now().strftime("%H:%M:%S")

    def get_status(self) -> Dict[str, Any]:
        """Return the current state and cryptographic verification result of the demonstration fixture."""
        self._nonce += 1
        now_time = datetime.datetime.now().strftime("%H:%M:%S")

        # 1. Base canonical fixture
        val_centi = 2461 if self._is_tampered else 2460
        val_display = 24.61 if self._is_tampered else 24.60

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

        payload_text = f'{{"device":"LABGUARD_ESP32_01","channel":"CH0_ADC","val":{val_display:.2f},"seq":{self._nonce}}}'

        return {
            "isTampered": self._is_tampered,
            "payloadText": payload_text,
            "currentSignature": original_signature,
            "expectedSignature": expected_tag or original_signature,
            "verifiedStatus": "100% INTEGRITY VERIFIED" if is_valid else "INTEGRITY MISMATCH DETECTED",
            "isValid": is_valid,
            "nonce": self._nonce,
            "lastCheckTime": now_time,
        }

    def simulate_tamper(self, tamper: bool) -> Dict[str, Any]:
        """Toggle tamper state and run actual verifier."""
        self._is_tampered = tamper
        return self.get_status()

tamper_service = TamperService()
