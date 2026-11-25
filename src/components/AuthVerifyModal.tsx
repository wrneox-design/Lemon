import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Mail, MailOpen, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { PublicUser } from '../server/authStore';

export type AuthModalStep = 'login' | 'register' | 'verify';

interface PreviewInboxMessage {
  toEmail: string;
  loginId: string;
  subject: string;
  code: string;
  expiresInMinutes: number;
}

interface AuthVerifyModalProps {
  isOpen: boolean;
  initialStep?: 'login' | 'register';
  onClose: () => void;
  onAuthenticated: (accessToken: string, user: PublicUser) => void;
}

export function AuthVerifyModal({
  isOpen,
  initialStep = 'login',
  onClose,
  onAuthenticated,
}: AuthVerifyModalProps) {
  const [step, setStep] = useState<AuthModalStep>(initialStep);

  useEffect(() => {
    if (isOpen) {
      setStep(initialStep);
      setErrorMsg('');
      setInfoMsg('');
      setInboxOpen(false);
      setInboxMessage(null);
      setOtpCode('');
      setIdentifier('');
      setFullName('');
      setLoginId('');
      setEmail('');
      setPassword('');
    }
  }, [isOpen, initialStep]);
  const [identifier, setIdentifier] = useState('');
  const [fullName, setFullName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [verificationToken, setVerificationToken] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'email' | 'preview'>('preview');
  const [otpCode, setOtpCode] = useState('');

  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxMessage, setInboxMessage] = useState<PreviewInboxMessage | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  if (!isOpen) return null;

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
      // Keep manual button available if auto-fetch fails
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
          setInfoMsg(
            data.deliveryNote ||
              data.error ||
              'Verify your email to unlock your dashboard.'
          );
          if (mode === 'preview') {
            await fetchPreviewInboxForToken(data.verificationToken);
          }
        } else {
          setErrorMsg(data.error || 'Unable to sign in.');
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
      setInfoMsg(
        data.deliveryNote ||
          (mode === 'email'
            ? `Verification email sent to ${data.emailMasked}.`
            : `Live mail secrets are not set yet — use your 6-digit code from LemonMail Preview below.`)
      );
      if (mode === 'preview') {
        await fetchPreviewInboxForToken(data.verificationToken);
      }
    } catch {
      setErrorMsg('Network error while creating account.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPreviewInbox = async () => {
    resetMessages();
    setLoading(true);
    try {
      const resp = await fetch('/api/auth/preview-inbox', {
        headers: { Authorization: `Bearer ${verificationToken}` },
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Could not load preview email.');
        return;
      }
      setInboxMessage(data);
      setInboxOpen(true);
    } catch {
      setErrorMsg('Unable to open preview inbox.');
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
      setInfoMsg(
        data.deliveryNote || `Fresh 6-digit code issued for ${data.emailMasked}.`
      );
      if (mode === 'preview') {
        await fetchPreviewInboxForToken(data.verificationToken);
      }
    } catch {
      setErrorMsg('Network error resending code.');
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
        setErrorMsg(data.error || 'Verification failed.');
        return;
      }
      onAuthenticated(data.accessToken, data.user);
    } catch {
      setErrorMsg('Network error verifying email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-[#111113] border border-white/[0.1] shadow-2xl text-white"
      >
        {/* Top Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#0C0C0E]">
          <div>
            <h2
              id="auth-dialog-title"
              className="font-display text-lg font-bold text-white"
            >
              {step === 'login' && 'Trader Sign In'}
              {step === 'register' && 'Create LemonFunding ID'}
              {step === 'verify' && 'Verify Your Email'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication dialog"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6">
          {/* Login / Register Mode Switcher */}
          {step !== 'verify' && (
            <div
              role="tablist"
              aria-label="Account access mode"
              className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#18181B] border border-white/[0.08] mb-5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={step === 'login'}
                onClick={() => {
                  resetMessages();
                  setStep('login');
                }}
                className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  step === 'login'
                    ? 'bg-white text-[#09090B]'
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
                className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  step === 'register'
                    ? 'bg-white text-[#09090B]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/35 text-xs font-medium text-red-300"
            >
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 p-3 rounded-xl bg-[#F7A600]/15 border border-[#F7A600]/35 text-xs font-medium text-[#F7A600]">
              {infoMsg}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 'login' && (
              <motion.form
                key="login-form"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.16 }}
                onSubmit={handleLoginSubmit}
                noValidate
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="login-identifier"
                    className="block text-sm font-semibold text-zinc-200 mb-1.5"
                  >
                    Login ID or Email
                  </label>
                  <input
                    id="login-identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. rohan_fx or trader@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.1] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-semibold text-zinc-200 mb-1.5"
                  >
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.1] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-5 rounded-full bg-white hover:bg-zinc-200 disabled:opacity-60 text-[#09090B] font-bold text-sm transition-colors cursor-pointer"
                >
                  {loading ? 'Signing In...' : 'Sign In to Dashboard'}
                </button>
              </motion.form>
            )}

            {step === 'register' && (
              <motion.form
                key="register-form"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.16 }}
                onSubmit={handleRegisterSubmit}
                noValidate
                className="space-y-3.5"
              >
                <div>
                  <label
                    htmlFor="reg-fullname"
                    className="block text-sm font-semibold text-zinc-200 mb-1"
                  >
                    Full Name
                  </label>
                  <input
                    id="reg-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Rohan Verma"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.1] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-loginid"
                    className="block text-sm font-semibold text-zinc-200 mb-1"
                  >
                    Unique Login ID
                  </label>
                  <input
                    id="reg-loginid"
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="rohan_fx"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.1] text-sm font-mono-tabular text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    3–24 characters using letters, numbers, or underscores.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="reg-email"
                    className="block text-sm font-semibold text-zinc-200 mb-1"
                  >
                    Email Address
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="rohan@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.1] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-password"
                    className="block text-sm font-semibold text-zinc-200 mb-1"
                  >
                    Password (min 8 chars)
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.1] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-5 rounded-full bg-white hover:bg-zinc-200 disabled:opacity-60 text-[#09090B] font-bold text-sm transition-colors cursor-pointer"
                >
                  {loading ? 'Creating Trader ID...' : 'Create ID & Send Verification Code'}
                </button>
              </motion.form>
            )}

            {step === 'verify' && (
              <motion.div
                key="verify-form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#18181B] border border-white/[0.08]">
                  <Mail className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="text-xs text-zinc-400 leading-relaxed">
                    Enter the 6-digit verification code sent to{' '}
                    <span className="font-semibold text-white">{emailMasked}</span> to
                    activate your LemonFunding Dashboard.
                  </div>
                </div>

                <form onSubmit={handleVerifySubmit} noValidate className="space-y-4">
                  <div>
                    <label
                      htmlFor="verify-otp"
                      className="block text-sm font-semibold text-zinc-200 mb-1.5"
                    >
                      6-Digit Email Verification Code
                    </label>
                    <input
                      id="verify-otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full px-4 py-3 rounded-xl bg-[#18181B] border border-white/[0.1] text-center font-mono-tabular text-xl font-bold tracking-[0.3em] text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-[#09090B] font-bold text-sm transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                    <span>{loading ? 'Verifying...' : 'Verify Email & Open Dashboard'}</span>
                  </button>
                </form>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[0.08]">
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
                      onClick={handleOpenPreviewInbox}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F7A600]/15 hover:bg-[#F7A600]/25 text-[#F7A600] border border-[#F7A600]/30 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <MailOpen className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Open Preview Inbox</span>
                    </button>
                  )}
                </div>

                {inboxOpen && inboxMessage && (
                  <div
                    data-testid="preview-inbox-card"
                    className="p-4 rounded-xl bg-[#18181B] text-white border border-white/[0.1] space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                      <span>LemonMail Preview · To: {inboxMessage.toEmail}</span>
                      <span>Expires in {inboxMessage.expiresInMinutes}m</span>
                    </div>
                    <p className="text-xs font-semibold text-[#F7A600]">
                      {inboxMessage.subject} (@{inboxMessage.loginId})
                    </p>
                    <div className="flex items-center justify-between gap-3 bg-white/[0.06] rounded-lg px-3 py-2">
                      <span
                        data-testid="preview-otp-code"
                        className="font-mono-tabular text-lg font-bold tracking-[0.25em] text-white"
                      >
                        {inboxMessage.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOtpCode(inboxMessage.code)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white text-[#09090B] text-xs font-semibold hover:bg-zinc-200 cursor-pointer"
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
        </div>
      </motion.div>
    </div>
  );
}
