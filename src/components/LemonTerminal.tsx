import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  Award,
  Bell,
  Briefcase,
  CandlestickChart,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Crosshair,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  GraduationCap,
  History,
  Info,
  Key,
  Lock,
  Maximize2,
  Menu,
  MessageSquare,
  Minimize2,
  MoreVertical,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import type { DashboardAccount, DashboardTrade, KycStatus, PublicUser } from '../server/authStore';
import {
  COMEBACK_CODE,
  computeTradingDayStats,
  evaluateAccountPayoutEligibility,
  formatUsd,
} from '../utils/challenges';
import { LemonLogo } from './LemonLogo';
import { PWAInstallModal, usePWAInstallState } from './PWAInstallModal';

export interface SavedTerminalAccount {
  accountNumber: string;
  terminalServer: string;
  modeLabel: string;
  accountSize: number;
  currentEquity: number;
  status: string;
  profitSplitPct: number;
  dailyLossPct: number;
  terminalPassword?: string;
  savedAtIso: string;
}

const SAVED_ACCOUNTS_STORAGE_KEY = 'lemon_terminal_saved_accounts_v1';
const ACTIVE_SESSION_STORAGE_KEY = 'lemon_terminal_active_session_v1';
const OPEN_POSITIONS_STORAGE_KEY = 'lemon_terminal_open_positions_v1';

function loadSavedTerminalAccounts(): SavedTerminalAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SAVED_ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedTerminalAccount[]) : [];
  } catch {
    return [];
  }
}

function persistSavedTerminalAccounts(list: SavedTerminalAccount[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SAVED_ACCOUNTS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage quota errors
  }
}

function loadActiveSavedSession(): { accountNumber: string; autoConnect: boolean } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.accountNumber === 'string') {
      return {
        accountNumber: parsed.accountNumber,
        autoConnect: Boolean(parsed.autoConnect),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function persistActiveSavedSession(
  session: { accountNumber: string; autoConnect: boolean } | null
) {
  if (typeof window === 'undefined') return;
  try {
    if (!session) {
      window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // Ignore storage quota errors
  }
}

function loadSavedOpenPositions(): OpenPosition[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(OPEN_POSITIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OpenPosition[]) : [];
  } catch {
    return [];
  }
}

interface Instrument {
  symbol: string;
  displayName: string;
  category: 'Forex' | 'Metals' | 'Indices' | 'Crypto';
  basePrice: number;
  bid: number;
  ask: number;
  low: number;
  high: number;
  spreadPoints: number;
  changePoints: number;
  change24h: number;
  decimals: number;
  pipSplitCount: number; // how many trailing digits go into big/pip formatting
  pipMultiplier: number;
  tickTrend: 'up' | 'down' | 'neutral';
  source?: 'live-exchange' | 'live-fx' | 'simulated';
}

interface CandleBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const INITIAL_INSTRUMENTS: Instrument[] = [
  {
    symbol: 'XAUUSD.',
    displayName: 'Gold vs US-Dollar',
    category: 'Metals',
    basePrice: 3633.5,
    bid: 3632.43,
    ask: 3633.75,
    low: 3618.4,
    high: 3679.8,
    spreadPoints: 132,
    changePoints: 412,
    change24h: 0.48,
    decimals: 2,
    pipSplitCount: 2,
    pipMultiplier: 0.1,
    tickTrend: 'up',
  },
  {
    symbol: 'EURUSD.',
    displayName: 'Euro vs US Dollar',
    category: 'Forex',
    basePrice: 1.09093,
    bid: 1.09093,
    ask: 1.09116,
    low: 1.08951,
    high: 1.09196,
    spreadPoints: 23,
    changePoints: 84,
    change24h: 0.08,
    decimals: 5,
    pipSplitCount: 3,
    pipMultiplier: 0.0001,
    tickTrend: 'up',
  },
  {
    symbol: 'GBPUSD.',
    displayName: 'Great British Pound vs US Dollar',
    category: 'Forex',
    basePrice: 1.30379,
    bid: 1.30379,
    ask: 1.30405,
    low: 1.30243,
    high: 1.30471,
    spreadPoints: 26,
    changePoints: 95,
    change24h: 0.07,
    decimals: 5,
    pipSplitCount: 3,
    pipMultiplier: 0.0001,
    tickTrend: 'up',
  },
  {
    symbol: 'USDCHF.',
    displayName: 'US Dollar vs Swiss Franc',
    category: 'Forex',
    basePrice: 0.84122,
    bid: 0.84122,
    ask: 0.84148,
    low: 0.8405,
    high: 0.84178,
    spreadPoints: 26,
    changePoints: -7,
    change24h: -0.01,
    decimals: 5,
    pipSplitCount: 3,
    pipMultiplier: 0.0001,
    tickTrend: 'down',
  },
  {
    symbol: 'USDJPY.',
    displayName: 'US Dollar vs Japanese Yen',
    category: 'Forex',
    basePrice: 158.951,
    bid: 158.951,
    ask: 158.979,
    low: 158.734,
    high: 159.088,
    spreadPoints: 28,
    changePoints: -32,
    change24h: -0.02,
    decimals: 3,
    pipSplitCount: 3,
    pipMultiplier: 0.01,
    tickTrend: 'down',
  },
  {
    symbol: 'USDCAD.',
    displayName: 'US Dollar vs Canadian Dollar',
    category: 'Forex',
    basePrice: 1.43599,
    bid: 1.43599,
    ask: 1.43624,
    low: 1.43529,
    high: 1.43684,
    spreadPoints: 25,
    changePoints: 5,
    change24h: 0.0,
    decimals: 5,
    pipSplitCount: 3,
    pipMultiplier: 0.0001,
    tickTrend: 'down',
  },
  {
    symbol: 'AUDCAD.',
    displayName: 'Australian Dollar vs Canadian Dollar',
    category: 'Forex',
    basePrice: 0.95131,
    bid: 0.95131,
    ask: 0.95165,
    low: 0.9504,
    high: 0.95292,
    spreadPoints: 34,
    changePoints: -30,
    change24h: -0.03,
    decimals: 5,
    pipSplitCount: 3,
    pipMultiplier: 0.0001,
    tickTrend: 'up',
  },
  {
    symbol: 'NZDUSD.',
    displayName: 'New Zealand Dollar vs US Dollar',
    category: 'Forex',
    basePrice: 0.54473,
    bid: 0.54473,
    ask: 0.54503,
    low: 0.54385,
    high: 0.54584,
    spreadPoints: 30,
    changePoints: 9,
    change24h: 0.02,
    decimals: 5,
    pipSplitCount: 3,
    pipMultiplier: 0.0001,
    tickTrend: 'up',
  },
  {
    symbol: 'EURGBP.',
    displayName: 'Euro vs Great British Pound',
    category: 'Forex',
    basePrice: 0.83661,
    bid: 0.83661,
    ask: 0.83688,
    low: 0.83598,
    high: 0.83689,
    spreadPoints: 27,
    changePoints: 33,
    change24h: 0.04,
    decimals: 5,
    pipSplitCount: 3,
    pipMultiplier: 0.0001,
    tickTrend: 'up',
  },
  {
    symbol: 'AUDUSD.',
    displayName: 'Australian Dollar vs US Dollar',
    category: 'Forex',
    basePrice: 0.66245,
    bid: 0.66245,
    ask: 0.66275,
    low: 0.66186,
    high: 0.66366,
    spreadPoints: 30,
    changePoints: -18,
    change24h: -0.03,
    decimals: 5,
    pipSplitCount: 3,
    pipMultiplier: 0.0001,
    tickTrend: 'up',
  },
  {
    symbol: 'NAS100',
    displayName: 'US Tech 100 Cash',
    category: 'Indices',
    basePrice: 20850.0,
    bid: 20849.0,
    ask: 20851.0,
    low: 20710.5,
    high: 20920.0,
    spreadPoints: 20,
    changePoints: 194,
    change24h: 0.94,
    decimals: 1,
    pipSplitCount: 1,
    pipMultiplier: 1.0,
    tickTrend: 'up',
  },
  {
    symbol: 'BTCUSD',
    displayName: 'Bitcoin vs US Dollar',
    category: 'Crypto',
    basePrice: 96800.0,
    bid: 96790.0,
    ask: 96810.0,
    low: 94210.0,
    high: 97450.0,
    spreadPoints: 200,
    changePoints: 2940,
    change24h: 3.25,
    decimals: 2,
    pipSplitCount: 2,
    pipMultiplier: 1.0,
    tickTrend: 'up',
  },
];

export interface OpenPosition {
  id: string;
  accountId: string;
  ticket: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  lots: number;
  openPrice: number;
  currentPrice: number;
  sl: number | null;
  tp: number | null;
  floatingPnl: number;
  openTimeIso: string;
}

interface LemonTerminalProps {
  accounts: DashboardAccount[];
  trades: DashboardTrade[];
  accessToken: string;
  userKycStatus?: KycStatus;
  initialAccountId?: string;
  standalone?: boolean;
  onRefreshDashboard: () => Promise<void>;
  onOpenKyc?: () => void;
  onTerminalAuthenticated?: (payload: {
    accessToken: string;
    user: PublicUser;
    account: DashboardAccount;
    trades: DashboardTrade[];
  }) => void;
  onClaimComeback?: (code: string) => void;
  onLaunchStandaloneTerminal?: () => void;
  onCloseTerminal?: () => void;
}

type Mt5Tab = 'quotes' | 'charts' | 'trade' | 'history' | 'messages' | 'accounts';
type TimeFrame = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D1';

type DragTarget =
  | { kind: 'position-sl'; positionId: string }
  | { kind: 'position-tp'; positionId: string }
  | { kind: 'draft-sl' }
  | { kind: 'draft-tp' };

function getTfSeconds(tf: TimeFrame): number {
  switch (tf) {
    case 'M1':
      return 60;
    case 'M5':
      return 300;
    case 'M15':
      return 900;
    case 'H1':
      return 3600;
    case 'H4':
      return 14400;
    case 'D1':
      return 86400;
  }
}

function formatCandleAxisTime(unixSec: number, tf: TimeFrame): string {
  const d = new Date(unixSec * 1000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (tf === 'D1' || tf === 'H4') {
    const day = d.getDate();
    const mon = d.toLocaleString('en-US', { month: 'short' });
    return `${day} ${mon} ${hh}:${mm}`;
  }
  return `${hh}:${mm}`;
}

function formatCountdown(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function computePositionPnl(
  inst: Instrument,
  side: 'BUY' | 'SELL',
  openPrice: number,
  targetPrice: number,
  lots: number
): number {
  const diff = side === 'BUY' ? targetPrice - openPrice : openPrice - targetPrice;
  const pipDiff = diff / inst.pipMultiplier;
  return Number((pipDiff * (lots * 10)).toFixed(2));
}

function formatMt5Number(value: number, decimals = 2): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const spaced = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sign = value < 0 ? '-' : '';
  return decPart !== undefined ? `${sign}${spaced}.${decPart}` : `${sign}${spaced}`;
}

function splitMt5Quote(price: number, decimals: number) {
  const formatted = price.toFixed(decimals);
  if (decimals >= 5) {
    // e.g. 1.09093 -> head: "1.09", big: "09", sup: "3"
    return {
      head: formatted.slice(0, formatted.length - 3),
      big: formatted.slice(formatted.length - 3, formatted.length - 1),
      sup: formatted.slice(formatted.length - 1),
    };
  }
  if (decimals === 3) {
    // e.g. 158.951 -> head: "158.", big: "95", sup: "1"
    return {
      head: formatted.slice(0, formatted.length - 3),
      big: formatted.slice(formatted.length - 3, formatted.length - 1),
      sup: formatted.slice(formatted.length - 1),
    };
  }
  // e.g. 3632.43 -> head: "3632.", big: "43", sup: ""
  const dotIdx = formatted.indexOf('.');
  if (dotIdx !== -1 && formatted.length - dotIdx - 1 === 2) {
    return {
      head: formatted.slice(0, dotIdx + 1),
      big: formatted.slice(dotIdx + 1),
      sup: '',
    };
  }
  return {
    head: formatted.slice(0, Math.max(0, formatted.length - 2)),
    big: formatted.slice(-2),
    sup: '',
  };
}

export function LemonTerminal({
  accounts,
  trades,
  accessToken,
  userKycStatus,
  initialAccountId,
  standalone = false,
  onRefreshDashboard,
  onOpenKyc,
  onTerminalAuthenticated,
  onClaimComeback,
  onLaunchStandaloneTerminal,
  onCloseTerminal,
}: LemonTerminalProps) {
  const { canNativeInstall, isInstalled, promptNativeInstall } = usePWAInstallState();

  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    initialAccountId || accounts[0]?.id || ''
  );
  const [terminalUserKycStatus, setTerminalUserKycStatus] = useState<KycStatus | undefined>(undefined);
  const [isTerminalConnected, setIsTerminalConnected] = useState<boolean>(accounts.length > 0);
  const [activeTab, setActiveTab] = useState<Mt5Tab>('trade');
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [showAddLoginView, setShowAddLoginView] = useState<boolean>(false);
  const [accountsMenuOpen, setAccountsMenuOpen] = useState<boolean>(false);
  const [positionsMenuOpen, setPositionsMenuOpen] = useState<boolean>(false);
  const [rulesModalOpen, setRulesModalOpen] = useState<boolean>(false);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState<boolean>(false);
  const [pwaModalOpen, setPwaModalOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if ((document.documentElement as unknown as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen) {
        (document.documentElement as unknown as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen?.();
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as unknown as { webkitExitFullscreen?: () => void }).webkitExitFullscreen) {
        (document as unknown as { webkitExitFullscreen?: () => void }).webkitExitFullscreen?.();
      }
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isDocFs = Boolean(document.fullscreenElement);
      if (!isDocFs && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  // Login Form inputs (MT5 Screenshot 5)
  const [loginType, setLoginType] = useState<'Trade account' | 'Investor'>('Trade account');
  const [loginServer, setLoginServer] = useState<string>('LemonFunding-Live');
  const [loginAccountNum, setLoginAccountNum] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showPasswordText, setShowPasswordText] = useState<boolean>(false);
  const [savePassword, setSavePassword] = useState<boolean>(true);
  const [showDemoHelper, setShowDemoHelper] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [loginNotice, setLoginNotice] = useState<string>('');
  const [loginBusy, setLoginBusy] = useState<boolean>(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedTerminalAccount[]>(
    loadSavedTerminalAccounts
  );
  const [autoRestoring, setAutoRestoring] = useState<boolean>(false);
  const autoRestoreAttemptedRef = useRef<boolean>(false);

  // Quotes state (MT5 Screenshot 2)
  const [instruments, setInstruments] = useState<Instrument[]>(INITIAL_INSTRUMENTS);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('XAUUSD.');
  const [quotesSearchOpen, setQuotesSearchOpen] = useState<boolean>(false);
  const [quotesCategoryOpen, setQuotesCategoryOpen] = useState<boolean>(false);
  const [watchlistCategory, setWatchlistCategory] = useState<
    'All' | 'Forex' | 'Metals' | 'Indices' | 'Crypto'
  >('All');
  const [watchlistSearch, setWatchlistSearch] = useState<string>('');
  const [quoteActionSymbol, setQuoteActionSymbol] = useState<string | null>(null);
  const [liveTimeStr, setLiveTimeStr] = useState<string>('06:58:23');

  // Order / Trade / Chart controls
  const [orderLots, setOrderLots] = useState<string>('0.01');
  const [orderSl, setOrderSl] = useState<string>('');
  const [orderTp, setOrderTp] = useState<string>('');
  const [showDraftBracket, setShowDraftBracket] = useState<boolean>(false);
  const [oneClickPanelVisible, setOneClickPanelVisible] = useState<boolean>(true);
  const [newOrderModalOpen, setNewOrderModalOpen] = useState<boolean>(false);
  const [modifyingPositionId, setModifyingPositionId] = useState<string | null>(null);
  const [modifySlInput, setModifySlInput] = useState<string>('');
  const [modifyTpInput, setModifyTpInput] = useState<string>('');
  const [expandedPositionId, setExpandedPositionId] = useState<string | null>(null);
  const [tradeSortAsc, setTradeSortAsc] = useState<boolean>(false);
  const [executionMessage, setExecutionMessage] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  // Chart configuration (MT5 Screenshot 4 + Free Pan/Pinch-Zoom + Real-Time Candles)
  const [timeframe, setTimeframe] = useState<TimeFrame>('M15');
  const [timeframePickerOpen, setTimeframePickerOpen] = useState<boolean>(false);
  const [symbolPickerOpen, setSymbolPickerOpen] = useState<boolean>(false);
  const [chartType, setChartType] = useState<'candle' | 'area'>('candle');
  const [showCrosshair, setShowCrosshair] = useState<boolean>(false);
  const [barCountdownSec, setBarCountdownSec] = useState<number>(110);
  const [liveFeedConnected, setLiveFeedConnected] = useState<boolean>(false);
  const [realCandles, setRealCandles] = useState<CandleBar[]>([]);
  const [visibleBars, setVisibleBars] = useState<number>(44);
  const [panBarsOffset, setPanBarsOffset] = useState<number>(0);
  const [priceOffset, setPriceOffset] = useState<number>(0);
  const [priceScaleZoom, setPriceScaleZoom] = useState<number>(1);
  const [hoverPoint, setHoverPoint] = useState<{
    x: number;
    y: number;
    price: number;
    candleIdx: number | null;
  } | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [selectedBracket, setSelectedBracket] = useState<DragTarget | null>(null);
  const chartSvgRef = useRef<SVGSVGElement | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<{
    mode: 'none' | 'pan' | 'y-axis' | 'pinch';
    startX: number;
    startY: number;
    startPanBars: number;
    startPriceOffset: number;
    startScaleZoom: number;
    startPinchDist: number;
    startVisibleBars: number;
  }>({
    mode: 'none',
    startX: 0,
    startY: 0,
    startPanBars: 0,
    startPriceOffset: 0,
    startScaleZoom: 1,
    startPinchDist: 0,
    startVisibleBars: 44,
  });
  const [chartBox, setChartBox] = useState<{ width: number; height: number }>({
    width: 420,
    height: 520,
  });

  // Open Positions & Risk state (persisted across reloads)
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>(loadSavedOpenPositions);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [breachBannerInfo, setBreachBannerInfo] = useState<{
    accountNumber: string;
    reason: string;
  } | null>(null);
  const [passedBannerInfo, setPassedBannerInfo] = useState<{
    accountNumber: string;
    modeLabel: string;
  } | null>(null);

  const closingInFlightRef = useRef<Set<string>>(new Set());
  const breachInFlightRef = useRef<Set<string>>(new Set());

  const activeAccount =
    accounts.find((a) => a.id === selectedAccountId) || accounts[0] || null;
  const isBreached = activeAccount?.status === 'Breached';
  const effectiveKycStatus: KycStatus = userKycStatus ?? terminalUserKycStatus ?? 'not_submitted';
  const isKycLocked = Boolean(
    activeAccount &&
      activeAccount.accountNumber !== 'LF-100001' &&
      effectiveKycStatus !== 'approved'
  );

  const currentInstrument =
    instruments.find((i) => i.symbol === selectedSymbol) || instruments[0];

  const accountPositions = useMemo(() => {
    if (!activeAccount) return [];
    const list = openPositions.filter((p) => p.accountId === activeAccount.id);
    if (tradeSortAsc) {
      return [...list].sort((a, b) => a.floatingPnl - b.floatingPnl);
    }
    return list;
  }, [openPositions, activeAccount, tradeSortAsc]);

  const accountClosedTrades = useMemo(() => {
    if (!activeAccount) return trades;
    return trades.filter((t) => t.accountId === activeAccount.id);
  }, [trades, activeAccount]);

  useEffect(() => {
    if (initialAccountId) {
      setSelectedAccountId(initialAccountId);
    }
  }, [initialAccountId]);

  useEffect(() => {
    if (accounts.length > 0 && !showAddLoginView) {
      setIsTerminalConnected(true);
    }
  }, [accounts.length, showAddLoginView]);

  // Persist open positions to localStorage so active SL/TP trades survive refreshes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(OPEN_POSITIONS_STORAGE_KEY, JSON.stringify(openPositions));
    } catch {
      // Ignore storage quota errors
    }
  }, [openPositions]);

  // Keep saved accounts synced with live account equity & status
  useEffect(() => {
    if (accounts.length === 0) return;
    setSavedAccounts((prev) => {
      if (prev.length === 0) return prev;
      let changed = false;
      const byNum = new Map(accounts.map((a) => [a.accountNumber.toLowerCase(), a]));
      const next = prev.map((saved) => {
        const live = byNum.get(saved.accountNumber.toLowerCase());
        if (!live) return saved;
        if (
          live.currentEquity !== saved.currentEquity ||
          live.status !== saved.status ||
          live.modeLabel !== saved.modeLabel
        ) {
          changed = true;
          return {
            ...saved,
            currentEquity: live.currentEquity,
            status: live.status,
            modeLabel: live.modeLabel,
            terminalServer: live.terminalServer || saved.terminalServer,
          };
        }
        return saved;
      });
      if (changed) {
        persistSavedTerminalAccounts(next);
        return next;
      }
      return prev;
    });
  }, [accounts]);

  const upsertSavedTerminalAccount = useCallback(
    (acct: DashboardAccount, passwordOption?: { save: boolean; password?: string }) => {
      setSavedAccounts((prev) => {
        const existing = prev.find(
          (s) => s.accountNumber.toLowerCase() === acct.accountNumber.toLowerCase()
        );
        const resolvedPassword = passwordOption
          ? passwordOption.save
            ? passwordOption.password || existing?.terminalPassword || acct.terminalPassword
            : undefined
          : existing?.terminalPassword;

        const entry: SavedTerminalAccount = {
          accountNumber: acct.accountNumber,
          terminalServer: acct.terminalServer || 'LemonFunding-Live',
          modeLabel: acct.modeLabel,
          accountSize: acct.accountSize,
          currentEquity: acct.currentEquity,
          status: acct.status,
          profitSplitPct: acct.profitSplitPct,
          dailyLossPct: acct.dailyLossPct,
          terminalPassword: resolvedPassword,
          savedAtIso: new Date().toISOString(),
        };

        const filtered = prev.filter(
          (s) => s.accountNumber.toLowerCase() !== acct.accountNumber.toLowerCase()
        );
        const next = [entry, ...filtered].slice(0, 10);
        persistSavedTerminalAccounts(next);
        return next;
      });
    },
    []
  );

  const removeSavedTerminalAccount = useCallback((accountNumber: string) => {
    setSavedAccounts((prev) => {
      const next = prev.filter(
        (s) => s.accountNumber.toLowerCase() !== accountNumber.toLowerCase()
      );
      persistSavedTerminalAccounts(next);
      return next;
    });
    const activeSaved = loadActiveSavedSession();
    if (
      activeSaved &&
      activeSaved.accountNumber.toLowerCase() === accountNumber.toLowerCase()
    ) {
      persistActiveSavedSession(null);
    }
  }, []);

  // Auto-restore saved standalone terminal account across reloads / app reopen
  useEffect(() => {
    if (!standalone || accounts.length > 0 || autoRestoreAttemptedRef.current) return;
    autoRestoreAttemptedRef.current = true;

    const session = loadActiveSavedSession();
    if (!session || !session.autoConnect) return;

    const saved = loadSavedTerminalAccounts().find(
      (s) => s.accountNumber.toLowerCase() === session.accountNumber.toLowerCase()
    );
    if (!saved || !saved.terminalPassword) return;

    setAutoRestoring(true);
    (async () => {
      try {
        const resp = await fetch('/api/terminal/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountNumber: saved.accountNumber,
            terminalPassword: saved.terminalPassword,
          }),
        });
        if (!resp.ok) {
          persistActiveSavedSession({ accountNumber: saved.accountNumber, autoConnect: false });
          return;
        }
        const data = await resp.json();
        if (data.user?.kycStatus) {
          setTerminalUserKycStatus(data.user.kycStatus as KycStatus);
        }
        if (onTerminalAuthenticated) {
          onTerminalAuthenticated(data);
        }
        upsertSavedTerminalAccount(data.account, {
          save: true,
          password: saved.terminalPassword,
        });
        setSelectedAccountId(data.account.id);
        setIsTerminalConnected(true);
        setShowAddLoginView(false);
      } catch {
        // Keep manual login available on network blip
      } finally {
        setAutoRestoring(false);
      }
    })();
  }, [standalone, accounts.length, onTerminalAuthenticated, upsertSavedTerminalAccount]);

  // Live clock + true timeframe candle countdown timer
  useEffect(() => {
    const tickClock = () => {
      const d = new Date();
      setLiveTimeStr(
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(
          d.getSeconds()
        ).padStart(2, '0')}`
      );
      const tfSec = getTfSeconds(timeframe);
      const nowSec = Math.floor(Date.now() / 1000);
      setBarCountdownSec(tfSec - (nowSec % tfSec));
    };
    tickClock();
    const timer = setInterval(tickClock, 1000);
    return () => clearInterval(timer);
  }, [timeframe]);

  // Measure SVG chart container so candlesticks and text stay 1:1 unstretched on mobile & desktop
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const syncSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 120 && rect.height > 120) {
        setChartBox({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };
    syncSize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(syncSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeTab, oneClickPanelVisible, standalone]);

  // Real-time Server-Sent Events market feed (live Binance spot + FX rates)
  useEffect(() => {
    let es: EventSource | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    const applyServerQuotes = (quotes: Instrument[]) => {
      if (!Array.isArray(quotes) || quotes.length === 0) return;
      setInstruments((prev) => {
        const bySym = new Map(quotes.map((q) => [q.symbol, q]));
        const merged = prev.map((existing) => bySym.get(existing.symbol) || existing);
        for (const q of quotes) {
          if (!merged.some((m) => m.symbol === q.symbol)) {
            merged.push(q);
          }
        }
        return merged;
      });
    };

    if (typeof EventSource !== 'undefined') {
      es = new EventSource('/api/market/stream');
      es.onopen = () => setLiveFeedConnected(true);
      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed?.quotes) {
            setLiveFeedConnected(true);
            applyServerQuotes(parsed.quotes);
          }
        } catch {
          // Ignore malformed frame
        }
      };
      es.onerror = () => {
        setLiveFeedConnected(false);
      };
    } else {
      fallbackTimer = setInterval(async () => {
        try {
          const r = await fetch('/api/market/quotes');
          if (r.ok) {
            const d = await r.json();
            applyServerQuotes(d.quotes);
          }
        } catch {
          // Ignore offline poll
        }
      }, 1500);
    }

    return () => {
      es?.close();
      if (fallbackTimer) clearInterval(fallbackTimer);
    };
  }, []);

  // Load real historical + live OHLC candlesticks whenever symbol or timeframe changes
  useEffect(() => {
    let cancelled = false;
    setPanBarsOffset(0);
    setPriceOffset(0);
    setPriceScaleZoom(1);

    (async () => {
      try {
        const resp = await fetch(
          `/api/market/candles?symbol=${encodeURIComponent(selectedSymbol)}&interval=${timeframe}&limit=140`
        );
        if (!resp.ok || cancelled) return;
        const data = await resp.json();
        if (!cancelled && Array.isArray(data.candles) && data.candles.length > 0) {
          setRealCandles(data.candles);
        }
      } catch {
        // Keep fallback candles on network blip
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSymbol, timeframe]);

  // Continuously update the active live candle with real-time ticks & roll over new bars
  useEffect(() => {
    const tfSec = getTfSeconds(timeframe);
    const liveBid = currentInstrument.bid;
    const dec = currentInstrument.decimals;
    const currentBucket = Math.floor(Date.now() / 1000 / tfSec) * tfSec;

    setRealCandles((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (currentBucket > last.time) {
        const nextBar: CandleBar = {
          time: currentBucket,
          open: last.close,
          high: Number(Math.max(last.close, liveBid).toFixed(dec)),
          low: Number(Math.min(last.close, liveBid).toFixed(dec)),
          close: liveBid,
          volume: 100,
        };
        return [...prev.slice(-199), nextBar];
      }
      const updated = {
        ...last,
        close: liveBid,
        high: Number(Math.max(last.high, liveBid).toFixed(dec)),
        low: Number(Math.min(last.low, liveBid).toFixed(dec)),
      };
      return [...prev.slice(0, -1), updated];
    });
  }, [currentInstrument.bid, currentInstrument.decimals, timeframe]);

  // Update floating P&L on every tick
  useEffect(() => {
    setOpenPositions((prev) =>
      prev.map((pos) => {
        const inst = instruments.find((i) => i.symbol === pos.symbol);
        if (!inst) return pos;
        const currentPrice = pos.side === 'BUY' ? inst.bid : inst.ask;
        const pnl = computePositionPnl(inst, pos.side, pos.openPrice, currentPrice, pos.lots);
        return { ...pos, currentPrice, floatingPnl: pnl };
      })
    );
  }, [instruments]);

  const closePositionOnServer = useCallback(
    async (pos: OpenPosition, reasonNote?: string) => {
      if (!activeAccount || !accessToken) return;
      if (closingInFlightRef.current.has(pos.id)) return;
      closingInFlightRef.current.add(pos.id);

      try {
        const resp = await fetch('/api/dashboard/trades', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            accountId: pos.accountId,
            symbol: pos.symbol,
            side: pos.side,
            lots: pos.lots,
            pnlUsd: Number(pos.floatingPnl.toFixed(2)),
            notes: reasonNote || `Lemon Terminal Close ${pos.ticket} @ ${pos.currentPrice}`,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          setOpenPositions((prev) => prev.filter((p) => p.id !== pos.id));
          if (expandedPositionId === pos.id) setExpandedPositionId(null);
          await onRefreshDashboard();
          if (data.account?.status === 'Breached') {
            setBreachBannerInfo({
              accountNumber: data.account.accountNumber,
              reason:
                data.account.breachReason ||
                `Daily/Max drawdown limit hit. ${COMEBACK_CODE} (40% OFF) unlocked.`,
            });
          } else if (data.account?.status === 'Target Passed' && data.account.mode !== 'instant') {
            setPassedBannerInfo({
              accountNumber: data.account.accountNumber,
              modeLabel: data.account.modeLabel,
            });
            setExecutionMessage(
              `🎯 Target Passed on ${data.account.accountNumber}! Promoted account & QR Certificate ready.`
            );
            setTimeout(() => setExecutionMessage(''), 5000);
          } else {
            setExecutionMessage(
              `${reasonNote ? 'Triggered' : 'Closed'} ${pos.symbol} ${pos.side}: ${
                pos.floatingPnl >= 0 ? '+' : ''
              }${formatMt5Number(pos.floatingPnl)} USD`
            );
            setTimeout(() => setExecutionMessage(''), 3500);
          }
        }
      } catch {
        setExecutionMessage('Network error closing position.');
      } finally {
        closingInFlightRef.current.delete(pos.id);
      }
    },
    [activeAccount, accessToken, onRefreshDashboard, expandedPositionId]
  );

  // Auto-trigger SL / TP when live price touches a position's SL or TP
  useEffect(() => {
    if (!activeAccount || activeAccount.status === 'Breached') return;
    for (const pos of accountPositions) {
      if (closingInFlightRef.current.has(pos.id)) continue;
      if (pos.sl !== null) {
        const slHit =
          pos.side === 'BUY' ? pos.currentPrice <= pos.sl : pos.currentPrice >= pos.sl;
        if (slHit) {
          void closePositionOnServer(pos, `Stop Loss hit ${pos.ticket} @ ${pos.sl}`);
          continue;
        }
      }
      if (pos.tp !== null) {
        const tpHit =
          pos.side === 'BUY' ? pos.currentPrice >= pos.tp : pos.currentPrice <= pos.tp;
        if (tpHit) {
          void closePositionOnServer(pos, `Take Profit hit ${pos.ticket} @ ${pos.tp}`);
        }
      }
    }
  }, [accountPositions, activeAccount, closePositionOnServer]);

  // Live metrics & floating equity
  const totalFloatingPnl = accountPositions.reduce((sum, p) => sum + p.floatingPnl, 0);
  const currentTerminalEquity = activeAccount
    ? activeAccount.currentEquity + totalFloatingPnl
    : 100000;
  const usedMargin = accountPositions.reduce((sum, p) => sum + p.lots * 9085, 0);
  const freeMargin = Math.max(0, currentTerminalEquity - usedMargin);
  const marginLevelStr =
    usedMargin > 0 ? ((currentTerminalEquity / usedMargin) * 100).toFixed(2) : '0.00';

  const dailyFloor = activeAccount
    ? activeAccount.dayStartEquity - activeAccount.dailyLossUsd
    : 0;
  const overallFloor = activeAccount
    ? activeAccount.startingBalance - activeAccount.maxDrawdownUsd
    : 0;
  const dailyRoom = Math.max(0, currentTerminalEquity - dailyFloor);
  const overallRoom = Math.max(0, currentTerminalEquity - overallFloor);
  const netProfitLive = activeAccount
    ? currentTerminalEquity - activeAccount.startingBalance
    : 0;
  const isInstantModel = activeAccount?.mode === 'instant';
  const targetRemainingUsd =
    activeAccount && !isInstantModel && activeAccount.targetUsd > 0
      ? Math.max(0, Math.round(activeAccount.targetUsd - netProfitLive))
      : 0;
  const targetProgressPct =
    activeAccount && !isInstantModel && activeAccount.targetUsd > 0
      ? Math.max(0, Math.min(100, Math.round((netProfitLive / activeAccount.targetUsd) * 100)))
      : netProfitLive > 0
        ? 100
        : 0;
  const instantFloatLimitUsd = activeAccount ? Math.round(activeAccount.startingBalance * 0.01) : 0;
  const instantFloatRoom = activeAccount
    ? Math.max(
        0,
        Math.min(
          instantFloatLimitUsd + totalFloatingPnl,
          currentTerminalEquity - (activeAccount.dayStartEquity - instantFloatLimitUsd)
        )
      )
    : 0;
  const activeDayStats = useMemo(
    () =>
      activeAccount
        ? computeTradingDayStats(accountClosedTrades, activeAccount.startingBalance)
        : { validTradingDays: 0, activeDatesCount: 0, requiredDays: 5, dailyMinProfitUsd: 0, days: [] },
    [activeAccount, accountClosedTrades]
  );
  const activeTerminalEligibility = useMemo(
    () =>
      activeAccount
        ? evaluateAccountPayoutEligibility(
            {
              ...activeAccount,
              currentEquity: currentTerminalEquity,
            },
            accountClosedTrades
          )
        : null,
    [activeAccount, currentTerminalEquity, accountClosedTrades]
  );

  // Automatic Breach Enforcement on live floating equity
  useEffect(() => {
    if (!activeAccount || !accessToken) return;
    if (activeAccount.status === 'Breached') return;
    if (breachInFlightRef.current.has(activeAccount.id)) return;

    const hitDaily = currentTerminalEquity <= dailyFloor;
    const hitOverall = currentTerminalEquity <= overallFloor;
    const hitInstantFloating =
      activeAccount.mode === 'instant' &&
      (totalFloatingPnl <= -activeAccount.startingBalance * 0.01 ||
        activeAccount.dayStartEquity - currentTerminalEquity >= activeAccount.startingBalance * 0.01);
    if (!hitDaily && !hitOverall && !hitInstantFloating) return;

    breachInFlightRef.current.add(activeAccount.id);
    const positionsSnapshot = [...accountPositions];
    const floatingSnapshot = totalFloatingPnl;

    (async () => {
      try {
        const resp = await fetch('/api/dashboard/breach', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            accountId: activeAccount.id,
            floatingPnlUsd: floatingSnapshot,
            liquidatedPositions: positionsSnapshot.map((p) => ({
              symbol: p.symbol,
              side: p.side,
              lots: p.lots,
              pnlUsd: Math.round(p.floatingPnl),
              notes: `Auto-liquidated (${p.ticket}) on drawdown breach @ ${p.currentPrice}`,
            })),
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          setOpenPositions((prev) => prev.filter((p) => p.accountId !== activeAccount.id));
          await onRefreshDashboard();
          setBreachBannerInfo({
            accountNumber: activeAccount.accountNumber,
            reason:
              data.account?.breachReason ||
              `Daily drawdown (${activeAccount.dailyLossPct}%) limit hit. Trading disabled.`,
          });
        }
      } finally {
        breachInFlightRef.current.delete(activeAccount.id);
      }
    })();
  }, [
    activeAccount,
    accessToken,
    currentTerminalEquity,
    dailyFloor,
    overallFloor,
    accountPositions,
    totalFloatingPnl,
    onRefreshDashboard,
  ]);

  const filteredInstruments = useMemo(() => {
    return instruments.filter((inst) => {
      if (watchlistCategory !== 'All' && inst.category !== watchlistCategory) return false;
      if (
        watchlistSearch.trim() &&
        !inst.symbol.toLowerCase().includes(watchlistSearch.trim().toLowerCase()) &&
        !inst.displayName.toLowerCase().includes(watchlistSearch.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [instruments, watchlistCategory, watchlistSearch]);

  const handleTerminalLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginNotice('');

    const normalizedInputId = loginAccountNum.trim().replace(/^#/, '').toLowerCase();
    const targetAccount = accounts.find(
      (a) =>
        a.accountNumber.toLowerCase() === normalizedInputId ||
        a.id === loginAccountNum.trim()
    );

    if (targetAccount) {
      if (
        targetAccount.terminalPassword &&
        loginPassword.trim() &&
        targetAccount.terminalPassword !== loginPassword.trim()
      ) {
        setLoginError('Invalid Trader Password for this account.');
        return;
      }
      upsertSavedTerminalAccount(targetAccount, {
        save: savePassword,
        password: loginPassword.trim() || targetAccount.terminalPassword,
      });
      persistActiveSavedSession({
        accountNumber: targetAccount.accountNumber,
        autoConnect: savePassword,
      });
      setSelectedAccountId(targetAccount.id);
      setIsTerminalConnected(true);
      setShowAddLoginView(false);
      setActiveTab('trade');
      return;
    }

    setLoginBusy(true);
    try {
      const resp = await fetch('/api/terminal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountNumber: loginAccountNum.trim(),
          terminalPassword: loginPassword.trim(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setLoginError(data.error || 'Authorization failed.');
        return;
      }
      if (data.user?.kycStatus) {
        setTerminalUserKycStatus(data.user.kycStatus as KycStatus);
      }
      if (onTerminalAuthenticated) {
        onTerminalAuthenticated(data);
      }
      upsertSavedTerminalAccount(data.account, {
        save: savePassword,
        password: loginPassword.trim(),
      });
      persistActiveSavedSession({
        accountNumber: data.account.accountNumber,
        autoConnect: savePassword,
      });
      setSelectedAccountId(data.account.id);
      setIsTerminalConnected(true);
      setShowAddLoginView(false);
      setActiveTab('trade');
    } catch {
      setLoginError('Unable to connect to LemonFunding server.');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleConnectSavedAccount = async (saved: SavedTerminalAccount) => {
    setLoginError('');
    setLoginNotice('');
    const existing = accounts.find(
      (a) => a.accountNumber.toLowerCase() === saved.accountNumber.toLowerCase()
    );
    if (existing) {
      setSelectedAccountId(existing.id);
      setIsTerminalConnected(true);
      setShowAddLoginView(false);
      setActiveTab('trade');
      persistActiveSavedSession({
        accountNumber: existing.accountNumber,
        autoConnect: Boolean(saved.terminalPassword),
      });
      return;
    }

    if (!saved.terminalPassword) {
      setLoginAccountNum(saved.accountNumber);
      setLoginServer(saved.terminalServer);
      setLoginPassword('');
      setShowAddLoginView(true);
      setLoginNotice(`Enter password for saved account ${saved.accountNumber}.`);
      return;
    }

    setLoginBusy(true);
    try {
      const resp = await fetch('/api/terminal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountNumber: saved.accountNumber,
          terminalPassword: saved.terminalPassword,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setLoginError(data.error || 'Saved credentials expired. Enter password.');
        setLoginAccountNum(saved.accountNumber);
        setLoginServer(saved.terminalServer);
        setShowAddLoginView(true);
        return;
      }
      if (data.user?.kycStatus) {
        setTerminalUserKycStatus(data.user.kycStatus as KycStatus);
      }
      if (onTerminalAuthenticated) {
        onTerminalAuthenticated(data);
      }
      upsertSavedTerminalAccount(data.account, {
        save: true,
        password: saved.terminalPassword,
      });
      persistActiveSavedSession({
        accountNumber: data.account.accountNumber,
        autoConnect: true,
      });
      setSelectedAccountId(data.account.id);
      setIsTerminalConnected(true);
      setShowAddLoginView(false);
      setActiveTab('trade');
    } catch {
      setLoginError('Unable to reconnect to LemonFunding server.');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleFillDemoCredentials = () => {
    setLoginError('');
    setLoginServer('LemonFunding-Demo');
    setLoginAccountNum('LF-100001');
    setLoginPassword('LemonDemo2026!');
    setShowDemoHelper(true);
    setLoginNotice('Demo credentials filled (LF-100001 / LemonDemo2026!). Tap LOGIN to connect.');
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleInstallFromMenu = async () => {
    setDrawerOpen(false);
    setAccountsMenuOpen(false);
    if (canNativeInstall) {
      const accepted = await promptNativeInstall();
      if (accepted) return;
    }
    setPwaModalOpen(true);
  };

  const handleExecuteOrder = (side: 'BUY' | 'SELL', customInstrument?: Instrument) => {
    const inst = customInstrument || currentInstrument;
    if (!activeAccount) {
      setExecutionMessage('Sign in with a Trading Account ID first.');
      return;
    }
    if (isKycLocked) {
      setExecutionMessage(
        effectiveKycStatus === 'pending'
          ? 'KYC Pending Admin Approval — Trading unlocks once verified.'
          : 'KYC Required: Verify PAN + Aadhaar Front & Back before trading.'
      );
      setTimeout(() => setExecutionMessage(''), 4000);
      return;
    }
    if (activeAccount.status === 'Breached') {
      setExecutionMessage('Account breached: trading disabled.');
      return;
    }

    const parsedLots = Number(orderLots);
    if (!Number.isFinite(parsedLots) || parsedLots <= 0 || parsedLots > 50) {
      setExecutionMessage('Enter volume between 0.01 and 50.00 lots.');
      return;
    }

    const parsedSl = orderSl.trim() ? Number(orderSl) : null;
    const parsedTp = orderTp.trim() ? Number(orderTp) : null;

    setIsExecuting(true);
    const fillPrice = side === 'BUY' ? inst.ask : inst.bid;
    const ticketId = `#${Math.floor(100000 + Math.random() * 899999)}`;

    const newPosition: OpenPosition = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      accountId: activeAccount.id,
      ticket: ticketId,
      symbol: inst.symbol,
      side,
      lots: parsedLots,
      openPrice: fillPrice,
      currentPrice: fillPrice,
      sl: parsedSl !== null && Number.isFinite(parsedSl) ? parsedSl : null,
      tp: parsedTp !== null && Number.isFinite(parsedTp) ? parsedTp : null,
      floatingPnl: 0,
      openTimeIso: new Date().toISOString(),
    };

    setOpenPositions((prev) => [newPosition, ...prev]);
    setNewOrderModalOpen(false);
    setExecutionMessage(
      `${side} ${parsedLots.toFixed(2)} ${inst.symbol} @ ${fillPrice.toFixed(inst.decimals)}`
    );
    setIsExecuting(false);
    setTimeout(() => setExecutionMessage(''), 3000);
  };

  const handleCloseAllPositions = async () => {
    setPositionsMenuOpen(false);
    for (const pos of [...accountPositions]) {
      await closePositionOnServer(pos);
    }
  };

  const handleCloseProfitablePositions = async () => {
    setPositionsMenuOpen(false);
    for (const pos of accountPositions.filter((p) => p.floatingPnl > 0)) {
      await closePositionOnServer(pos);
    }
  };

  const handleAddBracketToPosition = (posId: string, type: 'sl' | 'tp') => {
    setOpenPositions((prev) =>
      prev.map((p) => {
        if (p.id !== posId) return p;
        const inst = instruments.find((i) => i.symbol === p.symbol) || currentInstrument;
        const offset = inst.pipMultiplier * 25;
        if (type === 'sl') {
          const val = p.side === 'BUY' ? p.openPrice - offset : p.openPrice + offset;
          return { ...p, sl: Number(val.toFixed(inst.decimals)) };
        }
        const val = p.side === 'BUY' ? p.openPrice + offset * 1.5 : p.openPrice - offset * 1.5;
        return { ...p, tp: Number(val.toFixed(inst.decimals)) };
      })
    );
  };

  // Fallback deterministic candles while initial /api/market/candles request finishes
  const fallbackCandles = useMemo(() => {
    const count = 80;
    const tfSec = getTfSeconds(timeframe);
    const currentBucket = Math.floor(Date.now() / 1000 / tfSec) * tfSec;
    const base = currentInstrument.bid || currentInstrument.basePrice;
    const vol = base * 0.0016;
    const symHash = selectedSymbol.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
    const raw: CandleBar[] = [];
    let cursor = base;

    for (let i = 0; i < count; i++) {
      const barTime = currentBucket - (count - 1 - i) * tfSec;
      const move = (Math.sin((i + symHash) * 0.45) * 0.55 + Math.cos((i + symHash) * 1.15) * 0.35) * vol;
      const close = cursor + move;
      raw.push({
        time: barTime,
        open: cursor,
        high: Math.max(cursor, close) + vol * 0.45,
        low: Math.min(cursor, close) - vol * 0.45,
        close,
        volume: 250,
      });
      cursor = close;
    }
    const offset = base - raw[raw.length - 1].close;
    return raw.map((c) => ({
      ...c,
      open: c.open + offset,
      high: c.high + offset,
      low: c.low + offset,
      close: c.close + offset,
    }));
  }, [currentInstrument.basePrice, currentInstrument.bid, selectedSymbol, timeframe]);

  const candleData = useMemo(() => {
    const source = realCandles.length > 0 ? realCandles : fallbackCandles;
    return source.map((c, idx) => ({
      ...c,
      index: idx,
      isBull: c.close >= c.open,
    }));
  }, [realCandles, fallbackCandles]);

  const symbolPositions = useMemo(
    () => accountPositions.filter((p) => p.symbol === selectedSymbol),
    [accountPositions, selectedSymbol]
  );

  // MT5 Chart Geometry with Free Pan (X/Y), Pinch Zoom, and Real Timestamps
  const chartGeometry = useMemo(() => {
    const width = Math.max(320, chartBox.width);
    const height = Math.max(420, chartBox.height);
    const padTop = 36;
    const padBottom = 34;
    const padLeft = 10;
    const padRight = width >= 768 ? 78 : 68;
    const usableW = width - padLeft - padRight;
    const usableH = height - padTop - padBottom;

    const totalBars = candleData.length;
    const safeVisibleBars = Math.max(14, Math.min(130, visibleBars));
    const rightEdgeIndex = totalBars - 1 - panBarsOffset;
    const leftEdgeIndex = rightEdgeIndex - safeVisibleBars;
    const pxPerBar = (usableW * 0.88) / Math.max(1, safeVisibleBars);

    const visibleSlice = candleData.filter(
      (c) => c.index >= Math.floor(leftEdgeIndex) - 2 && c.index <= Math.ceil(rightEdgeIndex) + 2
    );
    const boundsPool = visibleSlice.length > 0 ? visibleSlice : candleData;

    const priceValues: number[] = [];
    for (const c of boundsPool) {
      priceValues.push(c.high, c.low);
    }
    if (Math.abs(panBarsOffset) <= safeVisibleBars * 0.5) {
      priceValues.push(currentInstrument.bid, currentInstrument.ask);
    }
    for (const p of symbolPositions) {
      priceValues.push(p.openPrice);
      if (p.sl !== null) priceValues.push(p.sl);
      if (p.tp !== null) priceValues.push(p.tp);
    }
    if (showDraftBracket || orderSl || orderTp) {
      const dSl = Number(orderSl);
      const dTp = Number(orderTp);
      if (Number.isFinite(dSl) && dSl > 0) priceValues.push(dSl);
      if (Number.isFinite(dTp) && dTp > 0) priceValues.push(dTp);
    }

    const rawMin = Math.min(...priceValues);
    const rawMax = Math.max(...priceValues);
    const baseSpan = Math.max(currentInstrument.pipMultiplier * 14, rawMax - rawMin);
    const midPrice = (rawMax + rawMin) / 2 + priceOffset;
    const halfSpan = ((baseSpan * 1.32) / 2) * priceScaleZoom;
    const minP = midPrice - halfSpan;
    const maxP = midPrice + halfSpan;
    const span = Math.max(0.0001, maxP - minP);

    const priceToY = (price: number) => padTop + (1 - (price - minP) / span) * usableH;
    const yToPrice = (y: number) => {
      const ratio = 1 - (y - padTop) / usableH;
      return Number((minP + ratio * span).toFixed(currentInstrument.decimals));
    };

    const candleWidth = Math.max(2.5, Math.min(22, pxPerBar * 0.68));
    const candleBars = candleData
      .map((c) => {
        const x = padLeft + (c.index - leftEdgeIndex) * pxPerBar;
        const openY = priceToY(c.open);
        const closeY = priceToY(c.close);
        const highY = priceToY(c.high);
        const lowY = priceToY(c.low);
        const bodyY = Math.min(openY, closeY);
        const bodyH = Math.max(2, Math.abs(closeY - openY));
        return {
          ...c,
          x,
          openY,
          closeY,
          highY,
          lowY,
          bodyY,
          bodyH,
          candleWidth,
        };
      })
      .filter((c) => c.x >= padLeft - 30 && c.x <= width - padRight + 12);

    const areaPath = candleBars
      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.closeY.toFixed(1)}`)
      .join(' ');

    // Dynamic real timestamps along the 3 vertical gridlines
    const timeAxisMarks = [0.2, 0.48, 0.76].map((ratio) => {
      const gx = padLeft + ratio * usableW;
      const barIdxFloat = leftEdgeIndex + (gx - padLeft) / Math.max(0.001, pxPerBar);
      const tfSec = getTfSeconds(timeframe);
      const firstBarTime = candleData[0]?.time || Math.floor(Date.now() / 1000);
      const estTime = Math.round(firstBarTime + barIdxFloat * tfSec);
      return {
        x: gx,
        label: formatCandleAxisTime(estTime, timeframe),
      };
    });

    return {
      width,
      height,
      padTop,
      padBottom,
      padLeft,
      padRight,
      usableW,
      usableH,
      pxPerBar,
      minP,
      maxP,
      span,
      candleBars,
      areaPath,
      timeAxisMarks,
      currentPriceY: priceToY(currentInstrument.bid),
      askPriceY: priceToY(currentInstrument.ask),
      priceToY,
      yToPrice,
    };
  }, [
    candleData,
    currentInstrument.bid,
    currentInstrument.ask,
    currentInstrument.decimals,
    currentInstrument.pipMultiplier,
    symbolPositions,
    showDraftBracket,
    orderSl,
    orderTp,
    chartBox.width,
    chartBox.height,
    visibleBars,
    panBarsOffset,
    priceOffset,
    priceScaleZoom,
    timeframe,
  ]);

  const getSvgCoords = (clientX: number, clientY: number) => {
    const svg = chartSvgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = ((clientX - rect.left) / rect.width) * chartGeometry.width;
    const y = ((clientY - rect.top) / rect.height) * chartGeometry.height;
    return { x, y };
  };

  const resetChartViewport = () => {
    setPanBarsOffset(0);
    setPriceOffset(0);
    setPriceScaleZoom(1);
    setVisibleBars(44);
  };

  const handleChartPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const coords = getSvgCoords(e.clientX, e.clientY);
    if (!coords) return;

    activePointersRef.current.set(e.pointerId, { x: coords.x, y: coords.y });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events
    }

    if (dragTarget) return;

    const pointers = Array.from(activePointersRef.current.values());
    if (pointers.length >= 2) {
      const dist = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
      gestureRef.current = {
        mode: 'pinch',
        startX: coords.x,
        startY: coords.y,
        startPanBars: panBarsOffset,
        startPriceOffset: priceOffset,
        startScaleZoom: priceScaleZoom,
        startPinchDist: Math.max(10, dist),
        startVisibleBars: visibleBars,
      };
      return;
    }

    if (showCrosshair) {
      return;
    }

    // Touching the right price axis stretches/compresses vertical price scale
    if (coords.x >= chartGeometry.width - chartGeometry.padRight) {
      gestureRef.current = {
        mode: 'y-axis',
        startX: coords.x,
        startY: coords.y,
        startPanBars: panBarsOffset,
        startPriceOffset: priceOffset,
        startScaleZoom: priceScaleZoom,
        startPinchDist: 0,
        startVisibleBars: visibleBars,
      };
      return;
    }

    // 1-finger free X + Y chart pan
    gestureRef.current = {
      mode: 'pan',
      startX: coords.x,
      startY: coords.y,
      startPanBars: panBarsOffset,
      startPriceOffset: priceOffset,
      startScaleZoom: priceScaleZoom,
      startPinchDist: 0,
      startVisibleBars: visibleBars,
    };
  };

  const handleChartPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const coords = getSvgCoords(e.clientX, e.clientY);
    if (!coords) return;

    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: coords.x, y: coords.y });
    }

    const price = chartGeometry.yToPrice(coords.y);

    // Priority 1: Dragging SL / TP handle or line (locks chart pan cleanly)
    if (dragTarget) {
      if (dragTarget.kind === 'position-sl') {
        setOpenPositions((prev) =>
          prev.map((p) => (p.id === dragTarget.positionId ? { ...p, sl: price } : p))
        );
      } else if (dragTarget.kind === 'position-tp') {
        setOpenPositions((prev) =>
          prev.map((p) => (p.id === dragTarget.positionId ? { ...p, tp: price } : p))
        );
      } else if (dragTarget.kind === 'draft-sl') {
        setOrderSl(price.toFixed(currentInstrument.decimals));
      } else if (dragTarget.kind === 'draft-tp') {
        setOrderTp(price.toFixed(currentInstrument.decimals));
      }
      return;
    }

    // Priority 2: Crosshair inspection mode
    if (showCrosshair) {
      let nearestIdx: number | null = null;
      let minDist = Infinity;
      chartGeometry.candleBars.forEach((b, idx) => {
        const d = Math.abs(b.x - coords.x);
        if (d < minDist) {
          minDist = d;
          nearestIdx = idx;
        }
      });
      setHoverPoint({
        x: Math.max(chartGeometry.padLeft, Math.min(chartGeometry.width - chartGeometry.padRight, coords.x)),
        y: Math.max(chartGeometry.padTop, Math.min(chartGeometry.height - chartGeometry.padBottom, coords.y)),
        price,
        candleIdx: nearestIdx,
      });
      return;
    }

    // Priority 3: Pinch-to-Zoom (2 fingers)
    const pointers = Array.from(activePointersRef.current.values());
    if (pointers.length >= 2 && gestureRef.current.mode === 'pinch') {
      const dist = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
      const ratio = gestureRef.current.startPinchDist / Math.max(10, dist);
      const nextBars = Math.round(
        Math.max(14, Math.min(130, gestureRef.current.startVisibleBars * ratio))
      );
      setVisibleBars(nextBars);
      return;
    }

    // Priority 4: Right-axis vertical zoom drag
    if (gestureRef.current.mode === 'y-axis') {
      const dy = coords.y - gestureRef.current.startY;
      const factor = Math.exp(dy * 0.0045);
      setPriceScaleZoom(Math.max(0.35, Math.min(4.0, gestureRef.current.startScaleZoom * factor)));
      return;
    }

    // Priority 5: Free 1-finger / mouse horizontal + vertical chart pan
    if (gestureRef.current.mode === 'pan') {
      const dx = coords.x - gestureRef.current.startX;
      const dy = coords.y - gestureRef.current.startY;
      const barsShift = dx / Math.max(2, chartGeometry.pxPerBar);
      const maxHistoryPan = Math.max(10, candleData.length - 10);
      const nextPan = Math.max(-12, Math.min(maxHistoryPan, gestureRef.current.startPanBars + barsShift));
      const priceShift = (dy / Math.max(40, chartGeometry.usableH)) * chartGeometry.span;
      setPanBarsOffset(nextPan);
      setPriceOffset(gestureRef.current.startPriceOffset + priceShift);
    }
  };

  const handleChartPointerUp = (e?: React.PointerEvent<SVGSVGElement>) => {
    if (e) {
      activePointersRef.current.delete(e.pointerId);
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
    } else {
      activePointersRef.current.clear();
    }

    if (activePointersRef.current.size === 0) {
      gestureRef.current.mode = 'none';
    }

    if (dragTarget) {
      setExecutionMessage(
        dragTarget.kind.includes('sl') ? 'Stop Loss updated on chart' : 'Take Profit updated on chart'
      );
      setTimeout(() => setExecutionMessage(''), 2000);
      setDragTarget(null);
    }
  };

  const handleChartWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const maxHistoryPan = Math.max(10, candleData.length - 10);
      setPanBarsOffset((prev) => Math.max(-12, Math.min(maxHistoryPan, prev - delta * 0.04)));
    } else {
      const factor = e.deltaY > 0 ? 1.08 : 0.92;
      setVisibleBars((prev) => Math.round(Math.max(14, Math.min(130, prev * factor))));
    }
  };

  const handleAdjustSelectedBracket = (pipSteps: number) => {
    if (!selectedBracket) return;
    const step = currentInstrument.pipMultiplier * pipSteps;
    if (selectedBracket.kind === 'draft-sl') {
      const curr = Number(orderSl) || currentInstrument.bid;
      setOrderSl((curr + step).toFixed(currentInstrument.decimals));
    } else if (selectedBracket.kind === 'draft-tp') {
      const curr = Number(orderTp) || currentInstrument.ask;
      setOrderTp((curr + step).toFixed(currentInstrument.decimals));
    } else if (selectedBracket.kind === 'position-sl') {
      setOpenPositions((prev) =>
        prev.map((p) =>
          p.id === selectedBracket.positionId && p.sl !== null
            ? { ...p, sl: Number((p.sl + step).toFixed(currentInstrument.decimals)) }
            : p
        )
      );
    } else if (selectedBracket.kind === 'position-tp') {
      setOpenPositions((prev) =>
        prev.map((p) =>
          p.id === selectedBracket.positionId && p.tp !== null
            ? { ...p, tp: Number((p.tp + step).toFixed(currentInstrument.decimals)) }
            : p
        )
      );
    }
  };

  const handleClearSelectedBracket = () => {
    if (!selectedBracket) return;
    if (selectedBracket.kind === 'draft-sl') {
      setOrderSl('');
    } else if (selectedBracket.kind === 'draft-tp') {
      setOrderTp('');
    } else if (selectedBracket.kind === 'position-sl') {
      setOpenPositions((prev) =>
        prev.map((p) => (p.id === selectedBracket.positionId ? { ...p, sl: null } : p))
      );
    } else if (selectedBracket.kind === 'position-tp') {
      setOpenPositions((prev) =>
        prev.map((p) => (p.id === selectedBracket.positionId ? { ...p, tp: null } : p))
      );
    }
    setSelectedBracket(null);
  };

  const handleToggleDraftBracket = () => {
    if (!showDraftBracket) {
      const step = currentInstrument.pipMultiplier * 25;
      if (!orderSl) setOrderSl((currentInstrument.bid - step).toFixed(currentInstrument.decimals));
      if (!orderTp) setOrderTp((currentInstrument.ask + step * 1.5).toFixed(currentInstrument.decimals));
      setShowDraftBracket(true);
      setSelectedBracket({ kind: 'draft-sl' });
    } else {
      setShowDraftBracket(false);
      setSelectedBracket(null);
    }
  };

  const isViewportMoved =
    Math.abs(panBarsOffset) > 0.25 ||
    Math.abs(priceOffset) > currentInstrument.pipMultiplier ||
    Math.abs(priceScaleZoom - 1) > 0.04 ||
    visibleBars !== 44;

  const activeCandle =
    hoverPoint?.candleIdx !== null && hoverPoint?.candleIdx !== undefined
      ? chartGeometry.candleBars[hoverPoint.candleIdx]
      : candleData[candleData.length - 1];

  const draftSlNum = Number(orderSl);
  const draftTpNum = Number(orderTp);
  const hasDraftSl = Number.isFinite(draftSlNum) && draftSlNum > 0 && (showDraftBracket || Boolean(orderSl));
  const hasDraftTp = Number.isFinite(draftTpNum) && draftTpNum > 0 && (showDraftBracket || Boolean(orderTp));

  const countdownFmt = formatCountdown(barCountdownSec);

  // ============================================================================
  // SCREENSHOT 5: MT5 LOGIN SCREEN (Pure standalone gate or "+ Add Account")
  // ============================================================================
  if ((standalone && (!isTerminalConnected || !activeAccount)) || showAddLoginView) {
    return (
      <div
        data-testid="terminal-login-gate"
        className="min-h-screen w-full bg-[#000000] text-white flex flex-col font-sans select-none"
      >
        {/* Top Bar matching Screenshot 5 */}
        <header className="h-14 px-4 flex items-center justify-between border-b border-white/10 bg-[#0A0B0D] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label={showAddLoginView ? 'Back to Accounts' : 'Back to LemonFunding'}
              onClick={() => {
                if (showAddLoginView) {
                  setShowAddLoginView(false);
                } else if (onCloseTerminal) {
                  onCloseTerminal();
                }
              }}
              className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-white hover:bg-white/10 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <LemonLogo size={30} rounded="lg" />
            <h1 className="text-base font-semibold text-white truncate">LemonFunding Ltd</h1>
          </div>

          {!isInstalled && (
            <button
              type="button"
              onClick={handleInstallFromMenu}
              className="px-3 py-1.5 rounded-full bg-[#1C1E22] hover:bg-[#272A30] text-xs font-medium text-[#2196F3] flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          )}
        </header>

        {autoRestoring && (
          <div className="px-4 py-2 bg-[#12161E] border-b border-white/10 text-xs text-[#93C5FD] text-center font-medium">
            Reconnecting saved terminal account...
          </div>
        )}

        <div className="flex-1 w-full max-w-lg mx-auto flex flex-col">
          {/* Top Broker Action Rows matching Screenshot 5 */}
          <div className="divide-y divide-white/10 border-b border-white/10">
            <button
              type="button"
              onClick={handleFillDemoCredentials}
              className="w-full px-4 py-3.5 flex items-center gap-3.5 hover:bg-white/5 text-left transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-[#2196F3]/20 text-[#2196F3] flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-white leading-snug">
                  Open a demo account
                </p>
                <p className="text-xs text-[#8E929B] leading-snug">
                  Fill demo check credentials (LF-100001 / LemonDemo2026!)
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#6B7280] shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (onCloseTerminal) onCloseTerminal();
              }}
              className="w-full px-4 py-3.5 flex items-center gap-3.5 hover:bg-white/5 text-left transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-[#2196F3]/20 text-[#2196F3] flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-white leading-snug">
                  Open a real account
                </p>
                <p className="text-xs text-[#8E929B] leading-snug">
                  Buy a challenge on LemonFunding for live account ID
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#6B7280] shrink-0" />
            </button>
          </div>

          {/* Login to an existing account section */}
          <div className="px-5 py-6 space-y-5 flex-1">
            <h2 className="text-center text-[15px] font-semibold text-white">
              Login to an existing account
            </h2>

            {loginError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/40 text-xs text-[#FCA5A5] flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#EF4444]" />
                <span>{loginError}</span>
              </div>
            )}

            {loginNotice && (
              <div
                role="status"
                className="p-3 rounded-lg bg-[#2196F3]/15 border border-[#2196F3]/40 text-xs text-[#93C5FD] flex items-center gap-2"
              >
                <Check className="w-4 h-4 shrink-0 text-[#2196F3]" />
                <span>{loginNotice}</span>
              </div>
            )}

            <form onSubmit={handleTerminalLogin} className="space-y-1">
              {/* Type Row */}
              <div className="flex items-center justify-between py-3 border-b border-white/15">
                <label htmlFor="mt5-login-type" className="text-sm text-[#8E929B] w-28 shrink-0">
                  Type
                </label>
                <select
                  id="mt5-login-type"
                  value={loginType}
                  onChange={(e) => setLoginType(e.target.value as 'Trade account' | 'Investor')}
                  className="flex-1 bg-transparent text-right text-sm text-white font-medium focus:outline-none cursor-pointer"
                >
                  <option value="Trade account" className="bg-[#141518] text-white">
                    Trade account
                  </option>
                  <option value="Investor" className="bg-[#141518] text-white">
                    Investor
                  </option>
                </select>
              </div>

              {/* Login Row */}
              <div className="flex items-center py-2 border-b border-white/15">
                <label
                  htmlFor="standalone-account-id"
                  className="text-sm text-[#8E929B] w-24 shrink-0"
                >
                  Login
                </label>
                <input
                  id="standalone-account-id"
                  type="text"
                  autoComplete="username"
                  required
                  value={loginAccountNum}
                  onChange={(e) => setLoginAccountNum(e.target.value)}
                  placeholder="LF-100001"
                  className="flex-1 bg-transparent py-1.5 text-sm font-mono-tabular text-white placeholder:text-white/25 focus:outline-none"
                />
              </div>

              {/* Password Row */}
              <div className="flex items-center py-2 border-b border-white/15">
                <label
                  htmlFor="standalone-password"
                  className="text-sm text-[#8E929B] w-24 shrink-0"
                >
                  Password
                </label>
                <input
                  id="standalone-password"
                  type={showPasswordText ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter password"
                  className="flex-1 bg-transparent py-1.5 text-sm font-mono-tabular text-white placeholder:text-white/25 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordText((v) => !v)}
                  aria-label={showPasswordText ? 'Hide password' : 'Show password'}
                  className="p-2 text-[#8E929B] hover:text-white cursor-pointer"
                >
                  {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Server Row */}
              <div className="flex items-center justify-between py-3 border-b border-white/15">
                <label htmlFor="standalone-server" className="text-sm text-[#8E929B] w-24 shrink-0">
                  Server
                </label>
                <select
                  id="standalone-server"
                  value={loginServer}
                  onChange={(e) => setLoginServer(e.target.value)}
                  className="flex-1 bg-transparent text-right text-sm text-white font-medium focus:outline-none cursor-pointer"
                >
                  <option value="LemonFunding-Live" className="bg-[#141518] text-white">
                    LemonFunding-Live
                  </option>
                  <option value="LemonFunding-Demo" className="bg-[#141518] text-white">
                    LemonFunding-Demo
                  </option>
                </select>
              </div>

              {/* Save password Row */}
              <label className="flex items-center justify-between py-3.5 border-b border-white/15 cursor-pointer">
                <span className="text-sm text-[#8E929B]">Save password</span>
                <input
                  type="checkbox"
                  checked={savePassword}
                  onChange={(e) => setSavePassword(e.target.checked)}
                  className="w-5 h-5 accent-[#2196F3] rounded cursor-pointer"
                />
              </label>

              {/* Forgot password / Demo credentials trigger */}
              <div className="pt-4 pb-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowDemoHelper((v) => !v)}
                  className="text-xs font-medium text-[#2196F3] hover:underline cursor-pointer"
                >
                  Forgot password? · View Demo Login
                </button>
              </div>

              {/* Full-width bright blue LOGIN pill matching Screenshot 5 */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loginBusy}
                  className="w-full py-3.5 rounded-full bg-[#1976D2] hover:bg-[#1E88E5] disabled:opacity-60 text-white font-bold text-sm tracking-wide uppercase transition-colors cursor-pointer"
                >
                  {loginBusy ? 'AUTHORIZING...' : 'LOGIN'}
                </button>
              </div>
            </form>

            {/* Saved Terminal Accounts (1-Tap Reconnect) */}
            {savedAccounts.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[#121316] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">
                    Saved Accounts ({savedAccounts.length})
                  </span>
                  <span className="text-[11px] text-[#8E929B]">Tap to connect</span>
                </div>
                <div className="space-y-2">
                  {savedAccounts.map((saved) => {
                    const isDemo = saved.terminalServer.toLowerCase().includes('demo');
                    return (
                      <div
                        key={saved.accountNumber}
                        className="rounded-xl bg-black border border-white/10 hover:border-[#FACC15]/40 p-2.5 flex items-center gap-3 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => void handleConnectSavedAccount(saved)}
                          disabled={loginBusy}
                          className="flex-1 flex items-center gap-3 text-left min-w-0 cursor-pointer"
                        >
                          <LemonLogo size={38} rounded="lg" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white truncate">
                                {saved.modeLabel}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                                  isDemo
                                    ? 'bg-[#26A69A]/20 text-[#4ADE80]'
                                    : 'bg-[#2196F3]/20 text-[#93C5FD]'
                                }`}
                              >
                                {isDemo ? 'Demo' : 'Live'}
                              </span>
                            </div>
                            <p className="text-[11px] font-mono-tabular text-[#8E929B] truncate mt-0.5">
                              {saved.accountNumber} · {formatMt5Number(saved.currentEquity, 2)} USD
                            </p>
                          </div>
                          <span className="text-[11px] font-semibold text-[#2196F3] shrink-0">
                            {saved.terminalPassword ? 'Connect →' : 'Sign In'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSavedTerminalAccount(saved.accountNumber)}
                          aria-label={`Remove saved account ${saved.accountNumber}`}
                          title="Remove saved account"
                          className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#EF4444] hover:bg-white/5 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Demo Account Box (Collapsible + Always accessible via "Open a demo account" or "Forgot password?") */}
            <div className="p-4 rounded-2xl bg-[#121316] border border-white/10 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Demo Check Account ($100,000)</span>
                <button
                  type="button"
                  onClick={handleFillDemoCredentials}
                  className="text-[#2196F3] font-semibold hover:underline cursor-pointer"
                >
                  Auto-Fill Demo →
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono-tabular text-[11px]">
                <button
                  type="button"
                  onClick={() => handleCopy('LF-100001', 'gate-id')}
                  className="p-2.5 rounded-xl bg-black border border-white/10 flex items-center justify-between text-left cursor-pointer"
                >
                  <span>
                    <span className="text-[10px] text-[#8E929B] block font-sans">Login</span>
                    <strong className="text-white">LF-100001</strong>
                  </span>
                  {copiedField === 'gate-id' ? (
                    <Check className="w-3.5 h-3.5 text-[#26A69A]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#2196F3]" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy('LemonDemo2026!', 'gate-pass')}
                  className="p-2.5 rounded-xl bg-black border border-white/10 flex items-center justify-between text-left cursor-pointer"
                >
                  <span>
                    <span className="text-[10px] text-[#8E929B] block font-sans">Password</span>
                    <strong className="text-white">LemonDemo2026!</strong>
                  </span>
                  {copiedField === 'gate-pass' ? (
                    <Check className="w-3.5 h-3.5 text-[#26A69A]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#2196F3]" />
                  )}
                </button>
              </div>
              {showDemoHelper && (
                <p className="text-[11px] text-[#8E929B]">
                  Server: <strong className="text-white">LemonFunding-Demo</strong>
                </p>
              )}
            </div>
          </div>
        </div>

        <PWAInstallModal
          isOpen={pwaModalOpen}
          onClose={() => setPwaModalOpen(false)}
          onLaunchTerminal={() => setPwaModalOpen(false)}
        />
      </div>
    );
  }

  // ============================================================================
  // MAIN MT5 TERMINAL SHELL (Trade / Quotes / Charts / History / Messages / Accounts)
  // ============================================================================
  const floatingLabelColor = totalFloatingPnl >= 0 ? 'text-[#2196F3]' : 'text-[#EF4444]';
  const tradeTabBadgeColor =
    accountPositions.length > 0
      ? totalFloatingPnl >= 0
        ? 'bg-[#2196F3] text-white'
        : 'bg-[#B93829] text-white'
      : 'bg-[#1F2126] text-[#D1D5DB]';

  const tradeTabBadgeValue =
    accountPositions.length > 0
      ? totalFloatingPnl.toFixed(2)
      : formatMt5Number(activeAccount?.currentEquity || 0, 2);

  return (
    <div
      className={`flex flex-col bg-[#000000] text-white font-sans select-none relative ${
        isFullscreen
          ? 'fixed inset-0 z-[9999] w-screen h-screen overflow-hidden'
          : standalone
            ? activeTab === 'charts'
              ? 'h-screen overflow-hidden w-full'
              : 'min-h-screen w-full'
            : 'min-h-[calc(100vh-110px)] rounded-2xl border border-white/10 overflow-hidden'
      }`}
    >
      {/* ==================== TOP APP BAR PER ACTIVE TAB ==================== */}
      {activeTab === 'trade' && (
        <header className="h-14 px-3 sm:px-5 bg-[#000000] border-b border-white/10 flex items-center justify-between sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open terminal navigation menu"
              className="w-10 h-10 -ml-1.5 flex items-center justify-center rounded-full hover:bg-white/10 text-white cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-semibold text-white leading-tight">Trade</h2>
                {activeAccount && (
                  <span className="text-[11px] font-mono-tabular text-[#8E929B] truncate">
                    · {activeAccount.accountNumber}
                  </span>
                )}
              </div>
              <p className={`text-xs font-mono-tabular font-medium leading-tight ${floatingLabelColor}`}>
                {totalFloatingPnl >= 0 ? '' : '-'}
                {formatMt5Number(Math.abs(totalFloatingPnl), 2)} USD
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit Full Screen' : 'Full Screen Terminal'}
              title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Full Screen Terminal'}
              className={`w-10 h-10 flex items-center justify-center rounded-full cursor-pointer transition-colors ${
                isFullscreen ? 'bg-[#F7A600] text-black hover:bg-[#E59700]' : 'text-white hover:bg-white/10'
              }`}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => setTradeSortAsc((v) => !v)}
              aria-label="Sort positions"
              title="Sort Positions"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white cursor-pointer"
            >
              <ArrowUpDown className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setNewOrderModalOpen(true)}
              aria-label="New Order"
              title="Place New Order"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white cursor-pointer"
            >
              <FilePlus2 className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setAccountsMenuOpen((v) => !v)}
              aria-label="Terminal 3-dot menu"
              className="w-9 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {activeTab === 'quotes' && (
        <header className="h-14 px-3 sm:px-5 bg-[#000000] border-b border-white/10 flex items-center justify-between sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open terminal navigation menu"
              className="w-10 h-10 -ml-1.5 flex items-center justify-center rounded-full hover:bg-white/10 text-white cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-[17px] font-semibold text-white">Quotes</h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit Full Screen' : 'Full Screen Terminal'}
              title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Full Screen Terminal'}
              className={`w-10 h-10 flex items-center justify-center rounded-full cursor-pointer transition-colors ${
                isFullscreen ? 'bg-[#F7A600] text-black hover:bg-[#E59700]' : 'text-white hover:bg-white/10'
              }`}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => setQuotesSearchOpen((v) => !v)}
              aria-label="Search symbols"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white cursor-pointer"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setQuotesCategoryOpen((v) => !v)}
              aria-label="Filter categories"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {activeTab === 'charts' && (
        <header className="h-13 px-2 sm:px-4 bg-[#000000] border-b border-white/10 flex items-center justify-between sticky top-0 z-30 shrink-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open terminal navigation menu"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setShowCrosshair((v) => !v)}
            aria-label="Toggle Crosshair"
            title="Crosshair"
            className={`w-10 h-10 flex items-center justify-center rounded-full cursor-pointer ${
              showCrosshair ? 'text-[#2196F3] bg-[#2196F3]/15' : 'text-white hover:bg-white/10'
            }`}
          >
            <Crosshair className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setChartType((c) => (c === 'candle' ? 'area' : 'candle'))}
            aria-label="Switch Candle or Line"
            title="Chart Mode"
            className="w-10 h-10 flex items-center justify-center rounded-full text-white hover:bg-white/10 cursor-pointer font-serif italic text-base"
          >
            ƒ
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setTimeframePickerOpen((v) => !v)}
              className="h-10 px-2.5 flex items-center justify-center rounded-lg text-sm font-bold text-white hover:bg-white/10 cursor-pointer"
            >
              {timeframe}
            </button>
            {timeframePickerOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 top-11 z-40 bg-[#1B1D21] border border-white/15 rounded-xl p-1.5 flex gap-1 shadow-2xl">
                {(['M1', 'M5', 'M15', 'H1', 'H4', 'D1'] as const).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => {
                      setTimeframe(tf);
                      setTimeframePickerOpen(false);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      timeframe === tf ? 'bg-[#2196F3] text-white' : 'text-[#D1D5DB] hover:bg-white/10'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleToggleDraftBracket}
            aria-label="Toggle Draft SL/TP Lines"
            title="Drag SL/TP Preview Lines"
            className={`w-10 h-10 flex items-center justify-center rounded-full cursor-pointer ${
              showDraftBracket ? 'bg-[#2196F3]/20 text-[#2196F3]' : 'text-white hover:bg-white/10'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setOneClickPanelVisible((v) => !v)}
            aria-label="Toggle One-Click Trading"
            title="One-Click Order Strip"
            className={`w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer ${
              oneClickPanelVisible
                ? 'text-[#2196F3] bg-[#2196F3]/15'
                : 'text-[#8E929B] hover:bg-white/10'
            }`}
          >
            <div className="w-5 h-3.5 rounded-xs border-2 border-current flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
            </div>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit Full Screen' : 'Full Screen Terminal'}
            title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Full Screen Terminal'}
            className={`w-10 h-10 flex items-center justify-center rounded-full cursor-pointer transition-colors ${
              isFullscreen ? 'bg-[#F7A600] text-black hover:bg-[#E59700]' : 'text-white hover:bg-white/10'
            }`}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </header>
      )}

      {activeTab === 'history' && (
        <header className="h-14 px-3 sm:px-5 bg-[#000000] border-b border-white/10 flex items-center justify-between sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open terminal navigation menu"
              className="w-10 h-10 -ml-1.5 flex items-center justify-center rounded-full hover:bg-white/10 text-white cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-[17px] font-semibold text-white">History</h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit Full Screen' : 'Full Screen Terminal'}
              title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Full Screen Terminal'}
              className={`w-10 h-10 flex items-center justify-center rounded-full cursor-pointer transition-colors ${
                isFullscreen ? 'bg-[#F7A600] text-black hover:bg-[#E59700]' : 'text-white hover:bg-white/10'
              }`}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => void onRefreshDashboard()}
              aria-label="Sync History"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {activeTab === 'messages' && (
        <header className="h-14 px-3 sm:px-5 bg-[#000000] border-b border-white/10 flex items-center justify-between sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open terminal navigation menu"
              className="w-10 h-10 -ml-1.5 flex items-center justify-center rounded-full hover:bg-white/10 text-white cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-[17px] font-semibold text-white">Messages</h2>
          </div>

          {!isInstalled && (
            <button
              type="button"
              onClick={handleInstallFromMenu}
              className="px-3 py-1.5 rounded-full bg-[#1C1E22] text-xs font-medium text-[#2196F3] cursor-pointer"
            >
              Install App
            </button>
          )}
        </header>
      )}

      {activeTab === 'accounts' && (
        <header className="h-14 px-3 sm:px-5 bg-[#000000] border-b border-white/10 flex items-center justify-between sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open terminal navigation menu"
              className="w-10 h-10 -ml-1.5 flex items-center justify-center rounded-full hover:bg-white/10 text-white cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-[17px] font-semibold text-white">Accounts</h2>
          </div>

          <div className="flex items-center gap-1 relative">
            <button
              type="button"
              onClick={() => setRulesModalOpen(true)}
              aria-label="Challenge Rules"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white cursor-pointer"
            >
              <Award className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowAddLoginView(true)}
              aria-label="Add or Login Account"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white cursor-pointer"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setAccountsMenuOpen((v) => !v)}
              aria-label="Account options menu"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white cursor-pointer"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </header>
      )}

      {/* Shared Top-Right Dropdown Menu (Install App, Lock / Sign Out, Switch) */}
      {accountsMenuOpen && (
        <div className="absolute right-3 top-14 z-50 w-60 rounded-xl bg-[#1C1E22] border border-white/15 shadow-2xl py-1.5 text-xs">
          <button
            type="button"
            onClick={handleInstallFromMenu}
            className="w-full px-4 py-2.5 text-left hover:bg-white/10 flex items-center justify-between text-white cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              <Download className="w-4 h-4 text-[#2196F3]" />
              <span>{isInstalled ? 'App Installed ✓' : 'Install App to Phone'}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAccountsMenuOpen(false);
              setCredentialsModalOpen(true);
            }}
            className="w-full px-4 py-2.5 text-left hover:bg-white/10 flex items-center gap-2.5 text-white cursor-pointer"
          >
            <Key className="w-4 h-4 text-[#8E929B]" />
            <span>Account Credentials</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAccountsMenuOpen(false);
              setRulesModalOpen(true);
            }}
            className="w-full px-4 py-2.5 text-left hover:bg-white/10 flex items-center gap-2.5 text-white cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4 text-[#8E929B]" />
            <span>Prop Rules &amp; Drawdown</span>
          </button>
          {standalone ? (
            <button
              type="button"
              onClick={() => {
                setAccountsMenuOpen(false);
                if (activeAccount) {
                  persistActiveSavedSession({
                    accountNumber: activeAccount.accountNumber,
                    autoConnect: false,
                  });
                }
                setIsTerminalConnected(false);
                setLoginAccountNum('');
                setLoginPassword('');
                setLoginError('');
              }}
              className="w-full px-4 py-2.5 text-left hover:bg-white/10 flex items-center gap-2.5 text-[#EF4444] font-semibold cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Sign Out / Lock Terminal</span>
            </button>
          ) : (
            onLaunchStandaloneTerminal && (
              <button
                type="button"
                onClick={() => {
                  setAccountsMenuOpen(false);
                  onLaunchStandaloneTerminal();
                }}
                className="w-full px-4 py-2.5 text-left hover:bg-white/10 flex items-center gap-2.5 text-[#2196F3] font-semibold cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Open Standalone Login</span>
              </button>
            )
          )}
        </div>
      )}

      {/* ==================== EXECUTION TOAST & BREACH ALERT ==================== */}
      {executionMessage && (
        <div className="px-4 py-2 bg-[#16181C] border-b border-white/10 text-xs text-[#93C5FD] text-center font-mono-tabular">
          {executionMessage}
        </div>
      )}

      {(isBreached ||
        (breachBannerInfo && breachBannerInfo.accountNumber === activeAccount?.accountNumber)) &&
        activeAccount && (
          <div className="px-4 py-3 bg-[#2B0C0C] border-b border-[#EF4444]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-[#FCA5A5] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white">
                  Account {activeAccount.accountNumber} Breached — Trading Disabled
                </p>
                <p className="text-[#FECACA] text-[11px]">
                  {activeAccount.breachReason ||
                    breachBannerInfo?.reason ||
                    `Daily DD limit hit. Code ${COMEBACK_CODE} (40% OFF) unlocked.`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopy(COMEBACK_CODE, 'breach-code')}
                className="px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/20 font-mono-tabular text-white cursor-pointer"
              >
                {copiedField === 'breach-code' ? 'Copied' : `${COMEBACK_CODE} (-40%)`}
              </button>
              {onClaimComeback && (
                <button
                  type="button"
                  onClick={() => onClaimComeback(COMEBACK_CODE)}
                  className="px-3 py-1.5 rounded-lg bg-[#2196F3] text-white font-semibold cursor-pointer"
                >
                  Rebuild →
                </button>
              )}
            </div>
          </div>
        )}

      {((activeAccount?.status === 'Target Passed' && activeAccount.mode !== 'instant') ||
        (passedBannerInfo && passedBannerInfo.accountNumber === activeAccount?.accountNumber)) &&
        activeAccount && (
          <div className="px-4 py-3 bg-[#092419] border-b border-[#26A69A]/45 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-start gap-2">
              <Award className="w-4 h-4 text-[#26A69A] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white">
                  Stage Target Passed on {activeAccount.accountNumber} ({activeAccount.modeLabel})
                </p>
                <p className="text-[#A7F3D0] text-[11px]">
                  Your next-stage / funded account &amp; owner-named QR certificate are unlocked in Dashboard → Certificates &amp; Payouts.
                </p>
              </div>
            </div>
            {onCloseTerminal && (
              <button
                type="button"
                onClick={onCloseTerminal}
                className="px-3 py-1.5 rounded-lg bg-[#26A69A] text-[#09090B] font-bold cursor-pointer shrink-0"
              >
                View Certificate →
              </button>
            )}
          </div>
        )}

      {/* ==================== MAIN BODY CONTENT PER TAB ==================== */}
      <div
        className={
          activeTab === 'charts'
            ? `flex-1 min-h-0 flex flex-col ${standalone ? 'pb-16' : ''}`
            : `flex-1 overflow-y-auto ${standalone ? 'pb-20' : 'pb-4'}`
        }
      >
        {/* ---------- TAB 1: TRADE (Screenshot 1) ---------- */}
        {activeTab === 'trade' && (
          <div className="max-w-4xl mx-auto w-full">
            {/* Account Margin Dotted Summary Rows */}
            <div className="px-4 py-3 space-y-2 text-[14px]">
              {[
                {
                  label: 'Balance:',
                  value: formatMt5Number(activeAccount?.currentEquity || 0, 2),
                },
                {
                  label: 'Equity:',
                  value: formatMt5Number(currentTerminalEquity, 2),
                },
                {
                  label: 'Daily DD Floor:',
                  value: formatMt5Number(dailyFloor, 2),
                },
                {
                  label: 'Margin:',
                  value: formatMt5Number(usedMargin, 2),
                },
                {
                  label: 'Free margin:',
                  value: formatMt5Number(freeMargin, 2),
                },
                {
                  label: 'Margin Level (%):',
                  value: usedMargin > 0 ? marginLevelStr : '0.00',
                },
              ].map((row) => (
                <div key={row.label} className="flex items-baseline gap-2">
                  <span className="font-bold text-white shrink-0">{row.label}</span>
                  <span className="flex-1 border-b border-dotted border-white/20 translate-y-[-3px]" />
                  <span className="font-mono-tabular font-semibold text-white shrink-0">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Live Model-Specific Telemetry HUD (Easy Pass / Breach Room Tracking) */}
            {activeAccount && (
              <div className="mx-4 mb-3 rounded-xl bg-[#111317] border border-white/10 p-3 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-bold text-[10px] uppercase tracking-wider">
                      {isInstantModel
                        ? 'Instant · No Passing Phase'
                        : activeAccount.mode === 'one-step'
                          ? '1-Step Passing Phase'
                          : activeAccount.modeLabel.includes('Phase 2')
                            ? '2-Step Phase 2'
                            : '2-Step Phase 1'}
                    </span>
                    <span className="font-mono-tabular text-[11px] text-[#9CA3AF]">
                      {activeAccount.modeLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        activeTerminalEligibility?.eligible
                          ? 'bg-[#26A69A]/20 text-[#26A69A] border border-[#26A69A]/40'
                          : 'bg-white/5 text-[#D1D5DB] border border-white/10'
                      }`}
                    >
                      {activeTerminalEligibility?.eligible
                        ? '✓ Payout Eligible'
                        : `Valid Days: ${activeDayStats.validTradingDays}/${activeDayStats.requiredDays}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRulesModalOpen(true)}
                      className="text-[11px] text-[#2196F3] font-semibold hover:underline cursor-pointer"
                    >
                      Rules
                    </button>
                  </div>
                </div>

                {!isInstantModel && activeAccount.targetUsd > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#9CA3AF]">
                        Target Progress ({formatUsd(Math.max(0, Math.round(netProfitLive)))} /{' '}
                        {formatUsd(activeAccount.targetUsd)})
                      </span>
                      <span className="font-mono-tabular font-bold text-[#26A69A]">
                        {targetProgressPct}% · {formatUsd(targetRemainingUsd)} left
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#26A69A] transition-all duration-300"
                        style={{ width: `${targetProgressPct}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono-tabular text-[11px]">
                  <div className="p-2 rounded-lg bg-black/50 border border-white/5">
                    <span className="text-[10px] text-[#8E929B] font-sans block">
                      Daily DD Room ({activeAccount.dailyLossPct}%)
                    </span>
                    <strong className={dailyRoom < activeAccount.dailyLossUsd * 0.25 ? 'text-[#EF4444]' : 'text-white'}>
                      {formatUsd(Math.round(dailyRoom))}
                    </strong>
                  </div>
                  <div className="p-2 rounded-lg bg-black/50 border border-white/5">
                    <span className="text-[10px] text-[#8E929B] font-sans block">
                      Max DD Room ({activeAccount.maxDrawdownPct}%)
                    </span>
                    <strong className={overallRoom < activeAccount.maxDrawdownUsd * 0.25 ? 'text-[#EF4444]' : 'text-white'}>
                      {formatUsd(Math.round(overallRoom))}
                    </strong>
                  </div>
                  <div className="p-2 rounded-lg bg-black/50 border border-white/5">
                    <span className="text-[10px] text-[#8E929B] font-sans block">
                      0.50%/Day Valid Days
                    </span>
                    <strong className={activeDayStats.validTradingDays >= 5 ? 'text-[#26A69A]' : 'text-white'}>
                      {activeDayStats.validTradingDays}/5 (+{formatUsd(activeDayStats.dailyMinProfitUsd)})
                    </strong>
                  </div>
                  {isInstantModel ? (
                    <div className="p-2 rounded-lg bg-black/50 border border-white/5">
                      <span className="text-[10px] text-[#8E929B] font-sans block">
                        1% Float Room · Consist.
                      </span>
                      <strong
                        className={
                          !activeTerminalEligibility?.consistencyPassed || instantFloatRoom < instantFloatLimitUsd * 0.25
                            ? 'text-[#EF4444]'
                            : 'text-[#F7A600]'
                        }
                      >
                        {formatUsd(Math.round(instantFloatRoom))} ·{' '}
                        {activeTerminalEligibility?.consistencyPassed ? '35% OK' : '>35%!'}
                      </strong>
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-black/50 border border-white/5">
                      <span className="text-[10px] text-[#8E929B] font-sans block">
                        Live Net P&amp;L
                      </span>
                      <strong className={netProfitLive >= 0 ? 'text-[#26A69A]' : 'text-[#EF4444]'}>
                        {netProfitLive >= 0 ? '+' : '-'}
                        {formatUsd(Math.abs(Math.round(netProfitLive)))}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Gray "Positions" Header Bar with ... action menu */}
            <div className="px-4 py-1.5 bg-[#1B1D20] flex items-center justify-between text-xs text-[#9CA3AF] relative">
              <span className="font-medium">
                Positions ({accountPositions.length})
              </span>
              <button
                type="button"
                onClick={() => setPositionsMenuOpen((v) => !v)}
                aria-label="Positions bulk options"
                className="px-2 py-1 rounded hover:bg-white/10 text-white cursor-pointer"
              >
                •••
              </button>

              {positionsMenuOpen && (
                <div className="absolute right-3 top-8 z-30 w-52 rounded-xl bg-[#1F2126] border border-white/15 shadow-2xl py-1.5 text-xs text-white">
                  <button
                    type="button"
                    onClick={() => {
                      setPositionsMenuOpen(false);
                      setNewOrderModalOpen(true);
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-white/10 cursor-pointer"
                  >
                    New Order
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseProfitablePositions}
                    className="w-full px-3.5 py-2 text-left hover:bg-white/10 cursor-pointer"
                  >
                    Close Profitable Positions
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseAllPositions}
                    className="w-full px-3.5 py-2 text-left hover:bg-white/10 text-[#EF4444] cursor-pointer"
                  >
                    Close All Positions
                  </button>
                </div>
              )}
            </div>

            {/* KYC Lock Banner when Trader hasn't passed PAN + Aadhaar KYC */}
            {isKycLocked && (
              <div className="mx-3 my-2.5 p-3.5 rounded-xl bg-[#271C07] border border-[#F7A600]/45 text-xs text-[#FEF3C7] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-[#F7A600] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-[#FACC15]">
                      {effectiveKycStatus === 'pending'
                        ? 'KYC Pending Admin Approval — Trading Locked'
                        : 'KYC Required Before Trading'}
                    </p>
                    <p className="text-[11px] text-[#E5D3A8] mt-0.5">
                      {effectiveKycStatus === 'pending'
                        ? 'Your PAN & Aadhaar (Front/Back) screenshots are awaiting Owner Admin approval.'
                        : 'Upload your PAN Card & Aadhaar Front/Back screenshots to unlock live trading.'}
                    </p>
                  </div>
                </div>
                {onOpenKyc && (
                  <button
                    type="button"
                    onClick={onOpenKyc}
                    className="px-4 py-2 rounded-full bg-[#F7A600] hover:bg-[#E59700] text-[#121417] text-[11px] font-bold whitespace-nowrap cursor-pointer shrink-0"
                  >
                    {effectiveKycStatus === 'pending' ? 'View KYC Status →' : 'Complete KYC →'}
                  </button>
                )}
              </div>
            )}

            {/* Positions List matching Screenshot 1 */}
            {accountPositions.length === 0 ? (
              <div className="px-4 py-12 text-center space-y-3">
                <p className="text-sm text-[#8E929B]">No open positions on {activeAccount?.accountNumber}.</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={isBreached || isKycLocked}
                    onClick={() => setNewOrderModalOpen(true)}
                    className="px-5 py-2.5 rounded-full bg-[#1976D2] hover:bg-[#1E88E5] disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                  >
                    {isKycLocked ? 'KYC Required' : '+ New Order'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('charts')}
                    className="px-5 py-2.5 rounded-full bg-[#1B1D20] hover:bg-[#272A30] text-white text-xs font-semibold cursor-pointer"
                  >
                    Open Chart
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-white/10 border-b border-white/10">
                {accountPositions.map((pos) => {
                  const inst = instruments.find((i) => i.symbol === pos.symbol) || currentInstrument;
                  const isOpen = expandedPositionId === pos.id;
                  const pnlPos = pos.floatingPnl >= 0;
                  return (
                    <div key={pos.id} className="bg-black">
                      <button
                        type="button"
                        onClick={() => setExpandedPositionId(isOpen ? null : pos.id)}
                        className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-white/[0.03] cursor-pointer"
                      >
                        <div>
                          <p className="text-[15px] leading-snug">
                            <strong className="font-bold text-white">{pos.symbol},</strong>{' '}
                            <span
                              className={`font-semibold ${
                                pos.side === 'BUY' ? 'text-[#2196F3]' : 'text-[#EF4444]'
                              }`}
                            >
                              {pos.side.toLowerCase()} {pos.lots.toFixed(2)}
                            </span>
                          </p>
                          <p className="text-[13px] font-mono-tabular text-[#8E929B] mt-0.5">
                            {formatMt5Number(pos.openPrice, inst.decimals)} →{' '}
                            {formatMt5Number(pos.currentPrice, inst.decimals)}
                          </p>
                        </div>

                        <div className="text-right">
                          <span
                            className={`text-[16px] font-mono-tabular font-bold ${
                              pnlPos ? 'text-[#2196F3]' : 'text-[#EF4444]'
                            }`}
                          >
                            {pnlPos ? '' : '-'}
                            {formatMt5Number(Math.abs(pos.floatingPnl), 2)}
                          </span>
                          {(pos.sl !== null || pos.tp !== null) && (
                            <p className="text-[10px] font-mono-tabular text-[#8E929B]">
                              {pos.sl !== null ? `SL ${pos.sl}` : ''}{' '}
                              {pos.tp !== null ? `TP ${pos.tp}` : ''}
                            </p>
                          )}
                        </div>
                      </button>

                      {/* Inline MT5 Long-Press/Tap Context Bar */}
                      {isOpen && (
                        <div className="px-4 py-2.5 bg-[#121316] border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void closePositionOnServer(pos)}
                              className="px-3.5 py-1.5 rounded-lg bg-[#EF4444] text-white font-bold cursor-pointer"
                            >
                              Close position
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setModifyingPositionId(pos.id);
                                setModifySlInput(pos.sl !== null ? String(pos.sl) : '');
                                setModifyTpInput(pos.tp !== null ? String(pos.tp) : '');
                              }}
                              className="px-3.5 py-1.5 rounded-lg bg-[#24262B] text-white font-semibold cursor-pointer"
                            >
                              Modify SL/TP
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSymbol(pos.symbol);
                              setActiveTab('charts');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#1976D2]/25 text-[#2196F3] font-semibold cursor-pointer"
                          >
                            Chart →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ---------- TAB 2: QUOTES (Screenshot 2) ---------- */}
        {activeTab === 'quotes' && (
          <div className="max-w-4xl mx-auto w-full">
            {quotesSearchOpen && (
              <div className="px-4 py-2.5 bg-[#0E1013] border-b border-white/10">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#8E929B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={watchlistSearch}
                    onChange={(e) => setWatchlistSearch(e.target.value)}
                    placeholder="Find symbols (e.g. XAUUSD, EURUSD, NAS100)..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-black border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#2196F3]"
                  />
                </div>
              </div>
            )}

            {quotesCategoryOpen && (
              <div className="px-4 py-2 bg-[#0E1013] border-b border-white/10 flex items-center gap-2 overflow-x-auto text-xs">
                {(['All', 'Forex', 'Metals', 'Indices', 'Crypto'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setWatchlistCategory(cat)}
                    className={`px-3 py-1 rounded-md font-semibold cursor-pointer whitespace-nowrap ${
                      watchlistCategory === cat
                        ? 'bg-[#2196F3] text-white'
                        : 'bg-[#1B1D21] text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            <div className="divide-y divide-white/[0.06]">
              {filteredInstruments.map((inst) => {
                const bidSplit = splitMt5Quote(inst.bid, inst.decimals);
                const askSplit = splitMt5Quote(inst.ask, inst.decimals);
                const priceColor =
                  inst.tickTrend === 'up'
                    ? 'text-[#2196F3]'
                    : inst.tickTrend === 'down'
                      ? 'text-[#EF4444]'
                      : 'text-white';
                const chgColor = inst.changePoints >= 0 ? 'text-[#2196F3]' : 'text-[#EF4444]';

                return (
                  <div key={inst.symbol}>
                    <button
                      type="button"
                      onClick={() =>
                        setQuoteActionSymbol(quoteActionSymbol === inst.symbol ? null : inst.symbol)
                      }
                      className="w-full px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-white/[0.03] text-left cursor-pointer"
                    >
                      {/* Left Symbol Metadata */}
                      <div className="min-w-0">
                        <p className="text-[11px] font-mono-tabular leading-tight">
                          <span className="text-[#8E929B]">
                            {inst.changePoints >= 0 ? `+${inst.changePoints}` : inst.changePoints}
                          </span>{' '}
                          <span className={chgColor}>
                            {inst.change24h >= 0 ? `${inst.change24h.toFixed(2)}%` : `${inst.change24h.toFixed(2)}%`}
                          </span>
                        </p>
                        <p className="text-[17px] font-bold text-white leading-tight mt-0.5">
                          {inst.symbol}
                        </p>
                        <p className="text-[11px] font-mono-tabular text-[#8E929B] mt-0.5 flex items-center gap-2">
                          <span>{liveTimeStr}</span>
                          <span>⎶ {inst.spreadPoints}</span>
                        </p>
                      </div>

                      {/* Right MT5 Two-Column Split Bid / Ask */}
                      <div className="flex items-start gap-4 sm:gap-7 shrink-0">
                        <div className="text-right">
                          <div className={`font-mono-tabular leading-none ${priceColor}`}>
                            <span className="text-[14px]">{bidSplit.head}</span>
                            <span className="text-[22px] font-semibold tracking-tight">
                              {bidSplit.big}
                            </span>
                            {bidSplit.sup && (
                              <sup className="text-[11px] font-semibold ml-0.5">{bidSplit.sup}</sup>
                            )}
                          </div>
                          <p className="text-[11px] font-mono-tabular text-[#8E929B] mt-1">
                            L: {inst.low.toFixed(inst.decimals)}
                          </p>
                        </div>

                        <div className="text-right">
                          <div className={`font-mono-tabular leading-none ${priceColor}`}>
                            <span className="text-[14px]">{askSplit.head}</span>
                            <span className="text-[22px] font-semibold tracking-tight">
                              {askSplit.big}
                            </span>
                            {askSplit.sup && (
                              <sup className="text-[11px] font-semibold ml-0.5">{askSplit.sup}</sup>
                            )}
                          </div>
                          <p className="text-[11px] font-mono-tabular text-[#8E929B] mt-1">
                            H: {inst.high.toFixed(inst.decimals)}
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* MT5 Quote Tap Context Menu */}
                    {quoteActionSymbol === inst.symbol && (
                      <div className="px-4 py-2 bg-[#14161A] border-t border-white/10 flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSymbol(inst.symbol);
                            setQuoteActionSymbol(null);
                            setNewOrderModalOpen(true);
                          }}
                          className="flex-1 py-2 rounded-lg bg-[#1976D2] text-white font-bold cursor-pointer"
                        >
                          New order
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSymbol(inst.symbol);
                            setQuoteActionSymbol(null);
                            setActiveTab('charts');
                          }}
                          className="flex-1 py-2 rounded-lg bg-[#22252A] text-white font-semibold cursor-pointer"
                        >
                          Chart
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuoteActionSymbol(null)}
                          className="px-3 py-2 rounded-lg bg-black text-[#8E929B] cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------- TAB 3: CHARTS (Screenshot 4) ---------- */}
        {activeTab === 'charts' && (
          <div className="flex flex-col flex-1 min-h-0 bg-[#000000]">
            {/* One-Click Trading Header Strip matching Screenshot 4 */}
            {oneClickPanelVisible && (
              <div className="grid grid-cols-12 h-12 shrink-0 bg-[#0D0E11] border-b border-white/15">
                {/* Left Blue SELL Box */}
                <button
                  type="button"
                  disabled={isExecuting || isBreached || isKycLocked}
                  onClick={() => handleExecuteOrder('SELL')}
                  className="col-span-4 bg-[#2E7DDF] hover:bg-[#1E6FCC] disabled:opacity-45 px-2.5 flex flex-col justify-center text-left transition-colors cursor-pointer"
                >
                  <span className="text-[10px] font-bold uppercase text-white/90 leading-none">
                    {isKycLocked ? 'KYC LOCKED' : 'SELL'}
                  </span>
                  <span className="font-mono-tabular font-bold text-white text-sm sm:text-base leading-tight mt-0.5">
                    {currentInstrument.bid.toFixed(currentInstrument.decimals)}
                  </span>
                </button>

                {/* Center Dark Volume Stepper */}
                <div className="col-span-4 bg-[#0B0C0E] flex items-center justify-between px-2 border-x border-white/10">
                  <button
                    type="button"
                    aria-label="Decrease lots"
                    onClick={() =>
                      setOrderLots((prev) => Math.max(0.01, Number(prev) - 0.01).toFixed(2))
                    }
                    className="w-8 h-9 flex items-center justify-center text-[#9CA3AF] hover:text-white cursor-pointer"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="50"
                    value={orderLots}
                    onChange={(e) => setOrderLots(e.target.value)}
                    aria-label="Order lots"
                    className="w-16 text-center bg-transparent font-mono-tabular text-sm font-bold text-white focus:outline-none"
                  />

                  <button
                    type="button"
                    aria-label="Increase lots"
                    onClick={() =>
                      setOrderLots((prev) => Math.min(50, Number(prev) + 0.01).toFixed(2))
                    }
                    className="w-8 h-9 flex items-center justify-center text-[#9CA3AF] hover:text-white cursor-pointer"
                  >
                    <ChevronDown className="w-4 h-4 rotate-180" />
                  </button>
                </div>

                {/* Right Blue BUY Box */}
                <button
                  type="button"
                  disabled={isExecuting || isBreached || isKycLocked}
                  onClick={() => handleExecuteOrder('BUY')}
                  className="col-span-4 bg-[#2E7DDF] hover:bg-[#1E6FCC] disabled:opacity-45 px-2.5 flex flex-col justify-center text-right transition-colors cursor-pointer"
                >
                  <span className="text-[10px] font-bold uppercase text-white/90 leading-none">
                    {isKycLocked ? 'KYC LOCKED' : 'BUY'}
                  </span>
                  <span className="font-mono-tabular font-bold text-white text-sm sm:text-base leading-tight mt-0.5">
                    {currentInstrument.ask.toFixed(currentInstrument.decimals)}
                  </span>
                </button>
              </div>
            )}

            {/* Chart Canvas Container */}
            <div
              ref={chartContainerRef}
              className={`relative flex-1 min-h-0 bg-[#000000] ${
                standalone ? '' : 'min-h-[470px] lg:min-h-[520px]'
              } select-none overflow-hidden`}
            >
              {/* Top-Left OHLC Symbol + Live Status Overlay matching Screenshot 4 */}
              <div className="absolute top-2 left-2.5 z-20 pointer-events-auto">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSymbolPickerOpen((v) => !v)}
                    className="flex items-center gap-1 text-left cursor-pointer"
                  >
                    <span className="text-sm font-bold text-[#2196F3]">{currentInstrument.symbol}</span>
                    <span className="text-[10px] text-[#2196F3]">▼</span>
                    <span className="text-sm font-semibold text-white ml-1">{timeframe}</span>
                  </button>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase ${
                      liveFeedConnected
                        ? 'bg-[#26A69A]/20 text-[#4ADE80]'
                        : 'bg-white/10 text-[#9CA3AF]'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        liveFeedConnected ? 'bg-[#4ADE80] animate-pulse' : 'bg-[#9CA3AF]'
                      }`}
                    />
                    {currentInstrument.source === 'live-exchange' ||
                    currentInstrument.source === 'live-fx'
                      ? 'LIVE'
                      : 'FEED'}
                  </span>
                </div>
                <p className="text-[12px] text-[#D1D5DB] leading-tight">
                  {currentInstrument.displayName}
                </p>
                {activeCandle && (
                  <p className="text-[11px] font-mono-tabular text-[#D1D5DB] mt-0.5">
                    {activeCandle.open.toFixed(currentInstrument.decimals)}{' '}
                    {activeCandle.high.toFixed(currentInstrument.decimals)}{' '}
                    {activeCandle.low.toFixed(currentInstrument.decimals)}{' '}
                    {activeCandle.close.toFixed(currentInstrument.decimals)}
                  </p>
                )}

                {symbolPickerOpen && (
                  <div className="mt-1.5 w-52 rounded-xl bg-[#1A1C20] border border-white/15 shadow-2xl py-1 max-h-56 overflow-y-auto">
                    {instruments.map((i) => (
                      <button
                        key={i.symbol}
                        type="button"
                        onClick={() => {
                          setSelectedSymbol(i.symbol);
                          setSymbolPickerOpen(false);
                        }}
                        className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-white/10 cursor-pointer ${
                          i.symbol === selectedSymbol ? 'text-[#2196F3] font-bold' : 'text-white'
                        }`}
                      >
                        <span>{i.symbol}</span>
                        <span className="font-mono-tabular text-[11px] text-[#8E929B]">
                          {i.bid.toFixed(i.decimals)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Floating Reset / Snap-to-Live Button when chart has been panned/zoomed */}
              {isViewportMoved && (
                <button
                  type="button"
                  onClick={resetChartViewport}
                  className="absolute bottom-11 right-20 z-20 px-3 py-1.5 rounded-full bg-[#1C1E24]/95 hover:bg-[#2A2D35] border border-white/20 text-[11px] font-bold text-[#2196F3] shadow-lg cursor-pointer"
                >
                  ⟲ Live
                </button>
              )}

              {/* Precision SL/TP Fine-Adjust Bar when dragging or selecting an SL/TP handle */}
              {selectedBracket && (
                <div className="absolute bottom-11 left-2.5 z-20 flex items-center gap-1 px-2 py-1.5 rounded-xl bg-[#14161B]/95 border border-white/15 shadow-xl text-[11px]">
                  <span
                    className={`font-bold px-1.5 uppercase ${
                      selectedBracket.kind.includes('sl') ? 'text-[#EF4444]' : 'text-[#4ADE80]'
                    }`}
                  >
                    {selectedBracket.kind.includes('sl') ? 'SL' : 'TP'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAdjustSelectedBracket(-10)}
                    className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 font-mono-tabular font-bold text-white cursor-pointer"
                  >
                    -10p
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustSelectedBracket(-1)}
                    className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 font-mono-tabular font-bold text-white cursor-pointer"
                  >
                    -1p
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustSelectedBracket(1)}
                    className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 font-mono-tabular font-bold text-white cursor-pointer"
                  >
                    +1p
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustSelectedBracket(10)}
                    className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 font-mono-tabular font-bold text-white cursor-pointer"
                  >
                    +10p
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSelectedBracket}
                    className="px-2 py-1 rounded bg-[#991B1B]/70 hover:bg-[#991B1B] font-bold text-white cursor-pointer"
                  >
                    Del
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBracket(null)}
                    className="px-1.5 py-1 text-[#9CA3AF] hover:text-white cursor-pointer"
                    aria-label="Close SL TP adjust bar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Interactive SVG Candlestick Chart (Free Touch Pan, Pinch Zoom, Wheel Zoom & Draggable SL/TP) */}
              <svg
                ref={chartSvgRef}
                viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
                className={`w-full h-full block touch-none ${
                  dragTarget
                    ? 'cursor-ns-resize'
                    : showCrosshair
                      ? 'cursor-crosshair'
                      : 'cursor-grab active:cursor-grabbing'
                }`}
                onPointerDown={handleChartPointerDown}
                onPointerMove={handleChartPointerMove}
                onPointerUp={handleChartPointerUp}
                onPointerCancel={handleChartPointerUp}
                onWheel={handleChartWheel}
                onDoubleClick={resetChartViewport}
                role="img"
                aria-label={`${currentInstrument.symbol} Candlestick chart`}
              >
                <defs>
                  <clipPath id="mt5-plot-clip">
                    <rect
                      x={chartGeometry.padLeft}
                      y={0}
                      width={chartGeometry.width - chartGeometry.padLeft - chartGeometry.padRight}
                      height={chartGeometry.height - chartGeometry.padBottom}
                    />
                  </clipPath>
                </defs>

                {/* Vertical Dashed Gridlines matching Screenshot 4 */}
                {chartGeometry.timeAxisMarks.map((mark, idx) => (
                  <line
                    key={`vx-${idx}`}
                    x1={mark.x}
                    y1={chartGeometry.padTop}
                    x2={mark.x}
                    y2={chartGeometry.height - chartGeometry.padBottom}
                    stroke="#25282E"
                    strokeWidth="1"
                    strokeDasharray="3 4"
                  />
                ))}

                {/* Horizontal Dashed Gridlines + Right Price Scale */}
                {Array.from({ length: 12 }).map((_, idx) => {
                  const ratio = idx / 11;
                  const y = chartGeometry.padTop + ratio * chartGeometry.usableH;
                  const price = chartGeometry.maxP - ratio * chartGeometry.span;
                  return (
                    <g key={`hy-${idx}`}>
                      <line
                        x1={chartGeometry.padLeft}
                        y1={y}
                        x2={chartGeometry.width - chartGeometry.padRight}
                        y2={y}
                        stroke="#25282E"
                        strokeWidth="1"
                        strokeDasharray="3 4"
                      />
                      <text
                        x={chartGeometry.width - 4}
                        y={y + 3.5}
                        fill="#D1D5DB"
                        fontSize="10.5"
                        textAnchor="end"
                        fontFamily="monospace"
                      >
                        {price.toFixed(currentInstrument.decimals)}
                      </text>
                    </g>
                  );
                })}

                {/* Right Axis Separator */}
                <line
                  x1={chartGeometry.width - chartGeometry.padRight}
                  y1={0}
                  x2={chartGeometry.width - chartGeometry.padRight}
                  y2={chartGeometry.height - chartGeometry.padBottom}
                  stroke="#374151"
                  strokeWidth="1"
                />

                {/* Bottom Time Axis Labels (Live real timestamps updating with pan!) */}
                <line
                  x1={0}
                  y1={chartGeometry.height - chartGeometry.padBottom}
                  x2={chartGeometry.width - chartGeometry.padRight}
                  y2={chartGeometry.height - chartGeometry.padBottom}
                  stroke="#374151"
                  strokeWidth="1"
                />
                {chartGeometry.timeAxisMarks.map((t, idx) => (
                  <text
                    key={`tx-${idx}`}
                    x={t.x}
                    y={chartGeometry.height - 14}
                    fill="#D1D5DB"
                    fontSize="10"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {t.label}
                  </text>
                ))}

                {/* Clipped Plot Area: Candles, Bid/Ask Lines, Crosshair, & Draggable Order Brackets */}
                <g clipPath="url(#mt5-plot-clip)">
                  {chartType === 'area' ? (
                    <path
                      d={chartGeometry.areaPath}
                      fill="none"
                      stroke="#2196F3"
                      strokeWidth="2"
                    />
                  ) : (
                    chartGeometry.candleBars.map((c) => (
                      <g key={c.index}>
                        <line
                          x1={c.x}
                          y1={c.highY}
                          x2={c.x}
                          y2={c.lowY}
                          stroke={c.isBull ? '#26A69A' : '#EF5350'}
                          strokeWidth="1.3"
                        />
                        <rect
                          x={c.x - c.candleWidth / 2}
                          y={c.bodyY}
                          width={c.candleWidth}
                          height={c.bodyH}
                          fill={c.isBull ? '#26A69A' : '#EF5350'}
                        />
                      </g>
                    ))
                  )}

                  {/* Crosshair */}
                  {showCrosshair && hoverPoint && !dragTarget && (
                    <g className="pointer-events-none">
                      <line
                        x1={hoverPoint.x}
                        y1={chartGeometry.padTop}
                        x2={hoverPoint.x}
                        y2={chartGeometry.height - chartGeometry.padBottom}
                        stroke="rgba(255,255,255,0.45)"
                        strokeWidth="1"
                      />
                      <line
                        x1={chartGeometry.padLeft}
                        y1={hoverPoint.y}
                        x2={chartGeometry.width - chartGeometry.padRight}
                        y2={hoverPoint.y}
                        stroke="rgba(255,255,255,0.45)"
                        strokeWidth="1"
                      />
                    </g>
                  )}

                  {/* Bid & Ask Live Lines inside clipped plot */}
                  <line
                    x1={chartGeometry.padLeft}
                    y1={chartGeometry.currentPriceY}
                    x2={chartGeometry.width - chartGeometry.padRight}
                    y2={chartGeometry.currentPriceY}
                    stroke="#9CA3AF"
                    strokeWidth="1"
                  />
                  <line
                    x1={chartGeometry.padLeft}
                    y1={chartGeometry.askPriceY}
                    x2={chartGeometry.width - chartGeometry.padRight}
                    y2={chartGeometry.askPriceY}
                    stroke="#EF5350"
                    strokeWidth="0.9"
                  />

                  {/* Draft Draggable SL & TP Lines */}
                  {hasDraftSl && (
                    <g
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        chartSvgRef.current?.setPointerCapture?.(e.pointerId);
                        setDragTarget({ kind: 'draft-sl' });
                        setSelectedBracket({ kind: 'draft-sl' });
                      }}
                      className="cursor-ns-resize"
                    >
                      {(() => {
                        const y = chartGeometry.priceToY(draftSlNum);
                        const rightEdge = chartGeometry.width - chartGeometry.padRight;
                        return (
                          <>
                            <line
                              x1={chartGeometry.padLeft}
                              y1={y}
                              x2={rightEdge}
                              y2={y}
                              stroke="transparent"
                              strokeWidth="28"
                            />
                            <line
                              x1={chartGeometry.padLeft}
                              y1={y}
                              x2={rightEdge}
                              y2={y}
                              stroke="#EF4444"
                              strokeWidth="1.6"
                              strokeDasharray="4 3"
                            />
                            <rect
                              x={chartGeometry.padLeft + 6}
                              y={y - 11}
                              width="124"
                              height="22"
                              rx="4"
                              fill="#991B1B"
                            />
                            <text
                              x={chartGeometry.padLeft + 68}
                              y={y + 3.5}
                              fill="#FFF"
                              fontSize="10"
                              fontWeight="bold"
                              textAnchor="middle"
                              fontFamily="monospace"
                            >
                              ↕ SL {draftSlNum.toFixed(currentInstrument.decimals)}
                            </text>
                          </>
                        );
                      })()}
                    </g>
                  )}

                  {hasDraftTp && (
                    <g
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        chartSvgRef.current?.setPointerCapture?.(e.pointerId);
                        setDragTarget({ kind: 'draft-tp' });
                        setSelectedBracket({ kind: 'draft-tp' });
                      }}
                      className="cursor-ns-resize"
                    >
                      {(() => {
                        const y = chartGeometry.priceToY(draftTpNum);
                        const rightEdge = chartGeometry.width - chartGeometry.padRight;
                        return (
                          <>
                            <line
                              x1={chartGeometry.padLeft}
                              y1={y}
                              x2={rightEdge}
                              y2={y}
                              stroke="transparent"
                              strokeWidth="28"
                            />
                            <line
                              x1={chartGeometry.padLeft}
                              y1={y}
                              x2={rightEdge}
                              y2={y}
                              stroke="#26A69A"
                              strokeWidth="1.6"
                              strokeDasharray="4 3"
                            />
                            <rect
                              x={chartGeometry.padLeft + 6}
                              y={y - 11}
                              width="124"
                              height="22"
                              rx="4"
                              fill="#0F5132"
                            />
                            <text
                              x={chartGeometry.padLeft + 68}
                              y={y + 3.5}
                              fill="#FFF"
                              fontSize="10"
                              fontWeight="bold"
                              textAnchor="middle"
                              fontFamily="monospace"
                            >
                              ↕ TP {draftTpNum.toFixed(currentInstrument.decimals)}
                            </text>
                          </>
                        );
                      })()}
                    </g>
                  )}

                  {/* Open Position Entry + Touch-Draggable SL / TP Lines */}
                  {symbolPositions.map((pos) => {
                    const entryY = chartGeometry.priceToY(pos.openPrice);
                    const rightEdge = chartGeometry.width - chartGeometry.padRight;
                    return (
                      <g key={pos.id}>
                        <line
                          x1={chartGeometry.padLeft}
                          y1={entryY}
                          x2={rightEdge}
                          y2={entryY}
                          stroke="#2196F3"
                          strokeWidth="1.3"
                          strokeDasharray="3 3"
                        />
                        <rect
                          x={chartGeometry.padLeft + 4}
                          y={entryY - 10}
                          width="112"
                          height="20"
                          rx="3"
                          fill="#0F172A"
                          stroke="#2196F3"
                        />
                        <text
                          x={chartGeometry.padLeft + 60}
                          y={entryY + 3.5}
                          fill="#FFF"
                          fontSize="9.5"
                          fontWeight="bold"
                          textAnchor="middle"
                          fontFamily="monospace"
                        >
                          {pos.side.toLowerCase()} {pos.lots.toFixed(2)} ({pos.floatingPnl.toFixed(2)})
                        </text>

                        {pos.sl === null && (
                          <g
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddBracketToPosition(pos.id, 'sl');
                              setSelectedBracket({ kind: 'position-sl', positionId: pos.id });
                            }}
                            className="cursor-pointer"
                          >
                            <rect
                              x={chartGeometry.padLeft + 122}
                              y={entryY - 10}
                              width="36"
                              height="20"
                              rx="3"
                              fill="#991B1B"
                            />
                            <text
                              x={chartGeometry.padLeft + 140}
                              y={entryY + 3.5}
                              fill="#FFF"
                              fontSize="9.5"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              +SL
                            </text>
                          </g>
                        )}

                        {pos.tp === null && (
                          <g
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddBracketToPosition(pos.id, 'tp');
                              setSelectedBracket({ kind: 'position-tp', positionId: pos.id });
                            }}
                            className="cursor-pointer"
                          >
                            <rect
                              x={chartGeometry.padLeft + (pos.sl === null ? 162 : 122)}
                              y={entryY - 10}
                              width="36"
                              height="20"
                              rx="3"
                              fill="#166534"
                            />
                            <text
                              x={chartGeometry.padLeft + (pos.sl === null ? 180 : 140)}
                              y={entryY + 3.5}
                              fill="#FFF"
                              fontSize="9.5"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              +TP
                            </text>
                          </g>
                        )}

                        {pos.sl !== null && (
                          <g
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              chartSvgRef.current?.setPointerCapture?.(e.pointerId);
                              setDragTarget({ kind: 'position-sl', positionId: pos.id });
                              setSelectedBracket({ kind: 'position-sl', positionId: pos.id });
                            }}
                            className="cursor-ns-resize"
                          >
                            {(() => {
                              const slY = chartGeometry.priceToY(pos.sl);
                              const projectedUsd = computePositionPnl(
                                currentInstrument,
                                pos.side,
                                pos.openPrice,
                                pos.sl,
                                pos.lots
                              );
                              return (
                                <>
                                  <line
                                    x1={chartGeometry.padLeft}
                                    y1={slY}
                                    x2={rightEdge}
                                    y2={slY}
                                    stroke="transparent"
                                    strokeWidth="28"
                                  />
                                  <line
                                    x1={chartGeometry.padLeft}
                                    y1={slY}
                                    x2={rightEdge}
                                    y2={slY}
                                    stroke="#EF4444"
                                    strokeWidth="1.6"
                                    strokeDasharray="5 3"
                                  />
                                  <rect
                                    x={chartGeometry.padLeft + 6}
                                    y={slY - 11}
                                    width="148"
                                    height="22"
                                    rx="4"
                                    fill="#991B1B"
                                  />
                                  <text
                                    x={chartGeometry.padLeft + 80}
                                    y={slY + 3.5}
                                    fill="#FFF"
                                    fontSize="9.5"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                    fontFamily="monospace"
                                  >
                                    ↕ SL {pos.sl.toFixed(currentInstrument.decimals)} ({projectedUsd >= 0 ? '+' : ''}{projectedUsd.toFixed(2)}$)
                                  </text>
                                </>
                              );
                            })()}
                          </g>
                        )}

                        {pos.tp !== null && (
                          <g
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              chartSvgRef.current?.setPointerCapture?.(e.pointerId);
                              setDragTarget({ kind: 'position-tp', positionId: pos.id });
                              setSelectedBracket({ kind: 'position-tp', positionId: pos.id });
                            }}
                            className="cursor-ns-resize"
                          >
                            {(() => {
                              const tpY = chartGeometry.priceToY(pos.tp);
                              const projectedUsd = computePositionPnl(
                                currentInstrument,
                                pos.side,
                                pos.openPrice,
                                pos.tp,
                                pos.lots
                              );
                              return (
                                <>
                                  <line
                                    x1={chartGeometry.padLeft}
                                    y1={tpY}
                                    x2={rightEdge}
                                    y2={tpY}
                                    stroke="transparent"
                                    strokeWidth="28"
                                  />
                                  <line
                                    x1={chartGeometry.padLeft}
                                    y1={tpY}
                                    x2={rightEdge}
                                    y2={tpY}
                                    stroke="#26A69A"
                                    strokeWidth="1.6"
                                    strokeDasharray="5 3"
                                  />
                                  <rect
                                    x={chartGeometry.padLeft + 6}
                                    y={tpY - 11}
                                    width="148"
                                    height="22"
                                    rx="4"
                                    fill="#0F5132"
                                  />
                                  <text
                                    x={chartGeometry.padLeft + 80}
                                    y={tpY + 3.5}
                                    fill="#FFF"
                                    fontSize="9.5"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                    fontFamily="monospace"
                                  >
                                    ↕ TP {pos.tp.toFixed(currentInstrument.decimals)} ({projectedUsd >= 0 ? '+' : ''}{projectedUsd.toFixed(2)}$)
                                  </text>
                                </>
                              );
                            })()}
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>

                {/* Right-Axis Colored Tags for Active SL / TP + Live Green Countdown Price Tag */}
                {symbolPositions.map((pos) => (
                  <g key={`axis-tags-${pos.id}`} className="pointer-events-none">
                    {pos.sl !== null && (
                      <g>
                        <rect
                          x={chartGeometry.width - chartGeometry.padRight}
                          y={chartGeometry.priceToY(pos.sl) - 9}
                          width={chartGeometry.padRight}
                          height="18"
                          fill="#991B1B"
                        />
                        <text
                          x={chartGeometry.width - 4}
                          y={chartGeometry.priceToY(pos.sl) + 3.5}
                          fill="#FFF"
                          fontSize="9.5"
                          fontWeight="bold"
                          textAnchor="end"
                          fontFamily="monospace"
                        >
                          {pos.sl.toFixed(currentInstrument.decimals)}
                        </text>
                      </g>
                    )}
                    {pos.tp !== null && (
                      <g>
                        <rect
                          x={chartGeometry.width - chartGeometry.padRight}
                          y={chartGeometry.priceToY(pos.tp) - 9}
                          width={chartGeometry.padRight}
                          height="18"
                          fill="#0F5132"
                        />
                        <text
                          x={chartGeometry.width - 4}
                          y={chartGeometry.priceToY(pos.tp) + 3.5}
                          fill="#FFF"
                          fontSize="9.5"
                          fontWeight="bold"
                          textAnchor="end"
                          fontFamily="monospace"
                        >
                          {pos.tp.toFixed(currentInstrument.decimals)}
                        </text>
                      </g>
                    )}
                  </g>
                ))}

                {/* Right Green Countdown Live Bid Tag */}
                <rect
                  x={chartGeometry.width - chartGeometry.padRight}
                  y={chartGeometry.currentPriceY - 13}
                  width={chartGeometry.padRight}
                  height="26"
                  fill="#1F7A6E"
                />
                <text
                  x={chartGeometry.width - 4}
                  y={chartGeometry.currentPriceY - 2}
                  fill="#FFFFFF"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {currentInstrument.bid.toFixed(currentInstrument.decimals)}
                </text>
                <text
                  x={chartGeometry.width - 4}
                  y={chartGeometry.currentPriceY + 9}
                  fill="#E5E7EB"
                  fontSize="9.5"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {countdownFmt}
                </text>

                {/* Crosshair Right-Axis Price Tag */}
                {showCrosshair && hoverPoint && !dragTarget && (
                  <g className="pointer-events-none">
                    <rect
                      x={chartGeometry.width - chartGeometry.padRight}
                      y={hoverPoint.y - 9}
                      width={chartGeometry.padRight}
                      height="18"
                      fill="#374151"
                    />
                    <text
                      x={chartGeometry.width - 4}
                      y={hoverPoint.y + 3.5}
                      fill="#FFF"
                      fontSize="9.5"
                      fontWeight="bold"
                      textAnchor="end"
                      fontFamily="monospace"
                    >
                      {hoverPoint.price.toFixed(currentInstrument.decimals)}
                    </text>
                  </g>
                )}
              </svg>
            </div>
          </div>
        )}

        {/* ---------- TAB 4: HISTORY ---------- */}
        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto w-full">
            <div className="px-4 py-3 space-y-2 text-[14px] border-b border-white/10">
              {[
                {
                  label: 'Profit:',
                  value: `${netProfitLive >= 0 ? '' : '-'}${formatMt5Number(
                    Math.abs(accountClosedTrades.reduce((s, t) => s + t.pnlUsd, 0)),
                    2
                  )}`,
                  color:
                    accountClosedTrades.reduce((s, t) => s + t.pnlUsd, 0) >= 0
                      ? 'text-[#2196F3]'
                      : 'text-[#EF4444]',
                },
                {
                  label: 'Deposit:',
                  value: formatMt5Number(activeAccount?.startingBalance || 0, 2),
                  color: 'text-white',
                },
                {
                  label: 'Balance:',
                  value: formatMt5Number(activeAccount?.currentEquity || 0, 2),
                  color: 'text-white',
                },
              ].map((row) => (
                <div key={row.label} className="flex items-baseline gap-2">
                  <span className="font-bold text-white shrink-0">{row.label}</span>
                  <span className="flex-1 border-b border-dotted border-white/20 translate-y-[-3px]" />
                  <span className={`font-mono-tabular font-semibold shrink-0 ${row.color}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="px-4 py-1.5 bg-[#1B1D20] text-xs text-[#9CA3AF]">
              Closed Deals ({accountClosedTrades.length})
            </div>

            {accountClosedTrades.length === 0 ? (
              <div className="px-4 py-14 text-center text-sm text-[#8E929B]">
                No closed deals yet for {activeAccount?.accountNumber}.
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {accountClosedTrades.map((t) => {
                  const posPnl = t.pnlUsd >= 0;
                  return (
                    <div key={t.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-[15px]">
                          <strong className="text-white">{t.symbol},</strong>{' '}
                          <span
                            className={`font-semibold ${
                              t.side === 'BUY' ? 'text-[#2196F3]' : 'text-[#EF4444]'
                            }`}
                          >
                            {t.side.toLowerCase()} {t.lots.toFixed(2)}
                          </span>
                        </p>
                        <p className="text-xs text-[#8E929B] mt-0.5 truncate max-w-[230px]">
                          {t.notes}
                        </p>
                      </div>
                      <span
                        className={`text-[15px] font-mono-tabular font-bold ${
                          posPnl ? 'text-[#2196F3]' : 'text-[#EF4444]'
                        }`}
                      >
                        {posPnl ? '' : '-'}
                        {formatMt5Number(Math.abs(t.pnlUsd), 2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ---------- TAB 5: MESSAGES ---------- */}
        {activeTab === 'messages' && (
          <div className="max-w-4xl mx-auto w-full divide-y divide-white/10">
            <div className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">
                  LemonFunding Risk &amp; Target Engine
                </span>
                <span className="text-[11px] text-[#8E929B] font-mono-tabular">{liveTimeStr}</span>
              </div>
              <p className="text-xs text-[#D1D5DB] leading-relaxed">
                Account <strong>{activeAccount?.accountNumber}</strong> connected on{' '}
                <strong>{activeAccount?.terminalServer || loginServer}</strong>. Daily DD Limit:{' '}
                {activeAccount?.dailyLossPct}% ({formatUsd(activeAccount?.dailyLossUsd || 0)}). Profit
                Target: {targetProgressPct}% completed.
              </p>
            </div>

            {isBreached ? (
              <div className="p-4 bg-[#240B0B] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#FCA5A5]">
                    Account Breached — 40% Comeback Unlocked
                  </span>
                  <span className="text-[11px] font-mono-tabular text-[#FECACA]">Active</span>
                </div>
                <p className="text-xs text-[#FECACA] leading-relaxed">
                  Use promo code <strong className="text-white">{COMEBACK_CODE}</strong> to receive
                  40% off your next LemonFunding challenge.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCopy(COMEBACK_CODE, 'msg-comeback')}
                    className="px-3 py-1.5 rounded-lg bg-black/50 text-xs text-white cursor-pointer"
                  >
                    {copiedField === 'msg-comeback' ? 'Copied' : `Copy ${COMEBACK_CODE}`}
                  </button>
                  {onClaimComeback && (
                    <button
                      type="button"
                      onClick={() => onClaimComeback(COMEBACK_CODE)}
                      className="px-3 py-1.5 rounded-lg bg-[#2196F3] text-xs font-bold text-white cursor-pointer"
                    >
                      Apply 40% Off →
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-1.5">
                <span className="text-sm font-bold text-white block">
                  Install Lemon Terminal to Phone
                </span>
                <p className="text-xs text-[#8E929B]">
                  Add Lemon Terminal to your Android or iPhone home screen so it launches full-screen
                  straight to Account ID &amp; Password.
                </p>
                <button
                  type="button"
                  onClick={handleInstallFromMenu}
                  className="mt-1 px-4 py-2 rounded-lg bg-[#1976D2] text-white text-xs font-bold cursor-pointer"
                >
                  Download / Install App
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---------- TAB 6: ACCOUNTS (Screenshot 3) ---------- */}
        {activeTab === 'accounts' && (
          <div className="max-w-lg mx-auto w-full px-3.5 py-4 space-y-3.5">
            {/* Featured Active Account Dark Card with Custom Lemon Logo */}
            {activeAccount && (
              <div className="rounded-2xl bg-[#1C1D20] p-5 text-center space-y-2.5 border border-white/5 relative">
                <div className="flex justify-center">
                  <LemonLogo size={52} rounded="xl" className="shadow-md" />
                </div>

                <h3 className="text-lg font-bold text-white leading-tight">
                  {activeAccount.modeLabel}
                </h3>

                <p className="text-xs font-medium text-[#2196F3]">LemonFunding Ltd</p>

                <button
                  type="button"
                  onClick={() => setCredentialsModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-white cursor-pointer"
                >
                  <span className="font-mono-tabular">
                    {activeAccount.accountNumber} — {activeAccount.terminalServer || loginServer}
                  </span>
                  <Info className="w-3.5 h-3.5 text-[#8E929B]" />
                </button>

                <p className="text-xs text-[#9CA3AF]">
                  Access Server LD3, {activeAccount.status} · DD {activeAccount.dailyLossPct}%
                </p>

                <div className="pt-1 pb-1">
                  <span className="text-2xl font-normal font-mono-tabular text-white">
                    {formatMt5Number(activeAccount.currentEquity, 2)}
                  </span>{' '}
                  <span className="text-xs text-[#9CA3AF]">USD</span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setCredentialsModalOpen(true)}
                    aria-label="Show account credentials"
                    className="p-2 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/10 cursor-pointer"
                  >
                    <QrCode className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('messages')}
                    aria-label="Notifications"
                    className="p-2 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/10 cursor-pointer"
                  >
                    <Bell className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Secondary Account Cards List with Custom Lemon Logo */}
            {accounts.map((acct) => {
              const isSelected = acct.id === activeAccount?.id;
              const isDemo = (acct.terminalServer || '').toLowerCase().includes('demo');
              const acctBreached = acct.status === 'Breached';
              return (
                <div
                  key={acct.id}
                  onClick={() => {
                    setSelectedAccountId(acct.id);
                    upsertSavedTerminalAccount(acct);
                    persistActiveSavedSession({
                      accountNumber: acct.accountNumber,
                      autoConnect: true,
                    });
                    setActiveTab('trade');
                  }}
                  className={`rounded-2xl bg-[#1C1D20] p-4 flex items-center gap-3.5 cursor-pointer border transition-colors ${
                    isSelected ? 'border-[#2196F3]/60' : 'border-white/5 hover:border-white/20'
                  }`}
                >
                  <LemonLogo size={42} rounded="lg" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-white truncate">
                        {acct.modeLabel}{' '}
                        <span className="text-[#FACC15] font-mono-tabular text-xs">
                          · {Math.round(acct.accountSize / 1000)}K
                        </span>
                      </p>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                          acctBreached
                            ? 'bg-[#EF4444]/20 text-[#FCA5A5]'
                            : isDemo
                              ? 'bg-[#26A69A]/25 text-[#4ADE80]'
                              : 'bg-[#2196F3]/25 text-[#93C5FD]'
                        }`}
                      >
                        {acctBreached ? 'Breached' : isDemo ? 'Demo' : 'Live'}
                      </span>
                    </div>

                    <p className="text-xs text-[#9CA3AF] font-mono-tabular truncate mt-0.5">
                      {acct.accountNumber} — {acct.terminalServer || 'LemonFunding-Live'}
                    </p>

                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-[#D1D5DB] font-mono-tabular">
                        {formatMt5Number(acct.currentEquity, 2)} USD,{' '}
                        {acct.profitSplitPct}% Split
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAccountId(acct.id);
                          setCredentialsModalOpen(true);
                        }}
                        aria-label={`Credentials for ${acct.accountNumber}`}
                        className="p-1 text-[#9CA3AF] hover:text-white cursor-pointer"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Previously Saved Accounts on Device (not yet loaded in current session) */}
            {savedAccounts
              .filter(
                (saved) =>
                  !accounts.some(
                    (a) => a.accountNumber.toLowerCase() === saved.accountNumber.toLowerCase()
                  )
              )
              .map((saved) => {
                const isDemo = saved.terminalServer.toLowerCase().includes('demo');
                return (
                  <div
                    key={`saved-${saved.accountNumber}`}
                    className="rounded-2xl bg-[#16171B] p-4 flex items-center gap-3.5 border border-white/10 hover:border-[#FACC15]/40 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => void handleConnectSavedAccount(saved)}
                      className="flex-1 flex items-center gap-3.5 text-left min-w-0 cursor-pointer"
                    >
                      <LemonLogo size={42} rounded="lg" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-white truncate">
                            {saved.modeLabel}{' '}
                            <span className="text-[#FACC15] font-mono-tabular text-xs">
                              · {Math.round(saved.accountSize / 1000)}K
                            </span>
                          </p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              isDemo
                                ? 'bg-[#26A69A]/20 text-[#4ADE80]'
                                : 'bg-[#2196F3]/20 text-[#93C5FD]'
                            }`}
                          >
                            Saved
                          </span>
                        </div>
                        <p className="text-xs text-[#9CA3AF] font-mono-tabular truncate mt-0.5">
                          {saved.accountNumber} — {saved.terminalServer}
                        </p>
                        <p className="text-xs text-[#D1D5DB] font-mono-tabular mt-1">
                          {formatMt5Number(saved.currentEquity, 2)} USD · Tap to switch
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSavedTerminalAccount(saved.accountNumber)}
                      aria-label={`Remove saved account ${saved.accountNumber}`}
                      className="p-2 rounded-lg text-[#6B7280] hover:text-[#EF4444] hover:bg-white/5 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

            <button
              type="button"
              onClick={() => setShowAddLoginView(true)}
              className="w-full py-3 rounded-2xl bg-[#16171A] hover:bg-[#202227] border border-dashed border-white/15 text-xs font-semibold text-[#2196F3] cursor-pointer"
            >
              + Login to another account ID
            </button>
          </div>
        )}
      </div>

      {/* ==================== FIXED BOTTOM MT5 5-TAB NAVIGATION BAR ==================== */}
      <nav
        aria-label="MT5 Terminal bottom navigation"
        className={`${
          standalone ? 'fixed bottom-0 left-0 right-0' : 'sticky bottom-0 mt-auto'
        } z-30 h-16 bg-[#0B0C0E] border-t border-white/10 grid grid-cols-5 items-center px-1 shrink-0`}
      >
        <button
          type="button"
          onClick={() => setActiveTab('quotes')}
          className={`flex flex-col items-center justify-center gap-0.5 h-full cursor-pointer ${
            activeTab === 'quotes' ? 'text-[#2196F3]' : 'text-[#8E929B] hover:text-white'
          }`}
        >
          <ArrowUpDown className="w-5 h-5" />
          <span className="text-[11px] font-medium">Quotes</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('charts')}
          className={`flex flex-col items-center justify-center gap-0.5 h-full cursor-pointer ${
            activeTab === 'charts' ? 'text-[#2196F3]' : 'text-[#8E929B] hover:text-white'
          }`}
        >
          <CandlestickChart className="w-5 h-5" />
          <span className="text-[11px] font-medium">Charts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('trade')}
          className={`flex flex-col items-center justify-center gap-1 h-full cursor-pointer ${
            activeTab === 'trade' ? 'text-[#2196F3]' : 'text-[#8E929B] hover:text-white'
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono-tabular font-bold leading-none ${tradeTabBadgeColor}`}
          >
            {tradeTabBadgeValue}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center justify-center gap-0.5 h-full cursor-pointer ${
            activeTab === 'history' ? 'text-[#2196F3]' : 'text-[#8E929B] hover:text-white'
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[11px] font-medium">History</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('messages')}
          className={`flex flex-col items-center justify-center gap-0.5 h-full cursor-pointer relative ${
            activeTab === 'messages' ? 'text-[#2196F3]' : 'text-[#8E929B] hover:text-white'
          }`}
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5" />
            <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center">
              {isBreached ? '2' : '1'}
            </span>
          </div>
          <span className="text-[11px] font-medium">Messages</span>
        </button>
      </nav>

      {/* ==================== LEFT HAMBURGER SIDEBAR DRAWER ==================== */}
      {drawerOpen && (
        <div className={`${standalone ? 'fixed' : 'absolute'} inset-0 z-50 flex`}>
          <div
            className={`${standalone ? 'fixed' : 'absolute'} inset-0 bg-black/70`}
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[82vw] bg-[#141518] border-r border-white/10 h-full flex flex-col justify-between p-4">
            <div className="space-y-4">
              {/* Active Account Header Card */}
              <div className="pb-4 border-b border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <LemonLogo size={40} rounded="xl" />
                    <div>
                      <p className="text-sm font-bold text-white leading-tight">LemonFunding</p>
                      <p className="text-[11px] text-[#FACC15] font-medium">LemonTerm Mobile</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close drawer"
                    className="p-1.5 text-[#8E929B] hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {activeAccount && (
                  <div>
                    <p className="text-sm font-bold text-white">{activeAccount.modeLabel}</p>
                    <p className="text-xs font-mono-tabular text-[#8E929B]">
                      {activeAccount.accountNumber} — {activeAccount.terminalServer || loginServer}
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    setActiveTab('accounts');
                  }}
                  className="text-xs font-semibold text-[#2196F3] hover:underline cursor-pointer"
                >
                  Manage accounts
                </button>
              </div>

              {/* Navigation Items */}
              <nav className="space-y-1 text-sm">
                {[
                  { id: 'trade' as Mt5Tab, label: 'Trade', icon: TrendingUp },
                  { id: 'quotes' as Mt5Tab, label: 'Quotes', icon: ArrowUpDown },
                  { id: 'charts' as Mt5Tab, label: 'Charts', icon: CandlestickChart },
                  { id: 'history' as Mt5Tab, label: 'History', icon: History },
                  { id: 'messages' as Mt5Tab, label: 'Messages', icon: MessageSquare },
                  { id: 'accounts' as Mt5Tab, label: 'Accounts', icon: Briefcase },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setDrawerOpen(false);
                        setActiveTab(item.id);
                      }}
                      className={`w-full px-3 py-2.5 rounded-xl flex items-center gap-3 cursor-pointer ${
                        active
                          ? 'bg-[#2196F3]/15 text-[#2196F3] font-semibold'
                          : 'text-[#E5E7EB] hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="pt-2 border-t border-white/10 space-y-1 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    setRulesModalOpen(true);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl flex items-center gap-3 text-[#E5E7EB] hover:bg-white/5 cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-[#8E929B]" />
                  <span>Prop Risk Rules &amp; Target</span>
                </button>

                <button
                  type="button"
                  onClick={handleInstallFromMenu}
                  className="w-full px-3 py-2.5 rounded-xl flex items-center gap-3 text-[#2196F3] hover:bg-white/5 font-semibold cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{isInstalled ? 'Installed Standalone' : 'Install App to Phone'}</span>
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 space-y-1.5 text-xs">
              {standalone && (
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    if (activeAccount) {
                      persistActiveSavedSession({
                        accountNumber: activeAccount.accountNumber,
                        autoConnect: false,
                      });
                    }
                    setIsTerminalConnected(false);
                    setLoginAccountNum('');
                    setLoginPassword('');
                  }}
                  className="w-full px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-[#EF4444] font-semibold hover:bg-white/5 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>Sign Out / Lock Terminal</span>
                </button>
              )}

              {onCloseTerminal && (
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    onCloseTerminal();
                  }}
                  className="w-full px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-[#8E929B] hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to LemonFunding</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ==================== NEW ORDER MODAL SHEET ([+] Button) ==================== */}
      {newOrderModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-[#141518] border border-white/15 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Instant Execution</h3>
                <p className="text-xs text-[#8E929B]">{currentInstrument.symbol}</p>
              </div>
              <button
                type="button"
                onClick={() => setNewOrderModalOpen(false)}
                className="p-1.5 rounded-lg text-[#8E929B] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#8E929B] block mb-1">Symbol</label>
                <select
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-black border border-white/15 text-sm text-white"
                >
                  {instruments.map((inst) => (
                    <option key={inst.symbol} value={inst.symbol}>
                      {inst.symbol} — {inst.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[#8E929B] block mb-1">Volume (Lots)</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOrderLots((prev) => Math.max(0.01, Number(prev) - 0.1).toFixed(2))
                    }
                    className="px-3 py-2 rounded-xl bg-black border border-white/15 text-white font-bold cursor-pointer"
                  >
                    -0.1
                  </button>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="50"
                    value={orderLots}
                    onChange={(e) => setOrderLots(e.target.value)}
                    className="flex-1 text-center py-2 rounded-xl bg-black border border-white/15 font-mono-tabular text-sm font-bold text-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setOrderLots((prev) => Math.min(50, Number(prev) + 0.1).toFixed(2))
                    }
                    className="px-3 py-2 rounded-xl bg-black border border-white/15 text-white font-bold cursor-pointer"
                  >
                    +0.1
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#EF4444] block mb-1">Stop Loss (SL)</label>
                  <input
                    type="number"
                    step="any"
                    value={orderSl}
                    onChange={(e) => setOrderSl(e.target.value)}
                    placeholder="Not set"
                    className="w-full px-3 py-2 rounded-xl bg-black border border-white/15 font-mono-tabular text-white"
                  />
                </div>
                <div>
                  <label className="text-[#26A69A] block mb-1">Take Profit (TP)</label>
                  <input
                    type="number"
                    step="any"
                    value={orderTp}
                    onChange={(e) => setOrderTp(e.target.value)}
                    placeholder="Not set"
                    className="w-full px-3 py-2 rounded-xl bg-black border border-white/15 font-mono-tabular text-white"
                  />
                </div>
              </div>

              {isKycLocked && (
                <div className="p-3 rounded-xl bg-[#271C07] border border-[#F7A600]/45 text-xs text-[#FACC15] flex items-center justify-between gap-2">
                  <span>
                    {effectiveKycStatus === 'pending'
                      ? 'KYC Pending Admin Approval.'
                      : 'Complete PAN + Aadhaar KYC to unlock orders.'}
                  </span>
                  {onOpenKyc && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewOrderModalOpen(false);
                        onOpenKyc();
                      }}
                      className="px-3 py-1 rounded-full bg-[#F7A600] text-[#121417] text-[11px] font-bold cursor-pointer shrink-0"
                    >
                      Verify KYC →
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  disabled={isBreached || isKycLocked}
                  onClick={() => handleExecuteOrder('SELL')}
                  className="py-3 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-40 text-white font-bold text-xs cursor-pointer"
                >
                  SELL BY MARKET
                  <span className="block font-mono-tabular text-sm mt-0.5">
                    {currentInstrument.bid.toFixed(currentInstrument.decimals)}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={isBreached || isKycLocked}
                  onClick={() => handleExecuteOrder('BUY')}
                  className="py-3 rounded-xl bg-[#1976D2] hover:bg-[#1E88E5] disabled:opacity-40 text-white font-bold text-xs cursor-pointer"
                >
                  BUY BY MARKET
                  <span className="block font-mono-tabular text-sm mt-0.5">
                    {currentInstrument.ask.toFixed(currentInstrument.decimals)}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODIFY POSITION SL/TP MODAL ==================== */}
      {modifyingPositionId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#141518] border border-white/15 p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <h3 className="text-sm font-bold text-white">Modify SL / TP</h3>
              <button
                type="button"
                onClick={() => setModifyingPositionId(null)}
                className="text-[#8E929B] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[#EF4444] block mb-1">Stop Loss</label>
                <input
                  type="number"
                  step="any"
                  value={modifySlInput}
                  onChange={(e) => setModifySlInput(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 rounded-xl bg-black border border-white/15 font-mono-tabular text-white"
                />
              </div>
              <div>
                <label className="text-[#26A69A] block mb-1">Take Profit</label>
                <input
                  type="number"
                  step="any"
                  value={modifyTpInput}
                  onChange={(e) => setModifyTpInput(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 rounded-xl bg-black border border-white/15 font-mono-tabular text-white"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const slVal = modifySlInput.trim() ? Number(modifySlInput) : null;
                const tpVal = modifyTpInput.trim() ? Number(modifyTpInput) : null;
                setOpenPositions((prev) =>
                  prev.map((p) =>
                    p.id === modifyingPositionId
                      ? {
                          ...p,
                          sl: slVal !== null && Number.isFinite(slVal) ? slVal : null,
                          tp: tpVal !== null && Number.isFinite(tpVal) ? tpVal : null,
                        }
                      : p
                  )
                );
                setModifyingPositionId(null);
              }}
              className="w-full py-2.5 rounded-full bg-[#1976D2] text-white font-bold cursor-pointer"
            >
              MODIFY
            </button>
          </div>
        </div>
      )}

      {/* ==================== ACCOUNT CREDENTIALS MODAL ==================== */}
      {credentialsModalOpen && activeAccount && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#141518] border border-white/15 p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2.5">
                <LemonLogo size={26} rounded="lg" />
                <h3 className="text-sm font-bold text-white">Trading Account Credentials</h3>
              </div>
              <button
                type="button"
                onClick={() => setCredentialsModalOpen(false)}
                className="text-[#8E929B] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {[
              {
                key: 'srv',
                label: 'Server',
                val: activeAccount.terminalServer || 'LemonFunding-Live',
              },
              { key: 'id', label: 'Login ID', val: activeAccount.accountNumber },
              {
                key: 'pass',
                label: 'Trader Password',
                val: activeAccount.terminalPassword || 'LT-LEMON1!',
              },
              {
                key: 'inv',
                label: 'Investor Password',
                val: activeAccount.investorPassword || 'INV-LEMON1',
              },
            ].map((item) => (
              <div
                key={item.key}
                className="p-3 rounded-xl bg-black border border-white/10 flex items-center justify-between font-mono-tabular"
              >
                <div>
                  <span className="text-[10px] text-[#8E929B] block font-sans">{item.label}</span>
                  <strong className="text-white">{item.val}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(item.val, item.key)}
                  className="p-1.5 text-[#2196F3] cursor-pointer"
                >
                  {copiedField === item.key ? (
                    <Check className="w-4 h-4 text-[#26A69A]" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== PROP RISK RULES & TARGET MODAL ==================== */}
      {rulesModalOpen && activeAccount && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#141518] border border-white/15 p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#2196F3]" />
                <h3 className="text-sm font-bold text-white">
                  Evaluation Risk Rules · {activeAccount.accountNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRulesModalOpen(false)}
                className="text-[#8E929B] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 font-mono-tabular">
              <div className="p-3 rounded-xl bg-black border border-white/10">
                <span className="text-[10px] text-[#8E929B] block font-sans">Account Size</span>
                <strong className="text-white text-sm">{formatUsd(activeAccount.accountSize)}</strong>
              </div>
              <div className="p-3 rounded-xl bg-black border border-white/10">
                <span className="text-[10px] text-[#8E929B] block font-sans">
                  {isInstantModel ? 'Passing Phase' : 'Profit Target'}
                </span>
                <strong className="text-[#26A69A] text-sm">
                  {!isInstantModel && activeAccount.targetUsd > 0
                    ? `${formatUsd(activeAccount.targetUsd)} (${targetProgressPct}%)`
                    : 'Direct Funded (None)'}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-black border border-white/10">
                <span className="text-[10px] text-[#8E929B] block font-sans">
                  Daily Loss Limit ({activeAccount.dailyLossPct}%)
                </span>
                <strong className="text-[#EF4444] text-sm">
                  Room {formatUsd(Math.round(dailyRoom))}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-black border border-white/10">
                <span className="text-[10px] text-[#8E929B] block font-sans">
                  Max Drawdown ({activeAccount.maxDrawdownPct}%)
                </span>
                <strong className="text-white text-sm">
                  Room {formatUsd(Math.round(overallRoom))}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-black border border-white/10">
                <span className="text-[10px] text-[#8E929B] block font-sans">
                  Min Valid Days (≥0.50%/day)
                </span>
                <strong className="text-white text-sm">
                  {activeDayStats.validTradingDays} / {activeDayStats.requiredDays} (+{formatUsd(activeDayStats.dailyMinProfitUsd)})
                </strong>
              </div>
              {isInstantModel && (
                <div className="p-3 rounded-xl bg-black border border-white/10">
                  <span className="text-[10px] text-[#8E929B] block font-sans">
                    1% Float Room / 35% Rule
                  </span>
                  <strong className="text-[#F7A600] text-sm">
                    {formatUsd(Math.round(instantFloatRoom))} · {activeTerminalEligibility?.consistencyPassed ? '35% OK' : 'Exceeded'}
                  </strong>
                </div>
              )}
            </div>

            <p className="text-[11px] text-[#8E929B] leading-relaxed">
              Crossing your Daily DD Floor ({formatUsd(Math.round(dailyFloor))}) or Max DD Floor (
              {formatUsd(Math.round(overallFloor))}){isInstantModel ? ` or Instant 1% Float Loss ($${instantFloatLimitUsd.toLocaleString('en-US')})` : ''} automatically liquidates positions, breaches
              this account, and unlocks 40% Off code <strong>{COMEBACK_CODE}</strong>.
            </p>
          </div>
        </div>
      )}

      <PWAInstallModal
        isOpen={pwaModalOpen}
        onClose={() => setPwaModalOpen(false)}
        onLaunchTerminal={onLaunchStandaloneTerminal}
      />
    </div>
  );
}
