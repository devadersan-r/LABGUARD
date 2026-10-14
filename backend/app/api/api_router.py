from fastapi import APIRouter
from backend.app.api.endpoints import (
    auth,
    serial,
    dashboard,
    sessions,
    evidence,
    tamper,
    system,
)

api_router = APIRouter(prefix="/api")

api_router.include_router(system.router)
api_router.include_router(auth.router)
api_router.include_router(serial.router)
api_router.include_router(dashboard.router)
api_router.include_router(sessions.router)
api_router.include_router(evidence.router)
api_router.include_router(tamper.router)
