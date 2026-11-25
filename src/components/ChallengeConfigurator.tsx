import { useState } from 'react';
import { ArrowRight, Check, LayoutGrid, ShieldCheck, Sparkles, Table2, Wallet } from 'lucide-react';
import { motion } from 'motion/react';
import {
  ACCOUNT_SIZES,
  formatUsd,
  getChallengeSpec,
  type AccountSize,
  type ChallengeMode,
  type ChallengeSpec,
  type ProfitSplitOption,
} from '../utils/challenges';
import { TiltCard3D } from './TiltCard3D';

interface ChallengeConfiguratorProps {
  mode: ChallengeMode;
  accountSize: AccountSize;
  profitSplit: ProfitSplitOption;
  spec: ChallengeSpec;
  enrolledCount: number;
  onModeChange: (mode: ChallengeMode) => void;
  onSizeChange: (size: AccountSize) => void;
  onSplitChange: (split: ProfitSplitOption) => void;
  onEnrollClick: (selectedSplit?: ProfitSplitOption) => void;
  onOpenPortal: () => void;
}

const CHALLENGE_CARDS: {
  id: ChallengeMode;
  topTag: string;
  title: string;
  subtitle: string;
}[] = [
  {
    id: 'instant',
    topTag: 'Instant funding',
    title: 'Zero',
    subtitle: 'Instant Zest',
  },
  {
    id: 'one-step',
    topTag: 'Popular',
    title: '1 Step',
    subtitle: '1-Step Citrus',
  },
  {
    id: 'two-step',
    topTag: 'Classic 2 Phase',
    title: '2 Step',
    subtitle: '2-Step Classic',
  },
];

export function ChallengeConfigurator({
  mode,
  accountSize,
  profitSplit,
  spec,
  enrolledCount,
  onModeChange,
  onSizeChange,
  onSplitChange,
  onEnrollClick,
  onOpenPortal,
}: ChallengeConfiguratorProps) {
  const [viewTab, setViewTab] = useState<'plans' | 'compare'>('plans');

  const spec80 = getChallengeSpec(mode, accountSize, 80);
  const spec90 = getChallengeSpec(mode, accountSize, 90);

  return (
    <section
      id="challenges"
      className="scroll-mt-24 py-14 sm:py-18 border-t border-white/[0.08] bg-[#0C0C0E]"
    >
      <div className="max-w-[1100px] mx-auto px-4 sm:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
            Zero, 1 Step, or 2 Step. Multiple transparent routes to match your trading style and budget.
          </p>
          {enrolledCount > 0 && (
            <button
              type="button"
              onClick={onOpenPortal}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#18181B] border border-white/[0.12] text-white text-sm font-semibold hover:bg-[#27272A] transition-colors cursor-pointer"
            >
              <Wallet className="w-4 h-4 text-[#F7A600]" aria-hidden="true" />
              <span>Reserved Challenges ({enrolledCount})</span>
            </button>
          )}
        </div>

        {/* Special Bonus Account Promo: 5K Instant for $2 Only Till 2027 */}
        <div className="max-w-3xl mx-auto mb-9">
          <div className="rounded-2xl bg-[#111113] text-white p-5 sm:p-6 border border-[#F7A600]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F7A600]/15 border border-[#F7A600]/35 text-[#F7A600] text-xs font-extrabold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Bonus Account Offer · Valid Only Till 2027</span>
              </div>
              <h3 className="font-display text-lg sm:text-xl font-extrabold text-white">
                $5,000 Instant Funded Account for Just <span className="text-[#F7A600] font-mono-tabular">$2</span>
              </h3>
              <p className="text-sm text-zinc-400">
                35% Consistency Rule · 1% Floating Loss Limit · BNB BEP20 Payouts in 24h ($100 Min, 5+ Days)
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onModeChange('instant');
                onSizeChange(5000);
                onSplitChange(80);
                onEnrollClick(80);
              }}
              className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] text-sm font-extrabold cursor-pointer transition-colors"
            >
              <span>Claim $2 Offer</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step 1: Challenge Type */}
        <div className="max-w-3xl mx-auto mb-9">
          <div className="flex items-baseline justify-center gap-2.5 mb-5">
            <span className="font-display text-3xl font-extrabold text-white">1</span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-zinc-400">
              Challenge type
            </h2>
          </div>

          <div
            role="group"
            aria-label="Challenge Model"
            className="grid grid-cols-3 gap-3 sm:gap-4"
          >
            {CHALLENGE_CARDS.map((card) => {
              const active = mode === card.id;
              return (
                <motion.button
                  key={card.id}
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => onModeChange(card.id)}
                  aria-pressed={active}
                  className={`relative pt-6 pb-4 px-3 sm:px-5 rounded-2xl border text-center transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#18181B] text-white border-white/45 shadow-lg'
                      : 'bg-[#111113] text-zinc-300 border-white/[0.08] hover:border-white/25'
                  }`}
                >
                  <span
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold whitespace-nowrap border ${
                      active
                        ? 'bg-white text-[#09090B] border-white'
                        : 'bg-[#18181B] text-zinc-400 border-white/[0.1]'
                    }`}
                  >
                    {card.topTag}
                  </span>
                  <span className="font-display text-lg sm:text-xl font-bold block mt-1 text-white">
                    {card.title}
                  </span>
                  <span
                    className={`text-xs sm:text-sm block mt-0.5 ${
                      active ? 'text-emerald-400 font-semibold' : 'text-zinc-500'
                    }`}
                  >
                    {card.subtitle}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Account Size */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="flex items-baseline justify-center gap-2.5 mb-5">
            <span className="font-display text-3xl font-extrabold text-white">2</span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-zinc-400">
              Account size
            </h2>
          </div>

          <div
            role="group"
            aria-label="Account Capital"
            className="grid grid-cols-4 sm:grid-cols-7 gap-2 sm:gap-2.5"
          >
            {ACCOUNT_SIZES.map((sz) => {
              const active = accountSize === sz;
              const label = sz >= 1000 ? `$${sz / 1000}K` : `$${sz}`;
              return (
                <button
                  key={sz}
                  type="button"
                  onClick={() => onSizeChange(sz)}
                  aria-pressed={active}
                  className={`py-3.5 px-2 rounded-xl font-mono-tabular text-sm sm:text-base font-bold border transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-white text-[#09090B] border-white shadow-sm'
                      : 'bg-[#111113] text-zinc-300 border-white/[0.08] hover:border-white/25 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Plans / Compare Toggle Bar */}
        <div className="max-w-3xl mx-auto mb-8">
          <div
            role="tablist"
            aria-label="Challenge display mode"
            className="grid grid-cols-2 gap-1.5 p-1.5 rounded-full bg-[#111113] border border-white/[0.08]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewTab === 'plans'}
              onClick={() => setViewTab('plans')}
              className={`inline-flex items-center justify-center gap-2 py-2 px-4 rounded-full text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                viewTab === 'plans'
                  ? 'bg-white text-[#09090B]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" aria-hidden="true" />
              <span>Plans</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={viewTab === 'compare'}
              onClick={() => setViewTab('compare')}
              className={`inline-flex items-center justify-center gap-2 py-2 px-4 rounded-full text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                viewTab === 'compare'
                  ? 'bg-white text-[#09090B]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Table2 className="w-4 h-4" aria-hidden="true" />
              <span>Compare &amp; 3D Pass</span>
            </button>
          </div>
        </div>

        {/* Plans View: Clean Side-by-Side Split Cards */}
        {viewTab === 'plans' ? (
          <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
            {[
              {
                planSpec: spec80,
                badge: 'Standard',
                headline: 'Balanced Entry',
                splitVal: 80 as ProfitSplitOption,
                featured: false,
              },
              {
                planSpec: spec90,
                badge: 'Max Split',
                headline: '90% Pro Trader',
                splitVal: 90 as ProfitSplitOption,
                featured: true,
              },
            ].map((card) => {
              const isSelectedSplit = profitSplit === card.splitVal;
              return (
                <TiltCard3D
                  key={card.badge}
                  maxTiltDeg={5}
                  className={`relative rounded-3xl p-6 sm:p-7 flex flex-col justify-between text-center border transition-shadow ${
                    card.featured
                      ? 'bg-[#18181B] text-white border-emerald-500/35 shadow-2xl'
                      : 'bg-[#111113] text-white border-white/[0.08]'
                  }`}
                >
                  <div style={{ transform: 'translateZ(20px)' }}>
                    <span
                      className={`inline-block font-mono-tabular text-sm font-bold tracking-wide ${
                        card.featured ? 'text-[#F7A600]' : 'text-emerald-400'
                      }`}
                    >
                      {card.badge} · {card.splitVal}% Split
                    </span>

                    <h3 className="font-display text-2xl font-bold mt-4 text-white">
                      {card.headline}
                    </h3>
                    <p className="text-sm mt-1 text-zinc-400">
                      {card.planSpec.modeLabel} · {formatUsd(card.planSpec.accountSize)}
                    </p>

                    <div className="mt-6 pt-5 border-t border-white/[0.08] space-y-4">
                      <div>
                        <p className="text-xs text-zinc-500">Target</p>
                        <p className="font-mono-tabular text-lg font-bold mt-0.5 text-white">
                          {card.planSpec.phase1TargetPct > 0
                            ? card.planSpec.phase2TargetPct !== null
                              ? `P1 ${card.planSpec.phase1TargetPct}% · P2 ${card.planSpec.phase2TargetPct}%`
                              : `P1 ${card.planSpec.phase1TargetPct}%`
                            : 'None · Instant Funded'}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-zinc-500">Daily Loss</p>
                        <p className="font-mono-tabular text-lg font-bold mt-0.5 text-white">
                          {card.planSpec.dailyLossPct}% ({formatUsd(card.planSpec.dailyLossUsd)})
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-zinc-500">Max Drawdown</p>
                        <p className="font-mono-tabular text-lg font-bold mt-0.5 text-white">
                          {card.planSpec.maxDrawdownPct}% · {card.planSpec.drawdownRule}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-zinc-500">Payout Rules</p>
                        <p className="font-mono-tabular text-base font-bold mt-0.5 text-emerald-400">
                          Min 5 Days · BNB BEP20 ($100+ / 24h)
                        </p>
                      </div>

                      {card.planSpec.mode === 'instant' && (
                        <div>
                          <p className="text-xs text-zinc-500">Instant Risk Guard</p>
                          <p className="font-mono-tabular text-base font-bold text-[#F7A600] mt-0.5">
                            35% Consistency · 1% Floating Loss
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className="mt-6 pt-5 border-t border-white/[0.08] space-y-3"
                    style={{ transform: 'translateZ(26px)' }}
                  >
                    <div>
                      <span className="text-xs block text-zinc-500">One-Time Fee</span>
                      <span
                        className={`font-mono-tabular text-4xl font-bold ${
                          card.featured ? 'text-[#F7A600]' : 'text-white'
                        }`}
                      >
                        {formatUsd(card.planSpec.feeUsd)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onSplitChange(card.splitVal);
                        onEnrollClick(card.splitVal);
                      }}
                      className={`w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-full font-bold text-base transition-colors cursor-pointer ${
                        card.featured
                          ? 'bg-white hover:bg-zinc-200 text-[#09090B]'
                          : isSelectedSplit
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-[#09090B]'
                            : 'bg-[#18181B] hover:bg-white hover:text-[#09090B] text-white border border-white/[0.12]'
                      }`}
                    >
                      <span>Buy {formatUsd(card.planSpec.accountSize)} Challenge</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </TiltCard3D>
              );
            })}
          </div>
        ) : (
          /* Compare & 3D Pass View */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-7 bg-[#111113] rounded-3xl border border-white/[0.08] p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-4 pb-5 border-b border-white/[0.08]">
                  <div>
                    <h3 className="font-display text-2xl font-bold text-white">
                      {spec.modeLabel} · {formatUsd(spec.accountSize)}
                    </h3>
                    <p className="text-sm text-zinc-400 mt-1">{spec.tagline}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-zinc-500 block">One-Time Fee</span>
                    <span className="font-mono-tabular text-2xl font-bold text-white">
                      {formatUsd(spec.feeUsd)}
                    </span>
                  </div>
                </div>

                {/* Profit Split Switcher */}
                <div className="flex items-center justify-between gap-4 py-4 border-b border-white/[0.08]">
                  <span className="text-sm font-medium text-zinc-400">
                    Select Profit Split
                  </span>
                  <div
                    role="group"
                    aria-label="Profit Split"
                    className="inline-flex gap-1 p-1 rounded-full bg-[#18181B] border border-white/[0.08]"
                  >
                    {([80, 90] as ProfitSplitOption[]).map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => onSplitChange(sp)}
                        aria-pressed={profitSplit === sp}
                        className={`px-3 py-1.5 rounded-full font-mono-tabular text-xs font-bold transition-colors cursor-pointer ${
                          profitSplit === sp
                            ? 'bg-white text-[#09090B]'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {sp}% Split
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exact Rule Grid */}
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 py-6 border-b border-white/[0.08]">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-zinc-400">Phase 1 Target</dt>
                    <dd className="font-mono-tabular text-sm font-semibold text-white">
                      {spec.phase1TargetPct > 0
                        ? `${spec.phase1TargetPct}% (${formatUsd(spec.phase1TargetUsd)})`
                        : 'None · Instant'}
                    </dd>
                  </div>

                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-zinc-400">Phase 2 Target</dt>
                    <dd className="font-mono-tabular text-sm font-semibold text-white">
                      {spec.phase2TargetPct !== null && spec.phase2TargetUsd !== null
                        ? `${spec.phase2TargetPct}% (${formatUsd(spec.phase2TargetUsd)})`
                        : 'None'}
                    </dd>
                  </div>

                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-zinc-400">Max Daily Loss</dt>
                    <dd className="font-mono-tabular text-sm font-semibold text-white">
                      {spec.dailyLossPct}% ({formatUsd(spec.dailyLossUsd)})
                    </dd>
                  </div>

                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-zinc-400">Max Overall Loss</dt>
                    <dd className="font-mono-tabular text-sm font-semibold text-white">
                      {spec.maxDrawdownPct}% ({formatUsd(spec.maxDrawdownUsd)})
                    </dd>
                  </div>

                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-zinc-400">Drawdown Method</dt>
                    <dd className="text-sm font-semibold text-emerald-400">
                      {spec.drawdownRule}
                    </dd>
                  </div>

                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-zinc-400">Min Trading Days</dt>
                    <dd className="font-mono-tabular text-sm font-semibold text-white">
                      {spec.minTradingDays} Days
                    </dd>
                  </div>

                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-zinc-400">Payout Cycle</dt>
                    <dd className="font-mono-tabular text-sm font-semibold text-white">
                      Every {spec.payoutCycleDays} Days
                    </dd>
                  </div>

                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-zinc-400">Fee Refund</dt>
                    <dd className="text-sm font-semibold text-white">
                      {spec.feeRefundOnFirstPayout ? '100% on 1st Payout' : 'Instant Capital'}
                    </dd>
                  </div>
                </dl>

                {/* Plain-English Transparency Guarantees */}
                <div className="pt-5">
                  <p className="text-xs font-semibold text-zinc-400 mb-3">
                    Included Transparency Guarantees
                  </p>
                  <ul className="space-y-2.5">
                    {spec.transparencyGuarantees.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-300">
                        <Check
                          className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-500">
                <span>Leverage: {spec.leverage}</span>
                <span>Execution: Lemon Terminal™ Live</span>
              </div>
            </div>

            {/* Interactive 3D Lemon Trader Pass Card */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-5">
              <TiltCard3D
                maxTiltDeg={6}
                className="rounded-3xl bg-[#18181B] text-white p-7 sm:p-8 border border-white/[0.12] shadow-2xl overflow-hidden"
              >
                <div
                  className="flex items-center justify-between mb-7"
                  style={{ transform: 'translateZ(26px)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#F7A600] flex items-center justify-center font-display font-extrabold text-[#09090B] text-xs">
                      LF
                    </div>
                    <div>
                      <p className="font-display text-base font-bold tracking-tight text-white">
                        LemonFunding Pass
                      </p>
                      <p className="text-xs text-zinc-400">
                        {spec.drawdownRule} Verified
                      </p>
                    </div>
                  </div>
                  <span className="font-mono-tabular text-xs font-bold text-emerald-400">
                    {spec.profitSplitPct}% Split
                  </span>
                </div>

                <div className="mb-7" style={{ transform: 'translateZ(36px)' }}>
                  <p className="text-xs text-zinc-400 mb-1">Funded Buying Power</p>
                  <motion.p
                    key={spec.accountSize}
                    initial={{ opacity: 0.5, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    className="font-mono-tabular text-4xl sm:text-5xl font-bold text-[#F7A600] tracking-tight"
                  >
                    {formatUsd(spec.accountSize)}
                  </motion.p>
                  <p className="text-xs text-zinc-400 mt-2">
                    {spec.modeLabel} · {spec.minTradingDays} min trading days
                  </p>
                </div>

                <div
                  className="grid grid-cols-3 gap-3 pt-5 border-t border-white/[0.1]"
                  style={{ transform: 'translateZ(20px)' }}
                >
                  <div>
                    <p className="text-[11px] text-zinc-500">Daily Limit</p>
                    <p className="font-mono-tabular text-sm font-semibold text-white mt-0.5">
                      -{formatUsd(spec.dailyLossUsd)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-500">Overall Floor</p>
                    <p className="font-mono-tabular text-sm font-semibold text-white mt-0.5">
                      {formatUsd(spec.accountSize - spec.maxDrawdownUsd)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-500">Payout Cycle</p>
                    <p className="font-mono-tabular text-sm font-semibold text-emerald-400 mt-0.5">
                      Every {spec.payoutCycleDays}d
                    </p>
                  </div>
                </div>
              </TiltCard3D>

              <div className="bg-[#111113] rounded-3xl border border-white/[0.08] p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>BNB BEP20 Verified · Admin Approved</span>
                  </div>
                  <span className="font-mono-tabular text-sm font-bold text-white">
                    {formatUsd(spec.feeUsd)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onEnrollClick(spec.profitSplitPct)}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] font-bold text-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>
                    Buy {formatUsd(spec.accountSize)} Challenge — {formatUsd(spec.feeUsd)}
                  </span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
