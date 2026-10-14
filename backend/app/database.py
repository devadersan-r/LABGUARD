import datetime
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.core.config import settings

# SQLite engine with check_same_thread=False for FastAPI concurrency
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
)

# Enable WAL mode and foreign key constraints on SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Create all tables and seed default users and demo sessions if empty."""
    from backend.app.models import User, RecordingSession, TelemetryRecord
    from backend.app.core.security import hash_password

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Check if default admin user exists
        admin = db.query(User).filter(User.email == "telemetry.lead@labguard.io").first()
        if not admin:
            # Seed default admin user (credentials documented in local access portal)
            hashed = hash_password("lg_demo_key_2026")
            admin_user = User(
                email="telemetry.lead@labguard.io",
                hashed_password=hashed,
                role="Hardware Telemetry Engineer",
                facility="Chamber Alpha-7 (ESP32 Gateway)",
            )
            db.add(admin_user)
            db.commit()

        # Seed initial sample sessions if database is fresh
        existing_sessions = db.query(RecordingSession).count()
        if existing_sessions == 0:
            sample_sessions_data = [
                {
                    "id": "SES-2026-0041",
                    "name": "Temperature Test",
                    "device": "ESP32-LAB-01",
                    "data_source": "ESP32 Sensor",
                    "record_count": 5,
                    "duration": "1h 12m",
                    "started_at": "2026-10-12 17:45",
                    "status": "Valid",
                    "description": "Chamber Alpha thermal equilibrium stress test over 72 minutes with calibrated resistance thermometer.",
                    "records": [
                        {"seq": 1, "elapsed_ms": 0, "time": "17:45:02", "centi": 2420, "tag": "7a29f0...e4c1", "valid": True},
                        {"seq": 2, "elapsed_ms": 218000, "time": "17:48:40", "centi": 2450, "tag": "8b11c2...99ad", "valid": True},
                        {"seq": 3, "elapsed_ms": 433000, "time": "17:52:15", "centi": 2460, "tag": "4c88a9...31fe", "valid": True},
                        {"seq": 4, "elapsed_ms": 658000, "time": "17:56:00", "centi": 2480, "tag": "90ea12...04bc", "valid": True},
                        {"seq": 5, "elapsed_ms": 920000, "time": "18:00:22", "centi": 2460, "tag": "66fe42...19ac", "valid": True},
                    ]
                },
                {
                    "id": "SES-2026-0042",
                    "name": "Sensor Calibration",
                    "device": "ESP32-LAB-02",
                    "data_source": "Sensor",
                    "record_count": 4,
                    "duration": "52m",
                    "started_at": "2026-10-12 16:20",
                    "status": "Valid",
                    "description": "Multi-point voltage scale linearity calibration across 12-bit ADC channels.",
                    "records": [
                        {"seq": 1, "elapsed_ms": 5000, "time": "16:20:05", "centi": 1650, "tag": "94c1a7...30b2", "valid": True},
                        {"seq": 2, "elapsed_ms": 330000, "time": "16:25:30", "centi": 2100, "tag": "19fa22...73ac", "valid": True},
                        {"seq": 3, "elapsed_ms": 730000, "time": "16:32:10", "centi": 2800, "tag": "65de81...99bc", "valid": True},
                        {"seq": 4, "elapsed_ms": 1518000, "time": "16:45:18", "centi": 3300, "tag": "80cd11...42ad", "valid": True},
                    ]
                },
                {
                    "id": "SES-2026-0043",
                    "name": "Bench Experiment",
                    "device": "ESP32-LAB-01",
                    "data_source": "ESP32 Sensor",
                    "record_count": 4,
                    "duration": "38m",
                    "started_at": "2026-10-12 15:05",
                    "status": "Warning",
                    "description": "Manual rotary knob dial sweep under RF noise emitter. Minor transport jitter observed on frame 9.",
                    "records": [
                        {"seq": 1, "elapsed_ms": 12000, "time": "15:05:12", "centi": 2450, "tag": "29ea54...87fe", "valid": True},
                        {"seq": 2, "elapsed_ms": 420000, "time": "15:12:00", "centi": 2680, "tag": "51ff90...33aa", "valid": True},
                        {"seq": 3, "elapsed_ms": 944000, "time": "15:20:44", "centi": 2920, "tag": "74aa31...19cc", "valid": False, "err": "Transport jitter / integrity warning"},
                        {"seq": 4, "elapsed_ms": 1810000, "time": "15:35:10", "centi": 2680, "tag": "98cc22...55dd", "valid": True},
                    ]
                }
            ]

            for s_data in sample_sessions_data:
                records_data = s_data.pop("records")
                session_obj = RecordingSession(**s_data)
                db.add(session_obj)
                db.commit()

                for r in records_data:
                    rec_obj = TelemetryRecord(
                        session_id=session_obj.id,
                        seq=r["seq"],
                        elapsed_ms=r["elapsed_ms"],
                        timestamp_utc=r["time"],
                        source="DS18B20",
                        value_centi_c=r["centi"],
                        temp_c=round(r["centi"] / 100.0, 2),
                        unit="C",
                        key_id="KEY-001",
                        hmac_tag=r["tag"],
                        is_valid=r["valid"],
                        error_reason=r.get("err"),
                        is_simulated=True,
                    )
                    db.add(rec_obj)
                db.commit()

    finally:
        db.close()
