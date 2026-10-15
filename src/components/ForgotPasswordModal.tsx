import React, { useState } from 'react';
import { X, Mail, ShieldCheck, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { TrueguardLogo } from './TrueguardLogo';
import { api } from '../services/api';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
}) => {
  const [email, setEmail] = useState<string>(initialEmail);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [recoveryToken, setRecoveryToken] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please provide a valid enterprise email address.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const res = await api.forgotPassword(email.trim());
      if (res.success && res.recoveryToken) {
        setRecoveryToken(res.recoveryToken);
        setSubmitted(true);
      } else {
        setError(res.message || 'Recovery token generation failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Offline reset failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setEmail('');
    setRecoveryToken('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#06264A]/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-password-title"
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#C9EAF7] p-6 sm:p-8 text-[#17324D]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#58758D] hover:text-[#082F61] p-1.5 rounded-lg hover:bg-[#F4FBFF] transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {!submitted ? (
          <div>
            <div className="text-center mb-6">
              <div className="flex justify-center mb-2">
                <TrueguardLogo size="sm" showTagline={false} theme="light" />
              </div>
              <h2
                id="forgot-password-title"
                className="text-xl font-extrabold text-[#082F61] tracking-tight"
              >
                Reset Access Credentials
              </h2>
              <p className="text-xs text-[#58758D] mt-1 font-medium">
                Enter your authorized email to dispatch a cryptographically signed recovery token.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="recovery-email"
                  className="block text-xs font-bold text-[#082F61] uppercase tracking-wide"
                >
                  Authorized Telemetry Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#087EE8]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="recovery-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@company.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-sm font-medium text-[#17324D] placeholder-[#58758D]/60 focus:outline-none focus:ring-2 focus:ring-[#087EE8] focus:border-[#087EE8]"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] text-[11px] text-[#58758D] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#087EE8] shrink-0" />
                <span>
                  Recovery links expire in 15 minutes and require HMAC validation.
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#087EE8] to-[#168BFF] hover:from-[#168BFF] hover:to-[#0866D4] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/20 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Signing Recovery Token...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Token</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#082F61]">
                Recovery Token Dispatched
              </h3>
              <p className="text-xs text-[#58758D] max-w-xs mx-auto">
                A single-use signed link has been dispatched to{' '}
                <strong className="text-[#082F61]">{email}</strong>.
              </p>
            </div>

            <div className="p-3 bg-[#F4FBFF] rounded-xl border border-[#C9EAF7] text-left text-xs font-mono-telemetry space-y-1">
              <span className="text-[11px] text-[#087EE8] font-bold block">
                SECURITY VERIFICATION TOKEN:
              </span>
              <span className="text-[#082F61] break-all block font-bold">
                {recoveryToken || 'LG-RESET-8A7B2C-SHA256'}
              </span>
            </div>

            <button
              onClick={handleReset}
              className="w-full py-2.5 px-4 bg-[#BDEDFD] hover:bg-[#A5E3FA] text-[#082F61] font-bold text-xs rounded-xl transition-colors cursor-pointer border border-[#A5E3FA]"
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
