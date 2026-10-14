import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { TrueguardLogo } from './TrueguardLogo';
import { UserSession } from '../types';

import { api } from '../services/api';

interface LoginCardProps {
  onSuccess: (session: UserSession) => void;
  onOpenForgotPassword: () => void;
}

export const LoginCard: React.FC<LoginCardProps> = ({
  onSuccess,
  onOpenForgotPassword,
}) => {
  const [identifier, setIdentifier] = useState<string>('telemetry.lead@labguard.io');
  const [password, setPassword] = useState<string>('lg_demo_key_2026');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMessage('Please enter your email or username.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Please enter your secure access password.');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      const user = await api.login(identifier.trim(), password.trim());
      onSuccess(user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoAccess = async () => {
    setIdentifier('telemetry.lead@labguard.io');
    setPassword('lg_demo_key_2026');
    setErrorMessage('');
    setIsLoading(true);

    try {
      const user = await api.login('telemetry.lead@labguard.io', 'lg_demo_key_2026');
      onSuccess(user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Demo access failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Outer subtle glow wrapper */}
      <div className="relative rounded-3xl p-[1px] bg-gradient-to-b from-[#BDEDFD] via-[#C9EAF7] to-[#BDEDFD]/40 shadow-xl">
        {/* Main Card Surface */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 lg:p-12 shadow-md border border-[#C9EAF7] text-[#17324D] relative overflow-hidden">
          {/* Subtle decorative top corner accent */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#BDEDFD]/40 via-transparent to-transparent pointer-events-none rounded-tr-3xl" />

          {/* Card Header */}
          <div className="text-center space-y-3 mb-8">
            <div className="flex justify-center mb-2">
              <TrueguardLogo size="md" showTagline={false} theme="light" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#082F61]">
              Secure Access Portal
            </h2>
            <p className="text-sm text-[#58758D] max-w-xs mx-auto font-medium">
              Sign in to access your telemetry dashboard
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error banner if any */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 animate-in fade-in">
                {errorMessage}
              </div>
            )}

            {/* Email or Username */}
            <div className="space-y-1.5">
              <label
                htmlFor="user-identifier"
                className="block text-xs font-bold text-[#082F61] tracking-wide uppercase"
              >
                Email or Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#087EE8]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="user-identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@company.com or username"
                  className="w-full pl-10 pr-4 py-3 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-sm font-medium text-[#17324D] placeholder-[#58758D]/60 focus:outline-none focus:ring-2 focus:ring-[#087EE8] focus:border-[#087EE8] transition-all shadow-xs"
                />
              </div>
            </div>

            {/* Password Field with Show/Hide Toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="user-password"
                  className="block text-xs font-bold text-[#082F61] tracking-wide uppercase"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#087EE8]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="user-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter cryptographic passphrase"
                  className="w-full pl-10 pr-12 py-3 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-sm font-medium text-[#17324D] placeholder-[#58758D]/60 focus:outline-none focus:ring-2 focus:ring-[#087EE8] focus:border-[#087EE8] transition-all shadow-xs font-mono-telemetry"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#58758D] hover:text-[#087EE8] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-[#58758D] font-medium">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[#C9EAF7] text-[#087EE8] focus:ring-[#087EE8] accent-[#087EE8] cursor-pointer"
                />
                <span>Remember Me</span>
              </label>

              <button
                type="button"
                onClick={onOpenForgotPassword}
                className="font-bold text-[#087EE8] hover:text-[#0866D4] hover:underline transition-colors cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            {/* Buttons Group */}
            <div className="space-y-3 pt-3">
              {/* Prominent Blue Gradient Button: "Sign In →" */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#087EE8] to-[#168BFF] hover:from-[#168BFF] hover:to-[#0866D4] transition-all duration-200 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 group active:scale-[0.99]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Verifying HMAC Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              {/* Secondary Outlined Button: "Demo Access" */}
              <button
                type="button"
                onClick={handleDemoAccess}
                disabled={isLoading}
                className="w-full py-3 px-6 rounded-xl font-bold text-sm text-[#087EE8] bg-[#F4FBFF] border-2 border-[#087EE8] hover:bg-[#BDEDFD]/40 hover:border-[#168BFF] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <Sparkles className="w-4 h-4 text-[#087EE8]" />
                <span>Demo Access</span>
              </button>
            </div>
          </form>

          {/* Footer Security Note with Shield Icon */}
          <div className="mt-8 pt-5 border-t border-[#C9EAF7] flex items-center justify-center gap-2 text-xs text-[#58758D] text-center font-medium">
            <ShieldCheck className="w-4 h-4 text-[#087EE8] shrink-0" />
            <span>Your data is protected with HMAC-SHA256.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
