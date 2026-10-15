
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.app.core.config import settings


# Read the configured database URL.
db_url = settings.DATABASE_URL

# Resolve relative SQLite paths consistently.
if db_url.startswith("sqlite:///") and not db_url.startswith("sqlite:////"):
    raw_path = db_url[len("sqlite:///"):]

    is_windows_absolute = len(raw_path) > 2 and raw_path[1] == ":"

    if not is_windows_absolute and not Path(raw_path).is_absolute():
        resolved_path = (settings.BACKEND_DIR / raw_path).resolve()
        resolved_path.parent.mkdir(parents=True, exist_ok=True)
        db_url = f"sqlite:///{resolved_path.as_posix()}"

# Support Supabase/PostgreSQL connection URLs.
# psycopg (version 3) will be installed as a project dependency.
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg://", 1)
elif db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

is_sqlite = db_url.startswith("sqlite:")

# SQLite and PostgreSQL require different connection settings.
engine_options = {"pool_pre_ping": True}

if is_sqlite:
    engine_options["connect_args"] = {"check_same_thread": False}

engine = create_engine(db_url, **engine_options)


# Apply SQLite PRAGMAs only to SQLite connections.
if is_sqlite:

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables and remove the designated demo account if it exists."""
    from backend.app.models import (
        User,
        UserSession,
        RecordingSession,
        TelemetryRecord,
    )

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        dummy = (
            db.query(User)
            .filter(User.email == "telemetry.lead@labguard.io")
            .first()
        )

        if dummy:
            db.query(UserSession).filter(
                UserSession.user_id == dummy.id
            ).delete(synchronize_session=False)

            db.delete(dummy)
            db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
