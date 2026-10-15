import sys
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure backend root is on Python sys.path
backend_root = Path(__file__).resolve().parent.parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from backend.app.core.config import settings
from backend.app.core.logging_config import setup_logging, logger
from backend.app.database import init_db
from backend.app.api.api_router import api_router
from backend.app.services.serial_service import serial_service
from backend.app.services.session_service import session_service

setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup sequence
    logger.info("Initializing LabGuard Local Backend...")
    init_db()
    logger.info("SQLite database verified and initialized.")

    # Wire serial receiver callback to telemetry database persistence
    serial_service.on_record_received = session_service.record_incoming_telemetry
    logger.info("Connected serial receiver to database persistence engine.")

    # Initialize demo session so it is immediately inspectable
    from backend.app.services.tamper_service import tamper_service
    from backend.app.services.email_service import email_service
    tamper_service.ensure_demo_session_initialized()
    if email_service.is_configured():
        logger.info(f"Gmail SMTP alert service active (STARTTLS): alerts directed to {settings.TAMPER_ALERT_TO}")
    else:
        logger.info("Gmail SMTP alert service ready (offline mode: App Password placeholder present in backend/.env).")

    yield

    # Shutdown sequence
    logger.info("Shutting down LabGuard Local Backend...")
    serial_service.disconnect()
    serial_service.stop_simulator()
    logger.info("Clean shutdown completed.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Local Hardware-Integrated Evidence Authentication Backend for LabGuard.",
    lifespan=lifespan,
)

# Configure CORS for local React + Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all API endpoints
app.include_router(api_router)

@app.get("/")
def root():
    return {
        "service": "LabGuard Backend",
        "status": "ONLINE",
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "/api/health",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
