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
import { ArrowLeft, Check, AlertTriangle, ArrowRight } from "lucide-react";
import { TRICKLE_VAULT_ABI, ERC20_ABI } from "@/config/contracts";
import {
  useVaultAddress,
  useChainTokens,
  useChainTokenList,
  useExplorerUrl,
} from "@/hooks/useChain";
import DashboardLayout from "@/components/DashboardLayout";
import { ConnectWalletPrompt } from "@/components/ConnectWalletPrompt";
import { useToast } from "@/components/Toast";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { cn } from "@/lib/cn";

type Phase =
  | "idle"
  | "approving"
  | "depositing"
  | "creating"
  | "done"
  | "error";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "Confirm stream",
  approving: "Approving…",
  depositing: "Depositing…",
  creating: "Creating stream…",
  done: "Done",
  error: "Try again",
};

const STEPS_WITH_DEPOSIT = ["Approve", "Deposit", "Create stream"];
const STEPS_NO_DEPOSIT = ["Create stream"];

export default function CreateStream() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast, update } = useToast();

  const TOKENS = useChainTokens();
  const TOKEN_LIST = useChainTokenList();
  const TRICKLE_VAULT_ADDRESS = useVaultAddress();
  const explorerUrl = useExplorerUrl();
  const defaultToken = TOKEN_LIST[0]?.symbol ?? "USDC";

  const [payeeAddress, setPayeeAddress] = useState("");
  const [selectedToken, setSelectedToken] = useState(defaultToken);
  useEffect(() => {
    if (!TOKENS[selectedToken]) setSelectedToken(defaultToken);
  }, [TOKENS, selectedToken, defaultToken]);
  const [monthlySalary, setMonthlySalary] = useState("");
  const [formStep, setFormStep] = useState<"form" | "review">("form");
  const [phase, setPhase] = useState<Phase>("idle");
  const [needsDeposit, setNeedsDeposit] = useState(false);

  // ID toast aktif — satu toast yang di-update sepanjang flow
  const activeToastId = useRef<string | null>(null);

  const paramsRef = useRef<{
    tokenAddress: `0x${string}`;
    amountPerSec: bigint;
    needed: bigint;
    payee: `0x${string}`;
  } | null>(null);

  const tokenInfo = TOKENS[selectedToken] ?? TOKEN_LIST[0];

  const { data: vaultBalance } = useReadContract({
    address: TRICKLE_VAULT_ADDRESS,
    abi: TRICKLE_VAULT_ABI,
    functionName: "balances",
    args: address ? [address, tokenInfo.address] : undefined,
    query: { enabled: !!address },
  });

  const {
    writeContract: doApprove,
    data: approveTxHash,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();
  const { isSuccess: approveConfirmed, isError: approveFailed } =
    useWaitForTransactionReceipt({ hash: approveTxHash, pollingInterval: 1_500 });

  const {
    writeContract: doDeposit,
    data: depositTxHash,
    error: depositError,
    reset: resetDeposit,
  } = useWriteContract();
  const { isSuccess: depositConfirmed, isError: depositFailed } =
    useWaitForTransactionReceipt({ hash: depositTxHash, pollingInterval: 1_500 });

  const {
    writeContract: doCreateStream,
    data: createTxHash,
    error: createError,
    reset: resetCreate,
  } = useWriteContract();
  const { isSuccess: createConfirmed, isError: createFailed } =
    useWaitForTransactionReceipt({ hash: createTxHash, pollingInterval: 1_500 });

  useEffect(() => {
    if (phase === "approving" && approveConfirmed && paramsRef.current) {
      setPhase("depositing");
      if (activeToastId.current)
        update(activeToastId.current, { type: "pending", message: "Funding payroll…", txHash: approveTxHash });
      doDeposit({
        address: TRICKLE_VAULT_ADDRESS,
        abi: TRICKLE_VAULT_ABI,
        functionName: "deposit",
        args: [paramsRef.current.tokenAddress, paramsRef.current.needed],
      });
    }
  }, [approveConfirmed, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase === "depositing" && depositConfirmed && paramsRef.current) {
      setPhase("creating");
      if (activeToastId.current)
        update(activeToastId.current, { type: "pending", message: "Creating stream…", txHash: depositTxHash });
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

  useEffect(() => {
    if (phase === "creating" && createConfirmed) {
      setPhase("done");
      queryClient.invalidateQueries();
      if (activeToastId.current) {
        update(activeToastId.current, {
          type: "success",
          message: "Stream created",
          description: `Streaming ${monthlySalary} ${tokenInfo.symbol}/mo`,
          txHash: createTxHash,
        });
        activeToastId.current = null;
      }
    }
  }, [createConfirmed, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if ((approveError || approveFailed) && phase === "approving") {
      setPhase("error");
      if (activeToastId.current) {
        update(activeToastId.current, {
          type: "error",
          message: "Approval failed",
          description: (approveError as Error)?.message?.slice(0, 80) ?? "Transaction rejected",
        });
        activeToastId.current = null;
      }
    }
  }, [approveError, approveFailed, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if ((depositError || depositFailed) && phase === "depositing") {
      setPhase("error");
      if (activeToastId.current) {
        update(activeToastId.current, { type: "error", message: "Deposit failed" });
        activeToastId.current = null;
      }
    }
  }, [depositError, depositFailed, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if ((createError || createFailed) && phase === "creating") {
      setPhase("error");
      if (activeToastId.current) {
        update(activeToastId.current, {
          type: "error",
          message: "Stream creation failed",
          description: (createError as Error)?.message?.slice(0, 80) ?? "Transaction rejected",
        });
        activeToastId.current = null;
      }
    }
  }, [createError, createFailed, phase]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const needed =
      currentBalance < monthlyWei ? monthlyWei - currentBalance : 0n;
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
      activeToastId.current = toast({ type: "pending", message: "Approving token spend…" });
      doApprove({
        address: tokenInfo.address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [TRICKLE_VAULT_ADDRESS, needed],
      });
    } else {
      setPhase("creating");
      activeToastId.current = toast({ type: "pending", message: "Creating stream…" });
      doCreateStream({
        address: TRICKLE_VAULT_ADDRESS,
        abi: TRICKLE_VAULT_ABI,
        functionName: "createStream",
        args: [
          payeeAddress as `0x${string}`,
          tokenInfo.address,
          amountPerSec,
        ],
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

  if (!isConnected) {
    return (
      <DashboardLayout>
        <div className="mx-auto w-full max-w-[460px] px-5 pt-4">
          <button
            onClick={() => router.back()}
            className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-[var(--fg-mute)] transition-colors hover:text-[var(--fg)]"
          >
            <ArrowLeft size={13} />
            Back
          </button>
          <h1 className="mb-5 font-display text-[22px] font-semibold tracking-tight text-[var(--fg)]">
            New stream
          </h1>
          <ConnectWalletPrompt
            eyebrow="Sign in required"
            title="Connect to open a stream"
            body="Link a Celo wallet to fund payroll and open a per-second salary stream to your teammate."
          />
        </div>
      </DashboardLayout>
    );
  }

  const monthlyNum = Number(monthlySalary);
  const perDay = monthlyNum / 30;
  const perHour = perDay / 24;
  const perMinute = perHour / 60;
  const perSec = perMinute / 60;

  const amountPerSec = calcAmountPerSec();
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
  const payeeFormatErr = payeeAddress && !isAddress(payeeAddress);
  const payeeSelfErr =
    payeeAddress &&
    isAddress(payeeAddress) &&
    payeeAddress.toLowerCase() === address?.toLowerCase();

  if (phase === "done") {
    return (
      <DashboardLayout>
        <div className="mx-auto flex max-w-md flex-col items-center px-6 pt-10 text-center">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]"
          >
            <Check size={20} strokeWidth={2} />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.22 }}
            className="font-display text-[22px] font-semibold tracking-tight text-[var(--fg)]"
          >
            Stream created
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mt-2 text-[13.5px] text-[var(--fg-mute)]"
          >
            Now streaming{" "}
            <span className="text-[var(--fg)]">
              {monthlySalary} {tokenInfo.symbol}
            </span>
            /mo to{" "}
            <span className="font-mono text-[var(--fg-dim)]">
              {payeeAddress.slice(0, 8)}…{payeeAddress.slice(-6)}
            </span>
          </motion.p>
          {createTxHash && (
            <motion.a
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              href={`${explorerUrl}/tx/${createTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 font-mono text-[11.5px] text-[var(--accent)]/70 hover:text-[var(--accent)] transition-colors"
            >
              View on Celoscan
              <ArrowRight size={11} />
            </motion.a>
          )}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="mt-8"
          >
            <Button onClick={() => router.push("/employer")}>
              Back to dashboard
            </Button>
          </motion.div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[460px] px-5">
        <button
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-[var(--fg-mute)] transition-colors hover:text-[var(--fg)]"
        >
          <ArrowLeft size={13} />
          Back
        </button>

        <div className="mb-8">
          <h1 className="font-display text-[26px] font-semibold leading-[1.2] tracking-[-0.02em] text-[var(--fg)]">
            New stream
          </h1>
          <p className="mt-1.5 text-[13.5px] text-[var(--fg-mute)]">
            Pick the teammate, token, and monthly rate — Trickle computes the
            per-second flow for you.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {formStep === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >
              <FieldGroup label="Employee address" hint="EVM address on Celo">
                <Input
                  value={payeeAddress}
                  onChange={(e) => setPayeeAddress(e.target.value)}
                  placeholder="0x…"
                  mono
                  invalid={!!(payeeFormatErr || payeeSelfErr)}
                />
                {payeeFormatErr && (
                  <FieldError>Invalid address.</FieldError>
                )}
                {payeeSelfErr && (
                  <FieldError>You cannot stream to yourself.</FieldError>
                )}
              </FieldGroup>

              <FieldGroup label="Token">
                <div className="grid grid-cols-3 gap-2">
                  {TOKEN_LIST.map((t) => (
                    <button
                      key={t.symbol}
                      onClick={() => setSelectedToken(t.symbol)}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-left transition-all duration-200 ease-out",
                        selectedToken === t.symbol
                          ? "border-[var(--accent)]/40 bg-[var(--color-accent-soft)]"
                          : "border-[var(--border)] bg-[var(--color-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-2)]",
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-2 text-[13px] font-medium",
                          selectedToken === t.symbol
                            ? "text-[var(--accent-3)]"
                            : "text-[var(--fg)]",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            selectedToken === t.symbol
                              ? "bg-[var(--accent)]"
                              : "bg-[var(--color-fg-faint)]",
                          )}
                        />
                        {t.symbol}
                      </div>
                      <p className="mt-1 text-[11.5px] text-[var(--fg-mute)]">{t.name}</p>
                    </button>
                  ))}
                </div>
              </FieldGroup>

              <FieldGroup
                label="Monthly salary"
                hint="We'll compute a precise per-second rate"
              >
                <Input
                  type="number"
                  value={monthlySalary}
                  onChange={(e) => setMonthlySalary(e.target.value)}
                  placeholder="1,000"
                  trailing={`${tokenInfo.symbol}/mo`}
                  min="0"
                />
                {monthlyNum > 0 && (
                  <RateBreakdown
                    perDay={perDay}
                    perHour={perHour}
                    perMinute={perMinute}
                    perSec={perSec}
                    symbol={tokenInfo.symbol}
                  />
                )}
              </FieldGroup>

              <div className="flex items-center justify-between rounded-xl bg-[var(--color-surface)] border border-[var(--border)] px-4 py-3">
                <span className="text-[12.5px] text-[var(--fg-mute)]">Payroll balance</span>
                <span className="font-mono text-[13px] text-[var(--fg-dim)]">
                  {vaultNum.toFixed(2)} {tokenInfo.symbol}
                </span>
              </div>

              <Button
                onClick={() => setFormStep("review")}
                disabled={!payeeValid || !monthlySalary || amountPerSec === 0n}
                className="w-full"
                rightIcon={<ArrowRight size={14} />}
              >
                Review
              </Button>
            </motion.div>
          )}

          {formStep === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              <Card padded={false}>
                <div className="divide-y divide-[var(--border)]">
                  <SummaryRow
                    label="Streaming to"
                    value={
                      <span className="font-mono text-[var(--fg)]">
                        {payeeAddress.slice(0, 10)}…
                        {payeeAddress.slice(-8)}
                      </span>
                    }
                  />
                  <SummaryRow label="Token" value={tokenInfo.symbol} />
                  <SummaryRow
                    label="Monthly rate"
                    value={
                      <span className="tabular font-mono text-[var(--fg)]">
                        {Number(monthlySalary).toLocaleString()} {tokenInfo.symbol}
                      </span>
                    }
                  />
                  <SummaryRow
                    label="Per second"
                    value={
                      <span className="tabular font-mono text-[var(--accent-3)]">
                        <AnimatedNumber value={perSec} decimals={8} /> {tokenInfo.symbol}
                      </span>
                    }
                  />
                  <SummaryRow
                    label="Payroll balance"
                    value={
                      <span className="font-mono text-[var(--fg-dim)]">
                        {vaultNum.toFixed(2)} {tokenInfo.symbol}
                      </span>
                    }
                  />
                </div>
              </Card>

              {vaultNum < monthlyNum && (
                <div className="flex items-start gap-3 rounded-xl border border-[var(--warn)]/20 bg-[var(--warn)]/[0.05] px-4 py-3">
                  <AlertTriangle
                    size={14}
                    className="mt-0.5 shrink-0 text-[var(--warn)]"
                  />
                  <p className="text-[12.5px] leading-relaxed text-[var(--warn)]/90">
                    Payroll needs a top-up — we&apos;ll approve and deposit{" "}
                    <span className="font-mono text-[var(--warn)]">
                      {(monthlyNum - vaultNum).toFixed(2)} {tokenInfo.symbol}
                    </span>{" "}
                    before opening the stream.
                  </p>
                </div>
              )}

              {isPending && (
                <div className="flex items-center gap-2 rounded-xl bg-[var(--color-surface-2)] px-4 py-3 text-[12px]">
                  {steps.map((label, i) => (
                    <span key={label} className="flex items-center gap-2">
                      <StepDot
                        active={activeStep === i}
                        done={activeStep > i}
                        label={label}
                      />
                      {i < steps.length - 1 && (
                        <span className="text-[var(--fg-faint)]">→</span>
                      )}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setFormStep("form")}
                  disabled={isPending}
                  className="flex-1"
                >
                  Edit
                </Button>
                <Button
                  onClick={phase === "error" ? handleReset : handleStart}
                  disabled={isPending}
                  loading={isPending}
                  className="flex-1"
                  leftIcon={
                    !isPending && phase !== "error" ? (
                      <Check size={14} />
                    ) : null
                  }
                >
                  {PHASE_LABEL[phase]}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--fg-mute)]">
          {label}
        </label>
        {hint ? (
          <span className="text-[11.5px] text-[var(--fg-faint)]">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-[var(--danger)]/90">
      <AlertTriangle size={11} />
      {children}
    </p>
  );
}

function RateBreakdown({
  perDay,
  perHour,
  perMinute,
  perSec,
  symbol,
}: {
  perDay: number;
  perHour: number;
  perMinute: number;
  perSec: number;
  symbol: string;
}) {
  const rows: [string, number, number][] = [
    ["per day", perDay, 4],
    ["per hour", perHour, 6],
    ["per min", perMinute, 6],
    ["per sec", perSec, 8],
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]"
    >
      <div className="grid grid-cols-4 divide-x divide-[var(--divider)]">
        {rows.map(([label, value, decimals], i) => {
          const isSec = i === rows.length - 1;
          return (
            <div key={label} className="px-3 py-3 bg-[var(--color-surface-2)]">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--fg-mute)]">
                {label}
              </p>
              <p
                className={cn(
                  "mt-1 font-mono text-[12px] tabular truncate",
                  isSec ? "text-[var(--accent-3)]" : "text-[var(--fg-dim)]",
                )}
              >
                <AnimatedNumber value={value} decimals={decimals} />
              </p>
              <p className="text-[10px] text-[var(--fg-faint)]">{symbol}</p>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3 text-[13px]">
      <span className="text-[var(--fg-mute)]">{label}</span>
      <span className="text-[var(--fg)]">{value}</span>
    </div>
  );
}

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
      className={cn(
        "inline-flex items-center gap-1.5 transition-colors",
        done
          ? "text-[var(--accent)]"
          : active
            ? "text-[var(--fg)]"
            : "text-[var(--fg-faint)]",
      )}
    >
      <span
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-bold",
          done
            ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
            : active
              ? "border-[var(--border-strong)] bg-[var(--color-surface-2)]"
              : "border-white/10",
        )}
      >
        {done ? <Check size={8} strokeWidth={3} /> : null}
      </span>
      {label}
    </span>
  );
}
