import { useState } from 'react';
import { Gift, KeyRound, Menu, MoreVertical, ShieldCheck, X } from 'lucide-react';
import { LemonLogo } from './LemonLogo';
import type { DashboardPage } from './TraderDashboard';

interface HeaderProps {
  isAuthenticated: boolean;
  isAdmin?: boolean;
  activeView: 'landing' | 'dashboard' | 'admin' | 'auth' | 'terminal';
  activeDashboardPage?: DashboardPage;
  onSelectDashboardPage?: (page: DashboardPage) => void;
  onOpenRewards?: (focusSecretCode?: boolean) => void;
  onOpenAdmin?: () => void;
  onOpenAuth: () => void;
  onBuyChallenge: () => void;
  onOpenDashboard: () => void;
  onOpenTerminalApp?: () => void;
  onOpenLanding: () => void;
  onSignOut: () => void;
}

export function Header({
  isAuthenticated,
  isAdmin = false,
  activeView,
  activeDashboardPage = 'overview',
  onSelectDashboardPage,
  onOpenRewards,
  onOpenAdmin,
  onOpenAuth,
  onBuyChallenge,
  onOpenDashboard,
  onOpenTerminalApp,
  onOpenLanding,
  onSignOut,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickDotsOpen, setQuickDotsOpen] = useState(false);

  const dashLinkClass = (page: DashboardPage) =>
    activeDashboardPage === page
      ? 'text-white font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer'
      : 'hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer';

  return (
    <header className="sticky top-0 z-40 bg-[#09090B]/95 backdrop-blur-md border-b border-white/[0.08]">
      <div className="max-w-[1200px] mx-auto px-3.5 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-6">
        {/* Zone 1: Brand Mark */}
        <a
          href="#top"
          onClick={(e) => {
            setMobileMenuOpen(false);
            if (activeView !== 'landing') {
              e.preventDefault();
              onOpenLanding();
            }
          }}
          className="inline-flex items-center gap-2 sm:gap-2.5 font-display text-base sm:text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          <LemonLogo size={30} rounded="xl" />
          <span>LemonFunding</span>
        </a>

        {/* Zone 2: Clean Nav Links */}
        {activeView === 'admin' ? (
          <nav
            aria-label="Owner admin navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-400"
          >
            <a
              href="#admin-overview"
              className="text-white font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              Owner Admin Vault
            </a>
            <button
              type="button"
              onClick={onOpenDashboard}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              My Dashboard
            </button>
            <button
              type="button"
              onClick={onOpenLanding}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Home
            </button>
          </nav>
        ) : activeView === 'dashboard' ? (
          <nav
            aria-label="Dashboard navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400"
          >
            <button
              type="button"
              onClick={() => onSelectDashboardPage?.('overview')}
              className={dashLinkClass('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => onSelectDashboardPage?.('accounts')}
              className={dashLinkClass('accounts')}
            >
              Accounts
            </button>
            <button
              type="button"
              onClick={() => onSelectDashboardPage?.('rewards')}
              className={dashLinkClass('rewards')}
            >
              Rewards
            </button>
            <button
              type="button"
              onClick={() => onSelectDashboardPage?.('kyc')}
              className={dashLinkClass('kyc')}
            >
              KYC
            </button>
            <button
              type="button"
              onClick={() => onSelectDashboardPage?.('terminal')}
              className={dashLinkClass('terminal')}
            >
              Terminal
            </button>
            <button
              type="button"
              onClick={() => onSelectDashboardPage?.('payouts')}
              className={dashLinkClass('payouts')}
            >
              Payouts
            </button>
          </nav>
        ) : (
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-400"
          >
            <a
              href="#challenges"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Challenges
            </a>
            <a
              href="#markets"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Markets
            </a>
            <a
              href="#journey"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Journey
            </a>
            <a
              href="#simulator"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Simulator
            </a>
            {onOpenTerminalApp && (
              <button
                type="button"
                onClick={onOpenTerminalApp}
                className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Terminal App
              </button>
            )}
            {!isAuthenticated && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign In
              </button>
            )}
          </nav>
        )}

        {/* Zone 3: Action CTA (+ 3-Dot Quick Rewards & Secret Code Menu when Logged In) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isAuthenticated && onOpenRewards && activeView !== 'admin' && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setQuickDotsOpen((prev) => !prev);
                  setMobileMenuOpen(false);
                }}
                aria-label="Rewards & Secret Code Menu"
                title="Rewards & Secret Code"
                className="w-10 h-10 flex items-center justify-center rounded-full border border-white/[0.1] bg-[#18181B] hover:bg-[#27272A] text-white transition-colors cursor-pointer"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {quickDotsOpen && (
                <div className="absolute right-0 top-12 z-50 w-64 max-w-[calc(100vw-24px)] rounded-2xl bg-[#111113] border border-white/[0.1] shadow-2xl py-2 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickDotsOpen(false);
                      onOpenRewards(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-white/[0.06] font-semibold text-white flex items-center gap-2.5 cursor-pointer"
                  >
                    <Gift className="w-4 h-4 text-[#F7A600] shrink-0" />
                    <span>Rewards &amp; Tasks (+200 pts)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickDotsOpen(false);
                      onOpenRewards(true);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-white/[0.06] font-bold text-white flex items-center gap-2.5 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-[#F7A600] shrink-0" />
                    <span>Enter Secret Code</span>
                  </button>
                  {isAdmin && onOpenAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickDotsOpen(false);
                        onOpenAdmin();
                      }}
                      className="w-full px-4 py-3 text-left border-t border-white/[0.08] bg-[#F7A600]/10 hover:bg-[#F7A600]/20 font-bold text-[#F7A600] flex items-center gap-2.5 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#F7A600] shrink-0" />
                      <span>Owner Admin Panel</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeView === 'dashboard' || activeView === 'admin' ? (
            <button
              type="button"
              onClick={onSignOut}
              className="px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#18181B] hover:bg-[#27272A] border border-white/[0.1] rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign Out
            </button>
          ) : isAuthenticated ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {isAdmin && onOpenAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="hidden sm:inline-flex px-3.5 py-2 text-xs sm:text-sm font-bold text-white bg-[#18181B] hover:bg-[#27272A] border border-white/[0.12] rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#F7A600]" />
                  <span>Admin Panel</span>
                </button>
              )}
              <button
                type="button"
                onClick={onOpenDashboard}
                className="px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold text-[#09090B] bg-white hover:bg-zinc-200 rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Dashboard
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onBuyChallenge}
              className="px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold text-[#09090B] bg-white hover:bg-zinc-200 rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              + New Challenge
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen((prev) => !prev);
              setQuickDotsOpen(false);
            }}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-full border border-white/[0.1] bg-[#18181B] text-white hover:bg-[#27272A] transition-colors cursor-pointer shrink-0"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/[0.08] bg-[#0C0C0E] px-5 py-4 space-y-4">
          {activeView === 'admin' ? (
            <nav aria-label="Mobile admin menu" className="flex flex-col space-y-3 text-sm font-medium text-zinc-200">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenDashboard();
                }}
                className="py-1 text-left cursor-pointer hover:text-white"
              >
                My Dashboard
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenLanding();
                }}
                className="py-1 text-left cursor-pointer hover:text-white"
              >
                Back to Home
              </button>
            </nav>
          ) : (
            <>
              <nav aria-label="Mobile menu" className="flex flex-col space-y-3 text-sm font-medium text-zinc-300">
                <a
                  href="#challenges"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-1 hover:text-white"
                >
                  Challenges
                </a>
                <a
                  href="#markets"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-1 hover:text-white"
                >
                  Markets
                </a>
                <a
                  href="#journey"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-1 hover:text-white"
                >
                  Trader&apos;s Journey
                </a>
                <a
                  href="#simulator"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-1 hover:text-white"
                >
                  Rule Simulator
                </a>
                {isAuthenticated && onOpenRewards && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenRewards(false);
                      }}
                      className="py-1 text-left font-bold text-[#F7A600] flex items-center gap-2 cursor-pointer"
                    >
                      <Gift className="w-4 h-4" />
                      <span>Rewards &amp; Tasks (+200 pts)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenRewards(true);
                      }}
                      className="py-1 text-left font-bold text-white flex items-center gap-2 cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4 text-[#F7A600]" />
                      <span>Enter Secret Code</span>
                    </button>
                    {isAdmin && onOpenAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          onOpenAdmin();
                        }}
                        className="py-1 text-left font-bold text-[#F7A600] flex items-center gap-2 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4 text-[#F7A600]" />
                        <span>Owner Admin Panel</span>
                      </button>
                    )}
                  </>
                )}
                {onOpenTerminalApp && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenTerminalApp();
                    }}
                    className="py-1 text-left font-semibold text-emerald-400 cursor-pointer"
                  >
                    Install Terminal App
                  </button>
                )}
              </nav>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onBuyChallenge();
                  }}
                  className="py-2.5 px-4 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] font-bold text-xs cursor-pointer"
                >
                  + New Challenge
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (isAuthenticated) {
                      onOpenDashboard();
                    } else {
                      onOpenAuth();
                    }
                  }}
                  className="py-2.5 px-4 rounded-full bg-[#18181B] hover:bg-[#27272A] border border-white/[0.1] text-white font-bold text-xs cursor-pointer"
                >
                  {isAuthenticated ? 'Dashboard' : 'Sign In'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}
