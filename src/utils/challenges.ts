export type ChallengeMode = 'one-step' | 'two-step' | 'instant';
export type AccountSize = 2500 | 5000 | 10000 | 25000 | 50000 | 100000 | 200000;
export type ProfitSplitOption = 80 | 90;
export type TradingPlatform = 'Lemon Terminal' | 'MetaTrader 5' | 'cTrader' | 'TradeLocker';

export interface ChallengeSpec {
  mode: ChallengeMode;
  modeLabel: string;
  tagline: string;
  accountSize: AccountSize;
  feeUsd: number;
  phase1TargetPct: number;
  phase1TargetUsd: number;
  phase2TargetPct: number | null;
  phase2TargetUsd: number | null;
  dailyLossPct: number;
  dailyLossUsd: number;
  maxDrawdownPct: number;
  maxDrawdownUsd: number;
  drawdownRule: 'Static Balance' | 'End-of-Day Trailing' | 'Balance Equity Guard';
  minTradingDays: number;
  profitSplitPct: ProfitSplitOption;
  payoutCycleDays: number;
  leverage: string;
  feeRefundOnFirstPayout: boolean;
  consistencyRulePct?: number;
  floatingLossRulePct?: number;
  isSpecialBonusOffer?: boolean;
  transparencyGuarantees: string[];
}

export interface SimulationInput {
  startingBalance: number;
  dayStartEquity: number;
  closedPnl: number;
  floatingPnl: number;
}

export type SimulationVerdict =
  | 'PASSED'
  | 'BREACHED_DAILY'
  | 'BREACHED_OVERALL'
  | 'ACTIVE_CAUTION'
  | 'ACTIVE_SAFE';

export interface SimulationResult {
  currentEquity: number;
  dailyLimitFloor: number;
  overallLimitFloor: number;
  dailyBufferRemaining: number;
  overallBufferRemaining: number;
  dailyUsedPct: number;
  overallUsedPct: number;
  targetProgressPct: number;
  projectedTraderPayout: number;
  verdict: SimulationVerdict;
  explanation: string;
}

export const COMEBACK_CODE = 'COMEBACK40';
export const COMEBACK_DISCOUNT_PCT = 40;

export const GIVEAWAY_COUPONS: Record<string, number> = {
  VIP50: 50,
  SAVE50: 50,
  SAVE40: 40,
  CITRUS35: 35,
  LEMON30: 30,
  BOOST25: 25,
  ZEST20: 20,
  PROMO15: 15,
  SAVE10: 10,
};

export function normalizePromoCode(code?: string): string {
  return (code || '').trim().toUpperCase();
}

export function isComebackPromoCode(code?: string): boolean {
  const norm = normalizePromoCode(code);
  return norm === 'COMEBACK40' || norm === 'COMEBACK';
}

export function isGiveawayCouponCode(code?: string): boolean {
  const norm = normalizePromoCode(code);
  return Object.prototype.hasOwnProperty.call(GIVEAWAY_COUPONS, norm);
}

export function applyComebackDiscount(
  baseFeeUsd: number,
  promoCode?: string,
  isEligible = true
): {
  finalFeeUsd: number;
  discountPct: number;
  discountUsd: number;
  appliedCode: string | null;
  valid: boolean;
} {
  const norm = normalizePromoCode(promoCode);
  if (isGiveawayCouponCode(norm)) {
    const discountPct = GIVEAWAY_COUPONS[norm];
    const finalFeeUsd = Math.max(1, Math.round(baseFeeUsd * (1 - discountPct / 100)));
    return {
      finalFeeUsd,
      discountPct,
      discountUsd: Math.max(0, baseFeeUsd - finalFeeUsd),
      appliedCode: norm,
      valid: true,
    };
  }
  if (!isComebackPromoCode(norm) || !isEligible) {
    return {
      finalFeeUsd: baseFeeUsd,
      discountPct: 0,
      discountUsd: 0,
      appliedCode: null,
      valid: false,
    };
  }
  const finalFeeUsd = Math.max(1, Math.round(baseFeeUsd * (1 - COMEBACK_DISCOUNT_PCT / 100)));
  return {
    finalFeeUsd,
    discountPct: COMEBACK_DISCOUNT_PCT,
    discountUsd: Math.max(0, baseFeeUsd - finalFeeUsd),
    appliedCode: COMEBACK_CODE,
    valid: true,
  };
}

export interface EnrolledChallenge {
  id: string;
  accountNumber: string;
  traderName: string;
  traderEmail: string;
  platform: TradingPlatform;
  mode: ChallengeMode;
  modeLabel: string;
  accountSize: AccountSize;
  profitSplitPct: ProfitSplitOption;
  feePaidUsd: number;
  promoCodeApplied?: string;
  discountPctApplied?: number;
  paymentMethod?: string;
  paymentProofUrl?: string;
  status: 'Pending Approval' | 'Active Evaluation' | 'Instant Funded';
  createdAtIso: string;
}

export interface PayoutRecord {
  id: string;
  traderInitials: string;
  traderName: string;
  country: string;
  mode: ChallengeMode;
  modeLabel: string;
  accountSize: AccountSize;
  payoutUsd: number;
  processingTime: string;
  method: 'BNB BEP20' | 'Rise' | 'USDC' | 'Bank Wire';
  dateLabel: string;
}

export const ACCOUNT_SIZES: AccountSize[] = [2500, 5000, 10000, 25000, 50000, 100000, 200000];

export const CHALLENGE_MODES: {
  id: ChallengeMode;
  label: string;
  shortLabel: string;
  summary: string;
}[] = [
  {
    id: 'two-step',
    label: '2-Step Classic Lemon',
    shortLabel: '2-Step Classic',
    summary: 'Lowest fee with static balance drawdown and 8% + 5% targets.',
  },
  {
    id: 'one-step',
    label: '1-Step Citrus Sprint',
    shortLabel: '1-Step Citrus',
    summary: 'Single 10% evaluation phase straight to funded capital.',
  },
  {
    id: 'instant',
    label: 'Instant Zest Funded',
    shortLabel: 'Instant Zest',
    summary: 'Zero evaluation phases. Trade funded capital from day one.',
  },
];

const BASE_FEES: Record<ChallengeMode, Record<AccountSize, number>> = {
  'two-step': {
    2500: 6,
    5000: 12,
    10000: 22,
    25000: 45,
    50000: 89,
    100000: 159,
    200000: 299,
  },
  'one-step': {
    2500: 14,
    5000: 24,
    10000: 45,
    25000: 89,
    50000: 159,
    100000: 279,
    200000: 499,
  },
  instant: {
    2500: 12,
    5000: 2, // Special 2027 bonus offer: $5,000 Instant Funded for only $2!
    10000: 39,
    25000: 79,
    50000: 149,
    100000: 279,
    200000: 499,
  },
};

export function getChallengeSpec(
  mode: ChallengeMode,
  accountSize: AccountSize,
  profitSplit: ProfitSplitOption = 80
): ChallengeSpec {
  const baseFee = BASE_FEES[mode][accountSize];
  const boostFee = profitSplit === 90 ? Math.round(baseFee * 0.15) : 0;
  const feeUsd = baseFee + boostFee;

  if (mode === 'two-step') {
    const dailyLossPct = 5;
    const maxDrawdownPct = 10;
    const phase1TargetPct = 8;
    const phase2TargetPct = 5;
    return {
      mode,
      modeLabel: '2-Step Classic Lemon',
      tagline: 'Balanced two-stage evaluation with static overall drawdown',
      accountSize,
      feeUsd,
      phase1TargetPct,
      phase1TargetUsd: Math.round((accountSize * phase1TargetPct) / 100),
      phase2TargetPct,
      phase2TargetUsd: Math.round((accountSize * phase2TargetPct) / 100),
      dailyLossPct,
      dailyLossUsd: Math.round((accountSize * dailyLossPct) / 100),
      maxDrawdownPct,
      maxDrawdownUsd: Math.round((accountSize * maxDrawdownPct) / 100),
      drawdownRule: 'Static Balance',
      minTradingDays: 5,
      profitSplitPct: profitSplit,
      payoutCycleDays: 14,
      leverage: '1:100 FX · 1:30 Indices',
      feeRefundOnFirstPayout: true,
      transparencyGuarantees: [
        'Static 10% max loss never trails unrealized profit spikes',
        'Direct promotion to next challenge stage upon target pass',
        'BNB BEP20 crypto payouts processed within max 24 hours (min $100)',
      ],
    };
  }

  if (mode === 'one-step') {
    const dailyLossPct = 4;
    const maxDrawdownPct = 8;
    const phase1TargetPct = 10;
    return {
      mode,
      modeLabel: '1-Step Citrus Sprint',
      tagline: 'Single evaluation target straight to funded payouts',
      accountSize,
      feeUsd,
      phase1TargetPct,
      phase1TargetUsd: Math.round((accountSize * phase1TargetPct) / 100),
      phase2TargetPct: null,
      phase2TargetUsd: null,
      dailyLossPct,
      dailyLossUsd: Math.round((accountSize * dailyLossPct) / 100),
      maxDrawdownPct,
      maxDrawdownUsd: Math.round((accountSize * maxDrawdownPct) / 100),
      drawdownRule: 'End-of-Day Trailing',
      minTradingDays: 5,
      profitSplitPct: profitSplit,
      payoutCycleDays: 7,
      leverage: '1:50 FX · 1:20 Indices',
      feeRefundOnFirstPayout: true,
      transparencyGuarantees: [
        'End-of-day trailing drawdown only updates at 17:00 EST close',
        'Min 5 valid trading days (each day >= 0.50% closed profit)',
        'BNB BEP20 crypto payouts processed within max 24 hours (min $100)',
      ],
    };
  }

  // instant
  const dailyLossPct = 3;
  const maxDrawdownPct = 6;
  const isSpecialBonusOffer = accountSize === 5000;
  return {
    mode,
    modeLabel: isSpecialBonusOffer ? 'Instant Zest ($2 Promo · 2027 Offer)' : 'Instant Zest Funded',
    tagline: isSpecialBonusOffer
      ? '🔥 2027 Special Bonus Offer: $5,000 Instant Funded Capital for only $2! No passing phase.'
      : 'No evaluation passing phase — trade live funded capital from day one with 35% consistency rule',
    accountSize,
    feeUsd,
    phase1TargetPct: 0,
    phase1TargetUsd: 0,
    phase2TargetPct: null,
    phase2TargetUsd: null,
    dailyLossPct,
    dailyLossUsd: Math.round((accountSize * dailyLossPct) / 100),
    maxDrawdownPct,
    maxDrawdownUsd: Math.round((accountSize * maxDrawdownPct) / 100),
    drawdownRule: 'Balance Equity Guard',
    minTradingDays: 5,
    profitSplitPct: profitSplit,
    payoutCycleDays: 7,
    leverage: '1:30 FX · 1:15 Indices',
    feeRefundOnFirstPayout: false,
    consistencyRulePct: 35,
    floatingLossRulePct: 1,
    isSpecialBonusOffer,
    transparencyGuarantees: [
      'Direct Funded (No passing phase): Min 5 valid trading days at >= 0.50% profit/day',
      '35% Consistency Rule & strict 1% Floating Loss intraday equity guard',
      isSpecialBonusOffer
        ? 'Special $2 promotional fee valid till 2027 with BNB BEP20 payouts within 24h'
        : 'Direct funded account credentials with BNB BEP20 payouts within 24 hours',
    ],
  };
}

export const MIN_TRADING_DAYS_REQUIRED = 5;
export const VALID_TRADING_DAY_PROFIT_PCT = 0.5;

export interface TradingDaySummary {
  date: string;
  profitUsd: number;
  qualified: boolean;
}

export interface TradingDayStats {
  validTradingDays: number;
  activeDatesCount: number;
  requiredDays: number;
  dailyMinProfitUsd: number;
  days: TradingDaySummary[];
}

export function computeTradingDayStats(
  trades: { executedAtIso: string; pnlUsd: number }[],
  startingBalance: number
): TradingDayStats {
  const safeBalance = Math.max(0, Number(startingBalance) || 0);
  const dailyMinProfitUsd = Math.round(safeBalance * (VALID_TRADING_DAY_PROFIT_PCT / 100) * 100) / 100;
  const byDate = new Map<string, number>();

  for (const t of trades) {
    if (!t || typeof t.executedAtIso !== 'string') continue;
    const dateKey = t.executedAtIso.slice(0, 10);
    if (!dateKey) continue;
    const prev = byDate.get(dateKey) || 0;
    byDate.set(dateKey, prev + (Number(t.pnlUsd) || 0));
  }

  const days: TradingDaySummary[] = Array.from(byDate.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, profitUsd]) => ({
      date,
      profitUsd: Math.round(profitUsd * 100) / 100,
      qualified: dailyMinProfitUsd > 0 && profitUsd >= dailyMinProfitUsd,
    }));

  const validTradingDays = days.filter((d) => d.qualified).length;
  return {
    validTradingDays,
    activeDatesCount: days.length,
    requiredDays: MIN_TRADING_DAYS_REQUIRED,
    dailyMinProfitUsd,
    days,
  };
}

export interface AccountPayoutEligibility {
  isPending: boolean;
  isBreached: boolean;
  isFundedOrPassed: boolean;
  validTradingDays: number;
  requiredDays: number;
  dailyMinProfitUsd: number;
  consistencyPassed: boolean;
  maxSingleTradePnl: number;
  totalPositivePnl: number;
  netProfitUsd: number;
  traderShareUsd: number;
  meetsMinPayoutUsd: boolean;
  eligible: boolean;
  blockingReason: string | null;
}

export function evaluateAccountPayoutEligibility(
  account: {
    mode: ChallengeMode;
    status: string;
    paymentStatus?: string;
    startingBalance: number;
    currentEquity: number;
    profitSplitPct: number;
    activationFeeRequired?: boolean;
    activationFeeStatus?: string;
  },
  trades: { executedAtIso: string; pnlUsd: number }[]
): AccountPayoutEligibility {
  const isPending =
    account.status === 'Pending Approval' || account.paymentStatus === 'pending_approval';
  const isBreached = account.status === 'Breached';
  const isFundedOrPassed =
    !isPending &&
    !isBreached &&
    (account.status === 'Instant Funded' ||
      account.status === 'Target Passed' ||
      Boolean(account.activationFeeRequired && account.activationFeeStatus === 'approved'));

  const dayStats = computeTradingDayStats(trades, account.startingBalance);

  const positiveTrades = trades.filter((t) => (Number(t.pnlUsd) || 0) > 0);
  const totalPositivePnl = positiveTrades.reduce((sum, t) => sum + (Number(t.pnlUsd) || 0), 0);
  const maxSingleTradePnl = positiveTrades.reduce((max, t) => Math.max(max, Number(t.pnlUsd) || 0), 0);
  const consistencyPassed =
    account.mode !== 'instant' ||
    totalPositivePnl <= 0 ||
    maxSingleTradePnl <= totalPositivePnl * 0.35;

  const netProfitUsd = Math.round((account.currentEquity - account.startingBalance) * 100) / 100;
  const traderShareUsd = netProfitUsd > 0 ? Math.round((netProfitUsd * account.profitSplitPct) / 100) : 0;
  const meetsMinPayoutUsd = traderShareUsd >= 100;

  let blockingReason: string | null = null;
  if (isBreached) {
    blockingReason = 'Breached accounts are ineligible for payouts.';
  } else if (isPending) {
    blockingReason = 'Account is pending Admin approval.';
  } else if (!isFundedOrPassed) {
    blockingReason =
      account.mode === 'instant'
        ? 'Account must be Instant Funded to request payouts.'
        : 'Pass your evaluation target first to unlock funded payouts.';
  } else if (dayStats.validTradingDays < dayStats.requiredDays) {
    blockingReason = `Requires ${dayStats.requiredDays} valid trading days (min +0.50% / $${dayStats.dailyMinProfitUsd.toLocaleString('en-US')} profit per day · Current: ${dayStats.validTradingDays}/${dayStats.requiredDays}).`;
  } else if (!consistencyPassed) {
    blockingReason = `Instant 35% consistency rule: single trade ($${maxSingleTradePnl.toLocaleString('en-US')}) exceeds 35% of positive profit ($${totalPositivePnl.toLocaleString('en-US')}).`;
  } else if (netProfitUsd <= 0) {
    blockingReason = 'Account must have positive net profit to request a payout.';
  } else if (!meetsMinPayoutUsd) {
    blockingReason = `Minimum payout is $100 USD (Current profit share: $${traderShareUsd}).`;
  }

  return {
    isPending,
    isBreached,
    isFundedOrPassed,
    validTradingDays: dayStats.validTradingDays,
    requiredDays: dayStats.requiredDays,
    dailyMinProfitUsd: dayStats.dailyMinProfitUsd,
    consistencyPassed,
    maxSingleTradePnl,
    totalPositivePnl,
    netProfitUsd,
    traderShareUsd,
    meetsMinPayoutUsd,
    eligible: blockingReason === null,
    blockingReason,
  };
}

export function simulateChallengeDay(
  spec: ChallengeSpec,
  input: SimulationInput
): SimulationResult {
  const currentEquity = input.startingBalance + input.closedPnl + input.floatingPnl;
  const dailyAllowance = (spec.accountSize * spec.dailyLossPct) / 100;
  const dailyLimitFloor = input.dayStartEquity - dailyAllowance;
  const overallLimitFloor = spec.accountSize - spec.maxDrawdownUsd;

  const dailyBufferRemaining = currentEquity - dailyLimitFloor;
  const overallBufferRemaining = currentEquity - overallLimitFloor;

  const dailyLossUsed = Math.max(0, input.dayStartEquity - currentEquity);
  const overallLossUsed = Math.max(0, spec.accountSize - currentEquity);

  const dailyUsedPct = Math.min(100, Math.round((dailyLossUsed / dailyAllowance) * 100));
  const overallUsedPct = Math.min(
    100,
    Math.round((overallLossUsed / spec.maxDrawdownUsd) * 100)
  );

  const netProfit = currentEquity - spec.accountSize;
  const targetProgressPct =
    spec.phase1TargetUsd > 0
      ? Math.max(0, Math.min(100, Math.round((netProfit / spec.phase1TargetUsd) * 100)))
      : netProfit > 0
        ? 100
        : 0;

  const projectedTraderPayout =
    netProfit > 0 ? Math.round((netProfit * spec.profitSplitPct) / 100) : 0;

  let verdict: SimulationVerdict = 'ACTIVE_SAFE';
  let explanation = `Account equity ($${currentEquity.toLocaleString('en-US')}) sits safely above both your daily loss floor ($${dailyLimitFloor.toLocaleString('en-US')}) and overall drawdown floor ($${overallLimitFloor.toLocaleString('en-US')}).`;

  if (currentEquity <= overallLimitFloor) {
    verdict = 'BREACHED_OVERALL';
    explanation = `Current equity ($${currentEquity.toLocaleString('en-US')}) reached or fell below the ${spec.maxDrawdownPct}% maximum drawdown floor ($${overallLimitFloor.toLocaleString('en-US')}).`;
  } else if (currentEquity <= dailyLimitFloor) {
    verdict = 'BREACHED_DAILY';
    explanation = `Current equity ($${currentEquity.toLocaleString('en-US')}) crossed the ${spec.dailyLossPct}% daily loss limit ($${dailyLimitFloor.toLocaleString('en-US')}) calculated from today's starting equity.`;
  } else if (spec.phase1TargetUsd > 0 && netProfit >= spec.phase1TargetUsd) {
    verdict = 'PASSED';
    explanation = `Net profit of $${netProfit.toLocaleString('en-US')} meets the ${spec.phase1TargetPct}% phase target ($${spec.phase1TargetUsd.toLocaleString('en-US')}) with zero rule breaches.`;
  } else if (dailyUsedPct >= 70 || overallUsedPct >= 70) {
    verdict = 'ACTIVE_CAUTION';
    explanation = `Approaching risk threshold: $${Math.round(Math.min(dailyBufferRemaining, overallBufferRemaining)).toLocaleString('en-US')} remaining before nearest rule limit.`;
  }

  return {
    currentEquity,
    dailyLimitFloor,
    overallLimitFloor,
    dailyBufferRemaining,
    overallBufferRemaining,
    dailyUsedPct,
    overallUsedPct,
    targetProgressPct,
    projectedTraderPayout,
    verdict,
    explanation,
  };
}

export function validateEnrollmentForm(
  name: string,
  email: string
): { valid: boolean; errors: { name?: string; email?: string } } {
  const errors: { name?: string; email?: string } = {};
  const trimmedName = name.trim();
  const trimmedEmail = email.trim();

  if (trimmedName.length < 2) {
    errors.name = 'Enter your full legal name (at least 2 characters).';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = 'Enter a valid email address for account credentials.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}

export const VERIFIED_PAYOUTS: PayoutRecord[] = [
  {
    id: 'po-101',
    traderInitials: 'AR',
    traderName: 'Aarav R.',
    country: 'India',
    mode: 'two-step',
    modeLabel: '2-Step Classic',
    accountSize: 100000,
    payoutUsd: 8420,
    processingTime: '3h 48m',
    method: 'Rise',
    dateLabel: 'Nov 21, 2026',
  },
  {
    id: 'po-102',
    traderInitials: 'ML',
    traderName: 'Mateo L.',
    country: 'Spain',
    mode: 'one-step',
    modeLabel: '1-Step Citrus',
    accountSize: 200000,
    payoutUsd: 14650,
    processingTime: '5h 12m',
    method: 'USDC',
    dateLabel: 'Nov 20, 2026',
  },
  {
    id: 'po-103',
    traderInitials: 'SK',
    traderName: 'Sofia K.',
    country: 'Germany',
    mode: 'instant',
    modeLabel: 'Instant Zest',
    accountSize: 50000,
    payoutUsd: 3180,
    processingTime: '2h 19m',
    method: 'Bank Wire',
    dateLabel: 'Nov 19, 2026',
  },
  {
    id: 'po-104',
    traderInitials: 'DT',
    traderName: 'Daniel T.',
    country: 'United Kingdom',
    mode: 'two-step',
    modeLabel: '2-Step Classic',
    accountSize: 200000,
    payoutUsd: 16290,
    processingTime: '4h 05m',
    method: 'Rise',
    dateLabel: 'Nov 18, 2026',
  },
  {
    id: 'po-105',
    traderInitials: 'YN',
    traderName: 'Yuki N.',
    country: 'Japan',
    mode: 'one-step',
    modeLabel: '1-Step Citrus',
    accountSize: 100000,
    payoutUsd: 7910,
    processingTime: '3h 31m',
    method: 'USDC',
    dateLabel: 'Nov 16, 2026',
  },
  {
    id: 'po-106',
    traderInitials: 'CM',
    traderName: 'Camila M.',
    country: 'Brazil',
    mode: 'instant',
    modeLabel: 'Instant Zest',
    accountSize: 25000,
    payoutUsd: 1840,
    processingTime: '1h 54m',
    method: 'USDC',
    dateLabel: 'Nov 15, 2026',
  },
];
