import React, { useState, useEffect } from 'react';
import { BrandingPanel } from './components/BrandingPanel';
import { LoginCard } from './components/LoginCard';
import { ForgotPasswordModal } from './components/ForgotPasswordModal';
import { DashboardView } from './components/DashboardView';
import { CircuitPattern } from './components/CircuitPattern';
import { UserSession } from './types';
import { api } from './services/api';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState<boolean>(false);
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(true);

  // Auto-restore session from active token on initial page load
  useEffect(() => {
    const token = localStorage.getItem('lg_session_token');
    if (!token) {
      setIsRestoringSession(false);
      return;
    }

    api.getMe()
      .then((user) => {
        setSession(user);
      })
      .catch(() => {
        localStorage.removeItem('lg_session_token');
      })
      .finally(() => {
        setIsRestoringSession(false);
      });
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {}
    setSession(null);
  };

  // Loading indicator during initial session verification
  if (isRestoringSession) {
    return (
      <div className="min-h-screen w-full bg-[#EAF9FF] text-[#17324D] flex flex-col items-center justify-center relative">
        <CircuitPattern />
        <div className="z-10 flex flex-col items-center gap-3 bg-white p-8 rounded-2xl shadow-lg border border-[#C9EAF7]">
          <div className="w-12 h-12 rounded-xl bg-[#BDEDFD] flex items-center justify-center text-[#087EE8]">
            <ShieldCheck className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-[#082F61]">
            <Loader2 className="w-4 h-4 animate-spin text-[#087EE8]" />
            <span>Verifying Secure Session...</span>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated, display the live telemetry dashboard
  if (session) {
    return (
      <DashboardView
        session={session}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#EAF9FF] text-[#17324D] flex flex-col justify-between relative selection:bg-[#BDEDFD] selection:text-[#082F61] overflow-x-hidden">
      {/* Background Cyber Circuit & Soft Ambient Accents */}
      <CircuitPattern />

      {/* Main Split-Screen Container (Baseline target: 1536 × 1024) */}
      <div className="relative z-10 w-full min-h-screen flex flex-col lg:flex-row items-stretch">
        {/* Left Side: Branding, Features & Hardware Shield Illustration */}
        <section
          aria-label="LABGUARD Telemetry Overview"
          className="w-full lg:w-[54%] xl:w-[55%] flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#C9EAF7] bg-gradient-to-br from-[#F4FBFF] via-[#EAF9FF] to-[#BDEDFD]/25 backdrop-blur-sm"
        >
          <BrandingPanel />
        </section>

        {/* Right Side: Login Card */}
        <section
          aria-label="Secure Access Portal"
          className="w-full lg:w-[46%] xl:w-[45%] flex items-center justify-center p-6 sm:p-10 lg:p-12 xl:p-16 relative bg-[#EAF9FF]/70"
        >
          {/* Subtle soft blue backdrop glow behind the card on the right */}
          <div className="absolute w-80 h-80 rounded-full bg-[#BDEDFD]/60 blur-3xl pointer-events-none -top-10 -right-10" />
          <div className="absolute w-72 h-72 rounded-full bg-[#C9EAF7]/70 blur-3xl pointer-events-none -bottom-10 -left-10" />

          <div className="w-full max-w-lg z-10 py-6">
            <LoginCard
              onSuccess={(user) => setSession(user)}
              onOpenForgotPassword={() => setIsForgotPasswordOpen(true)}
            />
          </div>
        </section>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        initialEmail=""
      />
    </div>
  );
}
