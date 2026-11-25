import { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  PlusSquare,
  Share,
  Smartphone,
  Terminal,
  X,
} from 'lucide-react';
import { LemonLogo } from './LemonLogo';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __lemonDeferredPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function usePWAInstallState() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    typeof window !== 'undefined' ? window.__lemonDeferredPrompt ?? null : null
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    if (window.__lemonDeferredPrompt) {
      setDeferredPrompt(window.__lemonDeferredPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const evt = e as BeforeInstallPromptEvent;
      window.__lemonDeferredPrompt = evt;
      setDeferredPrompt(evt);
    };

    const handleReady = () => {
      if (window.__lemonDeferredPrompt) {
        setDeferredPrompt(window.__lemonDeferredPrompt);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      window.__lemonDeferredPrompt = null;
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('lemon-pwa-ready', handleReady);
    window.addEventListener('lemon-pwa-installed', handleAppInstalled);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('lemon-pwa-ready', handleReady);
      window.removeEventListener('lemon-pwa-installed', handleAppInstalled);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptNativeInstall = async (): Promise<boolean> => {
    const activePrompt = deferredPrompt || window.__lemonDeferredPrompt;
    if (!activePrompt) return false;
    try {
      await activePrompt.prompt();
      const choice = await activePrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        window.__lemonDeferredPrompt = null;
        setDeferredPrompt(null);
        return true;
      }
    } catch {
      // Ignored
    }
    return false;
  };

  return {
    canNativeInstall: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    isInIframe,
    promptNativeInstall,
  };
}

export function TerminalDownloadContent({
  onLaunchTerminal,
}: {
  onLaunchTerminal?: () => void;
}) {
  const { canNativeInstall, isInstalled, isInIframe, promptNativeInstall } = usePWAInstallState();
  const [activePlatform, setActivePlatform] = useState<'android' | 'ios' | 'desktop'>(() => {
    if (typeof navigator === 'undefined') return 'android';
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua)) return 'android';
    return 'desktop';
  });
  const [isFirefox] = useState(() =>
    typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('firefox')
  );
  const [installing, setInstalling] = useState(false);
  const [installNotice, setInstallNotice] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const terminalUrl = `${appOrigin}/?view=terminal`;

  const handleNativeInstall = async () => {
    setInstalling(true);
    setInstallNotice('');
    try {
      if (canNativeInstall) {
        const accepted = await promptNativeInstall();
        if (accepted) {
          setInstallNotice('LemonTerm installed as a standalone app on your device.');
          return;
        }
      }
      setInstallNotice(
        isInIframe
          ? 'Embedded browser previews block 1-tap system install. Tap "Copy App Link", open it in Chrome / Safari, and tap ⋮ → Install app (creates a full standalone phone app, never an HTML file).'
          : 'Tap your browser ⋮ menu (top-right) → "Install app" or "Add to Home screen" to install LemonTerm directly onto your phone.'
      );
    } finally {
      setInstalling(false);
    }
  };

  const handleCopy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleLaunchInApp = () => {
    if (onLaunchTerminal) {
      onLaunchTerminal();
      return;
    }
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/?view=terminal');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className="space-y-4 text-white">
      {/* App Preview Header Card */}
      <div className="p-4 rounded-xl bg-[#18181B] border border-white/[0.08] flex items-center gap-4">
        <LemonLogo size={54} rounded="xl" className="shadow-xs" />
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-sm text-white truncate">
            LemonTerm — Trading App
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Standalone Mobile &amp; Desktop App (PWA / WebAPK)
          </p>
          <p className="text-[11px] font-medium text-emerald-400 mt-1">
            Launches full-screen straight into ID &amp; Password Login
          </p>
        </div>
      </div>

      {/* Quick Demo Credentials Box */}
      <div className="p-3.5 rounded-xl bg-[#09090B] border border-white/[0.1] text-white space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[#F7A600]">Demo Terminal Login (Check &amp; Test)</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 font-mono-tabular text-zinc-200">
            $100k Demo
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono-tabular text-[11px]">
          <button
            type="button"
            onClick={() => handleCopy('LF-100001', 'demo-id')}
            className="p-2 rounded-lg bg-[#18181B] hover:bg-[#27272A] flex items-center justify-between gap-1 text-left cursor-pointer border border-white/[0.06]"
          >
            <span>
              <span className="text-zinc-400 block text-[10px] font-sans">Account ID</span>
              <strong className="text-white">LF-100001</strong>
            </span>
            {copiedKey === 'demo-id' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#F7A600] shrink-0" />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleCopy('LemonDemo2026!', 'demo-pass')}
            className="p-2 rounded-lg bg-[#18181B] hover:bg-[#27272A] flex items-center justify-between gap-1 text-left cursor-pointer border border-white/[0.06]"
          >
            <span>
              <span className="text-zinc-400 block text-[10px] font-sans">Password</span>
              <strong className="text-white">LemonDemo2026!</strong>
            </span>
            {copiedKey === 'demo-pass' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#F7A600] shrink-0" />
            )}
          </button>
        </div>
      </div>

      {installNotice && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
          <span>{installNotice}</span>
        </div>
      )}

      {(isInIframe || isFirefox) && !isInstalled && (
        <div className="p-3.5 rounded-xl bg-[#F7A600]/15 border border-[#F7A600]/30 text-amber-200 text-xs leading-relaxed space-y-1.5">
          <p className="font-bold text-[#F7A600]">
            {isInIframe ? 'Direct Phone Install Note' : 'Firefox Android Install Tip'}
          </p>
          <p>
            {isInIframe
              ? 'To install as a real phone app icon (not a file), tap "Copy App Link" and open it in Chrome or Safari, then tap ⋮ → Install app / Add to Home screen.'
              : 'In Firefox Android, tap ⋮ (top-right browser menu) → "Install" to add LemonTerm directly to your phone app drawer.'}
          </p>
        </div>
      )}

      {/* Primary Action Buttons (Zero HTML file downloads!) */}
      <div className="space-y-2.5">
        {!isInstalled ? (
          <button
            type="button"
            onClick={handleNativeInstall}
            disabled={installing}
            className="w-full py-3 px-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-[#09090B] font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            <span>
              {installing
                ? 'Opening App Installer...'
                : canNativeInstall
                  ? 'Install App to Phone (1-Tap) →'
                  : 'Install Standalone App →'}
            </span>
          </button>
        ) : (
          <div className="w-full py-3 px-4 rounded-xl bg-emerald-500/15 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 border border-emerald-500/30">
            <Check className="w-4 h-4" />
            <span>LemonTerm is installed as a standalone app</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleLaunchInApp}
            className="py-2.5 px-3 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Terminal Login</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopy(terminalUrl, 'url')}
            className="py-2.5 px-3 rounded-full bg-[#18181B] hover:bg-[#27272A] border border-white/[0.12] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            {copiedKey === 'url' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>App Link Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#F7A600]" />
                <span>Copy App Link</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Platform Switcher & Instructions */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#18181B] border border-white/[0.08]">
          {(
            [
              { id: 'android', label: 'Android' },
              { id: 'ios', label: 'iPhone (iOS)' },
              { id: 'desktop', label: 'PC / Mac' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActivePlatform(tab.id)}
              className={`py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activePlatform === tab.id
                  ? 'bg-white text-[#09090B]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activePlatform === 'android' && (
          <div className="space-y-2 text-xs text-zinc-400 bg-[#18181B] p-4 rounded-xl border border-white/[0.08]">
            <p className="font-bold text-white flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Android Standalone App Install</span>
            </p>
            <ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed">
              <li>
                Open the copied App Link in <strong className="text-white">Chrome</strong> or <strong className="text-white">Firefox</strong> (or tap <strong className="text-white">Open Terminal Login</strong>).
              </li>
              <li>
                Tap the browser <strong className="text-white">⋮ (three dots)</strong> menu in the top-right corner.
              </li>
              <li>
                Tap <strong className="text-white">Install app</strong> (Chrome builds a real Android app icon) or <strong className="text-white">Install</strong> (Firefox).
              </li>
              <li>
                Launching <strong className="text-white">LemonTerm</strong> opens full-screen directly to ID &amp; Password login.
              </li>
            </ol>
          </div>
        )}

        {activePlatform === 'ios' && (
          <div className="space-y-2 text-xs text-zinc-400 bg-[#18181B] p-4 rounded-xl border border-white/[0.08]">
            <p className="font-bold text-white flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>iPhone Home Screen App Setup (Safari)</span>
            </p>
            <ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed">
              <li>
                Open the copied App Link in <strong className="text-white">Safari</strong>.
              </li>
              <li className="flex items-center gap-1">
                <span>Tap the</span>
                <Share className="w-3.5 h-3.5 text-sky-400 inline shrink-0" />
                <span><strong className="text-white">Share</strong> button in Safari&apos;s bottom bar.</span>
              </li>
              <li className="flex items-center gap-1">
                <span>Tap</span>
                <PlusSquare className="w-3.5 h-3.5 text-emerald-400 inline shrink-0" />
                <span><strong className="text-white">Add to Home Screen</strong>, then tap <strong className="text-white">Add</strong>.</span>
              </li>
            </ol>
          </div>
        )}

        {activePlatform === 'desktop' && (
          <div className="space-y-2 text-xs text-zinc-400 bg-[#18181B] p-4 rounded-xl border border-white/[0.08]">
            <p className="font-bold text-white flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>PC / Mac Desktop App Install</span>
            </p>
            <ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed">
              <li>
                Click <strong className="text-white">Install Standalone App</strong> above or open the App Link in Chrome / Edge.
              </li>
              <li>
                Click the <strong className="text-white">Install LemonTerm</strong> icon in the address bar to pin it as a native desktop window.
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchTerminal?: () => void;
}

export function PWAInstallModal({ isOpen, onClose, onLaunchTerminal }: PWAInstallModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    >
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-[#111113] border border-white/[0.1] shadow-2xl flex flex-col text-white">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#0C0C0E]">
          <div className="flex items-center gap-2.5">
            <LemonLogo size={34} rounded="lg" />
            <div>
              <h2 id="pwa-install-title" className="font-display text-base font-bold text-white">
                Install LemonTerm App
              </h2>
              <p className="text-[11px] text-zinc-400">Standalone Mobile &amp; Desktop App</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close download modal"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <TerminalDownloadContent onLaunchTerminal={onLaunchTerminal} />
        </div>
      </div>
    </div>
  );
}
