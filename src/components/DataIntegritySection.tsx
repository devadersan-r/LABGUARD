import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  KeyRound, 
  CheckCircle2, 
  RefreshCw, 
  AlertTriangle,
  Fingerprint,
  Mail,
  Send,
  FileSearch,
  ExternalLink,
  Check,
  AlertCircle,
  Bell,
  Lock,
} from 'lucide-react';

import { api, NotificationStatus } from '../services/api';

interface DataIntegritySectionProps {
  onScanNow?: () => void;
  onNavigateToInspection?: (sessionId: string) => void;
}

export const DataIntegritySection: React.FC<DataIntegritySectionProps> = ({ 
  onScanNow, 
  onNavigateToInspection 
}) => {
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
  const [demoSessionId, setDemoSessionId] = useState<string>('SESSION-TAMPER-DEMO');

  // SMTP Notification state
  const [notifStatus, setNotifStatus] = useState<NotificationStatus | null>(null);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState<boolean>(false);
  const [emailFeedback, setEmailFeedback] = useState<{ type: 'success' | 'error'; message: string; timestamp?: string } | null>(null);

  const fetchTamperStatus = React.useCallback(async () => {
    try {
      const data = await api.getTamperStatus();
      setIsTampered(data.isTampered);
      setPayloadText(data.payloadText);
      setCurrentSignature(data.currentSignature);
      setExpectedSignature(data.expectedSignature);
      setNonce(data.nonce);
      setLastCheckTime(data.lastCheckTime);
      if (data.sessionId) setDemoSessionId(data.sessionId);
    } catch (err) {
      console.error('Error fetching tamper status:', err);
    }
  }, []);

  const fetchNotificationStatus = React.useCallback(async () => {
    try {
      const data = await api.getNotificationStatus();
      setNotifStatus(data);
    } catch (err) {
      console.error('Error fetching notification status:', err);
    }
  }, []);

  useEffect(() => {
    fetchTamperStatus();
    fetchNotificationStatus();
    const timer = setInterval(() => {
      if (!isTampered) {
        fetchTamperStatus();
      }
      fetchNotificationStatus();
    }, 5000);
    return () => clearInterval(timer);
  }, [isTampered, fetchTamperStatus, fetchNotificationStatus]);

  const handleTamperToggle = async () => {
    setIsVerifying(true);
    try {
      const nextTamper = !isTampered;
      const data = await api.simulateTamper(nextTamper, demoSessionId);
      setIsTampered(data.isTampered);
      setPayloadText(data.payloadText);
      setCurrentSignature(data.currentSignature);
      setExpectedSignature(data.expectedSignature);
      setNonce(data.nonce);
      setLastCheckTime(data.lastCheckTime);
      if (data.sessionId) setDemoSessionId(data.sessionId);
      await fetchNotificationStatus();
    } catch (err) {
      console.error('Failed to toggle tamper state on backend:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSendTestEmail = async () => {
    setIsSendingTestEmail(true);
    setEmailFeedback(null);
    try {
      const res = await api.sendTestEmail('labgaurd@gmail.com');
      if (res.success) {
        setEmailFeedback({
          type: 'success',
          message: res.message,
          timestamp: res.timestamp,
        });
      } else {
        setEmailFeedback({
          type: 'error',
          message: res.message,
          timestamp: res.timestamp,
        });
      }
      await fetchNotificationStatus();
    } catch (err: any) {
      setEmailFeedback({
        type: 'error',
        message: err.message || 'SMTP request failed',
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const currentSig = currentSignature;

  return (
    <div className="space-y-6">
      {/* 1. Main Cryptographic Data Integrity Engine Card */}
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
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 font-mono-telemetry border border-amber-300">
                  DEMO SANDBOX
                </span>
              </div>
              <p className="text-xs text-[#58758D] mt-0.5">
                Interactive demonstration sandbox testing HMAC-SHA256 non-alteration, anti-replay nonce synchronization, and cryptographic invariant validation.
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
                  <span>SANDBOX: INTEGRITY MISMATCH DETECTED</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>SANDBOX: TEST TAG VERIFIED (100% INTACT)</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 4 Integrity Key Metrics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono-telemetry text-xs">
          <div className="p-4 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] space-y-1">
            <span className="text-[11px] text-[#58758D] block font-medium">SANDBOX BIT ERROR RATE (BER)</span>
            <div className="text-xl font-bold text-[#082F61]">0.0000 %</div>
            <span className="text-[10px] text-emerald-700 font-semibold block flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Test Vector Invariant
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] space-y-1">
            <span className="text-[11px] text-[#58758D] block font-medium">SANDBOX SEQUENCE NONCE</span>
            <div className="text-xl font-bold text-[#087EE8]">#{nonce}</div>
            <span className="text-[10px] text-[#58758D] block">
              Test Monotonic Nonce
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] space-y-1">
            <span className="text-[11px] text-[#58758D] block font-medium">SANDBOX HASH CONSISTENCY</span>
            <div className={`text-xl font-bold ${isTampered ? 'text-rose-600' : 'text-emerald-700'}`}>
              {isTampered ? 'MISMATCH (0/1)' : 'MATCH (1/1)'}
            </div>
            <span className={`text-[10px] font-semibold block ${isTampered ? 'text-rose-600' : 'text-emerald-700'}`}>
              {isTampered ? 'Checksum Failed' : 'Authoritative Verified'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] space-y-1">
            <span className="text-[11px] text-[#58758D] block font-medium">CRYPTOGRAPHIC KEY</span>
            <div className="text-xl font-bold text-[#082F61]">KEY-001</div>
            <span className="text-[10px] text-[#087EE8] font-semibold block">
              HMAC-SHA256 Keystore Enclave
            </span>
          </div>
        </div>

        {/* 4-Stage Ingestion Pipeline Strip */}
        <div className="p-4 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-[#082F61]">
            <span className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-[#087EE8]" />
              END-TO-END CRYPTOGRAPHIC INGEST PIPELINE
            </span>
            <span className="text-[11px] text-[#58758D] font-mono-telemetry font-normal">
              Last Checked: {lastCheckTime}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-white border border-[#C9EAF7] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-[#082F61]">
                <span>1. Ingest Capture</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-[11px] text-[#58758D] leading-tight">
                Hardware ADC payload captured with microsecond monotonic timestamp.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white border border-[#C9EAF7] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-[#082F61]">
                <span>2. HMAC Enclave</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-[11px] text-[#58758D] leading-tight">
                Secret key signs payload inside secure hardware crypto enclave.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white border border-[#C9EAF7] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-[#082F61]">
                <span>3. Canonical Framing</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-[11px] text-[#58758D] leading-tight">
                Deterministic labguard-v1 byte serialization guarantees non-repudiation.
              </p>
            </div>

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
                {isTampered ? 'Integrity mismatch recorded and audited in database.' : 'Verified non-repudiation signature recorded with zero tampering.'}
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

            <div className="flex items-center gap-2 flex-wrap">
              {onNavigateToInspection && (
                <button
                  onClick={() => onNavigateToInspection(demoSessionId)}
                  className="px-3 py-2 text-xs font-bold rounded-xl bg-white hover:bg-[#BDEDFD]/40 text-[#082F61] border border-[#C9EAF7] transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <FileSearch className="w-3.5 h-3.5 text-[#087EE8]" />
                  <span>Inspect in Record Console</span>
                </button>
              )}

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
                <span>Active Key ID: KEY-001</span>
                <span>256-bit Digest</span>
              </div>
            </div>
          </div>

          {/* Tamper Persistence Notification Box */}
          <div className={`p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
            isTampered 
              ? 'bg-rose-100/80 border border-rose-300 text-rose-950' 
              : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
          }`}>
            <div className="flex items-center gap-2.5">
              {isTampered ? (
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span>
                {isTampered
                  ? `Cryptographic signature mismatch! Tampered record #${nonce} was persisted into session "${demoSessionId}" with status TAMPERED.`
                  : `All payload bytes match authoritative cryptographic enclave digest. Session "${demoSessionId}" is 100% verified.`}
              </span>
            </div>

            {onNavigateToInspection && (
              <button
                onClick={() => onNavigateToInspection(demoSessionId)}
                className={`text-xs font-bold underline cursor-pointer shrink-0 ${
                  isTampered ? 'text-rose-700 hover:text-rose-900' : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                View in Record Inspection →
              </button>
            )}
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
            Audit Stream: {demoSessionId}
          </div>
        </div>
      </div>

      {/* 2. Complete Gmail SMTP Tamper Alert Integration Card */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-md border border-[#C9EAF7] text-[#17324D] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#C9EAF7]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#BDEDFD] text-[#087EE8] border border-[#A5E3FA] flex items-center justify-center font-bold shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-[#082F61]">
                  Gmail SMTP Tamper Alert Service
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#BDEDFD] text-[#082F61] font-mono-telemetry border border-[#A5E3FA]">
                  STARTTLS Port 587
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono-telemetry border ${
                  notifStatus?.configured 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}>
                  {notifStatus?.configured ? 'CONFIGURED & READY' : 'OFFLINE / PENDING PASSWORD'}
                </span>
              </div>
              <p className="text-xs text-[#58758D] mt-0.5">
                Automated immediate security email dispatches on confirmed physical or cryptographic tampering incidents.
              </p>
            </div>
          </div>

          {/* Send Test Email Button */}
          <button
            onClick={handleSendTestEmail}
            disabled={isSendingTestEmail}
            className="px-4 py-2 bg-[#087EE8] hover:bg-[#076bc5] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm shrink-0"
          >
            {isSendingTestEmail ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{isSendingTestEmail ? 'Sending Test...' : 'Send Test Alert Email'}</span>
          </button>
        </div>

        {/* SMTP Configuration & Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono-telemetry">
          <div className="p-4 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] space-y-1">
            <span className="text-[11px] text-[#58758D] block font-medium">SMTP PROVIDER & HOST</span>
            <div className="text-sm font-bold text-[#082F61]">smtp.gmail.com</div>
            <span className="text-[10px] text-emerald-700 font-semibold block flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> STARTTLS Port 587
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] space-y-1">
            <span className="text-[11px] text-[#58758D] block font-medium">SENDER & RECIPIENT</span>
            <div className="text-xs font-bold text-[#082F61] truncate" title="dpgaming292@gmail.com">
              From: {notifStatus?.fromEmail || 'dpgaming292@gmail.com'}
            </div>
            <span className="text-[11px] text-[#087EE8] font-bold block truncate" title="labgaurd@gmail.com">
              To: {notifStatus?.alertRecipient || 'labgaurd@gmail.com'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] space-y-1">
            <span className="text-[11px] text-[#58758D] block font-medium">ALERTS DISPATCHED</span>
            <div className="text-xl font-bold text-[#082F61]">{notifStatus?.totalAlertsSent ?? 0} sent</div>
            <span className="text-[10px] text-[#58758D] block">
              Last: {notifStatus?.lastAlertTime || 'None yet'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] space-y-1">
            <span className="text-[11px] text-[#58758D] block font-medium">ANTI-SPAM DEDUPLICATION</span>
            <div className="text-sm font-bold text-[#082F61]">{notifStatus?.cooldownSeconds ?? 300}s Window</div>
            <span className="text-[10px] text-emerald-700 font-semibold block">
              Suppresses Duplicate Floods
            </span>
          </div>
        </div>

        {/* Test Email Feedback Banner */}
        {emailFeedback && (
          <div className={`p-4 rounded-xl border text-xs flex items-start gap-3 transition-all ${
            emailFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            {emailFeedback.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <span className="font-bold block">
                {emailFeedback.type === 'success' ? 'SMTP Dispatch Successful' : 'SMTP Dispatch Notice'}
              </span>
              <p className="leading-relaxed">{emailFeedback.message}</p>
              {emailFeedback.timestamp && (
                <span className="text-[10px] opacity-75 font-mono-telemetry block">
                  Timestamp: {emailFeedback.timestamp}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Configuration notice if password placeholder */}
        {!notifStatus?.configured && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
            <Bell className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block text-amber-950">Setup Step: Paste Gmail App Password in backend/.env</span>
              <p className="leading-relaxed text-amber-900">
                The SMTP service is configured for <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">dpgaming292@gmail.com</code> sending to <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">labgaurd@gmail.com</code>.
                To activate real outbound emails, open <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">backend/.env</code> and replace <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">PASTE_MY_NEW_GMAIL_APP_PASSWORD_HERE</code> with your 16-character Google App Password.
              </p>
            </div>
          </div>
        )}

        {/* Pipeline Diagram */}
        <div className="p-4 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] text-xs space-y-2">
          <span className="font-bold text-[#082F61] block">Autonomous Security Incident Ingestion & Alert Flow</span>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-telemetry text-[#58758D]">
            <span className="bg-white px-2 py-1 rounded-lg border border-[#C9EAF7] font-bold text-[#082F61]">ESP32 Node</span>
            <span>→</span>
            <span className="bg-white px-2 py-1 rounded-lg border border-[#C9EAF7] font-bold text-[#082F61]">Serial Ingestion</span>
            <span>→</span>
            <span className="bg-white px-2 py-1 rounded-lg border border-[#C9EAF7] font-bold text-[#087EE8]">HMAC-SHA256 Verification</span>
            <span>→</span>
            <span className="bg-white px-2 py-1 rounded-lg border border-[#C9EAF7] font-bold text-rose-700">Tamper Flagged</span>
            <span>→</span>
            <span className="bg-white px-2 py-1 rounded-lg border border-[#C9EAF7] font-bold text-[#082F61]">SQLite Persisted</span>
            <span>→</span>
            <span className="bg-[#087EE8] text-white px-2 py-1 rounded-lg font-bold">Gmail SMTP Alert (STARTTLS)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
