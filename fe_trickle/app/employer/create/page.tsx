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
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            <div className="relative mx-auto mb-6 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#35D07F]/10 ring-1 ring-[#35D07F]/25">
              <div className="absolute inset-0 animate-ping rounded-full bg-[#35D07F]/10" style={{ animationDuration: "1.8s" }} />
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#35D07F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20,6 9,17 4,12" />
              </svg>
            </div>
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
            className="text-lg font-semibold text-white">
            Stream created
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}
            className="mt-2 text-[13px] text-white/40">
            {monthlySalary} {tokenInfo.symbol}/mo to{" "}
            <span className="font-mono text-white/60">{payeeAddress.slice(0, 8)}…{payeeAddress.slice(-6)}</span>
          </motion.p>
          {createTxHash && (
            <motion.a initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
              href={`https://celoscan.io/tx/${createTxHash}`} target="_blank" rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] text-[#35D07F]/55 hover:text-[#35D07F] transition-colors">
              View on Celoscan ↗
            </motion.a>
          )}
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.42 }}
            onClick={() => router.push("/employer")}
            className="mt-8 rounded-xl bg-[#35D07F] px-7 py-2.5 text-[13px] font-semibold text-[#050a0e] shadow-lg shadow-[#35D07F]/25 hover:bg-[#3de08d] transition-all active:scale-[0.97]">
            Back to Dashboard
          </motion.button>
        </div>
      </DashboardLayout>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-md px-5 py-10">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-1.5 text-[13px] text-white/30 transition-colors hover:text-white/70"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15,18 9,12 15,6" />
          </svg>
          Back
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-white">Create Stream</h1>
          <p className="mt-0.5 text-[12px] text-white/30">Set up a per-second salary stream</p>
        </div>

        <AnimatePresence mode="wait">
          {/* ── Form step ── */}
          {formStep === "form" && (
            <motion.div key="form" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} className="space-y-5">

              {/* Employee address */}
              <div>
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-white/30">
                  Employee address
                </label>
                <input
                  type="text" value={payeeAddress}
                  onChange={(e) => setPayeeAddress(e.target.value)}
                  placeholder="0x…"
                  className={`w-full rounded-xl border bg-white/[0.03] px-4 py-3 font-mono text-[13px] text-white placeholder-white/20 focus:outline-none transition-colors ${
                    payeeAddress && !payeeValid
                      ? "border-red-400/30 focus:border-red-400/50"
                      : "border-white/[0.07] focus:border-[#35D07F]/35"
                  }`}
                />
                {payeeAddress && !isAddress(payeeAddress) && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-400/80">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor" strokeWidth="3"/></svg>
                    Invalid address
                  </p>
                )}
                {payeeAddress && isAddress(payeeAddress) && payeeAddress.toLowerCase() === address?.toLowerCase() && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-400/80">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor" strokeWidth="3"/></svg>
                    Cannot stream to yourself
                  </p>
                )}
              </div>

              {/* Token selector */}
              <div>
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-white/30">
                  Token
                </label>
                <div className="flex gap-2">
                  {TOKEN_LIST.map((t) => (
                    <button key={t.symbol} onClick={() => setSelectedToken(t.symbol)}
                      className={`flex-1 rounded-xl border py-2.5 text-[12px] font-medium transition-all duration-200 ${
                        selectedToken === t.symbol
                          ? "border-[#35D07F]/30 bg-[#35D07F]/8 text-[#35D07F]"
                          : "border-white/[0.07] text-white/35 hover:text-white/60 hover:border-white/[0.12]"
                      }`}>
                      {t.symbol}
                    </button>
                  ))}
                </div>
              </div>

              {/* Monthly salary */}
              <div>
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-white/30">
                  Monthly salary
                </label>
                <div className="relative">
                  <input
                    type="number" value={monthlySalary} min="0"
                    onChange={(e) => setMonthlySalary(e.target.value)}
                    placeholder="1000"
                    className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 pr-24 text-[13px] text-white placeholder-white/20 focus:border-[#35D07F]/35 focus:outline-none transition-colors"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] text-white/25">
                    {tokenInfo.symbol}/mo
                  </span>
                </div>
                {amountPerSec > 0n && (
                  <p className="mt-1.5 text-[11px] text-white/25">
                    ≈ {perSecDisplay} {tokenInfo.symbol}/sec
                  </p>
                )}
              </div>

              {/* Vault hint */}
              <div className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-2.5">
                <span className="text-[11px] text-white/25">Vault balance</span>
                <span className="font-mono text-[12px] text-white/45">{vaultNum.toFixed(2)} {tokenInfo.symbol}</span>
              </div>

              <button
                onClick={() => setFormStep("review")}
                disabled={!payeeValid || !monthlySalary || amountPerSec === 0n}
                className="w-full rounded-xl bg-[#35D07F] py-3 text-[13px] font-semibold text-[#050a0e] shadow-lg shadow-[#35D07F]/20 hover:bg-[#3de08d] hover:shadow-[#35D07F]/30 disabled:opacity-30 disabled:shadow-none transition-all"
              >
                Review →
              </button>
            </motion.div>
          )}

          {/* ── Review step ── */}
          {formStep === "review" && (
            <motion.div key="review" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-4">

              {/* Summary card */}
              <div className="card overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                <div className="divide-y divide-white/[0.05] px-5">
                  {[
                    { label: "To", value: `${payeeAddress.slice(0, 10)}…${payeeAddress.slice(-8)}`, mono: true },
                    { label: "Token", value: tokenInfo.symbol },
                    { label: "Monthly", value: `${monthlySalary} ${tokenInfo.symbol}` },
                    { label: "Per second", value: `${perSecDisplay} ${tokenInfo.symbol}` },
                    { label: "Vault balance", value: `${vaultNum.toFixed(2)} ${tokenInfo.symbol}` },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-3 text-[13px]">
                      <span className="text-white/35">{row.label}</span>
                      <span className={row.mono ? "font-mono text-white/60" : "text-white/80"}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top-up notice */}
              {vaultNum < Number(monthlySalary) && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-400/15 bg-amber-400/5 px-4 py-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" className="mt-[1px] shrink-0 opacity-70">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="0.5" fill="#FBBF24" strokeWidth="2"/>
                  </svg>
                  <p className="text-[12px] text-amber-400/75">
                    Vault needs top-up — we&apos;ll approve and deposit{" "}
                    <span className="font-mono text-amber-400/90">{(Number(monthlySalary) - vaultNum).toFixed(2)} {tokenInfo.symbol}</span>{" "}
                    before creating the stream.
                  </p>
                </div>
              )}

              {/* Tx progress */}
              {isPending && (
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-[11px]">
                  {steps.map((label, i) => (
                    <span key={label} className="flex items-center gap-1">
                      <StepDot active={activeStep === i} done={activeStep > i} label={label} />
                      {i < steps.length - 1 && <span className="text-white/15">→</span>}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={() => setFormStep("form")} disabled={isPending}
                  className="flex-1 rounded-xl border border-white/[0.07] py-2.5 text-[13px] text-white/40 transition-all hover:border-white/[0.12] hover:text-white/70 disabled:opacity-40">
                  Edit
                </button>
                <button onClick={phase === "error" ? handleReset : handleStart} disabled={isPending}
                  className="flex-1 rounded-xl bg-[#35D07F] py-2.5 text-[13px] font-semibold text-[#050a0e] shadow-md shadow-[#35D07F]/20 hover:bg-[#3de08d] disabled:opacity-40 disabled:shadow-none transition-all">
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

// ── Step dot ──────────────────────────────────────────────────────────────────

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1 transition-colors ${done ? "text-[#35D07F]" : active ? "text-white" : "text-white/25"}`}>
      <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-bold ${
        done ? "border-[#35D07F] bg-[#35D07F]/10" : active ? "border-white/30 bg-white/5" : "border-white/10"
      }`}>
        {done ? "✓" : active ? "·" : ""}
      </span>
      {label}
    </span>
  );
}
