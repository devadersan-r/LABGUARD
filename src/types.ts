export interface TelemetryPacket {
  deviceId: string;
  timestamp: string;
  temperatureC: number;
  rotaryKnobPercent: number;
  voltageV: number;
  sequenceNumber: number;
  hmacSignature: string;
  isVerified: boolean;
}

export interface UserSession {
  email: string;
  role: string;
  facility: string;
  sessionToken: string;
  loginTime: string;
}
