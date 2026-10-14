import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from backend.app.database import Base

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(128), unique=True, index=True, nullable=False)
    hashed_password = Column(String(256), nullable=False)
    role = Column(String(64), default="Hardware Telemetry Engineer")
    facility = Column(String(128), default="Chamber Alpha-7 (ESP32 Gateway)")
    created_at = Column(DateTime, default=utc_now)

    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")

class UserSession(Base):
    __tablename__ = "user_sessions"

    token = Column(String(128), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utc_now)
    expires_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)

    user = relationship("User", back_populates="sessions")

class RecordingSession(Base):
    __tablename__ = "recording_sessions"

    id = Column(String(64), primary_key=True, index=True)  # e.g., 'SES-2026-0041'
    name = Column(String(128), nullable=False)
    device = Column(String(64), nullable=False)
    data_source = Column(String(64), nullable=False)
    record_count = Column(Integer, default=0)
    duration = Column(String(32), default="0m")
    started_at = Column(String(64), nullable=False)
    status = Column(String(16), default="Valid")  # 'Valid', 'Warning', 'Invalid'
    description = Column(Text, nullable=True)

    records = relationship("TelemetryRecord", back_populates="session", cascade="all, delete-orphan", order_by="TelemetryRecord.seq")

class TelemetryRecord(Base):
    __tablename__ = "telemetry_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(String(64), ForeignKey("recording_sessions.id"), nullable=False, index=True)
    seq = Column(Integer, nullable=False)
    elapsed_ms = Column(Integer, default=0)
    timestamp_utc = Column(String(32), nullable=False)
    source = Column(String(64), nullable=False)
    value_centi_c = Column(Integer, nullable=False)
    temp_c = Column(Float, nullable=False)
    unit = Column(String(8), default="C")
    key_id = Column(String(32), nullable=False)
    hmac_tag = Column(String(64), nullable=False)
    is_valid = Column(Boolean, default=True)
    error_reason = Column(String(256), nullable=True)
    is_simulated = Column(Boolean, default=False)

    session = relationship("RecordingSession", back_populates="records")

class VerificationJob(Base):
    __tablename__ = "verification_jobs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    file_name = Column(String(256), nullable=False)
    file_size = Column(String(32), nullable=False)
    file_type = Column(String(64), nullable=False)
    verified_at = Column(String(64), nullable=False)
    total_checked = Column(Integer, default=0)
    valid_count = Column(Integer, default=0)
    invalid_count = Column(Integer, default=0)
    sequence_issues_count = Column(Integer, default=0)
    overall_status = Column(String(32), nullable=False)  # 'Passed', 'Failed', 'UnableToVerify'
    report_data = Column(Text, nullable=False)  # JSON serialized full report
