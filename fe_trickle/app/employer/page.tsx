"use client";

import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Plus,
  Activity,
  Check,
  TrendingUp,
} from "lucide-react";
import {
  TRICKLE_VAULT_ABI,
  TRICKLE_VAULT_ADDRESS,
  ERC20_ABI,
} from "@/config/contracts";
import { TOKENS, TOKEN_LIST } from "@/config/tokens";
import StreamCard, { StreamCardSkeleton } from "@/components/StreamCard";
import DashboardLayout from "@/components/DashboardLayout";
import { ConnectWalletPrompt } from "@/components/ConnectWalletPrompt";
import { useDeposit } from "@/hooks/useDeposit";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { Card } from "@/components/ui/Card";
import { AnimatedNumber, StreamTicker } from "@/components/ui/AnimatedNumber";
import { cn } from "@/lib/cn";

type Stream = {
  payer: string;
  payee: string;
  token: string;
  amountPerSec: bigint;
  lastPaid: number;
  startTime: number;
};

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export default function EmployerDashboard() {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const { toast, update } = useToast();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [selectedToken, setSelectedToken] = useState("tUSDC");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [panel, setPanel] = useState<"none" | "deposit" | "withdraw">("none");

  const tokenInfo = TOKENS[selectedToken];

  const { data: vaultBalance, isLoading: balanceLoading } = useReadContract({
    address: TRICKLE_VAULT_ADDRESS,
    abi: TRICKLE_VAULT_ABI,
    functionName: "balances",
    args: address ? [address, tokenInfo.address] : undefined,
    query: { enabled: !!address },
  });
  const { data: walletBalance } = useReadContract({
    address: tokenInfo.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: totalRate } = useReadContract({
    address: TRICKLE_VAULT_ADDRESS,
    abi: TRICKLE_VAULT_ABI,
    functionName: "totalPaidPerSec",
    args: address ? [address, tokenInfo.address] : undefined,
    query: { enabled: !!address },
  });
  const { data: streamIds, isLoading: streamIdsLoading } = useReadContract({
    address: TRICKLE_VAULT_ADDRESS,
    abi: TRICKLE_VAULT_ABI,
    functionName: "getPayerStreamIds",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const streamCalls = (streamIds ?? []).map((id: `0x${string}`) => ({
    address: TRICKLE_VAULT_ADDRESS,
    abi: TRICKLE_VAULT_ABI,
    functionName: "getStream" as const,
    args: [id] as const,
  }));
  const { data: streamResults, isLoading: streamDataLoading } = useReadContracts({
    contracts: streamCalls,
    query: { enabled: streamCalls.length > 0 },
  });

  const streamsLoading = streamIdsLoading || streamDataLoading;

  const allStreams: Stream[] = (streamResults ?? [])
    .filter((r) => r.status === "success" && r.result)
    .map((r) => {
      const s = r.result as unknown as {
        payer: string;
        payee: string;
        token: string;
        amountPerSec: bigint;
        lastPaid: bigint;
        startTime: bigint;
      };
      return {
        payer: s.payer,
        payee: s.payee,
        token: s.token,
        amountPerSec: s.amountPerSec,
        lastPaid: Number(s.lastPaid),
        startTime: Number(s.startTime),
      };
    })
    .filter((s) => s.startTime > 0);

  const streams = allStreams.filter(
    (s) => s.token.toLowerCase() === tokenInfo.address.toLowerCase(),
  );

  const depositFlow = useDeposit();

  function handleDeposit() {
    if (!address || !depositAmount) return;
    depositFlow.deposit(
      tokenInfo.address,
      parseUnits(depositAmount, tokenInfo.decimals),
    );
  }

  useEffect(() => {
    if (depositFlow.isDone) {
      toast({
        type: "success",
        message: "Deposit successful",
        description: `${depositAmount} ${tokenInfo.symbol} added to vault`,
        txHash: depositFlow.depositTxHash,
      });
      setDepositAmount("");
      setPanel("none");
      depositFlow.reset();
      queryClient.invalidateQueries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositFlow.isDone]);

  useEffect(() => {
    if (depositFlow.isError) {
      toast({
        type: "error",
        message: "Deposit failed",
        description:
          depositFlow.error?.message?.slice(0, 80) ?? "Transaction rejected",
      });
      depositFlow.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositFlow.isError]);

  const wbToastId = useRef<string | null>(null);
  const { writeContract: doWithdrawBalance, data: wbTxHash } =
    useWriteContract();
  const { isSuccess: wbSuccess, isError: wbFailed } =
    useWaitForTransactionReceipt({ hash: wbTxHash });

  function handleWithdrawBalance() {
    if (!address || !withdrawAmount) return;
    doWithdrawBalance({
      address: TRICKLE_VAULT_ADDRESS,
      abi: TRICKLE_VAULT_ABI,
      functionName: "withdrawBalance",
      args: [tokenInfo.address, parseUnits(withdrawAmount, tokenInfo.decimals)],
    });
    wbToastId.current = toast({ type: "pending", message: "Withdrawing from vault…" });
  }
  useEffect(() => {
    if (wbSuccess) {
      if (wbToastId.current) {
        update(wbToastId.current, {
          type: "success",
          message: "Withdrawn successfully",
          description: `${withdrawAmount} ${tokenInfo.symbol} returned to wallet`,
          txHash: wbTxHash,
        });
        wbToastId.current = null;
      }
      setWithdrawAmount("");
      setPanel("none");
      queryClient.invalidateQueries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wbSuccess]);
  useEffect(() => {
    if (wbFailed && wbToastId.current) {
      update(wbToastId.current, { type: "error", message: "Withdrawal failed" });
      wbToastId.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wbFailed]);

  const cancelToastId = useRef<string | null>(null);
  const {
    writeContract: cancelStream,
    data: cancelTxHash,
    isPending: isCancelPending,
  } = useWriteContract();
  const { isSuccess: cancelSuccess } = useWaitForTransactionReceipt({
    hash: cancelTxHash,
  });

  function handleCancel(stream: Stream) {
    cancelStream({
      address: TRICKLE_VAULT_ADDRESS,
      abi: TRICKLE_VAULT_ABI,
      functionName: "cancelStream",
      args: [
        stream.payee as `0x${string}`,
        stream.token as `0x${string}`,
        stream.amountPerSec,
      ],
    });
    cancelToastId.current = toast({ type: "pending", message: "Cancelling stream…" });
  }
  useEffect(() => {
    if (cancelSuccess) {
      if (cancelToastId.current) {
        update(cancelToastId.current, {
          type: "success",
          message: "Stream cancelled",
          description: "Remaining balance returned to vault",
          txHash: cancelTxHash,
        });
        cancelToastId.current = null;
      }
      queryClient.invalidateQueries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelSuccess]);

  if (!isConnected) {
    return (
      <DashboardLayout>
        <div className="mx-auto w-full max-w-[460px] px-5 pt-4">
          <div className="mb-5">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-3)]">
              Employer
            </p>
            <h1 className="mt-0.5 font-display text-[22px] font-semibold tracking-tight text-[var(--fg)]">
              Vault
            </h1>
          </div>
          <ConnectWalletPrompt
            eyebrow="Vault locked"
            title="Connect to open your vault"
            body="Connect a Celo wallet to deposit liquidity and start paying employees per second."
          />
        </div>
      </DashboardLayout>
    );
  }

  const balanceNum = vaultBalance
    ? parseFloat(formatUnits(vaultBalance as bigint, tokenInfo.decimals))
    : 0;
  const walletNum = walletBalance
    ? parseFloat(formatUnits(walletBalance as bigint, tokenInfo.decimals))
    : 0;
  const ratePerSec = totalRate
    ? parseFloat(formatUnits(totalRate as bigint, tokenInfo.decimals))
    : 0;
  const monthlyBurn = ratePerSec * 2592000;
  const runway =
    ratePerSec > 0 ? Math.floor(balanceNum / ratePerSec / 86400) : null;

  const greeting = getGreeting();

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[460px] px-5">
        {/* Greeting row */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 flex items-center gap-3"
        >
          <span
            className="grid h-10 w-10 place-items-center rounded-full text-[13px] font-semibold text-white"
            style={{
              background:
                "linear-gradient(140deg, #818CF8 0%, #4F46E5 100%)",
            }}
          >
            {mounted && address ? (
              <>
                {address.slice(2, 3).toUpperCase()}
                {address.slice(-1).toUpperCase()}
              </>
            ) : null}
          </span>
          <div>
            <p className="text-[11.5px] text-[var(--fg-mute)]">
              {greeting},
            </p>
            <p className="font-mono text-[13px] font-semibold text-[var(--fg)]">
              {mounted && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ""}
            </p>
          </div>
        </motion.div>

        {/* Token tabs */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.02 }}
          className="mb-5"
        >
          <Tabs
            id="employer-token"
            items={TOKEN_LIST.map((t) => ({ value: t.symbol, label: t.symbol }))}
            value={selectedToken}
            onChange={(v) => {
              setSelectedToken(v);
              setPanel("none");
            }}
            size="sm"
          />
        </motion.div>

        {/* Wallet hero */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.06 }}
          className="mb-4"
        >
          <p className="mb-2 text-[12.5px] text-[var(--fg-mute)]">
            Vault overview
          </p>
          {balanceLoading ? (
            <Skeleton className="h-14 w-60" />
          ) : (
            <div className="font-display text-[44px] font-bold leading-none tracking-[-0.025em] tabular text-[var(--fg)]">
              <AnimatedNumber value={balanceNum} decimals={2} />
              <span className="ml-2 text-[18px] font-semibold text-[var(--fg-mute)]">
                {tokenInfo.symbol}
              </span>
            </div>
          )}

          {/* Performance pill */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {ratePerSec > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-success-soft)] px-2.5 py-1 text-[12px] font-semibold text-[var(--success)]">
                <TrendingUp size={12} strokeWidth={2.5} />
                <StreamTicker
                  ratePerSec={ratePerSec}
                  decimals={6}
                  className="font-mono tabular"
                />
                /sec
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-2)] border border-[var(--border)] px-2.5 py-1 text-[12px] font-medium text-[var(--fg-mute)]">
                No active streams
              </span>
            )}
            {monthlyBurn > 0 && (
              <span className="text-[12px] text-[var(--fg-mute)]">
                {monthlyBurn.toFixed(2)} {tokenInfo.symbol}/mo
              </span>
            )}
            {runway !== null && runway > 0 && (
              <span className="text-[12px] text-[var(--fg-mute)]">
                · {runway.toLocaleString()}d runway
              </span>
            )}
          </div>

          <div className="mt-1.5 text-[12px] text-[var(--fg-faint)]">
            Wallet balance{" "}
            <span className="font-mono text-[var(--fg-mute)]">
              {walletNum.toFixed(2)}
            </span>{" "}
            {tokenInfo.symbol}
          </div>
        </motion.div>

        {/* Action row */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.1 }}
          className="mb-6 grid grid-cols-3 gap-2.5"
        >
          <ActionButton
            active={panel === "deposit"}
            onClick={() =>
              setPanel((p) => (p === "deposit" ? "none" : "deposit"))
            }
            icon={<ArrowDownToLine size={15} strokeWidth={2.25} />}
            label="Deposit"
          />
          <ActionButton
            active={panel === "withdraw"}
            onClick={() =>
              setPanel((p) => (p === "withdraw" ? "none" : "withdraw"))
            }
            icon={<ArrowUpFromLine size={15} strokeWidth={2.25} />}
            label="Withdraw"
          />
          <Link href="/employer/create" className="contents">
            <ActionButton
              primary
              icon={<Plus size={15} strokeWidth={2.5} />}
              label="New stream"
            />
          </Link>
        </motion.div>

        <AnimatePresence initial={false}>
          {panel !== "none" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="mb-6 overflow-hidden"
            >
              <Card padded={false} className="p-5">
                {panel === "deposit" ? (
                  <DepositForm
                    amount={depositAmount}
                    setAmount={setDepositAmount}
                    walletBalance={walletNum}
                    tokenSymbol={tokenInfo.symbol}
                    onSubmit={handleDeposit}
                    phase={depositFlow.phase}
                  />
                ) : (
                  <WithdrawForm
                    amount={withdrawAmount}
                    setAmount={setWithdrawAmount}
                    balance={balanceNum}
                    tokenSymbol={tokenInfo.symbol}
                    onSubmit={handleWithdrawBalance}
                  />
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active streams */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.14 }}
        >
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[16px] font-semibold tracking-tight text-[var(--fg)]">
              Active streams{" "}
              {!streamsLoading && (
                <span className="ml-1 font-mono text-[13px] text-[var(--fg-faint)] tabular">
                  {streams.length}
                </span>
              )}
            </h2>
            {streams.length > 0 && (
              <Link
                href="/employer/create"
                className="text-[12px] font-medium text-[var(--accent-3)] transition-colors hover:text-[var(--accent)]"
              >
                Add
              </Link>
            )}
          </div>

          {streamsLoading ? (
            <div className="grid gap-3">
              <StreamCardSkeleton />
              <StreamCardSkeleton />
            </div>
          ) : streams.length === 0 ? (
            <EmptyState
              title={`No ${selectedToken} streams`}
              body="Create a salary stream to start paying an employee per second."
              cta={{ label: "Create stream", href: "/employer/create" }}
            />
          ) : (
            <div className="grid gap-3">
              {streams.map((s, i) => (
                <StreamCard
                  key={i}
                  {...s}
                  role="payer"
                  onCancel={() => handleCancel(s)}
                  isPending={isCancelPending}
                />
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function ActionButton({
  icon,
  label,
  active,
  primary,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  primary?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-2xl border px-3 py-3.5 text-[13.5px] font-semibold transition-colors",
        primary
          ? "border-transparent bg-[var(--accent)] text-white shadow-[var(--shadow-accent)] hover:bg-[var(--accent-2)]"
          : active
            ? "border-[var(--accent)]/30 bg-[var(--color-accent-soft)] text-[var(--accent-3)]"
            : "border-[var(--border)] bg-[var(--color-surface)] text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-2)]",
      )}
    >
      {icon}
      {label}
    </motion.button>
  );
}

function DepositForm({
  amount,
  setAmount,
  walletBalance,
  tokenSymbol,
  onSubmit,
  phase,
}: {
  amount: string;
  setAmount: (v: string) => void;
  walletBalance: number;
  tokenSymbol: string;
  onSubmit: () => void;
  phase: string;
}) {
  const isPending = phase === "approving" || phase === "depositing";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[12.5px] text-[var(--fg-mute)]">
        <span>Amount to deposit</span>
        <button
          onClick={() => setAmount(walletBalance.toString())}
          className="rounded-full border border-[var(--border)] bg-[var(--color-surface-2)] px-2.5 py-0.5 text-[11.5px] font-medium text-[var(--fg-dim)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
        >
          Max · {walletBalance.toFixed(2)}
        </button>
      </div>
      <div className="flex gap-2">
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          trailing={tokenSymbol}
          disabled={isPending}
          className="flex-1"
        />
        <Button
          shape="pill"
          onClick={onSubmit}
          disabled={!amount || isPending}
          loading={isPending}
        >
          {phase === "approving"
            ? "Approving…"
            : phase === "depositing"
              ? "Depositing…"
              : "Deposit"}
        </Button>
      </div>
      {isPending && (
        <div className="flex items-center gap-2 text-[12px]">
          <StepDot
            active={phase === "approving"}
            done={phase === "depositing"}
            label="Approve"
          />
          <span className="text-[var(--fg-faint)]">→</span>
          <StepDot
            active={phase === "depositing"}
            done={false}
            label="Deposit"
          />
        </div>
      )}
    </div>
  );
}

function WithdrawForm({
  amount,
  setAmount,
  balance,
  tokenSymbol,
  onSubmit,
}: {
  amount: string;
  setAmount: (v: string) => void;
  balance: number;
  tokenSymbol: string;
  onSubmit: () => void;
}) {
  const over = Number(amount) > balance;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[12.5px] text-[var(--fg-mute)]">
        <span>Amount to withdraw</span>
        <button
          onClick={() => setAmount(balance.toString())}
          className="rounded-full border border-[var(--border)] bg-[var(--color-surface-2)] px-2.5 py-0.5 text-[11.5px] font-medium text-[var(--fg-dim)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
        >
          Max · {balance.toFixed(2)}
        </button>
      </div>
      <div className="flex gap-2">
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Max ${balance.toFixed(2)}`}
          trailing={tokenSymbol}
          invalid={over}
          className="flex-1"
        />
        <Button
          variant="secondary"
          shape="pill"
          onClick={onSubmit}
          disabled={!amount || over}
        >
          Withdraw
        </Button>
      </div>
      {over && (
        <p className="text-[12.5px] text-[var(--danger)]">
          Amount exceeds vault balance.
        </p>
      )}
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
          ? "text-[var(--success)]"
          : active
            ? "text-[var(--fg)]"
            : "text-[var(--fg-faint)]",
      )}
    >
      <span
        className={cn(
          "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border",
          done
            ? "border-[var(--success)] bg-[var(--color-success-soft)]"
            : active
              ? "border-[var(--border-strong)] bg-[var(--color-surface-2)]"
              : "border-[var(--border)]",
        )}
      >
        {done ? <Check size={8} strokeWidth={3} /> : null}
      </span>
      {label}
    </span>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { label: string; href: string };
}) {
  return (
    <Card padded={false} className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-accent-soft)]">
        <Activity
          size={20}
          className="text-[var(--accent-3)]"
          strokeWidth={1.75}
        />
      </div>
      <p className="mb-1 font-display text-[15px] font-semibold text-[var(--fg)]">
        {title}
      </p>
      <p className="mx-auto mb-5 max-w-[360px] text-[13px] text-[var(--fg-mute)]">
        {body}
      </p>
      {cta ? (
        <Link href={cta.href}>
          <Button size="sm" shape="pill">
            {cta.label}
          </Button>
        </Link>
      ) : null}
    </Card>
  );
}
