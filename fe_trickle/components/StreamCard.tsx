"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { motion } from "framer-motion";
import { TOKEN_LIST } from "@/config/tokens";

interface StreamCardProps {
  payer: string;
  payee: string;
  token: string;
  amountPerSec: bigint;
  lastPaid: number;
  startTime: number;
  role: "payer" | "payee";
  onWithdraw?: () => void;
  onCancel?: () => void;
  isPending?: boolean;
}

function getTokenInfo(address: string) {
  return (
    TOKEN_LIST.find((t) => t.address.toLowerCase() === address.toLowerCase()) ??
    { symbol: "???", decimals: 18 }
  );
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function elapsed(from: number, nowSec: number) {
  const s = Math.max(0, nowSec - from);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function StreamCard({
  payer, payee, token, amountPerSec, lastPaid, startTime,
  role, onWithdraw, onCancel, isPending,
}: StreamCardProps) {
  const [now, setNow] = useState(0);
  const tokenInfo = getTokenInfo(token);

  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000));
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const accrued     = amountPerSec * BigInt(Math.max(0, now - lastPaid));
  const monthlyRate = amountPerSec * 2592000n;
  const totalSent   = amountPerSec * BigInt(Math.max(0, now - startTime));

  const accruedNum  = parseFloat(formatUnits(accrued,     tokenInfo.decimals));
  const monthlyNum  = parseFloat(formatUnits(monthlyRate, tokenInfo.decimals));
  const totalNum    = parseFloat(formatUnits(totalSent,   tokenInfo.decimals));

  const counterParty = role === "payer" ? payee : payer;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card relative overflow-hidden"
    >
      {/* Inner top sheen */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="p-5">
        {/* ── Top row: token + direction + monthly ── */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Live badge */}
            <div className="flex items-center gap-1.5 rounded-full border border-[#35D07F]/20 bg-[#35D07F]/8 px-2.5 py-1">
              <span className="relative flex h-[6px] w-[6px]">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#35D07F] opacity-50" />
                <span className="relative h-[6px] w-[6px] rounded-full bg-[#35D07F]" />
              </span>
              <span className="text-[11px] font-semibold text-[#35D07F]">
                {tokenInfo.symbol}
              </span>
            </div>

            {/* Direction + address */}
            <span className="text-[12px] text-white/30">
              {role === "payer" ? "→" : "←"}{" "}
              <span className="font-mono text-white/50">{shortAddr(counterParty)}</span>
            </span>
          </div>

          {/* Monthly rate */}
          <div className="text-right">
            <span className="font-mono text-[13px] font-medium text-white/60">
              {monthlyNum.toFixed(2)}
            </span>
            <span className="ml-1 text-[11px] text-white/25">/mo</span>
          </div>
        </div>

        {/* ── Withdrawable counter (payee only) ── */}
        {role === "payee" && (
          <div className="card-highlight relative mb-4 overflow-hidden px-4 py-3.5">
            {/* Ambient glow */}
            <div
              className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-70"
              style={{ background: "radial-gradient(circle, rgba(53,208,127,0.15) 0%, transparent 70%)" }}
            />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#35D07F]/25 to-transparent" />

            <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.15em] text-[#35D07F]/50">
              Withdrawable
            </p>
            <div className="flex items-baseline gap-1.5" suppressHydrationWarning>
              <span className="font-mono text-[20px] font-bold tabular-nums text-[#35D07F]">
                {accruedNum.toFixed(8)}
              </span>
              <span className="text-[11px] text-[#35D07F]/50">{tokenInfo.symbol}</span>
            </div>
          </div>
        )}

        {/* ── Stats row ── */}
        <div className="mb-4 flex items-center gap-5 text-[11px]">
          <div className="flex items-center gap-1.5 text-white/30">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
            </svg>
            <span>
              <span className="font-mono text-white/50">{totalNum.toFixed(4)}</span>
              <span className="ml-1 text-white/25">streamed</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-white/30">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" />
            </svg>
            <span>
              {now > 0 && (
                <span className="font-mono text-white/50">{elapsed(startTime, now)}</span>
              )}
              <span className="ml-1 text-white/25">running</span>
            </span>
          </div>

          <div className="ml-auto text-[10px] text-white/20">
            since {new Date(startTime * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
        </div>

        {/* ── Action button ── */}
        {role === "payee" && onWithdraw && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onWithdraw}
            disabled={isPending || accruedNum === 0}
            className="w-full rounded-xl bg-[#35D07F] py-2.5 text-[13px] font-semibold text-[#050a0e] shadow-md shadow-[#35D07F]/20 transition-all hover:bg-[#3de08d] hover:shadow-[#35D07F]/30 disabled:opacity-40 disabled:shadow-none"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
                </svg>
                Withdrawing…
              </span>
            ) : "Withdraw"}
          </motion.button>
        )}

        {role === "payer" && onCancel && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onCancel}
            disabled={isPending}
            className="group w-full rounded-xl border border-white/[0.07] py-2.5 text-[13px] font-medium text-white/40 transition-all hover:border-red-400/25 hover:bg-red-400/5 hover:text-red-400 disabled:opacity-40"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
                </svg>
                Cancelling…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-60 group-hover:opacity-100">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Cancel Stream
              </span>
            )}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
