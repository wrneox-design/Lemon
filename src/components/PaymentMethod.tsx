import { useEffect, useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Copy,
  Check,
  UploadCloud,
  X,
  ShieldCheck,
  QrCode,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { formatUsd } from '../utils/challenges';
import { compressImageFile } from '../utils/imageCompress';

export interface PaymentConfirmedDetails {
  paymentMethod: string;
  paymentProofUrl: string;
  txHash?: string;
  notes?: string;
}

interface PaymentMethodProps {
  amountUsd: number;
  accountModeLabel?: string;
  accountSize?: number;
  promoCodeApplied?: string;
  discountPctApplied?: number;
  dark?: boolean;
  onPaymentConfirmed: (details: PaymentConfirmedDetails) => Promise<void> | void;
  onCancel?: () => void;
}

const BNB_BEP20_ADDRESS = '0x67aeec70d2f322e5046981764718fd1ca5ca78ce';
const TOTAL_TIMER_SECONDS = 600; // 10 minutes

export function PaymentMethod({
  amountUsd,
  promoCodeApplied,
  discountPctApplied,
  dark = false,
  onPaymentConfirmed,
  onCancel,
}: PaymentMethodProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(TOTAL_TIMER_SECONDS);
  const [copied, setCopied] = useState(false);
  const [txHash, setTxHash] = useState('');

  const [isDragging, setIsDragging] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const timerProgressPct = ((TOTAL_TIMER_SECONDS - secondsLeft) / TOTAL_TIMER_SECONDS) * 100;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(BNB_BEP20_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Only image files (PNG, JPG, WEBP, JPEG) are accepted.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('File size must be under 20MB.');
      return;
    }

    setUploadError('');
    setProofFile(file);
    try {
      const compressedDataUrl = await compressImageFile(file, 1280, 0.78);
      setProofPreviewUrl(compressedDataUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to process screenshot.');
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void processFile(e.target.files[0]);
    }
  };

  const handleRemoveProof = () => {
    setProofFile(null);
    setProofPreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleResetTimer = () => {
    setSecondsLeft(TOTAL_TIMER_SECONDS);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofPreviewUrl) {
      setUploadError('Please attach a payment screenshot or transaction receipt.');
      return;
    }

    setSubmitting(true);
    setUploadError('');
    try {
      await onPaymentConfirmed({
        paymentMethod: 'Crypto (BNB BEP20)',
        paymentProofUrl: proofPreviewUrl,
        txHash: txHash.trim() || undefined,
      });
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Could not submit payment proof. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-full space-y-5"
    >
      {/* 10-Minute Countdown Timer Header */}
      <div className="rounded-2xl bg-[#121417] text-white p-4 sm:p-5 border border-[#23272D] relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
          <div
            className="h-full bg-[#F7A600] transition-all duration-500"
            style={{ width: `${100 - timerProgressPct}%` }}
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F7A600] text-[#121417] flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-[#9CA3AF]">
                  Deposit Window
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#F7A600]/20 text-[#F7A600] text-[10px] font-mono-tabular font-bold">
                  BSC (BEP20)
                </span>
              </div>
              <h3 className="font-display font-bold text-base sm:text-lg text-white">
                BNB Transfer Expires in{' '}
                <span
                  className={`font-mono-tabular ${
                    secondsLeft < 120 ? 'text-[#F87171]' : 'text-[#F7A600]'
                  }`}
                >
                  {formatTimer(secondsLeft)}
                </span>
              </h3>
            </div>
          </div>

          <div className="text-right sm:border-l sm:border-white/10 sm:pl-4">
            <span className="text-[11px] text-[#9CA3AF] block">Amount Due</span>
            <div className="flex items-baseline gap-1.5 justify-end">
              <span className="font-mono-tabular font-bold text-xl text-[#F7A600]">
                {formatUsd(amountUsd)}
              </span>
              <span className="text-xs text-[#9CA3AF]">USD</span>
            </div>
            {promoCodeApplied && (
              <span className="text-[10px] text-[#34D399] block font-semibold">
                {promoCodeApplied} (-{discountPctApplied}%)
              </span>
            )}
          </div>
        </div>

        {secondsLeft === 0 && (
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-amber-300">
            <span>Deposit timer elapsed. Reset timer to continue.</span>
            <button
              type="button"
              onClick={handleResetTimer}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Timer</span>
            </button>
          </div>
        )}
      </div>

      {/* BNB BEP20 Deposit Card */}
      <div
        className={`rounded-2xl border p-5 space-y-4 ${
          dark
            ? 'bg-[#111113] border-white/[0.08] text-white'
            : 'bg-[#F7F8FA] border-[#EAECEF] text-[#121417]'
        }`}
      >
        <div
          className={`flex items-center justify-between border-b pb-3 ${
            dark ? 'border-white/[0.08]' : 'border-[#EAECEF]'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#F7A600] text-[#121417] flex items-center justify-center font-bold text-[10px]">
              BNB
            </span>
            <span className={`font-bold text-sm ${dark ? 'text-white' : 'text-[#121417]'}`}>
              BNB Smart Chain (BEP20)
            </span>
          </div>
          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
              dark
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'bg-[#ECFDF5] text-[#047857]'
            }`}
          >
            Crypto Only · Verified Address
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* Clean Vector QR */}
          <div className="md:col-span-4 flex flex-col items-center justify-center">
            <div
              className={`p-3 bg-white rounded-2xl shadow-xs ${
                dark ? 'border border-white/15' : 'border border-[#EAECEF]'
              }`}
            >
              <svg
                viewBox="0 0 160 160"
                className="w-36 h-36 rounded-xl"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect width="160" height="160" fill="#FFFFFF" rx="12" />
                <g fill="#121417">
                  <rect x="12" y="12" width="40" height="40" rx="6" fill="#121417" />
                  <rect x="18" y="18" width="28" height="28" rx="4" fill="#FFFFFF" />
                  <rect x="24" y="24" width="16" height="16" rx="2" fill="#121417" />

                  <rect x="108" y="12" width="40" height="40" rx="6" fill="#121417" />
                  <rect x="114" y="18" width="28" height="28" rx="4" fill="#FFFFFF" />
                  <rect x="120" y="24" width="16" height="16" rx="2" fill="#121417" />

                  <rect x="12" y="108" width="40" height="40" rx="6" fill="#121417" />
                  <rect x="18" y="114" width="28" height="28" rx="4" fill="#FFFFFF" />
                  <rect x="24" y="120" width="16" height="16" rx="2" fill="#121417" />

                  <rect x="60" y="16" width="8" height="8" rx="1.5" />
                  <rect x="76" y="16" width="8" height="8" rx="1.5" />
                  <rect x="68" y="28" width="8" height="8" rx="1.5" />
                  <rect x="84" y="28" width="8" height="8" rx="1.5" />
                  <rect x="60" y="40" width="8" height="8" rx="1.5" />
                  <rect x="76" y="40" width="8" height="8" rx="1.5" />

                  <rect x="16" y="60" width="8" height="8" rx="1.5" />
                  <rect x="28" y="68" width="8" height="8" rx="1.5" />
                  <rect x="40" y="60" width="8" height="8" rx="1.5" />
                  <rect x="16" y="76" width="8" height="8" rx="1.5" />
                  <rect x="28" y="84" width="8" height="8" rx="1.5" />
                  <rect x="40" y="76" width="8" height="8" rx="1.5" />

                  <rect x="60" y="60" width="8" height="8" rx="1.5" />
                  <rect x="72" y="60" width="8" height="8" rx="1.5" />
                  <rect x="84" y="60" width="8" height="8" rx="1.5" />
                  <rect x="96" y="60" width="8" height="8" rx="1.5" />
                  <rect x="60" y="72" width="8" height="8" rx="1.5" />
                  <rect x="88" y="72" width="8" height="8" rx="1.5" />
                  <rect x="60" y="88" width="8" height="8" rx="1.5" />
                  <rect x="76" y="88" width="8" height="8" rx="1.5" />

                  <rect x="108" y="64" width="8" height="8" rx="1.5" />
                  <rect x="124" y="64" width="8" height="8" rx="1.5" />
                  <rect x="136" y="76" width="8" height="8" rx="1.5" />
                  <rect x="116" y="88" width="8" height="8" rx="1.5" />
                  <rect x="132" y="88" width="8" height="8" rx="1.5" />

                  <rect x="64" y="108" width="8" height="8" rx="1.5" />
                  <rect x="76" y="116" width="8" height="8" rx="1.5" />
                  <rect x="88" y="108" width="8" height="8" rx="1.5" />
                  <rect x="64" y="128" width="8" height="8" rx="1.5" />
                  <rect x="80" y="124" width="8" height="8" rx="1.5" />
                  <rect x="92" y="136" width="8" height="8" rx="1.5" />

                  <rect x="112" y="112" width="8" height="8" rx="1.5" />
                  <rect x="124" y="112" width="8" height="8" rx="1.5" />
                  <rect x="136" y="124" width="8" height="8" rx="1.5" />
                  <rect x="112" y="136" width="8" height="8" rx="1.5" />
                  <rect x="128" y="136" width="8" height="8" rx="1.5" />
                </g>

                <circle cx="80" cy="80" r="16" fill="#FFFFFF" />
                <circle cx="80" cy="80" r="13" fill="#F7A600" />
                <path
                  d="M80 72L84.5 76.5L82.2 78.8L80 76.6L77.8 78.8L75.5 76.5L80 72ZM73.5 78.8L75.8 81.1L73.5 83.4L71.2 81.1L73.5 78.8ZM86.5 78.8L88.8 81.1L86.5 83.4L84.2 81.1L86.5 78.8ZM80 81.3L82.3 83.6L80 85.9L77.7 83.6L80 81.3ZM80 88.2L84.5 83.7L82.2 81.4L80 83.6L77.8 81.4L75.5 83.7L80 88.2Z"
                  fill="#121417"
                />
              </svg>
            </div>
            <span
              className={`text-[11px] font-medium mt-2 flex items-center gap-1 ${
                dark ? 'text-zinc-400' : 'text-[#717882]'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-[#F7A600]" />
              Scan via Bybit / Trust / MetaMask
            </span>
          </div>

          <div className="md:col-span-8 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-semibold ${dark ? 'text-zinc-400' : 'text-[#717882]'}`}>
                  Wallet Address (BNB BEP20)
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    dark
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-[#ECFDF5] text-[#047857]'
                  }`}
                >
                  Network: BSC (BEP20)
                </span>
              </div>

              <div
                className={`flex items-center gap-2 p-3 rounded-xl border ${
                  dark ? 'bg-[#18181B] border-white/[0.08]' : 'bg-white border-[#EAECEF]'
                }`}
              >
                <span
                  className={`font-mono-tabular text-xs font-bold break-all select-all flex-1 ${
                    dark ? 'text-white' : 'text-[#121417]'
                  }`}
                >
                  {BNB_BEP20_ADDRESS}
                </span>
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    dark
                      ? 'bg-white hover:bg-zinc-200 text-[#09090B]'
                      : 'bg-[#F7A600] hover:bg-[#E59700] text-[#121417]'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#059669]" />
                      <span className="text-[#059669]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Address</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border text-xs space-y-1 ${
                dark
                  ? 'bg-[#18181B] border-white/[0.08] text-zinc-300'
                  : 'bg-white border-[#EAECEF] text-[#4B5563]'
              }`}
            >
              <div className={`font-semibold ${dark ? 'text-white' : 'text-[#121417]'}`}>
                Deposit Notes:
              </div>
              <ul className={`list-disc list-inside space-y-0.5 text-[11px] ${dark ? 'text-zinc-400' : 'text-[#717882]'}`}>
                <li>
                  Send BNB via <strong className={dark ? 'text-white' : 'text-[#121417]'}>BSC (BEP20)</strong> only.
                </li>
                <li>
                  Amount due: <strong className="text-emerald-400">{formatUsd(amountUsd)} USD</strong>.
                </li>
                <li>Attach your completed transfer screenshot below for Admin approval.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Drag & Drop Proof Uploader */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className={`block text-xs font-bold ${dark ? 'text-white' : 'text-[#121417]'}`}>
            Attach Payment Proof Screenshot
          </label>
          <span className={`text-[11px] ${dark ? 'text-zinc-400' : 'text-[#717882]'}`}>
            Auto-compressed · JPG / PNG / WEBP
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
          id="proof-drag-drop-input"
        />

        {!proofPreviewUrl ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
              dark
                ? isDragging
                  ? 'border-white bg-white/[0.06]'
                  : 'border-white/15 bg-[#18181B] hover:border-white/35'
                : isDragging
                  ? 'border-[#F7A600] bg-[#FFF7E6]'
                  : 'border-[#D1D5DB] bg-[#F7F8FA] hover:border-[#F7A600]'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center ${
                dark ? 'bg-white/10 text-white' : 'bg-[#FFF7E6] text-[#F7A600]'
              }`}
            >
              <UploadCloud className="w-5 h-5" />
            </div>

            <div>
              <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-[#121417]'}`}>
                {isDragging ? 'Drop screenshot here' : 'Drag & drop payment proof screenshot'}
              </p>
              <p className={`text-xs mt-0.5 ${dark ? 'text-zinc-400' : 'text-[#717882]'}`}>
                or{' '}
                <span className={`font-bold underline ${dark ? 'text-emerald-400' : 'text-[#F7A600]'}`}>
                  choose image from device
                </span>
              </p>
            </div>
          </div>
        ) : (
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
              dark
                ? 'bg-[#18181B] border-emerald-500/35'
                : 'bg-[#F7F8FA] border-[#00B574]/40'
            }`}
          >
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <img
                src={proofPreviewUrl}
                alt="Proof Screenshot"
                className={`w-14 h-14 rounded-xl object-cover border ${
                  dark ? 'border-white/10' : 'border-[#EAECEF]'
                }`}
              />
              <div>
                <div className={`flex items-center gap-1.5 text-xs font-bold ${dark ? 'text-emerald-400' : 'text-[#047857]'}`}>
                  <Check className="w-4 h-4" />
                  <span>Payment Screenshot Ready</span>
                </div>
                <p className={`text-[11px] truncate max-w-xs mt-0.5 ${dark ? 'text-zinc-400' : 'text-[#717882]'}`}>
                  {proofFile ? proofFile.name : 'Receipt compressed & attached'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRemoveProof}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                dark
                  ? 'border-red-500/30 bg-red-500/15 hover:bg-red-500/25 text-red-300'
                  : 'border-red-200 bg-red-50 hover:bg-red-100 text-red-700'
              }`}
            >
              <X className="w-3.5 h-3.5" />
              <span>Change</span>
            </button>
          </div>
        )}

        {uploadError && (
          <p
            className={`text-xs font-medium p-2.5 rounded-xl border ${
              dark
                ? 'text-red-300 bg-red-500/15 border-red-500/30'
                : 'text-[#DC2626] bg-red-50 border-red-200'
            }`}
            role="alert"
          >
            {uploadError}
          </p>
        )}

        <div>
          <label
            htmlFor="tx-hash-input"
            className={`block text-xs font-semibold mb-1 ${dark ? 'text-zinc-400' : 'text-[#717882]'}`}
          >
            Transaction Hash (TxID) — Optional
          </label>
          <input
            id="tx-hash-input"
            type="text"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="0x..."
            className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono-tabular focus:outline-none ${
              dark
                ? 'bg-[#18181B] border-white/[0.1] text-white placeholder:text-zinc-500 focus:border-white'
                : 'bg-[#F7F8FA] border-[#EAECEF] text-[#121417] focus:border-[#121417]'
            }`}
          />
        </div>
      </div>

      {/* Confirmation Actions */}
      <div className="pt-1 flex items-center gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={`px-5 py-3 rounded-full border text-sm font-semibold transition-colors cursor-pointer ${
              dark
                ? 'border-white/10 text-zinc-300 hover:bg-white/5'
                : 'border-[#EAECEF] text-[#4B5563] hover:bg-[#F5F6F8]'
            }`}
          >
            Back
          </button>
        )}

        <button
          type="button"
          disabled={submitting || !proofPreviewUrl}
          onClick={handleSubmit}
          className={`flex-1 py-3 px-6 rounded-full disabled:opacity-50 font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 ${
            dark
              ? 'bg-white hover:bg-zinc-200 text-[#09090B]'
              : 'bg-[#F7A600] hover:bg-[#E59700] text-[#121417]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>
            {submitting
              ? 'Submitting Proof...'
              : 'Submit Payment Proof for Approval'}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
