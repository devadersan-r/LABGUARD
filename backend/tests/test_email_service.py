import smtplib
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.config import settings
from backend.app.services.email_service import email_service
from backend.app.services.authenticator_service import authenticator_service
from backend.app.services.session_service import session_service
from backend.app.services.tamper_service import tamper_service

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_cooldown():
    """Reset cooldown tracker before each test."""
    email_service._cooldown_tracker.clear()
    email_service.total_alerts_sent = 0
    email_service.last_alert_status = "IDLE"
    email_service.last_error_message = None

def test_smtp_configuration_detection():
    """Verify that placeholder passwords are recognized as unconfigured (offline mode)."""
    with patch.object(settings, "SMTP_PASSWORD", "PASTE_MY_NEW_GMAIL_APP_PASSWORD_HERE"):
        assert email_service.is_configured() is False
        status = email_service.get_status()
        assert status["configured"] is False
        assert status["host"] == "smtp.gmail.com"
        assert status["port"] == 587
        assert status["alertRecipient"] == "labgaurd@gmail.com"

    with patch.object(settings, "SMTP_PASSWORD", "abcd efgh ijkl mnop"):
        assert email_service.is_configured() is True
        status = email_service.get_status()
        assert status["configured"] is True

def test_test_email_endpoint_unconfigured():
    """Verify test-email endpoint returns clear safe error when password is not set."""
    with patch.object(settings, "SMTP_PASSWORD", "PASTE_MY_NEW_GMAIL_APP_PASSWORD_HERE"):
        res = client.post("/api/notifications/test-email", json={})
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is False
        assert "not set in backend/.env" in data["message"]
        assert data["recipient"] == "labgaurd@gmail.com"

def test_test_email_endpoint_success_mocked():
    """Verify test-email endpoint successfully uses STARTTLS and Gmail SMTP when mocked."""
    with patch.object(settings, "SMTP_PASSWORD", "validapppassword123"):
        with patch("backend.app.services.email_service.smtplib.SMTP") as mock_smtp_cls:
            mock_server = MagicMock()
            mock_server.__enter__.return_value = mock_server
            mock_smtp_cls.return_value = mock_server

            res = client.post("/api/notifications/test-email", json={"recipient": "labgaurd@gmail.com"})
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert "dispatched" in data["message"].lower() or "accepted" in data["message"].lower()

            # Verify STARTTLS, EHLO, login, and send_message were invoked
            mock_server.starttls.assert_called_once()
            mock_server.login.assert_called_once_with(settings.SMTP_USERNAME, "validapppassword123")
            mock_server.send_message.assert_called_once()
            sent_msg = mock_server.send_message.call_args[0][0]
            assert sent_msg["To"] == "labgaurd@gmail.com"
            assert "LABGUARD" in sent_msg["Subject"]
            # Sensitive keys must NOT be present in email
            assert "KEY-001" not in str(sent_msg)

def test_smtp_authentication_failure_sanitized():
    """Verify SMTPAuthenticationError is handled safely without leaking credentials."""
    with patch.object(settings, "SMTP_PASSWORD", "secret_pass_value_99"):
        with patch("backend.app.services.email_service.smtplib.SMTP") as mock_smtp_cls:
            mock_server = MagicMock()
            mock_server.__enter__.return_value = mock_server
            mock_server.login.side_effect = smtplib.SMTPAuthenticationError(535, b"5.7.8 Username and Password not accepted")
            mock_smtp_cls.return_value = mock_server

            res = client.post("/api/notifications/test-email", json={})
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is False
            assert "secret_pass_value_99" not in data["message"]
            assert "authentication rejected" in data["message"].lower()

def test_duplicate_alert_suppression_cooldown():
    """Verify that multiple tamper events within cooldown window send only 1 email."""
    with patch.object(settings, "SMTP_PASSWORD", "validapppassword123"):
        with patch("backend.app.services.email_service.smtplib.SMTP") as mock_smtp_cls:
            mock_server = MagicMock()
            mock_server.__enter__.return_value = mock_server
            mock_smtp_cls.return_value = mock_server

            record = {
                "device_id": "LABGUARD_ESP32_01",
                "session_id": "SESSION-TEST-COOLDOWN",
                "seq": 101,
            }

            # First alert: should send
            res1 = email_service.send_tamper_alert(record, is_simulated=False, detection_reason="HMAC mismatch")
            assert res1["success"] is True
            assert res1["status"] == "SENT"
            assert email_service.total_alerts_sent == 1
            assert mock_server.send_message.call_count == 1

            # Second alert immediately: should be suppressed by cooldown
            res2 = email_service.send_tamper_alert(record, is_simulated=False, detection_reason="HMAC mismatch")
            assert res2["success"] is True
            assert res2["status"] == "COOLDOWN_SUPPRESSED"
            assert email_service.total_alerts_sent == 1
            assert mock_server.send_message.call_count == 1

def test_valid_telemetry_does_not_trigger_tamper_alert():
    """Verify valid telemetry records never trigger tamper alert emails."""
    with patch.object(email_service, "trigger_tamper_alert_async") as mock_trigger:
        valid_rec = authenticator_service.sign_record(
            session_id="SESSION-001",
            device_id="LABGUARD_ESP32_01",
            seq=999,
            elapsed_ms=5000,
            source="DS18B20",
            value_centi_c=2450,
            key_id="KEY-001",
        )
        is_valid, _, _, _ = authenticator_service.verify_single_record(valid_rec)
        assert is_valid is True

        session_service.record_incoming_telemetry(
            record=valid_rec,
            is_valid=True,
            error_reason=None,
            is_simulated=False,
        )

        mock_trigger.assert_not_called()

def test_tamper_demo_persists_to_record_inspection():
    """Verify that simulating tamper in the demo persists the record with is_valid=False
    so it appears in the Record Inspection console.
    """
    # 1. Trigger tamper simulation
    res_tamper = client.post("/api/tamper/simulate", json={"tamperPayload": True})
    assert res_tamper.status_code == 200
    t_data = res_tamper.json()
    assert t_data["isTampered"] is True
    nonce = t_data["nonce"]

    # 2. Fetch records for SESSION-TAMPER-DEMO (Record Inspection endpoint)
    res_inspect = client.get("/api/sessions/SESSION-TAMPER-DEMO/records")
    assert res_inspect.status_code == 200
    inspect_data = res_inspect.json()
    assert inspect_data["session_id"] == "SESSION-TAMPER-DEMO"
    assert inspect_data["records_count"] >= 1

    stream = inspect_data["telemetry_stream"]
    # Locate the record corresponding to the tampered nonce
    tampered_entry = next((r for r in stream if r["seq"] == nonce), None)
    assert tampered_entry is not None, f"Expected record #{nonce} in telemetry stream"
    assert tampered_entry["valid"] is False, "Tampered record MUST have valid=False for Record Inspection"

    # 3. Restore genuine payload
    res_restore = client.post("/api/tamper/simulate", json={"tamperPayload": False})
    assert res_restore.status_code == 200
    r_data = res_restore.json()
    assert r_data["isTampered"] is False
    restore_nonce = r_data["nonce"]

    res_inspect2 = client.get("/api/sessions/SESSION-TAMPER-DEMO/records")
    stream2 = res_inspect2.json()["telemetry_stream"]
    restored_entry = next((r for r in stream2 if r["seq"] == restore_nonce), None)
    assert restored_entry is not None
    assert restored_entry["valid"] is True, "Restored record MUST have valid=True"
