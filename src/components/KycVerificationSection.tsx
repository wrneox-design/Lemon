import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck2,
  IdCard,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import type { KycStatus, KycSubmission } from '../server/authStore';

interface KycVerificationSectionProps {
  accessToken: string;
  userEmail: string;
  userKycStatus: KycStatus;
  onRefreshDashboard: () => Promise<void>;
  onOpenTerminal?: () => void;
}

interface KycApiResponse {
  kycStatus: KycStatus;
  kycRejectionReason?: string;
  latestSubmission: KycSubmission | null;
}

function readAndCompressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) {
        reject(new Error('Empty image file.'));
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(rawDataUrl);
      img.onload = () => {
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function KycVerificationSection({
  accessToken,
  userEmail,
  userKycStatus,
  onRefreshDashboard,
  onOpenTerminal,
}: KycVerificationSectionProps) {
  const [kycData, setKycData] = useState<KycApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [panSelected, setPanSelected] = useState(true);
  const [aadhaarSelected, setAadhaarSelected] = useState(true);
  const [panNumber, setPanNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panImageUrl, setPanImageUrl] = useState('');
  const [aadhaarFrontImageUrl, setAadhaarFrontImageUrl] = useState('');
  const [aadhaarBackImageUrl, setAadhaarBackImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadKyc = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/kyc', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (resp.ok) {
        const data = (await resp.json()) as KycApiResponse;
        setKycData(data);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadKyc();
  }, [loadKyc]);

  const effectiveStatus: KycStatus = kycData?.kycStatus ?? userKycStatus ?? 'not_submitted';
  const latest = kycData?.latestSubmission ?? null;
  const rejectionReason = kycData?.kycRejectionReason;

  const handleImagePick = async (
    e: ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a JPG, PNG, or WebP screenshot image.');
      return;
    }
    try {
      const compressed = await readAndCompressImage(file);
      setter(compressed);
    } catch {
      setErrorMsg('Could not process selected screenshot. Try another image.');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!panSelected || !aadhaarSelected) {
      setErrorMsg('Select both PAN Card and Aadhaar Card to submit KYC verification.');
      return;
    }
    if (!panImageUrl || !aadhaarFrontImageUrl || !aadhaarBackImageUrl) {
      setErrorMsg(
        'Upload all 3 screenshots: PAN Card, Aadhaar Front, and Aadhaar Back.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const resp = await fetch('/api/kyc/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          panSelected,
          aadhaarSelected,
          panNumber,
          aadhaarNumber,
          panImageUrl,
          aadhaarFrontImageUrl,
          aadhaarBackImageUrl,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data.error || 'Could not submit KYC request.');
        return;
      }
      setSuccessMsg(
        'KYC documents submitted! Your request is now in the Owner Admin Panel queue.'
      );
      await Promise.all([loadKyc(), onRefreshDashboard()]);
    } catch {
      setErrorMsg('Network error submitting KYC documents.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="kyc-verification-section" className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-[#111113] rounded-2xl border border-white/[0.08] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Trader Identity Verification</span>
            <span aria-hidden="true">·</span>
            <span className="text-white">{userEmail}</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
            KYC Verification (PAN + Aadhaar)
          </h2>
          <p className="text-sm text-zinc-400">
            Live trading unlocks automatically once the Owner Admin reviews and approves your PAN Card and Aadhaar Card (Front &amp; Back) screenshots.
          </p>
        </div>

        <div className="shrink-0">
          {effectiveStatus === 'approved' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-3.5 py-2 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>KYC Approved · Trading Active</span>
            </span>
          ) : effectiveStatus === 'pending' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/25 px-3.5 py-2 rounded-lg">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Pending Admin Approval</span>
            </span>
          ) : effectiveStatus === 'rejected' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-500/15 border border-red-500/25 px-3.5 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>Rejected · Re-upload Needed</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-200 bg-[#18181B] border border-white/[0.08] px-3.5 py-2 rounded-lg">
              <FileCheck2 className="w-4 h-4 text-zinc-400" />
              <span>Verification Required</span>
            </span>
          )}
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs font-semibold text-red-300"
        >
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-emerald-300 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Approved State */}
      {effectiveStatus === 'approved' && (
        <div className="bg-[#111113] rounded-2xl border border-emerald-500/30 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Your KYC Is Approved — Live Trading Enabled
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  PAN Card and Aadhaar Card (Front &amp; Back) verified by Owner Admin
                  {latest?.reviewedAtIso ? ` on ${formatDate(latest.reviewedAtIso)}` : ''}.
                </p>
              </div>
            </div>
            {onOpenTerminal && (
              <button
                type="button"
                onClick={onOpenTerminal}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-[#09090B] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Open Lemon Terminal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pending State */}
      {effectiveStatus === 'pending' && latest && (
        <div className="bg-[#111113] rounded-2xl border border-amber-500/35 p-6 space-y-5">
          <div className="flex items-start gap-3 pb-4 border-b border-white/[0.08]">
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">
                KYC Request Submitted — Awaiting Admin Approval
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Submitted {formatDate(latest.submittedAtIso)}. Owner Admin is reviewing your PAN and Aadhaar screenshots. Trading opens immediately upon approval.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="rounded-xl bg-[#18181B] border border-white/[0.08] p-3 space-y-2">
              <p className="font-bold text-white">PAN Card Screenshot</p>
              <img
                src={latest.panImageUrl}
                alt="Submitted PAN Card"
                className="w-full h-36 object-cover rounded-lg border border-white/[0.08]"
              />
            </div>
            <div className="rounded-xl bg-[#18181B] border border-white/[0.08] p-3 space-y-2">
              <p className="font-bold text-white">Aadhaar Front Screenshot</p>
              <img
                src={latest.aadhaarFrontImageUrl}
                alt="Submitted Aadhaar Front"
                className="w-full h-36 object-cover rounded-lg border border-white/[0.08]"
              />
            </div>
            <div className="rounded-xl bg-[#18181B] border border-white/[0.08] p-3 space-y-2">
              <p className="font-bold text-white">Aadhaar Back Screenshot</p>
              <img
                src={latest.aadhaarBackImageUrl}
                alt="Submitted Aadhaar Back"
                className="w-full h-36 object-cover rounded-lg border border-white/[0.08]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Rejection Notice */}
      {effectiveStatus === 'rejected' && (
        <div className="rounded-2xl bg-red-500/15 border border-red-500/30 p-4 sm:p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-red-200 space-y-1">
            <p className="font-bold">Previous KYC Submission Rejected</p>
            <p>
              {rejectionReason ||
                'Documents were unclear or incomplete. Re-select both PAN and Aadhaar and upload clear Front & Back screenshots.'}
            </p>
          </div>
        </div>
      )}

      {/* Submission Form (Visible when not_submitted or rejected) */}
      {(effectiveStatus === 'not_submitted' || effectiveStatus === 'rejected') && !loading && (
        <form onSubmit={handleSubmit} className="bg-[#111113] rounded-2xl border border-white/[0.08] p-5 sm:p-6 space-y-6">
          {/* Step 1: Select Both Documents */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-white">
                1. Select Documents to Verify (Both Required)
              </h3>
              <span className="text-xs font-medium text-zinc-400">
                PAN + Aadhaar Front &amp; Back
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPanSelected((prev) => !prev)}
                className={`p-4 rounded-xl border text-left transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                  panSelected
                    ? 'bg-[#18181B] border-white text-white'
                    : 'bg-[#141417] border-white/[0.08] text-zinc-400'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#F7A600]/15 border border-[#F7A600]/30 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4 text-[#F7A600]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">PAN Card</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Clear front photo / screenshot required
                    </p>
                  </div>
                </div>
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${
                    panSelected
                      ? 'bg-white border-white text-[#09090B]'
                      : 'bg-transparent border-white/25'
                  }`}
                >
                  {panSelected && <Check className="w-3.5 h-3.5" />}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAadhaarSelected((prev) => !prev)}
                className={`p-4 rounded-xl border text-left transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                  aadhaarSelected
                    ? 'bg-[#18181B] border-white text-white'
                    : 'bg-[#141417] border-white/[0.08] text-zinc-400'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                    <IdCard className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Aadhaar Card (Front &amp; Back)</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Both front and back screenshots required
                    </p>
                  </div>
                </div>
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${
                    aadhaarSelected
                      ? 'bg-white border-white text-[#09090B]'
                      : 'bg-transparent border-white/25'
                  }`}
                >
                  {aadhaarSelected && <Check className="w-3.5 h-3.5" />}
                </span>
              </button>
            </div>
          </div>

          {/* Step 2: Optional Document Numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-white/[0.08]">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                PAN Card Number (Optional)
              </label>
              <input
                type="text"
                maxLength={10}
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.08] font-mono-tabular text-sm font-semibold text-white placeholder:text-zinc-500 focus:outline-none focus:border-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Aadhaar Card Number (Optional)
              </label>
              <input
                type="text"
                maxLength={12}
                value={aadhaarNumber}
                onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="12-digit Aadhaar number"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181B] border border-white/[0.08] font-mono-tabular text-sm font-semibold text-white placeholder:text-zinc-500 focus:outline-none focus:border-white"
              />
            </div>
          </div>

          {/* Step 3: 3 Required Document Screenshots */}
          <div className="space-y-3 pt-3 border-t border-white/[0.08]">
            <h3 className="font-display text-base font-bold text-white">
              2. Upload Document Screenshots (All 3 Required)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Slot 1: PAN Card */}
              <div className="rounded-xl bg-[#18181B] border border-white/[0.08] p-3.5 space-y-2.5 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-white">PAN Card Screenshot</p>
                  <p className="text-[11px] text-zinc-400">Clear front image of PAN card</p>
                </div>

                {panImageUrl ? (
                  <div className="space-y-2">
                    <img
                      src={panImageUrl}
                      alt="PAN Card preview"
                      className="w-full h-36 object-cover rounded-lg border border-white/[0.1] bg-[#09090B]"
                    />
                    <button
                      type="button"
                      onClick={() => setPanImageUrl('')}
                      className="w-full py-1.5 rounded-lg bg-red-500/15 text-red-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove PAN Screenshot</span>
                    </button>
                  </div>
                ) : (
                  <label className="h-36 rounded-lg border-2 border-dashed border-white/15 hover:border-white/40 bg-[#111113] flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center px-3 transition-colors">
                    <Upload className="w-5 h-5 text-[#F7A600]" />
                    <span className="text-xs font-bold text-white">Upload PAN Card</span>
                    <span className="text-[10px] text-zinc-400">JPG, PNG or WebP</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => void handleImagePick(e, setPanImageUrl)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Slot 2: Aadhaar Front */}
              <div className="rounded-xl bg-[#18181B] border border-white/[0.08] p-3.5 space-y-2.5 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Aadhaar Card — Front</p>
                  <p className="text-[11px] text-zinc-400">Front side showing photo &amp; name</p>
                </div>

                {aadhaarFrontImageUrl ? (
                  <div className="space-y-2">
                    <img
                      src={aadhaarFrontImageUrl}
                      alt="Aadhaar Front preview"
                      className="w-full h-36 object-cover rounded-lg border border-white/[0.1] bg-[#09090B]"
                    />
                    <button
                      type="button"
                      onClick={() => setAadhaarFrontImageUrl('')}
                      className="w-full py-1.5 rounded-lg bg-red-500/15 text-red-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Aadhaar Front</span>
                    </button>
                  </div>
                ) : (
                  <label className="h-36 rounded-lg border-2 border-dashed border-white/15 hover:border-emerald-400 bg-[#111113] flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center px-3 transition-colors">
                    <Upload className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Upload Aadhaar Front</span>
                    <span className="text-[10px] text-zinc-400">JPG, PNG or WebP</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => void handleImagePick(e, setAadhaarFrontImageUrl)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Slot 3: Aadhaar Back */}
              <div className="rounded-xl bg-[#18181B] border border-white/[0.08] p-3.5 space-y-2.5 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Aadhaar Card — Back</p>
                  <p className="text-[11px] text-zinc-400">Back side showing address &amp; QR</p>
                </div>

                {aadhaarBackImageUrl ? (
                  <div className="space-y-2">
                    <img
                      src={aadhaarBackImageUrl}
                      alt="Aadhaar Back preview"
                      className="w-full h-36 object-cover rounded-lg border border-white/[0.1] bg-[#09090B]"
                    />
                    <button
                      type="button"
                      onClick={() => setAadhaarBackImageUrl('')}
                      className="w-full py-1.5 rounded-lg bg-red-500/15 text-red-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Aadhaar Back</span>
                    </button>
                  </div>
                ) : (
                  <label className="h-36 rounded-lg border-2 border-dashed border-white/15 hover:border-emerald-400 bg-[#111113] flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center px-3 transition-colors">
                    <Upload className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Upload Aadhaar Back</span>
                    <span className="text-[10px] text-zinc-400">JPG, PNG or WebP</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => void handleImagePick(e, setAadhaarBackImageUrl)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/[0.08]">
            <p className="text-xs text-zinc-400">
              Documents are sent securely to the private Owner Admin Panel for verification.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-full bg-white hover:bg-zinc-200 disabled:opacity-60 text-[#09090B] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
              <span>
                {submitting ? 'Submitting KYC Request...' : 'Send KYC Request to Admin →'}
              </span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
