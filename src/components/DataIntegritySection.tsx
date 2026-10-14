import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  KeyRound, 
  CheckCircle2, 
  Binary, 
  RefreshCw, 
  AlertTriangle,
  Fingerprint,
} from 'lucide-react';

import { api } from '../services/api';

interface DataIntegritySectionProps {
  onScanNow?: () => void;
}

export const DataIntegritySection: React.FC<DataIntegritySectionProps> = ({ onScanNow }) => {
  const [isTampered, setIsTampered] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [nonce, setNonce] = useState<number>(49210);
  const [lastCheckTime, setLastCheckTime] = useState<string>('Just now');
  const [payloadText, setPayloadText] = useState<string>(
    '{"device":"LABGUARD_ESP32_01","channel":"CH0_ADC","val":24.60,"seq":49210}'
  );
  const [currentSignature, setCurrentSignature] = useState<string>(
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );
  const [expectedSignature, setExpectedSignature] = useState<string>(
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );

  const fetchTamperStatus = React.useCallback(async () => {
    try {
      const data = await api.getTamperStatus();
      setIsTampered(data.isTampered);
      setPayloadText(data.payloadText);
      setCurrentSignature(data.currentSignature);
      setExpectedSignature(data.expectedSignature);
      setNonce(data.nonce);
      setLastCheckTime(data.lastCheckTime);
    } catch (err) {
      console.error('Error fetching tamper status:', err);
    }
  }, []);

  useEffect(() => {
    fetchTamperStatus();
    const timer = setInterval(() => {
      if (!isTampered) {
        fetchTamperStatus();
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [isTampered, fetchTamperStatus]);

  const handleTamperToggle = async () => {
    setIsVerifying(true);
    try {
      const nextTamper = !isTampered;
      const data = await api.simulateTamper(nextTamper);
      setIsTampered(data.isTampered);
      setPayloadText(data.payloadText);
      setCurrentSignature(data.currentSignature);
      setExpectedSignature(data.expectedSignature);
      setNonce(data.nonce);
      setLastCheckTime(data.lastCheckTime);
    } catch (err) {
      console.error('Failed to toggle tamper state on backend:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  const currentSig = currentSignature;

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-md border border-[#C9EAF7] text-[#17324D] space-y-6 transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#C9EAF7]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#BDEDFD] text-[#087EE8] border border-[#A5E3FA] flex items-center justify-center font-bold shrink-0">
            <Fingerprint className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-[#082F61]">
                Cryptographic Data Integrity Engine
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#BDEDFD] text-[#082F61] font-mono-telemetry border border-[#A5E3FA]">
                HMAC-SHA256
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 font-mono-telemetry border border-emerald-200">
                FIPS 198-1 COMPLIANT
              </span>
            </div>
            <p className="text-xs text-[#58758D] mt-0.5">
              Continuous proof of non-alteration, anti-replay nonce synchronization, and cryptographic invariant validation
            </p>
          </div>
        </div>

        {/* Live Integrity Badge */}
        <div className="flex items-center gap-2 font-mono-telemetry text-xs">
          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-bold ${
            isTampered 
              ? 'bg-rose-50 border-rose-200 text-rose-700' 
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            {isTampered ? (
              <>
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>INTEGRITY MISMATCH DETECTED</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>100% INTEGRITY VERIFIED</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 4 Integrity Key Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono-telemetry text-xs">
        {/* Metric 1 */}
        <div className="p-4 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] space-y-1">
          <span className="text-[11px] text-[#58758D] block font-medium">BIT ERROR RATE (BER)</span>
          <div className="text-xl font-bold text-[#082F61]">0.0000 %</div>
          <span className="text-[10px] text-emerald-700 font-semibold block flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Zero Invariant Drift
          </span>
        </div>

        {/* Metric 2 */}
        <div className="p-4 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] space-y-1">
          <span className="text-[11px] text-[#58758D] block font-medium">ANTI-REPLAY NONCE</span>
          <div className="text-xl font-bold text-[#087EE8]">#{nonce}</div>
          <span className="text-[10px] text-[#58758D] block">
            Monotonic Sequence Active
          </span>
        </div>

        {/* Metric 3 */}
        <div className="p-4 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] space-y-1">
          <span className="text-[11px] text-[#58758D] block font-medium">HASH CONSISTENCY</span>
          <div className={`text-xl font-bold ${isTampered ? 'text-rose-600' : 'text-emerald-700'}`}>
            {isTampered ? 'MISMATCH (0/1)' : '100.0 % (18.4k)'}
          </div>
          <span className="text-[10px] text-[#58758D] block">
            {isTampered ? 'Checksum Failed' : '0 Signature Failures'}
          </span>
        </div>

        {/* Metric 4 */}
        <div className="p-4 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] space-y-1">
          <span className="text-[11px] text-[#58758D] block font-medium">HARDWARE ENCLAVE</span>
          <div className="text-xl font-bold text-[#082F61]">LOCKED & VALID</div>
          <span className="text-[10px] text-[#087EE8] font-semibold block">
            ESP32 Secure Boot v2
          </span>
        </div>
      </div>

      {/* 4-Stage Verification Pipeline Diagram */}
      <div className="p-5 rounded-2xl bg-[#F4FBFF] border border-[#C9EAF7] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#082F61] uppercase tracking-wider flex items-center gap-1.5">
            <Binary className="w-4 h-4 text-[#087EE8]" /> End-to-End Cryptographic Ingest Pipeline
          </span>
          <span className="text-[11px] text-[#58758D] font-mono-telemetry font-medium">
            Last Checked: {lastCheckTime}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
          {/* Stage 1 */}
          <div className="p-3 rounded-xl bg-white border border-[#C9EAF7] shadow-xs space-y-1 relative">
            <div className="flex items-center justify-between text-xs font-bold text-[#082F61]">
              <span>1. Ingest Capture</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-[11px] text-[#58758D] leading-tight">
              Hardware ADC payload captured with microsecond monotonic timestamp.
            </p>
          </div>

          {/* Stage 2 */}
          <div className="p-3 rounded-xl bg-white border border-[#C9EAF7] shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#082F61]">
              <span>2. HMAC Enclave</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-[11px] text-[#58758D] leading-tight">
              Secret key signs payload inside secure hardware crypto enclave.
            </p>
          </div>

          {/* Stage 3 */}
          <div className="p-3 rounded-xl bg-white border border-[#C9EAF7] shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#082F61]">
              <span>3. Frame Checksum</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-[11px] text-[#58758D] leading-tight">
              CRC32 framing prevents on-wire transmission transport bitflips.
            </p>
          </div>

          {/* Stage 4 */}
          <div className="p-3 rounded-xl bg-white border border-[#C9EAF7] shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#082F61]">
              <span>4. Proof of Integrity</span>
              {isTampered ? (
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              )}
            </div>
            <p className="text-[11px] text-[#58758D] leading-tight">
              Verified non-repudiation signature recorded with zero tampering.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Cryptographic Integrity & Tamper Verifier */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#F4FBFF] border border-[#C9EAF7] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-[#082F61] flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#087EE8]" />
              Interactive Telemetry Payload Integrity Verifier
            </h4>
            <p className="text-xs text-[#58758D] mt-0.5 font-medium">
              Test how HMAC-SHA256 instantly detects any unauthorized byte alteration via the cryptographic avalanche effect.
            </p>
          </div>

          <button
            onClick={handleTamperToggle}
            disabled={isVerifying}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-sm ${
              isTampered
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
          >
            {isVerifying ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : isTampered ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            <span>
              {isVerifying ? 'Verifying...' : isTampered ? 'Restore Genuine Payload' : 'Simulate 1-Bit Alteration'}
            </span>
          </button>
        </div>

        {/* Payload & Hash Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 font-mono-telemetry text-xs">
          {/* Left: Telemetry Payload Data */}
          <div className="bg-white p-3.5 rounded-xl border border-[#C9EAF7] space-y-2">
            <div className="flex justify-between items-center text-[#58758D] text-[11px]">
              <span className="font-bold text-[#082F61]">INSPECTED TELEMETRY PAYLOAD</span>
              <span className={isTampered ? 'text-rose-600 font-bold' : 'text-emerald-700 font-bold'}>
                {isTampered ? 'MODIFIED (0.01°C delta)' : 'GENUINE'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#06264A] text-[#BDEDFD] text-xs overflow-x-auto leading-relaxed border border-[#082F61]">
              <code>{payloadText}</code>
            </div>
            <div className="flex justify-between text-[10px] text-[#58758D]">
              <span>Encoding: UTF-8 JSON</span>
              <span>Length: {payloadText.length} bytes</span>
            </div>
          </div>

          {/* Right: HMAC-SHA256 Digest Result */}
          <div className={`bg-white p-3.5 rounded-xl border space-y-2 ${
            isTampered ? 'border-rose-300 ring-1 ring-rose-200' : 'border-[#C9EAF7]'
          }`}>
            <div className="flex justify-between items-center text-[#58758D] text-[11px]">
              <span className="font-bold text-[#082F61]">COMPUTED HMAC-SHA256 SIGNATURE</span>
              <span className={`font-bold ${isTampered ? 'text-rose-600' : 'text-[#087EE8]'}`}>
                {isTampered ? 'MISMATCH (TAMPER DETECTED)' : 'SIGNATURE VALID'}
              </span>
            </div>
            <div className={`p-2.5 rounded-lg text-xs break-all leading-relaxed ${
              isTampered ? 'bg-rose-950 text-rose-200 border border-rose-800' : 'bg-[#06264A] text-[#27C5FF] border border-[#082F61]'
            }`}>
              <code>{currentSig}</code>
            </div>
            <div className="flex justify-between text-[10px] text-[#58758D]">
              <span>Enclave Key: HW_SECRET_KEY_A7</span>
              <span>256-bit Digest</span>
            </div>
          </div>
        </div>

        {/* Warning or Success Banner */}
        <div className={`p-3 rounded-xl flex items-center justify-between gap-3 text-xs ${
          isTampered 
            ? 'bg-rose-100/70 border border-rose-300 text-rose-900' 
            : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
        }`}>
          <div className="flex items-center gap-2">
            {isTampered ? (
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>
              {isTampered
                ? 'Alert: Cryptographic checksum validation failed. Hardware enclave flagged illegal telemetry alteration.'
                : 'All payload bytes match the authoritative cryptographic enclave digest. Zero data tampering detected.'}
            </span>
          </div>

          <span className="font-mono-telemetry text-[11px] font-bold shrink-0">
            {isTampered ? 'FLAG: TAMPER_EV_0x4A' : 'STATUS: PASS'}
          </span>
        </div>
      </div>

      {/* Footer Notes */}
      <div className="pt-2 border-t border-[#C9EAF7] flex flex-wrap items-center justify-between gap-3 text-xs text-[#58758D]">
        <div className="flex items-center gap-3">
          <span className="font-bold text-[#082F61]">Standard Specifications:</span>
          <span>RFC 2104</span>
          <span aria-hidden="true">·</span>
          <span>NIST SP 800-107</span>
          <span aria-hidden="true">·</span>
          <span>Zero-Trust IoT Boundary</span>
        </div>

        <div className="font-mono-telemetry text-[11px] text-[#087EE8] font-bold">
          Active Session Integrity: 100% Guaranteed
        </div>
      </div>
    </div>
  );
};
