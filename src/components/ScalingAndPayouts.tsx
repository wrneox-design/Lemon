import { useState } from 'react';
import { motion } from 'motion/react';
import {
  VERIFIED_PAYOUTS,
  formatUsd,
  type ChallengeMode,
} from '../utils/challenges';
import { TiltCard3D } from './TiltCard3D';

const SCALING_STAGES = [
  {
    step: 'Stage 01',
    title: 'Funded Entry',
    cap: 'Up to $200,000',
    rule: 'Pass evaluation or start Instant Zest with 80%–90% profit split.',
  },
  {
    step: 'Stage 02',
    title: 'Quarterly Citrus Scale',
    cap: '+25% Capital Boost',
    rule: 'Achieve 10% cumulative net gain over 3 months with 2+ processed payouts.',
  },
  {
    step: 'Stage 03',
    title: 'Prime Lemon Vault',
    cap: '$2,000,000 Max',
    rule: 'Permanent 90% profit split, 24h BNB BEP20 priority settlements, and desk support.',
  },
];

export function ScalingAndPayouts() {
  const [filterMode, setFilterMode] = useState<'all' | ChallengeMode>('all');

  const filteredPayouts =
    filterMode === 'all'
      ? VERIFIED_PAYOUTS
      : VERIFIED_PAYOUTS.filter((p) => p.mode === filterMode);

  return (
    <section
      id="payouts"
      className="scroll-mt-24 py-14 sm:py-18 border-t border-white/[0.08] bg-[#09090B]"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 space-y-16">
        {/* 3D Scaling Ladder */}
        <div>
          <div className="max-w-2xl mb-10">
            <p className="text-xs font-bold text-emerald-400 tracking-wide mb-2">
              04. Capital Scaling &amp; Verified Payouts
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white text-balance">
              Grow from your first funded tier to a $2M Lemon Vault
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SCALING_STAGES.map((stage, idx) => (
              <motion.div
                key={stage.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.35, delay: idx * 0.08 }}
              >
                <TiltCard3D
                  maxTiltDeg={5}
                  className="h-full bg-[#111113] rounded-2xl border border-white/[0.08] p-6 sm:p-7 flex flex-col justify-between"
                >
                  <div style={{ transform: 'translateZ(20px)' }}>
                    <span className="font-mono-tabular text-xs font-semibold text-zinc-500">
                      {stage.step}
                    </span>
                    <h3 className="font-display text-xl font-bold text-white mt-2">
                      {stage.title}
                    </h3>
                    <p className="font-mono-tabular text-2xl font-bold text-emerald-400 mt-3">
                      {stage.cap}
                    </p>
                    <p className="text-sm text-zinc-400 leading-relaxed mt-3">
                      {stage.rule}
                    </p>
                  </div>
                </TiltCard3D>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Public Payout Ledger */}
        <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
            <div>
              <h3 className="font-display text-2xl font-bold text-white">
                Recent Trader Payout Ledger
              </h3>
              <p className="text-sm text-zinc-400 mt-1">
                Settlement timestamps and challenge tiers verified with QR payout certificates.
              </p>
            </div>

            <div
              role="group"
              aria-label="Filter payouts by challenge model"
              className="flex items-center gap-1 p-1 rounded-full bg-[#18181B] border border-white/[0.08] self-start sm:self-auto overflow-x-auto max-w-full"
            >
              {[
                { id: 'all', label: 'All Tiers' },
                { id: 'two-step', label: '2-Step' },
                { id: 'one-step', label: '1-Step' },
                { id: 'instant', label: 'Instant' },
              ].map((tab) => {
                const active = filterMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterMode(tab.id as 'all' | ChallengeMode)}
                    aria-pressed={active}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white text-[#09090B]'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-xs font-semibold text-zinc-500">
                  <th className="py-3.5 pr-4">Trader</th>
                  <th className="py-3.5 px-4">Challenge</th>
                  <th className="py-3.5 px-4">Account Size</th>
                  <th className="py-3.5 px-4">Payout Amount</th>
                  <th className="py-3.5 px-4">Turnaround</th>
                  <th className="py-3.5 pl-4 text-right">Method · Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-sm">
                {filteredPayouts.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-4 pr-4 font-semibold text-white whitespace-nowrap">
                      {row.traderName} ·{' '}
                      <span className="font-normal text-zinc-500">{row.country}</span>
                    </td>
                    <td className="py-4 px-4 text-zinc-400 whitespace-nowrap">
                      {row.modeLabel}
                    </td>
                    <td className="py-4 px-4 font-mono-tabular text-zinc-200 whitespace-nowrap">
                      {formatUsd(row.accountSize)}
                    </td>
                    <td className="py-4 px-4 font-mono-tabular font-bold text-emerald-400 whitespace-nowrap">
                      {formatUsd(row.payoutUsd)}
                    </td>
                    <td className="py-4 px-4 font-mono-tabular text-zinc-400 whitespace-nowrap">
                      {row.processingTime}
                    </td>
                    <td className="py-4 pl-4 text-right text-xs text-zinc-400 whitespace-nowrap">
                      {row.method} · {row.dateLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
