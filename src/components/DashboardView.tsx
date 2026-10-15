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
  Square,
  Download,
  RotateCcw
} from 'lucide-react';
import { UserSession } from '../types';
import { TelemetryGraph, TelemetryPoint } from './TelemetryGraph';
import { DataIntegritySection } from './DataIntegritySection';
import { AppLayout, NavTab } from './AppLayout';
import { RecordingSessionsView } from './RecordingSessionsView';
import { EvidenceVerificationView } from './EvidenceVerificationView';
import { RecordingSession } from '../data/sampleSessions';
import { api, DashboardStats, SerialStatus, SerialPortInfo, SystemInfo } from '../services/api';

interface DashboardViewProps {
  session: UserSession;
  onLogout: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ session, onLogout }) => {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [inspectedSessionId, setInspectedSessionId] = useState<string>('');
  const [allSessions, setAllSessions] = useState<RecordingSession[]>([]);
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Dashboard Telemetry and Integrity State from Backend
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isLiveStream, setIsLiveStream] = useState<boolean>(true);
  const [graphData, setGraphData] = useState<TelemetryPoint[]>([]);

  // Serial Hardware and Simulator State
  const [serialStatus, setSerialStatus] = useState<SerialStatus | null>(null);
  const [availablePorts, setAvailablePorts] = useState<SerialPortInfo[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>('');
  const [serialMessage, setSerialMessage] = useState<string>('');
  const [isConnectingPort, setIsConnectingPort] = useState<boolean>(false);
  const [isTogglingSimulator, setIsTogglingSimulator] = useState<boolean>(false);
  const [isRefreshingPorts, setIsRefreshingPorts] = useState<boolean>(false);

  // Inspection & System state
  const [inspectionData, setInspectionData] = useState<any>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  // Auto-clear serial notification message after 6 seconds
  useEffect(() => {
    if (serialMessage) {
      const timer = setTimeout(() => setSerialMessage(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [serialMessage]);

  const refreshPorts = useCallback(async () => {
    setIsRefreshingPorts(true);
    try {
      const ports = await api.listSerialPorts();
      setAvailablePorts(ports);
      if (ports.length > 0 && (!selectedPort || !ports.some(p => p.port === selectedPort))) {
        setSelectedPort(ports[0].port);
      }
    } catch (err) {
      console.error('Error listing serial ports:', err);
    } finally {
      setIsRefreshingPorts(false);
    }
  }, [selectedPort]);

  // Load Dashboard stats & graph data from backend
  const loadDashboardData = useCallback(async () => {
    try {
      const [newStats, latestPoints, sStatus, sessionsList] = await Promise.all([
        api.getDashboardStats(),
        api.getLatestTelemetry(),
        api.getSerialStatus(),
        api.listSessions().catch(() => []),
      ]);
      setStats(newStats);
      setGraphData(latestPoints || []);
      setSerialStatus(sStatus);
      if (Array.isArray(sessionsList)) {
        setSessionCount(sessionsList.length);
        setAllSessions(sessionsList);
        if (sessionsList.length > 0) {
          setInspectedSessionId((prev) => {
            if (!prev || !sessionsList.some(s => s.id === prev)) {
              return newStats?.activeSessionId || sessionsList[0]?.id || prev;
            }
            return prev;
          });
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  }, []);

  // Poll dashboard metrics & serial status if live stream is enabled
  useEffect(() => {
    loadDashboardData();
    refreshPorts();

    if (!isLiveStream) return;
    const interval = setInterval(loadDashboardData, 3000);
    return () => clearInterval(interval);
  }, [isLiveStream, loadDashboardData, refreshPorts]);

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

  const [isResetting, setIsResetting] = useState<boolean>(false);

  const handleManualScan = async () => {
    setIsSyncing(true);
    try {
      await api.triggerDeepScan();
      await loadDashboardData();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetBaseline = async () => {
    setIsResetting(true);
    try {
      await api.resetToZeroBaseline();
      await loadDashboardData();
      setSerialMessage('Reset to pristine zero baseline (all metrics null).');
    } catch (err: any) {
      setSerialMessage(err.message || 'Failed to reset baseline');
    } finally {
      setIsResetting(false);
    }
  };

  const handleConnectPort = async () => {
    if (!selectedPort) return;
    setIsConnectingPort(true);
    setSerialMessage('');
    try {
      const res = await api.connectSerial(selectedPort);
      setSerialMessage(res.message);
      await loadDashboardData();
    } catch (err: any) {
      setSerialMessage(err.message || 'Connection failed');
    } finally {
      setIsConnectingPort(false);
    }
  };

  const handleDisconnectPort = async () => {
    setIsConnectingPort(true);
    setSerialMessage('');
    try {
      const res = await api.disconnectSerial();
      setSerialMessage(res.message);
      await loadDashboardData();
    } catch (err: any) {
      setSerialMessage(err.message || 'Disconnect failed');
    } finally {
      setIsConnectingPort(false);
    }
  };

  const handleToggleSimulator = async () => {
    const nextActive = !serialStatus?.simulatorActive;
    setIsTogglingSimulator(true);
    setSerialMessage('');
    try {
      const res = await api.toggleSimulator(nextActive);
      setSerialMessage(res.message);
      await loadDashboardData();
    } catch (err: any) {
      setSerialMessage(err.message || 'Failed to toggle simulator');
    } finally {
      setIsTogglingSimulator(false);
    }
  };

  const handleNavigateToInspection = (sessionId: string) => {
    setInspectedSessionId(sessionId);
    setCurrentTab('inspection');
    api.getSessionInspection(sessionId)
      .then(data => setInspectionData(data))
      .catch(() => setInspectionData(null));
    loadDashboardData();
  };

  const totalRecords = stats?.totalRecords ?? 0;
  const viabilityScore = stats?.viabilityScore ?? null;
  const dataIntegrityScore = stats?.dataIntegrityScore ?? null;

  return (
    <AppLayout
      currentTab={currentTab}
      onTabChange={setCurrentTab}
      session={session}
      onLogout={onLogout}
      globalSearch={globalSearch}
      onGlobalSearchChange={setGlobalSearch}
      sessionCount={sessionCount}
      serialStatus={serialStatus}
      isDemoMode={serialStatus?.simulatorActive || false}
    >
      {/* Tab 1: Recording Sessions */}
      {currentTab === 'sessions' && (
        <RecordingSessionsView onNavigateToInspection={handleNavigateToInspection} />
      )}

      {/* Tab 2: Main Dashboard */}
      {currentTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Box 1: Authenticated Session & Hardware Connectivity Banner */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-md border border-[#C9EAF7] flex flex-wrap items-center justify-between gap-4 text-[#17324D]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#BDEDFD] border border-[#A5E3FA] flex items-center justify-center text-[#087EE8] shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-[#082F61]">
                    {serialStatus?.connected 
                      ? 'Hardware Stream Active & Cryptographically Viable' 
                      : serialStatus?.simulatorActive 
                      ? 'Bench Simulator Stream Active (Synthetic Demonstration)' 
                      : 'Operator Authenticated · Hardware Standby / Disconnected'}
                  </h2>
                  <span className="text-[14px] font-bold text-[#082F61] bg-[#BDEDFD] border border-[#A5E3FA] px-2.5 py-0.5 rounded-full font-mono-telemetry">
                    HMAC-SHA256
                  </span>
                  {serialStatus?.connected ? (
                    <span className="text-[14px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      HARDWARE ONLINE
                    </span>
                  ) : serialStatus?.simulatorActive ? (
                    <span className="text-[14px] text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      SIMULATOR STREAM
                    </span>
                  ) : (
                    <span className="text-[14px] text-slate-700 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                      AWAITING INGRESS
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#58758D] mt-1 font-medium">
                  Operator Session: <code className="font-mono-telemetry text-[#087EE8] font-bold">{session.sessionToken.substring(0, 20)}...</code> · Authenticated: {session.loginTime} · Facility: {session.facility} · Stream: {serialStatus?.connected ? `Connected (${serialStatus.port})` : serialStatus?.simulatorActive ? 'Simulated' : 'Disconnected'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleResetBaseline}
                disabled={isResetting}
                title="Reset all records and metrics back to zero baseline (values at null)"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-[#58758D] hover:text-[#082F61] border border-[#C9EAF7] transition-all cursor-pointer shadow-xs disabled:opacity-50 active:scale-95"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                <span>Reset Baseline</span>
              </button>

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
              {!serialStatus?.connected && (
                <>
                  {availablePorts.length > 0 ? (
                    <select
                      value={selectedPort}
                      onChange={(e) => setSelectedPort(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-[#C9EAF7] rounded-xl text-xs font-medium text-[#082F61] cursor-pointer"
                    >
                      {availablePorts.map((p) => (
                        <option key={p.port} value={p.port}>
                          {p.port} ({p.description})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="px-2.5 py-1.5 bg-slate-100 border border-slate-300 text-slate-600 rounded-xl text-xs font-medium">
                      No Hardware Ports
                    </span>
                  )}

                  <button
                    onClick={refreshPorts}
                    disabled={isRefreshingPorts}
                    title="Re-scan host COM ports"
                    className="p-2 bg-white hover:bg-[#BDEDFD]/40 text-[#087EE8] border border-[#C9EAF7] rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isRefreshingPorts ? 'animate-spin' : ''}`} />
                  </button>
                </>
              )}

              {!serialStatus?.connected ? (
                <button
                  onClick={handleConnectPort}
                  disabled={!selectedPort || isConnectingPort}
                  className="px-3.5 py-1.5 bg-[#087EE8] hover:bg-[#0866D4] text-white rounded-xl font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs active:scale-95"
                >
                  {isConnectingPort ? 'Connecting...' : 'Connect Port'}
                </button>
              ) : (
                <button
                  onClick={handleDisconnectPort}
                  disabled={isConnectingPort}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                >
                  {isConnectingPort ? 'Disconnecting...' : 'Disconnect Port'}
                </button>
              )}

              <button
                onClick={handleToggleSimulator}
                disabled={isTogglingSimulator}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all border cursor-pointer active:scale-95 disabled:opacity-50 ${
                  serialStatus?.simulatorActive
                    ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                    : 'bg-white border-[#C9EAF7] text-[#087EE8] hover:bg-[#EAF9FF]'
                }`}
              >
                {isTogglingSimulator
                  ? 'Processing...'
                  : serialStatus?.simulatorActive
                  ? 'Stop Bench Simulator'
                  : 'Start Bench Simulator'}
              </button>
            </div>

            {/* In-bar Serial Operation Message */}
            {serialMessage && (
              <div className={`w-full mt-2 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border animate-in fade-in duration-200 ${
                serialMessage.toLowerCase().includes('fail') ||
                serialMessage.toLowerCase().includes('error') ||
                serialMessage.toLowerCase().includes('could not')
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                <span>{serialMessage}</span>
                <button
                  onClick={() => setSerialMessage('')}
                  className="text-xs font-bold opacity-60 hover:opacity-100 cursor-pointer px-1"
                >
                  ✕
                </button>
              </div>
            )}
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
                {totalRecords === 0 || viabilityScore === null ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[14px] font-semibold border bg-slate-100 text-slate-600 border-slate-300">
                    NO DATA
                  </span>
                ) : (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[14px] font-semibold border ${
                    viabilityScore >= 99.9 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                      : viabilityScore >= 95.0
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> {viabilityScore >= 99.9 ? 'OPTIMAL' : viabilityScore >= 95.0 ? 'ACCEPTABLE' : 'DEGRADED'}
                  </span>
                )}
              </div>
              
              <div className="flex items-baseline justify-between pt-1">
                <div className="text-3xl font-extrabold font-mono-telemetry text-[#082F61]">
                  {viabilityScore !== null ? (
                    <>
                      {viabilityScore.toFixed(2)} <span className="text-lg font-bold text-[#087EE8]">%</span>
                    </>
                  ) : (
                    <span className="text-slate-400 font-normal">null</span>
                  )}
                </div>
                <span className={`text-xs font-bold ${totalRecords === 0 ? 'text-slate-500' : (stats?.anomalyCount === 0 ? 'text-emerald-600' : 'text-amber-600')}`}>
                  {totalRecords === 0 ? '0 FLAGS' : (stats?.anomalyCount === 0 ? 'ZERO BITROT' : `${stats?.anomalyCount} FLAG(S)`)}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="w-full bg-[#F4FBFF] border border-[#C9EAF7] rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-[#087EE8] via-[#27C5FF] to-emerald-500 h-full transition-all duration-500"
                    style={{ width: viabilityScore !== null ? `${Math.min(100, Math.max(0, viabilityScore))}%` : '0%' }}
                  />
                </div>
                <div className="flex justify-between text-[14px] text-[#58758D]">
                  <span>Threshold: 99.90%</span>
                  <span className={`font-semibold ${
                    totalRecords === 0 
                      ? 'text-slate-500' 
                      : (stats?.lastChecksumStatus === 'VALID' ? 'text-emerald-700' : 'text-amber-700')
                  }`}>
                    Active Checksum: {stats?.lastChecksumStatus || 'NO_RECORDS'}
                  </span>
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
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[14px] font-semibold border ${
                  totalRecords === 0
                    ? 'bg-slate-100 text-slate-600 border-slate-300'
                    : stats?.anomalyCount === 0 
                    ? 'bg-[#BDEDFD] text-[#082F61] border-[#A5E3FA]' 
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {totalRecords === 0 ? 'NO CHAIN' : (stats?.anomalyCount === 0 ? 'UNBROKEN' : 'FLAGS LOGGED')}
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div className="text-3xl font-extrabold font-mono-telemetry text-[#082F61]">
                  {totalRecords > 0 ? (
                    <>
                      {totalRecords.toLocaleString()} <span className="text-sm font-bold text-[#087EE8]">records</span>
                    </>
                  ) : (
                    <span className="text-slate-400 font-normal">0 records</span>
                  )}
                </div>
                <span className={`text-xs font-bold ${
                  totalRecords === 0 
                    ? 'text-slate-500' 
                    : (stats?.anomalyCount === 0 ? 'text-[#087EE8]' : 'text-amber-600')
                }`}>
                  {totalRecords === 0 ? '0 ANOMALIES' : (stats?.anomalyCount === 0 ? '100% INTACT' : `${stats?.anomalyCount} ANOMALIES`)}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] flex items-center justify-between text-xs">
                <span className="text-[#58758D] font-medium">Population Verified:</span>
                <span className="text-[#082F61] font-bold flex items-center gap-1">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${totalRecords > 0 ? 'text-emerald-600' : 'text-slate-400'}`} /> {totalRecords} Total Telemetry Records
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
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[14px] font-semibold border ${
                  totalRecords === 0
                    ? 'bg-slate-100 text-slate-600 border-slate-300'
                    : stats?.enclaveHashMatch 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {totalRecords === 0 ? 'AWAITING INGEST' : (stats?.enclaveHashMatch ? 'VERIFIED' : 'ANOMALIES PRESENT')}
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div className="text-3xl font-extrabold font-mono-telemetry text-[#082F61]">
                  {dataIntegrityScore !== null ? (
                    <>
                      {dataIntegrityScore.toFixed(1)} <span className="text-lg font-bold text-emerald-600">%</span>
                    </>
                  ) : (
                    <span className="text-slate-400 font-normal">null</span>
                  )}
                </div>
                <span className={`text-xs font-bold flex items-center gap-1 ${
                  totalRecords === 0
                    ? 'text-slate-500'
                    : (stats?.enclaveHashMatch ? 'text-emerald-700' : 'text-amber-700')
                }`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${totalRecords > 0 && stats?.enclaveHashMatch ? 'text-emerald-600' : 'text-slate-400'}`} />
                  {totalRecords === 0 ? 'NO DATA' : (stats?.enclaveHashMatch ? 'AIRTIGHT' : 'AUDIT REQUIRED')}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] flex items-center justify-between text-xs">
                <span className="text-[#58758D] font-medium">Enclave Hash:</span>
                <span className="font-mono-telemetry font-bold text-[14px] text-[#087EE8]">
                  {totalRecords === 0 ? 'NO RECORDS' : (stats?.enclaveHashMatch ? 'HMAC-SHA256 Match' : 'Mismatch Detected')}
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
          <div className="bg-white rounded-2xl p-6 shadow-md border border-[#C9EAF7] text-[#17324D] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#C9EAF7] gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#BDEDFD] text-[#087EE8] flex items-center justify-center font-bold">
                  <FileSearch className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#082F61]">Record Inspection Console</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-[#58758D]">Active Session:</span>
                    {allSessions.length > 0 ? (
                      <select
                        value={inspectedSessionId}
                        onChange={(e) => setInspectedSessionId(e.target.value)}
                        className="px-2 py-0.5 bg-[#F4FBFF] border border-[#C9EAF7] rounded-lg text-xs font-bold text-[#087EE8] font-mono-telemetry cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#087EE8]"
                      >
                        {allSessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.id} — {s.name} ({s.recordCount} pkts)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <strong className="text-[#087EE8] font-mono-telemetry text-xs">{inspectedSessionId || 'None'}</strong>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={api.getSessionExportUrl(inspectedSessionId, 'jsonl')}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-[#F4FBFF] hover:bg-[#BDEDFD]/50 border border-[#C9EAF7] rounded-xl text-xs font-bold text-[#082F61] flex items-center gap-1.5 transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-[#087EE8]" />
                  <span>Export JSONL</span>
                </a>
                <a
                  href={api.getSessionExportUrl(inspectedSessionId, 'csv')}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-[#F4FBFF] hover:bg-[#BDEDFD]/50 border border-[#C9EAF7] rounded-xl text-xs font-bold text-[#082F61] flex items-center gap-1.5 transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-[#087EE8]" />
                  <span>Export CSV</span>
                </a>
                <button
                  onClick={() => setCurrentTab('sessions')}
                  className="text-xs font-bold text-[#087EE8] hover:underline cursor-pointer ml-2"
                >
                  ← Back to Sessions
                </button>
              </div>
            </div>

            {/* Session Metadata Summary */}
            {inspectionData && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-[#F4FBFF] rounded-xl border border-[#C9EAF7]">
                  <span className="text-[11px] font-bold text-[#58758D] uppercase block">Hardware Device</span>
                  <span className="font-bold text-[#082F61] font-mono-telemetry">{inspectionData.device || 'ESP32'}</span>
                </div>
                <div className="p-3 bg-[#F4FBFF] rounded-xl border border-[#C9EAF7]">
                  <span className="text-[11px] font-bold text-[#58758D] uppercase block">Laboratory Facility</span>
                  <span className="font-bold text-[#082F61]">{inspectionData.facility || 'Chamber Alpha-7'}</span>
                </div>
                <div className="p-3 bg-[#F4FBFF] rounded-xl border border-[#C9EAF7]">
                  <span className="text-[11px] font-bold text-[#58758D] uppercase block">Security Mode</span>
                  <span className="font-bold text-[#087EE8] font-mono-telemetry">{inspectionData.security_mode || 'HMAC-SHA256'}</span>
                </div>
                <div className="p-3 bg-[#F4FBFF] rounded-xl border border-[#C9EAF7]">
                  <span className="text-[11px] font-bold text-[#58758D] uppercase block">Records Verified</span>
                  <span className="font-bold text-[#082F61] font-mono-telemetry">{inspectionData.records_count ?? 0} frames</span>
                </div>
              </div>
            )}

            {/* Records Stream Table */}
            {inspectionData?.telemetry_stream && inspectionData.telemetry_stream.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-[#C9EAF7]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F4FBFF] text-[#58758D] uppercase font-bold border-b border-[#C9EAF7]">
                    <tr>
                      <th className="py-2.5 px-3"># Seq</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Probe</th>
                      <th className="py-2.5 px-3">Reading</th>
                      <th className="py-2.5 px-3">HMAC-SHA256 Digest</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#C9EAF7]/60 font-mono-telemetry">
                    {inspectionData.telemetry_stream.map((r: any) => (
                      <tr key={r.seq} className="hover:bg-[#F4FBFF]/50 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-[#082F61]">#{r.seq}</td>
                        <td className="py-2.5 px-3 text-[#58758D]">{r.time}</td>
                        <td className="py-2.5 px-3 text-[#082F61]">{r.probe}</td>
                        <td className="py-2.5 px-3 font-bold text-[#087EE8]">{r.val} °C</td>
                        <td className="py-2.5 px-3 text-[11px] text-[#58758D]">{r.hmac}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            r.valid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {r.valid ? 'VALID' : 'TAMPERED'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-[#58758D] bg-[#F4FBFF] rounded-xl border border-[#C9EAF7]">
                {inspectionData ? 'No telemetry records logged yet for this session.' : `Loading records for ${inspectedSessionId}...`}
              </div>
            )}

            {/* Raw JSON Frame Payload */}
            <div className="p-4 bg-[#F4FBFF] rounded-xl border border-[#C9EAF7] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#082F61]">Raw Canonical Payload Frame (SQLite Authenticated Records)</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] font-mono-telemetry">
                  JSON FORMATTED
                </span>
              </div>
              <pre className="bg-[#06264A] text-[#BDEDFD] p-4 rounded-xl text-xs font-mono-telemetry overflow-x-auto leading-relaxed border border-[#082F61] max-h-72">
                {inspectionData ? JSON.stringify(inspectionData, null, 2) : `Loading records for ${inspectedSessionId}...`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Tampering Demo */}
      {currentTab === 'tampering' && (
        <div className="space-y-6">
          <DataIntegritySection 
            onScanNow={handleManualScan} 
            onNavigateToInspection={handleNavigateToInspection} 
          />
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
