import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

backend_root = Path(__file__).resolve().parent.parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from backend.app.main import app
from backend.app.database import init_db, SessionLocal
from backend.app.models import User, RecordingSession, TelemetryRecord
from backend.app.services.authenticator_service import authenticator_service
from backend.app.services.serial_service import serial_service
from backend.app.services.session_service import session_service

from backend.app.core.security import hash_password

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        # Register a valid operator for auth tests
        test_client.post("/api/auth/register", json={
            "email": "operator.alex@labguard.io",
            "password": "StrongKey@2026!",
            "confirm_password": "StrongKey@2026!",
        })
        yield test_client

def test_health_check(client):
    """Test health check and root endpoints."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["offlineOnly"] is True

def test_system_info(client):
    """Test system specification and security claims."""
    res = client.get("/api/system/info")
    assert res.status_code == 200
    data = res.json()
    assert "HMAC-SHA256" in data["cryptographicStandard"]
    assert "KEY-001" in data["activeKeyId"]

def test_auth_login_valid(client):
    """Test user login with valid credentials."""
    payload = {
        "identifier": "operator.alex@labguard.io",
        "password": "StrongKey@2026!",
    }
    res = client.post("/api/auth/login", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "operator.alex@labguard.io"
    assert data["sessionToken"].startswith("lg_sess_")

def test_auth_login_invalid(client):
    """Test user login with invalid password."""
    payload = {
        "identifier": "operator.alex@labguard.io",
        "password": "wrong_password_attempt",
    }
    res = client.post("/api/auth/login", json=payload)
    assert res.status_code == 401
    assert "Invalid credentials" in res.json()["detail"]

def test_auth_me_and_logout(client):
    """Test protected /me endpoint with token and subsequent logout."""
    login_res = client.post("/api/auth/login", json={
        "identifier": "operator.alex@labguard.io",
        "password": "StrongKey@2026!",
    })
    token = login_res.json()["sessionToken"]

    # Access /me
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "operator.alex@labguard.io"

    # Logout
    logout_res = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_res.status_code == 200

    # Access /me after logout should fail
    after_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert after_res.status_code == 401

def test_authenticator_service_valid_and_tampered():
    """Test authenticator service directly on valid and tampered records."""
    valid_record = authenticator_service.sign_record(
        session_id="TEST-SES-001",
        device_id="ESP32-DEV-01",
        seq=1,
        elapsed_ms=1000,
        source="DS18B20",
        value_centi_c=2500,
        key_id="KEY-001",
    )
    is_valid, status, reason, exp_tag = authenticator_service.verify_single_record(valid_record)
    assert is_valid is True
    assert status == "VALID"

    # Tamper with temperature value
    tampered_record = dict(valid_record)
    tampered_record["value_centi_c"] = 9999
    is_valid_t, status_t, reason_t, _ = authenticator_service.verify_single_record(tampered_record)
    assert is_valid_t is False
    assert status_t == "INVALID"
    assert "tampering detected" in reason_t

def test_evidence_file_verification(client):
    """Test file verification endpoint with valid JSONL vs tampered JSONL."""
    evidence_dir = backend_root / "LABGUARD" / "evidence"
    valid_file = evidence_dir / "demo_valid.jsonl"
    tampered_file = evidence_dir / "demo_tampered.jsonl"

    with open(valid_file, "rb") as f:
        res = client.post("/api/evidence/verify", files={"file": ("demo_valid.jsonl", f, "text/plain")})
    assert res.status_code == 200
    data = res.json()
    assert data["overallStatus"] == "Passed"
    assert data["validCount"] == 5
    assert data["invalidCount"] == 0

    with open(tampered_file, "rb") as f:
        res_t = client.post("/api/evidence/verify", files={"file": ("demo_tampered.jsonl", f, "text/plain")})
    assert res_t.status_code == 200
    data_t = res_t.json()
    assert data_t["overallStatus"] == "Failed"
    assert data_t["invalidCount"] == 1

def test_sessions_api(client):
    """Test listing, creating, inspecting, and exporting sessions."""
    res = client.get("/api/sessions")
    assert res.status_code == 200
    sessions = res.json()

    # If clean baseline has no sessions, create one to validate session lifecycle
    if len(sessions) == 0:
        create_res = client.post("/api/sessions", json={
            "name": "Validation Test Session",
            "device": "LABGUARD_ESP32_01",
            "dataSource": "Serial Port (Direct Capture)",
            "description": "Integration test session",
        })
        assert create_res.status_code == 200
        first_session_id = create_res.json()["id"]
    else:
        first_session_id = sessions[0]["id"]

    # Inspection
    inspect_res = client.get(f"/api/sessions/{first_session_id}/records")
    assert inspect_res.status_code == 200
    inspect_data = inspect_res.json()
    assert inspect_data["session_id"] == first_session_id
    assert "telemetry_stream" in inspect_data

    # JSONL Export
    export_jsonl = client.get(f"/api/sessions/{first_session_id}/export?format=jsonl")
    assert export_jsonl.status_code == 200

    # CSV Export
    export_csv = client.get(f"/api/sessions/{first_session_id}/export?format=csv")
    assert export_csv.status_code == 200

def test_dashboard_metrics(client):
    """Test dashboard metrics calculation."""
    res = client.get("/api/dashboard/stats")
    assert res.status_code == 200
    data = res.json()
    assert "viabilityScore" in data
    assert "totalRecords" in data
    assert data["totalRecords"] >= 0
    assert data["measurementPeriod"] != ""

def test_tamper_demo_endpoint(client):
    """Test deterministic tampering demonstration API."""
    res_status = client.get("/api/tamper/status")
    assert res_status.status_code == 200
    assert res_status.json()["isTampered"] is False

    # Simulate tamper
    res_tamper = client.post("/api/tamper/simulate", json={"tamperPayload": True})
    assert res_tamper.status_code == 200
    data = res_tamper.json()
    assert data["isTampered"] is True
    assert data["verifiedStatus"] == "INTEGRITY MISMATCH DETECTED"

    # Reset tamper
    res_reset = client.post("/api/tamper/simulate", json={"tamperPayload": False})
    assert res_reset.status_code == 200
    assert res_reset.json()["isTampered"] is False
    assert res_reset.json()["verifiedStatus"] == "100% INTEGRITY VERIFIED"

def test_serial_ports_and_simulator(client):
    """Test COM port listing and bench simulator toggle."""
    ports_res = client.get("/api/serial/ports")
    assert ports_res.status_code == 200
    assert isinstance(ports_res.json(), list)

    # Simulator toggle
    sim_on = client.post("/api/serial/simulator", json={"active": True, "intervalSeconds": 0.5})
    assert sim_on.status_code == 200
    assert sim_on.json()["simulatorActive"] is True

    # Check status reflects simulator
    status_res = client.get("/api/serial/status")
    assert status_res.status_code == 200
    assert status_res.json()["simulatorActive"] is True

    # Turn off simulator
    sim_off = client.post("/api/serial/simulator", json={"active": False})
    assert sim_off.status_code == 200
    assert sim_off.json()["simulatorActive"] is False

def test_sample_download_endpoint(client):
    """Test downloading sample evidence JSONL files."""
    res_clean = client.get("/api/evidence/sample/clean/download")
    assert res_clean.status_code == 200
    assert "labguard-v1" in res_clean.text
    assert "attachment; filename=LABGUARD_Clean_Export_2026.jsonl" in res_clean.headers.get("Content-Disposition", "")

    res_tampered = client.get("/api/evidence/sample/tampered/download")
    assert res_tampered.status_code == 200
    assert "labguard-v1" in res_tampered.text
    assert "attachment; filename=LABGUARD_Tampered_Test_Export.jsonl" in res_tampered.headers.get("Content-Disposition", "")

def test_serial_connect_while_simulator_active(client):
    """Test connecting to a port while simulator is active does not deadlock."""
    # Start simulator
    sim_on = client.post("/api/serial/simulator", json={"active": True, "intervalSeconds": 0.5})
    assert sim_on.status_code == 200

    # Attempt to connect to non-existent test port (should fail safely without deadlock)
    conn_res = client.post("/api/serial/connect", json={"port": "COM_NON_EXISTENT"})
    assert conn_res.status_code == 400
    assert "Could not open" in conn_res.json()["detail"] or "Serial error" in conn_res.json()["detail"]

    # Verify status responds immediately without timing out
    status_res = client.get("/api/serial/status")
    assert status_res.status_code == 200
