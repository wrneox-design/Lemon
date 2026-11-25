import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';
import {
  formatUsd,
  simulateChallengeDay,
  type ChallengeSpec,
  type SimulationVerdict,
} from '../utils/challenges';
import { TiltCard3D } from './TiltCard3D';

interface TransparencySimulatorProps {
  spec: ChallengeSpec;
}

const VERDICT_META: Record<
  SimulationVerdict,
  { label: string; bg: string; text: string; icon: 'pass' | 'warn' | 'breach' | 'safe' }
> = {
  PASSED: {
    label: 'Target Reached',
    bg: 'bg-emerald-500/15 border-emerald-500/35',
    text: 'text-emerald-400',
    icon: 'pass',
  },
  ACTIVE_SAFE: {
    label: 'Within Safe Rules',
    bg: 'bg-[#F7A600]/15 border-[#F7A600]/35',
    text: 'text-[#F7A600]',
    icon: 'safe',
  },
  ACTIVE_CAUTION: {
    label: 'Caution: Near Limit',
    bg: 'bg-orange-500/15 border-orange-500/35',
    text: 'text-orange-400',
    icon: 'warn',
  },
  BREACHED_DAILY: {
    label: 'Daily Loss Breached',
    bg: 'bg-red-500/15 border-red-500/35',
    text: 'text-red-400',
    icon: 'breach',
  },
  BREACHED_OVERALL: {
    label: 'Max Drawdown Breached',
    bg: 'bg-red-500/15 border-red-500/35',
    text: 'text-red-400',
    icon: 'breach',
  },
};

export function TransparencySimulator({ spec }: TransparencySimulatorProps) {
  const [dayStartEquity, setDayStartEquity] = useState<number>(spec.accountSize);
  const [closedPnl, setClosedPnl] = useState<number>(Math.round(spec.accountSize * 0.025));
  const [floatingPnl, setFloatingPnl] = useState<number>(Math.round(spec.accountSize * 0.008));

  useEffect(() => {
    setDayStartEquity(spec.accountSize);
    setClosedPnl(Math.round(spec.accountSize * 0.025));
    setFloatingPnl(Math.round(spec.accountSize * 0.008));
  }, [spec.accountSize, spec.mode]);

  const result = simulateChallengeDay(spec, {
    startingBalance: spec.accountSize,
    dayStartEquity,
    closedPnl,
    floatingPnl,
  });

  const verdictStyle = VERDICT_META[result.verdict];
  const maxRange = Math.round(spec.accountSize * 0.14);

  const applyPreset = (preset: 'profit' | 'caution' | 'daily-breach' | 'target') => {
    if (preset === 'profit') {
      setDayStartEquity(spec.accountSize);
      setClosedPnl(Math.round(spec.accountSize * 0.032));
      setFloatingPnl(Math.round(spec.accountSize * 0.005));
    } else if (preset === 'caution') {
      setDayStartEquity(spec.accountSize);
      setClosedPnl(-Math.round(spec.dailyLossUsd * 0.55));
      setFloatingPnl(-Math.round(spec.dailyLossUsd * 0.25));
    } else if (preset === 'daily-breach') {
      setDayStartEquity(spec.accountSize);
      setClosedPnl(-Math.round(spec.dailyLossUsd * 0.7));
      setFloatingPnl(-Math.round(spec.dailyLossUsd * 0.4));
    } else {
      setDayStartEquity(spec.accountSize);
      const target =
        spec.phase1TargetUsd > 0 ? spec.phase1TargetUsd : Math.round(spec.accountSize * 0.08);
      setClosedPnl(target + 250);
      setFloatingPnl(0);
    }
  };

  return (
    <section
      id="simulator"
      className="scroll-mt-24 py-14 sm:py-18 border-t border-white/[0.08] bg-[#0C0C0E]"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <p className="text-xs font-bold text-emerald-400 tracking-wide mb-2">
              03. Zero-Fine-Print Rule Simulator
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white text-balance">
              Stress-test daily loss and drawdown math live
            </h2>
            <p className="text-base text-zinc-400 mt-2.5">
              Slide your closed and floating P&amp;L to see the exact equity thresholds for your {formatUsd(spec.accountSize)} {spec.modeLabel} account.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => applyPreset('profit')}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#18181B] hover:bg-[#27272A] text-zinc-200 border border-white/[0.1] transition-colors whitespace-nowrap cursor-pointer"
            >
              Safe Profit Day
            </button>
            <button
              type="button"
              onClick={() => applyPreset('caution')}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#18181B] hover:bg-[#27272A] text-zinc-200 border border-white/[0.1] transition-colors whitespace-nowrap cursor-pointer"
            >
              Near Daily Limit
            </button>
            <button
              type="button"
              onClick={() => applyPreset('daily-breach')}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#18181B] hover:bg-[#27272A] text-zinc-200 border border-white/[0.1] transition-colors whitespace-nowrap cursor-pointer"
            >
              Test Daily Breach
            </button>
            <button
              type="button"
              onClick={() => applyPreset('target')}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white hover:bg-zinc-200 text-[#09090B] transition-colors whitespace-nowrap cursor-pointer"
            >
              Pass Target
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Controls Column */}
          <div className="lg:col-span-6 bg-[#111113] rounded-2xl border border-white/[0.08] p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-6">
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <label
                    htmlFor="sim-day-start"
                    className="text-sm font-bold text-white"
                  >
                    Today&apos;s Starting Equity
                  </label>
                  <span className="font-mono-tabular text-sm font-bold text-white">
                    {formatUsd(dayStartEquity)}
                  </span>
                </div>
                <input
                  id="sim-day-start"
                  type="range"
                  min={spec.accountSize - spec.maxDrawdownUsd + 500}
                  max={spec.accountSize + Math.round(spec.accountSize * 0.12)}
                  step={250}
                  value={dayStartEquity}
                  onChange={(e) => setDayStartEquity(Number(e.target.value))}
                  className="w-full accent-white cursor-pointer"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Daily floor is calculated as Today&apos;s Starting Equity minus{' '}
                  {formatUsd(spec.dailyLossUsd)} ({spec.dailyLossPct}%).
                </p>
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <label
                    htmlFor="sim-closed-pnl"
                    className="text-sm font-bold text-white"
                  >
                    Cumulative Closed P&amp;L
                  </label>
                  <span className="font-mono-tabular text-sm font-bold text-white">
                    {closedPnl >= 0 ? `+${formatUsd(closedPnl)}` : `-${formatUsd(Math.abs(closedPnl))}`}
                  </span>
                </div>
                <input
                  id="sim-closed-pnl"
                  type="range"
                  min={-maxRange}
                  max={maxRange}
                  step={100}
                  value={closedPnl}
                  onChange={(e) => setClosedPnl(Number(e.target.value))}
                  className="w-full accent-[#F7A600] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <label
                    htmlFor="sim-floating-pnl"
                    className="text-sm font-bold text-white"
                  >
                    Open Floating P&amp;L
                  </label>
                  <span className="font-mono-tabular text-sm font-bold text-white">
                    {floatingPnl >= 0
                      ? `+${formatUsd(floatingPnl)}`
                      : `-${formatUsd(Math.abs(floatingPnl))}`}
                  </span>
                </div>
                <input
                  id="sim-floating-pnl"
                  type="range"
                  min={-Math.round(spec.dailyLossUsd * 1.2)}
                  max={Math.round(spec.dailyLossUsd * 1.2)}
                  step={100}
                  value={floatingPnl}
                  onChange={(e) => setFloatingPnl(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#18181B] border border-white/[0.06] text-xs text-zinc-400 leading-relaxed">
              <span className="font-bold text-white">Formula Preview: </span>
              Current Equity = Starting Balance ({formatUsd(spec.accountSize)}) + Closed P&amp;L + Floating P&amp;L ={' '}
              <span className="font-mono-tabular font-bold text-emerald-400">
                {formatUsd(result.currentEquity)}
              </span>
            </div>
          </div>

          {/* 3D Result Gauge Card */}
          <div className="lg:col-span-6">
            <TiltCard3D
              maxTiltDeg={5}
              className="h-full bg-[#111113] text-white rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6 border border-white/[0.08]"
            >
              <div style={{ transform: 'translateZ(20px)' }}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                  <div>
                    <p className="text-xs text-zinc-400">Simulated Account Equity</p>
                    <p
                      data-testid="sim-current-equity"
                      className="font-mono-tabular text-3xl sm:text-4xl font-bold text-white mt-0.5"
                    >
                      {formatUsd(result.currentEquity)}
                    </p>
                  </div>

                  <div
                    data-testid="sim-verdict"
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${verdictStyle.bg} ${verdictStyle.text}`}
                  >
                    {verdictStyle.icon === 'pass' && (
                      <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    )}
                    {verdictStyle.icon === 'safe' && (
                      <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
                    )}
                    {verdictStyle.icon === 'warn' && (
                      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    )}
                    {verdictStyle.icon === 'breach' && (
                      <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>{verdictStyle.label}</span>
                  </div>
                </div>

                <p className="text-sm text-zinc-300 leading-relaxed mb-6">
                  {result.explanation}
                </p>

                {/* Progress Meters */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-zinc-400">Daily Loss Buffer Used</span>
                      <span className="font-mono-tabular font-semibold text-white">
                        {result.dailyUsedPct}% · Floor {formatUsd(result.dailyLimitFloor)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/[0.08] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#F7A600] transition-transform duration-200 origin-left"
                        style={{
                          transform: `scaleX(${Math.max(0.02, result.dailyUsedPct / 100)})`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-zinc-400">Overall Drawdown Used</span>
                      <span className="font-mono-tabular font-semibold text-white">
                        {result.overallUsedPct}% · Floor {formatUsd(result.overallLimitFloor)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/[0.08] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-transform duration-200 origin-left"
                        style={{
                          transform: `scaleX(${Math.max(0.02, result.overallUsedPct / 100)})`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-zinc-400">Profit Target Progress</span>
                      <span className="font-mono-tabular font-semibold text-emerald-400">
                        {result.targetProgressPct}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/[0.08] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-white transition-transform duration-200 origin-left"
                        style={{
                          transform: `scaleX(${Math.max(0.02, result.targetProgressPct / 100)})`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="grid grid-cols-2 gap-4 pt-5 border-t border-white/[0.08]"
                style={{ transform: 'translateZ(16px)' }}
              >
                <div className="p-3.5 rounded-xl bg-[#18181B]">
                  <p className="text-[11px] text-zinc-400">Remaining Daily Room</p>
                  <p className="font-mono-tabular text-base font-semibold text-white mt-0.5">
                    {formatUsd(Math.max(0, result.dailyBufferRemaining))}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#18181B]">
                  <p className="text-[11px] text-zinc-400">
                    Projected Payout ({spec.profitSplitPct}%)
                  </p>
                  <p className="font-mono-tabular text-base font-semibold text-emerald-400 mt-0.5">
                    {formatUsd(result.projectedTraderPayout)}
                  </p>
                </div>
              </div>
            </TiltCard3D>
          </div>
        </div>
      </div>
    </section>
  );
}
