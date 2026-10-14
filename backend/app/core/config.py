import json
import os
from pathlib import Path
from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directories
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
WORKSPACE_DIR = BACKEND_DIR.parent
DATA_DIR = BACKEND_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseSettings):
    PROJECT_NAME: str = "LabGuard Backend"
    VERSION: str = "2.4.0"
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = f"sqlite:///{DATA_DIR / 'labguard.db'}"

    # Keystore path - checks LABGUARD/keys/labguard_keys.json
    KEYSTORE_PATH: Path = WORKSPACE_DIR / "LABGUARD" / "keys" / "labguard_keys.json"

    # Serial Communication
    DEFAULT_BAUD_RATE: int = 115200
    SERIAL_TIMEOUT_SECONDS: float = 1.0

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    # Session token lifespan in seconds (12 hours)
    SESSION_EXPIRE_SECONDS: int = 43200

    model_config = SettingsConfigDict(env_file=".env", extra="allow")

settings = Settings()
