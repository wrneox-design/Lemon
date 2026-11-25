import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  applyComebackDiscount,
  COMEBACK_CODE,
  COMEBACK_DISCOUNT_PCT,
  computeTradingDayStats,
  getChallengeSpec,
  isComebackPromoCode,
  MIN_TRADING_DAYS_REQUIRED,
  type AccountSize,
  type ChallengeMode,
  type ProfitSplitOption,
  type TradingPlatform,
} from '../utils/challenges.ts';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

export type ActivityEventType =
  | 'register'
  | 'verify_email'
  | 'login'
  | 'purchase_account'
  | 'log_trade'
  | 'account_breached'
  | 'request_payout'
  | 'payout_settled'
  | 'reward_task'
  | 'reward_redeem'
  | 'secret_code'
  | 'kyc_verification';

export type KycStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';

export interface KycSubmission {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  loginId: string;
  documentsSelected: ['PAN Card', 'Aadhaar Card'];
  panNumber: string;
  aadhaarNumber: string;
  panImageUrl: string;
  aadhaarFrontImageUrl: string;
  aadhaarBackImageUrl: string;
  submissionIp: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  submittedAtIso: string;
  reviewedAtIso?: string;
}

export type SocialTaskId = 'follow_x' | 'follow_instagram';

export interface SocialTaskSubmission {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  loginId: string;
  taskId: SocialTaskId;
  taskLabel: string;
  pointsReward: number;
  handle: string;
  proofImageUrl: string;
  submissionIp: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  submittedAtIso: string;
  reviewedAtIso?: string;
}

export type RewardRarity = 'MYTHIC' | 'LEGENDARY' | 'RARE' | 'STORE' | 'BONUS_PTS' | 'COUPON';

export interface RedeemStoreItem {
  id: string;
  title: string;
  mode: ChallengeMode;
  modeLabel: string;
  accountSize: AccountSize;
  profitSplitPct: ProfitSplitOption;
  pointsCost: number;
  badge: string;
  description: string;
}

export interface SecretCodeDrop {
  id: string;
  code: string;
  label: string;
  maxUses: number;
  usedCount: number;
  mythicChancePct: number;
  active: boolean;
  usedByUserIds: string[];
  createdAtIso: string;
}

export interface RedemptionRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  loginId: string;
  source: 'points_store' | 'secret_code';
  storeItemId?: string;
  secretCodeUsed?: string;
  rarityTier: RewardRarity;
  rewardTitle: string;
  rewardKind: 'account' | 'points' | 'coupon';
  couponCode?: string;
  discountPct?: number;
  pointsSpent: number;
  bonusPointsAwarded?: number;
  accountMode?: ChallengeMode;
  accountSize?: AccountSize;
  profitSplitPct?: ProfitSplitOption;
  requestIp: string;
  status: 'pending_approval' | 'approved' | 'rejected';
  issuedAccountNumber?: string;
  createdAtIso: string;
  reviewedAtIso?: string;
}

export interface AdminActivityLog {
  id: string;
  type: ActivityEventType;
  userId: string;
  userEmail: string;
  userName: string;
  loginId: string;
  ip: string;
  userAgent: string;
  summary: string;
  timestampIso: string;
}

export interface UserRecord {
  id: string;
  fullName: string;
  loginId: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  emailVerified: boolean;
  kycStatus?: KycStatus;
  kycRejectionReason?: string;
  rewardPoints?: number;
  createdAtIso: string;
  signupIp?: string;
  lastIp?: string;
  ipHistory?: string[];
  lastUserAgent?: string;
  lastSignInAtIso?: string | null;
  signInCount?: number;
  usedCouponCodes?: string[];
}

export interface PendingVerification {
  userId: string;
  codeHash: string;
  expiresAtMs: number;
  attemptsRemaining: number;
  previewEmailSubject: string;
  previewEmailCode: string;
  createdAtIso: string;
}

export interface DashboardTrade {
  id: string;
  accountId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  lots: number;
  pnlUsd: number;
  notes: string;
  executedAtIso: string;
}

export interface DashboardPayout {
  id: string;
  accountId: string;
  accountNumber: string;
  amountUsd: number;
  method: 'BNB BEP20' | 'Rise' | 'USDC' | 'Bank Wire';
  walletAddress?: string;
  status: 'Processing' | 'Settled';
  certificateId?: string;
  requestedAtIso: string;
  settledAtIso?: string;
}

export interface TraderCertificate {
  id: string;
  type: 'funded_account' | 'payout_verified';
  traderName: string;
  userEmail: string;
  accountNumber: string;
  modeLabel: string;
  accountSize: number;
  amountUsd?: number;
  payoutMethod?: string;
  walletAddress?: string;
  issuedAtIso: string;
  qrUrl: string;
  verificationStatus: 'VERIFIED_AUTHENTIC';
}

export interface DashboardAccount {
  id: string;
  userId: string;
  accountNumber: string;
  terminalServer?: string;
  terminalPassword?: string;
  investorPassword?: string;
  mode: ChallengeMode;
  modeLabel: string;
  accountSize: AccountSize;
  feePaidUsd?: number;
  paymentMethod?: string;
  paymentProofUrl?: string;
  paymentStatus?: 'pending_approval' | 'approved' | 'rejected';
  purchaseIp?: string;
  startingBalance: number;
  currentEquity: number;
  dayStartEquity: number;
  profitSplitPct: ProfitSplitOption;
  dailyLossPct: number;
  dailyLossUsd: number;
  maxDrawdownPct: number;
  maxDrawdownUsd: number;
  targetUsd: number;
  platform: TradingPlatform;
  status: 'Pending Approval' | 'Active Evaluation' | 'Instant Funded' | 'Target Passed' | 'Breached';
  breachReason?: string;
  breachedAtIso?: string;
  promoCodeApplied?: string;
  discountPctApplied?: number;
  activationFeeRequired?: boolean;
  activationFeePaid?: boolean;
  activationFeeProofUrl?: string;
  activationFeeStatus?: 'pending_approval' | 'approved' | 'rejected';
  promotedToAccountId?: string;
  equityCurve: { label: string; equity: number }[];
  createdAtIso: string;
}

export interface StoreDatabase {
  users: UserRecord[];
  verifications: Record<string, PendingVerification>;
  accounts: DashboardAccount[];
  trades: DashboardTrade[];
  payouts: DashboardPayout[];
  activityLogs?: AdminActivityLog[];
  taskSubmissions?: SocialTaskSubmission[];
  redemptionRequests?: RedemptionRequest[];
  secretCodes?: SecretCodeDrop[];
  kycRequests?: KycSubmission[];
  certificates?: TraderCertificate[];
}

export interface PublicUser {
  id: string;
  fullName: string;
  loginId: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  kycStatus: KycStatus;
  kycRejectionReason?: string;
  rewardPoints: number;
  usedCouponCodes?: string[];
  createdAtIso: string;
}

export interface AdminBreachedAccountView {
  id: string;
  accountNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  loginId: string;
  modeLabel: string;
  accountSize: AccountSize;
  startingBalance: number;
  breachedEquity: number;
  lossUsd: number;
  breachReason: string;
  breachedAtIso: string;
  tradeCount: number;
  lastIp: string;
  comebackCodeIssued: string;
}

export interface AdminUserAccountView {
  id: string;
  accountNumber: string;
  terminalServer?: string;
  terminalPassword?: string;
  investorPassword?: string;
  modeLabel: string;
  accountSize: AccountSize;
  feePaidUsd: number;
  paymentMethod?: string;
  paymentProofUrl?: string;
  paymentStatus?: 'pending_approval' | 'approved' | 'rejected';
  purchaseIp: string;
  startingBalance: number;
  currentEquity: number;
  netPnlUsd: number;
  profitSplitPct: ProfitSplitOption;
  platform: TradingPlatform;
  status: DashboardAccount['status'];
  activationFeeRequired?: boolean;
  activationFeePaid?: boolean;
  activationFeeProofUrl?: string;
  activationFeeStatus?: 'pending_approval' | 'approved' | 'rejected';
  tradeCount: number;
  createdAtIso: string;
}

export interface AdminUserRecordView {
  id: string;
  fullName: string;
  loginId: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  kycStatus: KycStatus;
  kycRejectionReason?: string;
  rewardPoints: number;
  signupIp: string;
  lastIp: string;
  ipHistory: string[];
  lastUserAgent: string;
  signInCount: number;
  lastSignInAtIso: string | null;
  createdAtIso: string;
  totalFeePaidUsd: number;
  totalFundedCapitalUsd: number;
  totalPayoutsUsd: number;
  accounts: AdminUserAccountView[];
  payouts: (DashboardPayout & { userEmail: string; userName: string })[];
}

export interface AdminOverviewData {
  adminEmail: string;
  stats: {
    totalUsers: number;
    verifiedUsers: number;
    totalAccounts: number;
    activeOrFundedAccounts: number;
    totalRevenueUsd: number;
    totalFundedCapitalUsd: number;
    totalPayoutsUsd: number;
    processingPayoutCount: number;
    uniqueIpCount: number;
    pendingTaskCount: number;
    pendingRedemptionCount: number;
    pendingKycCount: number;
    breachedCount: number;
    giveawayCodeStats: {
      total: number;
      claimed: number;
      available: number;
    };
  };
  users: AdminUserRecordView[];
  breachedAccounts: AdminBreachedAccountView[];
  activityLogs: AdminActivityLog[];
  taskSubmissions: SocialTaskSubmission[];
  redemptionRequests: RedemptionRequest[];
  secretCodes: SecretCodeDrop[];
  kycRequests: KycSubmission[];
}

interface TokenPayload {
  sub: string;
  purpose: 'session' | 'email-verify';
  exp: number;
}

export const AUTHORIZED_ADMIN_EMAILS = [
  'wrneox@gmail.com',
  'mnamersingh@gmail.com',
  'mrboxwr@gmail.com',
  'admin@lemonfunding.com',
];

export function isAuthorizedAdminEmail(email?: string, configuredAdmin?: string): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  const envAdmin = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const explicitAdmin = (configuredAdmin || '').trim().toLowerCase();
  return (
    AUTHORIZED_ADMIN_EMAILS.includes(e) ||
    (envAdmin !== '' && e === envAdmin) ||
    (explicitAdmin !== '' && e === explicitAdmin)
  );
}

const DEFAULT_ADMIN_EMAIL = 'wrneox@gmail.com';

export const DEMO_TERMINAL_CREDENTIALS = {
  accountNumber: 'LF-100001',
  terminalPassword: 'LemonDemo2026!',
  investorPassword: 'INV-DEMO01',
  terminalServer: 'LemonFunding-Demo',
  email: 'demo@lemonfunding.com',
  loginId: 'lemon_demo',
  fullName: 'Lemon Demo Trader',
} as const;

export function resolveAdminEmail(explicitEmail?: string): string {
  const raw = explicitEmail || process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  return raw.trim().toLowerCase() || DEFAULT_ADMIN_EMAIL;
}

export function normalizeIp(ip?: string): string {
  if (!ip) return 'unknown';
  const cleaned = ip.split(',')[0].trim().replace(/^::ffff:/, '');
  if (cleaned === '::1') return '127.0.0.1';
  return cleaned.slice(0, 64) || 'unknown';
}

export function normalizeUserAgent(ua?: string): string {
  if (!ua) return 'Unknown device';
  return ua.trim().slice(0, 180) || 'Unknown device';
}

export const SOCIAL_TASKS_CATALOG: {
  id: SocialTaskId;
  title: string;
  platformLabel: string;
  actionUrl: string;
  handleDisplay: string;
  pointsReward: number;
  instruction: string;
}[] = [
  {
    id: 'follow_x',
    title: 'Follow LemonFunding on X',
    platformLabel: 'X (Twitter)',
    actionUrl: 'https://x.com/LemonPropFund',
    handleDisplay: '@LemonPropFund',
    pointsReward: 100,
    instruction: 'Follow @LemonPropFund on X and upload a screenshot showing Following.',
  },
  {
    id: 'follow_instagram',
    title: 'Follow LemonFunding on Instagram',
    platformLabel: 'Instagram',
    actionUrl: 'https://www.instagram.com/lemonfunding?knvt=MWR5Y2ltMWdjNGZjNQ==',
    handleDisplay: '@lemonfunding',
    pointsReward: 100,
    instruction: 'Follow @lemonfunding on Instagram and upload a screenshot showing Following.',
  },
];

export const REDEEM_STORE_ITEMS: RedeemStoreItem[] = [
  {
    id: 'redeem-2step-5k',
    title: '$5,000 · 2-Step Classic',
    mode: 'two-step',
    modeLabel: '2-Step Classic Lemon',
    accountSize: 5000,
    profitSplitPct: 80,
    pointsCost: 200,
    badge: '2 Tasks Unlock',
    description: 'Complete both X & Instagram follow tasks (200 pts) to claim this $5K 2-Step account.',
  },
  {
    id: 'redeem-2step-10k',
    title: '$10,000 · 2-Step Classic',
    mode: 'two-step',
    modeLabel: '2-Step Classic Lemon',
    accountSize: 10000,
    profitSplitPct: 80,
    pointsCost: 400,
    badge: '2-Step Tier',
    description: 'Static 10% overall drawdown with 80% profit split.',
  },
  {
    id: 'redeem-1step-5k',
    title: '$5,000 · 1-Step Speed',
    mode: 'one-step',
    modeLabel: '1-Step Citrus Speed',
    accountSize: 5000,
    profitSplitPct: 80,
    pointsCost: 300,
    badge: '1-Step Single Phase',
    description: 'Single-phase 10% profit target evaluation.',
  },
  {
    id: 'redeem-1step-10k',
    title: '$10,000 · 1-Step Speed',
    mode: 'one-step',
    modeLabel: '1-Step Citrus Speed',
    accountSize: 10000,
    profitSplitPct: 80,
    pointsCost: 550,
    badge: '1-Step Pro',
    description: 'Fast single-step evaluation for 10K prop capital.',
  },
  {
    id: 'redeem-instant-2500',
    title: '$2,500 · Instant Zest Funded',
    mode: 'instant',
    modeLabel: 'Zero (Instant Zest)',
    accountSize: 2500,
    profitSplitPct: 80,
    pointsCost: 500,
    badge: 'Instant Funded',
    description: 'Zero evaluation targets — funded immediately upon Admin approval.',
  },
];

export function sanitizeUser(u: UserRecord, adminEmail: string): PublicUser {
  return {
    id: u.id,
    fullName: u.fullName,
    loginId: u.loginId,
    email: u.email,
    emailVerified: u.emailVerified,
    isAdmin: Boolean(u.emailVerified && isAuthorizedAdminEmail(u.email, adminEmail)),
    kycStatus: u.kycStatus || 'not_submitted',
    kycRejectionReason: u.kycRejectionReason,
    rewardPoints: typeof u.rewardPoints === 'number' ? u.rewardPoints : 0,
    usedCouponCodes: Array.isArray(u.usedCouponCodes) ? u.usedCouponCodes : [],
    createdAtIso: u.createdAtIso,
  };
}

export function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const [local, domain] = parts;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export function isValidLoginId(loginId: string): boolean {
  return /^[a-zA-Z0-9_]{3,24}$/.test(loginId);
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const usedSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, usedSalt, 64).toString('hex');
  return { hash: derived, salt: usedSalt };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function hashOtpCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export function signToken(
  payload: TokenPayload,
  secret: string
): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyToken(
  token: string,
  secret: string,
  expectedPurpose: 'session' | 'email-verify'
): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (parsed.purpose !== expectedPurpose) return null;
    if (typeof parsed.exp !== 'number' || Date.now() > parsed.exp) return null;
    if (typeof parsed.sub !== 'string' || !parsed.sub) return null;
    return parsed;
  } catch {
    return null;
  }
}

export class AuthStore {
  private db: StoreDatabase;
  private persistPath: string | null;
  private secret: string;
  private adminEmail: string;

  constructor(options?: { persistPath?: string | null; secret?: string; adminEmail?: string }) {
    this.persistPath = options?.persistPath ?? null;
    this.secret = this.resolveOrPersistSecret(options?.secret);
    this.adminEmail = resolveAdminEmail(options?.adminEmail);

    this.db = this.loadInitialDb();
    this.ensureGiveawaySecretCodes();
  }

  private resolveOrPersistSecret(explicitSecret?: string): string {
    if (explicitSecret) return explicitSecret;
    if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
    if (this.persistPath) {
      const secretFile = `${this.persistPath}.secret`;
      try {
        if (fs.existsSync(secretFile)) {
          const existing = fs.readFileSync(secretFile, 'utf8').trim();
          if (existing.length >= 32) return existing;
        }
        const dir = path.dirname(secretFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const generated = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(secretFile, generated, 'utf8');
        return generated;
      } catch {
        // Fallback to ephemeral secret
      }
    }
    return crypto.randomBytes(32).toString('hex');
  }

  private loadInitialDb(): StoreDatabase {
    if (this.persistPath && fs.existsSync(this.persistPath)) {
      try {
        const raw = fs.readFileSync(this.persistPath, 'utf8');
        const parsed = JSON.parse(raw) as StoreDatabase;
        const isObj = (v: unknown): v is Record<string, unknown> =>
          Boolean(v) && typeof v === 'object';
        if (Array.isArray(parsed.users) && Array.isArray(parsed.accounts)) {
          const accounts = (parsed.accounts.filter(isObj) as DashboardAccount[]).map((a) => {
            if (!a.terminalServer) a.terminalServer = 'LemonFunding-Live';
            if (!a.terminalPassword) {
              const seed = crypto.createHash('md5').update(a.id || a.accountNumber).digest('hex').slice(0, 6).toUpperCase();
              a.terminalPassword = `LT-${seed}!`;
            }
            if (!a.investorPassword) {
              const invSeed = crypto.createHash('md5').update((a.id || a.accountNumber) + 'inv').digest('hex').slice(0, 6).toUpperCase();
              a.investorPassword = `INV-${invSeed}`;
            }
            return a;
          });
          return {
            users: parsed.users.filter(isObj) as UserRecord[],
            verifications: isObj(parsed.verifications) ? parsed.verifications : {},
            accounts,
            trades: Array.isArray(parsed.trades)
              ? (parsed.trades.filter(isObj) as DashboardTrade[])
              : [],
            payouts: Array.isArray(parsed.payouts)
              ? (parsed.payouts.filter(isObj) as DashboardPayout[])
              : [],
            activityLogs: Array.isArray(parsed.activityLogs)
              ? (parsed.activityLogs.filter(isObj) as AdminActivityLog[])
              : [],
            taskSubmissions: Array.isArray(parsed.taskSubmissions)
              ? (parsed.taskSubmissions.filter(isObj) as SocialTaskSubmission[])
              : [],
            redemptionRequests: Array.isArray(parsed.redemptionRequests)
              ? (parsed.redemptionRequests.filter(isObj) as RedemptionRequest[])
              : [],
            secretCodes: Array.isArray(parsed.secretCodes)
              ? (parsed.secretCodes.filter(isObj) as SecretCodeDrop[])
              : [],
            kycRequests: Array.isArray(parsed.kycRequests)
              ? (parsed.kycRequests.filter(isObj) as KycSubmission[])
              : [],
            certificates: Array.isArray(parsed.certificates)
              ? (parsed.certificates.filter(isObj) as TraderCertificate[])
              : [],
          };
        }
      } catch {
        // Fallback to clean store
      }
    }
    return {
      users: [],
      verifications: {},
      accounts: [],
      trades: [],
      payouts: [],
      activityLogs: [],
      taskSubmissions: [],
      redemptionRequests: [],
      secretCodes: [],
      kycRequests: [],
      certificates: [],
    };
  }

  private save(): void {
    if (!this.persistPath) return;
    const dir = path.dirname(this.persistPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmp = `${this.persistPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2), 'utf8');
    fs.renameSync(tmp, this.persistPath);
  }

  flushToDisk(): void {
    this.save();
  }

  private recordIpAndDevice(user: UserRecord, ctx?: RequestContext, countSignIn = false): {
    ip: string;
    userAgent: string;
  } {
    const ip = normalizeIp(ctx?.ip);
    const userAgent = normalizeUserAgent(ctx?.userAgent);
    if (!user.signupIp || user.signupIp === 'unknown') {
      user.signupIp = ip;
    }
    if (ip !== 'unknown' || !user.lastIp) {
      user.lastIp = ip;
    }
    if (userAgent !== 'unknown' || !user.lastUserAgent) {
      user.lastUserAgent = userAgent;
    }
    const existingHistory = Array.isArray(user.ipHistory) ? user.ipHistory : [];
    if (ip !== 'unknown' && !existingHistory.includes(ip)) {
      user.ipHistory = [ip, ...existingHistory].slice(0, 20);
    } else if (!user.ipHistory) {
      user.ipHistory = ip !== 'unknown' ? [ip] : [];
    }
    if (countSignIn) {
      user.signInCount = (user.signInCount ?? 0) + 1;
      user.lastSignInAtIso = new Date().toISOString();
    }
    return { ip, userAgent };
  }

  private appendActivity(
    type: ActivityEventType,
    user: UserRecord,
    summary: string,
    ctx?: RequestContext
  ): void {
    if (!Array.isArray(this.db.activityLogs)) {
      this.db.activityLogs = [];
    }
    const entry: AdminActivityLog = {
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      type,
      userId: user.id,
      userEmail: user.email,
      userName: user.fullName,
      loginId: user.loginId,
      ip: normalizeIp(ctx?.ip),
      userAgent: normalizeUserAgent(ctx?.userAgent),
      summary,
      timestampIso: new Date().toISOString(),
    };
    this.db.activityLogs.unshift(entry);
    if (this.db.activityLogs.length > 500) {
      this.db.activityLogs = this.db.activityLogs.slice(0, 500);
    }
  }

  registerUser(
    input: {
      fullName: string;
      loginId: string;
      email: string;
      password: string;
    },
    ctx?: RequestContext
  ):
    | {
        ok: true;
        user: PublicUser;
        verificationToken: string;
        emailMasked: string;
        otpCodeForMailer: string;
      }
    | { ok: false; status: number; error: string } {
    const fullName = input.fullName.trim();
    const loginId = input.loginId.trim();
    const email = input.email.trim().toLowerCase();
    const password = input.password;

    if (fullName.length < 2 || fullName.length > 80) {
      return { ok: false, status: 400, error: 'Full name must be between 2 and 80 characters.' };
    }
    if (!isValidLoginId(loginId)) {
      return {
        ok: false,
        status: 400,
        error: 'Login ID must be 3–24 characters using letters, numbers, or underscores.',
      };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, status: 400, error: 'Please enter a valid email address.' };
    }
    if (password.length < 8) {
      return { ok: false, status: 400, error: 'Password must be at least 8 characters.' };
    }

    const dupLogin = this.db.users.find(
      (u) => u.loginId.toLowerCase() === loginId.toLowerCase()
    );
    if (dupLogin) {
      return { ok: false, status: 409, error: 'That Login ID is already taken.' };
    }

    const dupEmail = this.db.users.find((u) => u.email === email);
    if (dupEmail) {
      return { ok: false, status: 409, error: 'An account with this email already exists.' };
    }

    const { hash, salt } = hashPassword(password);
    const ip = normalizeIp(ctx?.ip);
    const userAgent = normalizeUserAgent(ctx?.userAgent);
    const user: UserRecord = {
      id: `usr_${crypto.randomUUID().slice(0, 8)}`,
      fullName,
      loginId,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      emailVerified: false,
      createdAtIso: new Date().toISOString(),
      signupIp: ip,
      lastIp: ip,
      ipHistory: ip !== 'unknown' ? [ip] : [],
      lastUserAgent: userAgent,
      lastSignInAtIso: null,
      signInCount: 0,
    };

    this.db.users.push(user);
    this.appendActivity(
      'register',
      user,
      `Registered @${user.loginId} (${user.email})`,
      ctx
    );
    const { verificationToken, otpCode } = this.createVerificationForUser(user.id);
    this.save();

    return {
      ok: true,
      user: sanitizeUser(user, this.adminEmail),
      verificationToken,
      emailMasked: maskEmail(email),
      otpCodeForMailer: otpCode,
    };
  }

  private createVerificationForUser(userId: string): {
    verificationToken: string;
    otpCode: string;
  } {
    const otpCode = String(crypto.randomInt(100000, 1000000));
    this.db.verifications[userId] = {
      userId,
      codeHash: hashOtpCode(otpCode),
      expiresAtMs: Date.now() + 10 * 60 * 1000,
      attemptsRemaining: 5,
      previewEmailSubject: 'Verify your LemonFunding Trader ID',
      previewEmailCode: otpCode,
      createdAtIso: new Date().toISOString(),
    };
    const verificationToken = signToken(
      {
        sub: userId,
        purpose: 'email-verify',
        exp: Date.now() + 15 * 60 * 1000,
      },
      this.secret
    );
    return { verificationToken, otpCode };
  }

  getPreviewInboxMessage(verificationToken: string):
    | {
        ok: true;
        toEmail: string;
        loginId: string;
        subject: string;
        code: string;
        expiresInMinutes: number;
      }
    | { ok: false; status: number; error: string } {
    const payload = verifyToken(verificationToken, this.secret, 'email-verify');
    if (!payload) {
      return { ok: false, status: 401, error: 'Verification session expired. Please sign in again.' };
    }
    const user = this.db.users.find((u) => u.id === payload.sub);
    const pending = this.db.verifications[payload.sub];
    if (!user || !pending) {
      return { ok: false, status: 404, error: 'No pending verification email found.' };
    }
    const remainingMs = Math.max(0, pending.expiresAtMs - Date.now());
    return {
      ok: true,
      toEmail: user.email,
      loginId: user.loginId,
      subject: pending.previewEmailSubject,
      code: pending.previewEmailCode,
      expiresInMinutes: Math.max(1, Math.ceil(remainingMs / 60000)),
    };
  }

  resendVerificationCode(verificationToken: string):
    | {
        ok: true;
        verificationToken: string;
        toEmail: string;
        loginId: string;
        emailMasked: string;
        otpCodeForMailer: string;
      }
    | { ok: false; status: number; error: string } {
    const payload = verifyToken(verificationToken, this.secret, 'email-verify');
    if (!payload) {
      return { ok: false, status: 401, error: 'Verification session expired.' };
    }
    const user = this.db.users.find((u) => u.id === payload.sub);
    if (!user) {
      return { ok: false, status: 404, error: 'Account not found.' };
    }
    const fresh = this.createVerificationForUser(user.id);
    this.save();
    return {
      ok: true,
      verificationToken: fresh.verificationToken,
      toEmail: user.email,
      loginId: user.loginId,
      emailMasked: maskEmail(user.email),
      otpCodeForMailer: fresh.otpCode,
    };
  }

  verifyEmailCode(
    verificationToken: string,
    codeInput: string,
    ctx?: RequestContext
  ):
    | { ok: true; accessToken: string; user: PublicUser }
    | { ok: false; status: number; error: string } {
    const payload = verifyToken(verificationToken, this.secret, 'email-verify');
    if (!payload) {
      return { ok: false, status: 401, error: 'Verification session expired. Please request a new code.' };
    }
    const user = this.db.users.find((u) => u.id === payload.sub);
    const pending = this.db.verifications[payload.sub];
    if (!user || !pending) {
      return { ok: false, status: 404, error: 'Verification record not found.' };
    }
    if (Date.now() > pending.expiresAtMs) {
      return { ok: false, status: 400, error: 'Verification code expired. Click Resend Code.' };
    }
    if (pending.attemptsRemaining <= 0) {
      return { ok: false, status: 429, error: 'Too many invalid attempts. Click Resend Code.' };
    }

    const cleanCode = codeInput.trim();
    const submittedHash = hashOtpCode(cleanCode);
    const a = Buffer.from(submittedHash, 'hex');
    const b = Buffer.from(pending.codeHash, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      pending.attemptsRemaining -= 1;
      this.save();
      return {
        ok: false,
        status: 400,
        error: `Invalid verification code. ${pending.attemptsRemaining} attempt(s) left.`,
      };
    }

    user.emailVerified = true;
    delete this.db.verifications[user.id];
    this.recordIpAndDevice(user, ctx, true);
    this.appendActivity(
      'verify_email',
      user,
      `Verified email & activated session for @${user.loginId}`,
      ctx
    );
    this.save();

    const accessToken = signToken(
      {
        sub: user.id,
        purpose: 'session',
        exp: Date.now() + 24 * 60 * 60 * 1000,
      },
      this.secret
    );

    return {
      ok: true,
      accessToken,
      user: sanitizeUser(user, this.adminEmail),
    };
  }

  loginUser(
    identifier: string,
    password: string,
    ctx?: RequestContext
  ):
    | { ok: true; accessToken: string; user: PublicUser }
    | {
        ok: false;
        status: number;
        error: string;
        requiresVerification?: boolean;
        verificationToken?: string;
        toEmail?: string;
        loginId?: string;
        emailMasked?: string;
        otpCodeForMailer?: string;
      } {
    const cleanId = identifier.trim().toLowerCase();
    const user = this.db.users.find(
      (u) => u.email === cleanId || u.loginId.toLowerCase() === cleanId
    );
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      return { ok: false, status: 401, error: 'Invalid Login ID / email or password.' };
    }

    if (!user.emailVerified) {
      this.recordIpAndDevice(user, ctx, false);
      const fresh = this.createVerificationForUser(user.id);
      this.save();
      return {
        ok: false,
        status: 403,
        error: 'Please verify your email address before entering the dashboard.',
        requiresVerification: true,
        verificationToken: fresh.verificationToken,
        toEmail: user.email,
        loginId: user.loginId,
        emailMasked: maskEmail(user.email),
        otpCodeForMailer: fresh.otpCode,
      };
    }

    this.recordIpAndDevice(user, ctx, true);
    this.appendActivity('login', user, `Signed in as @${user.loginId}`, ctx);
    this.save();

    const accessToken = signToken(
      {
        sub: user.id,
        purpose: 'session',
        exp: Date.now() + 24 * 60 * 60 * 1000,
      },
      this.secret
    );

    return {
      ok: true,
      accessToken,
      user: sanitizeUser(user, this.adminEmail),
    };
  }

  ensureDemoTerminalAccount(): DashboardAccount {
    let demoUser = this.db.users.find(
      (u) => u.email === DEMO_TERMINAL_CREDENTIALS.email
    );

    if (!demoUser) {
      const { hash, salt } = hashPassword(DEMO_TERMINAL_CREDENTIALS.terminalPassword);
      demoUser = {
        id: 'user-demo-lf-100001',
        fullName: DEMO_TERMINAL_CREDENTIALS.fullName,
        loginId: DEMO_TERMINAL_CREDENTIALS.loginId,
        email: DEMO_TERMINAL_CREDENTIALS.email,
        passwordHash: hash,
        passwordSalt: salt,
        emailVerified: true,
        createdAtIso: new Date().toISOString(),
        signupIp: '127.0.0.1',
        lastIp: '127.0.0.1',
        ipHistory: ['127.0.0.1'],
        lastUserAgent: 'LemonTerminal Demo Seed',
        lastSignInAtIso: null,
        signInCount: 0,
      };
      this.db.users.push(demoUser);
    } else if (!demoUser.emailVerified) {
      demoUser.emailVerified = true;
    }

    let demoAccount = this.db.accounts.find(
      (a) =>
        a.accountNumber.toLowerCase() ===
        DEMO_TERMINAL_CREDENTIALS.accountNumber.toLowerCase()
    );

    if (!demoAccount) {
      const spec = getChallengeSpec('two-step', 100000, 80);
      demoAccount = {
        id: 'demo-lf-100001',
        userId: demoUser.id,
        accountNumber: DEMO_TERMINAL_CREDENTIALS.accountNumber,
        terminalServer: DEMO_TERMINAL_CREDENTIALS.terminalServer,
        terminalPassword: DEMO_TERMINAL_CREDENTIALS.terminalPassword,
        investorPassword: DEMO_TERMINAL_CREDENTIALS.investorPassword,
        mode: 'two-step',
        modeLabel: spec.modeLabel,
        accountSize: 100000,
        feePaidUsd: 0,
        purchaseIp: '127.0.0.1',
        startingBalance: 100000,
        currentEquity: 100000,
        dayStartEquity: 100000,
        profitSplitPct: 80,
        dailyLossPct: spec.dailyLossPct,
        dailyLossUsd: spec.dailyLossUsd,
        maxDrawdownPct: spec.maxDrawdownPct,
        maxDrawdownUsd: spec.maxDrawdownUsd,
        targetUsd: spec.phase1TargetUsd,
        platform: 'Lemon Terminal',
        status: 'Active Evaluation',
        equityCurve: [{ label: 'Start', equity: 100000 }],
        createdAtIso: new Date().toISOString(),
      };
      this.db.accounts.push(demoAccount);
    } else {
      demoAccount.userId = demoUser.id;
      demoAccount.terminalServer = DEMO_TERMINAL_CREDENTIALS.terminalServer;
      demoAccount.terminalPassword = DEMO_TERMINAL_CREDENTIALS.terminalPassword;
      demoAccount.investorPassword = DEMO_TERMINAL_CREDENTIALS.investorPassword;
      if (demoAccount.status === 'Breached') {
        demoAccount.status = 'Active Evaluation';
        demoAccount.currentEquity = 100000;
        demoAccount.dayStartEquity = 100000;
        demoAccount.breachReason = undefined;
        demoAccount.breachedAtIso = undefined;
      }
    }

    this.save();
    return demoAccount;
  }

  loginTerminalAccount(
    accountNumber: string,
    terminalPassword: string
  ):
    | {
        ok: true;
        accessToken: string;
        user: PublicUser;
        account: DashboardAccount;
        trades: DashboardTrade[];
      }
    | { ok: false; status: number; error: string } {
    const cleanNum = accountNumber.trim().replace(/^#/, '').toLowerCase();
    const cleanPass = terminalPassword.trim();
    if (!cleanNum || !cleanPass) {
      return {
        ok: false,
        status: 400,
        error: 'Enter both Account Login ID (e.g. LF-100001) and Trader Password.',
      };
    }

    const account = this.db.accounts.find(
      (a) => a.accountNumber.toLowerCase() === cleanNum
    );
    if (!account) {
      return {
        ok: false,
        status: 404,
        error: 'Account Login ID not found on LemonFunding server.',
      };
    }

    if ((account.terminalPassword || '') !== cleanPass) {
      return {
        ok: false,
        status: 401,
        error: 'Invalid Trader Password for this account.',
      };
    }

    const owner = this.db.users.find((u) => u.id === account.userId);
    if (!owner) {
      return { ok: false, status: 404, error: 'Account owner profile not found.' };
    }

    const accessToken = signToken(
      {
        sub: owner.id,
        purpose: 'session',
        exp: Date.now() + 24 * 60 * 60 * 1000,
      },
      this.secret
    );

    const trades = this.db.trades
      .filter((t) => t.accountId === account.id)
      .sort((a, b) => b.executedAtIso.localeCompare(a.executedAtIso));

    return {
      ok: true,
      accessToken,
      user: sanitizeUser(owner, this.adminEmail),
      account,
      trades,
    };
  }

  authenticateSession(authHeader?: string): UserRecord | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice('Bearer '.length).trim();
    const payload = verifyToken(token, this.secret, 'session');
    if (!payload) return null;
    return this.db.users.find((u) => u.id === payload.sub && u.emailVerified) ?? null;
  }

  authenticateAdmin(authHeader?: string):
    | { ok: true; user: UserRecord }
    | { ok: false; status: number; error: string } {
    const user = this.authenticateSession(authHeader);
    if (!user) {
      return { ok: false, status: 401, error: 'Sign in with a verified owner account.' };
    }
    if (!isAuthorizedAdminEmail(user.email, this.adminEmail)) {
      return { ok: false, status: 403, error: 'Owner admin access is restricted.' };
    }
    return { ok: true, user };
  }

  ensureAdminSession(): { accessToken: string; user: PublicUser } {
    const primaryAdminEmail = 'mnamersingh@gmail.com';
    let adminUser = this.db.users.find(
      (u) => u.email.toLowerCase() === primaryAdminEmail.toLowerCase()
    );
    if (!adminUser) {
      const { hash, salt } = hashPassword('AdminLemon2026!');
      adminUser = {
        id: 'usr_owner_admin',
        fullName: 'LemonFunding Owner Admin',
        loginId: 'lemon_owner',
        email: primaryAdminEmail,
        passwordHash: hash,
        passwordSalt: salt,
        emailVerified: true,
        createdAtIso: new Date().toISOString(),
        signupIp: '127.0.0.1',
        lastIp: '127.0.0.1',
        ipHistory: ['127.0.0.1'],
        lastUserAgent: 'Owner Admin System',
        lastSignInAtIso: new Date().toISOString(),
        signInCount: 1,
      };
      this.db.users.push(adminUser);
    } else if (!adminUser.emailVerified) {
      adminUser.emailVerified = true;
    }

    const accessToken = signToken(
      {
        sub: adminUser.id,
        purpose: 'session',
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      },
      this.secret
    );

    this.save();
    return {
      accessToken,
      user: sanitizeUser(adminUser, this.adminEmail),
    };
  }

  isUserComebackEligible(userId: string): boolean {
    return this.db.accounts.some(
      (a) => a.userId === userId && a.status === 'Breached'
    );
  }

  validatePromoCodeForUser(
    userId: string,
    promoCode?: string
  ): { ok: true; appliedCode: string | null; discountPct: number } | { ok: false; error: string } {
    const raw = (promoCode || '').trim().toUpperCase();
    if (!raw) {
      return { ok: true, appliedCode: null, discountPct: 0 };
    }
    const user = this.db.users.find((u) => u.id === userId);
    const usedList = new Set<string>(
      Array.isArray(user?.usedCouponCodes) ? user.usedCouponCodes.map((c) => c.toUpperCase()) : []
    );
    for (const acct of this.db.accounts) {
      if (acct.userId === userId && acct.promoCodeApplied && acct.paymentStatus !== 'rejected') {
        usedList.add(acct.promoCodeApplied.toUpperCase());
      }
    }

    const GIVEAWAY_PROMO_CODES: Record<string, number> = {
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

    if (GIVEAWAY_PROMO_CODES[raw]) {
      const hasUsedAnyGiveawayCoupon = Array.from(usedList).some((c) =>
        Boolean(GIVEAWAY_PROMO_CODES[c])
      );
      if (usedList.has(raw) || hasUsedAnyGiveawayCoupon) {
        return {
          ok: false,
          error: `Coupon "${raw}" cannot be applied. Giveaway discount coupons work only 1 time per account.`,
        };
      }
      return {
        ok: true,
        appliedCode: raw,
        discountPct: GIVEAWAY_PROMO_CODES[raw],
      };
    }
    if (isComebackPromoCode(raw)) {
      if (!this.isUserComebackEligible(userId)) {
        return {
          ok: false,
          error: 'COMEBACK40 (40% off) unlocks automatically once you have a breached account.',
        };
      }
      if (usedList.has(COMEBACK_CODE)) {
        const breachCount = this.db.accounts.filter(
          (a) => a.userId === userId && a.status === 'Breached'
        ).length;
        const comebackUses = this.db.accounts.filter(
          (a) =>
            a.userId === userId &&
            a.promoCodeApplied?.toUpperCase() === COMEBACK_CODE &&
            a.paymentStatus !== 'rejected'
        ).length;
        if (comebackUses >= breachCount) {
          return {
            ok: false,
            error: 'COMEBACK40 has already been used for your breached account.',
          };
        }
      }
      return {
        ok: true,
        appliedCode: COMEBACK_CODE,
        discountPct: COMEBACK_DISCOUNT_PCT,
      };
    }
    return { ok: false, error: `Invalid promo code "${raw}". Enter a valid giveaway discount coupon or COMEBACK40.` };
  }

  getDashboardForUser(userId: string): {
    user: PublicUser;
    accounts: DashboardAccount[];
    trades: DashboardTrade[];
    payouts: DashboardPayout[];
    comebackEligible: boolean;
    comebackCode: string | null;
    comebackDiscountPct: number;
  } | null {
    const user = this.db.users.find((u) => u.id === userId);
    if (!user) return null;
    const accounts = this.db.accounts.filter((a) => a.userId === userId);
    const accountIds = new Set(accounts.map((a) => a.id));
    const trades = this.db.trades
      .filter((t) => accountIds.has(t.accountId))
      .sort((a, b) => b.executedAtIso.localeCompare(a.executedAtIso));
    const payouts = this.db.payouts
      .filter((p) => accountIds.has(p.accountId))
      .sort((a, b) => b.requestedAtIso.localeCompare(a.requestedAtIso));
    const comebackEligible = accounts.some((a) => a.status === 'Breached');

    return {
      user: sanitizeUser(user, this.adminEmail),
      accounts,
      trades,
      payouts,
      comebackEligible,
      comebackCode: comebackEligible ? COMEBACK_CODE : null,
      comebackDiscountPct: comebackEligible ? COMEBACK_DISCOUNT_PCT : 0,
    };
  }

  createChallengeAccount(
    userId: string,
    input: {
      mode: ChallengeMode;
      accountSize: AccountSize;
      profitSplit: ProfitSplitOption;
      platform: TradingPlatform;
      promoCode?: string;
      paymentMethod?: string;
      paymentProofUrl?: string;
    },
    ctx?: RequestContext
  ):
    | { ok: true; account: DashboardAccount }
    | { ok: false; status: number; error: string } {
    const user = this.db.users.find((u) => u.id === userId && u.emailVerified);
    if (!user) {
      return { ok: false, status: 404, error: 'Verified user not found.' };
    }
    const existingNonBreached = this.db.accounts.find(
      (a) => a.userId === userId && a.status !== 'Breached'
    );
    if (existingNonBreached) {
      return {
        ok: false,
        status: 400,
        error: 'You already have an active or pending account. You can only take one account at a time.',
      };
    }

    const spec = getChallengeSpec(input.mode, input.accountSize, input.profitSplit);
    const promoCheck = this.validatePromoCodeForUser(userId, input.promoCode);
    let finalFeeUsd = spec.feeUsd;
    let promoApplied: string | undefined;
    let discountPctApplied: number | undefined;
    if (promoCheck.ok && promoCheck.appliedCode) {
      promoApplied = promoCheck.appliedCode;
      discountPctApplied = promoCheck.discountPct;
      finalFeeUsd = Math.max(1, Math.round(spec.feeUsd * (1 - promoCheck.discountPct / 100)));
    }

    const purchaseIp = normalizeIp(ctx?.ip);
    const seed = crypto.randomBytes(3).toString('hex').toUpperCase();
    const invSeed = crypto.randomBytes(3).toString('hex').toUpperCase();
    const account: DashboardAccount = {
      id: `acct_${crypto.randomUUID().slice(0, 8)}`,
      userId,
      accountNumber: `LF-${crypto.randomInt(100000, 999999)}`,
      terminalServer: 'LemonFunding-Live',
      terminalPassword: `LT-${seed}!`,
      investorPassword: `INV-${invSeed}`,
      mode: spec.mode,
      modeLabel: spec.modeLabel,
      accountSize: spec.accountSize,
      feePaidUsd: finalFeeUsd,
      paymentMethod: input.paymentMethod || 'Crypto (BNB BEP20)',
      paymentProofUrl: input.paymentProofUrl,
      paymentStatus: 'pending_approval',
      promoCodeApplied: promoApplied,
      discountPctApplied: discountPctApplied,
      purchaseIp,
      startingBalance: spec.accountSize,
      currentEquity: spec.accountSize,
      dayStartEquity: spec.accountSize,
      profitSplitPct: spec.profitSplitPct,
      dailyLossPct: spec.dailyLossPct,
      dailyLossUsd: spec.dailyLossUsd,
      maxDrawdownPct: spec.maxDrawdownPct,
      maxDrawdownUsd: spec.maxDrawdownUsd,
      targetUsd: spec.phase1TargetUsd,
      platform: input.platform || 'Lemon Terminal',
      status: 'Pending Approval',
      equityCurve: [{ label: 'Start', equity: spec.accountSize }],
      createdAtIso: new Date().toISOString(),
    };
    this.db.accounts.unshift(account);
    const owner = this.db.users.find((u) => u.id === userId);
    if (owner) {
      if (promoApplied) {
        if (!Array.isArray(owner.usedCouponCodes)) {
          owner.usedCouponCodes = [];
        }
        if (!owner.usedCouponCodes.includes(promoApplied.toUpperCase())) {
          owner.usedCouponCodes.push(promoApplied.toUpperCase());
        }
      }
      this.recordIpAndDevice(owner, ctx, false);
      const promoNote = promoApplied
        ? ` (${promoApplied} -${discountPctApplied ?? 0}%)`
        : '';
      this.appendActivity(
        'purchase_account',
        owner,
        `Submitted challenge purchase ${account.accountNumber} (${spec.modeLabel} $${spec.accountSize.toLocaleString('en-US')} · Fee $${finalFeeUsd}${promoNote}) [Pending Approval]`,
        ctx
      );
    }
    this.save();
    return { ok: true, account };
  }

  private ensureAccountCertificate(
    account: DashboardAccount,
    owner?: UserRecord
  ): TraderCertificate {
    const resolvedOwner = owner || this.db.users.find((u) => u.id === account.userId);
    const certId = `LF-CERT-PASS-${account.accountNumber}`;
    if (!Array.isArray(this.db.certificates)) {
      this.db.certificates = [];
    }
    const existing = this.db.certificates.find(
      (c) => c.id.toUpperCase() === certId.toUpperCase()
    );
    if (existing) {
      if (resolvedOwner?.fullName && existing.traderName !== resolvedOwner.fullName) {
        existing.traderName = resolvedOwner.fullName;
      }
      return existing;
    }
    const created: TraderCertificate = {
      id: certId,
      type: 'funded_account',
      traderName: resolvedOwner?.fullName || 'Verified Trader',
      userEmail: resolvedOwner?.email || '',
      accountNumber: account.accountNumber,
      modeLabel: account.modeLabel,
      accountSize: account.accountSize,
      issuedAtIso: new Date().toISOString(),
      qrUrl: `/?verify_cert=${encodeURIComponent(certId)}`,
      verificationStatus: 'VERIFIED_AUTHENTIC',
    };
    this.db.certificates.unshift(created);
    return created;
  }

  approveAccount(
    requestingUserId: string,
    accountId: string,
    action: 'approve' | 'reject',
    ctx?: RequestContext
  ):
    | { ok: true; account: DashboardAccount }
    | { ok: false; status: number; error: string } {
    const caller = this.db.users.find((u) => u.id === requestingUserId && u.emailVerified);
    if (!caller || !isAuthorizedAdminEmail(caller.email, this.adminEmail)) {
      return { ok: false, status: 403, error: 'Owner admin access is restricted.' };
    }
    const account = this.db.accounts.find((a) => a.id === accountId);
    if (!account) {
      return { ok: false, status: 404, error: 'Challenge account not found.' };
    }
    if (action === 'approve') {
      account.paymentStatus = 'approved';
      account.status = account.mode === 'instant' ? 'Instant Funded' : 'Active Evaluation';
      if (account.status === 'Instant Funded') {
        this.ensureAccountCertificate(account);
      }
      this.appendActivity(
        'purchase_account',
        caller,
        `Approved payment & activated account ${account.accountNumber} (${account.modeLabel})`,
        ctx
      );
    } else {
      account.paymentStatus = 'rejected';
      account.status = 'Breached';
      account.breachReason = 'Payment proof rejected by admin.';
      this.appendActivity(
        'purchase_account',
        caller,
        `Rejected payment proof for account ${account.accountNumber}`,
        ctx
      );
    }
    this.save();
    return { ok: true, account };
  }

  submitAccountActivationFee(
    userId: string,
    accountId: string,
    input: { paymentMethod?: string; paymentProofUrl?: string },
    ctx?: RequestContext
  ):
    | { ok: true; account: DashboardAccount }
    | { ok: false; status: number; error: string } {
    const user = this.db.users.find((u) => u.id === userId && u.emailVerified);
    if (!user) {
      return { ok: false, status: 404, error: 'Verified user not found.' };
    }
    const account = this.db.accounts.find((a) => a.id === accountId && a.userId === userId);
    if (!account) {
      return { ok: false, status: 404, error: 'Challenge account not found.' };
    }
    if (account.status !== 'Target Passed') {
      return { ok: false, status: 400, error: 'Account has not passed its profit target yet.' };
    }
    account.activationFeePaid = false;
    account.activationFeeStatus = 'pending_approval';
    account.activationFeeProofUrl = input.paymentProofUrl;
    this.appendActivity(
      'purchase_account',
      user,
      `Submitted $5 activation fee payment proof for passed account ${account.accountNumber} [Pending Approval]`,
      ctx
    );
    this.save();
    return { ok: true, account };
  }

  reviewAccountActivation(
    requestingUserId: string,
    accountId: string,
    action: 'approve' | 'reject',
    ctx?: RequestContext
  ):
    | { ok: true; account: DashboardAccount }
    | { ok: false; status: number; error: string } {
    const caller = this.db.users.find((u) => u.id === requestingUserId && u.emailVerified);
    if (!caller || !isAuthorizedAdminEmail(caller.email, this.adminEmail)) {
      return { ok: false, status: 403, error: 'Owner admin access is restricted.' };
    }
    const account = this.db.accounts.find((a) => a.id === accountId);
    if (!account) {
      return { ok: false, status: 404, error: 'Challenge account not found.' };
    }
    if (action === 'approve') {
      account.activationFeePaid = true;
      account.activationFeeStatus = 'approved';
      account.status = 'Instant Funded';
      this.ensureAccountCertificate(account);
      this.appendActivity(
        'purchase_account',
        caller,
        `Approved $5 activation fee & fully funded account ${account.accountNumber}`,
        ctx
      );
    } else {
      account.activationFeePaid = false;
      account.activationFeeStatus = 'rejected';
      this.appendActivity(
        'purchase_account',
        caller,
        `Rejected $5 activation fee proof for account ${account.accountNumber}`,
        ctx
      );
    }
    this.save();
    return { ok: true, account };
  }

  logTrade(
    userId: string,
    input: {
      accountId: string;
      symbol: string;
      side: 'BUY' | 'SELL';
      lots: number;
      pnlUsd: number;
      notes: string;
      executedAtIso?: string;
    },
    ctx?: RequestContext
  ):
    | { ok: true; account: DashboardAccount; trade: DashboardTrade }
    | { ok: false; status: number; error: string } {
    const owner = this.db.users.find((u) => u.id === userId);
    if (
      owner &&
      owner.email !== DEMO_TERMINAL_CREDENTIALS.email &&
      (owner.kycStatus || 'not_submitted') !== 'approved'
    ) {
      return {
        ok: false,
        status: 403,
        error:
          'KYC verification required before trading. Upload your PAN Card & Aadhaar (Front & Back) for Admin approval.',
      };
    }

    const account = this.db.accounts.find(
      (a) => a.id === input.accountId && a.userId === userId
    );
    if (!account) {
      return { ok: false, status: 404, error: 'Trading account not found.' };
    }
    if (account.status === 'Pending Approval') {
      return { ok: false, status: 400, error: 'This account is pending Admin approval before trading.' };
    }
    if (account.status === 'Breached') {
      return { ok: false, status: 400, error: 'This account is breached and cannot log new trades.' };
    }

    const symbol = input.symbol.trim().toUpperCase();
    if (!symbol || symbol.length > 16) {
      return { ok: false, status: 400, error: 'Enter a valid instrument symbol.' };
    }
    if (!Number.isFinite(input.lots) || input.lots <= 0 || input.lots > 100) {
      return { ok: false, status: 400, error: 'Lots must be between 0.01 and 100.' };
    }
    if (!Number.isFinite(input.pnlUsd) || Math.abs(input.pnlUsd) > account.startingBalance) {
      return { ok: false, status: 400, error: 'Invalid P&L amount.' };
    }

    const resolvedTimestamp =
      typeof input.executedAtIso === 'string' && !Number.isNaN(Date.parse(input.executedAtIso))
        ? input.executedAtIso
        : new Date().toISOString();

    const trade: DashboardTrade = {
      id: `tr_${crypto.randomUUID().slice(0, 8)}`,
      accountId: account.id,
      symbol,
      side: input.side === 'SELL' ? 'SELL' : 'BUY',
      lots: Math.round(input.lots * 100) / 100,
      pnlUsd: Math.round(input.pnlUsd),
      notes: input.notes.trim().slice(0, 120) || 'Manual trade execution',
      executedAtIso: resolvedTimestamp,
    };

    account.currentEquity = Math.round(account.currentEquity + trade.pnlUsd);
    account.equityCurve.push({
      label: `T${account.equityCurve.length}`,
      equity: account.currentEquity,
    });

    const overallFloor = account.startingBalance - account.maxDrawdownUsd;
    const dailyFloor = account.dayStartEquity - account.dailyLossUsd;
    if (account.currentEquity <= overallFloor) {
      account.status = 'Breached';
      account.breachReason = `Max drawdown (${account.maxDrawdownPct}%) limit hit at $${account.currentEquity.toLocaleString('en-US')} equity.`;
      account.breachedAtIso = new Date().toISOString();
    } else if (account.currentEquity <= dailyFloor) {
      account.status = 'Breached';
      account.breachReason = `Daily drawdown (${account.dailyLossPct}%) limit hit at $${account.currentEquity.toLocaleString('en-US')} equity.`;
      account.breachedAtIso = new Date().toISOString();
    } else if (
      account.mode === 'instant' &&
      account.dayStartEquity - account.currentEquity >= account.startingBalance * 0.01
    ) {
      account.status = 'Breached';
      account.breachReason = `Instant 1% floating loss rule breached ($${(account.startingBalance * 0.01).toLocaleString('en-US')}) at $${account.currentEquity.toLocaleString('en-US')} equity.`;
      account.breachedAtIso = new Date().toISOString();
    } else if (
      account.mode !== 'instant' &&
      account.targetUsd > 0 &&
      account.currentEquity - account.startingBalance >= account.targetUsd
    ) {
      account.status = 'Target Passed';
      const cert = this.ensureAccountCertificate(account, owner);
      const certId = cert.id;

      // Auto-promote to Next Stage (2-Step Phase 2) or Qualified Funded account!
      if (!account.promotedToAccountId) {
        const isPhase1OfTwoStep =
          account.mode === 'two-step' && !account.modeLabel.includes('Phase 2');
        const nextSpec = getChallengeSpec(
          account.mode,
          account.accountSize,
          account.profitSplitPct
        );
        const seed = crypto.randomBytes(3).toString('hex').toUpperCase();
        const invSeed = crypto.randomBytes(3).toString('hex').toUpperCase();
        const promotedId = `acct_${crypto.randomUUID().slice(0, 8)}`;
        const promotedAccount: DashboardAccount = {
          id: promotedId,
          userId: account.userId,
          accountNumber: `LF-${crypto.randomInt(100000, 999999)}`,
          terminalServer: 'LemonFunding-Live',
          terminalPassword: `LT-${seed}!`,
          investorPassword: `INV-${invSeed}`,
          mode: account.mode,
          modeLabel: isPhase1OfTwoStep
            ? '2-Step Phase 2 Challenge'
            : account.mode === 'two-step'
              ? '2-Stage Funded Account'
              : '1-Step Funded Account',
          accountSize: account.accountSize,
          feePaidUsd: 0,
          paymentMethod: 'Evaluation Pass Promotion',
          paymentStatus: 'approved',
          purchaseIp: account.purchaseIp,
          startingBalance: account.accountSize,
          currentEquity: account.accountSize,
          dayStartEquity: account.accountSize,
          profitSplitPct: account.profitSplitPct,
          dailyLossPct: account.dailyLossPct,
          dailyLossUsd: account.dailyLossUsd,
          maxDrawdownPct: account.maxDrawdownPct,
          maxDrawdownUsd: account.maxDrawdownUsd,
          targetUsd: isPhase1OfTwoStep
            ? nextSpec.phase2TargetUsd || Math.round(account.accountSize * 0.05)
            : 0,
          platform: account.platform,
          status: isPhase1OfTwoStep ? 'Active Evaluation' : 'Instant Funded',
          equityCurve: [{ label: 'Start', equity: account.accountSize }],
          createdAtIso: new Date().toISOString(),
        };
        account.promotedToAccountId = promotedId;
        this.db.accounts.unshift(promotedAccount);
        if (promotedAccount.status === 'Instant Funded') {
          this.ensureAccountCertificate(promotedAccount, owner);
        }
        if (owner) {
          this.appendActivity(
            'purchase_account',
            owner,
            `Auto-promoted passed account ${account.accountNumber} -> ${promotedAccount.accountNumber} (${promotedAccount.modeLabel}) + Certificate ${certId}`,
            ctx
          );
        }
      }
    }

    this.db.trades.unshift(trade);
    if (owner) {
      this.appendActivity(
        'log_trade',
        owner,
        `Logged ${trade.side} ${trade.symbol} (${trade.pnlUsd >= 0 ? '+' : ''}$${trade.pnlUsd}) on ${account.accountNumber}`,
        ctx
      );
      if (account.status === 'Breached') {
        this.appendActivity(
          'account_breached',
          owner,
          `Account ${account.accountNumber} breached (${account.breachReason}) — COMEBACK40 unlocked`,
          ctx
        );
      }
    }
    this.save();
    return { ok: true, account, trade };
  }

  breachAccountFromLiveEquity(
    userId: string,
    input: {
      accountId: string;
      floatingPnlUsd: number;
      liquidatedPositions?: {
        symbol: string;
        side: 'BUY' | 'SELL';
        lots: number;
        pnlUsd: number;
        notes?: string;
      }[];
    },
    ctx?: RequestContext
  ):
    | {
        ok: true;
        account: DashboardAccount;
        comebackCode: string;
        comebackDiscountPct: number;
      }
    | { ok: false; status: number; error: string } {
    const account = this.db.accounts.find(
      (a) => a.id === input.accountId && a.userId === userId
    );
    if (!account) {
      return { ok: false, status: 404, error: 'Trading account not found.' };
    }
    if (account.status === 'Breached') {
      return {
        ok: true,
        account,
        comebackCode: COMEBACK_CODE,
        comebackDiscountPct: COMEBACK_DISCOUNT_PCT,
      };
    }

    const floatingRounded = Number.isFinite(input.floatingPnlUsd)
      ? Math.round(input.floatingPnlUsd)
      : 0;
    const projectedEquity = Math.max(0, account.currentEquity + floatingRounded);
    const overallFloor = account.startingBalance - account.maxDrawdownUsd;
    const dailyFloor = account.dayStartEquity - account.dailyLossUsd;
    const instantFloatingBreached =
      account.mode === 'instant' &&
      (floatingRounded <= -account.startingBalance * 0.01 ||
        account.dayStartEquity - projectedEquity >= account.startingBalance * 0.01);

    if (projectedEquity > dailyFloor && projectedEquity > overallFloor && !instantFloatingBreached) {
      return {
        ok: false,
        status: 400,
        error: 'Live equity has not crossed the daily, max, or 1% instant floating loss floor.',
      };
    }

    const positions = Array.isArray(input.liquidatedPositions)
      ? input.liquidatedPositions.slice(0, 20)
      : [];
    for (const pos of positions) {
      const symbol = String(pos.symbol || 'XAU/USD').trim().toUpperCase().slice(0, 16) || 'XAU/USD';
      const lots = Number.isFinite(pos.lots) && pos.lots > 0 ? Math.round(pos.lots * 100) / 100 : 0.1;
      const pnlUsd = Number.isFinite(pos.pnlUsd) ? Math.round(pos.pnlUsd) : 0;
      const trade: DashboardTrade = {
        id: `tr_${crypto.randomUUID().slice(0, 8)}`,
        accountId: account.id,
        symbol,
        side: pos.side === 'SELL' ? 'SELL' : 'BUY',
        lots,
        pnlUsd,
        notes: (pos.notes || 'Auto-liquidated on drawdown breach').slice(0, 120),
        executedAtIso: new Date().toISOString(),
      };
      this.db.trades.unshift(trade);
    }

    account.currentEquity = projectedEquity;
    account.equityCurve.push({
      label: 'Breach',
      equity: account.currentEquity,
    });
    account.status = 'Breached';
    account.breachReason = instantFloatingBreached
      ? `Instant 1% floating loss rule breached ($${(account.startingBalance * 0.01).toLocaleString('en-US')}) at $${projectedEquity.toLocaleString('en-US')} live equity.`
      : projectedEquity <= overallFloor
        ? `Max drawdown (${account.maxDrawdownPct}%) limit hit at $${projectedEquity.toLocaleString('en-US')} live equity.`
        : `Daily drawdown (${account.dailyLossPct}%) limit hit at $${projectedEquity.toLocaleString('en-US')} live equity.`;
    account.breachedAtIso = new Date().toISOString();

    const owner = this.db.users.find((u) => u.id === userId);
    if (owner) {
      this.appendActivity(
        'account_breached',
        owner,
        `Account ${account.accountNumber} auto-breached (${account.breachReason}) — COMEBACK40 unlocked`,
        ctx
      );
    }
    this.save();
    return {
      ok: true,
      account,
      comebackCode: COMEBACK_CODE,
      comebackDiscountPct: COMEBACK_DISCOUNT_PCT,
    };
  }

  requestPayout(
    userId: string,
    input: {
      accountId: string;
      method?: 'BNB BEP20' | 'Rise' | 'USDC' | 'Bank Wire';
      walletAddress?: string;
    },
    ctx?: RequestContext
  ):
    | { ok: true; payout: DashboardPayout; account: DashboardAccount; certificate: TraderCertificate }
    | { ok: false; status: number; error: string } {
    const account = this.db.accounts.find(
      (a) => a.id === input.accountId && a.userId === userId
    );
    if (!account) {
      return { ok: false, status: 404, error: 'Account not found.' };
    }
    if (account.status === 'Breached') {
      return { ok: false, status: 400, error: 'Breached accounts are ineligible for payouts.' };
    }

    const isFundedOrPassed =
      account.status === 'Instant Funded' ||
      account.status === 'Target Passed' ||
      (account.activationFeeRequired && account.activationFeeStatus === 'approved');
    if (!isFundedOrPassed && account.status === 'Active Evaluation') {
      return {
        ok: false,
        status: 400,
        error:
          'Only qualified funded accounts (Target Passed / Instant Funded) can request payouts. Complete your evaluation target first.',
      };
    }

    // Include any trades executed just prior + current trade history on this account
    const accountTrades = (this.db.trades || []).filter((t) => t.accountId === account.id);
    const dayStats = computeTradingDayStats(accountTrades, account.startingBalance);
    if (dayStats.validTradingDays < MIN_TRADING_DAYS_REQUIRED) {
      return {
        ok: false,
        status: 400,
        error: `Account requires minimum ${MIN_TRADING_DAYS_REQUIRED} valid trading days (at least 0.50% = +$${dayStats.dailyMinProfitUsd.toLocaleString('en-US')} closed profit per day). Current: ${dayStats.validTradingDays}/${MIN_TRADING_DAYS_REQUIRED} valid day${dayStats.validTradingDays === 1 ? '' : 's'}.`,
      };
    }

    if (account.mode === 'instant') {
      const positiveTrades = accountTrades.filter((t) => t.pnlUsd > 0);
      const totalPositivePnl = positiveTrades.reduce((sum, t) => sum + t.pnlUsd, 0);
      const maxSingleTradePnl = positiveTrades.reduce((max, t) => Math.max(max, t.pnlUsd), 0);
      if (totalPositivePnl > 0 && maxSingleTradePnl > totalPositivePnl * 0.35) {
        return {
          ok: false,
          status: 400,
          error: `Instant account 35% consistency rule breached: A single trade profit ($${maxSingleTradePnl.toLocaleString(
            'en-US'
          )}) exceeded 35% of total positive profit ($${totalPositivePnl.toLocaleString(
            'en-US'
          )}). Keep trade sizes consistent.`,
        };
      }
    }

    const netProfit = account.currentEquity - account.startingBalance;
    if (netProfit <= 0) {
      return { ok: false, status: 400, error: 'Account must have positive net profit to request a payout.' };
    }

    const traderShare = Math.round((netProfit * account.profitSplitPct) / 100);
    if (traderShare < 100) {
      return {
        ok: false,
        status: 400,
        error: `Minimum payout request amount is $100 USD (Your current profit share is $${traderShare}).`,
      };
    }

    const payoutMethod = input.method || 'BNB BEP20';
    const payoutId = `po_${crypto.randomUUID().slice(0, 8)}`;
    const certId = `LF-CERT-PAY-${payoutId.toUpperCase()}`;

    const payout: DashboardPayout = {
      id: payoutId,
      accountId: account.id,
      accountNumber: account.accountNumber,
      amountUsd: traderShare,
      method: payoutMethod,
      walletAddress: input.walletAddress?.trim() || undefined,
      status: 'Processing',
      certificateId: certId,
      requestedAtIso: new Date().toISOString(),
    };

    const owner = this.db.users.find((u) => u.id === userId);
    const certificate: TraderCertificate = {
      id: certId,
      type: 'payout_verified',
      traderName: owner?.fullName || 'Verified Trader',
      userEmail: owner?.email || '',
      accountNumber: account.accountNumber,
      modeLabel: account.modeLabel,
      accountSize: account.accountSize,
      amountUsd: traderShare,
      payoutMethod,
      walletAddress: payout.walletAddress,
      issuedAtIso: new Date().toISOString(),
      qrUrl: `/?verify_payout=${encodeURIComponent(payoutId)}`,
      verificationStatus: 'VERIFIED_AUTHENTIC',
    };

    if (!Array.isArray(this.db.certificates)) {
      this.db.certificates = [];
    }
    this.db.certificates.unshift(certificate);

    // Reset current equity back to starting balance after profit withdrawal
    account.currentEquity = account.startingBalance;
    account.dayStartEquity = account.startingBalance;
    account.equityCurve.push({
      label: 'Payout',
      equity: account.currentEquity,
    });

    this.db.payouts.unshift(payout);
    if (owner) {
      this.appendActivity(
        'request_payout',
        owner,
        `Requested $${payout.amountUsd.toLocaleString('en-US')} payout via ${payout.method} on ${account.accountNumber} [Certificate: ${certId}]`,
        ctx
      );
    }
    this.save();
    return { ok: true, payout, account, certificate };
  }

  getAdminOverview(requestingUserId: string):
    | { ok: true; data: AdminOverviewData }
    | { ok: false; status: number; error: string } {
    const caller = this.db.users.find((u) => u.id === requestingUserId && u.emailVerified);
    if (!caller || !isAuthorizedAdminEmail(caller.email, this.adminEmail)) {
      return { ok: false, status: 403, error: 'Owner admin access is restricted.' };
    }

    const uniqueIps = new Set<string>();
    let totalRevenueUsd = 0;
    let totalFundedCapitalUsd = 0;
    let totalPayoutsUsd = 0;
    let processingPayoutCount = 0;
    let activeOrFundedAccounts = 0;

    const users: AdminUserRecordView[] = [...this.db.users]
      .sort((a, b) => {
        const aTime = a.lastSignInAtIso || a.createdAtIso;
        const bTime = b.lastSignInAtIso || b.createdAtIso;
        return bTime.localeCompare(aTime);
      })
      .map((u) => {
        const signupIp = u.signupIp || 'unknown';
        const lastIp = u.lastIp || signupIp;
        const ipHistory = Array.isArray(u.ipHistory)
          ? u.ipHistory
          : lastIp !== 'unknown'
            ? [lastIp]
            : [];
        for (const ip of ipHistory) {
          if (ip && ip !== 'unknown') uniqueIps.add(ip);
        }

        const userAccounts = this.db.accounts.filter((a) => a.userId === u.id);
        const accountViews: AdminUserAccountView[] = userAccounts.map((a) => {
          const fallbackSpec = getChallengeSpec(a.mode, a.accountSize, a.profitSplitPct);
          const feePaidUsd = typeof a.feePaidUsd === 'number' ? a.feePaidUsd : fallbackSpec.feeUsd;
          totalRevenueUsd += feePaidUsd;
          totalFundedCapitalUsd += a.accountSize;
          if (a.status !== 'Breached' && a.status !== 'Pending Approval') {
            activeOrFundedAccounts += 1;
          }
          const tradeCount = this.db.trades.filter((t) => t.accountId === a.id).length;
          return {
            id: a.id,
            accountNumber: a.accountNumber,
            terminalServer: a.terminalServer,
            terminalPassword: a.terminalPassword,
            investorPassword: a.investorPassword,
            modeLabel: a.modeLabel,
            accountSize: a.accountSize,
            feePaidUsd,
            paymentMethod: a.paymentMethod,
            paymentProofUrl: a.paymentProofUrl,
            paymentStatus: a.paymentStatus,
            purchaseIp: a.purchaseIp || lastIp,
            startingBalance: a.startingBalance,
            currentEquity: a.currentEquity,
            netPnlUsd: a.currentEquity - a.startingBalance,
            profitSplitPct: a.profitSplitPct,
            platform: a.platform,
            status: a.status,
            tradeCount,
            createdAtIso: a.createdAtIso,
          };
        });

        const accountIdSet = new Set(userAccounts.map((a) => a.id));
        const userPayouts = this.db.payouts
          .filter((p) => accountIdSet.has(p.accountId))
          .map((p) => {
            totalPayoutsUsd += p.amountUsd;
            if (p.status === 'Processing') {
              processingPayoutCount += 1;
            }
            return {
              ...p,
              userEmail: u.email,
              userName: u.fullName,
            };
          });

        const totalFeePaidUsd = accountViews.reduce((sum, a) => sum + a.feePaidUsd, 0);
        const totalUserCapital = accountViews.reduce((sum, a) => sum + a.accountSize, 0);
        const totalUserPayouts = userPayouts.reduce((sum, p) => sum + p.amountUsd, 0);

        return {
          id: u.id,
          fullName: u.fullName,
          loginId: u.loginId,
          email: u.email,
          emailVerified: u.emailVerified,
          isAdmin: Boolean(u.emailVerified && isAuthorizedAdminEmail(u.email, this.adminEmail)),
          kycStatus: u.kycStatus || 'not_submitted',
          kycRejectionReason: u.kycRejectionReason,
          rewardPoints: typeof u.rewardPoints === 'number' ? u.rewardPoints : 0,
          signupIp,
          lastIp,
          ipHistory,
          lastUserAgent: u.lastUserAgent || 'Unknown device',
          signInCount: u.signInCount ?? (u.emailVerified ? 1 : 0),
          lastSignInAtIso: u.lastSignInAtIso ?? null,
          createdAtIso: u.createdAtIso,
          totalFeePaidUsd,
          totalFundedCapitalUsd: totalUserCapital,
          totalPayoutsUsd: totalUserPayouts,
          accounts: accountViews,
          payouts: userPayouts,
        };
      });

    const taskSubmissions = Array.isArray(this.db.taskSubmissions) ? this.db.taskSubmissions : [];
    const redemptionRequests = Array.isArray(this.db.redemptionRequests)
      ? this.db.redemptionRequests
      : [];
    const secretCodes = Array.isArray(this.db.secretCodes) ? this.db.secretCodes : [];
    const kycRequests = Array.isArray(this.db.kycRequests) ? this.db.kycRequests : [];

    const breachedAccounts: AdminBreachedAccountView[] = this.db.accounts
      .filter((a) => a.status === 'Breached')
      .map((a) => {
        const u = this.db.users.find((user) => user.id === a.userId);
        const lossUsd = Math.max(0, a.startingBalance - a.currentEquity);
        const tradeCount = (this.db.trades || []).filter((t) => t.accountId === a.id).length;
        return {
          id: a.id,
          accountNumber: a.accountNumber,
          userId: a.userId,
          userName: u?.fullName || 'Trader',
          userEmail: u?.email || 'unknown',
          loginId: u?.loginId || 'trader',
          modeLabel: a.modeLabel,
          accountSize: a.accountSize,
          startingBalance: a.startingBalance,
          breachedEquity: a.currentEquity,
          lossUsd,
          breachReason: a.breachReason || 'Drawdown limit hit',
          breachedAtIso: a.breachedAtIso || a.createdAtIso,
          tradeCount,
          lastIp: u?.lastIp || a.purchaseIp || 'unknown',
          comebackCodeIssued: COMEBACK_CODE,
        };
      })
      .sort((a, b) => b.breachedAtIso.localeCompare(a.breachedAtIso));

    const giveawayList = secretCodes.filter((c) => c.code.startsWith('LMN-WIN-'));
    const giveawayClaimed = giveawayList.filter((c) => c.usedCount > 0).length;

    return {
      ok: true,
      data: {
        adminEmail: this.adminEmail,
        stats: {
          totalUsers: users.length,
          verifiedUsers: users.filter((u) => u.emailVerified).length,
          totalAccounts: this.db.accounts.length,
          activeOrFundedAccounts,
          totalRevenueUsd,
          totalFundedCapitalUsd,
          totalPayoutsUsd,
          processingPayoutCount,
          uniqueIpCount: uniqueIps.size,
          pendingTaskCount: taskSubmissions.filter((t) => t.status === 'pending').length,
          pendingRedemptionCount: redemptionRequests.filter((r) => r.status === 'pending_approval').length,
          pendingKycCount: kycRequests.filter((k) => k.status === 'pending').length,
          breachedCount: breachedAccounts.length,
          giveawayCodeStats: {
            total: giveawayList.length,
            claimed: giveawayClaimed,
            available: giveawayList.length - giveawayClaimed,
          },
        },
        users,
        breachedAccounts,
        activityLogs: Array.isArray(this.db.activityLogs) ? this.db.activityLogs : [],
        taskSubmissions,
        redemptionRequests,
        secretCodes,
        kycRequests,
      },
    };
  }

  getRewardsForUser(userId: string) {
    const user = this.db.users.find((u) => u.id === userId);
    if (!user) return null;

    const submissions = (this.db.taskSubmissions || []).filter((s) => s.userId === userId);
    const tasks = SOCIAL_TASKS_CATALOG.map((task) => {
      const latest = submissions.find((s) => s.taskId === task.id) || null;
      return {
        ...task,
        submission: latest,
      };
    });

    const myRedemptions = (this.db.redemptionRequests || [])
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));

    const activeSecretDropCount = (this.db.secretCodes || []).filter(
      (c) => c.active && c.usedCount < c.maxUses
    ).length;

    return {
      rewardPoints: typeof user.rewardPoints === 'number' ? user.rewardPoints : 0,
      tasks,
      storeItems: REDEEM_STORE_ITEMS,
      myRedemptions,
      activeSecretDropCount,
    };
  }

  submitSocialTask(
    userId: string,
    input: { taskId: SocialTaskId; handle: string; proofImageUrl: string },
    ctx?: RequestContext
  ):
    | { ok: true; submission: SocialTaskSubmission }
    | { ok: false; status: number; error: string } {
    const user = this.db.users.find((u) => u.id === userId && u.emailVerified);
    if (!user) {
      return { ok: false, status: 404, error: 'Verified user not found.' };
    }
    const taskMeta = SOCIAL_TASKS_CATALOG.find((t) => t.id === input.taskId);
    if (!taskMeta) {
      return { ok: false, status: 400, error: 'Unknown reward task selected.' };
    }
    const handle = String(input.handle || '').trim().slice(0, 60);
    if (handle.length < 2) {
      return { ok: false, status: 400, error: 'Enter your X or Instagram username/handle.' };
    }
    const proof = String(input.proofImageUrl || '').trim();
    if (!proof.startsWith('data:image/')) {
      return { ok: false, status: 400, error: 'Attach a valid follow screenshot proof image.' };
    }

    if (!Array.isArray(this.db.taskSubmissions)) {
      this.db.taskSubmissions = [];
    }

    const existingActive = this.db.taskSubmissions.find(
      (s) => s.userId === userId && s.taskId === input.taskId && s.status !== 'rejected'
    );
    if (existingActive) {
      return {
        ok: false,
        status: 409,
        error:
          existingActive.status === 'approved'
            ? 'You have already earned points for this task.'
            : 'Your screenshot proof for this task is already pending Admin approval.',
      };
    }

    const normalizedHandle = handle.replace(/^@+/, '').toLowerCase();
    const handleUsedByOther = this.db.taskSubmissions.find(
      (s) =>
        s.userId !== userId &&
        s.taskId === input.taskId &&
        s.status !== 'rejected' &&
        s.handle.trim().replace(/^@+/, '').toLowerCase() === normalizedHandle
    );
    if (handleUsedByOther) {
      return {
        ok: false,
        status: 409,
        error: `This ${taskMeta.platformLabel} username has already been submitted on another account.`,
      };
    }

    const submission: SocialTaskSubmission = {
      id: `tsk_${crypto.randomUUID().slice(0, 8)}`,
      userId: user.id,
      userName: user.fullName,
      userEmail: user.email,
      loginId: user.loginId,
      taskId: taskMeta.id,
      taskLabel: taskMeta.title,
      pointsReward: taskMeta.pointsReward,
      handle,
      proofImageUrl: proof,
      submissionIp: normalizeIp(ctx?.ip),
      status: 'pending',
      submittedAtIso: new Date().toISOString(),
    };

    this.db.taskSubmissions.unshift(submission);
    this.appendActivity(
      'reward_task',
      user,
      `Submitted ${taskMeta.platformLabel} follow proof (${handle}) for +${taskMeta.pointsReward} pts`,
      ctx
    );
    this.save();
    return { ok: true, submission };
  }

  redeemStoreItem(
    userId: string,
    storeItemId: string,
    ctx?: RequestContext
  ):
    | { ok: true; request: RedemptionRequest; remainingPoints: number }
    | { ok: false; status: number; error: string } {
    const user = this.db.users.find((u) => u.id === userId && u.emailVerified);
    if (!user) {
      return { ok: false, status: 404, error: 'Verified user not found.' };
    }
    const item = REDEEM_STORE_ITEMS.find((i) => i.id === storeItemId);
    if (!item) {
      return { ok: false, status: 404, error: 'Store reward item not found.' };
    }

    if (!Array.isArray(this.db.redemptionRequests)) {
      this.db.redemptionRequests = [];
    }

    const existingStoreClaim = this.db.redemptionRequests.find(
      (r) => r.userId === userId && r.source === 'points_store' && r.status !== 'rejected'
    );
    if (existingStoreClaim) {
      return {
        ok: false,
        status: 409,
        error:
          'You have already claimed a Points Store reward on this account. Store rewards can only be redeemed once.',
      };
    }

    const currentPts = typeof user.rewardPoints === 'number' ? user.rewardPoints : 0;
    if (currentPts < item.pointsCost) {
      return {
        ok: false,
        status: 400,
        error: `Need ${item.pointsCost} pts to claim ${item.title}. You currently have ${currentPts} pts.`,
      };
    }

    user.rewardPoints = currentPts - item.pointsCost;

    const reqItem: RedemptionRequest = {
      id: `rdm_${crypto.randomUUID().slice(0, 8)}`,
      userId: user.id,
      userEmail: user.email,
      userName: user.fullName,
      loginId: user.loginId,
      source: 'points_store',
      storeItemId: item.id,
      rarityTier: 'STORE',
      rewardTitle: item.title,
      rewardKind: 'account',
      pointsSpent: item.pointsCost,
      accountMode: item.mode,
      accountSize: item.accountSize,
      profitSplitPct: item.profitSplitPct,
      requestIp: normalizeIp(ctx?.ip),
      status: 'pending_approval',
      createdAtIso: new Date().toISOString(),
    };

    this.db.redemptionRequests.unshift(reqItem);
    this.appendActivity(
      'reward_redeem',
      user,
      `Redeemed ${item.pointsCost} pts for ${item.title} [Pending Admin Approval]`,
      ctx
    );
    this.save();
    return { ok: true, request: reqItem, remainingPoints: user.rewardPoints };
  }

  redeemSecretCode(
    userId: string,
    rawCode: string,
    ctx?: RequestContext
  ):
    | { ok: true; request: RedemptionRequest; rollPct: number }
    | { ok: false; status: number; error: string } {
    const user = this.db.users.find((u) => u.id === userId && u.emailVerified);
    if (!user) {
      return { ok: false, status: 404, error: 'Verified user not found.' };
    }
    const cleanCode = String(rawCode || '').trim().toUpperCase();
    if (!cleanCode) {
      return { ok: false, status: 400, error: 'Enter a Secret Drop Code.' };
    }

    const existingSecretClaim = (this.db.redemptionRequests || []).find(
      (r) => r.userId === userId && r.source === 'secret_code'
    );
    if (existingSecretClaim) {
      return {
        ok: false,
        status: 409,
        error:
          'You have already claimed a Secret Drop Code reward on this account. Each trader can claim only once.',
      };
    }

    const drops = Array.isArray(this.db.secretCodes) ? this.db.secretCodes : [];
    const drop = drops.find((d) => d.code.toUpperCase() === cleanCode);
    if (!drop) {
      return { ok: false, status: 404, error: 'Invalid secret code. Check the latest Admin drop.' };
    }
    if (!drop.active) {
      return { ok: false, status: 400, error: 'This secret code drop has ended.' };
    }
    if (drop.usedCount >= drop.maxUses) {
      return { ok: false, status: 400, error: 'All slots for this secret code drop have been claimed.' };
    }
    if (Array.isArray(drop.usedByUserIds) && drop.usedByUserIds.includes(userId)) {
      return { ok: false, status: 409, error: 'You have already rolled this secret code drop.' };
    }

    drop.usedCount += 1;
    if (!Array.isArray(drop.usedByUserIds)) {
      drop.usedByUserIds = [];
    }
    drop.usedByUserIds.push(userId);

    // Cryptographic luck draw (0.00 to 99.99)
    const rollPct = crypto.randomInt(0, 10000) / 100;

    let rarityTier: RewardRarity = 'COUPON';
    let rewardTitle = '30% OFF Flash Coupon: LEMON30';
    let rewardKind: 'account' | 'points' | 'coupon' = 'coupon';
    let couponCode: string | undefined = 'LEMON30';
    let discountPct: number | undefined = 30;
    let accountMode: ChallengeMode | undefined;
    let accountSize: AccountSize | undefined;
    let profitSplitPct: ProfitSplitOption | undefined;
    let bonusPointsAwarded: number | undefined = 50;

    // 5% Low Chance: Accounts (Mythic, Legendary, Rare, Starter)
    // 95% High Chance: High & Low Discount Coupons + Bonus Points
    if (rollPct < 0.6) {
      rarityTier = 'MYTHIC';
      rewardTitle = 'MYTHIC $50,000 · 2-Step Classic Account';
      rewardKind = 'account';
      accountMode = 'two-step';
      accountSize = 50000;
      profitSplitPct = 90;
      bonusPointsAwarded = undefined;
      couponCode = undefined;
      discountPct = undefined;
    } else if (rollPct < 1.8) {
      rarityTier = 'LEGENDARY';
      rewardTitle = 'LEGENDARY $25,000 · 2-Step Classic Account';
      rewardKind = 'account';
      accountMode = 'two-step';
      accountSize = 25000;
      profitSplitPct = 80;
      bonusPointsAwarded = undefined;
      couponCode = undefined;
      discountPct = undefined;
    } else if (rollPct < 3.2) {
      rarityTier = 'RARE';
      rewardTitle = 'RARE $10,000 · 1-Step Speed Account';
      rewardKind = 'account';
      accountMode = 'one-step';
      accountSize = 10000;
      profitSplitPct = 80;
      bonusPointsAwarded = undefined;
      couponCode = undefined;
      discountPct = undefined;
    } else if (rollPct < 5.0) {
      rarityTier = 'RARE';
      rewardTitle = 'STARTER $5,000 · 2-Step Classic Account';
      rewardKind = 'account';
      accountMode = 'two-step';
      accountSize = 5000;
      profitSplitPct = 80;
      bonusPointsAwarded = undefined;
      couponCode = undefined;
      discountPct = undefined;
    } else if (rollPct < 15.0) {
      rarityTier = 'COUPON';
      rewardTitle = '50% OFF VIP Coupon: VIP50 (Save 50% on Any Challenge)';
      rewardKind = 'coupon';
      couponCode = 'VIP50';
      discountPct = 50;
      bonusPointsAwarded = 100;
      user.rewardPoints = (user.rewardPoints || 0) + 100;
    } else if (rollPct < 28.0) {
      rarityTier = 'COUPON';
      rewardTitle = '40% OFF Super Coupon: SAVE40 (Save 40% on Any Challenge)';
      rewardKind = 'coupon';
      couponCode = 'SAVE40';
      discountPct = 40;
      bonusPointsAwarded = 80;
      user.rewardPoints = (user.rewardPoints || 0) + 80;
    } else if (rollPct < 42.0) {
      rarityTier = 'COUPON';
      rewardTitle = '35% OFF Citrus Coupon: CITRUS35 (Save 35% on Any Challenge)';
      rewardKind = 'coupon';
      couponCode = 'CITRUS35';
      discountPct = 35;
      bonusPointsAwarded = 60;
      user.rewardPoints = (user.rewardPoints || 0) + 60;
    } else if (rollPct < 56.0) {
      rarityTier = 'COUPON';
      rewardTitle = '30% OFF Flash Coupon: LEMON30 (Save 30% on Any Challenge)';
      rewardKind = 'coupon';
      couponCode = 'LEMON30';
      discountPct = 30;
      bonusPointsAwarded = 50;
      user.rewardPoints = (user.rewardPoints || 0) + 50;
    } else if (rollPct < 70.0) {
      rarityTier = 'COUPON';
      rewardTitle = '25% OFF Boost Coupon: BOOST25 (Save 25% on Any Challenge)';
      rewardKind = 'coupon';
      couponCode = 'BOOST25';
      discountPct = 25;
      bonusPointsAwarded = 50;
      user.rewardPoints = (user.rewardPoints || 0) + 50;
    } else if (rollPct < 82.0) {
      rarityTier = 'COUPON';
      rewardTitle = '20% OFF Zest Coupon: ZEST20 (Save 20% on Any Challenge)';
      rewardKind = 'coupon';
      couponCode = 'ZEST20';
      discountPct = 20;
      bonusPointsAwarded = 40;
      user.rewardPoints = (user.rewardPoints || 0) + 40;
    } else if (rollPct < 92.0) {
      rarityTier = 'COUPON';
      rewardTitle = '15% OFF Starter Coupon: PROMO15 (Save 15% on Any Challenge)';
      rewardKind = 'coupon';
      couponCode = 'PROMO15';
      discountPct = 15;
      bonusPointsAwarded = 30;
      user.rewardPoints = (user.rewardPoints || 0) + 30;
    } else if (rollPct < 97.0) {
      rarityTier = 'COUPON';
      rewardTitle = '10% OFF Starter Coupon: SAVE10 (Save 10% on Any Challenge)';
      rewardKind = 'coupon';
      couponCode = 'SAVE10';
      discountPct = 10;
      bonusPointsAwarded = 20;
      user.rewardPoints = (user.rewardPoints || 0) + 20;
    } else {
      rarityTier = 'BONUS_PTS';
      rewardTitle = '+250 Bonus Reward Points';
      rewardKind = 'points';
      bonusPointsAwarded = 250;
      couponCode = undefined;
      discountPct = undefined;
      user.rewardPoints = (user.rewardPoints || 0) + 250;
    }

    if (!Array.isArray(this.db.redemptionRequests)) {
      this.db.redemptionRequests = [];
    }

    const reqItem: RedemptionRequest = {
      id: `rdm_${crypto.randomUUID().slice(0, 8)}`,
      userId: user.id,
      userEmail: user.email,
      userName: user.fullName,
      loginId: user.loginId,
      source: 'secret_code',
      secretCodeUsed: drop.code,
      rarityTier,
      rewardTitle,
      rewardKind,
      couponCode,
      discountPct,
      pointsSpent: 0,
      bonusPointsAwarded,
      accountMode,
      accountSize,
      profitSplitPct,
      requestIp: normalizeIp(ctx?.ip),
      status: rewardKind === 'coupon' || rewardKind === 'points' ? 'approved' : 'pending_approval',
      createdAtIso: new Date().toISOString(),
    };

    this.db.redemptionRequests.unshift(reqItem);
    this.appendActivity(
      'secret_code',
      user,
      `Used Secret Code ${drop.code} — Luck Rolled ${rarityTier}: ${rewardTitle} [${reqItem.status}]`,
      ctx
    );
    this.save();
    return { ok: true, request: reqItem, rollPct };
  }

  ensureGiveawaySecretCodes(): void {
    if (!Array.isArray(this.db.secretCodes)) {
      this.db.secretCodes = [];
    }
    const hasGiveawayCodes = this.db.secretCodes.some((c) => c.code.startsWith('LMN-WIN-'));
    if (!hasGiveawayCodes || this.db.secretCodes.length < 1000) {
      const existing = new Set(this.db.secretCodes.map((c) => c.code.toUpperCase()));
      for (let i = 1; i <= 1000; i++) {
        const code = `LMN-WIN-${String(i).padStart(4, '0')}`;
        if (!existing.has(code)) {
          this.db.secretCodes.push({
            id: `sc_gw_${i}`,
            code,
            label: `Giveaway Drop #${i}`,
            maxUses: 1,
            usedCount: 0,
            mythicChancePct: 5,
            active: true,
            usedByUserIds: [],
            createdAtIso: new Date().toISOString(),
          });
          existing.add(code);
        }
      }
      this.save();
    }
  }

  getGiveawayCodesList(): {
    total: number;
    claimed: number;
    available: number;
    codes: {
      code: string;
      label: string;
      claimed: boolean;
      claimedBy?: string;
      claimedAtIso?: string;
      rewardTitle?: string;
    }[];
  } {
    this.ensureGiveawaySecretCodes();
    const list = (this.db.secretCodes || []).filter((c) => c.code.startsWith('LMN-WIN-'));
    const total = list.length;
    const claimed = list.filter((c) => c.usedCount > 0).length;
    const available = total - claimed;

    const redemptions = Array.isArray(this.db.redemptionRequests) ? this.db.redemptionRequests : [];
    const codeToRedemption = new Map<string, RedemptionRequest>();
    for (const r of redemptions) {
      if (r.secretCodeUsed) {
        codeToRedemption.set(r.secretCodeUsed.toUpperCase(), r);
      }
    }

    const codes = list.map((c) => {
      const isClaimed = c.usedCount > 0;
      const r = codeToRedemption.get(c.code.toUpperCase());
      return {
        code: c.code,
        label: c.label,
        claimed: isClaimed,
        claimedBy: r ? `${r.userName} (@${r.loginId})` : undefined,
        claimedAtIso: r?.createdAtIso,
        rewardTitle: r?.rewardTitle,
      };
    });

    return { total, claimed, available, codes };
  }

  getCertificate(id: string): TraderCertificate | null {
    if (!Array.isArray(this.db.certificates)) {
      this.db.certificates = [];
    }
    const cleanId = id.trim().toUpperCase();
    const found =
      this.db.certificates.find((c) => c.id.toUpperCase() === cleanId) ||
      this.db.certificates.find((c) => c.id.toUpperCase().includes(cleanId));
    if (found) {
      return found;
    }

    if (cleanId.startsWith('LF-CERT-PASS-')) {
      const acctNum = cleanId.slice('LF-CERT-PASS-'.length);
      const acct = this.db.accounts.find(
        (a) =>
          a.accountNumber.toUpperCase() === acctNum &&
          (a.status === 'Target Passed' || a.status === 'Instant Funded')
      );
      if (acct) {
        const cert = this.ensureAccountCertificate(acct);
        this.save();
        return cert;
      }
    }
    return null;
  }

  reviewSocialTask(
    requestingUserId: string,
    submissionId: string,
    action: 'approve' | 'reject',
    adminNote?: string,
    ctx?: RequestContext
  ):
    | { ok: true; submission: SocialTaskSubmission }
    | { ok: false; status: number; error: string } {
    const caller = this.db.users.find((u) => u.id === requestingUserId && u.emailVerified);
    if (!caller || !isAuthorizedAdminEmail(caller.email, this.adminEmail)) {
      return { ok: false, status: 403, error: 'Owner admin access is restricted.' };
    }
    const list = Array.isArray(this.db.taskSubmissions) ? this.db.taskSubmissions : [];
    const sub = list.find((s) => s.id === submissionId);
    if (!sub) {
      return { ok: false, status: 404, error: 'Task submission not found.' };
    }
    if (sub.status !== 'pending') {
      return { ok: false, status: 400, error: `Task proof already ${sub.status}.` };
    }

    sub.reviewedAtIso = new Date().toISOString();
    sub.adminNote = adminNote?.trim().slice(0, 120);

    if (action === 'approve') {
      sub.status = 'approved';
      const targetUser = this.db.users.find((u) => u.id === sub.userId);
      if (targetUser) {
        targetUser.rewardPoints = (targetUser.rewardPoints || 0) + sub.pointsReward;
      }
      this.appendActivity(
        'reward_task',
        caller,
        `Approved ${sub.taskLabel} for @${sub.loginId} (+${sub.pointsReward} pts)`,
        ctx
      );
    } else {
      sub.status = 'rejected';
      this.appendActivity(
        'reward_task',
        caller,
        `Rejected ${sub.taskLabel} proof for @${sub.loginId}`,
        ctx
      );
    }
    this.save();
    return { ok: true, submission: sub };
  }

  reviewRedemptionRequest(
    requestingUserId: string,
    redemptionId: string,
    action: 'approve' | 'reject',
    ctx?: RequestContext
  ):
    | { ok: true; request: RedemptionRequest; issuedAccount?: DashboardAccount }
    | { ok: false; status: number; error: string } {
    const caller = this.db.users.find((u) => u.id === requestingUserId && u.emailVerified);
    if (!caller || !isAuthorizedAdminEmail(caller.email, this.adminEmail)) {
      return { ok: false, status: 403, error: 'Owner admin access is restricted.' };
    }
    const list = Array.isArray(this.db.redemptionRequests) ? this.db.redemptionRequests : [];
    const reqItem = list.find((r) => r.id === redemptionId);
    if (!reqItem) {
      return { ok: false, status: 404, error: 'Redemption request not found.' };
    }
    if (reqItem.status !== 'pending_approval') {
      return { ok: false, status: 400, error: `Redemption already ${reqItem.status}.` };
    }

    const targetUser = this.db.users.find((u) => u.id === reqItem.userId);
    reqItem.reviewedAtIso = new Date().toISOString();

    if (action === 'approve') {
      reqItem.status = 'approved';
      let issuedAccount: DashboardAccount | undefined;
      if (reqItem.rewardKind === 'account' && reqItem.accountMode && reqItem.accountSize) {
        const spec = getChallengeSpec(
          reqItem.accountMode,
          reqItem.accountSize,
          reqItem.profitSplitPct || 80
        );
        const seed = crypto.randomBytes(3).toString('hex').toUpperCase();
        const invSeed = crypto.randomBytes(3).toString('hex').toUpperCase();
        issuedAccount = {
          id: `acct_${crypto.randomUUID().slice(0, 8)}`,
          userId: reqItem.userId,
          accountNumber: `LF-${crypto.randomInt(100000, 999999)}`,
          terminalServer: 'LemonFunding-Live',
          terminalPassword: `LT-${seed}!`,
          investorPassword: `INV-${invSeed}`,
          mode: spec.mode,
          modeLabel: spec.modeLabel,
          accountSize: spec.accountSize,
          feePaidUsd: 0,
          paymentMethod:
            reqItem.source === 'secret_code'
              ? `Secret Code (${reqItem.rarityTier})`
              : `Reward Store (${reqItem.pointsSpent} pts)`,
          paymentStatus: 'approved',
          purchaseIp: reqItem.requestIp,
          startingBalance: spec.accountSize,
          currentEquity: spec.accountSize,
          dayStartEquity: spec.accountSize,
          profitSplitPct: spec.profitSplitPct,
          dailyLossPct: spec.dailyLossPct,
          dailyLossUsd: spec.dailyLossUsd,
          maxDrawdownPct: spec.maxDrawdownPct,
          maxDrawdownUsd: spec.maxDrawdownUsd,
          targetUsd: spec.phase1TargetUsd,
          platform: 'Lemon Terminal',
          status: spec.mode === 'instant' ? 'Instant Funded' : 'Active Evaluation',
          equityCurve: [{ label: 'Start', equity: spec.accountSize }],
          createdAtIso: new Date().toISOString(),
        };
        this.db.accounts.unshift(issuedAccount);
        if (issuedAccount.status === 'Instant Funded') {
          this.ensureAccountCertificate(issuedAccount, targetUser);
        }
        reqItem.issuedAccountNumber = issuedAccount.accountNumber;
      } else if (reqItem.rewardKind === 'points' && reqItem.bonusPointsAwarded && targetUser) {
        targetUser.rewardPoints = (targetUser.rewardPoints || 0) + reqItem.bonusPointsAwarded;
      }

      this.appendActivity(
        'reward_redeem',
        caller,
        `Approved ${reqItem.rewardTitle} for @${reqItem.loginId}${issuedAccount ? ` (Issued #${issuedAccount.accountNumber})` : ''}`,
        ctx
      );
      this.save();
      return { ok: true, request: reqItem, issuedAccount };
    } else {
      reqItem.status = 'rejected';
      if (reqItem.pointsSpent > 0 && targetUser) {
        targetUser.rewardPoints = (targetUser.rewardPoints || 0) + reqItem.pointsSpent;
      }
      this.appendActivity(
        'reward_redeem',
        caller,
        `Rejected ${reqItem.rewardTitle} for @${reqItem.loginId}${reqItem.pointsSpent > 0 ? ` (${reqItem.pointsSpent} pts refunded)` : ''}`,
        ctx
      );
      this.save();
      return { ok: true, request: reqItem };
    }
  }

  createSecretCodeDrop(
    requestingUserId: string,
    input: { code: string; label?: string; maxUses?: number; mythicChancePct?: number },
    ctx?: RequestContext
  ):
    | { ok: true; drop: SecretCodeDrop }
    | { ok: false; status: number; error: string } {
    const caller = this.db.users.find((u) => u.id === requestingUserId && u.emailVerified);
    if (!caller || !isAuthorizedAdminEmail(caller.email, this.adminEmail)) {
      return { ok: false, status: 403, error: 'Owner admin access is restricted.' };
    }
    const cleanCode = String(input.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');
    if (cleanCode.length < 3 || cleanCode.length > 24) {
      return { ok: false, status: 400, error: 'Secret code must be 3–24 letters/numbers.' };
    }
    if (!Array.isArray(this.db.secretCodes)) {
      this.db.secretCodes = [];
    }
    if (this.db.secretCodes.some((c) => c.code.toUpperCase() === cleanCode)) {
      return { ok: false, status: 409, error: `Secret code ${cleanCode} already exists.` };
    }
    const maxUses = Math.min(10000, Math.max(1, Number(input.maxUses) || 50));
    const mythicChancePct = Math.min(50, Math.max(1, Number(input.mythicChancePct) || 10));

    const drop: SecretCodeDrop = {
      id: `scd_${crypto.randomUUID().slice(0, 8)}`,
      code: cleanCode,
      label: String(input.label || 'Community Secret Drop').trim().slice(0, 60),
      maxUses,
      usedCount: 0,
      mythicChancePct,
      active: true,
      usedByUserIds: [],
      createdAtIso: new Date().toISOString(),
    };

    this.db.secretCodes.unshift(drop);
    this.appendActivity(
      'secret_code',
      caller,
      `Dropped Secret Code ${drop.code} (Max ${drop.maxUses} claims, ${drop.mythicChancePct}% Mythic Luck)`,
      ctx
    );
    this.save();
    return { ok: true, drop };
  }

  toggleSecretCodeDrop(
    requestingUserId: string,
    codeId: string,
    active: boolean
  ): { ok: true; drop: SecretCodeDrop } | { ok: false; status: number; error: string } {
    const caller = this.db.users.find((u) => u.id === requestingUserId && u.emailVerified);
    if (!caller || !isAuthorizedAdminEmail(caller.email, this.adminEmail)) {
      return { ok: false, status: 403, error: 'Owner admin access is restricted.' };
    }
    const drop = (this.db.secretCodes || []).find((c) => c.id === codeId);
    if (!drop) {
      return { ok: false, status: 404, error: 'Secret code not found.' };
    }
    drop.active = active;
    this.save();
    return { ok: true, drop };
  }

  deleteSecretCodeDrop(
    requestingUserId: string,
    codeId: string
  ): { ok: true } | { ok: false; status: number; error: string } {
    const caller = this.db.users.find((u) => u.id === requestingUserId && u.emailVerified);
    if (!caller || !isAuthorizedAdminEmail(caller.email, this.adminEmail)) {
      return { ok: false, status: 403, error: 'Owner admin access is restricted.' };
    }
    if (!Array.isArray(this.db.secretCodes)) {
      return { ok: false, status: 404, error: 'Secret code not found.' };
    }
    const prevLen = this.db.secretCodes.length;
    this.db.secretCodes = this.db.secretCodes.filter((c) => c.id !== codeId);
    if (this.db.secretCodes.length === prevLen) {
      return { ok: false, status: 404, error: 'Secret code not found.' };
    }
    this.save();
    return { ok: true };
  }

  updatePayoutStatus(
    requestingUserId: string,
    payoutId: string,
    status: 'Processing' | 'Settled',
    ctx?: RequestContext
  ):
    | { ok: true; payout: DashboardPayout }
    | { ok: false; status: number; error: string } {
    const caller = this.db.users.find((u) => u.id === requestingUserId && u.emailVerified);
    if (!caller || !isAuthorizedAdminEmail(caller.email, this.adminEmail)) {
      return { ok: false, status: 403, error: 'Owner admin access is restricted.' };
    }
    const payout = this.db.payouts.find((p) => p.id === payoutId);
    if (!payout) {
      return { ok: false, status: 404, error: 'Payout request not found.' };
    }
    payout.status = status;
    this.appendActivity(
      'payout_settled',
      caller,
      `Marked payout ${payout.accountNumber} ($${payout.amountUsd.toLocaleString('en-US')}) as ${status}`,
      ctx
    );
    this.save();
    return { ok: true, payout };
  }

  manageChallengeAccount(
    requestingUserId: string,
    accountId: string,
    input: { status?: DashboardAccount['status']; resetEquity?: boolean },
    ctx?: RequestContext
  ):
    | { ok: true; account: DashboardAccount }
    | { ok: false; status: number; error: string } {
    const caller = this.db.users.find((u) => u.id === requestingUserId && u.emailVerified);
    if (!caller || !isAuthorizedAdminEmail(caller.email, this.adminEmail)) {
      return { ok: false, status: 403, error: 'Owner admin access is restricted.' };
    }
    const account = this.db.accounts.find((a) => a.id === accountId);
    if (!account) {
      return { ok: false, status: 404, error: 'Challenge account not found.' };
    }
    const allowedStatuses: DashboardAccount['status'][] = [
      'Pending Approval',
      'Active Evaluation',
      'Target Passed',
      'Instant Funded',
      'Breached',
    ];
    if (input.status && allowedStatuses.includes(input.status)) {
      account.status = input.status;
      if (input.status === 'Active Evaluation' || input.status === 'Target Passed' || input.status === 'Instant Funded') {
        account.paymentStatus = 'approved';
        delete account.breachReason;
        if (input.status === 'Target Passed' || input.status === 'Instant Funded') {
          this.ensureAccountCertificate(account);
        }
      } else if (input.status === 'Breached' && !account.breachReason) {
        account.breachReason = 'Marked breached by Owner Admin.';
      }
    }
    if (input.resetEquity) {
      account.currentEquity = account.startingBalance;
      account.dayStartEquity = account.startingBalance;
      account.equityCurve = [{ label: 'Reset', equity: account.startingBalance }];
      delete account.breachReason;
      if (account.status === 'Breached') {
        account.status = account.mode === 'instant' ? 'Instant Funded' : 'Active Evaluation';
      }
    }
    this.appendActivity(
      'purchase_account',
      caller,
      `Admin updated account ${account.accountNumber}: status=${account.status}${input.resetEquity ? ' (balance reset)' : ''}`,
      ctx
    );
    this.save();
    return { ok: true, account };
  }

  adjustUserRewardPoints(
    requestingUserId: string,
    targetUserId: string,
    delta: number,
    reason?: string,
    ctx?: RequestContext
  ):
    | { ok: true; user: PublicUser }
    | { ok: false; status: number; error: string } {
    const caller = this.db.users.find((u) => u.id === requestingUserId && u.emailVerified);
    if (!caller || !isAuthorizedAdminEmail(caller.email, this.adminEmail)) {
      return { ok: false, status: 403, error: 'Owner admin access is restricted.' };
    }
    const target = this.db.users.find((u) => u.id === targetUserId);
    if (!target) {
      return { ok: false, status: 404, error: 'Trader account not found.' };
    }
    if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 50000) {
      return { ok: false, status: 400, error: 'Points adjustment must be non-zero between -50,000 and +50,000.' };
    }
    const current = typeof target.rewardPoints === 'number' ? target.rewardPoints : 0;
    const next = Math.max(0, Math.round(current + delta));
    target.rewardPoints = next;
    this.appendActivity(
      'reward_task',
      caller,
      `Admin adjusted points for @${target.loginId} by ${delta > 0 ? `+${delta}` : delta} pts (now ${next} pts)${reason ? `: ${reason.trim().slice(0, 80)}` : ''}`,
      ctx
    );
    this.save();
    return { ok: true, user: sanitizeUser(target, this.adminEmail) };
  }

  verifyUserEmailByAdmin(
    requestingUserId: string,
    targetUserId: string,
    ctx?: RequestContext
  ):
    | { ok: true; user: PublicUser }
    | { ok: false; status: number; error: string } {
    const caller = this.db.users.find((u) => u.id === requestingUserId && u.emailVerified);
    if (!caller || !isAuthorizedAdminEmail(caller.email, this.adminEmail)) {
      return { ok: false, status: 403, error: 'Owner admin access is restricted.' };
    }
    const target = this.db.users.find((u) => u.id === targetUserId);
    if (!target) {
      return { ok: false, status: 404, error: 'Trader account not found.' };
    }
    target.emailVerified = true;
    delete this.db.verifications[target.id];
    this.appendActivity(
      'verify_email',
      caller,
      `Admin manually verified email for @${target.loginId} (${target.email})`,
      ctx
    );
    this.save();
    return { ok: true, user: sanitizeUser(target, this.adminEmail) };
  }

  getKycForUser(userId: string): {
    kycStatus: KycStatus;
    kycRejectionReason?: string;
    latestSubmission: KycSubmission | null;
  } | null {
    const user = this.db.users.find((u) => u.id === userId);
    if (!user) return null;
    const list = (this.db.kycRequests || [])
      .filter((k) => k.userId === userId)
      .sort((a, b) => b.submittedAtIso.localeCompare(a.submittedAtIso));
    return {
      kycStatus: user.kycStatus || 'not_submitted',
      kycRejectionReason: user.kycRejectionReason,
      latestSubmission: list[0] || null,
    };
  }

  submitKycVerification(
    userId: string,
    input: {
      panSelected: boolean;
      aadhaarSelected: boolean;
      panNumber?: string;
      aadhaarNumber?: string;
      panImageUrl: string;
      aadhaarFrontImageUrl: string;
      aadhaarBackImageUrl: string;
    },
    ctx?: RequestContext
  ):
    | { ok: true; submission: KycSubmission; user: PublicUser }
    | { ok: false; status: number; error: string } {
    const user = this.db.users.find((u) => u.id === userId);
    if (!user) {
      return { ok: false, status: 404, error: 'Trader account not found.' };
    }
    const currentStatus = user.kycStatus || 'not_submitted';
    if (currentStatus === 'approved') {
      return { ok: false, status: 400, error: 'Your KYC verification is already approved.' };
    }
    if (currentStatus === 'pending') {
      return {
        ok: false,
        status: 409,
        error: 'Your KYC request is already pending Owner Admin review.',
      };
    }

    if (!input.panSelected || !input.aadhaarSelected) {
      return {
        ok: false,
        status: 400,
        error: 'Please select both PAN Card and Aadhaar Card documents to submit KYC.',
      };
    }

    const panImg = (input.panImageUrl || '').trim();
    const aadhaarFrontImg = (input.aadhaarFrontImageUrl || '').trim();
    const aadhaarBackImg = (input.aadhaarBackImageUrl || '').trim();

    if (
      !panImg.startsWith('data:image/') ||
      !aadhaarFrontImg.startsWith('data:image/') ||
      !aadhaarBackImg.startsWith('data:image/')
    ) {
      return {
        ok: false,
        status: 400,
        error:
          'Upload all 3 clear screenshots: PAN Card, Aadhaar Card Front, and Aadhaar Card Back.',
      };
    }

    const cleanPan = (input.panNumber || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 12);
    const cleanAadhaar = (input.aadhaarNumber || '')
      .trim()
      .replace(/[^0-9]/g, '')
      .slice(0, 12);

    if (!Array.isArray(this.db.kycRequests)) {
      this.db.kycRequests = [];
    }

    if (cleanPan.length >= 8) {
      const dupPan = this.db.kycRequests.find(
        (k) => k.userId !== userId && k.status !== 'rejected' && k.panNumber === cleanPan
      );
      if (dupPan) {
        return {
          ok: false,
          status: 409,
          error: 'This PAN Card number is already verified or pending under another trader account.',
        };
      }
    }
    if (cleanAadhaar.length === 12) {
      const dupAadhaar = this.db.kycRequests.find(
        (k) => k.userId !== userId && k.status !== 'rejected' && k.aadhaarNumber === cleanAadhaar
      );
      if (dupAadhaar) {
        return {
          ok: false,
          status: 409,
          error: 'This Aadhaar number is already verified or pending under another trader account.',
        };
      }
    }

    const submissionIp = normalizeIp(ctx?.ip);
    this.recordIpAndDevice(user, ctx, false);

    const submission: KycSubmission = {
      id: `kyc_${crypto.randomUUID().slice(0, 8)}`,
      userId: user.id,
      userName: user.fullName,
      userEmail: user.email,
      loginId: user.loginId,
      documentsSelected: ['PAN Card', 'Aadhaar Card'],
      panNumber: cleanPan || 'Attached Screenshot',
      aadhaarNumber: cleanAadhaar || 'Attached Front & Back',
      panImageUrl: panImg,
      aadhaarFrontImageUrl: aadhaarFrontImg,
      aadhaarBackImageUrl: aadhaarBackImg,
      submissionIp,
      status: 'pending',
      submittedAtIso: new Date().toISOString(),
    };

    this.db.kycRequests.unshift(submission);
    user.kycStatus = 'pending';
    delete user.kycRejectionReason;

    this.appendActivity(
      'kyc_verification',
      user,
      `Submitted KYC request (PAN Card + Aadhaar Front & Back) from IP ${submissionIp}`,
      ctx
    );
    this.save();
    return {
      ok: true,
      submission,
      user: sanitizeUser(user, this.adminEmail),
    };
  }

  reviewKycSubmission(
    requestingUserId: string,
    kycId: string,
    action: 'approve' | 'reject',
    adminNote?: string,
    ctx?: RequestContext
  ):
    | { ok: true; submission: KycSubmission; user: PublicUser | null }
    | { ok: false; status: number; error: string } {
    const caller = this.db.users.find((u) => u.id === requestingUserId && u.emailVerified);
    if (!caller || !isAuthorizedAdminEmail(caller.email, this.adminEmail)) {
      return { ok: false, status: 403, error: 'Owner admin access is restricted.' };
    }
    if (!Array.isArray(this.db.kycRequests)) {
      this.db.kycRequests = [];
    }
    const submission = this.db.kycRequests.find((k) => k.id === kycId);
    if (!submission) {
      return { ok: false, status: 404, error: 'KYC request not found.' };
    }
    if (submission.status !== 'pending') {
      return { ok: false, status: 400, error: 'This KYC request has already been reviewed.' };
    }

    const trader = this.db.users.find((u) => u.id === submission.userId) || null;
    submission.status = action === 'approve' ? 'approved' : 'rejected';
    submission.reviewedAtIso = new Date().toISOString();
    if (adminNote && adminNote.trim()) {
      submission.adminNote = adminNote.trim().slice(0, 180);
    }

    if (trader) {
      if (action === 'approve') {
        trader.kycStatus = 'approved';
        delete trader.kycRejectionReason;
      } else {
        trader.kycStatus = 'rejected';
        trader.kycRejectionReason =
          submission.adminNote || 'Document blur/mismatch. Re-upload clear PAN & Aadhaar Front/Back.';
      }
    }

    this.appendActivity(
      'kyc_verification',
      caller,
      action === 'approve'
        ? `Approved KYC for @${submission.loginId} (${submission.userEmail}) — Trading unlocked`
        : `Rejected KYC for @${submission.loginId} (${submission.userEmail})${submission.adminNote ? `: ${submission.adminNote}` : ''}`,
      ctx
    );
    this.save();
    return {
      ok: true,
      submission,
      user: trader ? sanitizeUser(trader, this.adminEmail) : null,
    };
  }
}
