import { useEffect, useState, type FormEvent } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  QrCode,
  ShieldCheck,
  Upload,
  X,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatUsd, type ChallengeSpec } from '../utils/challenges';

interface PaymentGatewayModalProps {
  isOpen: boolean;
  spec: ChallengeSpec;
  finalFeeUsd: number;
  promoCode?: string;
  traderName: string;
  traderEmail: string;
  onClose: () => void;
  onPaymentSubmitted: (paymentDetails: {
    paymentMethod: string;
    paymentProofUrl: string;
  }) => Promise<void> | void;
}

const NETWORKS = [
  { id: 'bep20-bnb', name: 'BNB Smart Chain (BEP20)', symbol: 'BNB', address: '0x67aeec70d2f322e5046981764718fd1ca5ca78ce', feeNote: '0.0001 BNB network fee' },
  { id: 'trc20-usdt', name: 'Tether USDT (TRC20)', symbol: 'USDT', address: '0xLemonFundingUSDT99887766554321', feeNote: '$1 TRC20 network fee' },
  { id: 'erc20-eth', name: 'Ethereum (ERC20)', symbol: 'ETH', address: '0xLemonFundingETH112233445566', feeNote: '$5 ERC20 network fee' },
];

export function PaymentGatewayModal({
  isOpen,
  spec,
  finalFeeUsd,
  promoCode,
  traderName,
  traderEmail,
  onClose,
  onPaymentSubmitted,
}: PaymentGatewayModalProps) {
  const [selectedNetwork, setSelectedNetwork] = useState(NETWORKS[0]);
  const [timeLeftMs, setTimeLeftMs] = useState(10 * 60 * 1000); // 10 minutes
  const [copied, setCopied] = useState(false);
  const [proofFileUrl, setProofFileUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTimeLeftMs(10 * 60 * 1000);
    setCopied(false);
    setProofFileUrl('');
    setErrorMsg('');

    const timer = setInterval(() => {
      setTimeLeftMs((prev) => {
        if (prev <= 1000) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeftMs / 60000);
  const seconds = Math.floor((timeLeftMs % 60000) / 1000);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedNetwork.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProofFileUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!proofFileUrl) {
      setErrorMsg('Please upload your payment transfer receipt / screenshot to submit for admin approval.');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);
    try {
      await onPaymentSubmitted({
        paymentMethod: `Crypto (${selectedNetwork.name})`,
        paymentProofUrl: proofFileUrl,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gateway-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141A10]/75 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#FCFBF4] border border-[#141A10]/25 shadow-2xl"
        >
          {/* Header Strip */}
          <div className="flex items-center justify-between px-6 py-4 bg-[#141A10] text-[#FCFBF4]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FACC15] text-[#141A10] flex items-center justify-center font-bold shadow-md">
                🍋
              </div>
              <div>
                <h2 id="gateway-title" className="font-display font-bold text-base text-white">
                  LemonPay™ Secure Crypto Gateway
                </h2>
                <p className="text-[11px] text-[#A3B192]">
                  Instant Escrow &amp; Prop Account Activation
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* 10-Min Timer Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FEF08A]/15 border border-[#FEF08A]/30 text-[#FACC15] font-mono-tabular text-xs font-bold">
                <Clock className="w-3.5 h-3.5 animate-pulse" />
                <span>
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close payment gateway"
                className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-6">
            {/* Order Summary Strip */}
            <div className="p-4 rounded-2xl bg-[#F4F5EA] border border-[#141A10]/10 flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#556146] block">
                  Selected Challenge
                </span>
                <p className="font-display font-bold text-sm text-[#141A10] mt-0.5">
                  {spec.modeLabel} · {formatUsd(spec.accountSize)}
                </p>
                <p className="text-xs text-[#4A5340]">
                  Trader: {traderName} ({traderEmail})
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-[#556146] block">Total Due</span>
                <span className="font-mono-tabular text-xl font-bold text-[#15803D]">
                  {formatUsd(finalFeeUsd)}
                </span>
              </div>
            </div>

            {/* Network Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#141A10] uppercase tracking-wider">
                1. Select Crypto Network &amp; Currency
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {NETWORKS.map((net) => (
                  <button
                    key={net.id}
                    type="button"
                    onClick={() => setSelectedNetwork(net)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      selectedNetwork.id === net.id
                        ? 'bg-[#141A10] text-[#FCFBF4] border-[#141A10] shadow-md ring-2 ring-[#FACC15]/40'
                        : 'bg-white text-[#141A10] border-[#141A10]/15 hover:border-[#141A10]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs">{net.symbol}</span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        selectedNetwork.id === net.id ? 'border-[#FACC15] bg-[#FACC15] text-[#141A10]' : 'border-gray-300'
                      }`}>
                        {selectedNetwork.id === net.id && <Check className="w-3 h-3 font-bold" />}
                      </div>
                    </div>
                    <span className={`text-[11px] font-medium truncate ${selectedNetwork.id === net.id ? 'text-[#A3B192]' : 'text-[#556146]'}`}>
                      {net.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Deposit Address & QR Code Box */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#141A10]/12 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* QR Code Graphic Mock */}
                <div className="w-28 h-28 shrink-0 bg-[#F4F5EA] border border-[#141A10]/15 rounded-2xl flex flex-col items-center justify-center p-2 text-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-radial from-[#FEF08A]/40 to-transparent opacity-60" />
                  <QrCode className="w-16 h-16 text-[#141A10] relative z-10" />
                  <span className="text-[9px] font-bold text-[#141A10] mt-1 relative z-10">Scan to Pay</span>
                </div>

                <div className="flex-1 w-full space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#556146]">
                      {selectedNetwork.name} Deposit Address:
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                      {selectedNetwork.feeNote}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 bg-[#F4F5EA] p-2.5 rounded-xl border border-[#141A10]/15">
                    <span className="font-mono-tabular text-xs font-bold text-[#141A10] truncate select-all">
                      {selectedNetwork.address}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-[#141A10] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-[#15803D]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-[#4A5340] italic">
                    Send exact amount of {formatUsd(finalFeeUsd)} in {selectedNetwork.symbol} on {selectedNetwork.name}.
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Proof Screenshot Upload */}
            <div className="p-4 rounded-2xl bg-white border border-[#141A10]/12 space-y-3">
              <label className="block text-xs font-bold text-[#141A10] uppercase tracking-wider">
                2. Upload Transfer Hash / Payment Receipt
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-[#556146] file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#141A10] file:text-[#FCFBF4] hover:file:bg-[#232D1C] file:cursor-pointer cursor-pointer"
                />
              </div>

              {proofFileUrl && (
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#DCFCE7]/60 border border-[#15803D]/25">
                  <img src={proofFileUrl} alt="Proof" className="w-12 h-12 object-cover rounded-lg border border-[#15803D]/30" />
                  <div>
                    <p className="text-xs font-bold text-[#14532D] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Payment receipt attached successfully</span>
                    </p>
                    <p className="text-[10px] text-[#556146]">Ready for instant admin verification.</p>
                  </div>
                </div>
              )}

              {errorMsg && (
                <p className="text-xs font-medium text-[#DC2626] bg-red-50 p-2.5 rounded-xl border border-red-200" role="alert">
                  {errorMsg}
                </p>
              )}
            </div>

            {/* Footer Action */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 rounded-xl border border-[#141A10]/20 text-sm font-semibold text-[#394230] hover:bg-[#F4F5EA] transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting || !proofFileUrl}
                className="flex-1 py-3 px-5 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-50 text-[#141A10] font-bold text-sm border border-[#141A10]/15 transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <ShieldCheck className="w-4 h-4 text-[#141A10]" />
                <span>{submitting ? 'Submitting Payment Proof...' : 'I Have Paid — Submit for Approval'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
