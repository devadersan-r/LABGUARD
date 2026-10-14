import React, { useState } from 'react';
import { X, Plus, AlertCircle, Radio, Cpu } from 'lucide-react';
import { RecordingSession } from '../data/sampleSessions';
import { api } from '../services/api';

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (newSession: RecordingSession) => void;
}

export const NewSessionModal: React.FC<NewSessionModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [device, setDevice] = useState('ESP32-LAB-01');
  const [dataSource, setDataSource] = useState('ESP32 Sensor');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a descriptive session name.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const created = await api.createSession({
        name: name.trim(),
        device,
        dataSource,
        description: description.trim() || 'Session created in LabGuard portal.',
      });
      onCreate(created);
      setName('');
      setDescription('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize session in database');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#06264A]/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-session-modal-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#C9EAF7] p-6 sm:p-8 text-[#17324D]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#58758D] hover:text-[#082F61] p-1.5 rounded-lg hover:bg-[#F4FBFF] transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-[#087EE8] mb-1">
            <Radio className="w-5 h-5" />
            <span className="text-xs font-bold tracking-wider uppercase font-mono-telemetry">
              Hardware Telemetry Setup
            </span>
          </div>
          <h2 id="new-session-modal-title" className="text-2xl font-extrabold text-[#082F61] tracking-tight">
            Create Recording Session
          </h2>
          <p className="text-xs sm:text-sm text-[#58758D] mt-1 font-medium">
            Initialize a demonstration session to record telemetry readings from simulated or edge lab devices.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Session Name */}
          <div className="space-y-1.5">
            <label htmlFor="session-name" className="block text-xs font-bold text-[#082F61] uppercase tracking-wide">
              Session Name <span className="text-red-500">*</span>
            </label>
            <input
              id="session-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Thermal Cycle Test #4"
              className="w-full px-3.5 py-2.5 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-sm font-medium text-[#17324D] placeholder-[#58758D]/60 focus:outline-none focus:ring-2 focus:ring-[#087EE8] focus:border-[#087EE8] transition-all"
            />
          </div>

          {/* Device & Data Source Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Device */}
            <div className="space-y-1.5">
              <label htmlFor="device-select" className="block text-xs font-bold text-[#082F61] uppercase tracking-wide">
                Target Device <span className="text-red-500">*</span>
              </label>
              <select
                id="device-select"
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-sm font-medium text-[#17324D] focus:outline-none focus:ring-2 focus:ring-[#087EE8] focus:border-[#087EE8] cursor-pointer"
              >
                <option value="ESP32-LAB-01">ESP32-LAB-01 (Chamber Alpha)</option>
                <option value="ESP32-LAB-02">ESP32-LAB-02 (Benchtop Rig)</option>
                <option value="Manual Input">Manual Input (Terminal)</option>
              </select>
            </div>

            {/* Data Source */}
            <div className="space-y-1.5">
              <label htmlFor="source-select" className="block text-xs font-bold text-[#082F61] uppercase tracking-wide">
                Data Source <span className="text-red-500">*</span>
              </label>
              <select
                id="source-select"
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-sm font-medium text-[#17324D] focus:outline-none focus:ring-2 focus:ring-[#087EE8] focus:border-[#087EE8] cursor-pointer"
              >
                <option value="ESP32 Sensor">ESP32 Sensor</option>
                <option value="Manual Input">Manual Input</option>
                <option value="Simulated Sensor">Simulated Sensor</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="session-desc" className="block text-xs font-bold text-[#082F61] uppercase tracking-wide">
              Description <span className="text-[#58758D] font-normal lowercase">(optional)</span>
            </label>
            <textarea
              id="session-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add lab notes, probe configurations, or ambient test conditions..."
              className="w-full px-3.5 py-2.5 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-sm text-[#17324D] placeholder-[#58758D]/60 focus:outline-none focus:ring-2 focus:ring-[#087EE8] focus:border-[#087EE8] transition-all resize-none"
            />
          </div>

          {/* Prototype Notice */}
          <div className="p-3 bg-[#F4FBFF] rounded-xl border border-[#C9EAF7] text-xs text-[#58758D] flex items-start gap-2">
            <Cpu className="w-4 h-4 text-[#087EE8] shrink-0 mt-0.5" />
            <span>
              <strong>Simulated Environment:</strong> This session will be initialized locally in demo mode with sample records.
            </span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#C9EAF7]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#C9EAF7] bg-white text-xs font-bold text-[#58758D] hover:text-[#082F61] hover:bg-[#F4FBFF] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#087EE8] to-[#168BFF] hover:from-[#168BFF] hover:to-[#0866D4] text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create Session</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
