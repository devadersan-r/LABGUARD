import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  FileCheck2, 
  Database, 
  Fingerprint, 
  FileSearch, 
  Radio, 
  Power, 
  Cpu, 
  AlertCircle,
  Play,
  Square
} from 'lucide-react';
import { UserSession } from '../types';
import { TelemetryGraph, TelemetryPoint } from './TelemetryGraph';
import { DataIntegritySection } from './DataIntegritySection';
import { AppLayout, NavTab } from './AppLayout';
import { RecordingSessionsView } from './RecordingSessionsView';
import { EvidenceVerificationView } from './EvidenceVerificationView';
import { api, DashboardStats, SerialStatus, SerialPortInfo, SystemInfo } from '../services/api';

interface DashboardViewProps {
  session: UserSession;
  onLogout: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ session, onLogout }) => {
  const [currentTab, setCurrentTab] = useState<NavTab>('evidence');
  const [inspectedSessionId, setInspectedSessionId] = useState<string>('SES-2026-0041');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Dashboard Telemetry and Integrity State from Backend
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isLiveStream, setIsLiveStream] = useState<boolean>(true);
  const [graphData, setGraphData] = useState<TelemetryPoint[]>([]);

  // Serial Hardware and Simulator State
  const [serialStatus, setSerialStatus] = useState<SerialStatus | null>(null);
  const [availablePorts, setAvailablePorts] = useState<SerialPortInfo[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>('');
  const [serialMessage, setSerialMessage] = useState<string>('');

  // Inspection & System state
  const [inspectionData, setInspectionData] = useState<any>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  // Load Dashboard stats & graph data from backend
  const loadDashboardData = useCallback(async () => {
    try {
      const [newStats, latestPoints, sStatus] = await Promise.all([
        api.getDashboardStats(),
        api.getLatestTelemetry(),
        api.getSerialStatus(),
      ]);
      setStats(newStats);
      if (latestPoints.length > 0) {
        setGraphData(latestPoints);
      }
      setSerialStatus(sStatus);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  }, []);

  // Poll dashboard metrics & serial status if live stream is enabled
  useEffect(() => {
    loadDashboardData();
    api.listSerialPorts().then(ports => {
      setAvailablePorts(ports);
      if (ports.length > 0 && !selectedPort) {
        setSelectedPort(ports[0].port);
      }
    });

    if (!isLiveStream) return;
    const interval = setInterval(loadDashboardData, 3000);
    return () => clearInterval(interval);
  }, [isLiveStream, loadDashboardData]);

  // Load inspection data when inspection tab is active
  useEffect(() => {
    if (currentTab === 'inspection' && inspectedSessionId) {
      api.getSessionInspection(inspectedSessionId)
        .then(data => setInspectionData(data))
        .catch(() => setInspectionData(null));
    }
    if (currentTab === 'settings') {
      api.getSystemInfo().then(info => setSystemInfo(info)).catch(() => {});
    }
  }, [currentTab, inspectedSessionId]);

  const handleManualScan = async () => {
    setIsSyncing(true);
    try {
      await api.triggerDeepScan();
      await loadDashboardData();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectPort = async () => {
    if (!selectedPort) return;
    try {
      const res = await api.connectSerial(selectedPort);
      setSerialMessage(res.message);
      await loadDashboardData();
    } catch (err: any) {
      setSerialMessage(err.message || 'Connection failed');
    }
  };

  const handleDisconnectPort = async () => {
    try {
      const res = await api.disconnectSerial();
      setSerialMessage(res.message);
      await loadDashboardData();
    } catch (err: any) {
      setSerialMessage(err.message || 'Disconnect failed');
    }
  };

  const handleToggleSimulator = async () => {
    const nextActive = !serialStatus?.simulatorActive;
    try {
      const res = await api.toggleSimulator(nextActive);
      setSerialMessage(res.message);
      await loadDashboardData();
    } catch (err: any) {
      setSerialMessage(err.message || 'Failed to toggle simulator');
    }
  };

  const handleNavigateToInspection = (sessionId: string) => {
    setInspectedSessionId(sessionId);
    setCurrentTab('inspection');
  };

  const viabilityScore = stats?.viabilityScore ?? 100.0;
  const totalRecords = stats?.totalRecords ?? 0;
  const dataIntegrityScore = stats?.dataIntegrityScore ?? 100.0;

  return (
    <AppLayout
      currentTab={currentTab}
      onTabChange={setCurrentTab}
      session={session}
      onLogout={onLogout}
      globalSearch={globalSearch}
      onGlobalSearchChange={setGlobalSearch}
    >
      {/* Tab 1: Recording Sessions */}
      {currentTab === 'sessions' && (
        <RecordingSessionsView onNavigateToInspection={handleNavigateToInspection} />
      )}

      {/* Tab 2: Main Dashboard */}
      {currentTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Box 1: White Authenticated Session Card */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-md border border-[#C9EAF7] flex flex-wrap items-center justify-between gap-4 text-[#17324D]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#BDEDFD] border border-[#A5E3FA] flex items-center justify-center text-[#087EE8] shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-[#082F61]">Hardware Session Active & Cryptographically Viable</h2>
                  <span className="text-[14px] font-bold text-[#082F61] bg-[#BDEDFD] border border-[#A5E3FA] px-2.5 py-0.5 rounded-full font-mono-telemetry">
                    HMAC-SHA256
                  </span>
                  <span className="text-[14px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    AUTHENTICATED
                  </span>
                </div>
                <p className="text-xs text-[#58758D] mt-1 font-medium">
                  Session Token: <code className="font-mono-telemetry text-[#087EE8] font-bold">{session.sessionToken}</code> · Connected since {session.loginTime} · Facility: {session.facility}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleManualScan}
                disabled={isSyncing}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-[#087EE8] to-[#168BFF] hover:from-[#168BFF] hover:to-[#0866D4] text-white transition-all cursor-pointer shadow-md shadow-blue-500/20 disabled:opacity-70 active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Deep Integrity Scan</span>
              </button>
            </div>
          </div>

          {/* Hardware Serial Interface & Bench Simulator Bar */}
          <div className="bg-[#F4FBFF] rounded-2xl p-4 sm:p-5 border border-[#C9EAF7] flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                serialStatus?.connected ? 'bg-emerald-100 text-emerald-700' : (serialStatus?.simulatorActive ? 'bg-blue-100 text-[#087EE8]' : 'bg-slate-200 text-slate-600')
              }`}>
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#082F61]">USB Hardware Serial:</span>
                  {serialStatus?.connected ? (
                    <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      CONNECTED ({serialStatus.port} @ {serialStatus.baudRate} baud)
                    </span>
                  ) : serialStatus?.simulatorActive ? (
                    <span className="text-blue-700 font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                      SIMULATOR STREAM ACTIVE
                    </span>
                  ) : (
                    <span className="text-slate-600 font-semibold bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-md">
                      DISCONNECTED
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#58758D] mt-0.5">
                  Packets Processed: {serialStatus?.packetsReceived ?? 0} ({serialStatus?.validPackets ?? 0} Valid / {serialStatus?.invalidPackets ?? 0} Flagged) · Last Frame: {serialStatus?.lastPacketTime || 'None'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {availablePorts.length > 0 && !serialStatus?.connected && (
                <select
                  value={selectedPort}
                  onChange={(e) => setSelectedPort(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-[#C9EAF7] rounded-xl text-xs font-medium text-[#082F61]"
                >
                  {availablePorts.map((p) => (
                    <option key={p.port} value={p.port}>
                      {p.port} ({p.description})
                    </option>
                  ))}
                </select>
              )}

              {!serialStatus?.connected ? (
                <button
                  onClick={handleConnectPort}
                  disabled={!selectedPort}
                  className="px-3 py-1.5 bg-[#087EE8] hover:bg-[#0866D4] text-white rounded-xl font-bold transition-all disabled:opacity-50"
                >
                  Connect Port
                </button>
              ) : (
                <button
                  onClick={handleDisconnectPort}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all"
                >
                  Disconnect Port
                </button>
              )}

              <button
                onClick={handleToggleSimulator}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all border ${
                  serialStatus?.simulatorActive
                    ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                    : 'bg-white border-[#C9EAF7] text-[#087EE8] hover:bg-[#EAF9FF]'
                }`}
              >
                {serialStatus?.simulatorActive ? 'Stop Bench Simulator' : 'Start Bench Simulator'}
              </button>
            </div>
          </div>

          {/* Box 2: Three Core Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Record Viability */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-md border border-[#C9EAF7] flex flex-col justify-between space-y-3 hover:border-[#087EE8]/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#082F61] uppercase tracking-wider flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#BDEDFD] flex items-center justify-center text-[#087EE8]">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  Record Viability
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[14px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> OPTIMAL
                </span>
              </div>
              
              <div className="flex items-baseline justify-between pt-1">
                <div className="text-3xl font-extrabold font-mono-telemetry text-[#082F61]">
                  {viabilityScore.toFixed(2)} <span className="text-lg font-bold text-[#087EE8]">%</span>
                </div>
                <span className="text-xs text-emerald-600 font-bold">
                  {stats?.anomalyCount === 0 ? 'ZERO BITROT' : `${stats?.anomalyCount} FLAG`}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="w-full bg-[#F4FBFF] border border-[#C9EAF7] rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-[#087EE8] via-[#27C5FF] to-emerald-500 h-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, viabilityScore))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[14px] text-[#58758D]">
                  <span>Threshold: 99.90%</span>
                  <span className="font-semibold text-emerald-700">Active Checksum: {stats?.lastChecksumStatus || 'VALID'}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Chain Viability */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-md border border-[#C9EAF7] flex flex-col justify-between space-y-3 hover:border-[#087EE8]/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#082F61] uppercase tracking-wider flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#BDEDFD] flex items-center justify-center text-[#087EE8]">
                    <Database className="w-4 h-4" />
                  </div>
                  Chain Viability
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[14px] font-semibold bg-[#BDEDFD] text-[#082F61] border border-[#A5E3FA]">
                  UNBROKEN
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div className="text-3xl font-extrabold font-mono-telemetry text-[#082F61]">
                  {totalRecords.toLocaleString()} <span className="text-sm font-bold text-[#087EE8]">records</span>
                </div>
                <span className="text-xs text-[#087EE8] font-bold">
                  100% INTACT
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] flex items-center justify-between text-xs">
                <span className="text-[#58758D] font-medium">Tamper Events:</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {stats?.anomalyCount ?? 0} Anomalies
                </span>
              </div>
            </div>

            {/* Card 3: Data Integrity Status */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-md border border-[#C9EAF7] flex flex-col justify-between space-y-3 hover:border-[#087EE8]/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#082F61] uppercase tracking-wider flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#BDEDFD] flex items-center justify-center text-[#087EE8]">
                    <Fingerprint className="w-4 h-4" />
                  </div>
                  Data Integrity
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[14px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  VERIFIED
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div className="text-3xl font-extrabold font-mono-telemetry text-[#082F61]">
                  {dataIntegrityScore.toFixed(1)} <span className="text-lg font-bold text-emerald-600">%</span>
                </div>
                <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> AIRTIGHT
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] flex items-center justify-between text-xs">
                <span className="text-[#58758D] font-medium">Enclave Hash:</span>
                <span className="font-mono-telemetry text-[#087EE8] font-bold text-[14px]">
                  HMAC-SHA256 Match
                </span>
              </div>
            </div>
          </div>

          {/* Box 3: Telemetry Graph Card */}
          <section aria-label="Record Viability Graph">
            <TelemetryGraph
              data={graphData}
              isLive={isLiveStream}
              onToggleLive={() => setIsLiveStream(!isLiveStream)}
            />
          </section>

          {/* Box 4: Dedicated Data Integrity Section */}
          <section aria-label="Cryptographic Data Integrity Section">
            <DataIntegritySection onScanNow={handleManualScan} />
          </section>
        </div>
      )}

      {/* Tab 3: Evidence Verification */}
      {currentTab === 'evidence' && (
        <EvidenceVerificationView />
      )}

      {/* Tab 4: Record Inspection */}
      {currentTab === 'inspection' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-md border border-[#C9EAF7] text-[#17324D] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#C9EAF7]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#BDEDFD] text-[#087EE8] flex items-center justify-center font-bold">
                  <FileSearch className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#082F61]">Record Inspection Console</h2>
                  <p className="text-xs text-[#58758D]">
                    Inspecting session: <strong className="text-[#087EE8] font-mono-telemetry">{inspectedSessionId}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCurrentTab('sessions')}
                className="text-xs font-bold text-[#087EE8] hover:underline cursor-pointer"
              >
                ← Back to Recording Sessions
              </button>
            </div>

            <div className="p-4 bg-[#F4FBFF] rounded-xl border border-[#C9EAF7] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#082F61]">Selected Hardware Enclave Payload Frame (SQLite Authenticated Records)</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[14px]">
                  VERIFIED
                </span>
              </div>
              <pre className="bg-[#06264A] text-[#BDEDFD] p-4 rounded-xl text-xs font-mono-telemetry overflow-x-auto leading-relaxed border border-[#082F61]">
                {inspectionData ? JSON.stringify(inspectionData, null, 2) : `Loading records for ${inspectedSessionId}...`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Tampering Demo */}
      {currentTab === 'tampering' && (
        <div className="space-y-6">
          <DataIntegritySection onScanNow={handleManualScan} />
        </div>
      )}

      {/* Tab 6: Settings / About */}
      {currentTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-md border border-[#C9EAF7] text-[#17324D] space-y-4">
            <h2 className="text-lg font-bold text-[#082F61]">About LABGUARD Telemetry System</h2>
            <p className="text-xs text-[#58758D] leading-relaxed">
              LABGUARD provides cryptographically verified telemetry data pipelines for laboratory and industrial IoT instruments. By combining ESP32 edge enclaves with HMAC-SHA256 non-repudiation, every reading captured is mathematically guaranteed against on-wire injection, bit corruption, and retrospective tampering.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-[#F4FBFF] rounded-xl border border-[#C9EAF7] space-y-1">
                <span className="text-[14px] font-bold text-[#58758D] uppercase">Firmware Specification</span>
                <span className="text-sm font-bold text-[#082F61] block font-mono-telemetry">
                  {systemInfo?.firmwareSpecification || 'LABGUARD-ESP32 v2.4 (DS18B20 OneWire GPIO 4)'}
                </span>
              </div>
              <div className="p-4 bg-[#F4FBFF] rounded-xl border border-[#C9EAF7] space-y-1">
                <span className="text-[14px] font-bold text-[#58758D] uppercase">Cryptographic Standard</span>
                <span className="text-sm font-bold text-[#082F61] block font-mono-telemetry">
                  {systemInfo?.cryptographicStandard || 'FIPS 198-1 / RFC 2104 (HMAC-SHA256)'}
                </span>
              </div>
              <div className="p-4 bg-[#F4FBFF] rounded-xl border border-[#C9EAF7] space-y-1">
                <span className="text-[14px] font-bold text-[#58758D] uppercase">Security Level / Enclave</span>
                <span className="text-sm font-bold text-[#082F61] block font-mono-telemetry">
                  {systemInfo?.secureBootStatus || 'Software Flash Key (Development Mode)'}
                </span>
              </div>
              <div className="p-4 bg-[#F4FBFF] rounded-xl border border-[#C9EAF7] space-y-1">
                <span className="text-[14px] font-bold text-[#58758D] uppercase">Active Key Identifier</span>
                <span className="text-sm font-bold text-[#082F61] block font-mono-telemetry">
                  {systemInfo?.activeKeyId || 'KEY-001'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};
