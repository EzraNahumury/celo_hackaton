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
    TOKEN_LIST.find(
      (t) => t.address.toLowerCase() === address.toLowerCase()
    ) ?? { symbol: "???", decimals: 18 }
  );
}

function formatAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function StreamCard({
  payer,
  payee,
  token,
  amountPerSec,
  lastPaid,
  startTime,
  role,
  onWithdraw,
  onCancel,
  isPending,
}: StreamCardProps) {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const tokenInfo = getTokenInfo(token);

  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsed = BigInt(Math.max(0, now - lastPaid));
  const accrued = amountPerSec * elapsed;
  const monthlyRate = amountPerSec * 2592000n;
  const totalStreamed = amountPerSec * BigInt(Math.max(0, now - startTime));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5"
    >
      {/* Top row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#35D07F] animate-pulse" />
            <span className="text-[13px] font-medium text-white">
              {tokenInfo.symbol}
            </span>
          </div>
          <span className="text-[12px] text-gray-600">
            {role === "payer" ? "to" : "from"}{" "}
            <span className="font-mono">{formatAddr(role === "payer" ? payee : payer)}</span>
          </span>
        </div>
        <span className="text-[12px] text-gray-600">
          {parseFloat(formatUnits(monthlyRate, tokenInfo.decimals)).toFixed(2)}/mo
        </span>
      </div>

      {/* Withdrawable counter (payee only) */}
      {role === "payee" && (
        <div className="card-highlight p-4 mb-4">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[#35D07F]/50 mb-2">
            Withdrawable
          </p>
          <span className="font-mono text-xl font-semibold text-[#35D07F] tabular-nums">
            {parseFloat(formatUnits(accrued, tokenInfo.decimals)).toFixed(8)}
          </span>
          <span className="ml-1.5 text-[12px] text-[#35D07F]/50">{tokenInfo.symbol}</span>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-6 mb-4 text-[12px]">
        <div>
          <span className="text-gray-600">Streamed </span>
          <span className="font-mono text-gray-400">
            {parseFloat(formatUnits(totalStreamed, tokenInfo.decimals)).toFixed(4)}
          </span>
        </div>
        <div>
          <span className="text-gray-600">Since </span>
          <span className="text-gray-400">
            {new Date(startTime * 1000).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Action */}
      {role === "payee" && onWithdraw && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onWithdraw}
          disabled={isPending || accrued === 0n}
          className="w-full rounded-lg bg-[#35D07F] py-2.5 text-[13px] font-semibold text-[#050a0e] transition-colors hover:bg-[#3de08d] disabled:opacity-40"
        >
          {isPending ? "Withdrawing..." : "Withdraw"}
        </motion.button>
      )}
      {role === "payer" && onCancel && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onCancel}
          disabled={isPending}
          className="w-full rounded-lg border border-white/[0.06] py-2.5 text-[13px] font-medium text-gray-400 transition-colors hover:border-red-500/20 hover:text-red-400 disabled:opacity-40"
        >
          {isPending ? "Cancelling..." : "Cancel Stream"}
        </motion.button>
      )}
    </motion.div>
  );
}
