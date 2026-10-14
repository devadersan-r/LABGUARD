import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  RotateCcw, 
  Eye, 
  FileSearch, 
  Download, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu, 
  Layers, 
  ChevronLeft, 
  ChevronRight, 
  Info, 
} from 'lucide-react';
import { RecordingSession, INITIAL_SESSIONS } from '../data/sampleSessions';
import { NewSessionModal } from './NewSessionModal';
import { SessionDetailsDrawer } from './SessionDetailsDrawer';
import { api } from '../services/api';

interface RecordingSessionsViewProps {
  onNavigateToInspection?: (sessionId: string) => void;
}

export const RecordingSessionsView: React.FC<RecordingSessionsViewProps> = ({
  onNavigateToInspection,
}) => {
  // Application State
  const [sessions, setSessions] = useState<RecordingSession[]>(INITIAL_SESSIONS);
  const [selectedSession, setSelectedSession] = useState<RecordingSession | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [deviceFilter, setDeviceFilter] = useState<string>('All Devices');
  const [statusFilter, setStatusFilter] = useState<string>('All Statuses');
  const [sourceFilter, setSourceFilter] = useState<string>('All Sources');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Load sessions from backend
  const loadSessions = React.useCallback(async () => {
    try {
      const data = await api.listSessions({
        searchTerm,
        device: deviceFilter,
        status: statusFilter,
        source: sourceFilter,
      });
      if (data && data.length > 0) {
        setSessions(data);
      }
    } catch (err) {
      console.error('Failed to load sessions from API:', err);
    }
  }, [searchTerm, deviceFilter, statusFilter, sourceFilter]);

  React.useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3800);
  };

  // Compute Summary Statistics
  const totalSessionsCount = sessions.length;
  const totalRecordsCount = sessions.reduce((acc, s) => acc + s.recordCount, 0);
  const verifiedSessionsCount = sessions.filter((s) => s.status === 'Valid').length;
  const flaggedSessionsCount = sessions.filter((s) => s.status === 'Warning' || s.status === 'Invalid').length;

  // Filter & Sort Logic
  const filteredSessions = useMemo(() => {
    return sessions
      .filter((s) => {
        // Search
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchId = s.id.toLowerCase().includes(q);
          const matchName = s.name.toLowerCase().includes(q);
          const matchDevice = s.device.toLowerCase().includes(q);
          if (!matchId && !matchName && !matchDevice) return false;
        }

        // Device
        if (deviceFilter !== 'All Devices') {
          if (deviceFilter === 'ESP32-LAB-01' && s.device !== 'ESP32-LAB-01') return false;
          if (deviceFilter === 'ESP32-LAB-02' && s.device !== 'ESP32-LAB-02') return false;
        }

        // Status
        if (statusFilter !== 'All Statuses') {
          if (s.status !== statusFilter) return false;
        }

        // Source
        if (sourceFilter !== 'All Sources') {
          if (sourceFilter === 'ESP32' && !s.dataSource.includes('ESP32')) return false;
          if (sourceFilter === 'Sensor' && !s.dataSource.includes('Sensor')) return false;
          if (sourceFilter === 'Manual' && !s.dataSource.includes('Manual')) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'newest') {
          return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
        } else {
          return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
        }
      });
  }, [sessions, searchTerm, deviceFilter, statusFilter, sourceFilter, sortOrder]);

  // Paginated Slices
  const totalFiltered = filteredSessions.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const paginatedSessions = filteredSessions.slice(startIndex, startIndex + pageSize);

  // Actions
  const handleResetFilters = () => {
    setSearchTerm('');
    setDeviceFilter('All Devices');
    setStatusFilter('All Statuses');
    setSourceFilter('All Sources');
    setSortOrder('newest');
    setCurrentPage(1);
    showToast('Filters reset to default.');
  };

  const handleCreateSession = (newSession: RecordingSession) => {
    setSessions((prev) => [newSession, ...prev]);
    showToast(`Created new session ${newSession.id} successfully.`);
    loadSessions();
  };

  const handleRowInspect = (s: RecordingSession) => {
    if (onNavigateToInspection) {
      onNavigateToInspection(s.id);
    } else {
      showToast(`Inspecting records for ${s.id}...`);
    }
  };

  const handleExportSession = (s: RecordingSession, format: 'csv' | 'jsonl') => {
    const exportUrl = api.getSessionExportUrl(s.id, format);
    window.open(exportUrl, '_blank');
    showToast(`Exported ${s.id} as .${format.toUpperCase()}`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#082F61] text-white px-4 py-3 rounded-xl shadow-2xl border border-[#BDEDFD]/30 flex items-center gap-2.5 text-xs font-medium animate-in slide-in-from-bottom duration-300">
          <CheckCircle2 className="w-4 h-4 text-[#27C5FF]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Heading & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#082F61] tracking-tight">
            Recording Sessions
          </h1>
          <p className="text-xs sm:text-sm text-[#58758D] mt-1 max-w-2xl font-medium">
            Manage data collection sessions and inspect readings captured from connected or simulated devices.
          </p>
        </div>

        {/* Primary Action Button: + New Session */}
        <button
          onClick={() => setIsNewModalOpen(true)}
          className="self-start sm:self-auto px-5 py-2.5 bg-gradient-to-r from-[#087EE8] to-[#168BFF] hover:from-[#168BFF] hover:to-[#0866D4] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ New Session</span>
        </button>
      </div>

      {/* Compact Informational Banner */}
      <div className="p-3.5 px-4 bg-[#BDEDFD]/35 rounded-2xl border border-[#C9EAF7] text-xs text-[#082F61] flex items-center gap-3">
        <Info className="w-4 h-4 text-[#087EE8] shrink-0" />
        <span className="leading-relaxed">
          <strong>Demo Environment</strong> — The records shown here are sample data unless a real hardware connection is configured.
        </span>
      </div>

      {/* 4 Summary Cards (Compact White Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Sessions */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#C9EAF7] space-y-2 text-[#17324D] hover:border-[#087EE8]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#58758D] uppercase tracking-wide">
              Total Sessions
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#BDEDFD] text-[#087EE8] flex items-center justify-center border border-[#A5E3FA]">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono-telemetry text-[#082F61]">
            {totalSessionsCount}
          </div>
          <div className="flex items-center justify-between text-xs text-[#58758D]">
            <span>All recorded sessions</span>
            <span className="text-[13px] text-[#087EE8] font-bold">DEMO</span>
          </div>
        </div>

        {/* Card 2: Total Records */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#C9EAF7] space-y-2 text-[#17324D] hover:border-[#087EE8]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#58758D] uppercase tracking-wide">
              Total Records
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#BDEDFD] text-[#087EE8] flex items-center justify-center border border-[#A5E3FA]">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono-telemetry text-[#087EE8]">
            {totalRecordsCount}
          </div>
          <div className="flex items-center justify-between text-xs text-[#58758D]">
            <span>Across available sessions</span>
            <span className="text-[13px] text-[#087EE8] font-bold">TELEMETRY</span>
          </div>
        </div>

        {/* Card 3: Verified Sessions */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#C9EAF7] space-y-2 text-[#17324D] hover:border-[#10B981]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#58758D] uppercase tracking-wide">
              Verified Sessions
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#10B981] flex items-center justify-center border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono-telemetry text-[#10B981]">
            {verifiedSessionsCount}
          </div>
          <div className="flex items-center justify-between text-xs text-[#58758D]">
            <span>Integrity check passed</span>
            <span className="text-[13px] text-[#10B981] font-bold">HMAC OK</span>
          </div>
        </div>

        {/* Card 4: Flagged Sessions */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#C9EAF7] space-y-2 text-[#17324D] hover:border-[#EF4444]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#58758D] uppercase tracking-wide">
              Flagged Sessions
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-[#F59E0B] flex items-center justify-center border border-amber-200">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono-telemetry text-[#F59E0B]">
            {flaggedSessionsCount}
          </div>
          <div className="flex items-center justify-between text-xs text-[#58758D]">
            <span>Require review</span>
            <span className="text-[13px] text-[#EF4444] font-bold">ATTENTION</span>
          </div>
        </div>
      </div>

      {/* Session Filters Toolbar (White Card) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-md border border-[#C9EAF7] space-y-3 text-[#17324D]">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search Input */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-[#58758D] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by session ID or name..."
              className="w-full pl-9 pr-3 py-2 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-xs font-medium text-[#17324D] placeholder-[#58758D]/60 focus:outline-none focus:ring-2 focus:ring-[#087EE8] focus:border-[#087EE8] transition-all"
            />
          </div>

          {/* Device Dropdown */}
          <div>
            <select
              value={deviceFilter}
              onChange={(e) => {
                setDeviceFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-xs font-medium text-[#17324D] focus:outline-none focus:ring-2 focus:ring-[#087EE8] cursor-pointer"
            >
              <option value="All Devices">All Devices</option>
              <option value="ESP32-LAB-01">ESP32-LAB-01</option>
              <option value="ESP32-LAB-02">ESP32-LAB-02</option>
            </select>
          </div>

          {/* Status Dropdown */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-xs font-medium text-[#17324D] focus:outline-none focus:ring-2 focus:ring-[#087EE8] cursor-pointer"
            >
              <option value="All Statuses">All Statuses</option>
              <option value="Valid">Valid</option>
              <option value="Warning">Warning</option>
              <option value="Invalid">Invalid</option>
            </select>
          </div>

          {/* Data Source Dropdown */}
          <div>
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-xs font-medium text-[#17324D] focus:outline-none focus:ring-2 focus:ring-[#087EE8] cursor-pointer"
            >
              <option value="All Sources">All Sources</option>
              <option value="ESP32">ESP32 Sensor</option>
              <option value="Sensor">Simulated Sensor</option>
              <option value="Manual">Manual Input</option>
            </select>
          </div>

          {/* Sort & Reset Actions */}
          <div className="flex items-center gap-2">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
              className="w-full px-2.5 py-2 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-xs font-medium text-[#17324D] focus:outline-none focus:ring-2 focus:ring-[#087EE8] cursor-pointer"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>

            <button
              onClick={handleResetFilters}
              title="Reset Filters"
              className="p-2 rounded-xl bg-[#F4FBFF] hover:bg-[#BDEDFD]/40 text-[#58758D] hover:text-[#082F61] border border-[#C9EAF7] transition-colors cursor-pointer shrink-0"
              aria-label="Reset all filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sessions Table (White Card) */}
      <div className="bg-white rounded-2xl shadow-md border border-[#C9EAF7] overflow-hidden text-[#17324D]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="bg-[#F4FBFF] text-[#58758D] border-b border-[#C9EAF7]">
                <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Session ID</th>
                <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Session Name</th>
                <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Device</th>
                <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Data Source</th>
                <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Records</th>
                <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Duration</th>
                <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Started At</th>
                <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Status</th>
                <th className="py-3.5 px-4 font-bold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#C9EAF7]/60 text-[#17324D]">
              {paginatedSessions.length > 0 ? (
                paginatedSessions.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => {
                      setSelectedSession(s);
                      setIsDrawerOpen(true);
                    }}
                    className="hover:bg-[#F4FBFF] transition-colors cursor-pointer group"
                  >
                    {/* Session ID - JetBrains Mono for Record ID */}
                    <td className="py-3.5 px-4 font-mono-telemetry font-bold text-[#087EE8]">
                      {s.id}
                    </td>

                    {/* Session Name */}
                    <td className="py-3.5 px-4 font-bold text-[#082F61] group-hover:text-[#087EE8] transition-colors">
                      {s.name}
                    </td>

                    {/* Device */}
                    <td className="py-3.5 px-4 text-[#58758D] font-medium flex items-center gap-1.5 pt-4">
                      <Cpu className="w-3.5 h-3.5 text-[#087EE8] shrink-0" />
                      <span>{s.device}</span>
                    </td>

                    {/* Data Source */}
                    <td className="py-3.5 px-4 text-[#58758D] font-medium">
                      {s.dataSource}
                    </td>

                    {/* Records - Numeric sequence count */}
                    <td className="py-3.5 px-4 font-mono-telemetry font-bold text-[#082F61]">
                      {s.recordCount} <span className="text-[#58758D] text-[14px] font-normal font-sans">pkts</span>
                    </td>

                    {/* Duration */}
                    <td className="py-3.5 px-4 text-[#58758D]">
                      {s.duration}
                    </td>

                    {/* Started At */}
                    <td className="py-3.5 px-4 text-[#58758D]">
                      {s.startedAt}
                    </td>

                    {/* Status Badges */}
                    <td className="py-3.5 px-4">
                      {s.status === 'Valid' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[14px] font-bold bg-[#ECFDF5] text-[#065F46] border border-[#10B981]/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                          Valid
                        </span>
                      )}
                      {s.status === 'Warning' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[14px] font-bold bg-[#FFFBEB] text-[#92400E] border border-[#F59E0B]/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                          Warning
                        </span>
                      )}
                      {s.status === 'Invalid' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[14px] font-bold bg-[#FEF2F2] text-[#991B1B] border border-[#EF4444]/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                          Invalid
                        </span>
                      )}
                    </td>

                    {/* Actions: View, Inspect, Export */}
                    <td className="py-3.5 px-4 text-right">
                      <div
                        className="flex items-center justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* View Action */}
                        <button
                          onClick={() => {
                            setSelectedSession(s);
                            setIsDrawerOpen(true);
                          }}
                          title="View Session Details"
                          className="p-1.5 rounded-lg text-[#58758D] hover:text-[#087EE8] hover:bg-[#BDEDFD]/30 transition-colors cursor-pointer"
                          aria-label={`View details for ${s.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Inspect Action */}
                        <button
                          onClick={() => handleRowInspect(s)}
                          title="Inspect Telemetry Records"
                          className="p-1.5 rounded-lg text-[#58758D] hover:text-[#087EE8] hover:bg-[#BDEDFD]/30 transition-colors cursor-pointer"
                          aria-label={`Inspect records for ${s.id}`}
                        >
                          <FileSearch className="w-4 h-4" />
                        </button>

                        {/* Export Action */}
                        <button
                          onClick={() => handleExportSession(s, 'csv')}
                          title="Export Sample Records (CSV)"
                          className="p-1.5 rounded-lg text-[#58758D] hover:text-[#087EE8] hover:bg-[#BDEDFD]/30 transition-colors cursor-pointer"
                          aria-label={`Export CSV for ${s.id}`}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#58758D] space-y-2">
                    <div className="w-10 h-10 rounded-full bg-[#F4FBFF] border border-[#C9EAF7] flex items-center justify-center mx-auto text-[#58758D]">
                      <Search className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-bold text-[#082F61]">No matching recording sessions found</p>
                    <p className="text-xs">Try adjusting your search criteria or resetting filters.</p>
                    <button
                      onClick={handleResetFilters}
                      className="mt-2 text-xs text-[#087EE8] font-bold hover:underline cursor-pointer"
                    >
                      Reset All Filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Range Footer */}
        <div className="p-4 border-t border-[#C9EAF7] bg-[#F4FBFF]/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#58758D]">
          {/* Record Range Counter */}
          <div className="font-medium">
            Showing <strong className="text-[#082F61]">{totalFiltered > 0 ? startIndex + 1 : 0}</strong>–
            <strong className="text-[#082F61]">{Math.min(startIndex + pageSize, totalFiltered)}</strong> of{' '}
            <strong className="text-[#082F61]">{totalFiltered}</strong> sessions
            {totalFiltered !== totalSessionsCount && (
              <span className="text-[14px] ml-1 text-[#087EE8] font-bold">
                (filtered from {totalSessionsCount} total)
              </span>
            )}
          </div>

          {/* Page Controls & Page Size Selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-[#C9EAF7] rounded-lg px-2 py-1 text-xs text-[#082F61] font-semibold focus:outline-none focus:ring-1 focus:ring-[#087EE8] cursor-pointer"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>

            {/* Prev / Next Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={validCurrentPage <= 1}
                className="p-1.5 rounded-lg border border-[#C9EAF7] bg-white text-[#082F61] hover:bg-[#F4FBFF] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-semibold text-[#082F61]">
                Page {validCurrentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={validCurrentPage >= totalPages}
                className="p-1.5 rounded-lg border border-[#C9EAF7] bg-white text-[#082F61] hover:bg-[#F4FBFF] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* New Session Modal */}
      <NewSessionModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreate={handleCreateSession}
      />

      {/* Session Details Drawer */}
      <SessionDetailsDrawer
        session={selectedSession}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedSession(null);
        }}
        onInspect={(s) => handleRowInspect(s)}
        onExport={(s, format) => handleExportSession(s, format)}
      />
    </div>
  );
};
