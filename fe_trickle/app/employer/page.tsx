"use client";

import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { TRICKLE_VAULT_ABI, TRICKLE_VAULT_ADDRESS, ERC20_ABI } from "@/config/contracts";
import { TOKENS, TOKEN_LIST } from "@/config/tokens";
import StreamCard from "@/components/StreamCard";
import DashboardLayout from "@/components/DashboardLayout";

type Stream = {
  payer: string; payee: string; token: string;
  amountPerSec: bigint; lastPaid: number; startTime: number;
};

export default function EmployerDashboard() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [selectedToken, setSelectedToken] = useState("cUSD");
  const [depositAmount, setDepositAmount] = useState("");
  const [showDeposit, setShowDeposit] = useState(false);

  const tokenInfo = TOKENS[selectedToken];

  const { data: balance } = useReadContract({
    address: TRICKLE_VAULT_ADDRESS, abi: TRICKLE_VAULT_ABI,
    functionName: "balances",
    args: address ? [address, tokenInfo.address] : undefined,
    query: { enabled: !!address },
  });

  const { data: walletBalance } = useReadContract({
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

  const streams: Stream[] = (streamResults ?? [])
    .filter((r) => r.status === "success" && r.result)
    .map((r) => {
      const s = r.result as unknown as {
        payer: string; payee: string; token: string;
        amountPerSec: bigint; lastPaid: bigint; startTime: bigint;
      };
      return {
        payer: s.payer, payee: s.payee, token: s.token,
        amountPerSec: s.amountPerSec,
        lastPaid: Number(s.lastPaid), startTime: Number(s.startTime),
      };
    })
    .filter((s) => s.startTime > 0);

  const { writeContract: approve, data: approveTxHash } = useWriteContract();
  const { isLoading: isApproving } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { writeContract: deposit, data: depositTxHash } = useWriteContract();
  const { isLoading: isDepositing } = useWaitForTransactionReceipt({ hash: depositTxHash });
  const { writeContract: cancelStream, isPending: isCancelPending } = useWriteContract();

  function handleDeposit() {
    if (!address || !depositAmount) return;
    const amount = parseUnits(depositAmount, tokenInfo.decimals);
    approve({
      address: tokenInfo.address, abi: ERC20_ABI,
      functionName: "approve", args: [TRICKLE_VAULT_ADDRESS, amount],
    });
    setTimeout(() => {
      deposit({
        address: TRICKLE_VAULT_ADDRESS, abi: TRICKLE_VAULT_ABI,
        functionName: "deposit", args: [tokenInfo.address, amount],
      });
    }, 2000);
  }

  function handleCancel(stream: Stream) {
    cancelStream({
      address: TRICKLE_VAULT_ADDRESS, abi: TRICKLE_VAULT_ABI,
      functionName: "cancelStream",
      args: [stream.payee as `0x${string}`, stream.token as `0x${string}`, stream.amountPerSec],
    });
  }

  if (!isConnected) { router.push("/"); return null; }

  const balanceNum = balance ? parseFloat(formatUnits(balance as bigint, tokenInfo.decimals)) : 0;
  const walletNum = walletBalance ? parseFloat(formatUnits(walletBalance as bigint, tokenInfo.decimals)) : 0;
  const monthlyBurn = totalRate ? parseFloat(formatUnits((totalRate as bigint) * 2592000n, tokenInfo.decimals)) : 0;

  return (
    <DashboardLayout>
    <div className="mx-auto max-w-xl px-6 py-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Employer</h1>
        <Link
          href="/employer/create"
          className="flex items-center gap-1.5 rounded-lg bg-[#35D07F] px-4 py-2 text-[13px] font-semibold text-[#050a0e] transition-colors hover:bg-[#3de08d]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          New Stream
        </Link>
      </motion.div>

      {/* Token Tabs */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="mb-6 flex gap-1.5">
        {TOKEN_LIST.map((t) => (
          <button
            key={t.symbol}
            onClick={() => setSelectedToken(t.symbol)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
              selectedToken === t.symbol
                ? "bg-white/[0.08] text-white"
                : "text-gray-600 hover:text-gray-400"
            }`}
          >
            {t.symbol}
          </button>
        ))}
      </motion.div>

      {/* Balance Card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-gray-600 mb-2">Vault Balance</p>
            <p className="text-3xl font-semibold text-white tabular-nums">
              {balanceNum.toFixed(2)}
              <span className="ml-1.5 text-sm text-gray-600">{tokenInfo.symbol}</span>
            </p>
            <div className="mt-2 flex gap-4 text-[11px] text-gray-600">
              <span>Wallet: {walletNum.toFixed(2)}</span>
              {monthlyBurn > 0 && <span>Burn: {monthlyBurn.toFixed(2)}/mo</span>}
            </div>
          </div>
          <button
            onClick={() => setShowDeposit(!showDeposit)}
            className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-gray-400 transition-colors hover:text-white hover:border-white/[0.12]"
          >
            {showDeposit ? "Close" : "Deposit"}
          </button>
        </div>

        <AnimatePresence>
          {showDeposit && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-5 flex gap-2 pt-5 border-t border-white/[0.04]">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Amount"
                  className="flex-1 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-[13px] text-white placeholder-gray-700 focus:border-[#35D07F]/30 focus:outline-none"
                />
                <button
                  onClick={handleDeposit}
                  disabled={isApproving || isDepositing || !depositAmount}
                  className="rounded-lg bg-[#35D07F] px-4 py-2 text-[13px] font-semibold text-[#050a0e] hover:bg-[#3de08d] disabled:opacity-40"
                >
                  {isApproving ? "Approving..." : isDepositing ? "Depositing..." : "Deposit"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Streams */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <p className="mb-4 text-[13px] text-gray-500">
          Active streams <span className="text-gray-700">({streams.length})</span>
        </p>

        {streams.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-[13px] text-gray-600">No streams yet</p>
            <Link href="/employer/create" className="mt-2 inline-block text-[13px] text-[#35D07F] hover:underline">
              Create your first stream
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
