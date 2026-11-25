import { useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, ShieldCheck, RefreshCw, MailOpen, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LemonLogo } from './LemonLogo';
import type { PublicUser } from '../server/authStore';

interface AuthPageViewProps {
  initialStep?: 'login' | 'register';
  onAuthenticated: (accessToken: string, user: PublicUser) => void;
  onBackToLanding: () => void;
}

export function AuthPageView({
  initialStep = 'login',
  onAuthenticated,
  onBackToLanding,
}: AuthPageViewProps) {
  const [step, setStep] = useState<'login' | 'register' | 'verify'>(initialStep);

  // Form states
  const [identifier, setIdentifier] = useState('');
  const [fullName, setFullName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Verification states
  const [verificationToken, setVerificationToken] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'email' | 'preview'>('preview');
  const [otpCode, setOtpCode] = useState('');
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxMessage, setInboxMessage] = useState<{
    toEmail: string;
    loginId: string;
    subject: string;
    code: string;
    expiresInMinutes: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const resetMessages = () => {
    setErrorMsg('');
    setInfoMsg('');
  };

  const fetchPreviewInboxForToken = async (token: string) => {
    try {
      const resp = await fetch('/api/auth/preview-inbox', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      setInboxMessage(data);
      setInboxOpen(true);
    } catch {
      // ignore
    }
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        if (resp.status === 403 && data.requiresVerification && data.verificationToken) {
          const mode = data.deliveryMode === 'email' ? 'email' : 'preview';
          setVerificationToken(data.verificationToken);
          setEmailMasked(data.emailMasked || '');
          setDeliveryMode(mode);
          setInboxMessage(null);
          setInboxOpen(false);
          setStep('verify');
          setInfoMsg(data.deliveryNote || 'Verify your email to activate your account.');
          if (mode === 'preview') {
            await fetchPreviewInboxForToken(data.verificationToken);
          }
        } else {
          setErrorMsg(data.error || 'Unable to sign in. Please check your credentials.');
        }
        return;
      }
      onAuthenticated(data.accessToken, data.user);
    } catch {
      setErrorMsg('Network error while signing in.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const resp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, loginId, email, password }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Could not create account.');
        return;
      }
      const mode = data.deliveryMode === 'email' ? 'email' : 'preview';
      setVerificationToken(data.verificationToken);
      setEmailMasked(data.emailMasked || '');
      setDeliveryMode(mode);
      setInboxMessage(null);
      setInboxOpen(false);
      setOtpCode('');
      setStep('verify');
      setInfoMsg(data.deliveryNote || `Verification email sent to ${data.emailMasked}.`);
      if (mode === 'preview') {
        await fetchPreviewInboxForToken(data.verificationToken);
      }
    } catch {
      setErrorMsg('Network error while creating account.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const resp = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${verificationToken}`,
        },
        body: JSON.stringify({ code: otpCode }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Verification failed. Invalid code.');
        return;
      }
      onAuthenticated(data.accessToken, data.user);
    } catch {
      setErrorMsg('Network error verifying email.');
    } finally {
      setLoading(false);
    }
  };



  const handleResendCode = async () => {
    resetMessages();
    setLoading(true);
    try {
      const resp = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { Authorization: `Bearer ${verificationToken}` },
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Could not resend code.');
        return;
      }
      const mode = data.deliveryMode === 'email' ? 'email' : 'preview';
      setVerificationToken(data.verificationToken);
      setDeliveryMode(mode);
      setInboxMessage(null);
      setInfoMsg(data.deliveryNote || `Fresh code sent to ${data.emailMasked}.`);
      if (mode === 'preview') {
        await fetchPreviewInboxForToken(data.verificationToken);
      }
    } catch {
      setErrorMsg('Network error resending code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-white flex flex-col justify-between">
      {/* Top Header */}
      <header className="w-full px-6 py-4 flex items-center justify-between max-w-[1200px] mx-auto">
        <button
          type="button"
          onClick={onBackToLanding}
          className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-[#111113] border border-white/[0.1] hover:bg-[#18181B] text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" aria-hidden="true" />
          <span>Back to LemonFunding</span>
        </button>

        <div className="inline-flex items-center gap-2">
          <LemonLogo size={28} rounded="lg" />
          <span className="font-display text-lg font-bold tracking-tight text-white">
            LemonFunding
          </span>
        </div>
      </header>

      {/* Main Centered Sign In / Auth Box */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-[440px] p-8 sm:p-10 rounded-3xl bg-[#111113] border border-white/[0.08] shadow-2xl relative overflow-hidden"
        >
          {/* Subtle Emerald/Amber Ambient Accent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-emerald-500/10 blur-2xl pointer-events-none rounded-full" />

          <div className="text-center mb-7 relative z-10">
            <div className="flex justify-center mb-3">
              <LemonLogo size={54} rounded="xl" className="shadow-xs" />
            </div>
            <h1 className="font-display text-2xl font-extrabold text-white tracking-tight">
              {step === 'login' && 'Sign in to your account'}
              {step === 'register' && 'Create your LemonFunding ID'}
              {step === 'verify' && 'Verify Your Email'}
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              {step === 'login' && 'Access your evaluation accounts, live trade log & payouts'}
              {step === 'register' && 'Join traders worldwide with transparent prop rules'}
              {step === 'verify' && 'Enter the 6-digit code sent to your email inbox'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          {step !== 'verify' && (
            <div
              role="tablist"
              aria-label="Account access mode"
              className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#18181B] border border-white/[0.08] mb-6 relative z-10"
            >
              <button
                type="button"
                role="tab"
                aria-selected={step === 'login'}
                onClick={() => {
                  resetMessages();
                  setStep('login');
                }}
                className={`py-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  step === 'login'
                    ? 'bg-white text-[#09090B] shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={step === 'register'}
                onClick={() => {
                  resetMessages();
                  setStep('register');
                }}
                className={`py-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  step === 'register'
                    ? 'bg-white text-[#09090B] shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {errorMsg && (
            <div role="alert" className="mb-4 p-3.5 rounded-xl bg-red-500/15 border border-red-500/35 text-xs font-medium text-red-300 relative z-10">
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-[#F7A600]/15 border border-[#F7A600]/35 text-xs font-medium text-[#F7A600] relative z-10">
              {infoMsg}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 'login' && (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18 }}
                onSubmit={handleLoginSubmit}
                noValidate
                className="space-y-4 relative z-10"
              >
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                    Email address or Login ID
                  </label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="trader@example.com or rohan_fx"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-[#18181B] border border-white/[0.1] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35 transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-zinc-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg('');
                        setInfoMsg('Password recovery: Sign in with your verified email or create a new Trader ID.');
                      }}
                      className="text-xs font-semibold text-[#F7A600] hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-[#18181B] border border-white/[0.1] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35 transition-all"
                  />
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="checkbox"
                    id="remember-me"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="remember-me" className="text-xs font-medium text-zinc-400 cursor-pointer">
                    Remember Me on this device
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-5 rounded-full bg-white hover:bg-zinc-200 disabled:opacity-60 text-[#09090B] font-bold text-sm transition-colors cursor-pointer shadow-xs mt-2 flex items-center justify-center gap-2"
                >
                  <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                  <span>→</span>
                </button>

                <div className="text-center pt-2">
                  <p className="text-xs text-zinc-400">
                    Ready to trade?{' '}
                    <button
                      type="button"
                      onClick={() => setStep('register')}
                      className="font-bold text-white hover:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Create your account
                    </button>
                  </p>
                </div>
              </motion.form>
            )}

            {step === 'register' && (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                onSubmit={handleRegisterSubmit}
                noValidate
                className="space-y-3.5 relative z-10"
              >
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Rohan Verma"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.1] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">
                    Unique Login ID
                  </label>
                  <input
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="rohan_fx"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.1] text-sm font-mono-tabular text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="rohan@example.com"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.1] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">
                    Password (min 8 chars)
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.1] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-5 rounded-full bg-white hover:bg-zinc-200 disabled:opacity-60 text-[#09090B] font-bold text-sm transition-colors cursor-pointer shadow-xs mt-2 flex items-center justify-center gap-2"
                >
                  <span>{loading ? 'Creating Account...' : 'Create ID & Verify Email'}</span>
                  <span>→</span>
                </button>

                <div className="text-center pt-2">
                  <p className="text-xs text-zinc-400">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setStep('login')}
                      className="font-bold text-white hover:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Sign in
                    </button>
                  </p>
                </div>
              </motion.form>
            )}

            {step === 'verify' && (
              <motion.div
                key="verify"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="space-y-4 relative z-10"
              >
                <div className="flex items-start gap-3 p-4 rounded-xl bg-[#18181B] border border-white/[0.08]">
                  <Mail className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="text-xs text-zinc-400 leading-relaxed">
                    Enter the 6-digit verification code sent to <strong className="text-white">{emailMasked}</strong>.
                  </div>
                </div>

                <form onSubmit={handleVerifySubmit} noValidate className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      6-Digit Email Verification Code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      required
                      className="w-full px-4 py-3.5 rounded-xl bg-[#18181B] border border-white/[0.1] text-center font-mono-tabular text-xl font-bold tracking-[0.3em] text-white focus:outline-none focus:border-emerald-400 transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-[#09090B] font-bold text-sm transition-colors cursor-pointer shadow-xs"
                  >
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                    <span>{loading ? 'Verifying...' : 'Verify Email & Open Dashboard'}</span>
                  </button>
                </form>

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Resend Code</span>
                  </button>

                  {deliveryMode === 'preview' && (
                    <button
                      type="button"
                      onClick={async () => {
                        resetMessages();
                        const resp = await fetch('/api/auth/preview-inbox', {
                          headers: { Authorization: `Bearer ${verificationToken}` },
                        });
                        const data = await resp.json();
                        if (resp.ok) {
                          setInboxMessage(data);
                          setInboxOpen(true);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F7A600]/15 border border-[#F7A600]/30 text-[#F7A600] text-xs font-bold hover:bg-[#F7A600]/25 cursor-pointer"
                    >
                      <MailOpen className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Check Preview Code</span>
                    </button>
                  )}
                </div>

                {inboxOpen && inboxMessage && (
                  <div className="p-4 rounded-xl bg-[#18181B] text-white border border-white/[0.1] space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span>LemonMail Preview Inbox</span>
                      <span>To: {inboxMessage.toEmail}</span>
                    </div>
                    <p className="text-xs font-semibold text-[#F7A600]">
                      {inboxMessage.subject} (@{inboxMessage.loginId})
                    </p>
                    <div className="flex items-center justify-between gap-3 bg-white/[0.06] rounded-lg px-3 py-2">
                      <span className="font-mono-tabular text-lg font-bold tracking-[0.25em] text-white">
                        {inboxMessage.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOtpCode(inboxMessage.code)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded bg-white text-[#09090B] text-xs font-bold hover:bg-zinc-200 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Use Code</span>
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      {/* Footer matching website style */}
      <footer className="w-full py-6 text-center text-xs text-zinc-500 border-t border-white/[0.08] bg-[#09090B]">
        © 2026 LemonFunding. Transparent prop trading challenges.
      </footer>
    </div>
  );
}
