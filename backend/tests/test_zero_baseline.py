import sys
import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

backend_root = Path(__file__).resolve().parent.parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from backend.app.main import app
from backend.app.database import Base, get_db
from backend.app.core.security import hash_password
from backend.app.models import User, RecordingSession, TelemetryRecord
from backend.app.services.authenticator_service import authenticator_service
from backend.app.services.serial_service import serial_service

TEST_DB_PATH = backend_root / "backend" / "data" / "test_zero_baseline.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_PATH}"

test_engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="module", autouse=True)
def setup_test_schema():
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except Exception:
            pass

@pytest.fixture(autouse=True)
def clean_records_and_state():
    db = TestingSessionLocal()
    # Ensure default user exists
    admin = db.query(User).filter(User.email == "telemetry.lead@labguard.io").first()
    if not admin:
        hashed = hash_password("lg_demo_key_2026")
        user = User(
            email="telemetry.lead@labguard.io",
            hashed_password=hashed,
            role="Hardware Telemetry Engineer",
            facility="Chamber Alpha-7 (ESP32 Gateway)",
        )
        db.add(user)
        db.commit()

    # Reset telemetry and sessions to zero baseline
    db.query(TelemetryRecord).delete()
    db.query(RecordingSession).delete()
    db.commit()
    db.close()

    # Reset serial service state
    serial_service.connected = False
    serial_service.current_port = None
    serial_service.packets_received = 0
    serial_service.valid_packets = 0
    serial_service.invalid_packets = 0
    serial_service.last_packet_time = None
    serial_service.simulator_active = False

    yield

client = TestClient(app)

def test_zero_baseline_stats():
    """Verify clean baseline metrics: exactly zero records, zero anomalies, neutral statuses."""
    res = client.get("/api/dashboard/stats")
    assert res.status_code == 200
    data = res.json()

    assert data["totalRecords"] == 0
    assert data["anomalyCount"] == 0
    assert data["viabilityScore"] is None
    assert data["dataIntegrityScore"] is None
    assert data["throughput"] == 0
    assert data["lastChecksumStatus"] == "NO_RECORDS"
    assert data["enclaveHashMatch"] is False
    assert data["hardwareConnected"] is False
    assert data["activeSessionId"] is None

def test_zero_baseline_latest_telemetry_empty():
    """When no telemetry is stored, the time-series points endpoint must return empty list."""
    res = client.get("/api/dashboard/latest")
    assert res.status_code == 200
    assert res.json() == []

def test_zero_baseline_sessions_empty():
    """When no sessions exist, the sessions endpoint must return empty list."""
    res = client.get("/api/sessions")
    assert res.status_code == 200
    assert res.json() == []

def test_zero_baseline_serial_status():
    """Serial status starts disconnected with zero processed packets."""
    res = client.get("/api/serial/status")
    assert res.status_code == 200
    status = res.json()

    assert status["connected"] is False
    assert status["port"] is None
    assert status["packetsReceived"] == 0
    assert status["validPackets"] == 0
    assert status["invalidPackets"] == 0
    assert status["lastPacketTime"] is None
    assert status["simulatorActive"] is False
    assert status["throughput"] == 0

def test_authentication_working():
    """Authentication succeeds with correct credentials and returns a real bearer token."""
    res = client.post(
        "/api/auth/login",
        json={"email": "telemetry.lead@labguard.io", "password": "lg_demo_key_2026"}
    )
    assert res.status_code == 200
    body = res.json()
    assert "sessionToken" in body
    assert body["email"] == "telemetry.lead@labguard.io"

    # Protected endpoint access with token
    token = body["sessionToken"]
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "telemetry.lead@labguard.io"

def test_authentication_fails_cleanly_on_wrong_password():
    """Wrong password returns 401 Unauthorized without crashing or entering demo mode."""
    res = client.post(
        "/api/auth/login",
        json={"email": "telemetry.lead@labguard.io", "password": "wrong_password_123"}
    )
    assert res.status_code == 401

def test_metric_transitions_on_real_verified_data():
    """Transition from zero baseline to 1 valid record, then 1 invalid record, verifying honest metrics."""
    # Step 1: Submit 1 valid signed record
    valid_record = authenticator_service.sign_record(
        session_id="SESSION-TEST-001",
        device_id="ESP32-DEV-01",
        seq=1,
        elapsed_ms=0,
        source="DS18B20",
        value_centi_c=2450,
        key_id="KEY-001",
    )
    is_valid, status, reason, _ = authenticator_service.verify_single_record(valid_record)
    assert is_valid is True

    # Persist via DB
    db = TestingSessionLocal()
    rec = TelemetryRecord(
        session_id="SESSION-TEST-001",
        seq=1,
        elapsed_ms=0,
        timestamp_utc="10:00:00",
        source="DS18B20",
        value_centi_c=2450,
        temp_c=24.50,
        unit="C",
        key_id="KEY-001",
        hmac_tag=valid_record["auth"]["tag"],
        is_valid=True,
        is_simulated=False,
    )
    db.add(rec)
    db.commit()

    # Verify metrics update to 1 record, 100% viability
    stats_res = client.get("/api/dashboard/stats")
    stats = stats_res.json()
    assert stats["totalRecords"] == 1
    assert stats["anomalyCount"] == 0
    assert stats["viabilityScore"] == 100.0
    assert stats["dataIntegrityScore"] == 100.0
    assert stats["lastChecksumStatus"] == "VALID"
    assert stats["enclaveHashMatch"] is True
    assert stats["activeSessionId"] == "SESSION-TEST-001"

    # Step 2: Submit 1 invalid / tampered record
    tampered_rec = TelemetryRecord(
        session_id="SESSION-TEST-001",
        seq=2,
        elapsed_ms=2000,
        timestamp_utc="10:00:02",
        source="DS18B20",
        value_centi_c=9999,
        temp_c=99.99,
        unit="C",
        key_id="KEY-001",
        hmac_tag="badtag0000000000000000000000000000000000000000000000000000000000",
        is_valid=False,
        error_reason="HMAC authentication tag mismatch",
        is_simulated=False,
    )
    db.add(tampered_rec)
    db.commit()
    db.close()

    # Verify metrics update to 2 records, 1 anomaly, 50% viability, and lastChecksumStatus FAIL
    stats_res2 = client.get("/api/dashboard/stats")
    stats2 = stats_res2.json()
    assert stats2["totalRecords"] == 2
    assert stats2["anomalyCount"] == 1
    assert stats2["viabilityScore"] == 50.0
    assert stats2["dataIntegrityScore"] == 50.0
    assert stats2["lastChecksumStatus"] == "FAIL"
    assert stats2["enclaveHashMatch"] is False
