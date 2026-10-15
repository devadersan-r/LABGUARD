import hmac
import hashlib
import pytest
from backend.app.services.authenticator_service import authenticator_service

KEY_HEX = "b128535bb8cde4cfd0ebd9a9c492b9cce2e8b33c5ac92efcdaf390b37d8e1971"
SECRET_KEY = bytes.fromhex(KEY_HEX)

def test_authentic_esp32_hardware_timing_verified():
    """Verify authentic ESP32 records with minor hardware clock latency (1ms) are accepted as valid."""
    # Authentic record with 1ms difference between snprintf (10141) and Serial.print (10142)
    canonical = b"lablog-v1|SESSION-001|DEVICE-01|3|10141|DS18B20|31.69|C"
    tag = hmac.new(SECRET_KEY, canonical, hashlib.sha256).hexdigest()

    record = {
        "schema": "lablog-v1",
        "session_id": "SESSION-001",
        "device_id": "DEVICE-01",
        "seq": 3,
        "elapsed_ms": 10142,  # 1 ms later
        "source": "DS18B20",
        "value": 31.69,
        "unit": "C",
        "auth": {
            "algorithm": "HMAC-SHA256",
            "key_id": "KEY-001",
            "tag": tag,
        }
    }

    is_valid, status, reason, _ = authenticator_service.verify_single_record(record)
    assert is_valid is True
    assert status == "VALID"
    assert "verified" in reason.lower()

def test_tampered_payload_strictly_rejected():
    """Verify that genuinely tampered records are flagged as INVALID/TAMPERED."""
    canonical = b"lablog-v1|SESSION-001|DEVICE-01|3|10141|DS18B20|31.69|C"
    tag = hmac.new(SECRET_KEY, canonical, hashlib.sha256).hexdigest()

    # Tampered temperature: 31.69 -> 35.50
    record_tampered_temp = {
        "schema": "lablog-v1",
        "session_id": "SESSION-001",
        "device_id": "DEVICE-01",
        "seq": 3,
        "elapsed_ms": 10142,
        "source": "DS18B20",
        "value": 35.50,
        "unit": "C",
        "auth": {
            "algorithm": "HMAC-SHA256",
            "key_id": "KEY-001",
            "tag": tag,
        }
    }

    is_valid, status, reason, _ = authenticator_service.verify_single_record(record_tampered_temp)
    assert is_valid is False
    assert status == "INVALID"
    assert "mismatch" in reason.lower() or "tampering" in reason.lower()

    # Tampered sequence: 3 -> 4
    record_tampered_seq = {
        "schema": "lablog-v1",
        "session_id": "SESSION-001",
        "device_id": "DEVICE-01",
        "seq": 4,
        "elapsed_ms": 10142,
        "source": "DS18B20",
        "value": 31.69,
        "unit": "C",
        "auth": {
            "algorithm": "HMAC-SHA256",
            "key_id": "KEY-001",
            "tag": tag,
        }
    }

    is_valid_seq, status_seq, reason_seq, _ = authenticator_service.verify_single_record(record_tampered_seq)
    assert is_valid_seq is False
    assert status_seq == "INVALID"

    # Tampered authentication tag
    record_tampered_tag = {
        "schema": "lablog-v1",
        "session_id": "SESSION-001",
        "device_id": "DEVICE-01",
        "seq": 3,
        "elapsed_ms": 10142,
        "source": "DS18B20",
        "value": 31.69,
        "unit": "C",
        "auth": {
            "algorithm": "HMAC-SHA256",
            "key_id": "KEY-001",
            "tag": "0000000000000000000000000000000000000000000000000000000000000000",
        }
    }

    is_valid_tag, status_tag, reason_tag, _ = authenticator_service.verify_single_record(record_tampered_tag)
    assert is_valid_tag is False
    assert status_tag == "INVALID"
