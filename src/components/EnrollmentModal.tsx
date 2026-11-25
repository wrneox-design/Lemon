import { useEffect, useState, type FormEvent } from 'react';
import {
  Check,
  Copy,
  Download,
  Key,
  X,
  ArrowRight,
  Clock,
} from 'lucide-react';
import {
  applyComebackDiscount,
  COMEBACK_CODE,
  formatUsd,
  isComebackPromoCode,
  isGiveawayCouponCode,
  validateEnrollmentForm,
  type ChallengeSpec,
  type EnrolledChallenge,
} from '../utils/challenges';
import { PaymentMethod, type PaymentConfirmedDetails } from './PaymentMethod';

interface EnrollmentModalProps {
  isOpen: boolean;
  spec: ChallengeSpec;
  isAuthenticated: boolean;
  accessToken?: string;
  usedCouponCodes?: string[];
  defaultName?: string;
  defaultEmail?: string;
  comebackEligible?: boolean;
  comebackCode?: string | null;
  initialPromoCode?: string;
  onClose: () => void;
  onCompleteEnrollment: (challenge: EnrolledChallenge) => Promise<string | void> | void;
  onGoToDashboard: () => void;
  onOpenAuthForDashboard: () => void;
  onOpenTerminal?: (accountNumber?: string) => void;
  onOpenPWAInstall?: () => void;
}

export function EnrollmentModal({
  isOpen,
  spec,
  isAuthenticated,
  accessToken = '',
  usedCouponCodes = [],
  defaultName = '',
  defaultEmail = '',
  comebackEligible = false,
  comebackCode = null,
  initialPromoCode = '',
  onClose,
  onCompleteEnrollment,
  onGoToDashboard,
  onOpenAuthForDashboard,
  onOpenPWAInstall,
}: EnrollmentModalProps) {
  const [step, setStep] = useState<'details' | 'payment'>('details');
  const [traderName, setTraderName] = useState(defaultName);
  const [traderEmail, setTraderEmail] = useState(defaultEmail);
  const [promoInput, setPromoInput] = useState<string>('');
  const [promoError, setPromoError] = useState<string>('');
  const [promoChecking, setPromoChecking] = useState<boolean>(false);
  const [serverRejectedPromo, setServerRejectedPromo] = useState<string>('');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [submittedRecord, setSubmittedRecord] = useState<EnrolledChallenge | null>(null);
  const [generatedPass, setGeneratedPass] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const normalizedUsed = usedCouponCodes.map((c) => c.trim().toUpperCase());
  const normalizedPromo = promoInput.trim().toUpperCase();
  const clientBlockedGiveaway =
    Boolean(normalizedPromo) &&
    isGiveawayCouponCode(normalizedPromo) &&
    (normalizedUsed.includes(normalizedPromo) || normalizedUsed.some((c) => isGiveawayCouponCode(c)));
  const isPromoBlocked = clientBlockedGiveaway || (Boolean(normalizedPromo) && serverRejectedPromo === normalizedPromo);

  const rawDiscountResult = applyComebackDiscount(spec.feeUsd, promoInput, comebackEligible);
  const discountResult = isPromoBlocked
    ? {
        valid: false,
        appliedCode: null,
        discountPct: 0,
        discountUsd: 0,
        finalFeeUsd: spec.feeUsd,
      }
    : rawDiscountResult;

  useEffect(() => {
    if (isOpen) {
      setStep('details');
      setTraderName(defaultName || '');
      setTraderEmail(defaultEmail || '');
      setPromoInput(
        initialPromoCode || (comebackEligible && comebackCode ? comebackCode : '')
      );
      setPromoError('');
      setServerRejectedPromo('');
      setErrors({});
      setCopied(false);
      setSubmittedRecord(null);
    }
  }, [isOpen, defaultName, defaultEmail, comebackEligible, comebackCode, initialPromoCode]);

  if (!isOpen) return null;

  const handleApplyPromo = async (codeOverride?: string): Promise<boolean> => {
    const raw = (codeOverride ?? promoInput).trim().toUpperCase();
    setPromoInput(raw);
    setServerRejectedPromo('');
    if (!raw) {
      setPromoError('');
      return true;
    }

    if (!isGiveawayCouponCode(raw) && !isComebackPromoCode(raw)) {
      setPromoError('Invalid promo code. Enter COMEBACK40 or a giveaway discount coupon.');
      return false;
    }

    if (isGiveawayCouponCode(raw)) {
      if (normalizedUsed.includes(raw) || normalizedUsed.some((c) => isGiveawayCouponCode(c))) {
        setServerRejectedPromo(raw);
        setPromoError(`Coupon "${raw}" cannot be applied. Giveaway discount coupons work only 1 time per account.`);
        return false;
      }
    } else if (isComebackPromoCode(raw) && !comebackEligible) {
      setPromoError('COMEBACK40 (40% off) unlocks automatically once an account is breached.');
      return false;
    }

    if (isAuthenticated && accessToken) {
      setPromoChecking(true);
      try {
        const resp = await fetch('/api/promo/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ promoCode: raw }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          setServerRejectedPromo(raw);
          setPromoError(data.error || 'Coupon is already used or invalid for this account.');
          return false;
        }
      } catch {
        // Fallback to client check if temporary network blip
      } finally {
        setPromoChecking(false);
      }
    }

    setPromoError('');
    return true;
  };

  const handleProceedToPayment = async (e: FormEvent) => {
    e.preventDefault();
    const validation = validateEnrollmentForm(traderName, traderEmail);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    if (promoInput.trim()) {
      const ok = await handleApplyPromo();
      if (!ok) {
        return;
      }
    }

    setErrors({});
    setStep('payment');
  };

  const handlePaymentConfirmed = async (details: PaymentConfirmedDetails) => {
    const accountNum = `LF-${Math.floor(100000 + Math.random() * 899999)}`;
    const pass = `LT-${Math.random().toString(36).substring(2, 8).toUpperCase()}!`;
    setGeneratedPass(pass);

    const record: EnrolledChallenge = {
      id: `ch-${Date.now()}`,
      accountNumber: accountNum,
      traderName: traderName.trim(),
      traderEmail: traderEmail.trim(),
      platform: 'Lemon Terminal',
      mode: spec.mode,
      modeLabel: spec.modeLabel,
      accountSize: spec.accountSize,
      profitSplitPct: spec.profitSplitPct,
      feePaidUsd: discountResult.finalFeeUsd,
      promoCodeApplied: discountResult.appliedCode ?? undefined,
      discountPctApplied: discountResult.discountPct > 0 ? discountResult.discountPct : undefined,
      paymentMethod: details.paymentMethod,
      paymentProofUrl: details.paymentProofUrl,
      status: 'Pending Approval',
      createdAtIso: new Date().toISOString(),
    };

    const syncedAccountNum = await onCompleteEnrollment(record);
    setSubmittedRecord(
      typeof syncedAccountNum === 'string' && syncedAccountNum
        ? { ...record, accountNumber: syncedAccountNum }
        : record
    );
  };

  const handleCopyCredentials = () => {
    if (!submittedRecord) return;
    const text = `Lemon Terminal Credentials\nServer: LemonFunding-Live\nAccount ID: ${submittedRecord.accountNumber}\nTrader Password: ${generatedPass || 'LT-LEMON1!'}\nPlatform: Lemon Terminal™\nStatus: Pending Admin Approval`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setSubmittedRecord(null);
    setErrors({});
    setStep('details');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="enroll-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    >
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#111113] border border-white/[0.1] shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#0C0C0E]">
          <div>
            <h2
              id="enroll-dialog-title"
              className="font-display text-lg font-bold text-white"
            >
              {submittedRecord
                ? 'Challenge Purchase Submitted'
                : step === 'payment'
                  ? 'BNB (BEP20) Deposit & Proof'
                  : 'Buy Funded Challenge'}
            </h2>
            <p className="text-[11px] text-zinc-400">
              {submittedRecord
                ? 'Pending Owner Verification'
                : step === 'payment'
                  ? 'Upload transfer receipt for Admin approval'
                  : 'Transparent rules · Lemon Terminal execution'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close enrollment dialog"
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Confirmation Screen */}
        {submittedRecord ? (
          <div className="p-6 sm:p-7 space-y-5">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#F7A600]/15 border border-[#F7A600]/35 text-[#F7A600]">
              <Clock className="w-5 h-5 shrink-0 mt-0.5 text-[#F7A600]" aria-hidden="true" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm text-white">
                    Payment Proof Submitted — Pending Admin Approval
                  </p>
                </div>
                <p className="text-xs mt-1 text-zinc-300 leading-relaxed">
                  Receipt for <strong className="font-mono text-white">{submittedRecord.accountNumber}</strong> is queued for Owner review. Once approved, trading unlocks immediately.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#18181B] border border-white/[0.08] text-white space-y-3.5">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#F7A600]" />
                  <span className="font-display font-bold text-xs text-white">
                    Lemon Terminal™ Credentials
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#F7A600]/20 text-[#F7A600] font-bold">
                  Pending Activation
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono-tabular">
                <div className="bg-white/[0.05] p-2.5 rounded-xl">
                  <span className="text-[10px] text-zinc-400 block font-sans">Trading Server</span>
                  <span className="font-bold text-white">LemonFunding-Live</span>
                </div>
                <div className="bg-white/[0.05] p-2.5 rounded-xl">
                  <span className="text-[10px] text-zinc-400 block font-sans">Account Login ID</span>
                  <span className="font-bold text-[#F7A600]">{submittedRecord.accountNumber}</span>
                </div>
                <div className="bg-white/[0.05] p-2.5 rounded-xl">
                  <span className="text-[10px] text-zinc-400 block font-sans">Trader Password</span>
                  <span className="font-bold text-white">{generatedPass || 'LT-LEMON1!'}</span>
                </div>
                <div className="bg-white/[0.05] p-2.5 rounded-xl">
                  <span className="text-[10px] text-zinc-400 block font-sans">Platform</span>
                  <span className="font-bold text-emerald-400">Lemon Terminal™</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyCredentials}
                  className="flex-1 py-2 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs text-white flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#F7A600]" />}
                  <span>{copied ? 'Credentials Copied' : 'Copy Credentials'}</span>
                </button>

                {onOpenPWAInstall && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      onOpenPWAInstall();
                    }}
                    className="py-2 px-3 rounded-xl bg-white hover:bg-zinc-200 text-xs text-[#09090B] font-bold flex items-center gap-1.5 cursor-pointer font-sans"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download App</span>
                  </button>
                )}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs bg-[#18181B] p-4 rounded-xl border border-white/[0.08]">
              <div>
                <dt className="text-zinc-400">Capital Size</dt>
                <dd className="font-mono-tabular font-bold text-white text-sm mt-0.5">
                  {formatUsd(submittedRecord.accountSize)}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-400">Evaluation Fee</dt>
                <dd className="font-mono-tabular font-bold text-emerald-400 text-sm mt-0.5">
                  {formatUsd(submittedRecord.feePaidUsd)}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-400">Payment Method</dt>
                <dd className="font-semibold text-white mt-0.5">
                  {submittedRecord.paymentMethod || 'Crypto (BNB BEP20)'}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-400">Status</dt>
                <dd className="font-bold text-[#F7A600] mt-0.5">Pending Approval</dd>
              </div>
            </dl>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onGoToDashboard();
                  }}
                  className="flex-1 py-3 px-4 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] font-bold text-sm transition-colors cursor-pointer"
                >
                  View in Trader Dashboard
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onOpenAuthForDashboard();
                  }}
                  className="flex-1 py-3 px-4 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] font-bold text-sm transition-colors cursor-pointer"
                >
                  Sign In to Track Account
                </button>
              )}

              <button
                type="button"
                onClick={handleClose}
                className="py-3 px-4 rounded-full border border-white/[0.12] text-sm font-semibold text-zinc-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : step === 'payment' ? (
          <div className="p-6 sm:p-7">
            <PaymentMethod
              dark
              amountUsd={discountResult.finalFeeUsd}
              accountModeLabel={spec.modeLabel}
              accountSize={spec.accountSize}
              promoCodeApplied={discountResult.appliedCode || undefined}
              discountPctApplied={discountResult.discountPct > 0 ? discountResult.discountPct : undefined}
              onPaymentConfirmed={handlePaymentConfirmed}
              onCancel={() => setStep('details')}
            />
          </div>
        ) : (
          <form onSubmit={handleProceedToPayment} noValidate className="p-6 sm:p-7 space-y-5">
            <div className="p-4 rounded-2xl bg-[#18181B] border border-white/[0.08] flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-white">
                  {spec.modeLabel} · {formatUsd(spec.accountSize)}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {spec.profitSplitPct}% split · {spec.drawdownRule} · Daily {spec.dailyLossPct}%
                </p>
              </div>
              <div className="text-right">
                {discountResult.valid ? (
                  <>
                    <span className="font-mono-tabular text-xs line-through text-zinc-500 block">
                      {formatUsd(spec.feeUsd)}
                    </span>
                    <span className="font-mono-tabular text-lg font-bold text-emerald-400">
                      {formatUsd(discountResult.finalFeeUsd)}
                    </span>
                  </>
                ) : (
                  <span className="font-mono-tabular text-lg font-bold text-white">
                    {formatUsd(spec.feeUsd)}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#18181B] border border-white/[0.08] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="enroll-promo" className="text-sm font-semibold text-white">
                  Coupon / Promo Code (1 Use Per Account)
                </label>
                {comebackEligible && (
                  <button
                    type="button"
                    onClick={() => void handleApplyPromo(COMEBACK_CODE)}
                    className="text-xs font-bold px-2.5 py-1 rounded-md bg-[#F7A600]/15 text-[#F7A600] border border-[#F7A600]/35 hover:bg-[#F7A600]/25 cursor-pointer"
                  >
                    Apply {COMEBACK_CODE} (40% OFF)
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="enroll-promo"
                  type="text"
                  value={promoInput}
                  onChange={(e) => {
                    setPromoInput(e.target.value.toUpperCase());
                    setServerRejectedPromo('');
                    if (promoError) setPromoError('');
                  }}
                  placeholder="Enter coupon code"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#09090B] border border-white/[0.1] font-mono-tabular text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35"
                />
                <button
                  type="button"
                  disabled={promoChecking}
                  onClick={() => void handleApplyPromo()}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-[#09090B] text-sm font-bold cursor-pointer disabled:opacity-60"
                >
                  {promoChecking ? 'Checking...' : 'Apply'}
                </button>
              </div>
              {discountResult.valid && !promoError && (
                <p className="text-xs font-semibold text-emerald-400">
                  {discountResult.appliedCode} applied — {discountResult.discountPct}% discount (-{formatUsd(discountResult.discountUsd)}). Valid 1 time per account.
                </p>
              )}
              {(promoError || (clientBlockedGiveaway && !promoError)) && (
                <p className="text-xs font-medium text-red-400" role="alert">
                  {promoError || `Coupon "${normalizedPromo}" works only 1 time per user account.`}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="enroll-name" className="block text-sm font-semibold text-zinc-200 mb-1.5">
                Trader Full Name
              </label>
              <input
                id="enroll-name"
                type="text"
                value={traderName}
                onChange={(e) => setTraderName(e.target.value)}
                placeholder="e.g. Aarav Verma"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.1] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35"
              />
              {errors.name && (
                <p className="text-xs font-medium text-red-400 mt-1.5" role="alert">
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="enroll-email" className="block text-sm font-semibold text-zinc-200 mb-1.5">
                Email for Credentials
              </label>
              <input
                id="enroll-email"
                type="email"
                value={traderEmail}
                onChange={(e) => setTraderEmail(e.target.value)}
                placeholder="trader@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.1] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35"
              />
              {errors.email && (
                <p className="text-xs font-medium text-red-400 mt-1.5" role="alert">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-3 rounded-full border border-white/[0.12] text-sm font-semibold text-zinc-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 px-5 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Continue to BNB BEP20 Payment</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
