import { Check, CheckCircle2, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { TiltCard3D } from './TiltCard3D';

interface TraderJourneyProps {
  onBuyChallenge: () => void;
}

const JOURNEY_STEPS = [
  {
    date: 'Jul 4',
    title: 'Evaluation Purchased',
    detail: '$100K 2-Step Classic',
    outcome: '$479',
    highlight: 'neutral',
  },
  {
    date: 'Jul 4',
    title: 'Phase 1 Passed',
    detail: 'Status: Clear',
    outcome: 'Same day',
    highlight: 'clear',
  },
  {
    date: 'Jul 9',
    title: 'Phase 2 passed 5 days after Phase 1',
    detail: 'Status: Clear',
    outcome: 'Funded',
    highlight: 'funded',
  },
  {
    date: 'Jul 21',
    title: 'First reward in 12 days after funded',
    detail: 'Via BNB BEP20 in 4 hrs',
    outcome: '$4,050.90',
    highlight: 'reward',
  },
] as const;

export function TraderJourney({ onBuyChallenge }: TraderJourneyProps) {
  return (
    <section
      id="journey"
      className="scroll-mt-24 py-14 sm:py-18 border-t border-white/[0.08] bg-[#09090B]"
    >
      <div className="max-w-[780px] mx-auto px-4 sm:px-8">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white text-balance">
            Trader&apos;s Journey
          </h2>
          <p className="text-sm text-zinc-400 mt-2">
            Case study · 4 Jul → 21 Jul · $100K 2-Step Classic
          </p>
        </div>

        {/* Clean Milestone Card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.32 }}
        >
          <TiltCard3D
            maxTiltDeg={4}
            className="rounded-3xl bg-[#111113] border border-white/[0.08] p-6 sm:p-8"
          >
            <div className="divide-y divide-white/[0.08]">
              {JOURNEY_STEPS.map((step, idx) => (
                <div
                  key={`${step.date}-${step.title}`}
                  className={`${idx === 0 ? 'pb-5' : idx === JOURNEY_STEPS.length - 1 ? 'pt-5' : 'py-5'} space-y-2.5`}
                  style={{ transform: 'translateZ(14px)' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs font-medium text-zinc-500 shrink-0">
                      {step.date}
                    </span>
                    <span className="text-sm sm:text-base font-bold text-white text-right">
                      {step.title}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm text-zinc-400 flex items-center gap-1.5">
                      {step.detail === 'Status: Clear' ? (
                        <>
                          <span>Status:</span>
                          <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                          <span className="font-bold text-emerald-400">Clear</span>
                        </>
                      ) : (
                        <span>{step.detail}</span>
                      )}
                    </div>

                    <div className="font-mono-tabular text-right">
                      {step.highlight === 'funded' && (
                        <span className="inline-flex items-center gap-1.5 text-lg font-bold text-emerald-400">
                          <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                          <span>Funded</span>
                        </span>
                      )}
                      {step.highlight === 'reward' && (
                        <span className="text-xl sm:text-2xl font-bold text-emerald-400">
                          {step.outcome}
                        </span>
                      )}
                      {(step.highlight === 'neutral' || step.highlight === 'clear') && (
                        <span className="text-lg sm:text-xl font-bold text-white">
                          {step.outcome}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TiltCard3D>
        </motion.div>

        {/* ROI Highlight Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.36, delay: 0.06 }}
          className="mt-5"
        >
          <TiltCard3D
            maxTiltDeg={5}
            className="rounded-3xl bg-[#18181B] text-white p-6 sm:p-7 border border-white/[0.12] shadow-2xl"
          >
            <div
              className="flex flex-wrap items-baseline justify-between gap-4"
              style={{ transform: 'translateZ(20px)' }}
            >
              <div className="flex items-baseline gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  ROI
                </span>
                <span className="font-mono-tabular text-3xl sm:text-4xl font-bold text-[#F7A600]">
                  5,531%
                </span>
              </div>

              <div className="font-mono-tabular text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span className="text-zinc-400 font-normal text-base">$479</span>
                <span aria-hidden="true" className="text-emerald-400">→</span>
                <span>$26,242</span>
              </div>
            </div>

            <div
              className="flex flex-wrap items-center gap-2 mt-3 text-xs text-zinc-300"
              style={{ transform: 'translateZ(16px)' }}
            >
              <div className="flex items-center gap-0.5 text-[#F7A600]" aria-label="5 out of 5 stars">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                ))}
              </div>
              <span>&ldquo;Zero hidden drawdown traps.&rdquo; — Majed M.</span>
            </div>

            <button
              type="button"
              onClick={onBuyChallenge}
              style={{ transform: 'translateZ(26px)' }}
              className="mt-5 w-full py-3.5 px-6 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] font-bold text-sm transition-colors cursor-pointer"
            >
              + New Challenge
            </button>
          </TiltCard3D>
        </motion.div>
      </div>
    </section>
  );
}
