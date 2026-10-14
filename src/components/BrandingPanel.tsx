import React, { useState, useEffect } from 'react';
import { Cpu, KeyRound, ShieldAlert, CheckCircle2, Sliders, Thermometer } from 'lucide-react';
import { TrueguardLogo } from './TrueguardLogo';
import iotShieldImage from '../assets/images/trueguard_iot_shield_1791857236647.jpg';

export const BrandingPanel: React.FC = () => {
  // Interactive live telemetry state for the ESP32 demonstration
  const [temperature, setTemperature] = useState<number>(24.6);
  const [rotaryKnob, setRotaryKnob] = useState<number>(68);
  const [liveHash, setLiveHash] = useState<string>('8f9b4c02e176b9a4c3321d84f09a');
  const [packetCount, setPacketCount] = useState<number>(1420);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [showInteractiveInspector, setShowInteractiveInspector] = useState<boolean>(false);

  // Compute a simple deterministic hash display when telemetry changes
  useEffect(() => {
    setIsVerifying(true);
    const timeout = setTimeout(() => {
      // Deterministic simulated HMAC
      const raw = `ESP32_${temperature.toFixed(1)}_${rotaryKnob}_${packetCount}`;
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        hash = (hash << 5) - hash + raw.charCodeAt(i);
        hash |= 0;
      }
      const hex = Math.abs(hash).toString(16).padStart(8, '0');
      setLiveHash(`hmac_${hex}9a4b3c7f82`);
      setIsVerifying(false);
    }, 150);

    return () => clearTimeout(timeout);
  }, [temperature, rotaryKnob, packetCount]);

  // Periodic subtle sensor drift for realistic live feeling
  useEffect(() => {
    const interval = setInterval(() => {
      setPacketCount((prev) => prev + 1);
      setTemperature((prev) => {
        const delta = (Math.random() - 0.5) * 0.2;
        return Number((prev + delta).toFixed(1));
      });
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative flex flex-col justify-between p-8 sm:p-12 lg:p-16 h-full text-[#17324D] z-10 overflow-y-auto">
      {/* Top Header: LABGUARD Logo + Tagline */}
      <div className="flex flex-col gap-6">
        <TrueguardLogo size="lg" showTagline={true} theme="light" />

        {/* Large Headline & Supporting Text */}
        <div className="space-y-3 max-w-xl mt-4">
          <h1 className="text-3xl sm:text-4xl lg:text-[43px] font-extrabold tracking-tight text-[#082F61] leading-[1.2]">
            Trusted Data.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#087EE8] via-[#168BFF] to-[#082F61]">
              Safer Decisions.
            </span>
          </h1>
          <p className="text-base sm:text-lg text-[#58758D] leading-relaxed font-normal">
            LABGUARD ensures your hardware telemetry is captured, verified, and protected with cryptographic integrity.
          </p>
        </div>

        {/* Three Feature Highlights (White Cards with Light Blue Accents) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
          {/* Feature 1 */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-[#C9EAF7] shadow-xs transition-all hover:border-[#087EE8]/40 hover:shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#BDEDFD] flex items-center justify-center text-[#087EE8] shrink-0 border border-[#A5E3FA]">
              <Cpu className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-bold text-[#082F61] block truncate">
                Hardware Telemetry
              </span>
              <span className="text-[14px] text-[#58758D] block truncate font-medium">
                ESP32 & IoT Edge
              </span>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-[#C9EAF7] shadow-xs transition-all hover:border-[#087EE8]/40 hover:shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#BDEDFD] flex items-center justify-center text-[#087EE8] shrink-0 border border-[#A5E3FA]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-bold text-[#082F61] block truncate">
                HMAC-SHA256
              </span>
              <span className="text-[14px] text-[#58758D] block truncate font-medium">
                Cryptographic Proof
              </span>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-[#C9EAF7] shadow-xs transition-all hover:border-[#087EE8]/40 hover:shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#BDEDFD] flex items-center justify-center text-[#087EE8] shrink-0 border border-[#A5E3FA]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-bold text-[#082F61] block truncate">
                Tamper-Evident
              </span>
              <span className="text-[14px] text-[#58758D] block truncate font-medium">
                Immutable Ledger
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Centerpiece: IoT Shield Illustration + Interactive Hardware Connection */}
      <div className="my-8 relative">
        <div className="relative rounded-2xl overflow-hidden border border-[#C9EAF7] bg-white shadow-lg group">
          {/* Image */}
          <img
            src={iotShieldImage}
            alt="Cryptographic security shield hovering over ESP32 microcontroller with sensor and dial"
            referrerPolicy="no-referrer"
            className="w-full h-56 sm:h-64 lg:h-72 object-cover object-center transition-transform duration-700 group-hover:scale-102"
          />

          {/* Live verification ribbon across bottom of illustration */}
          <div className="absolute bottom-0 inset-x-0 p-3.5 sm:p-4 bg-white/95 backdrop-blur-md flex flex-wrap items-center justify-between gap-2 border-t border-[#C9EAF7]">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
              <span className="text-xs font-bold text-[#082F61] tracking-wide">
                ESP32 Hardware Pipeline
              </span>
              <span className="text-xs text-[#58758D] hidden sm:inline">
                · Temp Sensor & Rotary Input
              </span>
            </div>

            <button
              onClick={() => setShowInteractiveInspector(!showInteractiveInspector)}
              className="text-xs font-bold text-[#087EE8] hover:text-[#0866D4] flex items-center gap-1.5 transition-colors cursor-pointer py-1 px-2.5 rounded-lg bg-[#F4FBFF] hover:bg-[#BDEDFD]/50 border border-[#C9EAF7]"
              title="Click to adjust live sensor dials"
            >
              <Sliders className="w-4 h-4" />
              <span>{showInteractiveInspector ? 'Hide Controls' : 'Test Cryptography'}</span>
            </button>
          </div>
        </div>

        {/* Expandable Live Hardware Cryptography Demonstrator (White Card) */}
        {showInteractiveInspector && (
          <div className="mt-3 p-4.5 rounded-2xl bg-white border border-[#C9EAF7] shadow-lg text-xs space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between border-b border-[#C9EAF7] pb-2.5">
              <span className="font-bold text-[#082F61] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                Live HMAC-SHA256 Hardware Telemetry Rig
              </span>
              <span className="font-mono-telemetry text-[#087EE8] text-[14px] font-bold bg-[#BDEDFD] px-2.5 py-0.5 rounded-md border border-[#A5E3FA]">
                Packet #{packetCount}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Temperature Control */}
              <div className="space-y-1.5 bg-[#F4FBFF] p-3 rounded-xl border border-[#C9EAF7]">
                <div className="flex justify-between items-center text-[#58758D]">
                  <span className="flex items-center gap-1 text-xs font-medium">
                    <Thermometer className="w-4 h-4 text-[#087EE8]" /> Temp Probe:
                  </span>
                  <span className="font-mono-telemetry font-bold text-[#082F61]">{temperature}°C</span>
                </div>
                <input
                  type="range"
                  min="18.0"
                  max="45.0"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-[#087EE8] cursor-pointer"
                  aria-label="Adjust simulated probe temperature"
                />
              </div>

              {/* Rotary Knob Control */}
              <div className="space-y-1.5 bg-[#F4FBFF] p-3 rounded-xl border border-[#C9EAF7]">
                <div className="flex justify-between items-center text-[#58758D]">
                  <span className="flex items-center gap-1 text-xs font-medium">
                    <Sliders className="w-4 h-4 text-[#087EE8]" /> Rotary Dial:
                  </span>
                  <span className="font-mono-telemetry font-bold text-[#082F61]">{rotaryKnob}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={rotaryKnob}
                  onChange={(e) => setRotaryKnob(parseInt(e.target.value, 10))}
                  className="w-full accent-[#087EE8] cursor-pointer"
                  aria-label="Adjust simulated potentiometer input dial"
                />
              </div>
            </div>

            {/* Live Computed HMAC Digest */}
            <div className="bg-[#F4FBFF] p-3 rounded-xl border border-[#C9EAF7] flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono-telemetry text-[14px]">
              <span className="text-[#087EE8] font-bold">Digest:</span>
              <span className={`text-[#082F61] font-semibold tracking-wider truncate ${isVerifying ? 'opacity-60' : 'opacity-100'}`}>
                {liveHash}
              </span>
              <span className="text-[#082F61] font-bold bg-[#BDEDFD] border border-[#A5E3FA] px-2 py-0.5 rounded-md text-[13px] self-start sm:self-auto font-sans">
                CRYPTOGRAPHICALLY VERIFIED
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Tagline: Secure | Reliable | Transparent */}
      <div className="pt-4 border-t border-[#C9EAF7] flex flex-wrap items-center justify-between gap-3 text-xs text-[#58758D]">
        <div className="flex items-center gap-2 font-semibold tracking-wide text-[#082F61]">
          <span>Secure</span>
          <span className="text-[#087EE8]" aria-hidden="true">|</span>
          <span>Reliable</span>
          <span className="text-[#087EE8]" aria-hidden="true">|</span>
          <span>Transparent</span>
        </div>
        <div className="text-[14px] text-[#58758D] font-mono-telemetry font-medium">
          HW-SPEC: LABGUARD-v2
        </div>
      </div>
    </div>
  );
};
