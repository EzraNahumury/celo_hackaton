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
  ArrowLeft,
  Check,
  AlertTriangle,
  Plus,
  Trash2,
  ArrowRight,
  Upload,
} from "lucide-react";
import { TRICKLE_VAULT_ABI, ERC20_ABI } from "@/config/contracts";
import {
  useVaultAddress,
  useChainTokens,
  useChainTokenList,
  useExplorerUrl,
} from "@/hooks/useChain";
import DashboardLayout from "@/components/DashboardLayout";
import { ConnectWalletPrompt } from "@/components/ConnectWalletPrompt";
import { TokenSelector } from "@/components/TokenSelector";
import { useToast } from "@/components/Toast";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { cn } from "@/lib/cn";

type BatchEmployee = {
  id: string;
  address: string;
  salary: string;
};

type Phase =
  | "idle"
  | "approving"
  | "depositing"
  | "creating"
  | "done"
  | "error";

const SECONDS_PER_MONTH = 2592000n;
const MAX_EMPLOYEES = 20;

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function parseCsv(text: string): { address: string; salary: string }[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const firstCell = lines[0].split(",")[0].trim().replace(/^["']|["']$/g, "");
  const startIdx = firstCell.toLowerCase().startsWith("0x") && firstCell.length === 42 ? 0 : 1;
  return lines.slice(startIdx).map((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
    return { address: cols[0] ?? "", salary: cols[1] ?? "" };
  }).filter((r) => r.address.length > 0);
}

export default function BatchPayroll() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast, update } = useToast();

  const TOKENS = useChainTokens();
  const TOKEN_LIST = useChainTokenList();
  const TRICKLE_VAULT_ADDRESS = useVaultAddress();
  const explorerUrl = useExplorerUrl();
  const defaultToken = TOKEN_LIST[0]?.symbol ?? "USDC";

  const [employees, setEmployees] = useState<BatchEmployee[]>([
    { id: genId(), address: "", salary: "" },
    { id: genId(), address: "", salary: "" },
  ]);
  const [selectedToken, setSelectedToken] = useState(defaultToken);
  useEffect(() => {
    if (!TOKENS[selectedToken]) setSelectedToken(defaultToken);
  }, [TOKENS, selectedToken, defaultToken]);
  const [formStep, setFormStep] = useState<"form" | "review">("form");
  const [phase, setPhase] = useState<Phase>("idle");
  const [createdCount, setCreatedCount] = useState(0);

  const activeToastId = useRef<string | null>(null);
  const nextIndexRef = useRef(0);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const paramsRef = useRef<{
    tokenAddress: `0x${string}`;
    needed: bigint;
    streams: { payee: `0x${string}`; amountPerSec: bigint; salary: string }[];
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

  // approve → deposit
  useEffect(() => {
    if (phase !== "approving" || !approveConfirmed || !paramsRef.current) return;
    setPhase("depositing");
    if (activeToastId.current)
      update(activeToastId.current, {
        type: "pending",
        message: "Funding payroll…",
        txHash: approveTxHash,
      });
    doDeposit({
      address: TRICKLE_VAULT_ADDRESS,
      abi: TRICKLE_VAULT_ABI,
      functionName: "deposit",
      args: [paramsRef.current.tokenAddress, paramsRef.current.needed],
    });
  }, [approveConfirmed, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // deposit → first createStream
  useEffect(() => {
    if (phase !== "depositing" || !depositConfirmed || !paramsRef.current) return;
    const params = paramsRef.current;
    const first = params.streams[0];
    nextIndexRef.current = 1;
    setPhase("creating");
    if (activeToastId.current)
      update(activeToastId.current, {
        type: "pending",
        message: `Creating stream 1/${params.streams.length}…`,
        txHash: depositTxHash,
      });
    doCreateStream({
      address: TRICKLE_VAULT_ADDRESS,
      abi: TRICKLE_VAULT_ABI,
      functionName: "createStream",
      args: [first.payee, params.tokenAddress, first.amountPerSec],
    });
  }, [depositConfirmed, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // each createStream confirmation → next stream or done
  useEffect(() => {
    if (phase !== "creating" || !createConfirmed || !paramsRef.current) return;
    const params = paramsRef.current;
    const done = nextIndexRef.current;
    setCreatedCount(done);

    if (nextIndexRef.current < params.streams.length) {
      const next = params.streams[nextIndexRef.current];
      nextIndexRef.current++;
      if (activeToastId.current)
        update(activeToastId.current, {
          type: "pending",
          message: `Creating stream ${nextIndexRef.current}/${params.streams.length}…`,
        });
      doCreateStream({
        address: TRICKLE_VAULT_ADDRESS,
        abi: TRICKLE_VAULT_ABI,
        functionName: "createStream",
        args: [next.payee, params.tokenAddress, next.amountPerSec],
      });
    } else {
      setPhase("done");
      queryClient.invalidateQueries();
      if (activeToastId.current) {
        update(activeToastId.current, {
          type: "success",
          message: `${done} stream${done !== 1 ? "s" : ""} created`,
        });
        activeToastId.current = null;
      }
    }
  }, [createConfirmed, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // error handlers
  useEffect(() => {
    if (!approveError && !approveFailed) return;
    if (phase !== "approving") return;
    setPhase("error");
    if (activeToastId.current) {
      update(activeToastId.current, {
        type: "error",
        message: "Approval failed",
        description:
          (approveError as Error)?.message?.slice(0, 80) ?? "Transaction rejected",
      });
      activeToastId.current = null;
    }
  }, [approveError, approveFailed, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!depositError && !depositFailed) return;
    if (phase !== "depositing") return;
    setPhase("error");
    if (activeToastId.current) {
      update(activeToastId.current, { type: "error", message: "Deposit failed" });
      activeToastId.current = null;
    }
  }, [depositError, depositFailed, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!createError && !createFailed) return;
    if (phase !== "creating") return;
    setPhase("error");
    if (activeToastId.current) {
      update(activeToastId.current, {
        type: "error",
        message: `Stream ${nextIndexRef.current} failed`,
        description:
          (createError as Error)?.message?.slice(0, 80) ?? "Transaction rejected",
      });
      activeToastId.current = null;
    }
  }, [createError, createFailed, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  function calcAmountPerSec(salary: string): bigint {
    if (!salary || isNaN(Number(salary)) || Number(salary) <= 0) return 0n;
    return parseUnits(salary, tokenInfo.decimals) / SECONDS_PER_MONTH;
  }

  function addEmployee() {
    if (employees.length >= MAX_EMPLOYEES) return;
    setEmployees((prev) => [...prev, { id: genId(), address: "", salary: "" }]);
  }

  function removeEmployee(id: string) {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  }

  function updateEmployee(
    id: string,
    field: "address" | "salary",
    value: string
  ) {
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  }

  const validEmployees = employees.filter(
    (e) =>
      isAddress(e.address) &&
      e.address.toLowerCase() !== address?.toLowerCase() &&
      Number(e.salary) > 0 &&
      calcAmountPerSec(e.salary) > 0n
  );

  const seenAddresses = new Set<string>();
  const hasDuplicates = employees.some((e) => {
    if (!isAddress(e.address)) return false;
    const lower = e.address.toLowerCase();
    if (seenAddresses.has(lower)) return true;
    seenAddresses.add(lower);
    return false;
  });

  const totalMonthlyWei = validEmployees.reduce(
    (sum, e) => sum + parseUnits(e.salary, tokenInfo.decimals),
    0n
  );
  const totalMonthlyNum = parseFloat(
    formatUnits(totalMonthlyWei, tokenInfo.decimals)
  );
  const totalPerSec = totalMonthlyNum / 2592000;
  const vaultNum = vaultBalance
    ? parseFloat(formatUnits(vaultBalance as bigint, tokenInfo.decimals))
    : 0;
  const depositNeeded = totalMonthlyNum > vaultNum;
  const depositAmount = depositNeeded ? totalMonthlyNum - vaultNum : 0;

  function handleStart() {
    if (!address || validEmployees.length === 0) return;

    const streams = validEmployees.map((e) => ({
      payee: e.address as `0x${string}`,
      amountPerSec: calcAmountPerSec(e.salary),
      salary: e.salary,
    }));

    const currentBalance = (vaultBalance as bigint) ?? 0n;
    const needed =
      currentBalance < totalMonthlyWei ? totalMonthlyWei - currentBalance : 0n;

    paramsRef.current = { tokenAddress: tokenInfo.address, needed, streams };
    nextIndexRef.current = 0;
    setCreatedCount(0);

    if (needed > 0n) {
      setPhase("approving");
      activeToastId.current = toast({
        type: "pending",
        message: "Approving token spend…",
      });
      doApprove({
        address: tokenInfo.address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [TRICKLE_VAULT_ADDRESS, needed],
      });
    } else {
      const first = streams[0];
      nextIndexRef.current = 1;
      setPhase("creating");
      activeToastId.current = toast({
        type: "pending",
        message: `Creating stream 1/${streams.length}…`,
      });
      doCreateStream({
        address: TRICKLE_VAULT_ADDRESS,
        abi: TRICKLE_VAULT_ABI,
        functionName: "createStream",
        args: [first.payee, tokenInfo.address, first.amountPerSec],
      });
    }
  }

  function handleReset() {
    setPhase("idle");
    paramsRef.current = null;
    nextIndexRef.current = 0;
    resetApprove();
    resetDeposit();
    resetCreate();
  }

  function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      if (!rows.length) {
        toast({ type: "error", message: "CSV empty or unreadable" });
        return;
      }
      const imported = rows.slice(0, MAX_EMPLOYEES).map((r) => ({
        id: genId(),
        address: r.address,
        salary: r.salary,
      }));
      const skipped = rows.length - imported.length;
      setEmployees(imported);
      toast({
        type: "success",
        message: `Imported ${imported.length} employee${imported.length !== 1 ? "s" : ""}${skipped > 0 ? ` · ${skipped} skipped (max ${MAX_EMPLOYEES})` : ""}`,
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const isPending =
    phase === "approving" || phase === "depositing" || phase === "creating";
  const canProceed = validEmployees.length >= 1 && !hasDuplicates;

  if (!isConnected) {
    return (
      <DashboardLayout>
        <div className="mx-auto w-full max-w-[520px] px-5 pt-4">
          <BackButton onClick={() => router.back()} />
          <h1 className="mb-5 font-display text-[22px] font-semibold tracking-tight text-[var(--fg)]">
            Batch payroll
          </h1>
          <ConnectWalletPrompt
            eyebrow="Sign in required"
            title="Connect to run batch payroll"
            body="Link a Celo wallet to fund payroll and open per-second salary streams for your entire team at once."
          />
        </div>
      </DashboardLayout>
    );
  }

  if (phase === "done" && paramsRef.current) {
    const total = paramsRef.current.streams.length;
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
            {total} stream{total !== 1 ? "s" : ""} created
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-2 text-[13.5px] text-[var(--fg-mute)]"
          >
            Now paying{" "}
            <span className="text-[var(--fg)]">{total} team member{total !== 1 ? "s" : ""}</span>{" "}
            in {tokenInfo.symbol} — per second, on Celo.
          </motion.p>
          {createTxHash && (
            <motion.a
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.32 }}
              href={`${explorerUrl}/tx/${createTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 font-mono text-[11.5px] text-[var(--accent)]/70 hover:text-[var(--accent)] transition-colors"
            >
              View last tx on Celoscan
              <ArrowRight size={11} />
            </motion.a>
          )}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.42 }}
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
      <div className="mx-auto max-w-[520px] px-5">
        <BackButton onClick={() => router.back()} />

        <div className="mb-8">
          <h1 className="font-display text-[26px] font-semibold leading-[1.2] tracking-[-0.02em] text-[var(--fg)]">
            Batch payroll
          </h1>
          <p className="mt-1.5 text-[13.5px] text-[var(--fg-mute)]">
            Add your team — Trickle opens per-second streams to each member in
            one flow.
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
              {/* Token selector */}
              <FieldGroup label="Token">
                <TokenSelector
                  tokens={TOKEN_LIST}
                  selected={selectedToken}
                  onChange={setSelectedToken}
                />
              </FieldGroup>

              {/* Employee rows */}
              <FieldGroup
                label={`Team members (${employees.length})`}
                hint="EVM addresses on Celo"
              >
                <div className="space-y-2.5">
                  {employees.map((emp, i) => (
                    <EmployeeRow
                      key={emp.id}
                      index={i}
                      employee={emp}
                      self={address}
                      symbol={tokenInfo.symbol}
                      isDuplicate={
                        isAddress(emp.address) &&
                        employees
                          .filter((e) => e.id !== emp.id)
                          .some(
                            (e) =>
                              e.address.toLowerCase() ===
                              emp.address.toLowerCase()
                          )
                      }
                      onChangeAddress={(v) =>
                        updateEmployee(emp.id, "address", v)
                      }
                      onChangeSalary={(v) =>
                        updateEmployee(emp.id, "salary", v)
                      }
                      onRemove={
                        employees.length > 1
                          ? () => removeEmployee(emp.id)
                          : undefined
                      }
                    />
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-4">
                  {employees.length < MAX_EMPLOYEES && (
                    <button
                      onClick={addEmployee}
                      className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--accent-3)] transition-colors hover:text-[var(--accent)]"
                    >
                      <Plus size={13} strokeWidth={2.5} />
                      Add team member
                    </button>
                  )}
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    className="relative inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--fg-mute)] transition-colors hover:text-[var(--fg)]"
                  >
                    <Upload size={13} strokeWidth={2} />
                    Import CSV
                    <span className="ml-0.5 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white leading-none">
                      New
                    </span>
                  </button>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleCsvImport}
                  />
                </div>
              </FieldGroup>

              {/* Totals summary */}
              {validEmployees.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="overflow-hidden rounded-xl border border-[var(--border)]"
                >
                  <div className="divide-y divide-[var(--divider)]">
                    <div className="flex items-center justify-between bg-[var(--color-surface)] px-4 py-3 text-[12.5px]">
                      <span className="text-[var(--fg-mute)]">
                        Valid streams
                      </span>
                      <span className="font-mono text-[var(--fg-dim)]">
                        {validEmployees.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-[var(--color-surface)] px-4 py-3 text-[12.5px]">
                      <span className="text-[var(--fg-mute)]">
                        Total monthly
                      </span>
                      <span className="font-mono text-[var(--fg)]">
                        {totalMonthlyNum.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}{" "}
                        {tokenInfo.symbol}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-[var(--color-surface)] px-4 py-3 text-[12.5px]">
                      <span className="text-[var(--fg-mute)]">
                        Payroll balance
                      </span>
                      <span className="font-mono text-[var(--fg-dim)]">
                        {vaultNum.toFixed(2)} {tokenInfo.symbol}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {hasDuplicates && (
                <p className="flex items-center gap-1.5 text-[12px] text-[var(--danger)]">
                  <AlertTriangle size={12} />
                  Duplicate addresses — each employee must be unique.
                </p>
              )}

              <Button
                onClick={() => setFormStep("review")}
                disabled={!canProceed}
                className="w-full"
                rightIcon={<ArrowRight size={14} />}
              >
                {canProceed
                  ? `Review ${validEmployees.length} stream${validEmployees.length !== 1 ? "s" : ""}`
                  : "Review"}
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
              {/* Summary card */}
              <Card padded={false}>
                <div className="divide-y divide-[var(--border)]">
                  <SummaryRow label="Token" value={tokenInfo.symbol} />
                  <SummaryRow
                    label="Streams"
                    value={
                      <span className="font-mono text-[var(--fg)]">
                        {validEmployees.length}
                      </span>
                    }
                  />
                  <SummaryRow
                    label="Total monthly"
                    value={
                      <span className="font-mono text-[var(--fg)]">
                        {totalMonthlyNum.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}{" "}
                        {tokenInfo.symbol}
                      </span>
                    }
                  />
                  <SummaryRow
                    label="Total per second"
                    value={
                      <span className="font-mono text-[var(--accent-3)] tabular">
                        <AnimatedNumber value={totalPerSec} decimals={8} />{" "}
                        {tokenInfo.symbol}
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

              {/* Per-employee breakdown */}
              <div className="space-y-1.5">
                {validEmployees.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--color-surface)] px-4 py-2.5"
                  >
                    <span className="font-mono text-[12px] text-[var(--fg-dim)]">
                      {e.address.slice(0, 8)}…{e.address.slice(-6)}
                    </span>
                    <span className="text-[12.5px] text-[var(--fg)]">
                      {Number(e.salary).toLocaleString()} {tokenInfo.symbol}/mo
                    </span>
                  </div>
                ))}
              </div>

              {/* Deposit warning */}
              {depositNeeded && (
                <div className="flex items-start gap-3 rounded-xl border border-[var(--warn)]/20 bg-[var(--warn)]/[0.05] px-4 py-3">
                  <AlertTriangle
                    size={14}
                    className="mt-0.5 shrink-0 text-[var(--warn)]"
                  />
                  <p className="text-[12.5px] leading-relaxed text-[var(--warn)]/90">
                    Payroll needs a top-up — we&apos;ll approve and deposit{" "}
                    <span className="font-mono text-[var(--warn)]">
                      {depositAmount.toFixed(2)} {tokenInfo.symbol}
                    </span>{" "}
                    before opening streams.
                  </p>
                </div>
              )}

              {/* Progress indicator */}
              {isPending && (
                <BatchProgress
                  phase={phase}
                  needsDeposit={depositNeeded}
                  created={createdCount}
                  total={validEmployees.length}
                />
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
                  {phase === "idle"
                    ? `Confirm ${validEmployees.length} stream${validEmployees.length !== 1 ? "s" : ""}`
                    : phase === "error"
                      ? "Try again"
                      : isPending
                        ? phase === "creating"
                          ? `${createdCount}/${validEmployees.length} done`
                          : "Processing…"
                        : "Done"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-[var(--fg-mute)] transition-colors hover:text-[var(--fg)]"
    >
      <ArrowLeft size={13} />
      Back
    </button>
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

function EmployeeRow({
  index,
  employee,
  self,
  symbol,
  isDuplicate,
  onChangeAddress,
  onChangeSalary,
  onRemove,
}: {
  index: number;
  employee: BatchEmployee;
  self?: string;
  symbol: string;
  isDuplicate: boolean;
  onChangeAddress: (v: string) => void;
  onChangeSalary: (v: string) => void;
  onRemove?: () => void;
}) {
  const hasAddr = employee.address.length > 0;
  const formatErr = hasAddr && !isAddress(employee.address);
  const selfErr =
    hasAddr &&
    isAddress(employee.address) &&
    employee.address.toLowerCase() === self?.toLowerCase();
  const addrInvalid = formatErr || selfErr || isDuplicate;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--color-surface)] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--fg-faint)]">
          Employee {index + 1}
        </span>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-[var(--fg-faint)] transition-colors hover:text-[var(--danger)]"
            aria-label="Remove employee"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <Input
        value={employee.address}
        onChange={(e) => onChangeAddress(e.target.value)}
        placeholder="0x…"
        mono
        invalid={addrInvalid}
      />
      {formatErr && (
        <p className="flex items-center gap-1 text-[11.5px] text-[var(--danger)]">
          <AlertTriangle size={11} />
          Invalid address.
        </p>
      )}
      {selfErr && (
        <p className="flex items-center gap-1 text-[11.5px] text-[var(--danger)]">
          <AlertTriangle size={11} />
          Cannot stream to yourself.
        </p>
      )}
      {isDuplicate && !selfErr && !formatErr && (
        <p className="flex items-center gap-1 text-[11.5px] text-[var(--danger)]">
          <AlertTriangle size={11} />
          Duplicate address.
        </p>
      )}
      <Input
        type="number"
        value={employee.salary}
        onChange={(e) => onChangeSalary(e.target.value)}
        placeholder="Monthly salary"
        trailing={`${symbol}/mo`}
        min="0"
      />
    </div>
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

function BatchProgress({
  phase,
  needsDeposit,
  created,
  total,
}: {
  phase: Phase;
  needsDeposit: boolean;
  created: number;
  total: number;
}) {
  const steps = needsDeposit
    ? ["Approve", "Deposit", `Streams (${created}/${total})`]
    : [`Streams (${created}/${total})`];

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

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--color-surface-2)] px-4 py-3 text-[12px]">
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
            : "text-[var(--fg-faint)]"
      )}
    >
      <span
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-bold",
          done
            ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
            : active
              ? "border-[var(--border-strong)] bg-[var(--color-surface-2)]"
              : "border-white/10"
        )}
      >
        {done ? <Check size={8} strokeWidth={3} /> : null}
      </span>
      {label}
    </span>
  );
}
