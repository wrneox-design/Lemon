import { X } from 'lucide-react';
import { formatUsd, type EnrolledChallenge } from '../utils/challenges';

interface TraderPortalModalProps {
  isOpen: boolean;
  challenges: EnrolledChallenge[];
  onClose: () => void;
}

export function TraderPortalModal({
  isOpen,
  challenges,
  onClose,
}: TraderPortalModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="portal-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-[#111113] border border-white/[0.1] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col text-white">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#0C0C0E]">
          <h2
            id="portal-dialog-title"
            className="font-display text-lg font-bold text-white"
          >
            My Enrolled Challenges ({challenges.length})
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close trader portal"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {challenges.length === 0 ? (
            <p className="text-sm text-zinc-400">
              You have no active challenges yet. Select a tier in the configurator to activate one.
            </p>
          ) : (
            challenges.map((c) => (
              <div
                key={c.id}
                className="p-5 rounded-xl bg-[#18181B] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <p className="font-mono-tabular text-xs font-semibold text-emerald-400">
                    {c.accountNumber} · {c.status}
                  </p>
                  <h3 className="font-display text-lg font-bold text-white mt-0.5">
                    {c.modeLabel} · {formatUsd(c.accountSize)}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    {c.traderName} · {c.platform} · {c.profitSplitPct}% Profit Split
                  </p>
                </div>

                <div className="sm:text-right">
                  <span className="text-xs text-zinc-500 block">Fee Paid</span>
                  <span className="font-mono-tabular text-base font-bold text-white">
                    {formatUsd(c.feePaidUsd)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
