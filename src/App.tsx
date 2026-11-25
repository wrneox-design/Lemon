import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronRight,
  Gift,
  KeyRound,
  Rocket,
  Smartphone,
  Star,
  Trophy,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { AuthPageView } from './components/AuthPageView';
import { AdminPanel } from './components/AdminPanel';
import { AuthVerifyModal } from './components/AuthVerifyModal';
import { ChallengeConfigurator } from './components/ChallengeConfigurator';
import { EnrollmentModal } from './components/EnrollmentModal';
import { Header } from './components/Header';
import { LemonLogo } from './components/LemonLogo';
import { LemonTerminal } from './components/LemonTerminal';
import { LemonVault3D } from './components/LemonVault3D';
import { PWAInstallModal } from './components/PWAInstallModal';
import { ScalingAndPayouts } from './components/ScalingAndPayouts';
import { TraderDashboard, type DashboardPage } from './components/TraderDashboard';
import { TraderJourney } from './components/TraderJourney';
import { TraderPortalModal } from './components/TraderPortalModal';
import { TransparencyPillars } from './components/TransparencyPillars';
import { TransparencySimulator } from './components/TransparencySimulator';
import type {
  DashboardAccount,
  DashboardPayout,
  DashboardTrade,
  PublicUser,
  TraderCertificate,
} from './server/authStore';
import type { MarketQuote } from './server/marketFeed';
import {
  formatUsd,
  getChallengeSpec,
  type AccountSize,
  type ChallengeMode,
  type EnrolledChallenge,
  type ProfitSplitOption,
} from './utils/challenges';

const STORAGE_KEY = 'lemonfunding_enrolled_challenges_v1';
const PENDING_PURCHASES_KEY = 'lemonfunding_pending_purchases_v1';
const SESSION_TOKEN_KEY = 'lemonfunding_session_token_v1';

type ActiveView = 'landing' | 'dashboard' | 'admin' | 'auth' | 'terminal';

function wantsAdminRouteFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return (
    params.get('view') === 'admin' ||
    window.location.pathname === '/admin' ||
    window.location.hash === '#admin'
  );
}

function getInitialViewFromUrl(): ActiveView {
  if (typeof window === 'undefined') return 'landing';
  const params = new URLSearchParams(window.location.search);
  const isStandaloneDisplay =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  if (
    params.get('view') === 'terminal' ||
    window.location.pathname === '/terminal' ||
    isStandaloneDisplay
  ) {
    return 'terminal';
  }
  if (wantsAdminRouteFromUrl()) {
    return 'auth';
  }
  return 'landing';
}

export default function App() {
  const [mode, setMode] = useState<ChallengeMode>('two-step');
  const [accountSize, setAccountSize] = useState<AccountSize>(100000);
  const [profitSplit, setProfitSplit] = useState<ProfitSplitOption>(80);

  const [activeView, setActiveView] = useState<ActiveView>(getInitialViewFromUrl);
  const [pendingAdminIntent, setPendingAdminIntent] = useState<boolean>(wantsAdminRouteFromUrl);

  // Clean Bybit Exchange Hero states
  const [heroCategory, setHeroCategory] = useState<'all' | 'two-step' | 'one-step' | 'instant' | 'rewards'>('all');
  const [promoSlide, setPromoSlide] = useState<0 | 1>(0);
  const [marketTab, setMarketTab] = useState<'Spot' | 'Metals' | 'Indices' | 'Crypto'>('Spot');
  const [marketQuotes, setMarketQuotes] = useState<MarketQuote[]>([]);

  // Certificate Verification via QR Redirect (?verify_cert= or ?verify_payout=)
  const [verifiedCert, setVerifiedCert] = useState<TraderCertificate | null>(null);
  const [verifyCertError, setVerifyCertError] = useState<string | null>(null);

  useEffect(() => {
    const checkUrlVerify = () => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const certParam = params.get('verify_cert') || params.get('verify_payout');
      if (!certParam) return;
      const lookupId = params.get('verify_payout')
        ? certParam.toUpperCase().startsWith('LF-CERT-PAY-')
          ? certParam
          : `LF-CERT-PAY-${certParam.toUpperCase()}`
        : certParam;

      fetch(`/api/certificates/${encodeURIComponent(lookupId)}`)
        .then(async (resp) => {
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok || !data.certificate) {
            setVerifyCertError(data.error || 'Invalid or expired verification code.');
            return;
          }
          setVerifiedCert(data.certificate as TraderCertificate);
          setVerifyCertError(null);
        })
        .catch(() => {
          setVerifyCertError('Network error verifying certificate.');
        });
    };

    checkUrlVerify();
    const handlePopState = () => {
      if (wantsAdminRouteFromUrl()) {
        setPendingAdminIntent(true);
      }
      setActiveView(getInitialViewFromUrl());
      checkUrlVerify();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Live quotes for the Bybit-style Markets widget on landing
  useEffect(() => {
    let active = true;
    const loadQuotes = async () => {
      try {
        const resp = await fetch('/api/market/quotes');
        if (!resp.ok) return;
        const json = await resp.json();
        if (active && Array.isArray(json.quotes)) {
          setMarketQuotes(json.quotes);
        }
      } catch {
        // Silent fallback if polling pauses
      }
    };
    loadQuotes();
    const timer = setInterval(loadQuotes, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const [pwaInstallOpen, setPwaInstallOpen] = useState(false);

  const launchStandaloneTerminal = useCallback(() => {
    setPwaInstallOpen(false);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/?view=terminal');
    }
    setActiveView('terminal');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const [dashboardPage, setDashboardPage] = useState<DashboardPage>(() => {
    try {
      const saved = localStorage.getItem('lemonfunding_dash_page_v1') as DashboardPage | null;
      const valid: DashboardPage[] = [
        'overview',
        'challenges',
        'terminal',
        'journal',
        'analytics',
        'payouts',
        'orders',
        'certificates',
        'affiliate',
        'wallet',
        'rewards',
        'profile',
        'credentials',
        'kyc',
        'downloads',
        'support',
        'checkout',
      ];
      return saved && valid.includes(saved) ? saved : 'overview';
    } catch {
      return 'overview';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('lemonfunding_dash_page_v1', dashboardPage);
    } catch {
      // Ignore storage errors
    }
  }, [dashboardPage]);
  const [focusSecretCode, setFocusSecretCode] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialStep, setAuthInitialStep] = useState<'login' | 'register'>('login');

  const [accessToken, setAccessToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);

  const [dashAccounts, setDashAccounts] = useState<DashboardAccount[]>([]);
  const [dashTrades, setDashTrades] = useState<DashboardTrade[]>([]);
  const [dashPayouts, setDashPayouts] = useState<DashboardPayout[]>([]);
  const [comebackEligible, setComebackEligible] = useState(false);
  const [comebackCode, setComebackCode] = useState<string | null>(null);
  const [enrollPromoCode, setEnrollPromoCode] = useState<string>('');

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [pendingPurchases, setPendingPurchases] = useState<EnrolledChallenge[]>(() => {
    try {
      const raw = localStorage.getItem(PENDING_PURCHASES_KEY);
      return raw ? (JSON.parse(raw) as EnrolledChallenge[]) : [];
    } catch {
      return [];
    }
  });
  const [enrolledChallenges, setEnrolledChallenges] = useState<EnrolledChallenge[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as EnrolledChallenge[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enrolledChallenges));
    } catch {
      // Ignore storage quota errors
    }
  }, [enrolledChallenges]);

  useEffect(() => {
    try {
      localStorage.setItem(PENDING_PURCHASES_KEY, JSON.stringify(pendingPurchases));
    } catch {
      // Ignore storage quota errors
    }
  }, [pendingPurchases]);

  const fetchDashboard = useCallback(async (token: string): Promise<PublicUser | null> => {
    try {
      const resp = await fetch('/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          try {
            localStorage.removeItem(SESSION_TOKEN_KEY);
          } catch {
            // Ignore storage errors
          }
          setAccessToken(null);
          setCurrentUser(null);
        }
        return null;
      }
      const data = await resp.json();
      setCurrentUser(data.user);
      setDashAccounts(data.accounts || []);
      setDashTrades(data.trades || []);
      setDashPayouts(data.payouts || []);
      setComebackEligible(Boolean(data.comebackEligible));
      setComebackCode(data.comebackCode ?? null);
      return data.user as PublicUser;
    } catch {
      return null;
    }
  }, []);

  // Restore saved session on mount and route straight to Admin Panel if owner requested ?view=admin
  useEffect(() => {
    if (!accessToken || currentUser) return;
    let active = true;
    (async () => {
      const restored = await fetchDashboard(accessToken);
      if (!active || !restored) return;
      if (wantsAdminRouteFromUrl() && restored.isAdmin) {
        setPendingAdminIntent(false);
        setActiveView('admin');
      } else if (wantsAdminRouteFromUrl() && !restored.isAdmin) {
        setPendingAdminIntent(false);
        setActiveView('dashboard');
      }
    })();
    return () => {
      active = false;
    };
  }, [accessToken, currentUser, fetchDashboard]);

  // Live background sync of all account balances, valid trading days, stages, and payouts
  useEffect(() => {
    if (!accessToken || !currentUser) return;
    if (activeView !== 'dashboard' && activeView !== 'terminal') return;
    const syncNow = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void fetchDashboard(accessToken);
    };
    const timer = setInterval(syncNow, 4000);
    window.addEventListener('focus', syncNow);
    document.addEventListener('visibilitychange', syncNow);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', syncNow);
      document.removeEventListener('visibilitychange', syncNow);
    };
  }, [accessToken, currentUser, activeView, fetchDashboard]);

  const handleAuthenticated = async (token: string, user: PublicUser) => {
    try {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } catch {
      // Ignore storage errors
    }
    setAccessToken(token);
    setCurrentUser(user);
    setAuthModalOpen(false);

    if (pendingPurchases.length > 0) {
      const queue = [...pendingPurchases];
      setPendingPurchases([]);
      for (const item of queue) {
        await fetch('/api/dashboard/accounts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            mode: item.mode,
            accountSize: item.accountSize,
            profitSplit: item.profitSplitPct,
            platform: item.platform,
            promoCode: item.promoCodeApplied,
            paymentMethod: item.paymentMethod,
            paymentProofUrl: item.paymentProofUrl,
          }),
        });
      }
    }

    const syncedUser = await fetchDashboard(token);
    const isOwnerAdmin = Boolean(syncedUser?.isAdmin ?? user.isAdmin);
    if ((pendingAdminIntent || wantsAdminRouteFromUrl()) && isOwnerAdmin) {
      setPendingAdminIntent(false);
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/?view=admin');
      }
      setActiveView('admin');
    } else {
      setPendingAdminIntent(false);
      setDashboardPage('overview');
      setActiveView('dashboard');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignOut = () => {
    try {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    } catch {
      // Ignore storage errors
    }
    if (typeof window !== 'undefined' && wantsAdminRouteFromUrl()) {
      window.history.replaceState({}, '', '/');
    }
    setPendingAdminIntent(false);
    setAccessToken(null);
    setCurrentUser(null);
    setDashAccounts([]);
    setDashTrades([]);
    setDashPayouts([]);
    setComebackEligible(false);
    setComebackCode(null);
    setDashboardPage('overview');
    setActiveView('landing');
  };

  const openRewardsFlow = (focusCode = false) => {
    if (accessToken && currentUser) {
      setFocusSecretCode(focusCode);
      setDashboardPage('rewards');
      setActiveView('dashboard');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setAuthInitialStep('login');
      setAuthModalOpen(true);
    }
  };

  const spec = getChallengeSpec(mode, accountSize, profitSplit);

  const handleCompleteEnrollment = async (
    challenge: EnrolledChallenge
  ): Promise<string | void> => {
    if (accessToken) {
      const resp = await fetch('/api/dashboard/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          mode: challenge.mode,
          accountSize: challenge.accountSize,
          profitSplit: challenge.profitSplitPct,
          platform: challenge.platform,
          promoCode: challenge.promoCodeApplied,
          paymentMethod: challenge.paymentMethod,
          paymentProofUrl: challenge.paymentProofUrl,
        }),
      });
      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || 'Could not submit purchase payment proof.');
      }
      const data = await resp.json();
      const serverAcctNum: string | undefined = data.account?.accountNumber;
      const syncedRecord = serverAcctNum
        ? { ...challenge, accountNumber: serverAcctNum }
        : challenge;
      setEnrolledChallenges((prev) => [syncedRecord, ...prev]);
      await fetchDashboard(accessToken);
      return serverAcctNum;
    }
    setPendingPurchases((prev) => [...prev, challenge]);
    setEnrolledChallenges((prev) => [challenge, ...prev]);
  };

  const openBuyChallenge = (
    optionsOrSplit?:
      | ProfitSplitOption
      | {
          size?: AccountSize;
          mode?: ChallengeMode;
          split?: ProfitSplitOption;
          promoCode?: string;
        }
  ) => {
    if (typeof optionsOrSplit === 'number') {
      setProfitSplit(optionsOrSplit);
      setEnrollPromoCode('');
    } else if (optionsOrSplit) {
      if (optionsOrSplit.size) setAccountSize(optionsOrSplit.size);
      if (optionsOrSplit.mode) setMode(optionsOrSplit.mode);
      if (optionsOrSplit.split) setProfitSplit(optionsOrSplit.split);
      setEnrollPromoCode(optionsOrSplit.promoCode || '');
    } else {
      setEnrollPromoCode('');
    }
    setEnrollOpen(true);
  };

  const filteredQuotes = marketQuotes.filter((q) => {
    if (marketTab === 'Spot') return true;
    if (marketTab === 'Metals') return q.category === 'Metals';
    if (marketTab === 'Indices') return q.category === 'Indices';
    if (marketTab === 'Crypto') return q.category === 'Crypto';
    return true;
  });

  if (activeView === 'terminal') {
    return (
      <div className="min-h-screen bg-[#0D120B] text-white">
        <LemonTerminal
          accounts={dashAccounts}
          trades={dashTrades}
          accessToken={accessToken || ''}
          standalone={true}
          userKycStatus={currentUser?.kycStatus}
          onOpenKyc={() => {
            if (window.location.search.includes('view=terminal') || window.location.pathname === '/terminal') {
              window.history.replaceState({}, '', '/');
            }
            if (accessToken && currentUser) {
              setDashboardPage('kyc');
              setActiveView('dashboard');
            } else {
              setAuthInitialStep('login');
              setAuthModalOpen(true);
              setActiveView('landing');
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onRefreshDashboard={async () => {
            if (accessToken) {
              await fetchDashboard(accessToken);
            }
          }}
          onTerminalAuthenticated={async ({
            accessToken: termToken,
            user,
            account,
            trades: termTrades,
          }) => {
            try {
              localStorage.setItem(SESSION_TOKEN_KEY, termToken);
            } catch {
              // Ignore storage errors
            }
            setAccessToken(termToken);
            setCurrentUser(user);
            setDashAccounts((prev) =>
              prev.some((a) => a.id === account.id)
                ? prev.map((a) => (a.id === account.id ? account : a))
                : [account, ...prev]
            );
            setDashTrades(termTrades);
            await fetchDashboard(termToken);
          }}
          onClaimComeback={(code) => {
            if (window.location.search.includes('view=terminal')) {
              window.history.replaceState({}, '', '/');
            }
            setActiveView(accessToken && currentUser ? 'dashboard' : 'landing');
            setDashboardPage('challenges');
            openBuyChallenge({ promoCode: code });
          }}
          onCloseTerminal={() => {
            if (window.location.search.includes('view=terminal') || window.location.pathname === '/terminal') {
              window.history.replaceState({}, '', '/');
            }
            setActiveView(accessToken && currentUser ? 'dashboard' : 'landing');
          }}
        />
      </div>
    );
  }

  return (
    <div id="top" className="min-h-screen bg-[#09090B] text-white flex flex-col">
      {activeView !== 'dashboard' && (
        <Header
          isAuthenticated={Boolean(accessToken && currentUser)}
          isAdmin={Boolean(currentUser?.isAdmin)}
          activeView={activeView}
          activeDashboardPage={dashboardPage}
          onSelectDashboardPage={(page) => {
            setDashboardPage(page);
            setActiveView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenRewards={(focusCode) => openRewardsFlow(focusCode)}
          onOpenAdmin={
            currentUser?.isAdmin
              ? () => {
                  if (typeof window !== 'undefined') {
                    window.history.pushState({}, '', '/?view=admin');
                  }
                  setActiveView('admin');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              : undefined
          }
          onOpenAuth={() => {
            setAuthInitialStep('login');
            setActiveView('auth');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onBuyChallenge={() => openBuyChallenge()}
          onOpenDashboard={() => {
            setActiveView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenTerminalApp={() => setPwaInstallOpen(true)}
          onOpenLanding={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState({}, '', '/');
            }
            setActiveView('landing');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onSignOut={handleSignOut}
        />
      )}

      <main className="flex-1">
        {activeView === 'auth' ? (
          <AuthPageView
            initialStep={authInitialStep}
            onAuthenticated={handleAuthenticated}
            onBackToLanding={() => {
              if (typeof window !== 'undefined' && wantsAdminRouteFromUrl()) {
                window.history.replaceState({}, '', '/');
              }
              setPendingAdminIntent(false);
              setActiveView('landing');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : activeView === 'admin' && accessToken && currentUser?.isAdmin ? (
          <AdminPanel
            user={currentUser}
            accessToken={accessToken}
            onOpenDashboard={() => {
              if (typeof window !== 'undefined') {
                window.history.pushState({}, '', '/');
              }
              setActiveView('dashboard');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onBackToSite={() => {
              if (typeof window !== 'undefined') {
                window.history.pushState({}, '', '/');
              }
              setActiveView('landing');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : activeView === 'dashboard' && accessToken && currentUser ? (
          <TraderDashboard
            user={currentUser}
            accounts={dashAccounts}
            trades={dashTrades}
            payouts={dashPayouts}
            accessToken={accessToken}
            comebackEligible={comebackEligible}
            comebackCode={comebackCode}
            activePage={dashboardPage}
            focusSecretCode={focusSecretCode}
            onClearFocusSecretCode={() => setFocusSecretCode(false)}
            onChangePage={(page) => {
              setDashboardPage(page);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onRefreshDashboard={async () => {
              await fetchDashboard(accessToken);
            }}
            onOpenNewChallenge={(opts) => openBuyChallenge(opts)}
            onOpenAdmin={
              currentUser.isAdmin
                ? () => {
                    if (typeof window !== 'undefined') {
                      window.history.pushState({}, '', '/?view=admin');
                    }
                    setActiveView('admin');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                : undefined
            }
            onBackToSite={() => {
              if (typeof window !== 'undefined') {
                window.history.pushState({}, '', '/');
              }
              setActiveView('landing');
            }}
            onLaunchStandaloneTerminal={launchStandaloneTerminal}
            onSignOut={handleSignOut}
          />
        ) : (
          <>
            {/* Obsidian Constant-Style Institutional Prop Landing Hero */}
            <section className="pt-5 pb-10 sm:pt-7 sm:pb-12 bg-[#09090B] border-b border-white/[0.08]">
              <div className="max-w-[1100px] mx-auto px-4 sm:px-8 space-y-6">
                {/* Top Program Filter Strip */}
                <div className="flex items-center justify-between gap-4 overflow-x-auto pb-1">
                  <div className="flex items-center gap-2 shrink-0">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'two-step', label: '2-Step Classic' },
                        { id: 'one-step', label: '1-Step Speed' },
                        { id: 'instant', label: 'Instant Zest' },
                        { id: 'rewards', label: 'Rewards · New' },
                      ] as const
                    ).map((cat) => {
                      const active = heroCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setHeroCategory(cat.id);
                            if (cat.id === 'rewards') {
                              openRewardsFlow(false);
                              return;
                            }
                            if (cat.id === 'two-step' || cat.id === 'one-step' || cat.id === 'instant') {
                              setMode(cat.id);
                            }
                          }}
                          className={`px-4 py-2 rounded-full text-sm font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            active
                              ? 'bg-white text-[#09090B]'
                              : 'bg-[#111113] text-zinc-400 border border-white/[0.08] hover:text-white'
                          }`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5 text-sm text-zinc-400 shrink-0">
                    <Star className="w-4 h-4 text-[#F7A600] fill-current" />
                    <span className="font-semibold text-white">4.8 Rated</span>
                    <span>· Zero Hidden Rules</span>
                  </div>
                </div>

                {/* Obsidian Hero Overview Row */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className="lg:col-span-7 space-y-5">
                    <div className="p-5 sm:p-7 rounded-2xl bg-[#111113] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                          Max Funded Allocation · Verified Prop Capital
                        </p>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="font-mono-tabular text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
                            $200,000.00
                          </span>
                          <span className="text-sm font-semibold text-zinc-500">USD</span>
                        </div>
                        <p className="text-sm text-zinc-400 mt-2">
                          Profit Split{' '}
                          <strong className="font-mono-tabular text-emerald-400">
                            Up to 90% · Static Drawdown
                          </strong>
                        </p>
                      </div>

                      <div className="flex flex-col gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openBuyChallenge()}
                          className="px-6 py-3.5 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] font-bold text-base transition-colors cursor-pointer whitespace-nowrap shadow-sm flex items-center justify-center gap-2"
                        >
                          <span>+ New Challenge</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (accessToken && currentUser) {
                              setActiveView('dashboard');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            } else {
                              setAuthInitialStep('register');
                              setAuthModalOpen(true);
                            }
                          }}
                          className="px-5 py-2.5 rounded-full bg-[#18181B] hover:bg-[#27272A] text-white font-semibold text-sm border border-white/[0.1] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {accessToken && currentUser ? 'Open Trader Dashboard' : 'Create Trader ID'}
                        </button>
                      </div>
                    </div>

                    {/* 4 Quick Action Buttons Row */}
                    <div className="grid grid-cols-4 gap-3 text-center">
                      <button
                        type="button"
                        onClick={() => openBuyChallenge()}
                        className="group flex flex-col items-center gap-2 cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-full bg-[#111113] group-hover:bg-[#18181B] border border-white/[0.08] group-hover:border-white/25 flex items-center justify-center text-white transition-colors">
                          <Rocket className="w-5 h-5 group-hover:text-emerald-400" />
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-zinc-300 group-hover:text-white">
                          Buy Challenge
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openRewardsFlow(false)}
                        className="group flex flex-col items-center gap-2 cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-full bg-[#111113] group-hover:bg-[#18181B] border border-white/[0.08] group-hover:border-[#F7A600]/40 flex items-center justify-center text-white transition-colors">
                          <Gift className="w-5 h-5 text-[#F7A600]" />
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-zinc-300 group-hover:text-white">
                          Rewards Store
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openRewardsFlow(true)}
                        className="group flex flex-col items-center gap-2 cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-full bg-[#111113] group-hover:bg-[#18181B] border border-white/[0.08] group-hover:border-[#F7A600]/40 flex items-center justify-center text-white transition-colors">
                          <KeyRound className="w-5 h-5 group-hover:text-[#F7A600]" />
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-zinc-300 group-hover:text-white">
                          Secret Code
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPwaInstallOpen(true)}
                        className="group flex flex-col items-center gap-2 cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-full bg-[#111113] group-hover:bg-[#18181B] border border-white/[0.08] group-hover:border-emerald-400/40 flex items-center justify-center text-white transition-colors">
                          <Smartphone className="w-5 h-5 group-hover:text-emerald-400" />
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-zinc-300 group-hover:text-white">
                          Terminal App
                        </span>
                      </button>
                    </div>

                    {/* Promo Spotlight Card */}
                    <div className="rounded-2xl bg-[#111113] border border-white/[0.08] p-4 sm:p-5 flex items-center justify-between gap-4 relative overflow-hidden">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-[#18181B] border border-white/[0.08] flex items-center justify-center shrink-0">
                          <Trophy className="w-5 h-5 text-[#F7A600]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-emerald-400">
                            {promoSlide === 0 ? 'REWARDS · X & INSTAGRAM' : '1,000 SECRET CODES'}
                          </p>
                          <p className="font-display text-base sm:text-lg font-bold text-white truncate">
                            {promoSlide === 0
                              ? 'Follow & earn 200 PTS → Claim $5K 2-Step Account!'
                              : 'Secret Drop Codes · Win Funded Accounts & Discounts!'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPromoSlide((s) => (s === 0 ? 1 : 0))}
                          className="px-3 py-1 rounded-full bg-[#18181B] border border-white/[0.1] text-xs font-mono-tabular font-bold text-zinc-300 hover:text-white cursor-pointer"
                        >
                          {promoSlide + 1}/2
                        </button>
                        <button
                          type="button"
                          onClick={() => openRewardsFlow(promoSlide === 1)}
                          aria-label="Open rewards promotion"
                          className="p-2 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] transition-colors cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Interactive 3D Vault Preview */}
                  <div className="lg:col-span-5">
                    <LemonVault3D accountSize={accountSize} challengeMode={mode} />
                  </div>
                </div>

                {/* Live Exchange Markets Strip */}
                <div id="markets" className="rounded-2xl bg-[#111113] border border-white/[0.08] p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
                    <div className="flex items-center gap-5 overflow-x-auto">
                      {(['Spot', 'Metals', 'Indices', 'Crypto'] as const).map((tab) => {
                        const active = marketTab === tab;
                        return (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setMarketTab(tab)}
                            className={`text-sm sm:text-base font-bold pb-1 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                              active
                                ? 'text-white border-emerald-400'
                                : 'text-zinc-500 border-transparent hover:text-zinc-200'
                            }`}
                          >
                            {tab}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => launchStandaloneTerminal()}
                      className="text-sm font-bold text-emerald-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>Open Live Terminal</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {(filteredQuotes.length > 0 ? filteredQuotes.slice(0, 6) : []).map((q) => {
                      const up = q.change24h >= 0;
                      return (
                        <div
                          key={q.symbol}
                          className="p-3.5 rounded-xl bg-[#18181B] border border-white/[0.06] space-y-1"
                        >
                          <div className="flex items-center justify-between text-xs sm:text-sm">
                            <span className="font-bold text-white">{q.symbol.replace('.', '')}</span>
                            <span
                              className={`font-mono-tabular text-xs font-bold ${
                                up ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {up ? '+' : ''}
                              {q.change24h.toFixed(2)}%
                            </span>
                          </div>
                          <p className="font-mono-tabular text-base font-extrabold text-white">
                            {q.bid.toFixed(q.decimals > 3 ? 4 : 2)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* Step 1-2 Challenge Configurator */}
            <ChallengeConfigurator
              mode={mode}
              accountSize={accountSize}
              profitSplit={profitSplit}
              spec={spec}
              enrolledCount={accessToken ? dashAccounts.length : pendingPurchases.length}
              onModeChange={setMode}
              onSizeChange={setAccountSize}
              onSplitChange={setProfitSplit}
              onEnrollClick={openBuyChallenge}
              onOpenPortal={() => {
                if (accessToken && currentUser) {
                  setActiveView('dashboard');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  setPortalOpen(true);
                }
              }}
            />

            {/* Trader's Journey */}
            <TraderJourney onBuyChallenge={() => openBuyChallenge()} />

            {/* Transparency Pillars */}
            <TransparencyPillars />

            {/* Zero-Fine-Print Rule Simulator */}
            <TransparencySimulator spec={spec} />

            {/* Scaling Ladder + Verified Payout Ledger */}
            <ScalingAndPayouts />
          </>
        )}
      </main>

      {/* Clean Footer */}
      {activeView !== 'dashboard' && (
        <footer className="border-t border-white/[0.08] bg-[#09090B] py-10">
          <div className="max-w-[1200px] mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2.5">
                <LemonLogo size={28} rounded="lg" />
                <span className="font-display text-lg font-bold text-white">
                  LemonFunding
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1.5 max-w-md">
                Transparent evaluation challenges, crypto BEP20 settlement, and real-time prop capital tracking.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-zinc-400">
              <a href="#challenges" className="hover:text-white transition-colors">
                Challenges
              </a>
              <a href="#markets" className="hover:text-white transition-colors">
                Markets
              </a>
              <a href="#journey" className="hover:text-white transition-colors">
                Journey
              </a>
              <a href="#simulator" className="hover:text-white transition-colors">
                Simulator
              </a>
              <button
                type="button"
                onClick={() => setPwaInstallOpen(true)}
                className="hover:text-white font-semibold transition-colors cursor-pointer"
              >
                Terminal App
              </button>
              <span>© 2026 LemonFunding</span>
            </div>
          </div>
        </footer>
      )}

      <AuthVerifyModal
        isOpen={authModalOpen}
        initialStep={authInitialStep}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={handleAuthenticated}
      />

      <EnrollmentModal
        isOpen={enrollOpen}
        spec={spec}
        isAuthenticated={Boolean(accessToken && currentUser)}
        accessToken={accessToken || ''}
        usedCouponCodes={currentUser?.usedCouponCodes || []}
        defaultName={currentUser?.fullName || ''}
        defaultEmail={currentUser?.email || ''}
        comebackEligible={comebackEligible}
        comebackCode={comebackCode}
        initialPromoCode={enrollPromoCode}
        onClose={() => setEnrollOpen(false)}
        onCompleteEnrollment={handleCompleteEnrollment}
        onGoToDashboard={() => {
          setDashboardPage('accounts');
          setActiveView('dashboard');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenAuthForDashboard={() => {
          setAuthInitialStep('register');
          setAuthModalOpen(true);
        }}
        onOpenTerminal={() => {
          setDashboardPage('terminal');
          setActiveView('dashboard');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenPWAInstall={() => setPwaInstallOpen(true)}
      />

      <TraderPortalModal
        isOpen={portalOpen}
        challenges={pendingPurchases}
        onClose={() => setPortalOpen(false)}
      />

      <PWAInstallModal
        isOpen={pwaInstallOpen}
        onClose={() => setPwaInstallOpen(false)}
        onLaunchTerminal={launchStandaloneTerminal}
      />

      {/* Public QR Certificate & Payout Verification Modal */}
      {(verifiedCert || verifyCertError) && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[#0B0E14] text-white border-2 border-[#F7A600]/60 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative">
            <button
              type="button"
              onClick={() => {
                setVerifiedCert(null);
                setVerifyCertError(null);
                window.history.replaceState({}, '', '/');
              }}
              aria-label="Close verification"
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {verifyCertError ? (
              <div className="text-center space-y-3 py-4">
                <p className="text-sm font-bold text-[#FCA5A5]">{verifyCertError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setVerifyCertError(null);
                    window.history.replaceState({}, '', '/');
                  }}
                  className="px-5 py-2 rounded-full bg-[#F7A600] text-[#121417] text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : verifiedCert ? (
              <div className="space-y-4 text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00B574]/20 border border-[#00B574]/40 text-[#00B574] text-xs font-extrabold uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Authentic Verification Confirmed</span>
                </div>

                <div>
                  <Award className="w-10 h-10 text-[#F7A600] mx-auto mb-1" />
                  <h3 className="font-display text-xl font-extrabold text-white">
                    {verifiedCert.type === 'payout_verified'
                      ? 'Verified Payout Certificate'
                      : 'Verified Funded Account Certificate'}
                  </h3>
                  <p className="font-display text-2xl font-extrabold text-[#F7A600] mt-2">
                    {verifiedCert.traderName}
                  </p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">Account Number</span>
                    <span className="font-mono-tabular font-bold">#{verifiedCert.accountNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">Challenge Program</span>
                    <span className="font-bold">
                      {verifiedCert.modeLabel} ({formatUsd(verifiedCert.accountSize)})
                    </span>
                  </div>
                  {verifiedCert.amountUsd && (
                    <div className="flex justify-between">
                      <span className="text-[#9CA3AF]">Verified Payout</span>
                      <span className="font-mono-tabular font-extrabold text-[#00B574]">
                        {formatUsd(verifiedCert.amountUsd)} via {verifiedCert.payoutMethod || 'BNB BEP20'}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">Certificate ID</span>
                    <span className="font-mono-tabular text-[#D1D5DB]">{verifiedCert.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">Issued Date</span>
                    <span className="font-mono-tabular text-[#D1D5DB]">
                      {new Date(verifiedCert.issuedAtIso).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setVerifiedCert(null);
                    window.history.replaceState({}, '', '/');
                  }}
                  className="w-full py-2.5 rounded-full bg-[#F7A600] hover:bg-[#E59700] text-[#121417] text-xs font-extrabold cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
