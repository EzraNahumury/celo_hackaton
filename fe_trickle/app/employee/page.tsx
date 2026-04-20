"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits } from "viem";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Check,
  ArrowDownToLine,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { TRICKLE_VAULT_ABI } from "@/config/contracts";
import { useVaultAddress, useChainTokenList } from "@/hooks/useChain";
import type { TokenInfo } from "@/config/tokens";
import StreamCard, { StreamCardSkeleton } from "@/components/StreamCard";
import DashboardLayout from "@/components/DashboardLayout";
import { ConnectWalletPrompt } from "@/components/ConnectWalletPrompt";
import { useToast } from "@/components/Toast";
import { Card } from "@/components/ui/Card";
import { StreamTicker } from "@/components/ui/AnimatedNumber";
import { MiniChart } from "@/components/ui/MiniChart";
import { FlowIllustration } from "@/components/ui/FlowIllustration";
import { cn } from "@/lib/cn";

type Stream = {
  payer: string;
  payee: string;
  token: string;
  amountPerSec: bigint;
  lastPaid: number;
  startTime: number;
};

type Range = "1H" | "1D" | "1W" | "1M" | "ALL";
const RANGES: Range[] = ["1H", "1D", "1W", "1M", "ALL"];
const RANGE_SECONDS: Record<Range, number> = {
  "1H": 60 * 60,
  "1D": 24 * 60 * 60,
  "1W": 7 * 24 * 60 * 60,
  "1M": 30 * 24 * 60 * 60,
  ALL: 0,
};

type TokenMeta = Pick<TokenInfo, "symbol" | "decimals">;
const FALLBACK_TOKEN: TokenMeta = { symbol: "???", decimals: 18 };

function tokenMetaFor(list: TokenInfo[], address: string): TokenMeta {
  return (
    list.find((t) => t.address.toLowerCase() === address.toLowerCase()) ??
    FALLBACK_TOKEN
  );
}
function streamAccrued(list: TokenInfo[], s: Stream, nowSec: number): number {
  const m = tokenMetaFor(list, s.token);
  const raw = s.amountPerSec * BigInt(Math.max(0, nowSec - s.lastPaid));
  return parseFloat(formatUnits(raw, m.decimals));
}
function streamRatePerSec(list: TokenInfo[], s: Stream): number {
  const m = tokenMetaFor(list, s.token);
  return parseFloat(formatUnits(s.amountPerSec, m.decimals));
}
function streamMonthly(list: TokenInfo[], s: Stream): number {
  const m = tokenMetaFor(list, s.token);
  return parseFloat(formatUnits(s.amountPerSec * 2592000n, m.decimals));
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export default function EmployeeDashboard() {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const { toast, update } = useToast();

  const TRICKLE_VAULT_ADDRESS = useVaultAddress();
  const TOKEN_LIST = useChainTokenList();

  const [now, setNow] = useState(0);
  const [copied, setCopied] = useState(false);
  const [range, setRange] = useState<Range>("1D");

  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000));
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const { data: streamIds, isLoading: idsLoading } = useReadContract({
    address: TRICKLE_VAULT_ADDRESS,
    abi: TRICKLE_VAULT_ABI,
    functionName: "getPayeeStreamIds",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const streamCalls = (streamIds ?? []).map((id: `0x${string}`) => ({
    address: TRICKLE_VAULT_ADDRESS,
    abi: TRICKLE_VAULT_ABI,
    functionName: "getStream" as const,
    args: [id] as const,
  }));
  const { data: streamResults, isLoading: streamsLoading } = useReadContracts({
    contracts: streamCalls,
    query: { enabled: streamCalls.length > 0 },
  });

  const streams: Stream[] = (streamResults ?? [])
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

  const totalWithdrawableAccrued =
    now > 0
      ? streams.reduce((acc, s) => acc + streamAccrued(TOKEN_LIST, s, now), 0)
      : 0;
  const totalRatePerSec = streams.reduce(
    (acc, s) => acc + streamRatePerSec(TOKEN_LIST, s),
    0,
  );
  const totalMonthly = streams.reduce(
    (acc, s) => acc + streamMonthly(TOKEN_LIST, s),
    0,
  );

  const earliestStart = streams.length
    ? Math.min(...streams.map((s) => s.startTime))
    : 0;
  const totalStreamedSinceStart =
    now > 0 && earliestStart > 0
      ? totalRatePerSec * Math.max(0, now - earliestStart)
      : 0;

  /* Chart values derived from rate + elapsed */
  const chartValues = useMemo(() => {
    if (totalRatePerSec <= 0 || now === 0) return [0, 0];
    const span = range === "ALL"
      ? Math.max(60, now - (earliestStart || now - 86400))
      : Math.min(RANGE_SECONDS[range], Math.max(60, now - (earliestStart || 0)));
    const points = 40;
    const end = totalWithdrawableAccrued;
    const start = Math.max(0, end - totalRatePerSec * span);
    return Array.from({ length: points }, (_, i) => {
      const t = i / (points - 1);
      // Introduce a tiny wave for organic feel; still monotonic visually
      const jitter = Math.sin(t * Math.PI * 3) * totalRatePerSec * 0.4;
      return start + (end - start) * t + jitter * (t > 0 && t < 1 ? 1 : 0);
    });
  }, [
    range,
    now,
    earliestStart,
    totalRatePerSec,
    totalWithdrawableAccrued,
  ]);

  const withdrawToastId = useRef<string | null>(null);
  const {
    writeContract: doWithdraw,
    data: withdrawTxHash,
    isPending: isWithdrawPending,
  } = useWriteContract();
  const { isSuccess: withdrawSuccess, isError: withdrawFailed } =
    useWaitForTransactionReceipt({ hash: withdrawTxHash, pollingInterval: 1_500 });

  function handleWithdraw(s: Stream) {
    doWithdraw({
      address: TRICKLE_VAULT_ADDRESS,
      abi: TRICKLE_VAULT_ABI,
      functionName: "withdraw",
      args: [
        s.payer as `0x${string}`,
        s.token as `0x${string}`,
        s.amountPerSec,
      ],
    });
    withdrawToastId.current = toast({ type: "pending", message: "Withdrawing earnings…" });
  }
  useEffect(() => {
    if (withdrawSuccess) {
      if (withdrawToastId.current) {
        update(withdrawToastId.current, {
          type: "success",
          message: "Withdrawal successful",
          description: "Tokens sent to your wallet",
          txHash: withdrawTxHash,
        });
        withdrawToastId.current = null;
      }
      queryClient.invalidateQueries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawSuccess]);
  useEffect(() => {
    if (withdrawFailed && withdrawToastId.current) {
      update(withdrawToastId.current, { type: "error", message: "Withdrawal failed" });
      withdrawToastId.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawFailed]);

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  if (!isConnected) {
    return (
      <DashboardLayout>
        <div className="mx-auto w-full max-w-[460px] px-5 pt-4">
          <h1 className="mb-5 font-display text-[22px] font-semibold tracking-tight text-[var(--fg)]">
            Earnings
          </h1>
          <ConnectWalletPrompt
            eyebrow="Earnings hidden"
            title="Connect to see your earnings"
            body="Connect a Celo wallet to view incoming streams and withdraw your salary anytime."
          />
        </div>
      </DashboardLayout>
    );
  }

  const isLoading = idsLoading || streamsLoading;
  const hasStreams = streams.length > 0;
  const primarySymbol = streams[0]
    ? tokenMetaFor(TOKEN_LIST, streams[0].token).symbol
    : TOKEN_LIST[0]?.symbol ?? "USDC";
  const runway = totalRatePerSec > 0
    ? Math.floor(totalWithdrawableAccrued / totalRatePerSec / 60)
    : 0;

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[460px] px-5">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="mb-6 flex items-end justify-between gap-3"
        >
          <h1 className="font-display text-[22px] font-semibold tracking-tight text-[var(--fg)]">
            Earnings
          </h1>
          {hasStreams && (
            <span className="text-[11.5px] font-medium text-[var(--fg-mute)]">
              {streams.length} stream{streams.length === 1 ? "" : "s"} · since{" "}
              {new Date(earliestStart * 1000).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </motion.div>

        {/* Big withdrawable */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.04 }}
          className="mb-4"
        >
          <p className="text-[12.5px] text-[var(--fg-mute)]">Withdrawable</p>
          {isLoading ? (
            <Skeleton className="mt-2 h-14 w-56" />
          ) : (
            <p className="mt-1 font-display text-[46px] font-bold leading-none tracking-[-0.025em] tabular text-[var(--fg)]">
              <StreamTicker
                ratePerSec={totalRatePerSec}
                startValue={totalWithdrawableAccrued}
                decimals={6}
              />
              <span className="ml-2 text-[18px] font-semibold text-[var(--fg-mute)]">
                {primarySymbol}
              </span>
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            {totalRatePerSec > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-success-soft)] px-2.5 py-1 text-[12px] font-semibold text-[var(--success)]">
                <TrendingUp size={11} strokeWidth={2.5} />
                <StreamTicker
                  ratePerSec={totalRatePerSec}
                  decimals={6}
                  className="font-mono tabular"
                />
                /sec
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-[12px] text-[var(--fg-mute)]">
                No streams yet
              </span>
            )}
          </div>
        </motion.div>

        {/* Two stat cards */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.08 }}
          className="mb-4 grid grid-cols-2 gap-3"
        >
          <Card padded={false} className="overflow-hidden p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--fg-faint)]">
                  Monthly rate
                </p>
                <p className="mt-1 font-display text-[20px] font-bold tabular text-[var(--fg)]">
                  {totalMonthly.toLocaleString("en-US", {
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-success-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--success)]">
                <TrendingUp size={9} strokeWidth={3} />
                Live
              </span>
            </div>
            <div className="mt-3 h-10 w-full">
              <MiniChart
                values={chartValues.slice(-20)}
                stroke="var(--color-success)"
                fill="rgba(16, 185, 129, 0.25)"
                strokeWidth={1.5}
              />
            </div>
          </Card>

          <Card padded={false} className="overflow-hidden p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--fg-faint)]">
                  Lifetime streamed
                </p>
                <p className="mt-1 font-display text-[20px] font-bold tabular text-[var(--fg)]">
                  {totalStreamedSinceStart.toLocaleString("en-US", {
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--accent-3)]">
                <Calendar size={9} strokeWidth={3} />
                {streams.length} open
              </span>
            </div>
            <div className="mt-3 h-10 w-full">
              <MiniChart
                values={chartValues}
                stroke="var(--color-accent)"
                fill="rgba(99, 102, 241, 0.22)"
                strokeWidth={1.5}
              />
            </div>
          </Card>
        </motion.div>

        {/* Big chart */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.12 }}
        >
          <Card padded={false} className="overflow-hidden">
            <div className="relative h-[180px] w-full">
              {hasStreams ? (
                <MiniChart
                  values={chartValues}
                  stroke="var(--color-accent-3)"
                  fill="rgba(129, 140, 248, 0.18)"
                  strokeWidth={2}
                />
              ) : (
                <div className="grid h-full place-items-center text-[13px] text-[var(--fg-faint)]">
                  No data yet
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-1.5 border-t border-[var(--divider)] p-3">
              {RANGES.map((r) => {
                const active = r === range;
                return (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors",
                      active
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--fg-mute)] hover:text-[var(--fg)]",
                    )}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Stream list */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.16 }}
          className="mt-6"
        >
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[16px] font-semibold tracking-tight text-[var(--fg)]">
              Incoming streams{" "}
              {!isLoading && (
                <span className="ml-1 font-mono text-[13px] text-[var(--fg-faint)] tabular">
                  {streams.length}
                </span>
              )}
            </h2>
          </div>

          {isLoading ? (
            <div className="grid gap-3">
              <StreamCardSkeleton />
              <StreamCardSkeleton />
            </div>
          ) : !hasStreams ? (
            <Card padded={false} className="flex flex-col items-center px-6 py-10 text-center">
              <div className="mb-5 text-[var(--accent-3)]">
                <FlowIllustration />
              </div>
              <p className="mb-1 font-display text-[15px] font-semibold text-[var(--fg)]">
                Nothing flowing yet
              </p>
              <p className="mx-auto max-w-[360px] text-[13px] text-[var(--fg-mute)]">
                Share your address with your employer — salary starts the
                moment they open a stream to you.
              </p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {streams.map((s, i) => (
                <StreamCard
                  key={i}
                  {...s}
                  role="payee"
                  onWithdraw={() => handleWithdraw(s)}
                  isPending={isWithdrawPending}
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* Stats row */}
        {hasStreams && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.2 }}
            className="mt-6"
          >
            <h3 className="mb-3 font-display text-[14px] font-semibold tracking-tight text-[var(--fg)]">
              Stream breakdown
            </h3>
            <Card padded={false} className="divide-y divide-[var(--divider)]">
              <StatRow
                label="Rate per second"
                value={totalRatePerSec.toFixed(8)}
                suffix={primarySymbol}
              />
              <StatRow
                label="Uncollected"
                value={`${runway}m`}
                hint="Minutes accrued since your last withdrawal"
              />
              <StatRow
                label="Open streams"
                value={streams.length.toString()}
              />
              <StatRow
                label="First stream opened"
                value={
                  earliestStart
                    ? new Date(earliestStart * 1000).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" },
                      )
                    : "—"
                }
              />
            </Card>
          </motion.div>
        )}

        {/* Bottom actions — pull biggest stream quickly */}
        {hasStreams && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.24 }}
            className="mt-6"
          >
            <div className="flex gap-2.5">
              <button
                onClick={() => {
                  // Fire a withdraw tx for every stream that has something accrued.
                  // Wallets will queue prompts sequentially.
                  streams
                    .filter((s) => streamAccrued(TOKEN_LIST, s, now) > 0)
                    .forEach((s) => handleWithdraw(s));
                }}
                disabled={isWithdrawPending || totalWithdrawableAccrued === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 py-3 text-[14px] font-semibold text-white shadow-[var(--shadow-accent)] transition-colors hover:bg-[var(--accent-2)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowDownToLine size={15} strokeWidth={2.25} />
                Withdraw all
              </button>
              <button
                onClick={copyAddress}
                className="flex items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--color-surface)] px-4 py-3 text-[14px] font-semibold text-[var(--fg)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-2)]"
              >
                {copied ? (
                  <>
                    <Check
                      size={15}
                      strokeWidth={2.25}
                      className="text-[var(--success)]"
                    />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={15} strokeWidth={2.25} />
                    Share address
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatRow({
  label,
  value,
  suffix,
  hint,
}: {
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <div>
        <p className="text-[13px] text-[var(--fg-dim)]">{label}</p>
        {hint && (
          <p className="mt-0.5 text-[11.5px] text-[var(--fg-faint)]">{hint}</p>
        )}
      </div>
      <p className="font-mono text-[13px] font-medium tabular text-[var(--fg)]">
        {value}
        {suffix ? (
          <span className="ml-1 text-[12px] text-[var(--fg-mute)]">
            {suffix}
          </span>
        ) : null}
      </p>
    </div>
  );
}
