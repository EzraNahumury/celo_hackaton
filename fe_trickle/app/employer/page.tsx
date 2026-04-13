"use client";

import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  TRICKLE_VAULT_ABI,
  TRICKLE_VAULT_ADDRESS,
  ERC20_ABI,
} from "@/config/contracts";
import { TOKENS, TOKEN_LIST } from "@/config/tokens";
import StreamCard from "@/components/StreamCard";
import DashboardLayout from "@/components/DashboardLayout";
import { useDeposit } from "@/hooks/useDeposit";
import { useToast } from "@/components/Toast";

type Stream = {
  payer: string; payee: string; token: string;
  amountPerSec: bigint; lastPaid: number; startTime: number;
};

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.04] ${className ?? ""}`} />;
}

export default function EmployerDashboard() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedToken, setSelectedToken] = useState("cUSD");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [panel, setPanel] = useState<"none" | "deposit" | "withdraw">("none");

  const tokenInfo = TOKENS[selectedToken];

  /* ── Reads ── */
  const { data: vaultBalance, isLoading: balanceLoading } = useReadContract({
    address: TRICKLE_VAULT_ADDRESS, abi: TRICKLE_VAULT_ABI,
    functionName: "balances",
    args: address ? [address, tokenInfo.address] : undefined,
    query: { enabled: !!address },
  });
  const { data: walletBalance, isLoading: walletLoading } = useReadContract({
    address: tokenInfo.address, abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: totalRate } = useReadContract({
    address: TRICKLE_VAULT_ADDRESS, abi: TRICKLE_VAULT_ABI,
    functionName: "totalPaidPerSec",
    args: address ? [address, tokenInfo.address] : undefined,
    query: { enabled: !!address },
  });
  const { data: streamIds } = useReadContract({
    address: TRICKLE_VAULT_ADDRESS, abi: TRICKLE_VAULT_ABI,
    functionName: "getPayerStreamIds",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const streamCalls = (streamIds ?? []).map((id: `0x${string}`) => ({
    address: TRICKLE_VAULT_ADDRESS, abi: TRICKLE_VAULT_ABI,
    functionName: "getStream" as const, args: [id] as const,
  }));
  const { data: streamResults } = useReadContracts({
    contracts: streamCalls,
    query: { enabled: streamCalls.length > 0 },
  });

  const allStreams: Stream[] = (streamResults ?? [])
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

  const streams = allStreams.filter(
    (s) => s.token.toLowerCase() === tokenInfo.address.toLowerCase()
  );

  /* ── Deposit flow ── */
  const depositFlow = useDeposit();

  function handleDeposit() {
    if (!address || !depositAmount) return;
    depositFlow.deposit(tokenInfo.address, parseUnits(depositAmount, tokenInfo.decimals));
  }

  useEffect(() => {
    if (depositFlow.isDone) {
      toast({ type: "success", message: "Deposit successful",
        description: `${depositAmount} ${tokenInfo.symbol} added to vault`,
        txHash: depositFlow.depositTxHash });
      setDepositAmount(""); setPanel("none");
      depositFlow.reset(); queryClient.invalidateQueries();
    }
  }, [depositFlow.isDone]); // eslint-disable-line

  useEffect(() => {
    if (depositFlow.isError) {
      toast({ type: "error", message: "Deposit failed",
        description: depositFlow.error?.message?.slice(0, 80) ?? "Rejected" });
      depositFlow.reset();
    }
  }, [depositFlow.isError]); // eslint-disable-line

  /* ── Withdraw vault balance ── */
  const { writeContract: doWithdrawBalance, data: wbTxHash } = useWriteContract();
  const { isSuccess: wbSuccess, isError: wbFailed } = useWaitForTransactionReceipt({ hash: wbTxHash });

  function handleWithdrawBalance() {
    if (!address || !withdrawAmount) return;
    doWithdrawBalance({
      address: TRICKLE_VAULT_ADDRESS, abi: TRICKLE_VAULT_ABI,
      functionName: "withdrawBalance",
      args: [tokenInfo.address, parseUnits(withdrawAmount, tokenInfo.decimals)],
    });
    toast({ type: "pending", message: "Withdrawing from vault…" });
  }
  useEffect(() => {
    if (wbSuccess) {
      toast({ type: "success", message: "Withdrawn successfully",
        description: `${withdrawAmount} ${tokenInfo.symbol} to wallet`, txHash: wbTxHash });
      setWithdrawAmount(""); setPanel("none"); queryClient.invalidateQueries();
    }
  }, [wbSuccess]); // eslint-disable-line
  useEffect(() => {
    if (wbFailed) toast({ type: "error", message: "Withdrawal failed" });
  }, [wbFailed]); // eslint-disable-line

  /* ── Cancel stream ── */
  const { writeContract: cancelStream, data: cancelTxHash, isPending: isCancelPending } = useWriteContract();
  const { isSuccess: cancelSuccess } = useWaitForTransactionReceipt({ hash: cancelTxHash });

  function handleCancel(stream: Stream) {
    cancelStream({
      address: TRICKLE_VAULT_ADDRESS, abi: TRICKLE_VAULT_ABI,
      functionName: "cancelStream",
      args: [stream.payee as `0x${string}`, stream.token as `0x${string}`, stream.amountPerSec],
    });
    toast({ type: "pending", message: "Cancelling stream…" });
  }
  useEffect(() => {
    if (cancelSuccess) {
      toast({ type: "success", message: "Stream cancelled",
        description: "Remaining balance returned to vault", txHash: cancelTxHash });
      queryClient.invalidateQueries();
    }
  }, [cancelSuccess]); // eslint-disable-line

  if (!isConnected) { router.push("/"); return null; }

  const balanceNum = vaultBalance ? parseFloat(formatUnits(vaultBalance as bigint, tokenInfo.decimals)) : 0;
  const walletNum = walletBalance ? parseFloat(formatUnits(walletBalance as bigint, tokenInfo.decimals)) : 0;
  const monthlyBurn = totalRate ? parseFloat(formatUnits((totalRate as bigint) * 2592000n, tokenInfo.decimals)) : 0;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-xl px-5 py-10">

        {/* ── Page header ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-xl font-semibold text-white">Employer</h1>
            <p className="mt-0.5 text-[12px] text-white/30">Manage payroll streams</p>
          </div>
          <Link
            href="/employer/create"
            className="flex items-center gap-1.5 rounded-xl bg-[#35D07F] px-4 py-2.5 text-[13px] font-semibold text-[#050a0e] shadow-lg shadow-[#35D07F]/25 transition-all hover:bg-[#3de08d] hover:shadow-[#35D07F]/35 active:scale-[0.97]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Stream
          </Link>
        </motion.div>

        {/* ── Token tabs ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="mb-6"
        >
          <div className="inline-flex items-center rounded-xl border border-white/[0.06] bg-white/[0.03] p-1 gap-1 shadow-inner shadow-black/20">
            {TOKEN_LIST.map((t) => (
              <button
                key={t.symbol}
                onClick={() => { setSelectedToken(t.symbol); setPanel("none"); }}
                className={`rounded-lg px-4 py-2 text-[12px] font-medium transition-all duration-200 ${
                  selectedToken === t.symbol
                    ? "bg-white/[0.1] text-white shadow-sm border border-white/[0.09]"
                    : "text-white/35 hover:text-white/60 hover:bg-white/[0.04]"
                }`}
              >
                {t.symbol}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Vault balance card ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card mb-6 overflow-hidden"
        >
          {/* Inner top sheen */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />

          <div className="p-6">
            <div className="flex items-start justify-between">
              {/* Balance info */}
              <div>
                <p className="mb-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-white/30">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
                  </svg>
                  Vault Balance
                </p>
                {balanceLoading ? (
                  <Skeleton className="h-10 w-32 mb-1" />
                ) : (
                  <p className="font-mono text-4xl font-bold tabular-nums text-white">
                    {balanceNum.toFixed(2)}
                    <span className="ml-2 text-base font-normal text-white/30">{tokenInfo.symbol}</span>
                  </p>
                )}
                <div className="mt-3 flex items-center gap-5 text-[12px] text-white/30">
                  {walletLoading ? (
                    <Skeleton className="h-3.5 w-28" />
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M21 12V7H5a2 2 0 010-4h14v4" /><path d="M3 7v13a2 2 0 002 2h16v-5" /><path d="M18 12a2 2 0 000 4h4v-4z" />
                      </svg>
                      Wallet: {walletNum.toFixed(2)}
                    </span>
                  )}
                  {monthlyBurn > 0 && (
                    <span className="flex items-center gap-1.5 text-amber-400/50">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M12 2c0 6-8 8-8 14a8 8 0 0016 0c0-6-8-8-8-14z" />
                      </svg>
                      {monthlyBurn.toFixed(2)}/mo
                    </span>
                  )}
                </div>
              </div>

              {/* Panel buttons */}
              <div className="flex flex-col gap-2 items-end shrink-0">
                <button
                  onClick={() => setPanel((p) => (p === "deposit" ? "none" : "deposit"))}
                  className={`rounded-lg border px-3.5 py-1.5 text-[12px] font-medium transition-all duration-200 ${
                    panel === "deposit"
                      ? "border-[#35D07F]/30 bg-[#35D07F]/8 text-[#35D07F]"
                      : "border-white/[0.07] text-white/40 hover:border-white/[0.12] hover:text-white/70 hover:bg-white/[0.04]"
                  }`}
                >
                  Deposit
                </button>
                <button
                  onClick={() => setPanel((p) => (p === "withdraw" ? "none" : "withdraw"))}
                  className={`rounded-lg border px-3.5 py-1.5 text-[12px] font-medium transition-all duration-200 ${
                    panel === "withdraw"
                      ? "border-red-400/30 bg-red-400/5 text-red-400"
                      : "border-white/[0.07] text-white/40 hover:border-white/[0.12] hover:text-white/70 hover:bg-white/[0.04]"
                  }`}
                >
                  Withdraw
                </button>
              </div>
            </div>

            {/* Expandable panels */}
            <AnimatePresence>
              {panel === "deposit" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 pt-5 border-t border-white/[0.05]">
                    {/* Step progress */}
                    {depositFlow.isPending && (
                      <div className="mb-3 flex items-center gap-2 text-[11px]">
                        <StepDot active={depositFlow.phase === "approving"} done={depositFlow.phase === "depositing" || depositFlow.isDone} label="Approve" />
                        <span className="text-white/20">→</span>
                        <StepDot active={depositFlow.phase === "depositing"} done={depositFlow.isDone} label="Deposit" />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="number" value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="Amount"
                        disabled={depositFlow.isPending}
                        className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-2.5 text-[13px] text-white placeholder-white/20 focus:border-[#35D07F]/35 focus:outline-none disabled:opacity-40 transition-colors"
                      />
                      <button
                        onClick={handleDeposit}
                        disabled={depositFlow.isPending || !depositAmount}
                        className="rounded-xl bg-[#35D07F] px-5 py-2.5 text-[13px] font-semibold text-[#050a0e] shadow-md shadow-[#35D07F]/20 hover:bg-[#3de08d] disabled:opacity-40 transition-all"
                      >
                        {depositFlow.phase === "approving" ? "Approving…" : depositFlow.phase === "depositing" ? "Depositing…" : "Deposit"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {panel === "withdraw" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 pt-5 border-t border-white/[0.05]">
                    <p className="mb-3 text-[11px] text-white/30">Withdraw deposited funds back to your wallet</p>
                    <div className="flex gap-2">
                      <input
                        type="number" value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder={`Max ${balanceNum.toFixed(2)}`}
                        className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-2.5 text-[13px] text-white placeholder-white/20 focus:border-red-400/35 focus:outline-none transition-colors"
                      />
                      <button
                        onClick={handleWithdrawBalance}
                        disabled={!withdrawAmount || Number(withdrawAmount) > balanceNum}
                        className="rounded-xl border border-red-400/20 bg-red-400/5 px-5 py-2.5 text-[13px] font-semibold text-red-400 hover:bg-red-400/10 hover:border-red-400/30 disabled:opacity-40 transition-all"
                      >
                        Withdraw
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── Streams section ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18 }}
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[12px] font-medium text-white/40">
              {selectedToken} streams
              <span className="ml-2 tabular-nums text-white/20">({streams.length})</span>
            </p>
          </div>

          {streams.length === 0 ? (
            <div className="card px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.04]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <p className="text-[13px] text-white/30 mb-1">No {selectedToken} streams</p>
              <Link href="/employer/create" className="text-[13px] text-[#35D07F]/80 hover:text-[#35D07F] transition-colors">
                Create your first stream →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {streams.map((s, i) => (
                <StreamCard key={i} {...s} role="payer" onCancel={() => handleCancel(s)} isPending={isCancelPending} />
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1 transition-colors ${done ? "text-[#35D07F]" : active ? "text-white" : "text-white/25"}`}>
      <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-bold ${done ? "border-[#35D07F] bg-[#35D07F]/10" : active ? "border-white/30 bg-white/5" : "border-white/10"}`}>
        {done ? "✓" : ""}
      </span>
      {label}
    </span>
  );
}
