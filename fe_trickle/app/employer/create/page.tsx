"use client";

import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { parseUnits, formatUnits, isAddress } from "viem";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  TRICKLE_VAULT_ABI,
  TRICKLE_VAULT_ADDRESS,
  ERC20_ABI,
} from "@/config/contracts";
import { TOKENS, TOKEN_LIST } from "@/config/tokens";
import DashboardLayout from "@/components/DashboardLayout";
import { useToast } from "@/components/Toast";

// ── Phase state machine ────────────────────────────────────────────────────────
// idle → [approving → depositing →] creating → done | error
type Phase =
  | "idle"
  | "approving"
  | "depositing"
  | "creating"
  | "done"
  | "error";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "Confirm",
  approving: "Approving…",
  depositing: "Depositing…",
  creating: "Creating stream…",
  done: "Done",
  error: "Retry",
};

const STEPS_WITH_DEPOSIT = ["Approve", "Deposit", "Create stream"];
const STEPS_NO_DEPOSIT = ["Create stream"];

export default function CreateStream() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [payeeAddress, setPayeeAddress] = useState("");
  const [selectedToken, setSelectedToken] = useState("cUSD");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [formStep, setFormStep] = useState<"form" | "review">("form");
  const [phase, setPhase] = useState<Phase>("idle");
  const [needsDeposit, setNeedsDeposit] = useState(false);

  // Store computed values to use across effects
  const paramsRef = useRef<{
    tokenAddress: `0x${string}`;
    amountPerSec: bigint;
    needed: bigint;
    payee: `0x${string}`;
  } | null>(null);

  const tokenInfo = TOKENS[selectedToken];

  const { data: vaultBalance } = useReadContract({
    address: TRICKLE_VAULT_ADDRESS,
    abi: TRICKLE_VAULT_ABI,
    functionName: "balances",
    args: address ? [address, tokenInfo.address] : undefined,
    query: { enabled: !!address },
  });

  // ── Step 1: approve ────────────────────────────────────────────────────────
  const {
    writeContract: doApprove,
    data: approveTxHash,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();
  const { isSuccess: approveConfirmed, isError: approveFailed } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  // ── Step 2: deposit ────────────────────────────────────────────────────────
  const {
    writeContract: doDeposit,
    data: depositTxHash,
    error: depositError,
    reset: resetDeposit,
  } = useWriteContract();
  const { isSuccess: depositConfirmed, isError: depositFailed } =
    useWaitForTransactionReceipt({ hash: depositTxHash });

  // ── Step 3: createStream ───────────────────────────────────────────────────
  const {
    writeContract: doCreateStream,
    data: createTxHash,
    error: createError,
    reset: resetCreate,
  } = useWriteContract();
  const { isSuccess: createConfirmed, isError: createFailed } =
    useWaitForTransactionReceipt({ hash: createTxHash });

  // ── Transitions ────────────────────────────────────────────────────────────

  // approving → depositing
  useEffect(() => {
    if (phase === "approving" && approveConfirmed && paramsRef.current) {
      setPhase("depositing");
      toast({ type: "pending", message: "Depositing to vault…", txHash: approveTxHash });
      doDeposit({
        address: TRICKLE_VAULT_ADDRESS,
        abi: TRICKLE_VAULT_ABI,
        functionName: "deposit",
        args: [paramsRef.current.tokenAddress, paramsRef.current.needed],
      });
    }
  }, [approveConfirmed, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // depositing → creating
  useEffect(() => {
    if (phase === "depositing" && depositConfirmed && paramsRef.current) {
      setPhase("creating");
      toast({ type: "pending", message: "Creating stream…", txHash: depositTxHash });
      doCreateStream({
        address: TRICKLE_VAULT_ADDRESS,
        abi: TRICKLE_VAULT_ABI,
        functionName: "createStream",
        args: [
          paramsRef.current.payee,
          paramsRef.current.tokenAddress,
          paramsRef.current.amountPerSec,
        ],
      });
    }
  }, [depositConfirmed, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // creating → done
  useEffect(() => {
    if (phase === "creating" && createConfirmed) {
      setPhase("done");
      queryClient.invalidateQueries();
      toast({
        type: "success",
        message: "Stream created",
        description: `Streaming ${monthlySalary} ${tokenInfo.symbol}/mo`,
        txHash: createTxHash,
      });
    }
  }, [createConfirmed, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Error handling
  useEffect(() => {
    if (
      (approveError || approveFailed) &&
      phase === "approving"
    ) {
      setPhase("error");
      toast({
        type: "error",
        message: "Approval failed",
        description: (approveError as Error)?.message?.slice(0, 80) ?? "Transaction rejected",
      });
    }
  }, [approveError, approveFailed, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if ((depositError || depositFailed) && phase === "depositing") {
      setPhase("error");
      toast({ type: "error", message: "Deposit failed" });
    }
  }, [depositError, depositFailed, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if ((createError || createFailed) && phase === "creating") {
      setPhase("error");
      toast({
        type: "error",
        message: "Stream creation failed",
        description: (createError as Error)?.message?.slice(0, 80) ?? "Transaction rejected",
      });
    }
  }, [createError, createFailed, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ────────────────────────────────────────────────────────────────

  function calcAmountPerSec(): bigint {
    if (!monthlySalary || isNaN(Number(monthlySalary))) return 0n;
    const monthlyWei = parseUnits(monthlySalary, tokenInfo.decimals);
    return monthlyWei / 2592000n;
  }

  function handleStart() {
    if (!address || !payeeAddress) return;
    const amountPerSec = calcAmountPerSec();
    if (amountPerSec === 0n) return;

    const monthlyWei = parseUnits(monthlySalary, tokenInfo.decimals);
    const currentBalance = (vaultBalance as bigint) ?? 0n;
    const needed = currentBalance < monthlyWei ? monthlyWei - currentBalance : 0n;
    const requiresDeposit = needed > 0n;

    setNeedsDeposit(requiresDeposit);
    paramsRef.current = {
      tokenAddress: tokenInfo.address,
      amountPerSec,
      needed,
      payee: payeeAddress as `0x${string}`,
    };

    if (requiresDeposit) {
      setPhase("approving");
      toast({ type: "pending", message: "Approving token spend…" });
      doApprove({
        address: tokenInfo.address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [TRICKLE_VAULT_ADDRESS, needed],
      });
    } else {
      setPhase("creating");
      toast({ type: "pending", message: "Creating stream…" });
      doCreateStream({
        address: TRICKLE_VAULT_ADDRESS,
        abi: TRICKLE_VAULT_ABI,
        functionName: "createStream",
        args: [payeeAddress as `0x${string}`, tokenInfo.address, amountPerSec],
      });
    }
  }

  function handleReset() {
    setPhase("idle");
    paramsRef.current = null;
    resetApprove();
    resetDeposit();
    resetCreate();
  }

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (!isConnected) {
    router.push("/");
    return null;
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const amountPerSec = calcAmountPerSec();
  const perSecDisplay =
    amountPerSec > 0n
      ? parseFloat(
          (Number(amountPerSec) / 10 ** tokenInfo.decimals).toFixed(12)
        ).toString()
      : "0";
  const vaultNum = vaultBalance
    ? parseFloat(formatUnits(vaultBalance as bigint, tokenInfo.decimals))
    : 0;
  const isPending =
    phase === "approving" || phase === "depositing" || phase === "creating";

  const steps = needsDeposit ? STEPS_WITH_DEPOSIT : STEPS_NO_DEPOSIT;
  const activeStep =
    phase === "approving"
      ? 0
      : phase === "depositing"
      ? 1
      : phase === "creating"
      ? needsDeposit
        ? 2
        : 0
      : -1;

  const payeeValid =
    payeeAddress.startsWith("0x") &&
    isAddress(payeeAddress) &&
    payeeAddress.toLowerCase() !== address?.toLowerCase();

  // ── Success screen ─────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <DashboardLayout>
        <div className="mx-auto flex max-w-md flex-col items-center px-6 pt-24 text-center">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
          >
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#35D07F]/10 ring-1 ring-[#35D07F]/20">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#35D07F"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20,6 9,17 4,12" />
              </svg>
            </div>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-lg font-semibold text-white"
          >
            Stream created
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mt-2 text-[13px] text-gray-500"
          >
            {monthlySalary} {tokenInfo.symbol}/mo to{" "}
            <span className="font-mono">
              {payeeAddress.slice(0, 8)}…{payeeAddress.slice(-6)}
            </span>
          </motion.p>
          {createTxHash && (
            <motion.a
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              href={`https://celoscan.io/tx/${createTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] text-[#35D07F]/60 hover:text-[#35D07F]"
            >
              View on Celoscan ↗
            </motion.a>
          )}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            onClick={() => router.push("/employer")}
            className="mt-8 rounded-lg bg-[#35D07F] px-6 py-2.5 text-[13px] font-semibold text-[#050a0e] hover:bg-[#3de08d]"
          >
            Back to Dashboard
          </motion.button>
        </div>
      </DashboardLayout>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-md px-6 py-10">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-1 text-[13px] text-gray-600 transition-colors hover:text-white"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <polyline points="15,18 9,12 15,6" />
          </svg>
          Back
        </button>

        <h1 className="mb-8 text-xl font-semibold text-white">
          Create Stream
        </h1>

        <AnimatePresence mode="wait">
          {/* ── Form step ── */}
          {formStep === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="space-y-5"
            >
              {/* Employee address */}
              <div>
                <label className="mb-2 block text-[12px] text-gray-500">
                  Employee address
                </label>
                <input
                  type="text"
                  value={payeeAddress}
                  onChange={(e) => setPayeeAddress(e.target.value)}
                  placeholder="0x…"
                  className={`w-full rounded-lg border bg-white/[0.03] px-4 py-3 font-mono text-[13px] text-white placeholder-gray-700 focus:outline-none ${
                    payeeAddress && !payeeValid
                      ? "border-red-400/30 focus:border-red-400/50"
                      : "border-white/[0.06] focus:border-[#35D07F]/30"
                  }`}
                />
                {payeeAddress && !isAddress(payeeAddress) && (
                  <p className="mt-1.5 text-[11px] text-red-400">
                    Invalid address
                  </p>
                )}
                {payeeAddress &&
                  isAddress(payeeAddress) &&
                  payeeAddress.toLowerCase() === address?.toLowerCase() && (
                    <p className="mt-1.5 text-[11px] text-red-400">
                      Cannot stream to yourself
                    </p>
                  )}
              </div>

              {/* Token */}
              <div>
                <label className="mb-2 block text-[12px] text-gray-500">
                  Token
                </label>
                <div className="flex gap-2">
                  {TOKEN_LIST.map((t) => (
                    <button
                      key={t.symbol}
                      onClick={() => setSelectedToken(t.symbol)}
                      className={`flex-1 rounded-lg border py-2.5 text-[12px] font-medium transition-all ${
                        selectedToken === t.symbol
                          ? "border-[#35D07F]/30 bg-[#35D07F]/5 text-[#35D07F]"
                          : "border-white/[0.06] text-gray-600 hover:text-gray-400"
                      }`}
                    >
                      {t.symbol}
                    </button>
                  ))}
                </div>
              </div>

              {/* Monthly salary */}
              <div>
                <label className="mb-2 block text-[12px] text-gray-500">
                  Monthly salary
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={monthlySalary}
                    onChange={(e) => setMonthlySalary(e.target.value)}
                    placeholder="1000"
                    min="0"
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3 pr-20 text-[13px] text-white placeholder-gray-700 focus:border-[#35D07F]/30 focus:outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] text-gray-600">
                    {tokenInfo.symbol}/mo
                  </span>
                </div>
                {amountPerSec > 0n && (
                  <p className="mt-2 text-[11px] text-gray-600">
                    {perSecDisplay} {tokenInfo.symbol}/sec
                  </p>
                )}
              </div>

              {/* Vault balance hint */}
              <div className="text-[11px] text-gray-700">
                Vault: {vaultNum.toFixed(2)} {tokenInfo.symbol}
              </div>

              <button
                onClick={() => setFormStep("review")}
                disabled={!payeeValid || !monthlySalary || amountPerSec === 0n}
                className="w-full rounded-lg bg-[#35D07F] py-3 text-[13px] font-semibold text-[#050a0e] hover:bg-[#3de08d] disabled:opacity-30"
              >
                Review
              </button>
            </motion.div>
          )}

          {/* ── Review step ── */}
          {formStep === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="space-y-5"
            >
              {/* Summary */}
              <div className="card space-y-3 p-5">
                {[
                  {
                    label: "To",
                    value: `${payeeAddress.slice(0, 10)}…${payeeAddress.slice(-8)}`,
                    mono: true,
                  },
                  { label: "Token", value: tokenInfo.symbol },
                  {
                    label: "Monthly",
                    value: `${monthlySalary} ${tokenInfo.symbol}`,
                  },
                  {
                    label: "Per second",
                    value: `${perSecDisplay} ${tokenInfo.symbol}`,
                  },
                  {
                    label: "Vault",
                    value: `${vaultNum.toFixed(2)} ${tokenInfo.symbol}`,
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between text-[13px]"
                  >
                    <span className="text-gray-600">{row.label}</span>
                    <span
                      className={
                        row.mono ? "font-mono text-gray-300" : "text-white"
                      }
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Deposit notice */}
              {vaultNum < Number(monthlySalary) && (
                <div className="rounded-lg border border-amber-400/15 bg-amber-400/5 px-4 py-3 text-[12px] text-amber-400/80">
                  Vault needs top-up. We&apos;ll approve and deposit{" "}
                  {(Number(monthlySalary) - vaultNum).toFixed(2)}{" "}
                  {tokenInfo.symbol} before creating the stream.
                </div>
              )}

              {/* Transaction progress */}
              {isPending && (
                <div className="flex items-center gap-2 text-[11px]">
                  {steps.map((label, i) => (
                    <span key={label} className="flex items-center gap-1">
                      <StepDot
                        active={activeStep === i}
                        done={activeStep > i}
                        label={label}
                      />
                      {i < steps.length - 1 && (
                        <span className="text-gray-700">→</span>
                      )}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setFormStep("form")}
                  disabled={isPending}
                  className="flex-1 rounded-lg border border-white/[0.06] py-2.5 text-[13px] text-gray-400 transition-colors hover:text-white disabled:opacity-40"
                >
                  Edit
                </button>
                <button
                  onClick={phase === "error" ? handleReset : handleStart}
                  disabled={isPending}
                  className="flex-1 rounded-lg bg-[#35D07F] py-2.5 text-[13px] font-semibold text-[#050a0e] hover:bg-[#3de08d] disabled:opacity-40"
                >
                  {PHASE_LABEL[phase]}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

// ── Reusable step dot ──────────────────────────────────────────────────────────

function StepDot({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <span
      className={`flex items-center gap-1 transition-colors ${
        done ? "text-[#35D07F]" : active ? "text-white" : "text-gray-700"
      }`}
    >
      <span
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-bold ${
          done
            ? "border-[#35D07F] bg-[#35D07F]/10"
            : active
            ? "border-white/30 bg-white/5"
            : "border-gray-800"
        }`}
      >
        {done ? "✓" : active ? "·" : ""}
      </span>
      {label}
    </span>
  );
}
