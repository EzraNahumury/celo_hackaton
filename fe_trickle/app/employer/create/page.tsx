"use client";

import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { TRICKLE_VAULT_ABI, TRICKLE_VAULT_ADDRESS, ERC20_ABI } from "@/config/contracts";
import { TOKENS, TOKEN_LIST } from "@/config/tokens";
import DashboardLayout from "@/components/DashboardLayout";

export default function CreateStream() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  const [payeeAddress, setPayeeAddress] = useState("");
  const [selectedToken, setSelectedToken] = useState("cUSD");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [step, setStep] = useState<"form" | "review">("form");

  const tokenInfo = TOKENS[selectedToken];

  const { data: vaultBalance } = useReadContract({
    address: TRICKLE_VAULT_ADDRESS, abi: TRICKLE_VAULT_ABI,
    functionName: "balances",
    args: address ? [address, tokenInfo.address] : undefined,
    query: { enabled: !!address },
  });

  const { writeContract: approve, data: approveTxHash } = useWriteContract();
  const { isLoading: isApproving } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { writeContract: depositFn, data: depositTxHash } = useWriteContract();
  const { isLoading: isDepositing } = useWaitForTransactionReceipt({ hash: depositTxHash });
  const { writeContract: createStream, data: createTxHash, isPending: isCreatePending } = useWriteContract();
  const { isLoading: isCreateConfirming, isSuccess: isCreated } = useWaitForTransactionReceipt({ hash: createTxHash });

  function calcAmountPerSec(): bigint {
    if (!monthlySalary || isNaN(Number(monthlySalary))) return 0n;
    return parseUnits(monthlySalary, tokenInfo.decimals) / 2592000n;
  }

  function handleCreateStream() {
    if (!address || !payeeAddress) return;
    const amountPerSec = calcAmountPerSec();
    if (amountPerSec === 0n) return;

    const monthlyWei = parseUnits(monthlySalary, tokenInfo.decimals);
    const currentVaultBalance = (vaultBalance as bigint) ?? 0n;

    if (currentVaultBalance < monthlyWei) {
      const needed = monthlyWei - currentVaultBalance;
      approve({ address: tokenInfo.address, abi: ERC20_ABI, functionName: "approve", args: [TRICKLE_VAULT_ADDRESS, needed] });
      setTimeout(() => {
        depositFn({ address: TRICKLE_VAULT_ADDRESS, abi: TRICKLE_VAULT_ABI, functionName: "deposit", args: [tokenInfo.address, needed] });
      }, 2000);
      setTimeout(() => {
        createStream({ address: TRICKLE_VAULT_ADDRESS, abi: TRICKLE_VAULT_ABI, functionName: "createStream", args: [payeeAddress as `0x${string}`, tokenInfo.address, amountPerSec] });
      }, 5000);
    } else {
      createStream({ address: TRICKLE_VAULT_ADDRESS, abi: TRICKLE_VAULT_ABI, functionName: "createStream", args: [payeeAddress as `0x${string}`, tokenInfo.address, amountPerSec] });
    }
  }

  if (!isConnected) { router.push("/"); return null; }

  if (isCreated) {
    return (
      <DashboardLayout>
      <div className="mx-auto flex max-w-md flex-col items-center px-6 pt-24 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}>
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#35D07F]/10">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#35D07F" strokeWidth="2"><polyline points="20,6 9,17 4,12" /></svg>
          </div>
        </motion.div>
        <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-lg font-semibold text-white">Stream created</motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-2 text-[13px] text-gray-500">
          {monthlySalary} {tokenInfo.symbol}/mo to <span className="font-mono">{payeeAddress.slice(0, 8)}...{payeeAddress.slice(-6)}</span>
        </motion.p>
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          onClick={() => router.push("/employer")}
          className="mt-8 rounded-lg bg-[#35D07F] px-6 py-2.5 text-[13px] font-semibold text-[#050a0e] hover:bg-[#3de08d]"
        >
          Back to Dashboard
        </motion.button>
      </div>
      </DashboardLayout>
    );
  }

  const amountPerSec = calcAmountPerSec();
  const perSecDisplay = amountPerSec > 0n ? parseFloat((Number(amountPerSec) / 10 ** tokenInfo.decimals).toFixed(12)).toString() : "0";
  const vaultNum = vaultBalance ? parseFloat(formatUnits(vaultBalance as bigint, tokenInfo.decimals)) : 0;

  return (
    <DashboardLayout>
    <div className="mx-auto max-w-md px-6 py-10">
      <button onClick={() => router.back()} className="mb-6 flex items-center gap-1 text-[13px] text-gray-600 hover:text-white transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15,18 9,12 15,6" /></svg>
        Back
      </button>

      <h1 className="mb-8 text-xl font-semibold text-white">Create Stream</h1>

      <AnimatePresence mode="wait">
        {step === "form" && (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
            <div>
              <label className="mb-2 block text-[12px] text-gray-500">Employee address</label>
              <input
                type="text" value={payeeAddress} onChange={(e) => setPayeeAddress(e.target.value)}
                placeholder="0x..."
                className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-3 text-[13px] text-white font-mono placeholder-gray-700 focus:border-[#35D07F]/30 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-[12px] text-gray-500">Token</label>
              <div className="flex gap-2">
                {TOKEN_LIST.map((t) => (
                  <button key={t.symbol} onClick={() => setSelectedToken(t.symbol)}
                    className={`flex-1 rounded-lg border py-2.5 text-[12px] font-medium transition-all ${
                      selectedToken === t.symbol
                        ? "border-[#35D07F]/30 bg-[#35D07F]/5 text-[#35D07F]"
                        : "border-white/[0.06] text-gray-600 hover:text-gray-400"
                    }`}
                  >{t.symbol}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[12px] text-gray-500">Monthly salary</label>
              <div className="relative">
                <input type="number" value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value)}
                  placeholder="1000"
                  className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-3 pr-20 text-[13px] text-white placeholder-gray-700 focus:border-[#35D07F]/30 focus:outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] text-gray-600">{tokenInfo.symbol}/mo</span>
              </div>
              {amountPerSec > 0n && (
                <p className="mt-2 text-[11px] text-gray-600">{perSecDisplay} {tokenInfo.symbol}/sec</p>
              )}
            </div>

            <div className="text-[11px] text-gray-700">
              Vault: {vaultNum.toFixed(2)} {tokenInfo.symbol}
            </div>

            <button
              onClick={() => setStep("review")}
              disabled={!payeeAddress || !monthlySalary || amountPerSec === 0n || !payeeAddress.startsWith("0x")}
              className="w-full rounded-lg bg-[#35D07F] py-3 text-[13px] font-semibold text-[#050a0e] hover:bg-[#3de08d] disabled:opacity-30"
            >
              Review
            </button>
          </motion.div>
        )}

        {step === "review" && (
          <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
            <div className="card p-5 space-y-3">
              {[
                { label: "To", value: `${payeeAddress.slice(0, 10)}...${payeeAddress.slice(-8)}`, mono: true },
                { label: "Token", value: tokenInfo.symbol },
                { label: "Monthly", value: `${monthlySalary} ${tokenInfo.symbol}` },
                { label: "Per second", value: `${perSecDisplay} ${tokenInfo.symbol}` },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-[13px]">
                  <span className="text-gray-600">{row.label}</span>
                  <span className={row.mono ? "font-mono text-gray-300" : "text-white"}>{row.value}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep("form")} className="flex-1 rounded-lg border border-white/[0.06] py-2.5 text-[13px] text-gray-400 hover:text-white">
                Edit
              </button>
              <button
                onClick={handleCreateStream}
                disabled={isApproving || isDepositing || isCreatePending || isCreateConfirming}
                className="flex-1 rounded-lg bg-[#35D07F] py-2.5 text-[13px] font-semibold text-[#050a0e] hover:bg-[#3de08d] disabled:opacity-40"
              >
                {isApproving ? "Approving..." : isDepositing ? "Depositing..." : isCreatePending || isCreateConfirming ? "Creating..." : "Confirm"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </DashboardLayout>
  );
}
