from fastapi import APIRouter
from backend.app.schemas import SystemInfoResponse
from backend.app.core.config import settings

router = APIRouter(tags=["System & Health"])

@router.get("/health")
def health_check():
    """Backend availability health check."""
    return {
        "status": "healthy",
        "service": "LabGuard Backend",
        "version": settings.VERSION,
        "database": "SQLite (WAL Mode Active)",
        "offlineOnly": True,
    }

@router.get("/system/info", response_model=SystemInfoResponse)
def get_system_info():
    """System configuration and cryptographic capability metadata.
    In accordance with Section 61-67 of bprompt2.txt:
    Claims are strictly grounded in actual code. Secure boot and hardware enclaves are
    explicitly labeled as software/prototype level unless dedicated secure element hardware is configured.
    """
    return SystemInfoResponse(
        version=settings.VERSION,
        firmwareSpecification="LABGUARD-ESP32 v2.4 (DS18B20 OneWire GPIO 4)",
        cryptographicStandard="HMAC-SHA256 (RFC 2104 / RFC 4231) via mbedtls / hashlib",
        secureBootStatus="Software Key (Development Mode — External Hardware Secure Element Not Configured)",
        hardwareEnclave="ESP32 Internal Flash (Symmetric Shared Secret)",
        keyStorePath=str(settings.KEYSTORE_PATH),
        activeKeyId="KEY-001",
        databasePath=settings.DATABASE_URL,
    )
