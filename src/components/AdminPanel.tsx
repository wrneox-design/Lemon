import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Coins,
  Copy,
  Download,
  FileCheck2,
  Gift,
  Globe,
  KeyRound,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import type {
  AdminBreachedAccountView,
  AdminOverviewData,
  AdminUserAccountView,
  DashboardAccount,
  DashboardPayout,
  PublicUser,
  RewardRarity,
} from '../server/authStore';
import { formatUsd } from '../utils/challenges';

interface AdminPanelProps {
  user: PublicUser;
  accessToken: string;
  onOpenDashboard: () => void;
  onBackToSite: () => void;
}

type AdminTab =
  | 'pending-approvals'
  | 'kyc-approvals'
  | 'task-approvals'
  | 'redemption-approvals'
  | 'breached-accounts'
  | 'payouts'
  | 'secret-codes'
  | 'purchased'
  | 'all-users'
  | 'activity-log';

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function summarizeDevice(ua: string): string {
  if (!ua || ua === 'Unknown device') return 'Unknown device';
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome Browser';
  if (ua.includes('Firefox')) return 'Firefox Browser';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari Browser';
  if (ua.includes('Edg')) return 'Edge Browser';
  return ua.slice(0, 40);
}

const EVENT_LABELS: Record<string, string> = {
  register: 'Sign Up',
  verify_email: 'Email Verified',
  login: 'Sign In',
  purchase_account: 'Purchase / Account',
  log_trade: 'Trade',
  account_breached: 'Account Breached',
  request_payout: 'Payout Request',
  payout_settled: 'Payout Settled',
  reward_task: 'Social Task / Points',
  reward_redeem: 'Store Redeem',
  secret_code: 'Secret Code Roll',
  kyc_verification: 'KYC Verification',
};

const RARITY_STYLES: Record<RewardRarity, string> = {
  MYTHIC: 'bg-[#FFF0F6] text-[#C41D7F] border-[#FFADD2]',
  LEGENDARY: 'bg-[#FFF8EB] text-[#B45309] border-[#F7A600]/45',
  RARE: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
  STORE: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
  BONUS_PTS: 'bg-[#F5F6F8] text-[#121417] border-[#EAECEF]',
  COUPON: 'bg-[#FFF8EB] text-[#B45309] border-[#F7A600]/50',
};

const ACCOUNT_STATUS_OPTIONS: DashboardAccount['status'][] = [
  'Pending Approval',
  'Active Evaluation',
  'Target Passed',
  'Instant Funded',
  'Breached',
];

export function AdminPanel({
  user,
  accessToken,
  onOpenDashboard,
  onBackToSite,
}: AdminPanelProps) {
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('pending-approvals');
  const [searchQuery, setSearchQuery] = useState('');
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [approvingAccountId, setApprovingAccountId] = useState<string | null>(null);
  const [managingAccountId, setManagingAccountId] = useState<string | null>(null);
  const [reviewingTaskId, setReviewingTaskId] = useState<string | null>(null);
  const [reviewingRedeemId, setReviewingRedeemId] = useState<string | null>(null);
  const [reviewingKycId, setReviewingKycId] = useState<string | null>(null);
  const [kycRejectNotes, setKycRejectNotes] = useState<Record<string, string>>({});
  const [userBusyId, setUserBusyId] = useState<string | null>(null);
  const [pointInputs, setPointInputs] = useState<Record<string, string>>({});
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('Proof Screenshot Preview');

  // Secret Code Drop creator state
  const [newCode, setNewCode] = useState('');
  const [newCodeLabel, setNewCodeLabel] = useState('Community Drop');
  const [newCodeMaxUses, setNewCodeMaxUses] = useState('25');
  const [newCodeMythicPct, setNewCodeMythicPct] = useState('20');
  const [codeBusyId, setCodeBusyId] = useState<string | null>(null);

  // 1,000 Giveaway Secret Codes state
  const [giveawayCodesData, setGiveawayCodesData] = useState<{
    total: number;
    claimed: number;
    available: number;
    codes: {
      code: string;
      label: string;
      claimed: boolean;
      claimedBy?: string;
      claimedAtIso?: string;
      rewardTitle?: string;
    }[];
  } | null>(null);
  const [giveawaySearch, setGiveawaySearch] = useState('');
  const [giveawayFilter, setGiveawayFilter] = useState<'all' | 'available' | 'claimed'>('all');
  const [copiedCodesStatus, setCopiedCodesStatus] = useState<string | null>(null);
  const [loadingGiveawayCodes, setLoadingGiveawayCodes] = useState(false);

  const loadGiveawayCodes = useCallback(async () => {
    setLoadingGiveawayCodes(true);
    try {
      const resp = await fetch('/api/admin/giveaway-codes', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (resp.ok) {
        const json = await resp.json();
        setGiveawayCodesData(json);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingGiveawayCodes(false);
    }
  }, [accessToken]);

  const handleCopyAllGiveawayCodes = () => {
    if (!giveawayCodesData?.codes) return;
    const allCodesStr = giveawayCodesData.codes.map((c) => c.code).join('\n');
    navigator.clipboard.writeText(allCodesStr);
    setCopiedCodesStatus('All 1,000 giveaway codes copied to clipboard!');
    setTimeout(() => setCopiedCodesStatus(null), 3000);
  };

  const handleCopySingleCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodesStatus(`Copied ${code}!`);
    setTimeout(() => setCopiedCodesStatus(null), 2500);
  };

  const handleDownloadGiveawayTxt = () => {
    if (!giveawayCodesData?.codes) return;
    const txtContent = giveawayCodesData.codes
      .map(
        (c) =>
          `${c.code} | Status: ${c.claimed ? 'CLAIMED by ' + (c.claimedBy || '') : 'AVAILABLE'}${
            c.rewardTitle ? ' | Reward: ' + c.rewardTitle : ''
          }`
      )
      .join('\n');
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lemonfunding-1000-giveaway-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadGiveawayCsv = () => {
    if (!giveawayCodesData?.codes) return;
    const headers = 'Code,Status,ClaimedBy,RewardWon,ClaimedAt\n';
    const rows = giveawayCodesData.codes
      .map(
        (c) =>
          `"${c.code}","${c.claimed ? 'CLAIMED' : 'AVAILABLE'}","${c.claimedBy || ''}","${
            c.rewardTitle || ''
          }","${c.claimedAtIso || ''}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lemonfunding-1000-giveaway-codes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const resp = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Could not load owner admin records.');
        return;
      }
      setOverview(data as AdminOverviewData);
    } catch {
      setErrorMsg('Network error loading owner admin overview.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadOverview();
    loadGiveawayCodes();
  }, [loadOverview, loadGiveawayCodes]);

  const handleSettlePayout = async (payoutId: string) => {
    setSettlingId(payoutId);
    setActionMsg('');
    setErrorMsg('');
    try {
      const resp = await fetch(`/api/admin/payouts/${encodeURIComponent(payoutId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: 'Settled' }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Could not settle payout.');
        return;
      }
      setActionMsg('Payout marked Settled.');
      await loadOverview();
    } finally {
      setSettlingId(null);
    }
  };

  const handleAccountApproval = async (accountId: string, action: 'approve' | 'reject') => {
    setApprovingAccountId(accountId);
    setActionMsg('');
    setErrorMsg('');
    try {
      const resp = await fetch(`/api/admin/accounts/${encodeURIComponent(accountId)}/approval`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Could not update account approval.');
        return;
      }
      setActionMsg(
        action === 'approve'
          ? 'Challenge payment approved and trading credentials unlocked!'
          : 'Challenge payment rejected.'
      );
      await loadOverview();
    } finally {
      setApprovingAccountId(null);
    }
  };

  const handleManageAccount = async (
    accountId: string,
    payload: { status?: DashboardAccount['status']; resetEquity?: boolean }
  ) => {
    setManagingAccountId(accountId);
    setActionMsg('');
    setErrorMsg('');
    try {
      const resp = await fetch(`/api/admin/accounts/${encodeURIComponent(accountId)}/manage`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Could not update challenge account.');
        return;
      }
      setActionMsg(
        payload.resetEquity
          ? `Reset equity on #${data.account.accountNumber} (${data.account.status}).`
          : `Updated #${data.account.accountNumber} status to ${data.account.status}.`
      );
      await loadOverview();
    } finally {
      setManagingAccountId(null);
    }
  };

  const handleAdjustPoints = async (targetUserId: string, delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) {
      setErrorMsg('Enter a non-zero points amount (e.g. 100 or -50).');
      return;
    }
    setUserBusyId(targetUserId);
    setActionMsg('');
    setErrorMsg('');
    try {
      const resp = await fetch(`/api/admin/users/${encodeURIComponent(targetUserId)}/points`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          delta,
          reason: delta > 0 ? 'Admin points bonus' : 'Admin points adjustment',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Could not adjust reward points.');
        return;
      }
      setActionMsg(
        `Updated @${data.user.loginId} reward balance to ${data.user.rewardPoints} pts.`
      );
      setPointInputs((prev) => ({ ...prev, [targetUserId]: '' }));
      await loadOverview();
    } finally {
      setUserBusyId(null);
    }
  };

  const handleVerifyUserEmail = async (targetUserId: string) => {
    setUserBusyId(targetUserId);
    setActionMsg('');
    setErrorMsg('');
    try {
      const resp = await fetch(`/api/admin/users/${encodeURIComponent(targetUserId)}/verify-email`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Could not verify trader email.');
        return;
      }
      setActionMsg(`Verified email for @${data.user.loginId} (${data.user.email}).`);
      await loadOverview();
    } finally {
      setUserBusyId(null);
    }
  };

  const handleTaskReview = async (submissionId: string, action: 'approve' | 'reject') => {
    setReviewingTaskId(submissionId);
    setActionMsg('');
    setErrorMsg('');
    try {
      const resp = await fetch(`/api/admin/tasks/${encodeURIComponent(submissionId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Could not review social task proof.');
        return;
      }
      setActionMsg(
        action === 'approve'
          ? `Approved task proof (+${data.submission?.pointsReward ?? 100} pts credited).`
          : 'Task submission rejected.'
      );
      await loadOverview();
    } finally {
      setReviewingTaskId(null);
    }
  };

  const handleRedemptionReview = async (redemptionId: string, action: 'approve' | 'reject') => {
    setReviewingRedeemId(redemptionId);
    setActionMsg('');
    setErrorMsg('');
    try {
      const resp = await fetch(`/api/admin/redemptions/${encodeURIComponent(redemptionId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Could not review redemption claim.');
        return;
      }
      setActionMsg(
        action === 'approve'
          ? data.issuedAccount
            ? `Approved! Issued account #${data.issuedAccount.accountNumber}.`
            : 'Redemption approved and credited.'
          : 'Claim rejected (points refunded if spent).'
      );
      await loadOverview();
    } finally {
      setReviewingRedeemId(null);
    }
  };

  const handleKycReview = async (kycId: string, action: 'approve' | 'reject') => {
    setReviewingKycId(kycId);
    setActionMsg('');
    setErrorMsg('');
    try {
      const adminNote = (kycRejectNotes[kycId] || '').trim();
      const resp = await fetch(`/api/admin/kyc/${encodeURIComponent(kycId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action,
          adminNote: action === 'reject' && adminNote ? adminNote : undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Could not update KYC verification.');
        return;
      }
      const traderEmail = data.submission?.userEmail || data.user?.email || 'trader';
      setActionMsg(
        action === 'approve'
          ? `KYC approved for ${traderEmail} — live trading unlocked!`
          : `KYC rejected for ${traderEmail}.`
      );
      setKycRejectNotes((prev) => ({ ...prev, [kycId]: '' }));
      await loadOverview();
    } finally {
      setReviewingKycId(null);
    }
  };

  const handleCreateSecretCode = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setActionMsg('');
    if (!newCode.trim()) {
      setErrorMsg('Enter a secret drop code (e.g. LEMONMYTHIC).');
      return;
    }
    setCodeBusyId('creating');
    try {
      const resp = await fetch('/api/admin/secret-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          code: newCode.trim().toUpperCase(),
          label: newCodeLabel.trim() || 'Community Drop',
          maxUses: Number(newCodeMaxUses) || 25,
          mythicChancePct: Number(newCodeMythicPct) || 20,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Could not create secret code.');
        return;
      }
      setActionMsg(`Secret code ${data.drop.code} dropped live!`);
      setNewCode('');
      await loadOverview();
    } finally {
      setCodeBusyId(null);
    }
  };

  const handleToggleSecretCode = async (codeId: string, currentActive: boolean) => {
    setCodeBusyId(codeId);
    setActionMsg('');
    try {
      const resp = await fetch(`/api/admin/secret-codes/${encodeURIComponent(codeId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ active: !currentActive }),
      });
      if (resp.ok) {
        await loadOverview();
      }
    } finally {
      setCodeBusyId(null);
    }
  };

  const handleDeleteSecretCode = async (codeId: string) => {
    setCodeBusyId(codeId);
    setActionMsg('');
    try {
      const resp = await fetch(`/api/admin/secret-codes/${encodeURIComponent(codeId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (resp.ok) {
        setActionMsg('Secret code drop deleted.');
        await loadOverview();
      }
    } finally {
      setCodeBusyId(null);
    }
  };

  const pendingAccounts = useMemo(() => {
    if (!overview) return [];
    const list: {
      userId: string;
      userName: string;
      userEmail: string;
      loginId: string;
      account: AdminUserAccountView;
    }[] = [];
    for (const u of overview.users) {
      for (const a of u.accounts) {
        if (a.status === 'Pending Approval' || a.paymentStatus === 'pending_approval') {
          list.push({
            userId: u.id,
            userName: u.fullName,
            userEmail: u.email,
            loginId: u.loginId,
            account: a,
          });
        }
      }
    }
    return list;
  }, [overview]);

  const allAccountsFlat = useMemo(() => {
    if (!overview) return [];
    const q = searchQuery.trim().toLowerCase();
    const rows: {
      userId: string;
      userName: string;
      userEmail: string;
      loginId: string;
      account: AdminUserAccountView;
    }[] = [];
    for (const u of overview.users) {
      for (const a of u.accounts) {
        const matches =
          !q ||
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.loginId.toLowerCase().includes(q) ||
          a.accountNumber.toLowerCase().includes(q) ||
          a.modeLabel.toLowerCase().includes(q) ||
          (a.paymentMethod || '').toLowerCase().includes(q) ||
          a.status.toLowerCase().includes(q) ||
          a.purchaseIp.toLowerCase().includes(q);
        if (matches) {
          rows.push({
            userId: u.id,
            userName: u.fullName,
            userEmail: u.email,
            loginId: u.loginId,
            account: a,
          });
        }
      }
    }
    return rows.sort((a, b) => b.account.createdAtIso.localeCompare(a.account.createdAtIso));
  }, [overview, searchQuery]);

  const allPayoutsFlat = useMemo(() => {
    if (!overview) return [];
    const q = searchQuery.trim().toLowerCase();
    const list: (DashboardPayout & { userEmail: string; userName: string; loginId: string })[] = [];
    for (const u of overview.users) {
      for (const p of u.payouts) {
        const matches =
          !q ||
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.loginId.toLowerCase().includes(q) ||
          p.accountNumber.toLowerCase().includes(q) ||
          p.method.toLowerCase().includes(q) ||
          p.status.toLowerCase().includes(q);
        if (matches) {
          list.push({ ...p, loginId: u.loginId });
        }
      }
    }
    return list.sort((a, b) => {
      if (a.status === 'Processing' && b.status !== 'Processing') return -1;
      if (a.status !== 'Processing' && b.status === 'Processing') return 1;
      return b.requestedAtIso.localeCompare(a.requestedAtIso);
    });
  }, [overview, searchQuery]);

  const filteredTasks = useMemo(() => {
    if (!overview?.taskSubmissions) return [];
    const q = searchQuery.trim().toLowerCase();
    return overview.taskSubmissions.filter((t) => {
      if (!q) return true;
      return (
        t.userName.toLowerCase().includes(q) ||
        t.userEmail.toLowerCase().includes(q) ||
        t.loginId.toLowerCase().includes(q) ||
        t.handle.toLowerCase().includes(q) ||
        t.taskLabel.toLowerCase().includes(q) ||
        t.submissionIp.toLowerCase().includes(q)
      );
    });
  }, [overview, searchQuery]);

  const filteredRedemptions = useMemo(() => {
    if (!overview?.redemptionRequests) return [];
    const q = searchQuery.trim().toLowerCase();
    return overview.redemptionRequests.filter((r) => {
      if (!q) return true;
      return (
        r.userName.toLowerCase().includes(q) ||
        r.userEmail.toLowerCase().includes(q) ||
        r.loginId.toLowerCase().includes(q) ||
        r.rewardTitle.toLowerCase().includes(q) ||
        r.rarityTier.toLowerCase().includes(q) ||
        (r.secretCodeUsed || '').toLowerCase().includes(q) ||
        r.requestIp.toLowerCase().includes(q)
      );
    });
  }, [overview, searchQuery]);

  const filteredBreachedAccounts = useMemo<AdminBreachedAccountView[]>(() => {
    if (!overview?.breachedAccounts) return [];
    const q = searchQuery.trim().toLowerCase();
    return overview.breachedAccounts.filter((b) => {
      if (!q) return true;
      return (
        b.userName.toLowerCase().includes(q) ||
        b.userEmail.toLowerCase().includes(q) ||
        b.loginId.toLowerCase().includes(q) ||
        b.accountNumber.toLowerCase().includes(q) ||
        b.breachReason.toLowerCase().includes(q) ||
        b.lastIp.toLowerCase().includes(q)
      );
    });
  }, [overview, searchQuery]);

  const filteredGiveawayCodes = useMemo(() => {
    if (!giveawayCodesData?.codes) return [];
    const q = giveawaySearch.trim().toLowerCase();
    return giveawayCodesData.codes.filter((c) => {
      if (giveawayFilter === 'available' && c.claimed) return false;
      if (giveawayFilter === 'claimed' && !c.claimed) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        (c.claimedBy || '').toLowerCase().includes(q) ||
        (c.rewardTitle || '').toLowerCase().includes(q)
      );
    });
  }, [giveawayCodesData, giveawaySearch, giveawayFilter]);

  const filteredKyc = useMemo(() => {
    if (!overview?.kycRequests) return [];
    const q = searchQuery.trim().toLowerCase();
    return overview.kycRequests
      .filter((k) => {
        if (!q) return true;
        return (
          k.userName.toLowerCase().includes(q) ||
          k.userEmail.toLowerCase().includes(q) ||
          k.loginId.toLowerCase().includes(q) ||
          (k.panNumber || '').toLowerCase().includes(q) ||
          (k.aadhaarNumber || '').toLowerCase().includes(q) ||
          k.submissionIp.toLowerCase().includes(q) ||
          k.status.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return b.submittedAtIso.localeCompare(a.submittedAtIso);
      });
  }, [overview, searchQuery]);

  const filteredUsers = useMemo(() => {
    if (!overview) return [];
    const q = searchQuery.trim().toLowerCase();
    return overview.users.filter((u) => {
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.loginId.toLowerCase().includes(q) ||
        u.lastIp.toLowerCase().includes(q) ||
        u.signupIp.toLowerCase().includes(q) ||
        u.ipHistory.some((ip) => ip.toLowerCase().includes(q)) ||
        u.accounts.some(
          (a) =>
            a.accountNumber.toLowerCase().includes(q) ||
            a.modeLabel.toLowerCase().includes(q)
        )
      );
    });
  }, [overview, searchQuery]);

  const filteredLogs = useMemo(() => {
    if (!overview) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return overview.activityLogs;
    return overview.activityLogs.filter(
      (log) =>
        log.userEmail.toLowerCase().includes(q) ||
        log.userName.toLowerCase().includes(q) ||
        log.loginId.toLowerCase().includes(q) ||
        log.ip.toLowerCase().includes(q) ||
        log.summary.toLowerCase().includes(q)
    );
  }, [overview, searchQuery]);

  return (
    <section
      id="admin-overview"
      data-testid="admin-panel"
      className="py-8 sm:py-10 bg-[#F7F8FA] min-h-screen text-[#121417]"
    >
      <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Owner Header Strip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white rounded-2xl border border-[#EAECEF] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#00B574]">
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Private Owner Admin Console</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#121417]">{user.email}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#121417] mt-1">
              Full Platform Management &amp; Owner Approvals
            </h1>
            <p className="text-xs sm:text-sm text-[#717882] mt-1">
              Private to Owner ({user.email}). Manage BNB purchases, X/Instagram follow proofs, Reward Store &amp; Secret Code claims, Payouts, Accounts, Points, and Traders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadOverview}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#F7A600] hover:bg-[#E59700] disabled:opacity-60 text-[#121417] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{loading ? 'Refreshing...' : 'Refresh All Data'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenDashboard}
              className="px-4 py-2 rounded-full bg-[#121417] hover:bg-[#23272E] text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              Trader Desk
            </button>

            <button
              type="button"
              onClick={onBackToSite}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#F5F6F8] hover:bg-[#EAECEF] text-[#121417] text-xs font-semibold border border-[#EAECEF] transition-colors cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Home</span>
            </button>
          </div>
        </motion.div>

        {errorMsg && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-semibold text-[#B91C1C]"
          >
            {errorMsg}
          </div>
        )}

        {actionMsg && (
          <div
            role="status"
            className="p-3.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-xs font-semibold text-[#047857] flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-[#00B574]" />
            <span>{actionMsg}</span>
          </div>
        )}

        {overview && (
          <>
            {/* Quick Pending Queue Alert Strip */}
            {(pendingAccounts.length > 0 ||
              overview.stats.pendingKycCount > 0 ||
              overview.stats.pendingTaskCount > 0 ||
              overview.stats.pendingRedemptionCount > 0 ||
              overview.stats.processingPayoutCount > 0) && (
              <div className="rounded-2xl bg-[#FFF8EB] border border-[#F7A600]/45 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#92400E]">
                  <Sparkles className="w-4 h-4 text-[#F7A600] shrink-0" />
                  <span>Owner Action Needed:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {overview.stats.pendingKycCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('kyc-approvals')}
                      className="px-3 py-1.5 rounded-full bg-[#121417] text-[#F7A600] font-bold cursor-pointer"
                    >
                      {overview.stats.pendingKycCount} KYC Request{overview.stats.pendingKycCount > 1 ? 's' : ''}
                    </button>
                  )}
                  {pendingAccounts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('pending-approvals')}
                      className="px-3 py-1.5 rounded-full bg-[#121417] text-[#F7A600] font-bold cursor-pointer"
                    >
                      {pendingAccounts.length} BNB Purchase{pendingAccounts.length > 1 ? 's' : ''}
                    </button>
                  )}
                  {overview.stats.pendingTaskCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('task-approvals')}
                      className="px-3 py-1.5 rounded-full bg-white border border-[#F7A600]/40 text-[#121417] font-bold cursor-pointer"
                    >
                      {overview.stats.pendingTaskCount} Task Proof{overview.stats.pendingTaskCount > 1 ? 's' : ''}
                    </button>
                  )}
                  {overview.stats.pendingRedemptionCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('redemption-approvals')}
                      className="px-3 py-1.5 rounded-full bg-white border border-[#F7A600]/40 text-[#121417] font-bold cursor-pointer"
                    >
                      {overview.stats.pendingRedemptionCount} Reward Claim{overview.stats.pendingRedemptionCount > 1 ? 's' : ''}
                    </button>
                  )}
                  {overview.stats.processingPayoutCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('payouts')}
                      className="px-3 py-1.5 rounded-full bg-[#00B574] text-white font-bold cursor-pointer"
                    >
                      {overview.stats.processingPayoutCount} Payout Request{overview.stats.processingPayoutCount > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Owner KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#717882] font-medium">Total Traders</p>
                  <Users className="w-4 h-4 text-[#00B574]" />
                </div>
                <p data-testid="admin-total-users" className="font-mono-tabular text-2xl font-extrabold text-[#121417] mt-1">
                  {overview.stats.totalUsers}
                </p>
                <p className="text-[11px] text-[#717882] mt-1">
                  {overview.stats.verifiedUsers} verified · {overview.stats.pendingKycCount ?? 0} KYC pending
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#717882] font-medium">Purchased Accounts</p>
                  <Wallet className="w-4 h-4 text-[#F7A600]" />
                </div>
                <p className="font-mono-tabular text-2xl font-extrabold text-[#121417] mt-1">
                  {overview.stats.totalAccounts}
                </p>
                <p className="text-[11px] text-[#717882] mt-1">
                  {pendingAccounts.length} pending · {overview.stats.activeOrFundedAccounts} active
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#717882] font-medium">Rewards &amp; Tasks</p>
                  <Gift className="w-4 h-4 text-[#F7A600]" />
                </div>
                <p className="font-mono-tabular text-2xl font-extrabold text-[#121417] mt-1">
                  {overview.taskSubmissions.length + overview.redemptionRequests.length}
                </p>
                <p className="text-[11px] text-[#717882] mt-1">
                  {overview.stats.pendingTaskCount} tasks · {overview.stats.pendingRedemptionCount} claims pending
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#717882] font-medium">Fee Volume &amp; Payouts</p>
                  <BadgeCheck className="w-4 h-4 text-[#00B574]" />
                </div>
                <p data-testid="admin-total-revenue" className="font-mono-tabular text-2xl font-extrabold text-[#00B574] mt-1">
                  {formatUsd(overview.stats.totalRevenueUsd)}
                </p>
                <p className="text-[11px] text-[#717882] mt-1">
                  Payouts: {formatUsd(overview.stats.totalPayoutsUsd)} ({overview.stats.processingPayoutCount} pending)
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5 col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#717882] font-medium">Unique IPs</p>
                  <Globe className="w-4 h-4 text-[#121417]" />
                </div>
                <p data-testid="admin-unique-ips" className="font-mono-tabular text-2xl font-extrabold text-[#121417] mt-1">
                  {overview.stats.uniqueIpCount}
                </p>
                <p className="text-[11px] text-[#717882] mt-1">
                  {overview.activityLogs.length} audit events
                </p>
              </div>
            </div>

            {/* Navigation Tabs + Search */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white rounded-2xl border border-[#EAECEF] p-3.5">
              <div
                role="tablist"
                aria-label="Admin views"
                className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0"
              >
                {[
                  {
                    id: 'pending-approvals' as AdminTab,
                    label: `BNB Payments (${pendingAccounts.length})`,
                  },
                  {
                    id: 'kyc-approvals' as AdminTab,
                    label: `KYC Requests (${overview.kycRequests?.length ?? 0})`,
                  },
                  {
                    id: 'task-approvals' as AdminTab,
                    label: `Reward Tasks (${overview.taskSubmissions.length})`,
                  },
                  {
                    id: 'redemption-approvals' as AdminTab,
                    label: `Redeems & Mythic (${overview.redemptionRequests.length})`,
                  },
                  {
                    id: 'purchased' as AdminTab,
                    label: `All Accounts (${overview.stats.totalAccounts})`,
                  },
                  {
                    id: 'breached-accounts' as AdminTab,
                    label: `Breached Accounts (${overview.breachedAccounts?.length ?? 0})`,
                  },
                  {
                    id: 'payouts' as AdminTab,
                    label: `Payouts (${allPayoutsFlat.length})`,
                  },
                  {
                    id: 'secret-codes' as AdminTab,
                    label: `Secret Codes (${overview.secretCodes?.length ?? 0})`,
                  },
                  {
                    id: 'all-users' as AdminTab,
                    label: `All Traders (${overview.users.length})`,
                  },
                  {
                    id: 'activity-log' as AdminTab,
                    label: `Activity Logs (${overview.activityLogs.length})`,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3.5 py-2 rounded-full text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      activeTab === tab.id
                        ? 'bg-[#121417] text-white'
                        : 'bg-[#F5F6F8] text-[#717882] hover:text-[#121417]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full lg:w-72 shrink-0">
                <Search className="w-4 h-4 text-[#717882] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  aria-label="Search traders, emails, accounts, IPs, codes"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search user, account #, IP, code..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-full bg-[#F5F6F8] border border-[#EAECEF] text-xs text-[#121417] focus:outline-none focus:border-[#121417]"
                />
              </div>
            </div>

            {/* TAB 1: PENDING BNB PAYMENT APPROVALS */}
            {activeTab === 'pending-approvals' && (
              <div className="space-y-4">
                {pendingAccounts.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-[#EAECEF] p-10 text-center text-sm text-[#717882]">
                    <CheckCircle2 className="w-8 h-8 text-[#00B574] mx-auto mb-2" />
                    <p className="font-bold text-[#121417]">No pending BNB payment approvals</p>
                    <p className="text-xs mt-1">
                      All challenge purchases have been reviewed. See full history inside{' '}
                      <button
                        type="button"
                        onClick={() => setActiveTab('purchased')}
                        className="text-[#F7A600] font-bold hover:underline cursor-pointer"
                      >
                        All Accounts ({overview.stats.totalAccounts})
                      </button>
                      .
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {pendingAccounts.map((item) => (
                      <div
                        key={item.account.id}
                        className="bg-white rounded-2xl border border-[#F7A600]/45 p-5 shadow-xs space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#EAECEF]">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono-tabular font-extrabold text-base text-[#121417]">
                                {item.account.accountNumber}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full bg-[#FFF8EB] text-[#B45309] border border-[#F7A600]/30 text-xs font-bold">
                                Pending BNB Approval
                              </span>
                            </div>
                            <p className="text-xs text-[#717882] mt-1">
                              Trader: <strong className="text-[#121417]">{item.userName}</strong> ({item.userEmail} · @{item.loginId})
                            </p>
                          </div>
                          <div className="text-left sm:text-right">
                            <span className="font-mono-tabular text-lg font-extrabold text-[#00B574] block">
                              {formatUsd(item.account.feePaidUsd)}
                            </span>
                            <span className="text-[11px] text-[#717882]">
                              Method: {item.account.paymentMethod || 'Crypto (BNB BEP20)'}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                          <div className="bg-[#F7F8FA] border border-[#EAECEF] p-3.5 rounded-xl space-y-1">
                            <span className="text-[11px] text-[#717882] block">Challenge Details</span>
                            <div className="font-bold text-[#121417]">
                              {item.account.modeLabel} · {formatUsd(item.account.accountSize)}
                            </div>
                            <div className="text-[#00B574] font-semibold">
                              {item.account.profitSplitPct}% Profit Split · {item.account.platform}
                            </div>
                          </div>

                          <div className="bg-[#F7F8FA] border border-[#EAECEF] p-3.5 rounded-xl space-y-1">
                            <span className="text-[11px] text-[#717882] block">Purchase IP &amp; Timestamp</span>
                            <div className="font-mono-tabular font-semibold text-[#121417]">
                              {item.account.purchaseIp}
                            </div>
                            <div className="text-[#717882]">{formatTimestamp(item.account.createdAtIso)}</div>
                          </div>

                          <div className="bg-[#F7F8FA] border border-[#EAECEF] p-3.5 rounded-xl flex items-center justify-between gap-3">
                            <div>
                              <span className="text-[11px] text-[#717882] block">Payment Proof Screenshot</span>
                              {item.account.paymentProofUrl ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewTitle(`BNB Payment Proof · ${item.account.accountNumber}`);
                                    setPreviewProofUrl(item.account.paymentProofUrl || null);
                                  }}
                                  className="text-xs text-[#F7A600] hover:underline font-bold mt-1 cursor-pointer"
                                >
                                  View Screenshot ↗
                                </button>
                              ) : (
                                <span className="text-xs text-[#B45309] italic">No receipt attached</span>
                              )}
                            </div>
                            {item.account.paymentProofUrl && (
                              <img
                                src={item.account.paymentProofUrl}
                                alt="Payment Proof"
                                onClick={() => {
                                  setPreviewTitle(`BNB Payment Proof · ${item.account.accountNumber}`);
                                  setPreviewProofUrl(item.account.paymentProofUrl || null);
                                }}
                                className="w-14 h-14 object-cover rounded-lg border border-[#EAECEF] cursor-pointer hover:opacity-90"
                              />
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#EAECEF]">
                          <button
                            type="button"
                            disabled={approvingAccountId === item.account.id}
                            onClick={() => handleAccountApproval(item.account.id, 'reject')}
                            className="px-4 py-2 rounded-full bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            disabled={approvingAccountId === item.account.id}
                            onClick={() => handleAccountApproval(item.account.id, 'approve')}
                            className="px-5 py-2 rounded-full bg-[#00B574] hover:bg-[#009963] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              {approvingAccountId === item.account.id
                                ? 'Activating...'
                                : 'Approve & Activate Account'}
                            </span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 1B: TRADER KYC REQUESTS (PAN + AADHAAR FRONT & BACK) */}
            {activeTab === 'kyc-approvals' && (
              <div className="space-y-4">
                {filteredKyc.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-[#EAECEF] p-10 text-center text-sm text-[#717882]">
                    <FileCheck2 className="w-8 h-8 text-[#F7A600] mx-auto mb-2" />
                    <p className="font-bold text-[#121417]">No KYC verification requests yet</p>
                    <p className="text-xs mt-1">
                      When traders select PAN Card + Aadhaar Card and submit all 3 document screenshots, they appear here for review before trading unlocks.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredKyc.map((kyc) => (
                      <div
                        key={kyc.id}
                        className={`bg-white rounded-2xl border p-5 space-y-4 ${
                          kyc.status === 'pending' ? 'border-[#F7A600]/45' : 'border-[#EAECEF]'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EAECEF]">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-display font-bold text-base text-[#121417]">
                                {kyc.userName}
                              </span>
                              <span className="font-mono-tabular text-xs font-semibold text-[#717882]">
                                @{kyc.loginId}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                  kyc.status === 'approved'
                                    ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]'
                                    : kyc.status === 'rejected'
                                      ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                                      : 'bg-[#FFF8EB] text-[#B45309] border-[#F7A600]/30'
                                }`}
                              >
                                {kyc.status === 'pending'
                                  ? 'Pending Review'
                                  : kyc.status === 'approved'
                                    ? 'KYC Approved'
                                    : 'Rejected'}
                              </span>
                            </div>
                            <p className="text-xs text-[#717882] mt-1">
                              {kyc.userEmail} · Documents: {kyc.documentsSelected.join(' + ')}
                            </p>
                          </div>

                          <div className="text-left sm:text-right text-xs">
                            <span className="font-mono-tabular font-semibold text-[#121417] block">
                              IP: {kyc.submissionIp}
                            </span>
                            <span className="text-[#717882]">
                              Submitted {formatTimestamp(kyc.submittedAtIso)}
                            </span>
                          </div>
                        </div>

                        {(kyc.panNumber || kyc.aadhaarNumber || kyc.adminNote) && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div className="bg-[#F7F8FA] border border-[#EAECEF] rounded-xl p-3">
                              <span className="text-[11px] text-[#717882] block">PAN Number</span>
                              <strong className="font-mono-tabular text-[#121417]">
                                {kyc.panNumber || 'Not entered'}
                              </strong>
                            </div>
                            <div className="bg-[#F7F8FA] border border-[#EAECEF] rounded-xl p-3">
                              <span className="text-[11px] text-[#717882] block">Aadhaar Number</span>
                              <strong className="font-mono-tabular text-[#121417]">
                                {kyc.aadhaarNumber || 'Not entered'}
                              </strong>
                            </div>
                            <div className="bg-[#F7F8FA] border border-[#EAECEF] rounded-xl p-3">
                              <span className="text-[11px] text-[#717882] block">Admin Note</span>
                              <strong className="text-[#121417]">
                                {kyc.adminNote || 'Ready for review'}
                              </strong>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div className="bg-[#F7F8FA] border border-[#EAECEF] rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#121417]">PAN Card</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewTitle(`PAN Card · ${kyc.userName} (@${kyc.loginId})`);
                                  setPreviewProofUrl(kyc.panImageUrl);
                                }}
                                className="text-[11px] font-bold text-[#F7A600] hover:underline cursor-pointer"
                              >
                                Fullscreen ↗
                              </button>
                            </div>
                            <img
                              src={kyc.panImageUrl}
                              alt="PAN Card Screenshot"
                              onClick={() => {
                                setPreviewTitle(`PAN Card · ${kyc.userName} (@${kyc.loginId})`);
                                setPreviewProofUrl(kyc.panImageUrl);
                              }}
                              className="w-full h-36 object-cover rounded-lg border border-[#EAECEF] cursor-pointer hover:opacity-90 bg-white"
                            />
                          </div>

                          <div className="bg-[#F7F8FA] border border-[#EAECEF] rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#121417]">Aadhaar Front</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewTitle(`Aadhaar Front · ${kyc.userName} (@${kyc.loginId})`);
                                  setPreviewProofUrl(kyc.aadhaarFrontImageUrl);
                                }}
                                className="text-[11px] font-bold text-[#F7A600] hover:underline cursor-pointer"
                              >
                                Fullscreen ↗
                              </button>
                            </div>
                            <img
                              src={kyc.aadhaarFrontImageUrl}
                              alt="Aadhaar Front Screenshot"
                              onClick={() => {
                                setPreviewTitle(`Aadhaar Front · ${kyc.userName} (@${kyc.loginId})`);
                                setPreviewProofUrl(kyc.aadhaarFrontImageUrl);
                              }}
                              className="w-full h-36 object-cover rounded-lg border border-[#EAECEF] cursor-pointer hover:opacity-90 bg-white"
                            />
                          </div>

                          <div className="bg-[#F7F8FA] border border-[#EAECEF] rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#121417]">Aadhaar Back</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewTitle(`Aadhaar Back · ${kyc.userName} (@${kyc.loginId})`);
                                  setPreviewProofUrl(kyc.aadhaarBackImageUrl);
                                }}
                                className="text-[11px] font-bold text-[#F7A600] hover:underline cursor-pointer"
                              >
                                Fullscreen ↗
                              </button>
                            </div>
                            <img
                              src={kyc.aadhaarBackImageUrl}
                              alt="Aadhaar Back Screenshot"
                              onClick={() => {
                                setPreviewTitle(`Aadhaar Back · ${kyc.userName} (@${kyc.loginId})`);
                                setPreviewProofUrl(kyc.aadhaarBackImageUrl);
                              }}
                              className="w-full h-36 object-cover rounded-lg border border-[#EAECEF] cursor-pointer hover:opacity-90 bg-white"
                            />
                          </div>
                        </div>

                        {kyc.status === 'pending' && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#EAECEF]">
                            <input
                              type="text"
                              value={kycRejectNotes[kyc.id] || ''}
                              onChange={(e) =>
                                setKycRejectNotes((prev) => ({ ...prev, [kyc.id]: e.target.value }))
                              }
                              placeholder="Optional rejection reason (e.g. Aadhaar back blurry)..."
                              className="flex-1 px-3.5 py-2 rounded-full bg-[#F5F6F8] border border-[#EAECEF] text-xs text-[#121417]"
                            />
                            <div className="flex items-center justify-end gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={reviewingKycId === kyc.id}
                                onClick={() => handleKycReview(kyc.id, 'reject')}
                                className="px-4 py-2 rounded-full bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] text-xs font-bold cursor-pointer disabled:opacity-60 inline-flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject KYC</span>
                              </button>
                              <button
                                type="button"
                                disabled={reviewingKycId === kyc.id}
                                onClick={() => handleKycReview(kyc.id, 'approve')}
                                className="px-5 py-2 rounded-full bg-[#00B574] hover:bg-[#009963] text-white text-xs font-bold cursor-pointer disabled:opacity-60 inline-flex items-center gap-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>
                                  {reviewingKycId === kyc.id
                                    ? 'Updating...'
                                    : 'Approve KYC & Unlock Trading'}
                                </span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SOCIAL TASK FOLLOW PROOFS (X & INSTAGRAM) */}
            {activeTab === 'task-approvals' && (
              <div className="space-y-4">
                {filteredTasks.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-[#EAECEF] p-10 text-center text-sm text-[#717882]">
                    <Gift className="w-8 h-8 text-[#F7A600] mx-auto mb-2" />
                    <p className="font-bold text-[#121417]">No social task proofs submitted yet</p>
                    <p className="text-xs mt-1">
                      When traders submit X (@LemonPropFund) or Instagram (@lemonfunding) follow proofs, inspect screenshots and approve +100 pts here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredTasks.map((sub) => (
                      <div
                        key={sub.id}
                        className={`bg-white rounded-2xl border p-5 space-y-4 ${
                          sub.status === 'pending' ? 'border-[#F7A600]/45' : 'border-[#EAECEF]'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EAECEF]">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-[#121417]">{sub.taskLabel}</span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                  sub.status === 'approved'
                                    ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]'
                                    : sub.status === 'rejected'
                                      ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                                      : 'bg-[#FFF8EB] text-[#B45309] border-[#F7A600]/30'
                                }`}
                              >
                                {sub.status === 'pending' ? 'Pending Review' : sub.status}
                              </span>
                            </div>
                            <p className="text-xs text-[#717882] mt-1">
                              Trader: <strong className="text-[#121417]">{sub.userName}</strong> ({sub.userEmail} · @{sub.loginId})
                            </p>
                          </div>
                          <div className="text-left sm:text-right">
                            <span className="font-mono-tabular text-base font-extrabold text-[#00B574]">
                              +{sub.pointsReward} PTS
                            </span>
                            <span className="block text-[11px] text-[#717882]">
                              Submitted {formatTimestamp(sub.submittedAtIso)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div className="bg-[#F7F8FA] border border-[#EAECEF] rounded-xl p-3">
                            <span className="text-[11px] text-[#717882] block">Submitted Social Handle</span>
                            <strong className="font-mono-tabular text-sm text-[#121417]">
                              {sub.handle}
                            </strong>
                          </div>
                          <div className="bg-[#F7F8FA] border border-[#EAECEF] rounded-xl p-3">
                            <span className="text-[11px] text-[#717882] block">Submission IP</span>
                            <strong className="font-mono-tabular text-[#121417]">
                              {sub.submissionIp}
                            </strong>
                          </div>
                          <div className="bg-[#F7F8FA] border border-[#EAECEF] rounded-xl p-3 flex items-center justify-between gap-3">
                            <div>
                              <span className="text-[11px] text-[#717882] block">Follow Proof Screenshot</span>
                              {sub.proofImageUrl ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewTitle(`${sub.taskLabel} · @${sub.loginId}`);
                                    setPreviewProofUrl(sub.proofImageUrl);
                                  }}
                                  className="text-xs font-bold text-[#F7A600] hover:underline mt-0.5 cursor-pointer"
                                >
                                  Inspect Full Proof ↗
                                </button>
                              ) : (
                                <span className="text-xs text-[#717882]">No screenshot</span>
                              )}
                            </div>
                            {sub.proofImageUrl && (
                              <img
                                src={sub.proofImageUrl}
                                alt="Follow Proof"
                                onClick={() => {
                                  setPreviewTitle(`${sub.taskLabel} · @${sub.loginId}`);
                                  setPreviewProofUrl(sub.proofImageUrl);
                                }}
                                className="w-12 h-12 rounded-lg object-cover border border-[#EAECEF] cursor-pointer"
                              />
                            )}
                          </div>
                        </div>

                        {sub.status === 'pending' && (
                          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#EAECEF]">
                            <button
                              type="button"
                              disabled={reviewingTaskId === sub.id}
                              onClick={() => handleTaskReview(sub.id, 'reject')}
                              className="px-4 py-2 rounded-full bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] text-xs font-bold cursor-pointer disabled:opacity-60 inline-flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                            <button
                              type="button"
                              disabled={reviewingTaskId === sub.id}
                              onClick={() => handleTaskReview(sub.id, 'approve')}
                              className="px-5 py-2 rounded-full bg-[#00B574] hover:bg-[#009963] text-white text-xs font-bold cursor-pointer disabled:opacity-60 inline-flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>
                                {reviewingTaskId === sub.id
                                  ? 'Reviewing...'
                                  : `Approve (+${sub.pointsReward} pts)`}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: REDEEM STORE & SECRET CODE MYTHIC CLAIMS */}
            {activeTab === 'redemption-approvals' && (
              <div className="space-y-4">
                {filteredRedemptions.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-[#EAECEF] p-10 text-center text-sm text-[#717882]">
                    <Sparkles className="w-8 h-8 text-[#F7A600] mx-auto mb-2" />
                    <p className="font-bold text-[#121417]">No store redeems or mythic code rolls yet</p>
                    <p className="text-xs mt-1">
                      Redeem Store claims (5 models) and Secret Code luck drops will appear here with full trader and IP details for approval.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredRedemptions.map((req) => (
                      <div
                        key={req.id}
                        className={`bg-white rounded-2xl border p-5 space-y-4 ${
                          req.status === 'pending_approval'
                            ? 'border-[#F7A600]/45'
                            : 'border-[#EAECEF]'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EAECEF]">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${RARITY_STYLES[req.rarityTier]}`}
                              >
                                {req.rarityTier}
                              </span>
                              <span className="font-display font-bold text-base text-[#121417]">
                                {req.rewardTitle}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                  req.status === 'approved'
                                    ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]'
                                    : req.status === 'rejected'
                                      ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                                      : 'bg-[#FFF8EB] text-[#B45309] border-[#F7A600]/30'
                                }`}
                              >
                                {req.status === 'pending_approval' ? 'Pending Approval' : req.status}
                              </span>
                            </div>
                            <p className="text-xs text-[#717882] mt-1">
                              Trader: <strong className="text-[#121417]">{req.userName}</strong> ({req.userEmail} · @{req.loginId})
                            </p>
                          </div>

                          <div className="text-left sm:text-right text-xs">
                            <span className="font-mono-tabular font-bold text-[#121417] block">
                              {req.source === 'secret_code'
                                ? `Code: ${req.secretCodeUsed}`
                                : `Spent: ${req.pointsSpent} pts`}
                            </span>
                            <span className="text-[#717882]">{formatTimestamp(req.createdAtIso)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                          <div className="bg-[#F7F8FA] border border-[#EAECEF] rounded-xl p-3">
                            <span className="text-[11px] text-[#717882] block">Reward Spec</span>
                            <strong className="text-[#121417]">
                              {req.rewardKind === 'account'
                                ? `${formatUsd(req.accountSize || 0)} · ${req.profitSplitPct || 80}%`
                                : `+${req.bonusPointsAwarded || 0} Bonus PTS`}
                            </strong>
                          </div>
                          <div className="bg-[#F7F8FA] border border-[#EAECEF] rounded-xl p-3">
                            <span className="text-[11px] text-[#717882] block">Request IP</span>
                            <strong className="font-mono-tabular text-[#121417]">{req.requestIp}</strong>
                          </div>
                          <div className="bg-[#F7F8FA] border border-[#EAECEF] rounded-xl p-3">
                            <span className="text-[11px] text-[#717882] block">Source</span>
                            <strong className="text-[#121417]">
                              {req.source === 'secret_code' ? 'Secret Code Luck Drop' : 'Redeem Store'}
                            </strong>
                          </div>
                          <div className="bg-[#F7F8FA] border border-[#EAECEF] rounded-xl p-3">
                            <span className="text-[11px] text-[#717882] block">Issued Account</span>
                            <strong className="font-mono-tabular text-[#00B574]">
                              {req.issuedAccountNumber ? `#${req.issuedAccountNumber}` : 'Pending Grant'}
                            </strong>
                          </div>
                        </div>

                        {req.status === 'pending_approval' && (
                          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#EAECEF]">
                            <button
                              type="button"
                              disabled={reviewingRedeemId === req.id}
                              onClick={() => handleRedemptionReview(req.id, 'reject')}
                              className="px-4 py-2 rounded-full bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] text-xs font-bold cursor-pointer disabled:opacity-60"
                            >
                              Reject {req.pointsSpent > 0 ? '(Refund Pts)' : ''}
                            </button>
                            <button
                              type="button"
                              disabled={reviewingRedeemId === req.id}
                              onClick={() => handleRedemptionReview(req.id, 'approve')}
                              className="px-5 py-2 rounded-full bg-[#00B574] hover:bg-[#009963] text-white text-xs font-bold cursor-pointer disabled:opacity-60 inline-flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>
                                {reviewingRedeemId === req.id
                                  ? 'Processing...'
                                  : req.rewardKind === 'account'
                                    ? 'Approve & Issue Account'
                                    : 'Approve Bonus Points'}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: ALL PURCHASED & ISSUED ACCOUNTS FULL MANAGEMENT TABLE */}
            {activeTab === 'purchased' && (
              <div className="bg-white rounded-2xl border border-[#EAECEF] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#EAECEF] flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-base font-bold text-[#121417]">
                      All Purchased &amp; Claimed Accounts ({allAccountsFlat.length})
                    </h2>
                    <p className="text-xs text-[#717882]">
                      Full overview of every purchased BNB evaluation, store redeem, and secret code account with proof, login IDs, P&amp;L, and live status controls.
                    </p>
                  </div>
                </div>

                {allAccountsFlat.length === 0 ? (
                  <div className="p-10 text-center text-xs text-[#717882]">
                    No purchased or claimed accounts match your filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#EAECEF] text-[11px] font-semibold text-[#717882] bg-[#F7F8FA]">
                          <th className="py-3 px-4">Account &amp; Credentials</th>
                          <th className="py-3 px-3">Trader</th>
                          <th className="py-3 px-3">Plan &amp; Size</th>
                          <th className="py-3 px-3">Fee / Proof</th>
                          <th className="py-3 px-3">Equity / P&amp;L</th>
                          <th className="py-3 px-3">Purchase IP</th>
                          <th className="py-3 px-4 text-right">Manage Status &amp; Reset</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAECEF]">
                        {allAccountsFlat.map(({ userName, userEmail, loginId, account }) => (
                          <tr key={account.id} className="hover:bg-[#F7F8FA]/70 align-top">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-mono-tabular font-extrabold text-[#121417] block">
                                {account.accountNumber}
                              </span>
                              <span className="font-mono-tabular text-[10px] text-[#717882] block">
                                Pass: {account.terminalPassword || 'N/A'}
                              </span>
                              <span className="text-[10px] text-[#00B574] font-semibold">
                                {account.platform} · {account.profitSplitPct}%
                              </span>
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="font-bold text-[#121417] block">{userName}</span>
                              <span className="text-[11px] text-[#717882] block">{userEmail}</span>
                              <span className="font-mono-tabular text-[10px] text-[#717882]">@{loginId}</span>
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="font-semibold text-[#121417] block">
                                {formatUsd(account.accountSize)}
                              </span>
                              <span className="text-[11px] text-[#717882] block">
                                {account.modeLabel}
                              </span>
                              <span className="text-[10px] text-[#717882]">
                                {formatTimestamp(account.createdAtIso)}
                              </span>
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="font-mono-tabular font-bold text-[#00B574] block">
                                {formatUsd(account.feePaidUsd)}
                              </span>
                              <span className="text-[10px] text-[#717882] block">
                                {account.paymentMethod || 'Crypto (BNB BEP20)'}
                              </span>
                              {account.paymentProofUrl && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewTitle(`Payment Proof · ${account.accountNumber}`);
                                    setPreviewProofUrl(account.paymentProofUrl || null);
                                  }}
                                  className="text-[11px] text-[#F7A600] font-bold hover:underline cursor-pointer mt-0.5"
                                >
                                  View Proof ↗
                                </button>
                              )}
                            </td>

                            <td className="py-3 px-3 font-mono-tabular whitespace-nowrap">
                              <span className="font-bold text-[#121417] block">
                                {formatUsd(account.currentEquity)}
                              </span>
                              <span
                                className={`text-[11px] font-semibold ${
                                  account.netPnlUsd >= 0 ? 'text-[#00B574]' : 'text-[#DC2626]'
                                }`}
                              >
                                {account.netPnlUsd >= 0 ? '+' : '-'}
                                {formatUsd(Math.abs(account.netPnlUsd))} ({account.tradeCount} trades)
                              </span>
                            </td>

                            <td className="py-3 px-3 font-mono-tabular text-[#4B5563] whitespace-nowrap">
                              {account.purchaseIp}
                            </td>

                            <td className="py-3 px-4 text-right whitespace-nowrap space-y-1.5">
                              <div className="inline-flex items-center gap-1.5">
                                <select
                                  aria-label={`Status for ${account.accountNumber}`}
                                  disabled={managingAccountId === account.id}
                                  value={account.status}
                                  onChange={(e) =>
                                    handleManageAccount(account.id, {
                                      status: e.target.value as DashboardAccount['status'],
                                    })
                                  }
                                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer focus:outline-none ${
                                    account.status === 'Breached'
                                      ? 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
                                      : account.status === 'Pending Approval'
                                        ? 'bg-[#FFF8EB] border-[#F7A600]/40 text-[#B45309]'
                                        : 'bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]'
                                  }`}
                                >
                                  {ACCOUNT_STATUS_OPTIONS.map((st) => (
                                    <option key={st} value={st}>
                                      {st}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  disabled={managingAccountId === account.id}
                                  onClick={() =>
                                    handleManageAccount(account.id, { resetEquity: true })
                                  }
                                  title="Reset account balance to starting size"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F5F6F8] hover:bg-[#EAECEF] text-[#121417] border border-[#EAECEF] text-[11px] font-semibold cursor-pointer disabled:opacity-60"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Reset</span>
                                </button>
                              </div>

                              {account.status === 'Pending Approval' && (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    disabled={approvingAccountId === account.id}
                                    onClick={() => handleAccountApproval(account.id, 'approve')}
                                    className="px-2.5 py-1 rounded-full bg-[#00B574] hover:bg-[#009963] text-white text-[10px] font-bold cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    disabled={approvingAccountId === account.id}
                                    onClick={() => handleAccountApproval(account.id, 'reject')}
                                    className="px-2.5 py-1 rounded-full bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] text-[10px] font-bold cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* BREACHED ACCOUNTS AUDIT TAB */}
            {activeTab === 'breached-accounts' && (
              <div className="bg-white rounded-2xl border border-[#EAECEF] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#EAECEF] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-bold text-[#121417] flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-[#DC2626]" />
                      <span>Breached Accounts Audit ({filteredBreachedAccounts.length})</span>
                    </h2>
                    <p className="text-xs text-[#717882] mt-0.5">
                      Live audit log of every trader account that hit daily drawdown, 1% floating loss, or max loss limits.
                    </p>
                  </div>
                </div>

                {filteredBreachedAccounts.length === 0 ? (
                  <div className="p-10 text-center text-xs text-[#717882]">
                    No breached accounts found. Traders who breach risk rules will appear here with full details.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#EAECEF] text-[11px] font-semibold text-[#717882] bg-[#F7F8FA]">
                          <th className="py-3 px-4">Account #</th>
                          <th className="py-3 px-3">Trader & Email</th>
                          <th className="py-3 px-3">Breach Reason</th>
                          <th className="py-3 px-3">Loss / Equity</th>
                          <th className="py-3 px-3">Trades & IP</th>
                          <th className="py-3 px-3">Breached At</th>
                          <th className="py-3 px-4 text-right">Recovery Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAECEF]">
                        {filteredBreachedAccounts.map((b) => (
                          <tr key={b.id} className="hover:bg-[#FEF2F2]/40">
                            <td className="py-3 px-4">
                              <span className="font-mono-tabular font-bold text-[#121417] block">
                                #{b.accountNumber}
                              </span>
                              <span className="text-[11px] text-[#717882]">
                                {b.modeLabel} · {formatUsd(b.accountSize)}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-bold text-[#121417]">{b.userName}</span>{' '}
                              <span className="text-[#717882]">(@{b.loginId})</span>
                              <span className="block text-[11px] text-[#717882]">{b.userEmail}</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FEF2F2] text-[#B91C1C] font-bold text-[11px] border border-[#FECACA]">
                                <AlertTriangle className="w-3 h-3" />
                                {b.breachReason}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono-tabular">
                              <span className="font-extrabold text-[#DC2626] block">
                                -{formatUsd(b.lossUsd)}
                              </span>
                              <span className="text-[11px] text-[#717882]">
                                Equity: {formatUsd(b.breachedEquity)} / {formatUsd(b.startingBalance)}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono-tabular text-[11px] text-[#4B5563]">
                              <span className="block">{b.tradeCount} trades</span>
                              <span className="text-[#717882]">IP: {b.lastIp}</span>
                            </td>
                            <td className="py-3 px-3 text-[#717882] whitespace-nowrap">
                              {formatTimestamp(b.breachedAtIso)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                disabled={managingAccountId === b.id}
                                onClick={() => handleManageAccount(b.id, { resetEquity: true, status: 'Active Evaluation' })}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F5F6F8] hover:bg-[#EAECEF] text-[#121417] text-[11px] font-bold cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Restore & Reset</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: ALL PAYOUT REQUESTS LEDGER */}
            {activeTab === 'payouts' && (
              <div className="bg-white rounded-2xl border border-[#EAECEF] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#EAECEF]">
                  <h2 className="font-display text-base font-bold text-[#121417] flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-[#00B574]" />
                    <span>All Trader Payout Requests ({allPayoutsFlat.length})</span>
                  </h2>
                  <p className="text-xs text-[#717882] mt-0.5">
                    Review crypto BNB BEP20 payout withdrawals ($100 min, max 24h settlement SLA) and mark Settled.
                  </p>
                </div>

                {allPayoutsFlat.length === 0 ? (
                  <div className="p-10 text-center text-xs text-[#717882]">
                    No trader payout requests submitted yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#EAECEF] text-[11px] font-semibold text-[#717882] bg-[#F7F8FA]">
                          <th className="py-3 px-4">Account #</th>
                          <th className="py-3 px-3">Trader</th>
                          <th className="py-3 px-3">Method & Wallet</th>
                          <th className="py-3 px-3">Amount</th>
                          <th className="py-3 px-3">Requested</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAECEF]">
                        {allPayoutsFlat.map((po) => (
                          <tr key={po.id} className="hover:bg-[#F7F8FA]/70">
                            <td className="py-3 px-4 font-mono-tabular font-bold text-[#121417]">
                              {po.accountNumber}
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-bold text-[#121417]">{po.userName}</span>{' '}
                              <span className="text-[#717882]">(@{po.loginId})</span>
                              <span className="block text-[11px] text-[#717882]">{po.userEmail}</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-semibold text-[#121417] block">{po.method}</span>
                              {po.walletAddress && (
                                <span className="font-mono-tabular text-[10px] text-[#717882] break-all">
                                  {po.walletAddress}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono-tabular font-extrabold text-[#00B574]">
                              {formatUsd(po.amountUsd)}
                            </td>
                            <td className="py-3 px-3 text-[#717882]">
                              {formatTimestamp(po.requestedAtIso)}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  po.status === 'Settled'
                                    ? 'bg-[#ECFDF5] text-[#047857]'
                                    : 'bg-[#FFF8EB] text-[#B45309]'
                                }`}
                              >
                                {po.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {po.status === 'Processing' ? (
                                <button
                                  type="button"
                                  disabled={settlingId === po.id}
                                  onClick={() => handleSettlePayout(po.id)}
                                  className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-[#00B574] hover:bg-[#009963] disabled:opacity-60 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{settlingId === po.id ? 'Settling...' : 'Mark Settled'}</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-[#717882]">Completed</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: SECRET CODE DROPS MANAGER */}
            {activeTab === 'secret-codes' && (
              <div className="space-y-5">
                <form
                  onSubmit={handleCreateSecretCode}
                  className="bg-white rounded-2xl border border-[#EAECEF] p-5 sm:p-6 space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[#F7A600]" />
                    <h2 className="font-display text-base font-bold text-[#121417]">
                      Drop a New Secret Luck Code
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#717882] mb-1">
                        Secret Code
                      </label>
                      <input
                        type="text"
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                        placeholder="LEMONMYTHIC"
                        className="w-full px-3 py-2 rounded-xl bg-[#F5F6F8] border border-[#EAECEF] text-xs font-mono-tabular font-bold uppercase text-[#121417]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#717882] mb-1">
                        Drop Label
                      </label>
                      <input
                        type="text"
                        value={newCodeLabel}
                        onChange={(e) => setNewCodeLabel(e.target.value)}
                        placeholder="Weekend Mythic Drop"
                        className="w-full px-3 py-2 rounded-xl bg-[#F5F6F8] border border-[#EAECEF] text-xs text-[#121417]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#717882] mb-1">
                        Max Redemptions
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="5000"
                        value={newCodeMaxUses}
                        onChange={(e) => setNewCodeMaxUses(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#F5F6F8] border border-[#EAECEF] text-xs font-mono-tabular text-[#121417]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#717882] mb-1">
                        Mythic Odds (%)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={newCodeMythicPct}
                        onChange={(e) => setNewCodeMythicPct(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#F5F6F8] border border-[#EAECEF] text-xs font-mono-tabular text-[#121417]"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={codeBusyId === 'creating'}
                        className="w-full py-2 px-4 rounded-full bg-[#F7A600] hover:bg-[#E59700] text-[#121417] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{codeBusyId === 'creating' ? 'Dropping...' : 'Drop Code'}</span>
                      </button>
                    </div>
                  </div>
                </form>

                <div className="bg-white rounded-2xl border border-[#EAECEF] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#EAECEF] text-[#717882] bg-[#F7F8FA]">
                          <th className="py-3 px-4 font-semibold">Code</th>
                          <th className="py-3 px-4 font-semibold">Label</th>
                          <th className="py-3 px-4 font-semibold">Mythic Rate</th>
                          <th className="py-3 px-4 font-semibold">Usage</th>
                          <th className="py-3 px-4 font-semibold">Status</th>
                          <th className="py-3 px-4 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAECEF]">
                        {(overview.secretCodes || []).map((drop) => (
                          <tr key={drop.id} className="hover:bg-[#F7F8FA]">
                            <td className="py-3 px-4 font-mono-tabular font-extrabold text-[#121417]">
                              {drop.code}
                            </td>
                            <td className="py-3 px-4 text-[#4B5563]">{drop.label}</td>
                            <td className="py-3 px-4 font-mono-tabular font-bold text-[#C41D7F]">
                              {drop.mythicChancePct}% MYTHIC
                            </td>
                            <td className="py-3 px-4 font-mono-tabular text-[#121417]">
                              {drop.usedCount} / {drop.maxUses}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  drop.active
                                    ? 'bg-[#ECFDF5] text-[#047857]'
                                    : 'bg-[#F5F6F8] text-[#717882]'
                                }`}
                              >
                                {drop.active ? 'Live' : 'Paused'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                disabled={codeBusyId === drop.id}
                                onClick={() => handleToggleSecretCode(drop.id, drop.active)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F5F6F8] hover:bg-[#EAECEF] text-[#121417] font-semibold cursor-pointer"
                              >
                                {drop.active ? (
                                  <>
                                    <Pause className="w-3 h-3" />
                                    <span>Pause</span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-3 h-3 text-[#00B574]" />
                                    <span>Resume</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={codeBusyId === drop.id}
                                onClick={() => handleDeleteSecretCode(drop.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] font-semibold cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 1,000 GIVEAWAY SECRET CODES VAULT */}
                <div className="bg-white rounded-2xl border border-[#EAECEF] p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#EAECEF] pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Gift className="w-4 h-4 text-[#F7A600]" />
                        <h3 className="font-display text-base font-bold text-[#121417]">
                          1,000 Giveaway Secret Codes (LMN-WIN-0001 to LMN-WIN-1000)
                        </h3>
                      </div>
                      <p className="text-xs text-[#717882] mt-1">
                        Working giveaway codes with ~95% discount coupon probability (10%–50% off) & ~5% rare funded/challenge account probability.
                      </p>
                      {giveawayCodesData && (
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-mono-tabular">
                          <span className="px-2.5 py-0.5 rounded-full bg-[#F5F6F8] text-[#121417] font-bold">
                            Total: {giveawayCodesData.total}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#047857] font-bold">
                            Available: {giveawayCodesData.available}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#FFF8EB] text-[#B45309] font-bold">
                            Claimed: {giveawayCodesData.claimed}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleCopyAllGiveawayCodes}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#121417] hover:bg-[#23272E] text-white text-xs font-bold cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#F7A600]" />
                        <span>Copy All 1,000</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadGiveawayTxt}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#F7A600] hover:bg-[#E59700] text-[#121417] text-xs font-extrabold cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download .TXT</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadGiveawayCsv}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#F5F6F8] hover:bg-[#EAECEF] text-[#121417] text-xs font-bold border border-[#EAECEF] cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download .CSV</span>
                      </button>
                    </div>
                  </div>

                  {copiedCodesStatus && (
                    <div className="px-3.5 py-2 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-xs font-bold text-[#047857]">
                      {copiedCodesStatus}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      {(['all', 'available', 'claimed'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setGiveawayFilter(f)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize cursor-pointer ${
                            giveawayFilter === f
                              ? 'bg-[#121417] text-white'
                              : 'bg-[#F5F6F8] text-[#717882] hover:text-[#121417]'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-[#717882] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="search"
                        value={giveawaySearch}
                        onChange={(e) => setGiveawaySearch(e.target.value)}
                        placeholder="Filter code (e.g. LMN-WIN-0042)..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-full bg-[#F5F6F8] border border-[#EAECEF] text-xs text-[#121417]"
                      />
                    </div>
                  </div>

                  <div className="border border-[#EAECEF] rounded-xl overflow-hidden max-h-[420px] overflow-y-auto">
                    {loadingGiveawayCodes ? (
                      <div className="p-8 text-center text-xs text-[#717882]">
                        Loading 1,000 giveaway codes...
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-[#F7F8FA] border-b border-[#EAECEF] text-[#717882]">
                          <tr>
                            <th className="py-2.5 px-4 font-semibold">Secret Code</th>
                            <th className="py-2.5 px-3 font-semibold">Status</th>
                            <th className="py-2.5 px-3 font-semibold">Claimed By / Reward</th>
                            <th className="py-2.5 px-4 font-semibold text-right">Copy</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EAECEF]">
                          {filteredGiveawayCodes.map((gc) => (
                            <tr key={gc.code} className="hover:bg-[#F7F8FA]">
                              <td className="py-2 px-4 font-mono-tabular font-bold text-[#121417]">
                                {gc.code}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    gc.claimed
                                      ? 'bg-[#FFF8EB] text-[#B45309]'
                                      : 'bg-[#ECFDF5] text-[#047857]'
                                  }`}
                                >
                                  {gc.claimed ? 'Claimed' : 'Available'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-[#4B5563]">
                                {gc.claimed ? (
                                  <div>
                                    <span className="font-semibold text-[#121417]">{gc.claimedBy}</span>
                                    {gc.rewardTitle && (
                                      <span className="block text-[11px] text-[#717882]">
                                        {gc.rewardTitle}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[#717882]">Ready to giveaway</span>
                                )}
                              </td>
                              <td className="py-2 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleCopySingleCode(gc.code)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F5F6F8] hover:bg-[#EAECEF] text-[#121417] font-semibold text-[11px] cursor-pointer"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: ALL TRADERS FULL DIRECTORY WITH POINTS & EMAIL CONTROLS */}
            {activeTab === 'all-users' && (
              <div className="space-y-4">
                {filteredUsers.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-[#EAECEF] p-10 text-center text-sm text-[#717882]">
                    No matching trader accounts found for the current filter.
                  </div>
                ) : (
                  filteredUsers.map((trader) => {
                    const pointVal = pointInputs[trader.id] ?? '';
                    return (
                      <div
                        key={trader.id}
                        className="bg-white rounded-2xl border border-[#EAECEF] p-5 sm:p-6 space-y-5"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-4 border-b border-[#EAECEF]">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="font-display text-lg font-bold text-[#121417]">
                                {trader.fullName}
                              </h2>
                              <span className="font-mono-tabular text-xs font-semibold text-[#717882]">
                                @{trader.loginId}
                              </span>
                              {trader.isAdmin && (
                                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F7A600] text-[#121417]">
                                  Owner
                                </span>
                              )}
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                  trader.emailVerified
                                    ? 'bg-[#ECFDF5] text-[#047857]'
                                    : 'bg-[#FFF8EB] text-[#B45309]'
                                }`}
                              >
                                {trader.emailVerified ? 'Verified Email' : 'Pending OTP'}
                              </span>
                              {!trader.emailVerified && (
                                <button
                                  type="button"
                                  disabled={userBusyId === trader.id}
                                  onClick={() => handleVerifyUserEmail(trader.id)}
                                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#00B574] hover:bg-[#009963] text-white cursor-pointer disabled:opacity-60"
                                >
                                  Verify Email Now
                                </button>
                              )}
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  trader.kycStatus === 'approved'
                                    ? 'bg-[#ECFDF5] text-[#047857]'
                                    : trader.kycStatus === 'pending'
                                      ? 'bg-[#FFF8EB] text-[#B45309]'
                                      : trader.kycStatus === 'rejected'
                                        ? 'bg-[#FEF2F2] text-[#B91C1C]'
                                        : 'bg-[#F5F6F8] text-[#717882]'
                                }`}
                              >
                                {trader.kycStatus === 'approved'
                                  ? 'KYC Approved'
                                  : trader.kycStatus === 'pending'
                                    ? 'KYC Pending'
                                    : trader.kycStatus === 'rejected'
                                      ? 'KYC Rejected'
                                      : 'No KYC'}
                              </span>
                              <span className="text-[11px] font-mono-tabular font-bold px-2 py-0.5 rounded-full bg-[#F5F6F8] text-[#121417]">
                                {trader.rewardPoints ?? 0} PTS
                              </span>
                            </div>

                            <p className="text-sm font-medium text-[#121417]">{trader.email}</p>
                            <p className="text-xs text-[#717882]">
                              Joined {formatTimestamp(trader.createdAtIso)} · Last Sign-In:{' '}
                              {formatTimestamp(trader.lastSignInAtIso)} ({trader.signInCount}{' '}
                              {trader.signInCount === 1 ? 'session' : 'sessions'})
                            </p>

                            {/* Admin Points Adjustment Bar */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#717882] mr-1">
                                <Coins className="w-3.5 h-3.5 text-[#F7A600]" />
                                <span>Manage Points:</span>
                              </span>
                              <button
                                type="button"
                                disabled={userBusyId === trader.id}
                                onClick={() => handleAdjustPoints(trader.id, 100)}
                                className="px-2.5 py-1 rounded-full bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#047857] text-[11px] font-bold cursor-pointer disabled:opacity-60"
                              >
                                +100
                              </button>
                              <button
                                type="button"
                                disabled={userBusyId === trader.id}
                                onClick={() => handleAdjustPoints(trader.id, 200)}
                                className="px-2.5 py-1 rounded-full bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#047857] text-[11px] font-bold cursor-pointer disabled:opacity-60"
                              >
                                +200
                              </button>
                              <button
                                type="button"
                                disabled={userBusyId === trader.id}
                                onClick={() => handleAdjustPoints(trader.id, -100)}
                                className="px-2.5 py-1 rounded-full bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] text-[11px] font-bold cursor-pointer disabled:opacity-60"
                              >
                                -100
                              </button>
                              <input
                                type="number"
                                value={pointVal}
                                onChange={(e) =>
                                  setPointInputs((prev) => ({
                                    ...prev,
                                    [trader.id]: e.target.value,
                                  }))
                                }
                                placeholder="Custom +/-"
                                className="w-24 px-2.5 py-1 rounded-full bg-[#F5F6F8] border border-[#EAECEF] text-[11px] font-mono-tabular text-[#121417]"
                              />
                              <button
                                type="button"
                                disabled={userBusyId === trader.id || !pointVal}
                                onClick={() => handleAdjustPoints(trader.id, Number(pointVal))}
                                className="px-2.5 py-1 rounded-full bg-[#121417] text-white text-[11px] font-bold cursor-pointer disabled:opacity-40"
                              >
                                Apply
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-left lg:text-right">
                            <div className="rounded-xl bg-[#F7F8FA] border border-[#EAECEF] px-3 py-2">
                              <p className="text-[11px] text-[#717882]">Last IP</p>
                              <p className="font-mono-tabular text-xs font-bold text-[#121417] mt-0.5">
                                {trader.lastIp}
                              </p>
                              <p className="text-[10px] text-[#717882]">
                                {summarizeDevice(trader.lastUserAgent)}
                              </p>
                            </div>

                            <div className="rounded-xl bg-[#F7F8FA] border border-[#EAECEF] px-3 py-2">
                              <p className="text-[11px] text-[#717882]">All IPs</p>
                              <p className="font-mono-tabular text-xs font-semibold text-[#121417] mt-0.5 break-all">
                                {trader.ipHistory.length > 0
                                  ? trader.ipHistory.join(', ')
                                  : trader.signupIp}
                              </p>
                            </div>

                            <div className="rounded-xl bg-[#F7F8FA] border border-[#EAECEF] px-3 py-2">
                              <p className="text-[11px] text-[#717882]">Fees Paid</p>
                              <p className="font-mono-tabular text-sm font-bold text-[#00B574] mt-0.5">
                                {formatUsd(trader.totalFeePaidUsd)}
                              </p>
                              <p className="text-[10px] text-[#717882]">
                                {trader.accounts.length}{' '}
                                {trader.accounts.length === 1 ? 'account' : 'accounts'}
                              </p>
                            </div>

                            <div className="rounded-xl bg-[#F7F8FA] border border-[#EAECEF] px-3 py-2">
                              <p className="text-[11px] text-[#717882]">Capital</p>
                              <p className="font-mono-tabular text-sm font-bold text-[#121417] mt-0.5">
                                {formatUsd(trader.totalFundedCapitalUsd)}
                              </p>
                              <p className="text-[10px] text-[#717882]">
                                Payouts: {formatUsd(trader.totalPayoutsUsd)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {trader.accounts.length === 0 ? (
                          <p className="text-xs text-[#717882]">
                            No challenges purchased or claimed by this trader yet.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="border-b border-[#EAECEF] text-[11px] font-semibold text-[#717882]">
                                  <th className="py-2 pr-3">Account</th>
                                  <th className="py-2 px-3">Plan &amp; Size</th>
                                  <th className="py-2 px-3">Method / Fee</th>
                                  <th className="py-2 px-3">Purchase IP</th>
                                  <th className="py-2 px-3">Equity / P&amp;L</th>
                                  <th className="py-2 px-3">Trades</th>
                                  <th className="py-2 pl-3 text-right">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#EAECEF] text-xs">
                                {trader.accounts.map((acct) => (
                                  <tr key={acct.id}>
                                    <td className="py-2.5 pr-3 font-mono-tabular font-bold text-[#121417] whitespace-nowrap">
                                      {acct.accountNumber}
                                      <span className="block text-[10px] font-normal text-[#717882]">
                                        {acct.platform} · {acct.profitSplitPct}% split
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-[#121417] whitespace-nowrap">
                                      {acct.modeLabel} · {formatUsd(acct.accountSize)}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono-tabular font-semibold text-[#00B574] whitespace-nowrap">
                                      {formatUsd(acct.feePaidUsd)}
                                      <span className="block text-[10px] font-sans font-normal text-[#717882]">
                                        {acct.paymentMethod || 'Crypto (BNB BEP20)'}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 font-mono-tabular text-[#4B5563] whitespace-nowrap">
                                      {acct.purchaseIp}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono-tabular whitespace-nowrap">
                                      <span className="font-semibold text-[#121417]">
                                        {formatUsd(acct.currentEquity)}
                                      </span>{' '}
                                      <span
                                        className={
                                          acct.netPnlUsd >= 0 ? 'text-[#00B574]' : 'text-[#DC2626]'
                                        }
                                      >
                                        ({acct.netPnlUsd >= 0 ? '+' : '-'}
                                        {formatUsd(Math.abs(acct.netPnlUsd))})
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 font-mono-tabular text-[#4B5563] whitespace-nowrap">
                                      {acct.tradeCount}
                                    </td>
                                    <td className="py-2.5 pl-3 text-right font-semibold whitespace-nowrap">
                                      <span
                                        className={
                                          acct.status === 'Breached'
                                            ? 'text-[#DC2626]'
                                            : acct.status === 'Pending Approval'
                                              ? 'text-[#D97706]'
                                              : 'text-[#00B574]'
                                        }
                                      >
                                        {acct.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {trader.payouts.length > 0 && (
                          <div className="pt-3 border-t border-[#EAECEF]">
                            <p className="text-xs font-semibold text-[#121417] mb-2">Payout Requests</p>
                            <div className="space-y-2">
                              {trader.payouts.map((po) => (
                                <div
                                  key={po.id}
                                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F7F8FA] border border-[#EAECEF] px-3.5 py-2 text-xs"
                                >
                                  <div className="flex flex-wrap items-center gap-3">
                                    <span className="font-mono-tabular font-bold text-[#121417]">
                                      {po.accountNumber}
                                    </span>
                                    <span className="font-mono-tabular font-bold text-[#00B574]">
                                      {formatUsd(po.amountUsd)}
                                    </span>
                                    <span className="text-[#4B5563]">{po.method}</span>
                                    <span className="text-[#717882]">
                                      {formatTimestamp(po.requestedAtIso)}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`font-semibold ${
                                        po.status === 'Settled' ? 'text-[#00B574]' : 'text-[#D97706]'
                                      }`}
                                    >
                                      {po.status}
                                    </span>
                                    {po.status === 'Processing' && (
                                      <button
                                        type="button"
                                        onClick={() => handleSettlePayout(po.id)}
                                        disabled={settlingId === po.id}
                                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#00B574] hover:bg-[#009963] disabled:opacity-60 text-white text-[11px] font-bold cursor-pointer"
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>{settlingId === po.id ? 'Updating...' : 'Mark Settled'}</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 8: CHRONOLOGICAL ACTIVITY LEDGER */}
            {activeTab === 'activity-log' && (
              <div className="bg-white rounded-2xl border border-[#EAECEF] p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-[#F7A600]" />
                  <h2 className="font-display text-lg font-bold text-[#121417]">
                    Live IP, Sign-In, Payment &amp; Reward Activity Feed
                  </h2>
                </div>
                <p className="text-xs text-[#717882] mb-4">
                  Every registration, OTP check, sign-in, BNB purchase, social task proof, store redeem, secret code roll, trade, and payout request.
                </p>

                {filteredLogs.length === 0 ? (
                  <p className="text-sm text-[#717882] py-6 text-center">
                    No activity logs match your search.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#EAECEF] text-xs font-semibold text-[#717882]">
                          <th className="py-2.5 pr-4">Event</th>
                          <th className="py-2.5 px-4">Trader</th>
                          <th className="py-2.5 px-4">IP Address</th>
                          <th className="py-2.5 px-4">Details</th>
                          <th className="py-2.5 pl-4 text-right">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAECEF] text-xs">
                        {filteredLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-[#F7F8FA]">
                            <td className="py-3 pr-4 font-bold text-[#121417] whitespace-nowrap">
                              {EVENT_LABELS[log.type] || log.type}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-semibold text-[#121417]">{log.userName}</span>{' '}
                              <span className="text-[#717882]">(@{log.loginId})</span>
                              <span className="block text-[11px] text-[#717882]">{log.userEmail}</span>
                            </td>
                            <td className="py-3 px-4 font-mono-tabular font-semibold text-[#121417] whitespace-nowrap">
                              {log.ip}
                              <span className="block text-[10px] font-sans font-normal text-[#717882]">
                                {summarizeDevice(log.userAgent)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[#4B5563] max-w-md">{log.summary}</td>
                            <td className="py-3 pl-4 text-right font-mono-tabular text-[#717882] whitespace-nowrap">
                              {formatTimestamp(log.timestampIso)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Proof Screenshot Inspection Modal */}
      {previewProofUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setPreviewProofUrl(null)}
        >
          <div
            className="relative max-w-2xl max-h-[90vh] bg-white rounded-2xl p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#EAECEF] mb-3">
              <h3 className="font-bold text-sm text-[#121417]">{previewTitle}</h3>
              <button
                type="button"
                onClick={() => setPreviewProofUrl(null)}
                className="px-3 py-1 rounded-full bg-[#F5F6F8] hover:bg-[#EAECEF] text-[#121417] cursor-pointer text-xs font-bold"
              >
                Close
              </button>
            </div>
            <img
              src={previewProofUrl}
              alt="Proof Fullscreen"
              className="max-h-[75vh] w-auto mx-auto rounded-xl object-contain border border-[#EAECEF]"
            />
          </div>
        </div>
      )}
    </section>
  );
}
