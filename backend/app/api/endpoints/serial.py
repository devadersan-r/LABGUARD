from typing import List
from fastapi import APIRouter, HTTPException, status
from backend.app.schemas import (
    SerialPortInfo,
    SerialStatusResponse,
    SerialConnectRequest,
    SimulatorToggleRequest,
)
from backend.app.services.serial_service import serial_service

router = APIRouter(prefix="/serial", tags=["Serial Communication"])

@router.get("/ports", response_model=List[SerialPortInfo])
def list_serial_ports():
    """Enumerate physical and virtual COM ports available on the host machine."""
    return serial_service.list_ports()

@router.get("/status", response_model=SerialStatusResponse)
def get_serial_status():
    """Get current hardware serial connection status and packet statistics."""
    return serial_service.get_status()

@router.post("/connect")
def connect_serial(req: SerialConnectRequest):
    """Open a serial connection to the specified COM port."""
    success, msg = serial_service.connect(req.port, req.baudRate or 115200)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg,
        )
    return {"success": True, "message": msg}

@router.post("/disconnect")
def disconnect_serial():
    """Safely terminate the active serial connection."""
    success, msg = serial_service.disconnect()
    return {"success": success, "message": msg}

@router.post("/simulator")
def toggle_simulator(req: SimulatorToggleRequest):
    """Start or stop the built-in hardware simulator for bench testing without an ESP32."""
    if req.active:
        success, msg = serial_service.start_simulator(req.intervalSeconds or 2.0)
    else:
        success, msg = serial_service.stop_simulator()
    return {"success": success, "message": msg, "simulatorActive": req.active}
