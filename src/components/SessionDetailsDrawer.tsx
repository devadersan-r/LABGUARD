import React from 'react';
import { 
  X, 
  Download, 
  Search, 
  Clock, 
  Cpu, 
  Activity, 
  Radio, 
} from 'lucide-react';
import { RecordingSession } from '../data/sampleSessions';

interface SessionDetailsDrawerProps {
  session: RecordingSession | null;
  isOpen: boolean;
  onClose: () => void;
  onInspect: (session: RecordingSession) => void;
  onExport: (session: RecordingSession, format: 'csv' | 'jsonl') => void;
}

export const SessionDetailsDrawer: React.FC<SessionDetailsDrawerProps> = ({
  session,
  isOpen,
  onClose,
  onInspect,
  onExport,
}) => {
  if (!isOpen || !session) return null;

  const getStatusBadge = (status: RecordingSession['status']) => {
    switch (status) {
      case 'Valid':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[14px] font-semibold bg-[#ECFDF5] text-[#065F46] border border-[#10B981]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            Valid Integrity
          </span>
        );
      case 'Warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[14px] font-semibold bg-[#FFFBEB] text-[#92400E] border border-[#F59E0B]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
            Warning Check
          </span>
        );
      case 'Invalid':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[14px] font-semibold bg-[#FEF2F2] text-[#991B1B] border border-[#EF4444]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
            Invalid Signature
          </span>
        );
    }
  };

  // Mock points for the small telemetry sparkline
  const sparkPoints = [24.1, 24.3, 24.5, 24.4, 24.7, 24.8, 24.6, 24.9, 24.8, 25.0];
  const minVal = 24.0;
  const maxVal = 25.2;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-[#06264A]/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto border-l border-[#C9EAF7] text-[#17324D] animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-6 border-b border-[#C9EAF7] bg-[#F4FBFF]/80 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-mono-telemetry font-bold text-[#087EE8] bg-white px-2 py-0.5 rounded border border-[#C9EAF7]">
                {session.id}
              </span>
              {getStatusBadge(session.status)}
            </div>
            <h2 id="drawer-title" className="text-xl font-bold text-[#082F61]">
              {session.name}
            </h2>
            <p className="text-xs text-[#58758D] mt-1 font-medium">
              {session.description || 'Continuous telemetry recording session for hardware validation.'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#58758D] hover:text-[#082F61] rounded-xl hover:bg-[#F4FBFF] transition-colors cursor-pointer shrink-0"
            aria-label="Close session details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-[#F4FBFF] rounded-xl border border-[#C9EAF7]">
              <span className="text-[14px] font-bold text-[#58758D] uppercase block">Target Device</span>
              <span className="text-sm font-bold text-[#082F61] flex items-center gap-1.5 mt-0.5">
                <Cpu className="w-4 h-4 text-[#087EE8]" /> {session.device}
              </span>
            </div>

            <div className="p-3 bg-[#F4FBFF] rounded-xl border border-[#C9EAF7]">
              <span className="text-[14px] font-bold text-[#58758D] uppercase block">Data Source</span>
              <span className="text-sm font-bold text-[#082F61] flex items-center gap-1.5 mt-0.5">
                <Radio className="w-4 h-4 text-[#087EE8]" /> {session.dataSource}
              </span>
            </div>

            <div className="p-3 bg-[#F4FBFF] rounded-xl border border-[#C9EAF7]">
              <span className="text-[14px] font-bold text-[#58758D] uppercase block">Total Records</span>
              <span className="text-sm font-bold font-mono-telemetry text-[#087EE8] flex items-center gap-1.5 mt-0.5">
                <Activity className="w-4 h-4" /> {session.recordCount} pkts
              </span>
            </div>

            <div className="p-3 bg-[#F4FBFF] rounded-xl border border-[#C9EAF7]">
              <span className="text-[14px] font-bold text-[#58758D] uppercase block">Started At</span>
              <span className="text-xs font-semibold text-[#082F61] flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-[#087EE8]" /> {session.startedAt}
              </span>
            </div>

            <div className="p-3 bg-[#F4FBFF] rounded-xl border border-[#C9EAF7]">
              <span className="text-[14px] font-bold text-[#58758D] uppercase block">Duration</span>
              <span className="text-sm font-bold text-[#082F61] mt-0.5 block font-mono-telemetry">
                {session.duration}
              </span>
            </div>

            <div className="p-3 bg-[#F4FBFF] rounded-xl border border-[#C9EAF7]">
              <span className="text-[14px] font-bold text-[#58758D] uppercase block">Protocol</span>
              <span className="text-xs font-bold text-[#087EE8] mt-0.5 block font-mono-telemetry">
                HMAC-SHA256
              </span>
            </div>
          </div>

          {/* Small Telemetry Chart */}
          <div className="p-4 rounded-xl border border-[#C9EAF7] bg-white space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-[#082F61] flex items-center gap-1.5 font-bold">
                <Activity className="w-4 h-4 text-[#087EE8]" /> Telemetry Signal Profile
              </span>
              <span className="text-[#58758D] text-[14px]">Sampling: 1Hz</span>
            </div>

            <div className="h-28 w-full relative pt-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 300 80" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#087EE8" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#087EE8" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid line */}
                <line x1="0" y1="20" x2="300" y2="20" stroke="#E2E8F0" strokeDasharray="3 3" />
                <line x1="0" y1="60" x2="300" y2="60" stroke="#E2E8F0" strokeDasharray="3 3" />

                {/* Path */}
                <path
                  d={`M ${sparkPoints
                    .map((val, idx) => {
                      const x = (idx / (sparkPoints.length - 1)) * 300;
                      const y = 80 - ((val - minVal) / (maxVal - minVal)) * 60 - 10;
                      return `${x},${y}`;
                    })
                    .join(' L ')}`}
                  fill="none"
                  stroke="#087EE8"
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* Gradient area */}
                <path
                  d={`M 0,${80 - ((sparkPoints[0] - minVal) / (maxVal - minVal)) * 60 - 10} L ${sparkPoints
                    .map((val, idx) => {
                      const x = (idx / (sparkPoints.length - 1)) * 300;
                      const y = 80 - ((val - minVal) / (maxVal - minVal)) * 60 - 10;
                      return `${x},${y}`;
                    })
                    .join(' L ')} L 300,80 L 0,80 Z`}
                  fill="url(#chartGrad)"
                />
              </svg>
            </div>

            <div className="flex justify-between text-[14px] text-[#58758D] pt-1 border-t border-[#C9EAF7]">
              <span>T_start: {session.startedAt.slice(11)}</span>
              <span>Nominal Band: 24.0°C – 25.0°C</span>
              <span>T_end: +{session.duration}</span>
            </div>
          </div>

          {/* Preview of Recent Records */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#082F61] uppercase tracking-wide">
                Recent Records Preview ({session.sampleRecords.length} loaded)
              </h3>
              <span className="text-[14px] text-[#58758D]">
                Authoritative Checksums
              </span>
            </div>

            {session.sampleRecords.length > 0 ? (
              <div className="border border-[#C9EAF7] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#F4FBFF] text-[#58758D] border-b border-[#C9EAF7] font-sans">
                      <th className="py-2.5 px-3 font-semibold">Record</th>
                      <th className="py-2.5 px-3 font-semibold">Time</th>
                      <th className="py-2.5 px-3 font-semibold">Channel</th>
                      <th className="py-2.5 px-3 font-semibold">Reading</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#C9EAF7]/50">
                    {session.sampleRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[#F4FBFF] transition-colors">
                        <td className="py-2 px-3 font-bold text-[#082F61] font-mono-telemetry">{rec.id}</td>
                        <td className="py-2 px-3 text-[#58758D]">{rec.timestamp}</td>
                        <td className="py-2 px-3 text-[#087EE8] font-medium font-mono-telemetry">{rec.channel}</td>
                        <td className="py-2 px-3 font-bold text-[#082F61] font-mono-telemetry">{rec.value}</td>
                        <td className="py-2 px-3 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[13px] font-bold ${
                              rec.status === 'Valid'
                                ? 'bg-emerald-50 text-emerald-700'
                                : rec.status === 'Warning'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-[#C9EAF7] text-center text-xs text-[#58758D]">
                No records recorded yet for this standby session.
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-6 border-t border-[#C9EAF7] bg-[#F4FBFF]/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onExport(session, 'csv')}
              className="px-3.5 py-2 rounded-xl bg-white border border-[#C9EAF7] text-xs font-bold text-[#082F61] hover:bg-[#F4FBFF] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-[#087EE8]" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => onExport(session, 'jsonl')}
              className="px-3.5 py-2 rounded-xl bg-white border border-[#C9EAF7] text-xs font-bold text-[#082F61] hover:bg-[#F4FBFF] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-[#087EE8]" />
              <span>Export JSONL</span>
            </button>
          </div>

          <button
            onClick={() => onInspect(session)}
            className="px-4 py-2 rounded-xl bg-[#087EE8] hover:bg-[#168BFF] text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-blue-500/20 active:scale-95"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Inspect Records</span>
          </button>
        </div>
      </div>
    </div>
  );
};
