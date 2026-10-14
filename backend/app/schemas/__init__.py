from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

# ==================== Auth Schemas ====================
class LoginRequest(BaseModel):
    identifier: str = Field(..., description="User email or username")
    password: str = Field(..., description="Access password")

class UserOut(BaseModel):
    email: str
    role: str
    facility: str
    sessionToken: str
    loginTime: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ForgotPasswordResponse(BaseModel):
    success: bool
    message: str
    recoveryToken: Optional[str] = None

# ==================== Serial Schemas ====================
class SerialPortInfo(BaseModel):
    port: str
    description: str
    hwid: str

class SerialStatusResponse(BaseModel):
    connected: bool
    port: Optional[str] = None
    baudRate: int
    bytesReceived: int
    packetsReceived: int
    validPackets: int
    invalidPackets: int
    lastPacketTime: Optional[str] = None
    lastError: Optional[str] = None
    simulatorActive: bool

class SerialConnectRequest(BaseModel):
    port: str
    baudRate: Optional[int] = 115200

class SimulatorToggleRequest(BaseModel):
    active: bool
    intervalSeconds: Optional[float] = 2.0

# ==================== Dashboard Schemas ====================
class TelemetryPointOut(BaseModel):
    id: int
    time: str
    viability: float
    throughput: int
    hmac: str
    temperatureC: Optional[float] = None

class DashboardStatsResponse(BaseModel):
    hardwareConnected: bool
    activeSessionId: Optional[str] = None
    viabilityScore: float
    totalRecords: int
    dataIntegrityScore: float
    anomalyCount: int
    throughput: int
    lastChecksumStatus: str
    enclaveHashMatch: bool
    connectedSince: Optional[str] = None
    measurementPeriod: str
    recordsDenominator: int

# ==================== Session Schemas ====================
class SessionRecordOut(BaseModel):
    id: str
    timestamp: str
    channel: str
    value: str
    hmacDigest: str
    status: str  # 'Valid' | 'Warning' | 'Invalid'

class RecordingSessionOut(BaseModel):
    id: str
    name: str
    device: str
    dataSource: str
    recordCount: int
    duration: str
    startedAt: str
    status: str
    description: Optional[str] = None
    sampleRecords: List[SessionRecordOut] = []

class CreateSessionRequest(BaseModel):
    name: str
    device: str = "ESP32-LAB-01"
    dataSource: str = "ESP32 Sensor"
    description: Optional[str] = ""

# ==================== Evidence Verification Schemas ====================
class EvidenceRecordOut(BaseModel):
    sequence: int
    timestamp: str
    source: str
    value: str
    integrityTag: str
    expectedTag: str
    result: str  # 'Passed' | 'Failed'
    issueDetails: str

class VerificationReportOut(BaseModel):
    fileName: str
    fileSize: str
    fileType: str
    verifiedAt: str
    checksEnabled: Dict[str, bool]
    totalChecked: int
    validCount: int
    invalidCount: int
    sequenceIssuesCount: int
    overallStatus: str  # 'Passed' | 'Failed' | 'UnableToVerify'
    records: List[EvidenceRecordOut]

class VerifyRecordRequest(BaseModel):
    record: Dict[str, Any]

class VerifyRecordResponse(BaseModel):
    isValid: bool
    status: str  # 'VALID' | 'INVALID' | 'UNVERIFIABLE'
    reason: Optional[str] = None
    computedTag: Optional[str] = None
    suppliedTag: Optional[str] = None

# ==================== Tampering Demo Schemas ====================
class TamperStatusResponse(BaseModel):
    isTampered: bool
    payloadText: str
    currentSignature: str
    expectedSignature: str
    verifiedStatus: str  # 'VERIFIED' | 'TAMPERED_MISMATCH'
    nonce: int
    lastCheckTime: str

class TamperSimulateRequest(BaseModel):
    tamperPayload: bool = True
    customValue: Optional[float] = None

# ==================== System Schemas ====================
class SystemInfoResponse(BaseModel):
    version: str
    firmwareSpecification: str
    cryptographicStandard: str
    secureBootStatus: str
    hardwareEnclave: str
    keyStorePath: str
    activeKeyId: str
    databasePath: str
