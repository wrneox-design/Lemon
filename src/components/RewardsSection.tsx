import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  CheckCircle2,
  Clock,
  Crown,
  ExternalLink,
  Gift,
  Instagram,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react';
import type {
  RedeemStoreItem,
  RedemptionRequest,
  RewardRarity,
  SocialTaskId,
  SocialTaskSubmission,
} from '../server/authStore';
import { formatUsd } from '../utils/challenges';
import { compressImageFile } from '../utils/imageCompress';

interface TaskCatalogWithSubmission {
  id: SocialTaskId;
  title: string;
  platformLabel: string;
  actionUrl: string;
  handleDisplay: string;
  pointsReward: number;
  instruction: string;
  submission: SocialTaskSubmission | null;
}

interface RewardsApiPayload {
  rewardPoints: number;
  tasks: TaskCatalogWithSubmission[];
  storeItems: RedeemStoreItem[];
  myRedemptions: RedemptionRequest[];
  activeSecretDropCount: number;
}

interface RewardsSectionProps {
  accessToken: string;
  focusSecretCode?: boolean;
  onClearFocusSecretCode?: () => void;
  onRefreshDashboard: () => Promise<void>;
  onOpenAccountInTerminal?: () => void;
}

const RARITY_STYLES: Record<
  RewardRarity,
  { label: string; bg: string; border: string; text: string }
> = {
  MYTHIC: {
    label: 'MYTHIC DROP',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/40',
    text: 'text-amber-300',
  },
  LEGENDARY: {
    label: 'LEGENDARY DROP',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-300',
  },
  RARE: {
    label: 'RARE DROP',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/35',
    text: 'text-emerald-300',
  },
  STORE: {
    label: 'STORE REDEEM',
    bg: 'bg-white/[0.06]',
    border: 'border-white/[0.12]',
    text: 'text-zinc-200',
  },
  BONUS_PTS: {
    label: 'BONUS POINTS',
    bg: 'bg-sky-500/15',
    border: 'border-sky-500/30',
    text: 'text-sky-300',
  },
  COUPON: {
    label: 'DISCOUNT COUPON',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/40',
    text: 'text-amber-300',
  },
};

export function RewardsSection({
  accessToken,
  focusSecretCode = false,
  onClearFocusSecretCode,
  onRefreshDashboard,
  onOpenAccountInTerminal,
}: RewardsSectionProps) {
  const [data, setData] = useState<RewardsApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusBanner, setStatusBanner] = useState('');

  // Secret code drop form & luck result animation
  const [secretCodeInput, setSecretCodeInput] = useState('');
  const [rollingCode, setRollingCode] = useState(false);
  const [latestRoll, setLatestRoll] = useState<{
    request: RedemptionRequest;
    rollPct: number;
  } | null>(null);

  // Per-task local form state
  const [taskHandles, setTaskHandles] = useState<Record<SocialTaskId, string>>({
    follow_x: '',
    follow_instagram: '',
  });
  const [taskProofs, setTaskProofs] = useState<Record<SocialTaskId, string>>({
    follow_x: '',
    follow_instagram: '',
  });
  const [taskProofNames, setTaskProofNames] = useState<Record<SocialTaskId, string>>({
    follow_x: '',
    follow_instagram: '',
  });
  const [submittingTaskId, setSubmittingTaskId] = useState<SocialTaskId | null>(null);
  const [redeemingItemId, setRedeemingItemId] = useState<string | null>(null);

  const secretInputRef = useRef<HTMLInputElement>(null);

  const loadRewards = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const resp = await fetch('/api/rewards', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await resp.json();
      if (!resp.ok) {
        setErrorMsg(json.error || 'Could not load rewards data.');
        return;
      }
      setData(json as RewardsApiPayload);
    } catch {
      setErrorMsg('Network error loading rewards center.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  useEffect(() => {
    if (focusSecretCode && secretInputRef.current) {
      secretInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      secretInputRef.current.focus();
      onClearFocusSecretCode?.();
    }
  }, [focusSecretCode, onClearFocusSecretCode]);

  const handleTaskFileChange = async (
    taskId: SocialTaskId,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    try {
      const compressed = await compressImageFile(file, 1280, 0.78);
      setTaskProofs((prev) => ({ ...prev, [taskId]: compressed }));
      setTaskProofNames((prev) => ({ ...prev, [taskId]: file.name }));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not read image.');
    }
  };

  const handleSubmitTask = async (taskId: SocialTaskId) => {
    setErrorMsg('');
    setStatusBanner('');
    const handle = taskHandles[taskId].trim();
    const proofImageUrl = taskProofs[taskId];

    if (handle.length < 2) {
      setErrorMsg('Enter your social username/handle before submitting proof.');
      return;
    }
    if (!proofImageUrl) {
      setErrorMsg('Attach your follow screenshot proof image.');
      return;
    }

    setSubmittingTaskId(taskId);
    try {
      const resp = await fetch('/api/rewards/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ taskId, handle, proofImageUrl }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setErrorMsg(json.error || 'Could not submit follow proof.');
        return;
      }
      setStatusBanner(
        'Screenshot submitted to Admin Panel! Once approved by the owner, +100 pts will be added to your wallet.'
      );
      setTaskHandles((prev) => ({ ...prev, [taskId]: '' }));
      setTaskProofs((prev) => ({ ...prev, [taskId]: '' }));
      setTaskProofNames((prev) => ({ ...prev, [taskId]: '' }));
      await loadRewards();
      await onRefreshDashboard();
    } catch {
      setErrorMsg('Network error submitting social task proof.');
    } finally {
      setSubmittingTaskId(null);
    }
  };

  const handleRedeemStoreItem = async (item: RedeemStoreItem) => {
    setErrorMsg('');
    setStatusBanner('');
    setRedeemingItemId(item.id);
    try {
      const resp = await fetch('/api/rewards/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ storeItemId: item.id }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setErrorMsg(json.error || 'Could not redeem reward item.');
        return;
      }
      setStatusBanner(
        `Redeem request for ${item.title} submitted to Admin Panel! Your account activates as soon as the owner approves it.`
      );
      await loadRewards();
      await onRefreshDashboard();
    } catch {
      setErrorMsg('Network error submitting store redemption.');
    } finally {
      setRedeemingItemId(null);
    }
  };

  const handleRollSecretCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusBanner('');
    const code = secretCodeInput.trim().toUpperCase();
    if (!code) {
      setErrorMsg('Enter a Secret Code dropped by the Admin.');
      return;
    }

    setRollingCode(true);
    try {
      const resp = await fetch('/api/rewards/secret-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ code }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setErrorMsg(json.error || 'Secret code could not be claimed.');
        return;
      }
      setLatestRoll({ request: json.request, rollPct: json.rollPct });
      setSecretCodeInput('');
      setStatusBanner(
        `Secret code rolled: ${json.request.rewardTitle}! Sent to Admin Panel for final approval.`
      );
      await loadRewards();
      await onRefreshDashboard();
    } catch {
      setErrorMsg('Network error claiming secret code.');
    } finally {
      setRollingCode(false);
    }
  };

  const rewardPoints = data?.rewardPoints ?? 0;
  const myRedemptions = data?.myRedemptions || [];
  const pendingClaimsCount = myRedemptions.filter(
    (r) => r.status === 'pending_approval'
  ).length;
  const approvedClaimsCount = myRedemptions.filter(
    (r) => r.status === 'approved'
  ).length;
  const existingSecretClaim = myRedemptions.find((r) => r.source === 'secret_code') || null;
  const existingStoreClaim =
    myRedemptions.find((r) => r.source === 'points_store' && r.status !== 'rejected') || null;

  return (
    <div data-testid="rewards-section" className="space-y-6">
      {/* Top Rewards Wallet Banner */}
      <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-400">
            <Trophy className="w-4 h-4 text-[#FACC15]" />
            <span>LemonFunding Rewards &amp; Secret Drops</span>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span
              data-testid="rewards-points-balance"
              className="font-mono-tabular text-4xl sm:text-5xl font-extrabold text-white"
            >
              {rewardPoints.toLocaleString('en-US')}
            </span>
            <span className="text-base font-bold text-[#FACC15]">PTS</span>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Complete both X &amp; Instagram follow tasks (+200 pts) to unlock a{' '}
            <strong className="text-white">$5,000 2-Step Account</strong> after Admin approval.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.08] text-xs sm:text-sm">
            <span className="text-zinc-400 block">Pending Approvals</span>
            <span className="font-mono-tabular font-bold text-white text-base">
              {pendingClaimsCount} item{pendingClaimsCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs sm:text-sm">
            <span className="text-emerald-400 block">Approved Claims</span>
            <span className="font-mono-tabular font-bold text-white text-base">
              {approvedClaimsCount} item{approvedClaimsCount === 1 ? '' : 's'}
            </span>
          </div>
          <button
            type="button"
            onClick={loadRewards}
            disabled={loading}
            className="p-3 rounded-xl bg-[#18181B] hover:bg-white/10 border border-white/[0.08] text-white transition-colors cursor-pointer"
            title="Refresh rewards status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-sm font-medium text-red-300"
        >
          {errorMsg}
        </div>
      )}

      {statusBanner && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-sm font-semibold text-emerald-300 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* Secret Code Drop & Mythic Luck Crate */}
      <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#18181B] border border-white/[0.08] text-[#FACC15] flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Secret Drop Code · Luck Roll
              </h2>
              <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
                Enter any Secret Code dropped by Admin to win discount coupons or funded accounts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono-tabular shrink-0">
            <span className="px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
              MYTHIC $50K
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
              LEGENDARY $25K
            </span>
          </div>
        </div>

        {existingSecretClaim ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                Secret Code Already Claimed · 1x Per Account
              </p>
              <p className="text-sm font-bold text-white">{existingSecretClaim.rewardTitle}</p>
              <p className="text-xs text-zinc-400">
                Code used: <span className="font-mono-tabular text-zinc-200">{existingSecretClaim.secretCodeUsed}</span> ·{' '}
                {existingSecretClaim.status === 'approved' ? 'Approved & Credited' : 'Pending Admin Approval'}
              </p>
            </div>
            <span className="px-3.5 py-1.5 rounded-full bg-white/10 text-zinc-300 text-xs font-bold whitespace-nowrap self-start sm:self-center">
              Locked (1x Limit)
            </span>
          </div>
        ) : (
          <form onSubmit={handleRollSecretCode} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Ticket className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={secretInputRef}
                type="text"
                value={secretCodeInput}
                onChange={(e) => setSecretCodeInput(e.target.value.toUpperCase())}
                placeholder="Enter secret code given by Admin"
                className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-[#18181B] border border-white/[0.1] font-mono-tabular text-base font-bold text-white uppercase placeholder:normal-case placeholder:font-normal placeholder:text-zinc-500 focus:outline-none focus:border-white"
              />
            </div>

            <button
              type="submit"
              disabled={rollingCode}
              className="px-6 py-3.5 rounded-full bg-white hover:bg-zinc-200 disabled:opacity-60 text-[#09090B] font-bold text-sm transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
            >
              <Sparkles className={`w-4 h-4 ${rollingCode ? 'animate-spin' : ''}`} />
              <span>{rollingCode ? 'Rolling Luck...' : 'Claim Secret Code'}</span>
            </button>
          </form>
        )}

        <AnimatePresence>
          {latestRoll && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`p-4 rounded-xl border ${RARITY_STYLES[latestRoll.request.rarityTier].bg} ${RARITY_STYLES[latestRoll.request.rarityTier].border} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
            >
              <div className="flex items-center gap-3">
                <Crown className={`w-6 h-6 shrink-0 ${RARITY_STYLES[latestRoll.request.rarityTier].text}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-extrabold uppercase tracking-wider ${RARITY_STYLES[latestRoll.request.rarityTier].text}`}>
                      {RARITY_STYLES[latestRoll.request.rarityTier].label} · Luck Index {latestRoll.rollPct.toFixed(1)}%
                    </span>
                  </div>
                  <p className="font-display font-bold text-base text-white">
                    {latestRoll.request.rewardTitle}
                  </p>
                  <p className="text-xs text-zinc-300">
                    {latestRoll.request.couponCode ? (
                      <>
                        Use promo code <strong className="font-mono-tabular text-amber-300">{latestRoll.request.couponCode}</strong> at challenge checkout for {latestRoll.request.discountPct}% off!
                      </>
                    ) : latestRoll.request.status === 'approved' ? (
                      <>
                        Code <strong className="font-mono-tabular text-white">{latestRoll.request.secretCodeUsed}</strong> unlocked and credited immediately!
                      </>
                    ) : (
                      <>
                        Code <strong className="font-mono-tabular text-white">{latestRoll.request.secretCodeUsed}</strong> submitted — waiting for Admin approval.
                      </>
                    )}
                  </p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap self-start sm:self-center ${
                  latestRoll.request.status === 'approved'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/35'
                }`}
              >
                {latestRoll.request.status === 'approved' ? 'Unlocked Instantly' : 'Pending Admin Approval'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Section 2: Two Social Follow Tasks (+100 pts each = 200 pts) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              Follow &amp; Earn Points (2 Tasks · 100 pts Each)
            </h2>
            <p className="text-xs text-zinc-400">
              Upload screenshot proof after following on X &amp; Instagram. Admin approves your proof to credit +100 pts each.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#18181B] border border-white/[0.1] text-white text-xs font-mono-tabular font-bold">
            200 PTS = Free $5K 2-Step
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data?.tasks || []).map((task) => {
            const sub = task.submission;
            const isApproved = sub?.status === 'approved';
            const isPending = sub?.status === 'pending';
            const isRejected = sub?.status === 'rejected';
            const canSubmit = !sub || isRejected;
            const localProof = taskProofs[task.id];

            return (
              <div
                key={task.id}
                className="bg-[#111113] rounded-2xl border border-white/[0.08] p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <a
                      href={task.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#18181B] border border-white/[0.1] group-hover:border-white/30 flex items-center justify-center text-white font-bold transition-colors">
                        {task.id === 'follow_x' ? (
                          <span className="text-base font-extrabold">𝕏</span>
                        ) : (
                          <Instagram className="w-5 h-5 text-[#E1306C]" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-sm text-white group-hover:text-emerald-400 transition-colors flex items-center gap-1">
                          <span>{task.title}</span>
                          <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                        </h3>
                        <p className="text-xs text-zinc-400">{task.handleDisplay}</p>
                      </div>
                    </a>

                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-mono-tabular text-xs font-extrabold whitespace-nowrap">
                      +{task.pointsReward} PTS
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">{task.instruction}</p>

                  <a
                    href={task.actionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-xs font-bold text-[#09090B] transition-colors"
                  >
                    <span>Follow {task.handleDisplay} on {task.platformLabel}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {isApproved && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-xs text-emerald-300 flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Approved by Admin · +{task.pointsReward} pts credited ({sub.handle})</span>
                  </div>
                )}

                {isPending && (
                  <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/25 text-xs text-amber-300 flex items-center gap-2 font-semibold">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>Screenshot submitted ({sub.handle}) — waiting for Admin approval</span>
                  </div>
                )}

                {canSubmit && (
                  <div className="space-y-3 pt-3 border-t border-white/[0.08]">
                    {isRejected && (
                      <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-[11px] text-red-300 flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Previous proof rejected{sub?.adminNote ? `: ${sub.adminNote}` : '. Please attach a clear screenshot.'}
                        </span>
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                        Your {task.platformLabel} Username
                      </label>
                      <input
                        type="text"
                        value={taskHandles[task.id]}
                        onChange={(e) =>
                          setTaskHandles((prev) => ({ ...prev, [task.id]: e.target.value }))
                        }
                        placeholder="e.g. @yourhandle"
                        className="w-full px-3 py-2 rounded-xl bg-[#18181B] border border-white/[0.1] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white"
                      />
                    </div>

                    <div>
                      <input
                        id={`task-file-${task.id}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleTaskFileChange(task.id, e)}
                        className="hidden"
                      />
                      {!localProof ? (
                        <label
                          htmlFor={`task-file-${task.id}`}
                          className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl border border-dashed border-white/15 bg-[#18181B] hover:border-white/40 text-xs font-semibold text-zinc-200 cursor-pointer transition-colors"
                        >
                          <UploadCloud className="w-4 h-4 text-emerald-400" />
                          <span>Attach Follow Screenshot Proof</span>
                        </label>
                      ) : (
                        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#18181B] border border-emerald-500/35">
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={localProof}
                              alt="Follow proof preview"
                              className="w-9 h-9 rounded-lg object-cover border border-white/10"
                            />
                            <span className="text-[11px] font-semibold text-emerald-400 truncate">
                              {taskProofNames[task.id] || 'Screenshot attached'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setTaskProofs((prev) => ({ ...prev, [task.id]: '' }));
                              setTaskProofNames((prev) => ({ ...prev, [task.id]: '' }));
                            }}
                            className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={submittingTaskId === task.id}
                      onClick={() => handleSubmitTask(task.id)}
                      className="w-full py-2.5 px-4 rounded-full bg-white hover:bg-zinc-200 disabled:opacity-60 text-[#09090B] font-bold text-xs transition-colors cursor-pointer"
                    >
                      {submittingTaskId === task.id
                        ? 'Submitting Proof...'
                        : `Submit Proof for +${task.pointsReward} PTS`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Redeem Store (5 Accounts across Models) */}
      <div className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-bold text-white">
            Account Redeem Store (5 Challenge Models)
          </h2>
          <p className="text-xs text-zinc-400">
            Exchange earned points for real funded &amp; evaluation accounts. Issued directly after Admin approval.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data?.storeItems || []).map((item) => {
            const canAfford = rewardPoints >= item.pointsCost;
            const pct = Math.min(100, Math.round((rewardPoints / item.pointsCost) * 100));

            return (
              <div
                key={item.id}
                className="bg-[#111113] rounded-2xl border border-white/[0.08] hover:border-white/25 transition-colors p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#18181B] border border-white/[0.08] text-zinc-300 text-[10px] font-bold">
                      {item.badge}
                    </span>
                    <span className="font-mono-tabular text-xs font-extrabold text-[#FACC15]">
                      {item.pointsCost} PTS
                    </span>
                  </div>

                  <div>
                    <h3 className="font-display text-base font-bold text-white">
                      {item.title}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] font-mono-tabular text-zinc-400">
                      <span>Progress</span>
                      <span>
                        {Math.min(rewardPoints, item.pointsCost)} / {item.pointsCost} pts
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          canAfford ? 'bg-emerald-500' : 'bg-[#FACC15]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!canAfford || Boolean(existingStoreClaim) || redeemingItemId === item.id}
                  onClick={() => handleRedeemStoreItem(item)}
                  className={`w-full py-2.5 px-4 rounded-full text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                    canAfford && !existingStoreClaim
                      ? 'bg-white hover:bg-zinc-200 text-[#09090B] cursor-pointer'
                      : 'bg-[#18181B] text-zinc-500 border border-white/[0.06] cursor-not-allowed'
                  }`}
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>
                    {existingStoreClaim
                      ? 'Store Reward Claimed (1x Limit)'
                      : redeemingItemId === item.id
                        ? 'Submitting...'
                        : canAfford
                          ? 'Claim Account (Admin Approval)'
                          : `Need ${item.pointsCost - rewardPoints} more pts`}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 4: My Redemption & Code Roll Requests */}
      <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2 pb-4 border-b border-white/[0.08]">
          <div>
            <h2 className="font-display text-base font-bold text-white">
              My Rewards &amp; Secret Code Claims
            </h2>
            <p className="text-xs text-zinc-400">
              Every claim unlocks inside your Accounts &amp; Lemon Terminal immediately after Admin approval.
            </p>
          </div>
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
        </div>

        {(data?.myRedemptions || []).length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500">
            No store claims or secret code drops yet. Earn 200 pts or enter a Secret Drop Code above.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.08]">
            {(data?.myRedemptions || []).map((reqItem) => {
              const rStyle = RARITY_STYLES[reqItem.rarityTier];
              return (
                <div
                  key={reqItem.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${rStyle.bg} ${rStyle.border} ${rStyle.text}`}
                      >
                        {rStyle.label}
                      </span>
                      <span className="font-bold text-white text-sm">
                        {reqItem.rewardTitle}
                      </span>
                      {reqItem.issuedAccountNumber && (
                        <span className="font-mono-tabular font-bold text-emerald-400">
                          #{reqItem.issuedAccountNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      {reqItem.source === 'secret_code'
                        ? `Secret Code: ${reqItem.secretCodeUsed}`
                        : `Redeemed ${reqItem.pointsSpent} PTS`}{' '}
                      · {new Date(reqItem.createdAtIso).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {reqItem.status === 'pending_approval' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
                        <Clock className="w-3 h-3" />
                        <span>Pending Admin Approval</span>
                      </span>
                    ) : reqItem.status === 'approved' ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                          <Check className="w-3 h-3" />
                          <span>Approved</span>
                        </span>
                        {reqItem.issuedAccountNumber && onOpenAccountInTerminal && (
                          <button
                            type="button"
                            onClick={onOpenAccountInTerminal}
                            className="px-3 py-1 rounded-full bg-white text-[#09090B] font-bold cursor-pointer"
                          >
                            Trade →
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 font-bold">
                        <XCircle className="w-3 h-3" />
                        <span>Rejected{reqItem.pointsSpent > 0 ? ' (Pts Refunded)' : ''}</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
