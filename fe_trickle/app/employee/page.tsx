"use client";

import {
  useAccount, useReadContract, useReadContracts,
  useWriteContract, useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits } from "viem";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { TRICKLE_VAULT_ABI, TRICKLE_VAULT_ADDRESS } from "@/config/contracts";
import { TOKEN_LIST } from "@/config/tokens";
import StreamCard from "@/components/StreamCard";
import DashboardLayout from "@/components/DashboardLayout";
import { useToast } from "@/components/Toast";

type Stream = {
  payer: string; payee: string; token: string;
  amountPerSec: bigint; lastPaid: number; startTime: number;
};

function tokenMeta(address: string) {
  return TOKEN_LIST.find((t) => t.address.toLowerCase() === address.toLowerCase())
    ?? { symbol: "???", decimals: 18 };
}
function streamAccrued(s: Stream, nowSec: number): number {
  const m = tokenMeta(s.token);
  const raw = s.amountPerSec * BigInt(Math.max(0, nowSec - s.lastPaid));
  return parseFloat(formatUnits(raw, m.decimals));
}
function streamMonthly(s: Stream): number {
  const m = tokenMeta(s.token);
  return parseFloat(formatUnits(s.amountPerSec * 2592000n, m.decimals));
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.04] ${className ?? ""}`} />;
}

export default function EmployeeDashboard() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000));
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  /* ── Reads ── */
  const { data: streamIds, isLoading: idsLoading } = useReadContract({
    address: TRICKLE_VAULT_ADDRESS, abi: TRICKLE_VAULT_ABI,
    functionName: "getPayeeStreamIds",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const streamCalls = (streamIds ?? []).map((id: `0x${string}`) => ({
    address: TRICKLE_VAULT_ADDRESS, abi: TRICKLE_VAULT_ABI,
    functionName: "getStream" as const, args: [id] as const,
  }));
  const { data: streamResults, isLoading: streamsLoading } = useReadContracts({
    contracts: streamCalls, query: { enabled: streamCalls.length > 0 },
  });

  const streams: Stream[] = (streamResults ?? [])
    .filter((r) => r.status === "success" && r.result)
    .map((r) => {
      const s = r.result as unknown as {
        payer: string; payee: string; token: string;
        amountPerSec: bigint; lastPaid: bigint; startTime: bigint;
      };
      return { payer: s.payer, payee: s.payee, token: s.token,
        amountPerSec: s.amountPerSec,
        lastPaid: Number(s.lastPaid), startTime: Number(s.startTime) };
    })
    .filter((s) => s.startTime > 0);

  const totalWithdrawable = now > 0
    ? streams.reduce((acc, s) => acc + streamAccrued(s, now), 0)
    : 0;
  const totalMonthly = streams.reduce((acc, s) => acc + streamMonthly(s), 0);

  /* ── Withdraw ── */
  const { writeContract: doWithdraw, data: withdrawTxHash, isPending: isWithdrawPending } = useWriteContract();
  const { isSuccess: withdrawSuccess, isError: withdrawFailed } = useWaitForTransactionReceipt({ hash: withdrawTxHash });

  function handleWithdraw(s: Stream) {
    doWithdraw({
      address: TRICKLE_VAULT_ADDRESS, abi: TRICKLE_VAULT_ABI,
      functionName: "withdraw",
      args: [s.payer as `0x${string}`, s.token as `0x${string}`, s.amountPerSec],
    });
    toast({ type: "pending", message: "Withdrawing earnings…" });
  }
  useEffect(() => {
    if (withdrawSuccess) {
      toast({ type: "success", message: "Withdrawal successful",
        description: "Tokens sent to your wallet", txHash: withdrawTxHash });
      queryClient.invalidateQueries();
    }
  }, [withdrawSuccess]); // eslint-disable-line
  useEffect(() => {
    if (withdrawFailed) toast({ type: "error", message: "Withdrawal failed" });
  }, [withdrawFailed]); // eslint-disable-line

  if (!isConnected) { router.push("/"); return null; }

  const isLoading = idsLoading || streamsLoading;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-xl px-5 py-10">

        {/* ── Page header ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-xl font-semibold text-white">Employee</h1>
          <p className="mt-0.5 text-[12px] text-white/30">Your incoming salary streams</p>
        </motion.div>

        {/* ── Stats grid ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          className="mb-8 grid grid-cols-2 gap-3"
        >
          {/* Withdrawable — glowing green card */}
          <div className="relative card-highlight overflow-hidden p-5">
            {/* Ambient glow blob */}
            <div
              className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-60"
              style={{ background: "radial-gradient(circle, rgba(53,208,127,0.18) 0%, transparent 70%)" }}
            />
            {/* Subtle scanline shimmer on top edge */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#35D07F]/30 to-transparent" />

            <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-[#35D07F]/55">
              <span className="relative flex h-[6px] w-[6px]">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#35D07F] opacity-50" />
                <span className="relative h-[6px] w-[6px] rounded-full bg-[#35D07F]" />
              </span>
              Withdrawable
            </p>
            {isLoading ? (
              <Skeleton className="h-7 w-28 bg-[#35D07F]/10" />
            ) : (
              <p
                className="font-mono text-[22px] font-bold tabular-nums text-[#35D07F]"
                suppressHydrationWarning
              >
                {totalWithdrawable.toFixed(6)}
              </p>
            )}
            <p className="mt-1 text-[10px] text-[#35D07F]/40">Accruing every second</p>
          </div>

          {/* Monthly income */}
          <div className="card relative overflow-hidden p-5">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
            <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.15em] text-white/30">
              Monthly Income
            </p>
            {isLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <p className="font-mono text-[22px] font-bold tabular-nums text-white">
                {totalMonthly.toFixed(2)}
              </p>
            )}
            <p className="mt-1 text-[10px] text-white/20">
              {streams.length > 0 ? `${streams.length} active stream${streams.length > 1 ? "s" : ""}` : "No streams yet"}
            </p>
          </div>
        </motion.div>

        {/* ── Streams ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}>
          <p className="mb-4 text-[12px] font-medium text-white/40">
            Incoming streams
            <span className="ml-2 tabular-nums text-white/20">({streams.length})</span>
          </p>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-[130px]" />)}
            </div>
          ) : streams.length === 0 ? (
            <div className="card px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.04]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <circle cx="12" cy="16" r="0.5" fill="rgba(255,255,255,0.25)" strokeWidth="2" />
                </svg>
              </div>
              <p className="text-[13px] text-white/30 mb-1">No incoming streams</p>
              <p className="text-[12px] text-white/20">Ask your employer to create a stream to your address</p>
            </div>
          ) : (
            <div className="space-y-3">
              {streams.map((s, i) => (
                <StreamCard key={i} {...s} role="payee" onWithdraw={() => handleWithdraw(s)} isPending={isWithdrawPending} />
              ))}
            </div>
          )}
        </motion.div>

        {/* ── Address ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-12 text-center">
          <p className="mb-2 text-[10px] uppercase tracking-[0.15em] text-white/20">Your address</p>
          <p className="break-all font-mono text-[11px] text-white/30">{address}</p>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
