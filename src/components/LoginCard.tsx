import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Check,
  X,
  UserCheck,
  Shield,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';
import { TrueguardLogo } from './TrueguardLogo';
import { UserSession } from '../types';
import { api } from '../services/api';

interface LoginCardProps {
  onSuccess: (session: UserSession) => void;
  onOpenForgotPassword: () => void;
}

type GoogleFlowStep = 'enter_email' | 'authorize_permission' | 'create_password' | 'sign_in_existing';

export const LoginCard: React.FC<LoginCardProps> = ({
  onSuccess,
  onOpenForgotPassword,
}) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Sign In State (clean, no dummy credentials)
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(false);

  // Sign Up State
  const [signupEmail, setSignupEmail] = useState<string>('');
  const [signupPassword, setSignupPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showSignupPassword, setShowSignupPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  // Google OAuth Flow State
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState<boolean>(false);
  const [googleStep, setGoogleStep] = useState<GoogleFlowStep>('enter_email');
  const [googleEmail, setGoogleEmail] = useState<string>('');
  const [googlePassword, setGooglePassword] = useState<string>('');
  const [googleConfirmPassword, setGoogleConfirmPassword] = useState<string>('');
  const [showGooglePassword, setShowGooglePassword] = useState<boolean>(false);
  const [showGoogleConfirmPassword, setShowGoogleConfirmPassword] = useState<boolean>(false);
  const [isGoogleExistingUser, setIsGoogleExistingUser] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [googleError, setGoogleError] = useState<string>('');

  // General Loading & Error State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Validation rules for Standard Sign Up Strong Password
  const hasMinLength = signupPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(signupPassword);
  const hasLowerCase = /[a-z]/.test(signupPassword);
  const hasLetters = hasUpperCase && hasLowerCase;
  const hasNumber = /[0-9]/.test(signupPassword);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(signupPassword);
  const isPasswordStrong = hasMinLength && hasLetters && hasNumber && hasSpecialChar;
  const passwordsMatch = confirmPassword.length > 0 && signupPassword === confirmPassword;

  // Validation rules for Google Registration Strong Password
  const googleHasMinLength = googlePassword.length >= 8;
  const googleHasUpperCase = /[A-Z]/.test(googlePassword);
  const googleHasLowerCase = /[a-z]/.test(googlePassword);
  const googleHasLetters = googleHasUpperCase && googleHasLowerCase;
  const googleHasNumber = /[0-9]/.test(googlePassword);
  const googleHasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(googlePassword);
  const isGooglePasswordStrong = googleHasMinLength && googleHasLetters && googleHasNumber && googleHasSpecialChar;
  const googlePasswordsMatch = googleConfirmPassword.length > 0 && googlePassword === googleConfirmPassword;

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // Handle Standard Sign In
  const handleSignIn = async (e: React.FormEvent) => {
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
      setErrorMessage(err.message || 'Authentication failed. Please check credentials or create a new account.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Standard Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = signupEmail.trim();

    if (!cleanEmail) {
      setErrorMessage('Please provide an email address.');
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      setErrorMessage('Please provide a valid email address (e.g., name@domain.com).');
      return;
    }

    if (!isPasswordStrong) {
      setErrorMessage(
        'Password must be at least 8 characters and include uppercase, lowercase, numbers, and special characters.'
      );
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage('Confirmation password does not match the created password.');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      const user = await api.register(cleanEmail, signupPassword, confirmPassword);
      setSuccessMessage('Account created successfully! Connecting to your dashboard...');
      setTimeout(() => {
        onSuccess(user);
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Account creation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Launch Google OAuth modal
  const openGoogleModal = () => {
    setIsGoogleModalOpen(true);
    setGoogleStep('enter_email');
    setGoogleEmail('');
    setGooglePassword('');
    setGoogleConfirmPassword('');
    setGoogleError('');
    setIsGoogleExistingUser(false);
  };

  // Step 1: Submit Google Email and check account status
  const handleGoogleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = googleEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setGoogleError('Please enter your Google account email.');
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      setGoogleError('Please enter a valid Google email address.');
      return;
    }

    setGoogleError('');
    setIsGoogleLoading(true);

    try {
      const checkRes = await api.checkEmail(cleanEmail);
      setIsGoogleExistingUser(checkRes.exists);
      // Proceed directly to the Authorization & Permissions Consent step
      setGoogleStep('authorize_permission');
    } catch (err: any) {
      // In case of network check issue, proceed to permission screen by default
      setGoogleStep('authorize_permission');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Step 2: User grants authorization permission ("Allow")
  const handleGoogleAllowPermission = () => {
    setGoogleError('');
    if (isGoogleExistingUser) {
      // If user already created an account previously, ask for password to sign in
      setGoogleStep('sign_in_existing');
    } else {
      // If new, user MUST create and confirm a strong password before entering
      setGoogleStep('create_password');
    }
  };

  // Step 3: Finalize registration with created password & confirmation
  const handleGoogleCreatePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = googleEmail.trim().toLowerCase();

    if (!isGooglePasswordStrong) {
      setGoogleError(
        'Password must be at least 8 characters and include uppercase, lowercase, numbers, and special characters.'
      );
      return;
    }

    if (!googlePasswordsMatch) {
      setGoogleError('Confirmation password does not match the created password.');
      return;
    }

    setGoogleError('');
    setIsGoogleLoading(true);

    try {
      // Register with the authorized Google email and operator-created password
      const user = await api.googleAuth(cleanEmail, googlePassword, googleConfirmPassword);
      setIsGoogleModalOpen(false);
      onSuccess(user);
    } catch (err: any) {
      setGoogleError(err.message || 'Google account registration failed.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Step 4: Existing user logs in with their password
  const handleGoogleExistingLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = googleEmail.trim().toLowerCase();

    if (!googlePassword.trim()) {
      setGoogleError('Please enter your password.');
      return;
    }

    setGoogleError('');
    setIsGoogleLoading(true);

    try {
      const user = await api.googleAuth(cleanEmail, googlePassword.trim());
      setIsGoogleModalOpen(false);
      onSuccess(user);
    } catch (err: any) {
      setGoogleError(err.message || 'Authentication failed. Please verify password.');
    } finally {
      setIsGoogleLoading(false);
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
          <div className="text-center space-y-3 mb-6">
            <div className="flex justify-center mb-2">
              <TrueguardLogo size="md" showTagline={false} theme="light" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#082F61]">
              {authMode === 'signin' ? 'Secure Access Portal' : 'Create Operator Account'}
            </h2>
            <p className="text-sm text-[#58758D] max-w-xs mx-auto font-medium">
              {authMode === 'signin'
                ? 'Sign in to access your telemetry dashboard'
                : 'Set up your operator credentials for hardware telemetry'}
            </p>
          </div>

          {/* Auth Mode Toggle Pill Switcher */}
          <div className="flex p-1 bg-[#F4FBFF] rounded-2xl border border-[#C9EAF7] mb-6">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                authMode === 'signin'
                  ? 'bg-white text-[#082F61] shadow-xs border border-[#C9EAF7]/80'
                  : 'text-[#58758D] hover:text-[#082F61]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                authMode === 'signup'
                  ? 'bg-white text-[#082F61] shadow-xs border border-[#C9EAF7]/80'
                  : 'text-[#58758D] hover:text-[#082F61]'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Success banner if any */}
          {successMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error banner if any */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 animate-in fade-in">
              {errorMessage}
            </div>
          )}

          {/* ===================== SIGN IN FORM ===================== */}
          {authMode === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-4">
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

              {/* Primary Sign In Button */}
              <div className="pt-2">
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
              </div>

              {/* Divider */}
              <div className="relative py-2 flex items-center justify-center">
                <div className="border-t border-[#C9EAF7] w-full" />
                <span className="bg-white px-3 text-[11px] text-[#58758D] font-semibold uppercase tracking-wider">
                  or
                </span>
                <div className="border-t border-[#C9EAF7] w-full" />
              </div>

              {/* Connect with Google Button */}
              <button
                type="button"
                onClick={openGoogleModal}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs text-[#082F61] bg-[#F4FBFF] hover:bg-[#EAF9FF] border border-[#C9EAF7] hover:border-[#087EE8]/60 transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer shadow-xs active:scale-[0.99]"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Connect with Google</span>
              </button>

              {/* Mode switch helper link */}
              <div className="text-center pt-2">
                <p className="text-xs text-[#58758D]">
                  Don't have an operator account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setErrorMessage('');
                    }}
                    className="font-bold text-[#087EE8] hover:underline cursor-pointer"
                  >
                    Create Account
                  </button>
                </p>
              </div>
            </form>
          ) : (
            /* ===================== CREATE ACCOUNT FORM ===================== */
            <form onSubmit={handleSignUp} className="space-y-4">
              {/* Valid Email Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="signup-email"
                  className="block text-xs font-bold text-[#082F61] tracking-wide uppercase"
                >
                  Valid Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#087EE8]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="operator@company.com"
                    className="w-full pl-10 pr-4 py-3 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-sm font-medium text-[#17324D] placeholder-[#58758D]/60 focus:outline-none focus:ring-2 focus:ring-[#087EE8] focus:border-[#087EE8] transition-all shadow-xs"
                  />
                </div>
              </div>

              {/* Create Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="signup-password"
                    className="block text-xs font-bold text-[#082F61] tracking-wide uppercase"
                  >
                    Create Strong Password
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#087EE8]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="signup-password"
                    type={showSignupPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Uppercase, lowercase, numbers & symbols"
                    className="w-full pl-10 pr-12 py-3 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-sm font-medium text-[#17324D] placeholder-[#58758D]/60 focus:outline-none focus:ring-2 focus:ring-[#087EE8] focus:border-[#087EE8] transition-all shadow-xs font-mono-telemetry"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#58758D] hover:text-[#087EE8] transition-colors cursor-pointer"
                  >
                    {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Real-time Password Strength Criteria Checklist */}
                <div className="pt-1.5 pb-1">
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
                        hasMinLength ? 'text-emerald-700 bg-emerald-50' : 'text-[#58758D] bg-[#F4FBFF]'
                      }`}
                    >
                      {hasMinLength ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#58758D]/50 ml-1 mr-1" />
                      )}
                      <span>8+ characters</span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
                        hasLetters ? 'text-emerald-700 bg-emerald-50' : 'text-[#58758D] bg-[#F4FBFF]'
                      }`}
                    >
                      {hasLetters ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#58758D]/50 ml-1 mr-1" />
                      )}
                      <span>Letters (A-Z & a-z)</span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
                        hasNumber ? 'text-emerald-700 bg-emerald-50' : 'text-[#58758D] bg-[#F4FBFF]'
                      }`}
                    >
                      {hasNumber ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#58758D]/50 ml-1 mr-1" />
                      )}
                      <span>Numeric digits (0-9)</span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
                        hasSpecialChar ? 'text-emerald-700 bg-emerald-50' : 'text-[#58758D] bg-[#F4FBFF]'
                      }`}
                    >
                      {hasSpecialChar ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#58758D]/50 ml-1 mr-1" />
                      )}
                      <span>Special symbol (!@#$)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="signup-confirm-password"
                  className="block text-xs font-bold text-[#082F61] tracking-wide uppercase"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#087EE8]">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <input
                    id="signup-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password to confirm"
                    className="w-full pl-10 pr-12 py-3 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-sm font-medium text-[#17324D] placeholder-[#58758D]/60 focus:outline-none focus:ring-2 focus:ring-[#087EE8] focus:border-[#087EE8] transition-all shadow-xs font-mono-telemetry"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#58758D] hover:text-[#087EE8] transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Match Indicator */}
                {confirmPassword && (
                  <div className="pt-0.5">
                    {passwordsMatch ? (
                      <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Passwords match</span>
                      </p>
                    ) : (
                      <p className="text-[11px] font-medium text-red-500 flex items-center gap-1">
                        <X className="w-3.5 h-3.5" />
                        <span>Passwords do not match yet</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Primary Create Account Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !isPasswordStrong || !passwordsMatch}
                  className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#087EE8] to-[#168BFF] hover:from-[#168BFF] hover:to-[#0866D4] transition-all duration-200 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group active:scale-[0.99]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Creating Operator Account...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Create Account</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </div>

              {/* Divider */}
              <div className="relative py-2 flex items-center justify-center">
                <div className="border-t border-[#C9EAF7] w-full" />
                <span className="bg-white px-3 text-[11px] text-[#58758D] font-semibold uppercase tracking-wider">
                  or
                </span>
                <div className="border-t border-[#C9EAF7] w-full" />
              </div>

              {/* Connect with Google Button */}
              <button
                type="button"
                onClick={openGoogleModal}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs text-[#082F61] bg-[#F4FBFF] hover:bg-[#EAF9FF] border border-[#C9EAF7] hover:border-[#087EE8]/60 transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer shadow-xs active:scale-[0.99]"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Connect with Google</span>
              </button>

              {/* Mode switch helper link */}
              <div className="text-center pt-2">
                <p className="text-xs text-[#58758D]">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setErrorMessage('');
                    }}
                    className="font-bold text-[#087EE8] hover:underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* Footer Security Note with Shield Icon */}
          <div className="mt-8 pt-5 border-t border-[#C9EAF7] flex items-center justify-center gap-2 text-xs text-[#58758D] text-center font-medium">
            <ShieldCheck className="w-4 h-4 text-[#087EE8] shrink-0" />
            <span>Your data is protected with HMAC-SHA256.</span>
          </div>
        </div>
      </div>

      {/* ===================== GOOGLE OAUTH MODAL (FULL AUTHORIZATION & ONBOARDING) ===================== */}
      {isGoogleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#06264A]/60 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#C9EAF7] text-[#17324D] relative overflow-hidden">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsGoogleModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-[#58758D] hover:text-[#082F61] hover:bg-[#F4FBFF] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Error in Google modal */}
            {googleError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 animate-in fade-in flex items-center gap-2">
                <X className="w-4 h-4 shrink-0 text-red-600" />
                <span>{googleError}</span>
              </div>
            )}

            {/* ---------- STAGE 1: ENTER GOOGLE ACCOUNT ---------- */}
            {googleStep === 'enter_email' && (
              <div>
                <div className="text-center space-y-2 mb-6">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-[#F4FBFF] border border-[#C9EAF7] flex items-center justify-center shadow-xs">
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-extrabold text-[#082F61]">Sign in with Google</h3>
                  <p className="text-xs text-[#58758D] max-w-xs mx-auto">
                    to continue to <strong className="text-[#082F61]">LABGUARD Telemetry</strong>
                  </p>
                </div>

                <form onSubmit={handleGoogleEmailSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="google-email"
                      className="block text-xs font-bold text-[#082F61] tracking-wide uppercase"
                    >
                      Email or phone
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#087EE8]">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        id="google-email"
                        type="email"
                        required
                        autoFocus
                        value={googleEmail}
                        onChange={(e) => setGoogleEmail(e.target.value)}
                        placeholder="user@gmail.com"
                        className="w-full pl-10 pr-4 py-3 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-sm font-medium text-[#17324D] placeholder-[#58758D]/60 focus:outline-none focus:ring-2 focus:ring-[#087EE8] focus:border-[#087EE8]"
                      />
                    </div>
                    <p className="text-[11px] text-[#58758D]">
                      Enter your personal or corporate Google account address.
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setIsGoogleModalOpen(false)}
                      className="px-4 py-2.5 text-xs font-bold text-[#58758D] hover:text-[#082F61] hover:bg-[#F4FBFF] rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={isGoogleLoading}
                      className="py-2.5 px-6 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#087EE8] to-[#168BFF] hover:from-[#168BFF] hover:to-[#0866D4] transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {isGoogleLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Checking account...</span>
                        </>
                      ) : (
                        <>
                          <span>Next</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ---------- STAGE 2: GOOGLE AUTHORIZATION PERMISSION CONSENT ---------- */}
            {googleStep === 'authorize_permission' && (
              <div className="space-y-5">
                {/* Account Banner */}
                <div className="flex items-center justify-between pb-3 border-b border-[#C9EAF7]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#087EE8] to-[#168BFF] text-white flex items-center justify-center font-bold text-xs">
                      {googleEmail.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-[#082F61] truncate max-w-[220px]">
                        {googleEmail}
                      </p>
                      <p className="text-[10px] text-[#58758D]">Google Account</p>
                    </div>
                  </div>

                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>

                {/* Consent Request */}
                <div className="space-y-1">
                  <h3 className="text-lg font-extrabold text-[#082F61]">
                    LABGUARD wants to access your Google Account
                  </h3>
                  <p className="text-xs text-[#58758D]">
                    This will allow LABGUARD to verify your identity and link cryptographic telemetry access:
                  </p>
                </div>

                {/* Scopes List */}
                <div className="space-y-2.5">
                  <div className="p-3 bg-[#F4FBFF] rounded-2xl border border-[#C9EAF7] flex items-start gap-3">
                    <div className="p-1.5 bg-blue-100 rounded-lg text-[#087EE8] shrink-0 mt-0.5">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="text-left text-xs">
                      <p className="font-bold text-[#082F61]">
                        See your primary Google Account email address
                      </p>
                      <p className="text-[#58758D] text-[11px]">
                        Verifies your telemetry operator identity with HMAC-SHA256 evidence.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-[#F4FBFF] rounded-2xl border border-[#C9EAF7] flex items-start gap-3">
                    <div className="p-1.5 bg-blue-100 rounded-lg text-[#087EE8] shrink-0 mt-0.5">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="text-left text-xs">
                      <p className="font-bold text-[#082F61]">
                        Associate your identity with LABGUARD credentials
                      </p>
                      <p className="text-[#58758D] text-[11px]">
                        Enables session persistence and security audit log signing.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Trust Notice */}
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 text-left">
                  <span>
                    Make sure you trust LABGUARD. By clicking <strong>Allow</strong>, you grant permission to authenticate and proceed with account password creation.
                  </span>
                </div>

                {/* Consent Buttons */}
                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setGoogleStep('enter_email')}
                    className="px-4 py-2.5 text-xs font-bold text-[#58758D] hover:text-[#082F61] hover:bg-[#F4FBFF] rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGoogleAllowPermission}
                    className="py-2.5 px-6 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#087EE8] to-[#168BFF] hover:from-[#168BFF] hover:to-[#0866D4] transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-[0.99]"
                  >
                    <Check className="w-4 h-4" />
                    <span>Allow & Continue</span>
                  </button>
                </div>
              </div>
            )}

            {/* ---------- STAGE 3: CREATE & CONFIRM PASSWORD ---------- */}
            {googleStep === 'create_password' && (
              <div className="space-y-4">
                {/* Authorized Indicator */}
                <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">
                    Google Authorized: <strong>{googleEmail}</strong>
                  </span>
                </div>

                <div className="text-left space-y-1">
                  <h3 className="text-lg font-extrabold text-[#082F61]">
                    Create Operator Passphrase
                  </h3>
                  <p className="text-xs text-[#58758D]">
                    To complete your account onboarding, create a strong password for your telemetry dashboard login.
                  </p>
                </div>

                <form onSubmit={handleGoogleCreatePasswordSubmit} className="space-y-3.5">
                  {/* Create Password Input */}
                  <div className="space-y-1.5 text-left">
                    <label
                      htmlFor="google-create-password"
                      className="block text-xs font-bold text-[#082F61] tracking-wide uppercase"
                    >
                      Create Strong Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#087EE8]">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        id="google-create-password"
                        type={showGooglePassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        autoFocus
                        value={googlePassword}
                        onChange={(e) => setGooglePassword(e.target.value)}
                        placeholder="Letters, numerics & special characters"
                        className="w-full pl-10 pr-12 py-2.5 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-sm font-medium text-[#17324D] placeholder-[#58758D]/60 focus:outline-none focus:ring-2 focus:ring-[#087EE8] focus:border-[#087EE8] font-mono-telemetry"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGooglePassword(!showGooglePassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#58758D] hover:text-[#087EE8] cursor-pointer"
                      >
                        {showGooglePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Criteria checklist */}
                    <div className="pt-1">
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        <div
                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg ${
                            googleHasMinLength ? 'text-emerald-700 bg-emerald-50' : 'text-[#58758D] bg-[#F4FBFF]'
                          }`}
                        >
                          {googleHasMinLength ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#58758D]/50 ml-1 mr-1" />
                          )}
                          <span>8+ characters</span>
                        </div>

                        <div
                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg ${
                            googleHasLetters ? 'text-emerald-700 bg-emerald-50' : 'text-[#58758D] bg-[#F4FBFF]'
                          }`}
                        >
                          {googleHasLetters ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#58758D]/50 ml-1 mr-1" />
                          )}
                          <span>Letters (A-Z & a-z)</span>
                        </div>

                        <div
                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg ${
                            googleHasNumber ? 'text-emerald-700 bg-emerald-50' : 'text-[#58758D] bg-[#F4FBFF]'
                          }`}
                        >
                          {googleHasNumber ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#58758D]/50 ml-1 mr-1" />
                          )}
                          <span>Numeric digits (0-9)</span>
                        </div>

                        <div
                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg ${
                            googleHasSpecialChar ? 'text-emerald-700 bg-emerald-50' : 'text-[#58758D] bg-[#F4FBFF]'
                          }`}
                        >
                          {googleHasSpecialChar ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#58758D]/50 ml-1 mr-1" />
                          )}
                          <span>Special symbol (!@#$)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Confirm Password Input */}
                  <div className="space-y-1.5 text-left">
                    <label
                      htmlFor="google-confirm-password"
                      className="block text-xs font-bold text-[#082F61] tracking-wide uppercase"
                    >
                      Confirm Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#087EE8]">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <input
                        id="google-confirm-password"
                        type={showGoogleConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        value={googleConfirmPassword}
                        onChange={(e) => setGoogleConfirmPassword(e.target.value)}
                        placeholder="Re-enter password to confirm"
                        className="w-full pl-10 pr-12 py-2.5 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-sm font-medium text-[#17324D] placeholder-[#58758D]/60 focus:outline-none focus:ring-2 focus:ring-[#087EE8] focus:border-[#087EE8] font-mono-telemetry"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGoogleConfirmPassword(!showGoogleConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#58758D] hover:text-[#087EE8] cursor-pointer"
                      >
                        {showGoogleConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {googleConfirmPassword && (
                      <div className="pt-0.5">
                        {googlePasswordsMatch ? (
                          <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Passwords match</span>
                          </p>
                        ) : (
                          <p className="text-[11px] font-medium text-red-500 flex items-center gap-1">
                            <X className="w-3.5 h-3.5" />
                            <span>Passwords do not match yet</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={isGoogleLoading || !isGooglePasswordStrong || !googlePasswordsMatch}
                      className="w-full py-3 px-6 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#087EE8] to-[#168BFF] hover:from-[#168BFF] hover:to-[#0866D4] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
                    >
                      {isGoogleLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Securing Credentials & Authorizing...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" />
                          <span>Complete Registration & Access Dashboard</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ---------- STAGE 4: EXISTING REGISTERED GOOGLE ACCOUNT SIGN IN ---------- */}
            {googleStep === 'sign_in_existing' && (
              <div className="space-y-4">
                {/* Authorized Indicator */}
                <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">
                    Google Authorized: <strong>{googleEmail}</strong>
                  </span>
                </div>

                <div className="text-left space-y-1">
                  <h3 className="text-lg font-extrabold text-[#082F61]">Welcome Back</h3>
                  <p className="text-xs text-[#58758D]">
                    This Google account is already registered. Enter your operator password to sign in.
                  </p>
                </div>

                <form onSubmit={handleGoogleExistingLogin} className="space-y-4">
                  <div className="space-y-1.5 text-left">
                    <label
                      htmlFor="google-existing-password"
                      className="block text-xs font-bold text-[#082F61] tracking-wide uppercase"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#087EE8]">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        id="google-existing-password"
                        type={showGooglePassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        autoFocus
                        value={googlePassword}
                        onChange={(e) => setGooglePassword(e.target.value)}
                        placeholder="Enter your access password"
                        className="w-full pl-10 pr-12 py-3 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-sm font-medium text-[#17324D] placeholder-[#58758D]/60 focus:outline-none focus:ring-2 focus:ring-[#087EE8] focus:border-[#087EE8] font-mono-telemetry"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGooglePassword(!showGooglePassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#58758D] hover:text-[#087EE8] cursor-pointer"
                      >
                        {showGooglePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isGoogleLoading}
                    className="w-full py-3.5 px-6 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#087EE8] to-[#168BFF] hover:from-[#168BFF] hover:to-[#0866D4] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 active:scale-[0.99]"
                  >
                    {isGoogleLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Verifying Session...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In to Dashboard</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
