import { UserSession } from '../types';
import { RecordingSession } from '../data/sampleSessions';
import { VerificationReport } from '../components/EvidenceVerificationView';
import { TelemetryPoint } from '../components/TelemetryGraph';

// Centralized API Base URL configurable via VITE_API_BASE_URL (defaults to Vite proxy /api)
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('lg_session_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface DashboardStats {
  hardwareConnected: boolean;
  activeSessionId?: string | null;
  viabilityScore?: number | null;
  totalRecords: number;
  dataIntegrityScore?: number | null;
  anomalyCount: number;
  throughput: number;
  lastChecksumStatus: string;
  enclaveHashMatch: boolean;
  connectedSince?: string | null;
  measurementPeriod: string;
  recordsDenominator: number;
}

export interface SerialStatus {
  connected: boolean;
  port?: string;
  baudRate: number;
  bytesReceived: number;
  packetsReceived: number;
  validPackets: number;
  invalidPackets: number;
  lastPacketTime?: string;
  lastError?: string;
  connectedSince?: string;
  simulatorActive: boolean;
}

export interface SerialPortInfo {
  port: string;
  description: string;
  hwid: string;
}

export interface TamperStatus {
  isTampered: boolean;
  payloadText: string;
  currentSignature: string;
  expectedSignature: string;
  verifiedStatus: string;
  nonce: number;
  lastCheckTime: string;
  sessionId?: string;
  recordedStatus?: string;
}

export interface NotificationStatus {
  configured: boolean;
  provider: string;
  host: string;
  port: number;
  fromEmail: string;
  alertRecipient: string;
  tlsEnabled: boolean;
  totalAlertsSent: number;
  lastAlertTime: string | null;
  lastAlertStatus: string;
  lastErrorMessage: string | null;
  cooldownSeconds: number;
}

export interface TestEmailResponse {
  success: boolean;
  message: string;
  recipient: string;
  timestamp: string;
}

export interface SystemInfo {
  version: string;
  firmwareSpecification: string;
  cryptographicStandard: string;
  secureBootStatus: string;
  hardwareEnclave: string;
  keyStorePath: string;
  activeKeyId: string;
  databasePath: string;
}

export const api = {
  // Auth
  async login(identifier: string, password: string): Promise<UserSession> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Authentication failed' }));
      throw new Error(err.detail || 'Authentication failed');
    }
    const data = await res.json();
    localStorage.setItem('lg_session_token', data.sessionToken);
    return data;
  },

  async register(email: string, password: string, confirmPassword: string): Promise<UserSession> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        confirm_password: confirmPassword,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Account creation failed' }));
      throw new Error(err.detail || 'Account creation failed');
    }
    const data = await res.json();
    localStorage.setItem('lg_session_token', data.sessionToken);
    return data;
  },

  async checkEmail(email: string): Promise<{ email: string; exists: boolean }> {
    const res = await fetch(`${API_BASE}/auth/check-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      throw new Error('Failed to verify email account status');
    }
    return res.json();
  },

  async googleAuth(
    email: string,
    password?: string,
    confirmPassword?: string,
    name?: string,
    credential?: string
  ): Promise<UserSession> {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        confirm_password: confirmPassword,
        name,
        credential,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Google authentication failed' }));
      throw new Error(err.detail || 'Google authentication failed');
    }
    const data = await res.json();
    localStorage.setItem('lg_session_token', data.sessionToken);
    return data;
  },

  async logout(): Promise<void> {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    }).catch(() => {});
    localStorage.removeItem('lg_session_token');
  },

  async getMe(): Promise<UserSession> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) {
      throw new Error('Invalid or expired session');
    }
    return res.json();
  },

  async forgotPassword(email: string): Promise<{ success: boolean; message: string; recoveryToken?: string }> {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return res.json();
  },

  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE}/dashboard/stats`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch dashboard metrics');
    return res.json();
  },

  async getLatestTelemetry(): Promise<TelemetryPoint[]> {
    const res = await fetch(`${API_BASE}/dashboard/latest`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) return [];
    return res.json();
  },

  async triggerDeepScan(): Promise<any> {
    const res = await fetch(`${API_BASE}/dashboard/scan`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return res.json();
  },

  async resetToZeroBaseline(): Promise<any> {
    const res = await fetch(`${API_BASE}/dashboard/reset`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return res.json();
  },

  // Sessions
  async listSessions(filters?: {
    searchTerm?: string;
    device?: string;
    status?: string;
    source?: string;
  }): Promise<RecordingSession[]> {
    const params = new URLSearchParams();
    if (filters?.searchTerm) params.set('searchTerm', filters.searchTerm);
    if (filters?.device) params.set('device', filters.device);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.source) params.set('source', filters.source);

    const res = await fetch(`${API_BASE}/sessions?${params.toString()}`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to load recording sessions');
    return res.json();
  },

  async createSession(data: { name: string; device?: string; dataSource?: string; description?: string }): Promise<RecordingSession> {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create recording session');
    return res.json();
  },

  async getSessionInspection(sessionId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/records`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error(`Failed to load inspection records for ${sessionId}`);
    return res.json();
  },

  getSessionExportUrl(sessionId: string, format: 'jsonl' | 'csv'): string {
    return `${API_BASE}/sessions/${sessionId}/export?format=${format}`;
  },

  // Evidence Verification
  async verifyEvidenceFile(file: File): Promise<VerificationReport> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/evidence/verify`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Verification failed' }));
      throw new Error(err.detail || 'Verification failed');
    }
    return res.json();
  },

  async getSampleEvidence(sampleType: 'clean' | 'tampered'): Promise<VerificationReport> {
    const res = await fetch(`${API_BASE}/evidence/sample/${sampleType}`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error(`Failed to load sample evidence: ${sampleType}`);
    return res.json();
  },

  getSampleDownloadUrl(sampleType: 'clean' | 'tampered'): string {
    return `${API_BASE}/evidence/sample/${sampleType}/download`;
  },

  // Tampering Demo
  async getTamperStatus(): Promise<TamperStatus> {
    const res = await fetch(`${API_BASE}/tamper/status`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to load tampering status');
    return res.json();
  },

  async simulateTamper(tamperPayload: boolean, sessionId?: string): Promise<TamperStatus> {
    const res = await fetch(`${API_BASE}/tamper/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ tamperPayload, sessionId }),
    });
    if (!res.ok) throw new Error('Failed to toggle tamper simulation');
    return res.json();
  },

  // Notifications & SMTP Alerts
  async getNotificationStatus(): Promise<NotificationStatus> {
    const res = await fetch(`${API_BASE}/notifications/status`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to load notification status');
    return res.json();
  },

  async sendTestEmail(recipient?: string): Promise<TestEmailResponse> {
    const res = await fetch(`${API_BASE}/notifications/test-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ recipient }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to dispatch test email' }));
      throw new Error(err.detail || 'Failed to dispatch test email');
    }
    return res.json();
  },

  // System & Serial
  async getSystemInfo(): Promise<SystemInfo> {
    const res = await fetch(`${API_BASE}/system/info`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to load system info');
    return res.json();
  },

  async getSerialStatus(): Promise<SerialStatus> {
    const res = await fetch(`${API_BASE}/serial/status`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch serial status');
    return res.json();
  },

  async listSerialPorts(): Promise<SerialPortInfo[]> {
    const res = await fetch(`${API_BASE}/serial/ports`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) return [];
    return res.json();
  },

  async connectSerial(port: string, baudRate?: number): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/serial/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ port, baudRate }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to connect serial port' }));
      throw new Error(err.detail || 'Failed to connect serial port');
    }
    return res.json();
  },

  async disconnectSerial(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/serial/disconnect`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to disconnect serial port' }));
      throw new Error(err.detail || 'Failed to disconnect serial port');
    }
    return res.json();
  },

  async toggleSimulator(active: boolean): Promise<{ success: boolean; message: string; simulatorActive: boolean }> {
    const res = await fetch(`${API_BASE}/serial/simulator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ active, intervalSeconds: 2.0 }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to toggle simulator' }));
      throw new Error(err.detail || 'Failed to toggle simulator');
    }
    return res.json();
  },
};
