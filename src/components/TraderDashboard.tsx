import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileCheck2,
  Gift,
  GraduationCap,
  HelpCircle,
  Home,
  Key,
  KeyRound,
  LayoutGrid,
  List,
  Lock,
  LogOut,
  Monitor,
  MoreVertical,
  PanelLeft,
  Plus,
  PlusSquare,
  QrCode,
  Radio,
  Receipt,
  Rocket,
  Search,
  Settings,
  Share,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Terminal,
  Ticket,
  Trophy,
  User,
  Wallet,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import type {
  DashboardAccount,
  DashboardPayout,
  DashboardTrade,
  PublicUser,
  TraderCertificate,
} from '../server/authStore';
import {
  ACCOUNT_SIZES,
  applyComebackDiscount,
  CHALLENGE_MODES,
  COMEBACK_CODE,
  computeTradingDayStats,
  evaluateAccountPayoutEligibility,
  formatUsd,
  getChallengeSpec,
  normalizePromoCode,
  type AccountSize,
  type ChallengeMode,
  type ProfitSplitOption,
} from '../utils/challenges';
import { KycVerificationSection } from './KycVerificationSection';
import { LemonLogo } from './LemonLogo';
import { LemonTerminal } from './LemonTerminal';
import { PaymentMethod, type PaymentConfirmedDetails } from './PaymentMethod';
import { PWAInstallModal, usePWAInstallState } from './PWAInstallModal';
import { RewardsSection } from './RewardsSection';

export type DashboardPage =
  | 'overview'
  | 'accounts'
  | 'challenges'
  | 'checkout'
  | 'analytics'
  | 'orders'
  | 'certificates'
  | 'affiliate'
  | 'wallet'
  | 'rewards'
  | 'profile'
  | 'credentials'
  | 'kyc'
  | 'support'
  | 'terminal'
  | 'downloads'
  | 'journal'
  | 'payouts';

interface TraderDashboardProps {
  user: PublicUser;
  accounts: DashboardAccount[];
  trades: DashboardTrade[];
  payouts: DashboardPayout[];
  accessToken: string;
  comebackEligible: boolean;
  comebackCode: string | null;
  activePage: DashboardPage;
  onChangePage: (page: DashboardPage) => void;
  onRefreshDashboard: () => Promise<void>;
  onOpenNewChallenge: (options?: {
    size?: AccountSize;
    mode?: ChallengeMode;
    split?: ProfitSplitOption;
    promoCode?: string;
  }) => void;
  onOpenAdmin?: () => void;
  focusSecretCode?: boolean;
  onClearFocusSecretCode?: () => void;
  onBackToSite: () => void;
  onLaunchStandaloneTerminal?: () => void;
  onSignOut: () => void;
}

const SYMBOLS = ['EUR/USD', 'XAU/USD', 'NAS100', 'GBP/USD', 'BTC/USD', 'US30'];

function formatShortSize(size: number): string {
  return size >= 1000 ? `$${Math.round(size / 1000)}k` : `$${size}`;
}

export function TraderDashboard({
  user,
  accounts,
  trades,
  payouts,
  accessToken,
  comebackEligible,
  comebackCode,
  activePage,
  onChangePage,
  onRefreshDashboard,
  onOpenNewChallenge,
  onOpenAdmin,
  focusSecretCode,
  onClearFocusSecretCode,
  onBackToSite,
  onLaunchStandaloneTerminal,
  onSignOut,
}: TraderDashboardProps) {
  const { canNativeInstall, isInstalled, promptNativeInstall } = usePWAInstallState();
  const [downloadStatusMsg, setDownloadStatusMsg] = useState('');
  const [expandedGuide, setExpandedGuide] = useState<'android' | 'ios' | 'desktop' | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [headerMoreOpen, setHeaderMoreOpen] = useState(false);
  const [localFocusSecretCode, setLocalFocusSecretCode] = useState(false);
  const [openCardMenuId, setOpenCardMenuId] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [equityRange, setEquityRange] = useState<'1W' | '1M' | 'All'>('1M');

  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || '');

  // Accounts page filters + view toggle
  const [typeFilter, setTypeFilter] = useState<'all' | ChallengeMode>('all');
  const [stateFilter, setStateFilter] = useState<'all' | 'active' | 'passed' | 'breached' | 'pending'>('all');
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'phase1' | 'funded' | 'closed'>('all');
  const [accountsViewMode, setAccountsViewMode] = useState<'stack' | 'list'>('stack');

  const [credentialsModalAccount, setCredentialsModalAccount] = useState<DashboardAccount | null>(null);
  const [pwaModalOpen, setPwaModalOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Challenges & In-Dashboard Checkout state
  const [dashMode, setDashMode] = useState<ChallengeMode>('two-step');
  const [checkoutSize, setCheckoutSize] = useState<AccountSize>(50000);
  const [dashSplit, setDashSplit] = useState<ProfitSplitOption>(80);
  const [rulesExpanded, setRulesExpanded] = useState(true);
  const [checkoutPromoInput, setCheckoutPromoInput] = useState('');
  const [promoServerCheck, setPromoServerCheck] = useState<{
    checkedCode: string;
    valid: boolean;
    discountPct: number;
    error?: string;
  } | null>(null);
  const [promoValidating, setPromoValidating] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'configure' | 'payment' | 'submitted'>('configure');
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutSuccessAccount, setCheckoutSuccessAccount] = useState<DashboardAccount | null>(null);
  const [billingFirstName, setBillingFirstName] = useState(
    (user.fullName || 'Trader').trim().split(/\s+/)[0] || 'Trader'
  );
  const [billingLastName, setBillingLastName] = useState(
    (user.fullName || '').trim().split(/\s+/).slice(1).join(' ') || 'Member'
  );
  const [billingCountry, setBillingCountry] = useState('India');

  const prevAccountCountRef = useRef<number>(accounts.length);
  useEffect(() => {
    if (accounts.length > prevAccountCountRef.current && accounts[0]?.id) {
      setSelectedAccountId(accounts[0].id);
    } else if (accounts.length > 0 && !accounts.some((a) => a.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0].id);
    }
    prevAccountCountRef.current = accounts.length;
  }, [accounts, selectedAccountId]);

  // Trade logger state (Journal page)
  const [symbol, setSymbol] = useState('XAU/USD');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [lots, setLots] = useState('1.0');
  const [pnlInput, setPnlInput] = useState('520');
  const [notes, setNotes] = useState('');
  const [tradeError, setTradeError] = useState('');
  const [tradeBusy, setTradeBusy] = useState(false);

  // Journal filter state
  const [sideFilter, setSideFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Payout form state
  const [payoutMethod] = useState<'BNB BEP20'>('BNB BEP20');
  const [bnbAddress, setBnbAddress] = useState('');
  const [payoutMsg, setPayoutMsg] = useState('');
  const [payoutError, setPayoutError] = useState('');
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutAnimStage, setPayoutAnimStage] = useState<'idle' | 'verifying' | 'broadcasting' | 'confirmed'>('idle');
  const [activeCertificate, setActiveCertificate] = useState<TraderCertificate | null>(null);
  const [certError, setCertError] = useState('');
  const [loadingCert, setLoadingCert] = useState(false);

  const activeAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0] || null;
  const activeComebackCode = comebackCode || COMEBACK_CODE;
  const firstName = (user.fullName || 'Trader').trim().split(/\s+/)[0];

  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (typeFilter !== 'all' && a.mode !== typeFilter) return false;
      const isPending = a.status === 'Pending Approval' || a.paymentStatus === 'pending_approval';
      if (stateFilter === 'active' && (a.status === 'Breached' || a.status === 'Target Passed' || isPending)) {
        return false;
      }
      if (stateFilter === 'passed' && a.status !== 'Target Passed') return false;
      if (stateFilter === 'breached' && a.status !== 'Breached') return false;
      if (stateFilter === 'pending' && !isPending) return false;
      if (phaseFilter === 'phase1' && (a.mode === 'instant' || isPending)) return false;
      if (phaseFilter === 'funded' && a.status !== 'Instant Funded' && a.status !== 'Target Passed') {
        return false;
      }
      if (phaseFilter === 'closed' && a.status !== 'Breached') return false;
      return true;
    });
  }, [accounts, typeFilter, stateFilter, phaseFilter]);

  const accountTrades = useMemo(() => {
    if (!activeAccount) return [];
    return trades.filter((t) => {
      if (t.accountId !== activeAccount.id) return false;
      if (sideFilter !== 'ALL' && t.side !== sideFilter) return false;
      if (
        searchQuery.trim() &&
        !t.symbol.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
        !t.notes.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [activeAccount, trades, sideFilter, searchQuery]);

  // Overview analytics & metrics
  const deskMetrics = useMemo(() => {
    const activeList = accounts.filter((a) => a.status !== 'Breached');
    const breachedList = accounts.filter((a) => a.status === 'Breached');
    const totalPayoutsUsd = payouts.reduce((sum, p) => sum + p.amountUsd, 0);
    const highestReward = payouts.reduce((max, p) => Math.max(max, p.amountUsd), 0);

    const totalCapital = activeList.reduce((sum, a) => sum + a.startingBalance, 0);
    const totalEquity = activeList.reduce((sum, a) => sum + a.currentEquity, 0);
    const netDeltaUsd = totalEquity - totalCapital;
    const netDeltaPct = totalCapital > 0 ? ((netDeltaUsd / totalCapital) * 100).toFixed(1) : '0.0';

    const buyCount = trades.filter((t) => t.side === 'BUY').length;
    const sellCount = trades.filter((t) => t.side === 'SELL').length;
    const totalTrades = trades.length;
    const wins = trades.filter((t) => t.pnlUsd > 0);
    const losses = trades.filter((t) => t.pnlUsd < 0);
    const winRate = totalTrades > 0 ? Math.round((wins.length / totalTrades) * 100) : 0;
    const winRateExact = totalTrades > 0 ? ((wins.length / totalTrades) * 100).toFixed(2) : '0.00';

    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnlUsd, 0) / wins.length : 0;
    const avgLoss =
      losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnlUsd, 0) / losses.length) : 0;
    const rrRatio = avgLoss > 0 ? Math.min(3, avgWin / avgLoss) : wins.length > 0 ? 2.0 : 0;

    const slCount = trades.filter((t) => t.notes.toLowerCase().includes('sl')).length;
    const slUsagePct =
      totalTrades > 0 ? Math.min(100, Math.round(((slCount + wins.length * 0.5) / totalTrades) * 80)) : 0;

    const longPct = totalTrades > 0 ? Math.round((buyCount / totalTrades) * 100) : 50;
    const shortPct = totalTrades > 0 ? 100 - longPct : 50;
    const weekPnl = trades.slice(0, 14).reduce((s, t) => s + t.pnlUsd, 0);

    const consistencyScore = totalTrades >= 3 ? Math.min(1, winRate / 85) : 0;
    const calmarScore = totalTrades > 0 ? Math.min(1, Math.max(0.15, weekPnl > 0 ? 0.8 : 0.35)) : 0;
    const tradesScore = Math.min(1, totalTrades / 12);
    const slScore = slUsagePct / 100;
    const wrScore = winRate / 100;
    const rrScore = Math.min(1, rrRatio / 2.5);

    const scoreIndex =
      totalTrades === 0
        ? 0
        : Number(
            (
              ((consistencyScore + calmarScore + tradesScore + slScore + wrScore + rrScore) / 6) *
              100
            ).toFixed(2)
          );

    const radarValues = [
      consistencyScore,
      calmarScore,
      tradesScore,
      slScore,
      wrScore,
      rrScore,
    ];

    const tierLabel =
      totalPayoutsUsd >= 5000
        ? 'Gold Tier'
        : totalPayoutsUsd > 0 || activeList.length >= 2
          ? 'Silver Tier'
          : 'Bronze Tier';

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const buckets = [0, 0, 0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const tr of trades) {
      const d = new Date(tr.executedAtIso);
      const dayIdx = (d.getDay() + 6) % 7;
      buckets[dayIdx] += tr.pnlUsd;
      counts[dayIdx] += 1;
    }
    const maxAbsDay = Math.max(100, ...buckets.map((v) => Math.abs(v)));
    const weekBars = dayLabels.map((label, idx) => ({
      label,
      pnl: buckets[idx],
      count: counts[idx],
      heightPct: Math.min(100, Math.round((Math.abs(buckets[idx]) / maxAbsDay) * 100)),
      activityPct: Math.min(100, counts[idx] * 28),
    }));

    // Eligible withdrawable total across funded accounts
    const fundedActive = activeList.filter(
      (a) => a.status === 'Instant Funded' || a.status === 'Target Passed'
    );
    const withdrawableUsd = fundedActive.reduce((sum, a) => {
      const profit = Math.max(0, a.currentEquity - a.startingBalance);
      return sum + Math.round((profit * a.profitSplitPct) / 100);
    }, 0);

    return {
      activeList,
      breachedList,
      totalPayoutsUsd,
      highestReward,
      totalCapital,
      totalEquity,
      netDeltaUsd,
      netDeltaPct,
      buyCount,
      sellCount,
      totalTrades,
      winRate,
      winRateExact,
      longPct,
      shortPct,
      weekPnl,
      scoreIndex,
      radarValues,
      tierLabel,
      weekBars,
      withdrawableUsd,
      fundedActiveCount: fundedActive.length,
    };
  }, [accounts, payouts, trades]);

  // SVG Radar coordinates for Analytics
  const radarPolygon = useMemo(() => {
    const cx = 110;
    const cy = 96;
    const maxR = 64;
    const labels = ['Consistency', 'Calmar Ratio', 'Trades', 'SL usage', 'WR', 'RR'];
    const rings = [0.35, 0.7, 1.0];

    const getPoint = (idx: number, ratio: number) => {
      const angle = (-90 + idx * 60) * (Math.PI / 180);
      return {
        x: cx + Math.cos(angle) * maxR * ratio,
        y: cy + Math.sin(angle) * maxR * ratio,
      };
    };

    const gridPolygons = rings.map((r) =>
      labels
        .map((_, i) => {
          const p = getPoint(i, r);
          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        })
        .join(' ')
    );

    const axes = labels.map((label, i) => {
      const end = getPoint(i, 1.0);
      const lbl = getPoint(i, 1.24);
      return { label, x1: cx, y1: cy, x2: end.x, y2: end.y, lx: lbl.x, ly: lbl.y };
    });

    const dataPts = deskMetrics.radarValues
      .map((val, i) => {
        const p = getPoint(i, Math.max(0.06, val));
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(' ');

    return { cx, cy, gridPolygons, axes, dataPts };
  }, [deskMetrics.radarValues]);

  // Equity curve geometry
  const chartGeometry = useMemo(() => {
    const rawPts = activeAccount?.equityCurve || [];
    const pts =
      equityRange === '1W'
        ? rawPts.slice(-4)
        : equityRange === '1M'
          ? rawPts.slice(-8)
          : rawPts;
    if (pts.length === 0) {
      return { pathD: '', areaD: '', nodes: [], floorY: 180, labels: [] as string[], minVal: 0, maxVal: 5000 };
    }
    const overallFloor = activeAccount
      ? activeAccount.startingBalance - activeAccount.maxDrawdownUsd
      : 0;
    const values = pts.map((p) => p.equity);
    const minVal = Math.min(...values, overallFloor) - 300;
    const maxVal = Math.max(...values, activeAccount?.startingBalance || 5000) + 400;
    const span = Math.max(1, maxVal - minVal);

    const width = 620;
    const height = 210;
    const padX = 20;
    const padY = 18;
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;

    const nodes = pts.map((pt, i) => {
      const x =
        pts.length === 1
          ? padX + usableW / 2
          : padX + (i / (pts.length - 1)) * usableW;
      const y = padY + (1 - (pt.equity - minVal) / span) * usableH;
      return { x, y, label: pt.label, equity: pt.equity };
    });

    const pathD =
      nodes.length === 1
        ? `M ${padX.toFixed(1)} ${nodes[0].y.toFixed(1)} L ${(width - padX).toFixed(1)} ${nodes[0].y.toFixed(1)}`
        : nodes
            .map((n, i) => `${i === 0 ? 'M' : 'L'} ${n.x.toFixed(1)} ${n.y.toFixed(1)}`)
            .join(' ');
    const areaD =
      nodes.length === 1
        ? `M ${padX.toFixed(1)} ${nodes[0].y.toFixed(1)} L ${(width - padX).toFixed(1)} ${nodes[0].y.toFixed(1)} L ${(width - padX).toFixed(1)} ${(height - padY).toFixed(1)} L ${padX.toFixed(1)} ${(height - padY).toFixed(1)} Z`
        : nodes.length > 0
          ? `${pathD} L ${nodes[nodes.length - 1].x.toFixed(1)} ${(height - padY).toFixed(1)} L ${nodes[0].x.toFixed(1)} ${(height - padY).toFixed(1)} Z`
          : '';
    const floorY = padY + (1 - (overallFloor - minVal) / span) * usableH;

    return {
      pathD,
      areaD,
      nodes,
      floorY,
      labels: pts.map((p) => p.label),
      minVal,
      maxVal,
    };
  }, [activeAccount, equityRange]);

  // Checkout spec & discount computation
  const checkoutSpec = useMemo(
    () => getChallengeSpec(dashMode, checkoutSize, dashSplit),
    [dashMode, checkoutSize, dashSplit]
  );

  const normalizedPromo = normalizePromoCode(checkoutPromoInput);
  const alreadyUsedThisCoupon = Boolean(
    normalizedPromo && (user.usedCouponCodes || []).includes(normalizedPromo)
  );
  const effectivePromoResult = useMemo(() => {
    if (alreadyUsedThisCoupon) {
      return {
        finalFeeUsd: checkoutSpec.feeUsd,
        discountPct: 0,
        discountUsd: 0,
        appliedCode: null,
        valid: false,
      };
    }
    if (promoServerCheck && promoServerCheck.checkedCode === normalizedPromo) {
      if (!promoServerCheck.valid) {
        return {
          finalFeeUsd: checkoutSpec.feeUsd,
          discountPct: 0,
          discountUsd: 0,
          appliedCode: null,
          valid: false,
        };
      }
      const pct = promoServerCheck.discountPct;
      const finalFeeUsd = Math.max(1, Math.round(checkoutSpec.feeUsd * (1 - pct / 100)));
      return {
        finalFeeUsd,
        discountPct: pct,
        discountUsd: Math.max(0, checkoutSpec.feeUsd - finalFeeUsd),
        appliedCode: normalizedPromo,
        valid: true,
      };
    }
    return applyComebackDiscount(checkoutSpec.feeUsd, normalizedPromo, true);
  }, [alreadyUsedThisCoupon, checkoutSpec.feeUsd, normalizedPromo, promoServerCheck]);

  const handleValidateCheckoutPromo = async () => {
    const code = normalizedPromo;
    if (!code) {
      setPromoServerCheck(null);
      return;
    }
    if (alreadyUsedThisCoupon) {
      setPromoServerCheck({
        checkedCode: code,
        valid: false,
        discountPct: 0,
        error: `Coupon ${code} already used on your account (1 use per account).`,
      });
      return;
    }
    setPromoValidating(true);
    try {
      const resp = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ promoCode: code }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        setPromoServerCheck({
          checkedCode: code,
          valid: false,
          discountPct: 0,
          error: data.error || 'Coupon code is not valid or already redeemed.',
        });
      } else {
        setPromoServerCheck({
          checkedCode: code,
          valid: true,
          discountPct: Number(data.discountPct) || 0,
        });
      }
    } catch {
      setPromoServerCheck({
        checkedCode: code,
        valid: false,
        discountPct: 0,
        error: 'Could not validate coupon right now.',
      });
    } finally {
      setPromoValidating(false);
    }
  };

  const handleCheckoutPaymentConfirmed = async (paymentDetails: PaymentConfirmedDetails) => {
    setCheckoutError('');
    const cleanFullName = `${billingFirstName} ${billingLastName}`.trim() || user.fullName;
    const resp = await fetch('/api/dashboard/accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        mode: dashMode,
        accountSize: checkoutSize,
        profitSplit: dashSplit,
        profitSplitPct: dashSplit,
        platform: 'Lemon Terminal',
        promoCode: effectivePromoResult.valid ? effectivePromoResult.appliedCode : undefined,
        paymentMethod: paymentDetails.paymentMethod,
        paymentProofUrl: paymentDetails.paymentProofUrl,
        txHash: paymentDetails.txHash,
        billingName: cleanFullName,
        billingCountry,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      const errMsg = data.error || 'Could not submit evaluation order.';
      setCheckoutError(errMsg);
      throw new Error(errMsg);
    }
    setCheckoutSuccessAccount(data.account as DashboardAccount);
    setCheckoutStep('submitted');
    await onRefreshDashboard();
  };

  const handleCopyText = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleShareProfile = () => {
    const url = typeof window !== 'undefined' ? window.location.origin : '';
    navigator.clipboard.writeText(`${url}/?trader=${encodeURIComponent(user.loginId)}`);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const handleLogTrade = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeAccount) return;
    setTradeError('');

    const parsedLots = Number(lots);
    const parsedPnl = Number(pnlInput);
    if (!Number.isFinite(parsedLots) || parsedLots <= 0) {
      setTradeError('Enter a valid positive lot size.');
      return;
    }
    if (!Number.isFinite(parsedPnl) || parsedPnl === 0) {
      setTradeError('Enter a non-zero profit or loss amount in USD.');
      return;
    }

    setTradeBusy(true);
    try {
      const resp = await fetch('/api/dashboard/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          accountId: activeAccount.id,
          symbol,
          side,
          lots: parsedLots,
          pnlUsd: parsedPnl,
          notes,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setTradeError(data.error || 'Could not log trade.');
        return;
      }
      setNotes('');
      await onRefreshDashboard();
    } catch {
      setTradeError('Network error logging trade.');
    } finally {
      setTradeBusy(false);
    }
  };

  const handleOpenCertificate = async (certId: string) => {
    setCertError('');
    setLoadingCert(true);
    try {
      const resp = await fetch(`/api/certificates/${encodeURIComponent(certId)}`);
      const data = await resp.json();
      if (!resp.ok || !data.certificate) {
        setCertError(data.error || 'Certificate not yet issued for this reference.');
        return;
      }
      setActiveCertificate(data.certificate as TraderCertificate);
    } catch {
      setCertError('Could not load certificate verification record.');
    } finally {
      setLoadingCert(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!activeAccount) return;
    setPayoutMsg('');
    setPayoutError('');
    const cleanWallet = bnbAddress.trim();
    if (!cleanWallet || cleanWallet.length < 16) {
      setPayoutError('Enter a valid BNB BEP20 (Smart Chain) wallet address.');
      return;
    }
    setPayoutBusy(true);
    setPayoutAnimStage('verifying');
    try {
      await new Promise((r) => setTimeout(r, 550));
      setPayoutAnimStage('broadcasting');
      const [resp] = await Promise.all([
        fetch('/api/dashboard/payouts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            accountId: activeAccount.id,
            method: payoutMethod,
            walletAddress: cleanWallet,
          }),
        }),
        new Promise((r) => setTimeout(r, 650)),
      ]);
      const data = await resp.json();
      if (!resp.ok) {
        setPayoutAnimStage('idle');
        setPayoutError(data.error || 'Payout request failed.');
        return;
      }
      setPayoutAnimStage('confirmed');
      setPayoutMsg(
        `Payout of ${formatUsd(data.payout.amountUsd)} queued via ${data.payout.method} (Max 24h settlement).`
      );
      if (data.certificate) {
        setActiveCertificate(data.certificate as TraderCertificate);
      }
      setBnbAddress('');
      await onRefreshDashboard();
      setTimeout(() => {
        setPayoutAnimStage((prev) => (prev === 'confirmed' ? 'idle' : prev));
      }, 3600);
    } catch {
      setPayoutAnimStage('idle');
      setPayoutError('Network error requesting payout.');
    } finally {
      setPayoutBusy(false);
    }
  };

  const initials = user.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'LF';

  const memberSinceLabel = useMemo(() => {
    const raw = user.createdAtIso ? new Date(user.createdAtIso) : new Date();
    if (Number.isNaN(raw.getTime())) return 'Member since 2026';
    return `Member since ${raw.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
  }, [user.createdAtIso]);

  const pageTitles: Record<DashboardPage, string> = {
    overview: 'Overview',
    accounts: 'Challenges',
    challenges: 'Challenges',
    checkout: 'Checkout',
    terminal: 'Trading Terminal',
    journal: 'Trade Review',
    analytics: 'Analytics',
    payouts: 'Payouts',
    orders: 'Orders',
    certificates: 'Certificates',
    affiliate: 'Affiliate',
    wallet: 'Wallet',
    rewards: 'Rewards',
    profile: 'Profile',
    credentials: 'Credentials',
    downloads: 'Terminal App',
    kyc: 'KYC',
    support: 'Support',
  };

  const sidebarSections: {
    group: string;
    items: {
      id: DashboardPage;
      label: string;
      icon: typeof Home;
      badge?: string;
    }[];
  }[] = [
    {
      group: 'TRADING',
      items: [
        { id: 'overview', label: 'Overview', icon: Home },
        { id: 'accounts', label: 'Challenges', icon: CreditCard },
        { id: 'terminal', label: 'Trading', icon: BarChart3 },
        { id: 'journal', label: 'Trade Review', icon: ShieldCheck },
      ],
    },
    {
      group: 'PERFORMANCE',
      items: [
        { id: 'analytics', label: 'Analytics', icon: Activity },
        { id: 'payouts', label: 'Payouts', icon: Wallet },
        { id: 'orders', label: 'Orders', icon: Receipt },
        { id: 'certificates', label: 'Certificates', icon: Award },
        { id: 'affiliate', label: 'Affiliate', icon: Sparkles, badge: 'NEW' },
        { id: 'wallet', label: 'Wallet', icon: Wallet, badge: 'NEW' },
        { id: 'rewards', label: 'Rewards', icon: Gift },
      ],
    },
    {
      group: 'ACCOUNT',
      items: [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'credentials', label: 'Credentials', icon: Settings },
        { id: 'kyc', label: 'KYC', icon: ShieldCheck },
      ],
    },
    {
      group: 'SUPPORT',
      items: [{ id: 'support', label: 'Support', icon: HelpCircle }],
    },
  ];

  const netPnlActive = activeAccount
    ? activeAccount.currentEquity - activeAccount.startingBalance
    : 0;

  const openCheckoutPage = (preset?: {
    mode?: ChallengeMode;
    size?: AccountSize;
    split?: ProfitSplitOption;
    promoCode?: string;
  }) => {
    if (preset?.mode) setDashMode(preset.mode);
    if (preset?.size) setCheckoutSize(preset.size);
    if (preset?.split) setDashSplit(preset.split);
    if (preset?.promoCode) setCheckoutPromoInput(preset.promoCode);
    setCheckoutStep('configure');
    setCheckoutError('');
    setMobileDrawerOpen(false);
    onChangePage('checkout');
  };

  const renderSidebarNavContent = (isDrawer: boolean) => (
    <div className="flex flex-col h-full justify-between">
      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        {/* Brand Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/[0.08]">
          <button
            type="button"
            onClick={onBackToSite}
            className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer"
          >
            <LemonLogo size={32} rounded="lg" />
            {(sidebarExpanded || isDrawer) && (
              <div className="min-w-0">
                <p className="font-display font-bold text-sm text-white truncate leading-tight">
                  LemonFunding
                </p>
                <p className="text-[11px] text-zinc-400 truncate">Prop Trading</p>
              </div>
            )}
          </button>

          {isDrawer && (
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              aria-label="Close sidebar"
              className="w-9 h-9 rounded-full bg-[#18181B] border border-white/[0.1] flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Full-Width White Pill + New Challenge CTA */}
        <button
          type="button"
          onClick={() => openCheckoutPage()}
          className={`w-full py-2.5 px-3.5 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs ${
            !sidebarExpanded && !isDrawer ? 'px-0' : ''
          }`}
          title="New Challenge"
        >
          <Plus className="w-4 h-4 shrink-0" />
          {(sidebarExpanded || isDrawer) && <span>New Challenge</span>}
        </button>

        {/* Admin Panel Quick Button */}
        {user.isAdmin && onOpenAdmin && (
          <button
            type="button"
            onClick={() => {
              setMobileDrawerOpen(false);
              onOpenAdmin();
            }}
            className="w-full py-2.5 px-3.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 truncate">
              <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400" />
              {(sidebarExpanded || isDrawer) && <span>Admin Panel</span>}
            </span>
            {(sidebarExpanded || isDrawer) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400 text-[#09090B] font-extrabold">
                OWNER
              </span>
            )}
          </button>
        )}

        {/* Section Nav Groups matching Constant Funded screenshots */}
        <nav aria-label="Workspace navigation" className="space-y-5">
          {sidebarSections.map((sec) => (
            <div key={sec.group} className="space-y-1">
              {(sidebarExpanded || isDrawer) && (
                <p className="px-2.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
                  {sec.group}
                </p>
              )}
              {sec.items.map((item) => {
                const Icon = item.icon;
                const active =
                  activePage === item.id ||
                  (item.id === 'accounts' && activePage === 'challenges') ||
                  (item.id === 'credentials' && activePage === 'downloads');
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      onChangePage(item.id);
                    }}
                    title={item.label}
                    className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#18181B] text-white border border-white/[0.08]'
                        : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white border border-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-zinc-500'}`} />
                      {(sidebarExpanded || isDrawer) && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </span>
                    {(sidebarExpanded || isDrawer) && item.badge && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 text-[10px] font-bold tracking-wider shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom User Footer Card */}
      <div className="p-3 border-t border-white/[0.08] bg-[#0B0B0D]">
        <div className="flex items-center justify-between gap-2.5 px-1.5 py-1">
          <button
            type="button"
            onClick={() => {
              setMobileDrawerOpen(false);
              onChangePage('profile');
            }}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer flex-1"
          >
            <div className="w-9 h-9 rounded-full bg-[#27272A] border border-white/[0.1] text-white font-semibold text-xs flex items-center justify-center shrink-0">
              {initials}
            </div>
            {(sidebarExpanded || isDrawer) && (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate leading-tight">
                  {user.fullName}
                </p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
            )}
          </button>

          {(sidebarExpanded || isDrawer) && (
            <button
              type="button"
              onClick={onSignOut}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-white/[0.05] cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const heroTargetUsd = activeAccount?.targetUsd || 300;
  const heroNetProfitUsd = Math.max(0, deskMetrics.netDeltaUsd);
  const heroProgressPct =
    heroTargetUsd > 0
      ? Math.max(2, Math.min(100, Math.round((heroNetProfitUsd / heroTargetUsd) * 100)))
      : 100;

  return (
    <section
      id="dashboard-overview"
      data-testid="trader-dashboard"
      className="min-h-screen bg-[#09090B] text-white flex flex-col"
    >
      <div className="flex flex-1 min-h-0">
        {/* Desktop Persistent Dark Sidebar */}
        <aside
          aria-label="Dashboard sidebar"
          className={`hidden md:flex flex-col bg-[#0C0C0E] border-r border-white/[0.08] shrink-0 transition-all duration-200 ${
            sidebarExpanded ? 'w-[248px]' : 'w-[74px]'
          }`}
        >
          {renderSidebarNavContent(false)}
        </aside>

        {/* Mobile Slide-Out Sidebar Drawer */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div
              className="fixed inset-0 bg-black/75 backdrop-blur-xs"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <div className="relative w-[280px] max-w-[85vw] bg-[#0C0C0E] border-r border-white/[0.1] h-full shadow-2xl z-10 flex flex-col">
              {renderSidebarNavContent(true)}
            </div>
          </div>
        )}

        {/* Right Main Column */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Sleek Dark Institutional Top Bar */}
          <header className="h-16 bg-[#09090B]/95 backdrop-blur-md border-b border-white/[0.08] px-3 sm:px-6 flex items-center justify-between gap-2 sticky top-0 z-30">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                aria-label="Open workspace menu"
                className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-[#141417] border border-white/[0.08] text-zinc-200 hover:text-white cursor-pointer shrink-0"
              >
                <PanelLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setSidebarExpanded((prev) => !prev)}
                aria-label="Toggle sidebar labels"
                className="hidden md:inline-flex w-9 h-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-[#141417] hover:text-white cursor-pointer shrink-0"
              >
                <PanelLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 text-sm min-w-0">
                <button
                  type="button"
                  onClick={onBackToSite}
                  className="hidden sm:inline text-zinc-500 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  Home
                </button>
                <span className="hidden sm:inline text-zinc-600 shrink-0">→</span>
                <span className="font-semibold text-white truncate">
                  {pageTitles[activePage]}
                </span>
              </div>
            </div>

            {/* Right Utility Controls — Tested safe at 360px+ mobile width without clipping 3-dot */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {user.isAdmin && onOpenAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Admin Panel</span>
                </button>
              )}

              {/* White Pill + New Challenge */}
              <button
                type="button"
                onClick={() =>
                  openCheckoutPage({
                    promoCode: comebackEligible ? activeComebackCode : undefined,
                  })
                }
                aria-label="New Challenge"
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="sm:hidden">New</span>
                <span className="hidden sm:inline">New Challenge</span>
              </button>

              {/* Notification Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setBellOpen((p) => !p);
                    setUserMenuOpen(false);
                    setHeaderMoreOpen(false);
                  }}
                  aria-label="Notifications"
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-[#141417] border border-white/[0.08] text-zinc-300 hover:text-white transition-colors cursor-pointer relative shrink-0"
                >
                  <Bell className="w-4 h-4" />
                  {comebackEligible && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                </button>

                {bellOpen && (
                  <div className="absolute right-0 top-12 z-50 w-72 max-w-[calc(100vw-24px)] rounded-2xl bg-[#111113] border border-white/[0.1] shadow-2xl p-4 text-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                      <span className="font-bold text-white">Notifications</span>
                      <button
                        type="button"
                        onClick={() => setBellOpen(false)}
                        className="text-zinc-400 hover:text-white cursor-pointer p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {comebackEligible ? (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                        <p className="font-bold text-amber-300">
                          40% Off Comeback Unlocked
                        </p>
                        <p className="text-xs text-zinc-300">
                          Use <strong className="font-mono-tabular text-white">{activeComebackCode}</strong> at checkout for 40% off.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setBellOpen(false);
                            openCheckoutPage({ promoCode: activeComebackCode });
                          }}
                          className="w-full py-2 rounded-full bg-white text-[#09090B] font-bold text-xs cursor-pointer"
                        >
                          Use {activeComebackCode}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {accounts.length > 0
                          ? `You have ${deskMetrics.activeList.length} active account(s) synced on LemonFunding-Live.`
                          : 'Complete X & Instagram tasks under Rewards to earn 200 pts and unlock a free $5K 2-Step account.'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 3-Dot Quick Actions Menu (Always Visible & Tappable on 360px+ Mobile) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setHeaderMoreOpen((p) => !p);
                    setUserMenuOpen(false);
                    setBellOpen(false);
                  }}
                  aria-label="More rewards and code actions"
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-[#141417] border border-white/[0.08] text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {headerMoreOpen && (
                  <div className="absolute right-0 top-12 z-50 w-64 max-w-[calc(100vw-24px)] rounded-2xl bg-[#111113] border border-white/[0.1] shadow-2xl py-2 text-sm">
                    <div className="px-4 py-2.5 border-b border-white/[0.08] flex items-center justify-between">
                      <span className="font-bold text-white">Quick Actions</span>
                      <span className="font-mono-tabular font-bold text-emerald-400">
                        {user.rewardPoints ?? 0} pts
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMoreOpen(false);
                        setLocalFocusSecretCode(false);
                        onClearFocusSecretCode?.();
                        onChangePage('rewards');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-white/[0.05] font-semibold text-white flex items-center gap-2.5 cursor-pointer"
                    >
                      <Gift className="w-4 h-4 text-[#FACC15] shrink-0" />
                      <span>Rewards &amp; Tasks (+200 pts)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMoreOpen(false);
                        setLocalFocusSecretCode(true);
                        onChangePage('rewards');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-white/[0.05] font-semibold text-white flex items-center gap-2.5 cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Enter Secret Code</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMoreOpen(false);
                        onChangePage('kyc');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-white/[0.05] font-semibold text-white flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <FileCheck2 className="w-4 h-4 text-[#FACC15] shrink-0" />
                        <span>KYC Verification</span>
                      </span>
                      <span className="text-xs text-zinc-400">
                        {user.kycStatus === 'approved' ? 'Verified' : user.kycStatus === 'pending' ? 'Pending' : 'Required'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMoreOpen(false);
                        onChangePage('downloads');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-white/[0.05] font-semibold text-white flex items-center gap-2.5 cursor-pointer"
                    >
                      <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Install Terminal App</span>
                    </button>
                    {user.isAdmin && onOpenAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderMoreOpen(false);
                          onOpenAdmin();
                        }}
                        className="w-full px-4 py-3 text-left border-t border-white/[0.08] bg-amber-500/10 hover:bg-amber-500/20 font-bold text-amber-300 flex items-center gap-2.5 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <span>Owner Admin Panel</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMoreOpen(false);
                        onBackToSite();
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-white/[0.05] text-zinc-400 flex items-center gap-2.5 cursor-pointer border-t border-white/[0.06]"
                    >
                      <ArrowLeft className="w-4 h-4 shrink-0" />
                      <span>Back to Website</span>
                    </button>
                  </div>
                )}
              </div>

              {/* User Avatar Pill */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen((p) => !p);
                    setBellOpen(false);
                    setHeaderMoreOpen(false);
                  }}
                  aria-label="Trader account menu"
                  className="flex items-center gap-2 rounded-full bg-[#141417] border border-white/[0.08] p-1 sm:pl-3 hover:border-white/20 transition-colors cursor-pointer shrink-0"
                >
                  <span className="hidden sm:inline text-xs font-medium text-zinc-200 max-w-[110px] truncate">
                    {user.fullName}
                  </span>
                  <span className="w-7 h-7 rounded-full bg-[#27272A] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                    {initials}
                  </span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-12 z-50 w-60 max-w-[calc(100vw-24px)] rounded-2xl bg-[#111113] border border-white/[0.1] shadow-2xl py-2 text-sm">
                    <div className="px-4 py-2.5 border-b border-white/[0.08]">
                      <p className="font-bold text-white truncate">{user.fullName}</p>
                      <p className="text-xs text-emerald-400 truncate">
                        @{user.loginId} · {user.rewardPoints ?? 0} pts
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onChangePage('profile');
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-white/[0.05] text-zinc-200 flex items-center gap-2.5 cursor-pointer"
                    >
                      <User className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span>Trader Profile</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onChangePage('credentials');
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-white/[0.05] text-zinc-200 flex items-center gap-2.5 cursor-pointer"
                    >
                      <Key className="w-4 h-4 text-[#FACC15] shrink-0" />
                      <span>Account Credentials</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onChangePage('kyc');
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-white/[0.05] text-zinc-200 flex items-center gap-2.5 cursor-pointer"
                    >
                      <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>KYC Verification</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setPwaModalOpen(true);
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-white/[0.05] text-zinc-200 flex items-center gap-2.5 cursor-pointer"
                    >
                      <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Install Terminal App</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onSignOut();
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-red-500/15 text-red-400 font-semibold flex items-center gap-2.5 cursor-pointer border-t border-white/[0.08]"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Workspace Canvas */}
          <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1160px] w-full mx-auto">
            {user.isAdmin && onOpenAdmin && activePage === 'overview' && (
              <div className="mb-5 rounded-2xl bg-[#111113] text-white px-4 py-3 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-amber-500/25">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-white truncate">
                      Owner Admin Control Center · {user.email}
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      Manage BNB approvals, breached accounts audit, payouts &amp; 1,000 secret codes.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Open Owner Admin Panel</span>
                </button>
              </div>
            )}

            {/* ==================== PAGE 1: OVERVIEW (Constant Funded Dark Hero Layout) ==================== */}
            {activePage === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* KYC Alert when unverified */}
                {user.email !== 'demo@lemonfunding.com' && user.kycStatus !== 'approved' && (
                  <div className="rounded-2xl bg-[#111113] border border-amber-500/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <FileCheck2 className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {user.kycStatus === 'pending'
                            ? 'KYC Submitted — Pending Owner Admin Approval'
                            : 'Complete KYC Verification (PAN + Aadhaar) to Trade'}
                        </p>
                        <p className="text-xs text-zinc-400">
                          Required before placing trades on live evaluation or funded accounts.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onChangePage('kyc')}
                      className="px-4 py-2 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {user.kycStatus === 'pending' ? 'View Status' : 'Verify KYC'}
                    </button>
                  </div>
                )}

                {/* Comeback 40% Banner if eligible */}
                {comebackEligible && (
                  <div className="rounded-2xl bg-[#111113] border border-amber-500/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Comeback Access Unlocked — 40% Off ({activeComebackCode})
                        </p>
                        <p className="text-xs text-zinc-400">
                          Apply at checkout for 40% off your next evaluation challenge.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCheckoutPage({ promoCode: activeComebackCode })}
                      className="px-4 py-2 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Claim 40% Off
                    </button>
                  </div>
                )}

                {/* Hero Card: TOTAL TRADING CAPITAL (Screenshot 4 Top Block) */}
                <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-6 sm:p-8 space-y-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <span className="inline-flex items-center px-3.5 py-1 rounded-full bg-[#1C1C20] border border-white/[0.08] text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                      TOTAL TRADING CAPITAL
                    </span>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <span className="font-mono-tabular text-4xl sm:text-5xl font-bold text-white tracking-tight">
                        {formatUsd(deskMetrics.totalCapital)}.00
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold font-mono-tabular ${
                          deskMetrics.netDeltaUsd >= 0
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/15 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {deskMetrics.netDeltaUsd >= 0
                          ? `+${deskMetrics.netDeltaPct}%`
                          : `${deskMetrics.netDeltaPct}%`}
                      </span>
                    </div>

                    {/* Slim Emerald Progress Bar */}
                    <div className="w-full max-w-2xl h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${heroProgressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* 3 Inset Metric Tiles */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-[#161619] border border-white/[0.06] rounded-xl p-4">
                      <span className="text-xs text-zinc-400 block">Target progress</span>
                      <p className="font-mono-tabular text-base font-bold text-white mt-1">
                        {formatUsd(Math.max(0, deskMetrics.netDeltaUsd))}{' '}
                        <span className="text-zinc-500 font-normal">/ {formatUsd(heroTargetUsd)}</span>
                      </p>
                    </div>

                    <div className="bg-[#161619] border border-white/[0.06] rounded-xl p-4">
                      <span className="text-xs text-zinc-400 block">Payout status</span>
                      <p className="text-base font-semibold text-white mt-1">
                        {deskMetrics.withdrawableUsd >= 100
                          ? 'Eligible (BNB BEP20)'
                          : deskMetrics.fundedActiveCount > 0
                            ? 'Active funded ($100 min)'
                            : 'Not yet eligible'}
                      </p>
                    </div>

                    <div className="bg-[#161619] border border-white/[0.06] rounded-xl p-4">
                      <span className="text-xs text-zinc-400 block">Withdrawable</span>
                      <p className="font-mono-tabular text-base font-bold text-white mt-1">
                        {formatUsd(deskMetrics.withdrawableUsd)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Middle Row: Your Equity Chart + Frosted Mint Win Rate Card (Screenshot 4) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                  {/* Left 8 cols: Your Equity Chart */}
                  <div className="lg:col-span-8 bg-[#111113] rounded-2xl border border-white/[0.08] p-5 sm:p-6 flex flex-col justify-between space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                          <BarChart3 className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs text-zinc-400 block">Your Equity</span>
                          <span className="font-mono-tabular text-xl font-bold text-white">
                            {formatUsd(activeAccount?.currentEquity ?? deskMetrics.totalEquity)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 p-1 rounded-full bg-[#18181B] border border-white/[0.07] text-xs">
                        {(['1W', '1M', 'All'] as const).map((tf) => (
                          <button
                            key={tf}
                            type="button"
                            onClick={() => setEquityRange(tf)}
                            className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
                              equityRange === tf
                                ? 'bg-white text-[#09090B]'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            {tf}
                          </button>
                        ))}
                      </div>
                    </div>

                    {chartGeometry.pathD ? (
                      <div className="w-full">
                        <svg viewBox="0 0 620 210" className="w-full h-48" role="img" aria-label="Equity chart">
                          <defs>
                            <linearGradient id="cfEquityAreaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
                              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          {[40, 85, 130, 175].map((yPos) => (
                            <line
                              key={yPos}
                              x1="20"
                              y1={yPos}
                              x2="600"
                              y2={yPos}
                              stroke="rgba(255,255,255,0.06)"
                              strokeWidth="1"
                            />
                          ))}
                          <path d={chartGeometry.areaD} fill="url(#cfEquityAreaGrad)" />
                          <path
                            d={chartGeometry.pathD}
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {chartGeometry.nodes.map((n, i) => (
                            <circle
                              key={i}
                              cx={n.x}
                              cy={n.y}
                              r="4"
                              fill="#10B981"
                              stroke="#09090B"
                              strokeWidth="2"
                            />
                          ))}
                        </svg>
                        <div className="flex items-center justify-between text-[11px] font-mono-tabular text-zinc-500 px-2 pt-1">
                          {(chartGeometry.labels.length > 0
                            ? chartGeometry.labels
                            : ['D27', 'D28', 'D29', 'D30']
                          ).map((lbl, idx) => (
                            <span key={idx}>{lbl}</span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="h-48 flex flex-col items-center justify-center text-center space-y-2 border border-dashed border-white/[0.08] rounded-xl">
                        <p className="text-sm text-zinc-400">No equity points yet</p>
                        <button
                          type="button"
                          onClick={() => openCheckoutPage()}
                          className="px-4 py-1.5 rounded-full bg-white text-[#09090B] text-xs font-bold cursor-pointer"
                        >
                          Start Challenge
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right 4 cols: Signature Frosted Mint-to-Sky Win Rate Card */}
                  <div className="lg:col-span-4 rounded-2xl bg-gradient-to-br from-[#D1FAE5] via-[#E0F2FE] to-[#A7F3D0] text-[#09090B] p-5 sm:p-6 flex flex-col justify-between min-h-[250px]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/85 text-[#09090B] font-bold text-xs flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#09090B] truncate">{user.fullName}</p>
                        <p className="text-xs text-slate-700 truncate">{memberSinceLabel}</p>
                      </div>
                    </div>

                    <div className="my-4">
                      <span className="text-xs font-medium text-slate-700 block">Win Rate</span>
                      <p className="font-mono-tabular text-3xl sm:text-4xl font-bold text-[#09090B] mt-1">
                        {deskMetrics.winRateExact}%
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="grid grid-cols-4 gap-2 items-end h-14">
                        {deskMetrics.weekBars.slice(0, 4).map((b, i) => (
                          <div key={b.label} className="flex flex-col items-center gap-1 h-full justify-end">
                            <div
                              className={`w-full rounded-md ${
                                i === 3 ? 'bg-emerald-600/80' : 'bg-white/60'
                              }`}
                              style={{ height: `${Math.max(24, b.heightPct || 25)}%` }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-mono-tabular text-slate-700">
                        {['D27', 'D28', 'D29', 'D30'].map((d) => (
                          <span key={d}>{d}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Section: Active challenges (Screenshot 4 Bottom Block) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-semibold text-white">
                      Active challenges
                    </h2>
                    <button
                      type="button"
                      onClick={() => onChangePage('accounts')}
                      className="text-xs font-medium text-zinc-400 hover:text-white cursor-pointer"
                    >
                      View all
                    </button>
                  </div>

                  {deskMetrics.activeList.length === 0 ? (
                    <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-8 text-center space-y-3">
                      <p className="text-base font-semibold text-white">No active challenges yet</p>
                      <p className="text-sm text-zinc-400">
                        Pick a program or claim our $2 $5,000 Instant 2027 Bonus Offer.
                      </p>
                      <button
                        type="button"
                        onClick={() => openCheckoutPage({ mode: 'instant', size: 5000 })}
                        className="px-5 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] text-xs font-bold cursor-pointer"
                      >
                        Start Challenge
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {deskMetrics.activeList.slice(0, 6).map((acct) => {
                        const net = acct.currentEquity - acct.startingBalance;
                        const acctTrades = trades.filter((t) => t.accountId === acct.id);
                        const acctDayStats = computeTradingDayStats(acctTrades, acct.startingBalance);
                        const acctTradingDays = acctDayStats.validTradingDays;
                        const acctWins = acctTrades.filter((t) => t.pnlUsd > 0).length;
                        const acctWr =
                          acctTrades.length > 0
                            ? Math.round((acctWins / acctTrades.length) * 100)
                            : deskMetrics.winRate;
                        const pctBar =
                          acct.targetUsd > 0
                            ? Math.max(4, Math.min(100, Math.round((Math.max(0, net) / acct.targetUsd) * 100)))
                            : 100;
                        const isPending =
                          acct.status === 'Pending Approval' || acct.paymentStatus === 'pending_approval';
                        return (
                          <div
                            key={acct.id}
                            onClick={() => {
                              setSelectedAccountId(acct.id);
                              if (!isPending) onChangePage('terminal');
                            }}
                            className="bg-[#111113] hover:border-white/20 rounded-2xl border border-white/[0.08] p-5 space-y-4 transition-colors cursor-pointer"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-mono-tabular text-2xl font-bold text-white">
                                  {formatUsd(acct.currentEquity)}
                                </p>
                                <p className="font-mono-tabular text-xs text-zinc-500 mt-0.5 truncate">
                                  #{acct.accountNumber} · {acct.modeLabel}
                                </p>
                              </div>
                              <span
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 ${
                                  isPending
                                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                                    : acct.status === 'Instant Funded' || acct.status === 'Target Passed'
                                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                                }`}
                              >
                                {isPending
                                  ? 'Pending'
                                  : acct.status === 'Instant Funded'
                                    ? 'Funded'
                                    : acct.status === 'Target Passed'
                                      ? 'Passed'
                                      : 'Phase 1'}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="text-zinc-500 block">P&amp;L</span>
                                <span
                                  className={`font-mono-tabular font-semibold ${
                                    net >= 0 ? 'text-emerald-400' : 'text-red-400'
                                  }`}
                                >
                                  {net >= 0 ? `+${formatUsd(net)}` : `-${formatUsd(Math.abs(net))}`}
                                </span>
                              </div>
                              <div>
                                <span className="text-zinc-500 block">Win rate</span>
                                <span className="font-mono-tabular font-semibold text-white">
                                  {acctWr}%
                                </span>
                              </div>
                              <div>
                                <span className="text-zinc-500 block">Valid days (0.50%)</span>
                                <span className="font-mono-tabular font-semibold text-white">
                                  {acctTradingDays}/{acctDayStats.requiredDays}
                                </span>
                              </div>
                            </div>

                            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${pctBar}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ==================== PAGE: IN-DASHBOARD CHECKOUT (Screenshot 2 Match) ==================== */}
            {activePage === 'checkout' && (
              <div className="max-w-4xl mx-auto pb-24 space-y-7">
                <div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
                    Checkout
                  </h1>
                  <p className="text-sm text-zinc-400 mt-1">
                    Pick a program and account size. Your account is set up on Lemon Terminal as soon as BNB payment clears.
                  </p>
                </div>

                {checkoutStep === 'submitted' && checkoutSuccessAccount ? (
                  <div className="bg-[#111113] rounded-2xl border border-emerald-500/30 p-6 sm:p-8 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h2 className="font-display text-2xl font-bold text-white">
                      Order Submitted for Admin Verification
                    </h2>
                    <p className="text-sm text-zinc-400 max-w-md mx-auto">
                      Account <strong className="font-mono-tabular text-white">#{checkoutSuccessAccount.accountNumber}</strong> ({checkoutSuccessAccount.modeLabel} · {formatUsd(checkoutSuccessAccount.accountSize)}) is queued in the Admin Panel. It activates automatically upon payment confirmation.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => onChangePage('accounts')}
                        className="px-5 py-2.5 rounded-full bg-white text-[#09090B] text-xs font-bold cursor-pointer"
                      >
                        View Challenges
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCheckoutStep('configure');
                          setCheckoutSuccessAccount(null);
                        }}
                        className="px-5 py-2.5 rounded-full bg-[#18181B] border border-white/[0.1] text-white text-xs font-semibold cursor-pointer"
                      >
                        Buy Another Account
                      </button>
                    </div>
                  </div>
                ) : checkoutStep === 'payment' ? (
                  <div className="space-y-4">
                    {checkoutError && (
                      <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 font-semibold">
                        {checkoutError}
                      </div>
                    )}
                    <PaymentMethod
                      dark
                      amountUsd={effectivePromoResult.finalFeeUsd}
                      accountModeLabel={checkoutSpec.modeLabel}
                      accountSize={checkoutSize}
                      promoCodeApplied={effectivePromoResult.appliedCode || undefined}
                      discountPctApplied={effectivePromoResult.discountPct || undefined}
                      onPaymentConfirmed={handleCheckoutPaymentConfirmed}
                      onCancel={() => setCheckoutStep('configure')}
                    />
                  </div>
                ) : (
                  <>
                    {/* 01 Program */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono-tabular text-zinc-400 font-semibold">
                          01 &nbsp; <strong className="text-white text-sm font-sans">Program</strong>
                        </span>
                        <span className="text-zinc-500">One-time evaluation fee</span>
                      </div>

                      <div className="space-y-2.5">
                        {CHALLENGE_MODES.map((m) => {
                          const selected = dashMode === m.id;
                          const minFee = m.id === 'instant' ? 2 : m.id === 'two-step' ? 6 : 14;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setDashMode(m.id)}
                              className={`w-full rounded-xl border p-4 text-left transition-all flex items-center justify-between gap-4 cursor-pointer ${
                                selected
                                  ? 'bg-[#16161A] border-white'
                                  : 'bg-[#111113] border-white/[0.08] hover:border-white/25'
                              }`}
                            >
                              <div className="flex items-start gap-3.5 min-w-0">
                                <span
                                  className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                                    selected ? 'border-white' : 'border-zinc-600'
                                  }`}
                                >
                                  {selected && <span className="w-2 h-2 rounded-full bg-white" />}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-sm text-white">{m.label}</span>
                                    {m.id === 'instant' && (
                                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 text-[10px] font-bold">
                                        INSTANT · $2 5K 2027 OFFER
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-zinc-400 mt-0.5">{m.summary}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">
                                  FROM
                                </span>
                                <span className="font-mono-tabular font-bold text-sm text-white">
                                  ${minFee}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Expandable Rules Table */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setRulesExpanded((r) => !r)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
                        >
                          {rulesExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                          <span>{checkoutSpec.modeLabel} rules</span>
                        </button>

                        {rulesExpanded && (
                          <div className="mt-3 rounded-xl bg-[#111113] border border-white/[0.08] p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 text-xs">
                            <div className="flex justify-between py-1 border-b border-white/[0.05]">
                              <span className="text-zinc-400">Phase 1 target</span>
                              <span className="font-semibold text-white font-mono-tabular">
                                {checkoutSpec.phase1TargetPct > 0
                                  ? `${checkoutSpec.phase1TargetPct}%`
                                  : 'Instant Funded'}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-white/[0.05]">
                              <span className="text-zinc-400">Phase 2 target</span>
                              <span className="font-semibold text-white font-mono-tabular">
                                {checkoutSpec.phase2TargetPct ? `${checkoutSpec.phase2TargetPct}%` : 'None'}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-white/[0.05]">
                              <span className="text-zinc-400">Daily drawdown</span>
                              <span className="font-semibold text-white font-mono-tabular">
                                {checkoutSpec.dailyLossPct}%
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-white/[0.05]">
                              <span className="text-zinc-400">Maximum drawdown</span>
                              <span className="font-semibold text-white font-mono-tabular">
                                {checkoutSpec.maxDrawdownPct}%
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-white/[0.05]">
                              <span className="text-zinc-400">Drawdown type</span>
                              <span className="font-semibold text-white">
                                {checkoutSpec.drawdownRule}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-white/[0.05]">
                              <span className="text-zinc-400">Minimum trading days</span>
                              <span className="font-semibold text-white">
                                {checkoutSpec.minTradingDays} valid days
                              </span>
                            </div>
                            {checkoutSpec.consistencyRulePct && (
                              <div className="flex justify-between py-1 border-b border-white/[0.05]">
                                <span className="text-zinc-400">Consistency &amp; Float Loss</span>
                                <span className="font-semibold text-emerald-400">
                                  {checkoutSpec.consistencyRulePct}% / {checkoutSpec.floatingLossRulePct}% Float
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between py-1 border-b border-white/[0.05]">
                              <span className="text-zinc-400">Funded payouts</span>
                              <span className="font-semibold text-white">BNB BEP20 (Max 24h)</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 02 Account Size */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono-tabular text-zinc-400 font-semibold">
                          02 &nbsp; <strong className="text-white text-sm font-sans">Account size</strong>
                        </span>
                        <span className="text-zinc-500">Simulated balance</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {ACCOUNT_SIZES.map((sz) => {
                          const spec = getChallengeSpec(dashMode, sz, dashSplit);
                          const selected = checkoutSize === sz;
                          const isBonus2 = dashMode === 'instant' && sz === 5000;
                          return (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => setCheckoutSize(sz)}
                              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                                selected
                                  ? 'bg-[#18181C] border-white'
                                  : 'bg-[#111113] border-white/[0.08] hover:border-white/25'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-mono-tabular font-bold text-sm text-white">
                                  {formatUsd(sz)}
                                </span>
                                {isBonus2 && (
                                  <span className="text-[10px] font-bold text-emerald-400">2027</span>
                                )}
                              </div>
                              <span className="font-mono-tabular text-xs text-zinc-400 mt-0.5 block">
                                {formatUsd(spec.feeUsd)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 03 Profit Split & Promo Code */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono-tabular text-zinc-400 font-semibold">
                          03 &nbsp; <strong className="text-white text-sm font-sans">Add-ons &amp; Coupon</strong>
                        </span>
                        <span className="text-zinc-500">Optional</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setDashSplit((prev) => (prev === 80 ? 90 : 80))}
                        className={`w-full rounded-xl border p-4 text-left flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          dashSplit === 90
                            ? 'bg-[#16161A] border-white'
                            : 'bg-[#111113] border-white/[0.08] hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              dashSplit === 90
                                ? 'bg-white border-white text-[#09090B]'
                                : 'border-zinc-600'
                            }`}
                          >
                            {dashSplit === 90 && <Check className="w-3 h-3" />}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-white">90% Profit Split Boost</p>
                            <p className="text-xs text-zinc-400">
                              Upgrade from standard 80% to 90% profit split on funded payouts.
                            </p>
                          </div>
                        </div>
                        <span className="font-mono-tabular text-xs font-bold text-zinc-300 shrink-0">
                          +15%
                        </span>
                      </button>

                      {/* Promo / Giveaway Code Checker (1-Use-Per-Account) */}
                      <div className="rounded-xl bg-[#111113] border border-white/[0.08] p-4 space-y-2">
                        <label className="block text-xs font-semibold text-zinc-300">
                          Promo / Giveaway Coupon Code (1 use per account)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={checkoutPromoInput}
                            onChange={(e) => {
                              setCheckoutPromoInput(e.target.value.toUpperCase());
                              setPromoServerCheck(null);
                            }}
                            placeholder="Enter coupon code"
                            className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.08] font-mono-tabular text-xs font-bold text-white uppercase placeholder:text-zinc-500 focus:outline-none focus:border-white"
                          />
                          <button
                            type="button"
                            disabled={promoValidating || !normalizedPromo}
                            onClick={handleValidateCheckoutPromo}
                            className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-45 text-[#09090B] text-xs font-bold cursor-pointer whitespace-nowrap"
                          >
                            {promoValidating ? 'Checking...' : 'Apply'}
                          </button>
                        </div>
                        {promoServerCheck && !promoServerCheck.valid && (
                          <p className="text-xs text-red-400">{promoServerCheck.error}</p>
                        )}
                        {alreadyUsedThisCoupon && !promoServerCheck && (
                          <p className="text-xs text-red-400">
                            Coupon {normalizedPromo} already redeemed on this account.
                          </p>
                        )}
                        {effectivePromoResult.valid && (
                          <p className="text-xs text-emerald-400 font-semibold">
                            {effectivePromoResult.appliedCode} applied (-{effectivePromoResult.discountPct}% off · Saving {formatUsd(effectivePromoResult.discountUsd)})
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 04 Billing Details */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono-tabular text-zinc-400 font-semibold">
                          04 &nbsp; <strong className="text-white text-sm font-sans">Billing details</strong>
                        </span>
                        <span className="text-zinc-500">For your invoice</span>
                      </div>

                      <div className="rounded-xl bg-[#111113] border border-white/[0.08] p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">First name *</label>
                          <input
                            type="text"
                            value={billingFirstName}
                            onChange={(e) => setBillingFirstName(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">Last name *</label>
                          <input
                            type="text"
                            value={billingLastName}
                            onChange={(e) => setBillingLastName(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">Email *</label>
                          <input
                            type="email"
                            value={user.email}
                            readOnly
                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.08] text-sm text-zinc-300"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">Country *</label>
                          <input
                            type="text"
                            value={billingCountry}
                            onChange={(e) => setBillingCountry(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sticky Checkout Summary Bar */}
                    <div className="sticky bottom-3 z-20 rounded-2xl bg-[#111113]/95 backdrop-blur-md border border-white/[0.12] px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 shadow-2xl">
                      <div>
                        <p className="text-xs text-zinc-400">
                          {checkoutSpec.modeLabel} · {formatUsd(checkoutSize)}
                        </p>
                        <p className="font-mono-tabular text-xl sm:text-2xl font-bold text-white">
                          {formatUsd(effectivePromoResult.finalFeeUsd)}.00
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCheckoutStep('payment')}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] text-sm font-bold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Place order</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ==================== PAGE: CHALLENGES / ACCOUNTS ==================== */}
            {(activePage === 'accounts' || activePage === 'challenges') && (
              <motion.div
                key="accounts"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-white">
                      Your Challenges
                    </h1>
                    <p className="text-sm text-zinc-400">
                      Manage active evaluations, funded accounts, credentials, and terminal access.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCheckoutPage()}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Challenge</span>
                  </button>
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111113] rounded-2xl border border-white/[0.08] p-3.5">
                  <div className="grid grid-cols-3 gap-2 flex-1 min-w-[240px]">
                    <select
                      aria-label="Filter by account type"
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as 'all' | ChallengeMode)}
                      className="px-3 py-2 rounded-xl bg-[#18181B] border border-white/[0.08] text-xs font-medium text-white"
                    >
                      <option value="all">All Types</option>
                      <option value="two-step">2-Step</option>
                      <option value="one-step">1-Step</option>
                      <option value="instant">Instant</option>
                    </select>

                    <select
                      aria-label="Filter by account state"
                      value={stateFilter}
                      onChange={(e) =>
                        setStateFilter(
                          e.target.value as 'all' | 'active' | 'passed' | 'breached' | 'pending'
                        )
                      }
                      className="px-3 py-2 rounded-xl bg-[#18181B] border border-white/[0.08] text-xs font-medium text-white"
                    >
                      <option value="all">All States</option>
                      <option value="active">Active</option>
                      <option value="pending">Pending Approval</option>
                      <option value="passed">Passed</option>
                      <option value="breached">Breached</option>
                    </select>

                    <select
                      aria-label="Filter by phase"
                      value={phaseFilter}
                      onChange={(e) =>
                        setPhaseFilter(
                          e.target.value as 'all' | 'phase1' | 'funded' | 'closed'
                        )
                      }
                      className="px-3 py-2 rounded-xl bg-[#18181B] border border-white/[0.08] text-xs font-medium text-white"
                    >
                      <option value="all">All Phases</option>
                      <option value="phase1">Phase 1</option>
                      <option value="funded">Funded / Passed</option>
                      <option value="closed">Breached</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAccountsViewMode('stack')}
                      aria-label="Card view"
                      className={`p-2 rounded-xl border text-xs cursor-pointer ${
                        accountsViewMode === 'stack'
                          ? 'bg-white text-[#09090B] border-white'
                          : 'bg-[#18181B] text-zinc-400 border-white/[0.08]'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountsViewMode('list')}
                      aria-label="Grid view"
                      className={`p-2 rounded-xl border text-xs cursor-pointer ${
                        accountsViewMode === 'list'
                          ? 'bg-white text-[#09090B] border-white'
                          : 'bg-[#18181B] text-zinc-400 border-white/[0.08]'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Accounts Cards Grid */}
                <div
                  className={
                    accountsViewMode === 'list'
                      ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
                      : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                  }
                >
                  {filteredAccounts.length === 0 ? (
                    <div className="col-span-full bg-[#111113] rounded-2xl border border-white/[0.08] p-10 text-center space-y-3">
                      <p className="text-base font-bold text-white">
                        {accounts.length === 0
                          ? 'No trading accounts yet'
                          : 'No accounts match selected filters'}
                      </p>
                      <p className="text-sm text-zinc-400">
                        {accounts.length === 0
                          ? 'Purchase your first evaluation or $2 5K Instant bonus offer.'
                          : 'Adjust one of the filters above.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => openCheckoutPage()}
                        className="px-5 py-2.5 rounded-full bg-white text-[#09090B] text-xs font-bold cursor-pointer"
                      >
                        Start Challenge
                      </button>
                    </div>
                  ) : (
                    filteredAccounts.map((acct) => {
                      const isPending =
                        acct.status === 'Pending Approval' || acct.paymentStatus === 'pending_approval';
                      const breached = acct.status === 'Breached';
                      const passed = acct.status === 'Target Passed';
                      const netPnl = acct.currentEquity - acct.startingBalance;
                      const targetProgress =
                        acct.targetUsd > 0
                          ? Math.max(0, Math.min(100, Math.round((netPnl / acct.targetUsd) * 100)))
                          : 100;
                      const acctTrades = trades.filter((t) => t.accountId === acct.id);
                      const acctDayStats = computeTradingDayStats(acctTrades, acct.startingBalance);
                      const acctTradingDays = acctDayStats.validTradingDays;
                      const menuOpenHere = openCardMenuId === acct.id;

                      return (
                        <div
                          key={acct.id}
                          className={`bg-[#111113] rounded-2xl border p-5 relative space-y-4 ${
                            isPending
                              ? 'border-amber-500/40'
                              : breached
                                ? 'border-red-500/30'
                                : 'border-white/[0.08] hover:border-white/25'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-mono-tabular text-2xl font-bold text-white">
                                {formatUsd(acct.currentEquity)}
                              </p>
                              <p className="font-mono-tabular text-xs text-zinc-500 mt-0.5 truncate">
                                #{acct.accountNumber} · {acct.modeLabel}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 relative shrink-0">
                              <span
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                  isPending
                                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                                    : breached
                                      ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                                      : passed || acct.status === 'Instant Funded'
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                                }`}
                              >
                                {isPending
                                  ? 'Pending'
                                  : breached
                                    ? 'Breached'
                                    : acct.status === 'Active Evaluation'
                                      ? 'Phase 1'
                                      : acct.status}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  setOpenCardMenuId((prev) => (prev === acct.id ? null : acct.id))
                                }
                                aria-label={`Actions for ${acct.accountNumber}`}
                                className="p-1.5 rounded-lg hover:bg-white/[0.08] text-zinc-400 hover:text-white cursor-pointer"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {menuOpenHere && (
                                <div className="absolute right-0 top-9 z-30 w-52 rounded-xl bg-[#18181B] border border-white/[0.12] shadow-2xl py-1.5 text-xs">
                                  {!breached && !isPending && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenCardMenuId(null);
                                        setSelectedAccountId(acct.id);
                                        onChangePage('terminal');
                                      }}
                                      className="w-full px-3.5 py-2 text-left hover:bg-white/[0.06] font-bold text-emerald-400 flex items-center gap-2 cursor-pointer"
                                    >
                                      <Terminal className="w-3.5 h-3.5" />
                                      <span>Open Lemon Terminal</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenCardMenuId(null);
                                      setCredentialsModalAccount(acct);
                                    }}
                                    className="w-full px-3.5 py-2 text-left hover:bg-white/[0.06] font-semibold text-white flex items-center gap-2 cursor-pointer"
                                  >
                                    <Key className="w-3.5 h-3.5 text-[#FACC15]" />
                                    <span>Login Credentials</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenCardMenuId(null);
                                      setSelectedAccountId(acct.id);
                                      onChangePage('journal');
                                    }}
                                    className="w-full px-3.5 py-2 text-left hover:bg-white/[0.06] text-zinc-300 flex items-center gap-2 cursor-pointer"
                                  >
                                    <BookOpen className="w-3.5 h-3.5" />
                                    <span>Trade Review</span>
                                  </button>
                                  {breached && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenCardMenuId(null);
                                        openCheckoutPage({
                                          size: acct.accountSize,
                                          mode: acct.mode,
                                          promoCode: activeComebackCode,
                                        });
                                      }}
                                      className="w-full px-3.5 py-2 text-left hover:bg-white/[0.06] font-bold text-amber-300 flex items-center gap-2 cursor-pointer"
                                    >
                                      <Sparkles className="w-3.5 h-3.5" />
                                      <span>Claim 40% ({activeComebackCode})</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-zinc-500 block">P&amp;L</span>
                              <span
                                className={`font-mono-tabular font-bold ${
                                  netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              >
                                {netPnl >= 0
                                  ? `+${formatUsd(netPnl)}`
                                  : `-${formatUsd(Math.abs(netPnl))}`}
                              </span>
                            </div>
                            <div>
                              <span className="text-zinc-500 block">Target</span>
                              <span className="font-mono-tabular font-bold text-white">
                                {acct.mode === 'instant'
                                  ? 'No Passing'
                                  : acct.targetUsd > 0
                                    ? `${targetProgress}%`
                                    : 'Passed'}
                              </span>
                            </div>
                            <div>
                              <span className="text-zinc-500 block">Valid days (0.50%)</span>
                              <span className="font-mono-tabular font-bold text-white">
                                {acctTradingDays}/{acctDayStats.requiredDays}
                              </span>
                            </div>
                          </div>

                          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                breached ? 'bg-red-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.max(4, targetProgress)}%` }}
                            />
                          </div>

                          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2 text-xs">
                            <span className="text-zinc-500 font-mono-tabular">
                              DD: {acct.dailyLossPct}% / {acct.maxDrawdownPct}%
                            </span>
                            {isPending ? (
                              <span className="text-amber-300 font-semibold flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                Awaiting Approval
                              </span>
                            ) : breached ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openCheckoutPage({
                                    size: acct.accountSize,
                                    mode: acct.mode,
                                    promoCode: activeComebackCode,
                                  })
                                }
                                className="px-3 py-1.5 rounded-full bg-amber-400 text-[#09090B] font-bold cursor-pointer"
                              >
                                Reset -40%
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAccountId(acct.id);
                                  onChangePage('terminal');
                                }}
                                className="px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] font-bold cursor-pointer"
                              >
                                Trade →
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {/* ==================== PAGE: ANALYTICS ==================== */}
            {activePage === 'analytics' && (
              <div className="space-y-6">
                <div>
                  <h1 className="font-display text-2xl font-bold text-white">Analytics</h1>
                  <p className="text-sm text-zinc-400">
                    Behavioral bias, score index, and weekday execution performance.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-6 bg-[#111113] rounded-2xl border border-white/[0.08] p-6 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                          Score Index
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="font-mono-tabular text-3xl font-bold text-white">
                            {deskMetrics.scoreIndex.toFixed(2)}
                          </span>
                          <span className="text-xs text-zinc-400">/ 100</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold">
                        {deskMetrics.tierLabel}
                      </span>
                    </div>

                    <div className="flex items-center justify-center my-4">
                      <svg viewBox="0 0 220 192" className="w-full max-w-[300px] h-52" role="img">
                        {radarPolygon.gridPolygons.map((pts, i) => (
                          <polygon
                            key={i}
                            points={pts}
                            fill="none"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="1"
                          />
                        ))}
                        {radarPolygon.axes.map((ax, i) => (
                          <g key={i}>
                            <line
                              x1={ax.x1}
                              y1={ax.y1}
                              x2={ax.x2}
                              y2={ax.y2}
                              stroke="rgba(255,255,255,0.1)"
                              strokeWidth="1"
                            />
                            <text
                              x={ax.lx}
                              y={ax.ly}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="#A1A1AA"
                              fontSize="8.5"
                              fontWeight="600"
                            >
                              {ax.label}
                            </text>
                          </g>
                        ))}
                        <polygon
                          points={radarPolygon.dataPts}
                          fill="rgba(16, 185, 129, 0.28)"
                          stroke="#10B981"
                          strokeWidth="2"
                        />
                        <circle cx={radarPolygon.cx} cy={radarPolygon.cy} r="3" fill="#10B981" />
                      </svg>
                    </div>
                  </div>

                  <div className="lg:col-span-6 bg-[#111113] rounded-2xl border border-white/[0.08] p-6 space-y-6">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">
                        Behavioral Bias
                      </span>
                      <div className="flex items-end justify-between gap-4 mt-4">
                        <div>
                          <span className="font-mono-tabular text-3xl font-bold text-emerald-400">
                            {deskMetrics.longPct}%
                          </span>
                          <span className="text-xs text-zinc-400 block">Long ({deskMetrics.buyCount})</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono-tabular text-3xl font-bold text-white">
                            {deskMetrics.shortPct}%
                          </span>
                          <span className="text-xs text-zinc-400 block">Short ({deskMetrics.sellCount})</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden flex mt-3">
                        <div className="h-full bg-emerald-500" style={{ width: `${deskMetrics.longPct}%` }} />
                        <div className="h-full bg-zinc-400" style={{ width: `${deskMetrics.shortPct}%` }} />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/[0.08]">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                          Weekly Execution
                        </span>
                        <span
                          className={`font-mono-tabular text-sm font-bold ${
                            deskMetrics.weekPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {deskMetrics.weekPnl >= 0
                            ? `+${formatUsd(deskMetrics.weekPnl)}`
                            : `-${formatUsd(Math.abs(deskMetrics.weekPnl))}`}
                        </span>
                      </div>
                      <div className="h-32 flex items-end justify-between gap-2 pt-2 border-b border-white/[0.08]">
                        {deskMetrics.weekBars.map((bar) => (
                          <div key={bar.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                            <div
                              className="w-4 rounded-t bg-emerald-500"
                              style={{ height: `${Math.max(12, bar.heightPct)}%` }}
                            />
                            <span className="text-[11px] font-mono-tabular text-zinc-400 pb-1">
                              {bar.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== PAGE: ORDERS ==================== */}
            {activePage === 'orders' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-white">Orders</h1>
                    <p className="text-sm text-zinc-400">
                      BNB BEP20 challenge orders, promo codes applied, and approval statuses.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCheckoutPage()}
                    className="px-4 py-2 rounded-full bg-white text-[#09090B] text-xs font-bold cursor-pointer"
                  >
                    + New Order
                  </button>
                </div>

                <div className="bg-[#111113] rounded-2xl border border-white/[0.08] overflow-hidden">
                  {accounts.length === 0 ? (
                    <div className="p-10 text-center text-sm text-zinc-400">
                      No orders placed yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-white/[0.08] text-xs text-zinc-400">
                            <th className="py-3.5 px-5">Account</th>
                            <th className="py-3.5 px-4">Program</th>
                            <th className="py-3.5 px-4">Method</th>
                            <th className="py-3.5 px-4">Promo</th>
                            <th className="py-3.5 px-4">Status</th>
                            <th className="py-3.5 px-5 text-right">Fee</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06]">
                          {accounts.map((a) => (
                            <tr key={a.id} className="hover:bg-white/[0.02]">
                              <td className="py-3.5 px-5 font-mono-tabular font-bold text-white">
                                #{a.accountNumber} · {formatUsd(a.accountSize)}
                              </td>
                              <td className="py-3.5 px-4 text-zinc-300">{a.modeLabel}</td>
                              <td className="py-3.5 px-4 text-zinc-400">
                                {a.paymentMethod || 'Crypto (BNB BEP20)'}
                              </td>
                              <td className="py-3.5 px-4 font-mono-tabular text-xs text-amber-300">
                                {a.promoCodeApplied ? `${a.promoCodeApplied} (-${a.discountPctApplied}%)` : '—'}
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                    a.paymentStatus === 'pending_approval' || a.status === 'Pending Approval'
                                      ? 'bg-amber-500/15 text-amber-300'
                                      : 'bg-emerald-500/15 text-emerald-400'
                                  }`}
                                >
                                  {a.paymentStatus === 'pending_approval' || a.status === 'Pending Approval'
                                    ? 'Pending Approval'
                                    : 'Verified'}
                                </span>
                              </td>
                              <td className="py-3.5 px-5 text-right font-mono-tabular font-bold text-white">
                                {formatUsd(a.feePaidUsd ?? 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================== PAGE: CERTIFICATES ==================== */}
            {activePage === 'certificates' && (
              <div className="space-y-5">
                <div>
                  <h1 className="font-display text-2xl font-bold text-white">Certificates</h1>
                  <p className="text-sm text-zinc-400">
                    Scannable QR certificates issued for passed evaluations and settled BNB BEP20 payouts.
                  </p>
                </div>

                {certError && (
                  <p className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300">
                    {certError}
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {accounts
                    .filter((a) => a.status === 'Target Passed' || a.status === 'Instant Funded')
                    .map((a) => (
                      <div
                        key={a.id}
                        className="bg-[#111113] rounded-2xl border border-white/[0.08] p-5 flex items-center justify-between gap-4"
                      >
                        <div>
                          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                            {a.status === 'Instant Funded' ? 'Funded Trader Certificate' : 'Target Passed Certificate'}
                          </span>
                          <h3 className="font-display text-base font-bold text-white mt-0.5">
                            {user.fullName} · #{a.accountNumber}
                          </h3>
                          <p className="text-xs text-zinc-400 font-mono-tabular mt-0.5">
                            {a.modeLabel} · {formatUsd(a.accountSize)}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={loadingCert}
                          onClick={() => handleOpenCertificate(`LF-CERT-PASS-${a.accountNumber}`)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] text-xs font-bold cursor-pointer shrink-0"
                        >
                          <QrCode className="w-4 h-4" />
                          <span>View QR</span>
                        </button>
                      </div>
                    ))}

                  {payouts.map((p) => (
                    <div
                      key={p.id}
                      className="bg-[#111113] rounded-2xl border border-white/[0.08] p-5 flex items-center justify-between gap-4"
                    >
                      <div>
                        <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                          Payout Certificate
                        </span>
                        <h3 className="font-display text-base font-bold text-white mt-0.5">
                          #{p.accountNumber} · {formatUsd(p.amountUsd)}
                        </h3>
                        <p className="text-xs text-zinc-400 font-mono-tabular mt-0.5">
                          {p.method} · {new Date(p.requestedAtIso).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={loadingCert}
                        onClick={() =>
                          handleOpenCertificate(p.certificateId || `LF-CERT-PAY-${p.id.toUpperCase()}`)
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] text-xs font-bold cursor-pointer shrink-0"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>View QR</span>
                      </button>
                    </div>
                  ))}
                </div>

                {accounts.filter((a) => a.status === 'Target Passed' || a.status === 'Instant Funded').length === 0 &&
                  payouts.length === 0 && (
                    <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-10 text-center space-y-2">
                      <Award className="w-8 h-8 text-zinc-500 mx-auto" />
                      <p className="text-base font-semibold text-white">No certificates unlocked yet</p>
                      <p className="text-sm text-zinc-400">
                        Pass an evaluation phase or unlock a funded payout to receive your official QR certificate.
                      </p>
                    </div>
                  )}
              </div>
            )}

            {/* ==================== PAGE: AFFILIATE ==================== */}
            {activePage === 'affiliate' && (
              <div className="max-w-3xl space-y-5">
                <div>
                  <h1 className="font-display text-2xl font-bold text-white">Affiliate &amp; Referrals</h1>
                  <p className="text-sm text-zinc-400">
                    Share LemonFunding and track your personal referral &amp; giveaway code rewards.
                  </p>
                </div>

                <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Your Referral Link
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                      NEW PROGRAM
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${encodeURIComponent(user.loginId)}`}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.08] font-mono-tabular text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={handleShareProfile}
                      className="px-5 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      {shareCopied ? 'Copied Link!' : 'Copy Invite Link'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== PAGE: WALLET ==================== */}
            {activePage === 'wallet' && (
              <div className="max-w-3xl space-y-5">
                <div>
                  <h1 className="font-display text-2xl font-bold text-white">Wallet</h1>
                  <p className="text-sm text-zinc-400">
                    Reward points balance, eligible funded withdrawals, and BNB BEP20 payout actions.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-6 space-y-3">
                    <span className="text-xs text-zinc-400 block">Reward Points</span>
                    <p className="font-mono-tabular text-3xl font-bold text-[#FACC15]">
                      {(user.rewardPoints ?? 0).toLocaleString('en-US')} PTS
                    </p>
                    <button
                      type="button"
                      onClick={() => onChangePage('rewards')}
                      className="px-4 py-2 rounded-full bg-white text-[#09090B] text-xs font-bold cursor-pointer"
                    >
                      Open Rewards &amp; Codes →
                    </button>
                  </div>

                  <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-6 space-y-3">
                    <span className="text-xs text-zinc-400 block">Withdrawable Profit (BNB BEP20)</span>
                    <p className="font-mono-tabular text-3xl font-bold text-emerald-400">
                      {formatUsd(deskMetrics.withdrawableUsd)}
                    </p>
                    <button
                      type="button"
                      onClick={() => onChangePage('payouts')}
                      className="px-4 py-2 rounded-full bg-[#18181B] border border-white/[0.1] text-white text-xs font-semibold cursor-pointer"
                    >
                      Request Payout →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== PAGE: PROFILE ==================== */}
            {activePage === 'profile' && (
              <div className="max-w-3xl space-y-5">
                <div>
                  <h1 className="font-display text-2xl font-bold text-white">Profile</h1>
                  <p className="text-sm text-zinc-400">
                    Registered trader identity, account tier, and used promo coupons.
                  </p>
                </div>

                <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-6 space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-[#27272A] text-white font-bold text-lg flex items-center justify-center">
                      {initials}
                    </div>
                    <div>
                      <h2 className="font-display text-xl font-bold text-white">{user.fullName}</h2>
                      <p className="text-xs text-zinc-400">
                        @{user.loginId} · {user.email}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-white/[0.08] text-xs">
                    <div className="p-3.5 rounded-xl bg-[#18181B] border border-white/[0.06]">
                      <span className="text-zinc-400 block">Trader Rank</span>
                      <span className="font-bold text-white text-sm mt-1 block">{deskMetrics.tierLabel}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#18181B] border border-white/[0.06]">
                      <span className="text-zinc-400 block">KYC Status</span>
                      <span className="font-bold text-emerald-400 text-sm mt-1 block uppercase">
                        {user.kycStatus}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#18181B] border border-white/[0.06]">
                      <span className="text-zinc-400 block">Coupons Used</span>
                      <span className="font-mono-tabular font-bold text-white text-sm mt-1 block">
                        {(user.usedCouponCodes || []).length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== PAGE: CREDENTIALS / DOWNLOADS ==================== */}
            {(activePage === 'credentials' || activePage === 'downloads') && (
              <div data-testid="downloads-page" className="max-w-3xl mx-auto space-y-6">
                <div>
                  <h1 className="font-display text-2xl font-bold text-white">
                    {activePage === 'credentials' ? 'Terminal Credentials & App' : 'Lemon Terminal App'}
                  </h1>
                  <p className="text-sm text-zinc-400 mt-1">
                    Servers <strong className="text-white">LemonFunding-Live</strong> &amp;{' '}
                    <strong className="text-white">LemonFunding-Demo</strong>. Copy account IDs or install the standalone terminal.
                  </p>
                </div>

                {accounts.length > 0 && (
                  <div className="space-y-3">
                    {accounts.map((acct) => (
                      <div
                        key={acct.id}
                        className="bg-[#111113] rounded-2xl border border-white/[0.08] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-mono-tabular font-bold text-white">
                            #{acct.accountNumber} · {acct.modeLabel}
                          </p>
                          <p className="text-xs text-zinc-400 font-mono-tabular mt-0.5">
                            Server: {acct.terminalServer || 'LemonFunding-Live'} · Pass:{' '}
                            {acct.terminalPassword || 'LT-LEMON1!'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCredentialsModalAccount(acct)}
                          className="px-4 py-2 rounded-full bg-white text-[#09090B] text-xs font-bold cursor-pointer shrink-0"
                        >
                          View / Copy Keys
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {downloadStatusMsg && (
                  <div
                    role="status"
                    className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    <span>{downloadStatusMsg}</span>
                  </div>
                )}

                {isInstalled && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Lemon Terminal is running in installed app mode</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-6 h-6 text-emerald-400" />
                      <div>
                        <h3 className="font-display text-base font-bold text-white">
                          Android / iOS Terminal
                        </h3>
                        <p className="text-xs text-zinc-400">One-tap PWA fullscreen launch</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setDownloadStatusMsg('');
                        if (canNativeInstall) {
                          const ok = await promptNativeInstall();
                          if (ok) {
                            setDownloadStatusMsg('Lemon Terminal installed to your home screen!');
                            return;
                          }
                        }
                        setExpandedGuide((g) => (g === 'android' ? null : 'android'));
                      }}
                      className="w-full py-2.5 px-4 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] font-bold text-xs cursor-pointer"
                    >
                      Install / Setup Mobile App
                    </button>
                    {expandedGuide === 'android' && (
                      <p className="text-xs text-zinc-400">
                        Open in Chrome/Safari menu → Install App or Add to Home Screen, or launch below.
                      </p>
                    )}
                  </div>

                  <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <Monitor className="w-6 h-6 text-white" />
                      <div>
                        <h3 className="font-display text-base font-bold text-white">
                          Desktop Terminal Login
                        </h3>
                        <p className="text-xs text-zinc-400">Standalone browser terminal view</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onLaunchStandaloneTerminal?.()}
                      className="w-full py-2.5 px-4 rounded-full bg-[#18181B] hover:bg-white/10 border border-white/[0.12] text-white font-bold text-xs cursor-pointer"
                    >
                      Launch Terminal Login →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== PAGE: SUPPORT ==================== */}
            {activePage === 'support' && (
              <div className="max-w-3xl space-y-5">
                <div>
                  <h1 className="font-display text-2xl font-bold text-white">Support &amp; Rules</h1>
                  <p className="text-sm text-zinc-400">
                    Key payout requirements, risk limits, and account assistance.
                  </p>
                </div>

                <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-6 space-y-4 text-sm text-zinc-300">
                  <div className="p-4 rounded-xl bg-[#18181B] border border-white/[0.06]">
                    <p className="font-bold text-white">BNB BEP20 Payout SLA &amp; Minimums</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Minimum payout is $100 on BNB BEP20 (Smart Chain), requiring at least 5 trading days on funded or passed accounts. Max settlement time is 24 hours.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#18181B] border border-white/[0.06]">
                    <p className="font-bold text-white">Instant Funded Risk Rules</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Instant Zest accounts enforce a 35% consistency limit per trade and a strict 1% floating loss intraday guard inside Lemon Terminal.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#18181B] border border-white/[0.06]">
                    <p className="font-bold text-white">2027 $2 Bonus Account Offer</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Get a $5,000 Instant Zest funded challenge for only $2 USD valid till 2027.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== PAGE: REWARDS ==================== */}
            {activePage === 'rewards' && (
              <RewardsSection
                accessToken={accessToken}
                focusSecretCode={Boolean(focusSecretCode || localFocusSecretCode)}
                onClearFocusSecretCode={() => {
                  setLocalFocusSecretCode(false);
                  onClearFocusSecretCode?.();
                }}
                onRefreshDashboard={onRefreshDashboard}
                onOpenAccountInTerminal={() => onChangePage('terminal')}
              />
            )}

            {/* ==================== PAGE: KYC ==================== */}
            {activePage === 'kyc' && (
              <KycVerificationSection
                accessToken={accessToken}
                userEmail={user.email}
                userKycStatus={user.kycStatus}
                onRefreshDashboard={onRefreshDashboard}
                onOpenTerminal={() => onChangePage('terminal')}
              />
            )}

            {/* ==================== PAGE: LEMON TERMINAL ==================== */}
            {activePage === 'terminal' && (
              <LemonTerminal
                accounts={accounts}
                trades={trades}
                accessToken={accessToken}
                initialAccountId={selectedAccountId}
                userKycStatus={user.kycStatus}
                onOpenKyc={() => onChangePage('kyc')}
                onRefreshDashboard={onRefreshDashboard}
                onClaimComeback={(code) =>
                  openCheckoutPage({
                    size: activeAccount?.accountSize,
                    mode: activeAccount?.mode,
                    promoCode: code,
                  })
                }
                onLaunchStandaloneTerminal={onLaunchStandaloneTerminal}
                onCloseTerminal={() => onChangePage('overview')}
              />
            )}

            {/* ==================== PAGE: TRADE JOURNAL / TRADE REVIEW ==================== */}
            {activePage === 'journal' && (
              <div className="space-y-6">
                {!activeAccount ? (
                  <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-12 text-center space-y-3">
                    <p className="font-bold text-white">No trading account selected.</p>
                    <button
                      type="button"
                      onClick={() => openCheckoutPage()}
                      className="px-5 py-2.5 rounded-full bg-white text-[#09090B] text-xs font-bold cursor-pointer"
                    >
                      Buy First Challenge →
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {accounts.map((acct) => {
                        const active = acct.id === activeAccount.id;
                        return (
                          <button
                            key={acct.id}
                            type="button"
                            onClick={() => setSelectedAccountId(acct.id)}
                            className={`px-3.5 py-2 rounded-full border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                              active
                                ? 'bg-white text-[#09090B] border-white'
                                : 'bg-[#111113] text-zinc-300 border-white/[0.08] hover:border-white/25'
                            }`}
                          >
                            #{acct.accountNumber} · {formatShortSize(acct.accountSize)} ({acct.status})
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      <div className="lg:col-span-7 bg-[#111113] rounded-2xl border border-white/[0.08] p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="font-display text-lg font-bold text-white">
                              Equity Curve · #{activeAccount.accountNumber}
                            </h2>
                            <p className="text-xs text-zinc-400">
                              Balance: {formatUsd(activeAccount.currentEquity)} · Net:{' '}
                              <span className={netPnlActive >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                                {netPnlActive >= 0 ? `+${formatUsd(netPnlActive)}` : `-${formatUsd(Math.abs(netPnlActive))}`}
                              </span>
                            </p>
                          </div>
                          <span className="text-xs font-mono-tabular px-2.5 py-1 rounded-lg bg-[#18181B] border border-white/[0.08] text-white font-bold">
                            {activeAccount.status}
                          </span>
                        </div>

                        <div className="rounded-xl bg-[#0C0C0E] border border-white/[0.06] p-3">
                          <svg viewBox="0 0 620 210" className="w-full h-52" role="img">
                            <defs>
                              <linearGradient id="lemonAreaGradJournal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                            {chartGeometry.floorY !== undefined && (
                              <line
                                x1="20"
                                y1={chartGeometry.floorY}
                                x2="600"
                                y2={chartGeometry.floorY}
                                stroke="#EF4444"
                                strokeWidth="1.2"
                                strokeDasharray="5 5"
                              />
                            )}
                            {chartGeometry.areaD && (
                              <path d={chartGeometry.areaD} fill="url(#lemonAreaGradJournal)" />
                            )}
                            {chartGeometry.pathD && (
                              <path
                                d={chartGeometry.pathD}
                                fill="none"
                                stroke="#10B981"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            )}
                            {chartGeometry.nodes.map((node, idx) => (
                              <circle
                                key={idx}
                                cx={node.x}
                                cy={node.y}
                                r="4.5"
                                fill="#10B981"
                                stroke="#09090B"
                                strokeWidth="2"
                              />
                            ))}
                          </svg>
                        </div>
                      </div>

                      <div className="lg:col-span-5 bg-[#111113] rounded-2xl border border-white/[0.08] p-6">
                        <h2 className="font-display text-lg font-bold text-white mb-1">
                          Record Trade Entry
                        </h2>
                        <p className="text-xs text-zinc-400 mb-4">
                          Sync a closed trade to #{activeAccount.accountNumber}.
                        </p>

                        {user.email !== 'demo@lemonfunding.com' && user.kycStatus !== 'approved' ? (
                          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2.5">
                            <p className="font-bold flex items-center gap-1.5 text-white">
                              <Lock className="w-4 h-4 text-amber-400" />
                              <span>
                                {user.kycStatus === 'pending'
                                  ? 'KYC Pending Admin Approval — Trading Locked'
                                  : 'KYC Verification Required Before Trading'}
                              </span>
                            </p>
                            <button
                              type="button"
                              onClick={() => onChangePage('kyc')}
                              className="px-4 py-2 rounded-full bg-white text-[#09090B] font-bold text-xs cursor-pointer"
                            >
                              Complete KYC →
                            </button>
                          </div>
                        ) : activeAccount.status === 'Pending Approval' ||
                          activeAccount.paymentStatus === 'pending_approval' ? (
                          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2">
                            <p className="font-bold flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-amber-400" /> Pending Admin Approval
                            </p>
                            <p className="text-zinc-300">
                              Awaiting payment confirmation. Logging unlocks once approved.
                            </p>
                          </div>
                        ) : activeAccount.status === 'Breached' ? (
                          <div className="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-200 space-y-2">
                            <p className="font-bold flex items-center gap-1.5">
                              <Lock className="w-4 h-4" /> Account Breached — Logging Disabled
                            </p>
                            <p>{activeAccount.breachReason || 'Drawdown limit reached.'}</p>
                            <button
                              type="button"
                              onClick={() =>
                                openCheckoutPage({
                                  size: activeAccount.accountSize,
                                  mode: activeAccount.mode,
                                  promoCode: activeComebackCode,
                                })
                              }
                              className="mt-1 px-4 py-2 rounded-full bg-white text-[#09090B] font-bold cursor-pointer"
                            >
                              Use {activeComebackCode} (40% Off) →
                            </button>
                          </div>
                        ) : (
                          <form onSubmit={handleLogTrade} noValidate className="space-y-3">
                            {tradeError && (
                              <p role="alert" className="p-2.5 rounded-lg bg-red-500/15 text-xs text-red-300">
                                {tradeError}
                              </p>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                                  Symbol
                                </label>
                                <select
                                  value={symbol}
                                  onChange={(e) => setSymbol(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-[#18181B] border border-white/[0.1] text-xs font-semibold text-white"
                                >
                                  {SYMBOLS.map((s) => (
                                    <option key={s} value={s} className="bg-[#18181B]">
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <span className="block text-xs font-semibold text-zinc-300 mb-1">
                                  Direction
                                </span>
                                <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-[#18181B] border border-white/[0.08]">
                                  {(['BUY', 'SELL'] as const).map((dir) => (
                                    <button
                                      key={dir}
                                      type="button"
                                      onClick={() => setSide(dir)}
                                      className={`py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                                        side === dir
                                          ? 'bg-white text-[#09090B]'
                                          : 'text-zinc-400'
                                      }`}
                                    >
                                      {dir}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                                  Lots
                                </label>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0.01"
                                  value={lots}
                                  onChange={(e) => setLots(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-[#18181B] border border-white/[0.1] text-xs font-mono-tabular text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                                  Realized P&amp;L ($)
                                </label>
                                <input
                                  type="number"
                                  step="10"
                                  value={pnlInput}
                                  onChange={(e) => setPnlInput(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-[#18181B] border border-white/[0.1] text-xs font-mono-tabular text-white"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                                Setup Note
                              </label>
                              <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="London session breakout"
                                className="w-full px-3 py-2 rounded-xl bg-[#18181B] border border-white/[0.1] text-xs text-white placeholder:text-zinc-500"
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={tradeBusy}
                              className="w-full py-2.5 px-4 rounded-full bg-white hover:bg-zinc-200 disabled:opacity-50 text-[#09090B] font-bold text-xs cursor-pointer"
                            >
                              {tradeBusy ? 'Recording...' : 'Save Trade to Journal'}
                            </button>
                          </form>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
                        <h2 className="font-display text-lg font-bold text-white">
                          Closed Executions · #{activeAccount.accountNumber}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center bg-[#18181B] p-0.5 rounded-xl border border-white/[0.08] text-xs">
                            {(['ALL', 'BUY', 'SELL'] as const).map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setSideFilter(s)}
                                className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                                  sideFilter === s ? 'bg-white text-[#09090B]' : 'text-zinc-400'
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="search"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search symbol..."
                              className="pl-8 pr-3 py-1.5 rounded-xl bg-[#18181B] border border-white/[0.08] text-xs text-white placeholder:text-zinc-500"
                            />
                          </div>
                        </div>
                      </div>

                      {accountTrades.length === 0 ? (
                        <div className="py-10 text-center text-xs text-zinc-500">
                          No closed trades recorded yet on #{activeAccount.accountNumber}.
                        </div>
                      ) : (
                        <div className="overflow-x-auto mt-4">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-white/[0.08] text-xs font-semibold text-zinc-400">
                                <th className="py-3 pr-4">Symbol</th>
                                <th className="py-3 px-4">Side</th>
                                <th className="py-3 px-4">Lots</th>
                                <th className="py-3 px-4">Notes</th>
                                <th className="py-3 pl-4 text-right">Realized P&amp;L</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.06] text-sm">
                              {accountTrades.map((t) => (
                                <tr key={t.id} className="hover:bg-white/[0.02]">
                                  <td className="py-3 pr-4 font-mono-tabular font-semibold text-white">
                                    {t.symbol}
                                  </td>
                                  <td className="py-3 px-4 font-mono-tabular text-xs font-semibold">
                                    <span className={t.side === 'BUY' ? 'text-emerald-400' : 'text-amber-300'}>
                                      {t.side}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 font-mono-tabular text-zinc-300">
                                    {t.lots.toFixed(2)}
                                  </td>
                                  <td className="py-3 px-4 text-xs text-zinc-400">{t.notes}</td>
                                  <td
                                    className={`py-3 pl-4 text-right font-mono-tabular font-bold ${
                                      t.pnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400'
                                    }`}
                                  >
                                    {t.pnlUsd >= 0
                                      ? `+${formatUsd(t.pnlUsd)}`
                                      : `-${formatUsd(Math.abs(t.pnlUsd))}`}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ==================== PAGE: PAYOUTS ==================== */}
            {activePage === 'payouts' && (() => {
              const activeAcctTrades = activeAccount
                ? trades.filter((t) => t.accountId === activeAccount.id)
                : [];
              const activeEligibility = activeAccount
                ? evaluateAccountPayoutEligibility(activeAccount, activeAcctTrades)
                : null;
              const certAccounts = accounts.filter(
                (a) => a.status === 'Target Passed' || a.status === 'Instant Funded'
              );
              return (
              <div className="space-y-6">
                {/* Payout Header & Top Overview Row matching Constant Funded dark aesthetic */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-white">Payouts</h1>
                    <p className="text-sm text-zinc-400">
                      BNB BEP20 crypto withdrawals · Min 5 valid trading days (≥0.50% profit/day) · $100 minimum split.
                    </p>
                  </div>
                  {activeEligibility && (
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-extrabold uppercase tracking-wider self-start ${
                        activeEligibility.eligible
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                          : 'bg-[#18181B] border-white/[0.1] text-zinc-300'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          activeEligibility.eligible ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                        }`}
                      />
                      <span>
                        {activeEligibility.eligible
                          ? 'ELIGIBLE FOR PAYOUT'
                          : activeEligibility.isFundedOrPassed
                            ? `${activeEligibility.validTradingDays}/${activeEligibility.requiredDays} Valid Days`
                            : 'Complete Target to Unlock'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Metric Summary Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-4">
                    <span className="text-xs text-zinc-400 block">Available Split ({activeAccount?.profitSplitPct ?? 80}%)</span>
                    <span className="font-mono-tabular text-2xl font-bold text-emerald-400 mt-1 block">
                      {formatUsd(activeEligibility?.traderShareUsd ?? 0)}
                    </span>
                  </div>
                  <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-4">
                    <span className="text-xs text-zinc-400 block">Valid Trading Days</span>
                    <span className="font-mono-tabular text-2xl font-bold text-white mt-1 block">
                      {activeEligibility ? `${activeEligibility.validTradingDays} / ${activeEligibility.requiredDays}` : '0 / 5'}
                    </span>
                  </div>
                  <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-4">
                    <span className="text-xs text-zinc-400 block">Min Daily Profit (0.50%)</span>
                    <span className="font-mono-tabular text-2xl font-bold text-white mt-1 block">
                      {activeEligibility ? `+${formatUsd(activeEligibility.dailyMinProfitUsd)}` : '$0'}
                    </span>
                  </div>
                  <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-4">
                    <span className="text-xs text-zinc-400 block">Total Paid / Queued</span>
                    <span className="font-mono-tabular text-2xl font-bold text-white mt-1 block">
                      {formatUsd(deskMetrics.totalPayoutsUsd)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Request Payout Card */}
                  <div className="lg:col-span-7 bg-[#111113] border border-white/[0.08] text-white rounded-2xl p-6 space-y-5 relative overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#18181B] border border-white/[0.08] flex items-center justify-center">
                          <Wallet className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <h2 className="font-display text-lg font-bold leading-tight">
                            Request Crypto Payout (BNB BEP20)
                          </h2>
                          <p className="text-xs text-zinc-400">24h max settlement · Smart Chain BEP20</p>
                        </div>
                      </div>
                      {activeEligibility?.eligible ? (
                        <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-extrabold uppercase tracking-wider">
                          ✓ Eligible Now
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.1] text-zinc-300 text-[11px] font-bold uppercase tracking-wider">
                          Min $100 · 5 Days
                        </span>
                      )}
                    </div>

                    {accounts.length > 0 && (
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                          Select Account
                        </label>
                        <select
                          value={activeAccount?.id || ''}
                          onChange={(e) => setSelectedAccountId(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.1] text-xs font-semibold text-white"
                        >
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id} className="bg-[#18181B]">
                              #{a.accountNumber} · {a.modeLabel} · {formatUsd(a.accountSize)} ({a.status})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Live Rule Eligibility Checklist */}
                    {activeAccount && activeEligibility && (
                      <div className="p-4 rounded-xl bg-[#161619] border border-white/[0.07] space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 font-medium">Live Rule Audit · #{activeAccount.accountNumber}</span>
                          <span
                            className={`font-bold ${
                              activeEligibility.eligible ? 'text-emerald-400' : 'text-amber-300'
                            }`}
                          >
                            {activeEligibility.eligible ? 'Ready to Withdraw' : 'Requirements Incomplete'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="p-2.5 rounded-lg bg-[#111113] border border-white/[0.05] flex items-center justify-between">
                            <span className="text-zinc-400">Account Stage</span>
                            <span
                              className={`font-bold ${
                                activeEligibility.isFundedOrPassed ? 'text-emerald-400' : 'text-amber-300'
                              }`}
                            >
                              {activeAccount.mode === 'instant'
                                ? activeEligibility.isFundedOrPassed
                                  ? 'Instant Funded ✓'
                                  : activeAccount.status
                                : activeEligibility.isFundedOrPassed
                                  ? `${activeAccount.status} ✓`
                                  : 'Evaluation Phase'}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-[#111113] border border-white/[0.05] flex items-center justify-between">
                            <span className="text-zinc-400">0.50%/Day Min Days</span>
                            <span
                              className={`font-mono-tabular font-bold ${
                                activeEligibility.validTradingDays >= activeEligibility.requiredDays
                                  ? 'text-emerald-400'
                                  : 'text-white'
                              }`}
                            >
                              {activeEligibility.validTradingDays}/{activeEligibility.requiredDays}{' '}
                              {activeEligibility.validTradingDays >= activeEligibility.requiredDays ? '✓' : ''}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-[#111113] border border-white/[0.05] flex items-center justify-between">
                            <span className="text-zinc-400">Min Split ($100+)</span>
                            <span
                              className={`font-mono-tabular font-bold ${
                                activeEligibility.meetsMinPayoutUsd ? 'text-emerald-400' : 'text-white'
                              }`}
                            >
                              {formatUsd(activeEligibility.traderShareUsd)} {activeEligibility.meetsMinPayoutUsd ? '✓' : ''}
                            </span>
                          </div>

                          {activeAccount.mode === 'instant' && (
                            <div className="p-2.5 rounded-lg bg-[#111113] border border-white/[0.05] flex items-center justify-between">
                              <span className="text-zinc-400">35% Consistency</span>
                              <span
                                className={`font-bold ${
                                  activeEligibility.consistencyPassed ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              >
                                {activeEligibility.consistencyPassed ? 'Passed ✓' : 'Exceeded'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Valid days progress bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-zinc-400">
                            <span>
                              Valid trading days ({activeEligibility.validTradingDays} of {activeEligibility.requiredDays})
                            </span>
                            <span className="font-mono-tabular">
                              +${formatUsd(activeEligibility.dailyMinProfitUsd).replace('$', '')}/day min
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.round(
                                    (activeEligibility.validTradingDays / activeEligibility.requiredDays) * 100
                                  )
                                )}%`,
                              }}
                            />
                          </div>
                        </div>

                        {activeEligibility.blockingReason && (
                          <p className="text-[11px] text-amber-300/90 leading-relaxed">
                            {activeEligibility.blockingReason}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Multi-Stage Payout Requesting Animation */}
                    {payoutAnimStage !== 'idle' && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="p-4 rounded-xl bg-[#0D1411] border border-emerald-500/40 space-y-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                            <motion.span
                              animate={{ rotate: payoutAnimStage === 'confirmed' ? 0 : 360 }}
                              transition={{
                                repeat: payoutAnimStage === 'confirmed' ? 0 : Infinity,
                                duration: 1.2,
                                ease: 'linear',
                              }}
                              className={`absolute inset-0 rounded-full border-2 ${
                                payoutAnimStage === 'confirmed'
                                  ? 'border-emerald-400'
                                  : 'border-emerald-400/30 border-t-emerald-400'
                              }`}
                            />
                            {payoutAnimStage === 'confirmed' ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <Zap className="w-4 h-4 text-emerald-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white">
                              {payoutAnimStage === 'verifying'
                                ? 'Step 1/3 · Auditing 5 Valid 0.50% Days & Drawdown...'
                                : payoutAnimStage === 'broadcasting'
                                  ? 'Step 2/3 · Preparing BNB BEP20 Smart Chain Request...'
                                  : 'Step 3/3 · Payout Queued & Owner Certificate Issued!'}
                            </p>
                            <div className="h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden">
                              <motion.div
                                initial={{ width: '15%' }}
                                animate={{
                                  width:
                                    payoutAnimStage === 'verifying'
                                      ? '38%'
                                      : payoutAnimStage === 'broadcasting'
                                        ? '76%'
                                        : '100%',
                                }}
                                transition={{ duration: 0.45 }}
                                className="h-full rounded-full bg-emerald-400"
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <div>
                      <label className="block text-xs text-zinc-300 mb-1.5">
                        Payout Network &amp; BNB BEP20 Wallet Address
                      </label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.1] text-xs font-bold text-[#FACC15] shrink-0 text-center">
                          BNB (BEP20)
                        </div>
                        <input
                          type="text"
                          value={bnbAddress}
                          onChange={(e) => setBnbAddress(e.target.value)}
                          placeholder="0x... Enter your BNB Smart Chain BEP20 address"
                          className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.1] text-xs font-mono-tabular text-white placeholder:text-zinc-500 focus:outline-none focus:border-white"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRequestPayout}
                      disabled={
                        payoutBusy ||
                        !activeAccount ||
                        activeAccount.status === 'Breached' ||
                        netPnlActive <= 0
                      }
                      className="w-full py-3 px-5 rounded-full bg-white hover:bg-zinc-200 disabled:opacity-45 text-[#09090B] text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {payoutBusy && <Zap className="w-3.5 h-3.5 animate-pulse" />}
                      <span>
                        {payoutBusy
                          ? payoutAnimStage === 'verifying'
                            ? 'Verifying 0.50% Days...'
                            : 'Requesting BNB BEP20 Payout...'
                          : 'Request BNB BEP20 Payout ($100 Min · 24h Max)'}
                      </span>
                    </button>

                    {payoutError && <p className="text-xs text-red-400 font-medium">{payoutError}</p>}
                    {payoutMsg && <p className="text-xs text-emerald-400 font-semibold">{payoutMsg}</p>}
                  </div>

                  {/* Certificate Status Card */}
                  <div className="lg:col-span-5 bg-[#111113] rounded-2xl border border-white/[0.08] p-6 flex flex-col justify-between space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-display text-lg font-bold text-white">
                          Verifiable QR Certificates
                        </h2>
                        <p className="text-xs text-zinc-400 mt-1">
                          Issued in <strong className="text-white">{user.fullName}</strong>&apos;s name on passed evaluations, instant funded accounts, and payouts.
                        </p>
                      </div>
                      <Award className="w-7 h-7 text-[#FACC15] shrink-0" />
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {certAccounts.length === 0 ? (
                        <div className="p-4 rounded-xl bg-[#18181B] border border-white/[0.06] text-xs text-zinc-400">
                          Pass a 1-Step / 2-Step stage or activate an Instant Funded account to unlock your verified QR certificate.
                        </div>
                      ) : (
                        certAccounts.map((a) => (
                          <div
                            key={a.id}
                            className="p-3 rounded-xl bg-[#18181B] border border-white/[0.07] flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-bold text-white block truncate">
                                {user.fullName} · #{a.accountNumber}
                              </span>
                              <span className="text-[11px] text-emerald-400 block">
                                {a.modeLabel} ({formatUsd(a.accountSize)})
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={loadingCert}
                              onClick={() => handleOpenCertificate(`LF-CERT-PASS-${a.accountNumber}`)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white text-[#09090B] text-[11px] font-bold hover:bg-zinc-200 cursor-pointer shrink-0"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>View QR</span>
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {certError && <p className="text-xs text-red-400">{certError}</p>}

                    <div className="p-4 rounded-xl bg-[#18181B] border border-white/[0.07] flex items-center justify-between text-xs">
                      <span className="text-zinc-400">Total Payouts Requested</span>
                      <span className="font-mono-tabular font-bold text-emerald-400 text-sm">
                        {formatUsd(deskMetrics.totalPayoutsUsd)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-6">
                  <h2 className="font-display text-lg font-bold text-white mb-4">
                    Payout Settlement Ledger
                  </h2>
                  {payouts.length === 0 ? (
                    <div className="py-10 text-center text-xs text-zinc-500">
                      No payouts requested yet. Eligible on funded accounts with min 5 valid trading days (≥0.50%/day) &amp; $100+ net split.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-white/[0.08] text-xs font-semibold text-zinc-400">
                            <th className="py-3 pr-4">Account</th>
                            <th className="py-3 px-4">Method &amp; Wallet</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Requested</th>
                            <th className="py-3 px-4 text-right">Amount</th>
                            <th className="py-3 pl-4 text-right">Certificate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06]">
                          {payouts.map((p) => (
                            <tr key={p.id}>
                              <td className="py-3 pr-4 font-mono-tabular font-bold text-white">
                                #{p.accountNumber}
                              </td>
                              <td className="py-3 px-4 text-xs text-zinc-300">
                                <span className="font-bold block">{p.method}</span>
                                {p.walletAddress && (
                                  <span className="font-mono-tabular text-[10px] text-zinc-500">
                                    {p.walletAddress.slice(0, 10)}...{p.walletAddress.slice(-6)}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    p.status === 'Settled'
                                      ? 'bg-emerald-500/15 text-emerald-400'
                                      : 'bg-amber-500/15 text-amber-300'
                                  }`}
                                >
                                  {p.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-xs text-zinc-400">
                                {new Date(p.requestedAtIso).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4 text-right font-mono-tabular font-bold text-emerald-400">
                                {formatUsd(p.amountUsd)}
                              </td>
                              <td className="py-3 pl-4 text-right">
                                <button
                                  type="button"
                                  disabled={loadingCert}
                                  onClick={() =>
                                    handleOpenCertificate(
                                      p.certificateId || `LF-CERT-PAY-${p.id.toUpperCase()}`
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white text-[#09090B] text-xs font-bold cursor-pointer"
                                >
                                  <QrCode className="w-3.5 h-3.5" />
                                  <span>QR Cert</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Account Terminal Credentials Modal */}
      {credentialsModalAccount && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#111113] border border-white/[0.12] p-6 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-[#FACC15]" />
                <h3 className="font-display font-bold text-base">Lemon Terminal™ Credentials</h3>
              </div>
              <button
                type="button"
                onClick={() => setCredentialsModalAccount(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 font-mono-tabular text-xs">
              <div className="p-3 rounded-xl bg-[#18181B] border border-white/[0.08] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-400 block font-sans">Trading Server</span>
                  <span className="font-bold text-white">
                    {credentialsModalAccount.terminalServer || 'LemonFunding-Live'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(
                      credentialsModalAccount.terminalServer || 'LemonFunding-Live',
                      'server'
                    )
                  }
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                >
                  {copiedField === 'server' ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="p-3 rounded-xl bg-[#18181B] border border-white/[0.08] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-400 block font-sans">
                    Account Login ID
                  </span>
                  <span className="font-bold text-[#FACC15]">
                    {credentialsModalAccount.accountNumber}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyText(credentialsModalAccount.accountNumber, 'id')}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                >
                  {copiedField === 'id' ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="p-3 rounded-xl bg-[#18181B] border border-white/[0.08] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-400 block font-sans">
                    Trader Password
                  </span>
                  <span className="font-bold text-white">
                    {credentialsModalAccount.terminalPassword || 'LT-LEMON1!'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(
                      credentialsModalAccount.terminalPassword || 'LT-LEMON1!',
                      'pass'
                    )
                  }
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                >
                  {copiedField === 'pass' ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {credentialsModalAccount.status !== 'Breached' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAccountId(credentialsModalAccount.id);
                    setCredentialsModalAccount(null);
                    onChangePage('terminal');
                  }}
                  className="flex-1 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Open in Terminal</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCredentialsModalAccount(null);
                  setPwaModalOpen(true);
                }}
                className="py-2.5 px-4 rounded-full bg-[#18181B] border border-white/[0.1] hover:bg-white/10 text-white font-bold text-xs cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install App</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <PWAInstallModal
        isOpen={pwaModalOpen}
        onClose={() => setPwaModalOpen(false)}
        onLaunchTerminal={onLaunchStandaloneTerminal}
      />

      {/* Verifiable QR Certificate Viewer Modal */}
      {activeCertificate && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[#111113] text-white border border-white/[0.15] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <button
              type="button"
              onClick={() => setActiveCertificate(null)}
              aria-label="Close certificate"
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-2 border-b border-white/[0.08] pb-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold uppercase tracking-widest">
                <Award className="w-3.5 h-3.5" />
                <span>Official LemonFunding Certificate</span>
              </div>
              <h3 className="font-display text-2xl font-bold text-white">
                {activeCertificate.type === 'payout_verified'
                  ? 'Verified Payout Certificate'
                  : 'Funded Trader Certificate'}
              </h3>
              <p className="text-xs text-zinc-400">
                This certifies that the trader below met all risk and consistency milestones.
              </p>
            </div>

            <div className="py-6 text-center space-y-4">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-zinc-400 block">
                  Awarded To
                </span>
                <p className="font-display text-3xl font-bold text-white mt-0.5">
                  {activeCertificate.traderName}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left bg-[#18181B] border border-white/[0.08] rounded-2xl p-4 text-xs">
                <div>
                  <span className="text-zinc-400 block">Account Number</span>
                  <span className="font-mono-tabular font-bold text-white">
                    #{activeCertificate.accountNumber}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block">Program / Size</span>
                  <span className="font-bold text-white">
                    {activeCertificate.modeLabel} · {formatUsd(activeCertificate.accountSize)}
                  </span>
                </div>
                {activeCertificate.amountUsd && (
                  <div>
                    <span className="text-zinc-400 block">Verified Payout</span>
                    <span className="font-mono-tabular font-extrabold text-emerald-400 text-sm">
                      {formatUsd(activeCertificate.amountUsd)} ({activeCertificate.payoutMethod || 'BNB BEP20'})
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-zinc-400 block">Issued On</span>
                  <span className="font-mono-tabular text-white">
                    {new Date(activeCertificate.issuedAtIso).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Scannable QR Code Verification */}
              <div className="flex flex-col items-center gap-2 pt-2">
                <div className="p-2.5 rounded-2xl bg-white shadow-lg">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
                      typeof window !== 'undefined'
                        ? `${window.location.origin}${activeCertificate.qrUrl}`
                        : activeCertificate.qrUrl
                    )}`}
                    alt={`QR Verification ${activeCertificate.id}`}
                    className="w-32 h-32 block"
                  />
                </div>
                <span className="text-[10px] font-mono-tabular text-zinc-400">
                  Ref: {activeCertificate.id} · Status: {activeCertificate.verificationStatus}
                </span>
                <a
                  href={activeCertificate.qrUrl}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Live Verification Link</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
