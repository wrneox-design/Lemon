import { motion } from 'motion/react';
import { TiltCard3D } from './TiltCard3D';

const PILLARS = [
  {
    index: '01',
    title: 'Static Balance Drawdown',
    metric: '0% Trailing Trap',
    body: 'On 2-Step Classic Lemon challenges, your 10% maximum drawdown stays anchored to your initial balance—never creeping up when an open trade peaks in profit.',
    diagram: 'static',
  },
  {
    index: '02',
    title: 'Zero Hidden Disqualifications',
    metric: '100% Rule Clarity',
    body: 'All payout and risk bounds—including the Instant Zest 35% consistency cap & 1% floating loss limit—are tracked live in your terminal.',
    diagram: 'open',
  },
  {
    index: '03',
    title: 'Fast BNB BEP20 Payouts',
    metric: 'Max 24h Settlement',
    body: 'Every payout request ($100 min, 5+ trading days) runs through a deterministic ledger audit with instant QR certificate verification.',
    diagram: 'payout',
  },
];

function CitrusDiagram({ kind }: { kind: string }) {
  if (kind === 'static') {
    return (
      <svg
        viewBox="0 0 220 96"
        className="w-full h-24 mt-5"
        aria-hidden="true"
      >
        <rect x="0" y="0" width="220" height="96" rx="10" fill="#18181B" />
        <line
          x1="16"
          y1="72"
          x2="204"
          y2="72"
          stroke="#10B981"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <path
          d="M16 54 Q 60 22, 102 36 T 188 18"
          fill="none"
          stroke="#F7A600"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="102" cy="36" r="4" fill="#FFFFFF" />
        <circle cx="188" cy="18" r="5" fill="#10B981" />
        <text x="18" y="86" fontSize="9" fill="#A1A1AA" fontFamily="monospace">
          Static Floor ($90,000)
        </text>
      </svg>
    );
  }
  if (kind === 'open') {
    return (
      <svg
        viewBox="0 0 220 96"
        className="w-full h-24 mt-5"
        aria-hidden="true"
      >
        <rect x="0" y="0" width="220" height="96" rx="10" fill="#18181B" />
        <rect x="20" y="54" width="24" height="24" rx="4" fill="#27272A" />
        <rect x="56" y="38" width="24" height="40" rx="4" fill="#3F3F46" />
        <rect x="92" y="16" width="24" height="62" rx="4" fill="#F7A600" />
        <rect x="128" y="44" width="24" height="34" rx="4" fill="#52525B" />
        <rect x="164" y="28" width="24" height="50" rx="4" fill="#10B981" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 220 96"
      className="w-full h-24 mt-5"
      aria-hidden="true"
    >
      <rect x="0" y="0" width="220" height="96" rx="10" fill="#18181B" />
      <circle cx="54" cy="48" r="22" fill="#F7A600" />
      <circle cx="54" cy="48" r="16" fill="#09090B" />
      <path
        d="M84 48 L142 48"
        stroke="#71717A"
        strokeWidth="2"
        strokeDasharray="3 3"
      />
      <rect x="148" y="30" width="52" height="36" rx="6" fill="#10B981" />
      <text
        x="174"
        y="52"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="#09090B"
        fontFamily="monospace"
      >
        PAID
      </text>
    </svg>
  );
}

export function TransparencyPillars() {
  return (
    <section
      id="transparency"
      className="scroll-mt-24 py-14 sm:py-18 border-t border-white/[0.08] bg-[#09090B]"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-bold text-emerald-400 tracking-wide mb-2">
            02. Why LemonFunding Is Transparent
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white text-balance">
            Every rule is glass-clear before you place a single trade
          </h2>
          <p className="text-base text-zinc-400 mt-2.5">
            Most funding firms bury disqualifications in footnotes. LemonFunding publishes deterministic formulas you can audit live.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PILLARS.map((pillar, idx) => (
            <motion.div
              key={pillar.index}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.35, delay: idx * 0.08 }}
            >
              <TiltCard3D
                maxTiltDeg={5}
                className="h-full bg-[#111113] rounded-2xl border border-white/[0.08] p-6 sm:p-7 flex flex-col justify-between"
              >
                <div style={{ transform: 'translateZ(18px)' }}>
                  <div className="flex items-baseline justify-between gap-4 mb-4">
                    <span className="font-mono-tabular text-xs font-semibold text-zinc-500">
                      {pillar.index}.
                    </span>
                    <span className="font-mono-tabular text-xs font-bold text-emerald-400">
                      {pillar.metric}
                    </span>
                  </div>

                  <h3 className="font-display text-xl font-bold text-white">
                    {pillar.title}
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed mt-2.5">
                    {pillar.body}
                  </p>
                </div>

                <div style={{ transform: 'translateZ(24px)' }}>
                  <CitrusDiagram kind={pillar.diagram} />
                </div>
              </TiltCard3D>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
