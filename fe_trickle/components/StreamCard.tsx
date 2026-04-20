"use client";

import * as React from "react";
import { formatUnits } from "viem";
import { motion } from "framer-motion";
import { ArrowDownToLine, Clock, X, ArrowRight } from "lucide-react";
import { useChainTokenList } from "@/hooks/useChain";
import { Button } from "./ui/Button";
import { StreamTicker } from "./ui/AnimatedNumber";
import { TokenIcon } from "./ui/TokenIcon";

/** Shaped skeleton that matches StreamCard's layout exactly */
export function StreamCardSkeleton() {
  return (
    <div className="surface-elev p-5">
      {/* Head row */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="skeleton h-10 w-10 shrink-0 rounded-xl" />
          <div className="space-y-2">
            <div className="skeleton h-3 w-28 rounded-md" />
            <div className="skeleton h-2.5 w-20 rounded-md" />
          </div>
        </div>
        <div className="space-y-2 text-right">
          <div className="skeleton h-3.5 w-16 rounded-md" />
          <div className="skeleton h-2.5 w-12 rounded-md" />
        </div>
      </div>

      {/* Primary box */}
      <div className="skeleton mb-5 h-[72px] w-full rounded-2xl" />

      {/* Meta row */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="skeleton h-2.5 w-20 rounded-md" />
          <div className="skeleton h-2.5 w-14 rounded-md" />
        </div>
        <div className="skeleton h-2.5 w-16 rounded-md" />
      </div>

      {/* Button */}
      <div className="skeleton h-10 w-full rounded-full" />
    </div>
  );
}

interface StreamCardProps {
  payer: string;
  payee: string;
  token: string;
  amountPerSec: bigint;
  lastPaid: number;
  startTime: number;
  role: "payer" | "payee";
  onWithdraw?: () => void;
  onCancel?: () => void;
  isPending?: boolean;
}

const TOKEN_COLORS: Record<string, { bg: string; fg: string }> = {
  cUSD: { bg: "#1E2141", fg: "#A5B4FC" },
  USDC: { bg: "#0F2A4A", fg: "#7DD3FC" },
  USDT: { bg: "#0E2A22", fg: "#6EE7B7" },
};

function tokenInfoFrom(
  list: { address: string; symbol: string; decimals: number; icon?: string }[],
  address: string,
) {
  return (
    list.find((t) => t.address.toLowerCase() === address.toLowerCase()) ?? {
      symbol: "???",
      decimals: 18,
      icon: undefined as string | undefined,
    }
  );
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function elapsed(from: number, nowSec: number) {
  const s = Math.max(0, nowSec - from);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function StreamCard({
  payer,
  payee,
  token,
  amountPerSec,
  lastPaid,
  startTime,
  role,
  onWithdraw,
  onCancel,
  isPending,
}: StreamCardProps) {
  const [now, setNow] = React.useState(0);
  const tokenList = useChainTokenList();
  const info = tokenInfoFrom(tokenList, token);
  const color = TOKEN_COLORS[info.symbol] ?? {
    bg: "#252A3D",
    fg: "#B8BECE",
  };

  React.useEffect(() => {
    setNow(Math.floor(Date.now() / 1000));
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const accruedSince = amountPerSec * BigInt(Math.max(0, now - lastPaid));
  const accrued = parseFloat(formatUnits(accruedSince, info.decimals));
  const ratePerSec = parseFloat(formatUnits(amountPerSec, info.decimals));
  const monthly = parseFloat(
    formatUnits(amountPerSec * 2592000n, info.decimals),
  );
  const total = parseFloat(
    formatUnits(
      amountPerSec * BigInt(Math.max(0, now - startTime)),
      info.decimals,
    ),
  );

  const counterParty = role === "payer" ? payee : payer;
  const directionLabel = role === "payer" ? "Paying" : "From";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="surface-elev p-5"
    >
      {/* Head */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <TokenIcon
            symbol={info.symbol}
            icon={info.icon}
            size={40}
            rounded="xl"
            fallback={color}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--fg)]">
              <span>{info.symbol} stream</span>
            </div>
            <div className="flex items-center gap-1 text-[12px] text-[var(--fg-mute)]">
              <span>{directionLabel}</span>
              <ArrowRight size={10} className="opacity-60" />
              <span className="font-mono">{shortAddr(counterParty)}</span>
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-[14px] font-semibold text-[var(--fg)] tabular">
            {monthly.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-[var(--fg-mute)]">per month</div>
        </div>
      </div>

      {/* Primary number */}
      {role === "payee" ? (
        <div className="relative mb-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--color-bg-2)] px-4 py-3.5">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px animate-flow-stripe opacity-60"
          />
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--fg-mute)]">
            <span
              className="h-1.5 w-1.5 rounded-full bg-[var(--accent-3)] animate-pulse-dot"
              aria-hidden
            />
            Flowing in
          </div>
          <div className="font-mono text-[26px] font-bold leading-none tabular text-[var(--fg)]">
            <StreamTicker
              ratePerSec={ratePerSec}
              startValue={accrued}
              decimals={8}
            />
            <span className="ml-2 text-[13px] font-semibold text-[var(--fg-mute)]">
              {info.symbol}
            </span>
          </div>
        </div>
      ) : (
        <div className="relative mb-5 flex items-center gap-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--color-bg-2)] px-4 py-3 text-[13px] text-[var(--fg-mute)]">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px animate-flow-stripe opacity-60"
          />
          <span
            className="h-1.5 w-1.5 rounded-full bg-[var(--accent-3)] animate-pulse-dot"
            aria-hidden
          />
          Flowing out{" "}
          <span className="font-mono text-[var(--fg-dim)]">
            {ratePerSec.toFixed(8)}
          </span>{" "}
          <span className="text-[var(--fg-faint)]">{info.symbol}/sec</span>
        </div>
      )}

      {/* Meta */}
      <div className="mb-5 flex items-center justify-between text-[12.5px] text-[var(--fg-mute)]">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="font-mono text-[var(--fg-dim)]">
              {total.toFixed(4)}
            </span>
            <span className="text-[var(--fg-faint)]">streamed</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={11} className="opacity-70" />
            <span className="font-mono text-[var(--fg-dim)]">
              {now > 0 ? elapsed(startTime, now) : "…"}
            </span>
          </span>
        </div>
        <span className="text-[var(--fg-faint)]">
          since{" "}
          {new Date(startTime * 1000).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>

      {role === "payee" && onWithdraw && (
        <Button
          shape="pill"
          onClick={onWithdraw}
          disabled={isPending || accrued === 0}
          loading={isPending}
          leftIcon={!isPending ? <ArrowDownToLine size={14} /> : null}
          className="w-full"
        >
          Withdraw
        </Button>
      )}

      {role === "payer" && onCancel && (
        <Button
          variant="secondary"
          shape="pill"
          onClick={onCancel}
          disabled={isPending}
          loading={isPending}
          leftIcon={!isPending ? <X size={14} /> : null}
          className="w-full"
        >
          Cancel stream
        </Button>
      )}
    </motion.div>
  );
}
