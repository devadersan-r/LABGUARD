import { UserSession } from '../types';
import { RecordingSession } from '../data/sampleSessions';
import { VerificationReport } from '../components/EvidenceVerificationView';
import { TelemetryPoint } from '../components/TelemetryGraph';

const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('lg_session_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface DashboardStats {
  hardwareConnected: boolean;
  activeSessionId?: string;
  viabilityScore: number;
  totalRecords: number;
  dataIntegrityScore: number;
  anomalyCount: number;
  throughput: number;
  lastChecksumStatus: string;
  enclaveHashMatch: boolean;
  connectedSince?: string;
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

  async logout(): Promise<void> {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    }).catch(() => {});
    localStorage.removeItem('lg_session_token');
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

  // Tampering Demo
  async getTamperStatus(): Promise<TamperStatus> {
    const res = await fetch(`${API_BASE}/tamper/status`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to load tampering status');
    return res.json();
  },

  async simulateTamper(tamperPayload: boolean): Promise<TamperStatus> {
    const res = await fetch(`${API_BASE}/tamper/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ tamperPayload }),
    });
    if (!res.ok) throw new Error('Failed to toggle tamper simulation');
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
    return res.json();
  },

  async toggleSimulator(active: boolean): Promise<{ success: boolean; message: string; simulatorActive: boolean }> {
    const res = await fetch(`${API_BASE}/serial/simulator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ active, intervalSeconds: 2.0 }),
    });
    return res.json();
  },
};
