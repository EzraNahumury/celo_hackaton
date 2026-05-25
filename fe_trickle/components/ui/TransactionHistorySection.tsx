"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Play,
  X,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { useAccount, useBlockNumber } from "wagmi";
import { formatUnits } from "viem";
import { useChainTokenList, useExplorerUrl } from "@/hooks/useChain";
import {
  useTransactionHistory,
  blocksAgo,
  type TxEvent,
  type TxEventKind,
} from "@/hooks/useTransactionHistory";
import { cn } from "@/lib/cn";
import type { TokenInfo } from "@/config/tokens";

interface TransactionHistorySectionProps {
  role: "payer" | "payee";
}

type KindMeta = {
  Icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: (role: "payer" | "payee") => string;
};

const KIND_META: Record<TxEventKind, KindMeta> = {
  deposit: {
    Icon: ArrowDownToLine,
    iconBg: "bg-[var(--color-success-soft)]",
    iconColor: "text-[var(--success)]",
    label: () => "Deposited",
  },
  "balance-withdrawn": {
    Icon: ArrowUpFromLine,
    iconBg: "bg-[var(--color-surface-3)]",
    iconColor: "text-[var(--fg-mute)]",
    label: () => "Withdrew balance",
  },
  "stream-created": {
    Icon: Play,
    iconBg: "bg-[var(--color-accent-soft)]",
    iconColor: "text-[var(--accent-3)]",
    label: (role) => (role === "payer" ? "Stream started" : "Stream received"),
  },
  "stream-cancelled": {
    Icon: X,
    iconBg: "bg-[var(--danger)]/10",
    iconColor: "text-[var(--danger)]",
    label: (role) => (role === "payer" ? "Stream cancelled" : "Stream ended"),
  },
  withdrawn: {
    Icon: ArrowDownToLine,
    iconBg: "bg-[var(--color-success-soft)]",
    iconColor: "text-[var(--success)]",
    label: () => "Claimed",
  },
};

function tokenMeta(
  list: TokenInfo[],
  address: `0x${string}`
): { symbol: string; decimals: number } {
  return (
    list.find((t) => t.address.toLowerCase() === address.toLowerCase()) ?? {
      symbol: "?",
      decimals: 18,
    }
  );
}

function SkeletonRow() {
  return <div className="skeleton h-11 w-full rounded-xl" />;
}

function TxRow({
  event,
  role,
  currentBlock,
  tokenList,
  explorerUrl,
}: {
  event: TxEvent;
  role: "payer" | "payee";
  currentBlock: bigint;
  tokenList: TokenInfo[];
  explorerUrl: string;
}) {
  const meta = KIND_META[event.kind];
  const { symbol, decimals } = tokenMeta(tokenList, event.tokenAddress);
  const timeStr = blocksAgo(
    currentBlock >= event.blockNumber ? currentBlock - event.blockNumber : 0n
  );

  // Narrow via discriminated union: only deposit / balance-withdrawn /
  // withdrawn carry an amount. Only stream-* and withdrawn carry a counterparty.
  const amount = "amount" in event ? event.amount : undefined;
  const counterparty =
    "counterparty" in event ? event.counterparty : undefined;

  let amountStr: string | null = null;
  if (amount != null) {
    const num = parseFloat(formatUnits(amount, decimals));
    const prefix =
      event.kind === "deposit" || event.kind === "withdrawn" ? "+" : "";
    const sym = symbol !== "?" ? ` ${symbol}` : "";
    // Adaptive precision: show enough digits so small amounts aren't "0.00"
    const dp = num === 0 ? 2 : num < 0.001 ? 6 : num < 0.01 ? 4 : num < 1 ? 3 : 2;
    amountStr = `${prefix}${num.toFixed(dp)}${sym}`;
  }

  const counterpartyShort = counterparty
    ? `${counterparty.slice(0, 6)}…${counterparty.slice(-4)}`
    : null;

  const txUrl = `${explorerUrl}/tx/${event.txHash}`;

  return (
    <a
      href={txUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--color-surface-2)]"
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          meta.iconBg
        )}
      >
        <meta.Icon size={13} strokeWidth={2.25} className={meta.iconColor} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[var(--fg)]">
          {meta.label(role)}
        </p>
        <p className="text-[11.5px] text-[var(--fg-faint)]">{timeStr}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1 text-right">
        {amountStr ? (
          <span
            className={cn(
              "font-mono text-[12.5px] font-medium tabular",
              event.kind === "deposit" || event.kind === "withdrawn"
                ? "text-[var(--success)]"
                : "text-[var(--fg-dim)]"
            )}
          >
            {amountStr}
          </span>
        ) : counterpartyShort ? (
          <span className="font-mono text-[11.5px] text-[var(--fg-faint)]">
            {counterpartyShort}
          </span>
        ) : null}
        <ExternalLink
          size={10}
          strokeWidth={2}
          className="text-[var(--fg-faint)] opacity-0 transition-opacity group-hover:opacity-60"
        />
      </div>
    </a>
  );
}

const PAGE_SIZE = 5;

export function TransactionHistorySection({
  role,
}: TransactionHistorySectionProps) {
  const { address } = useAccount();
  const { data: blockNumber } = useBlockNumber();
  const tokenList = useChainTokenList();
  const explorerUrl = useExplorerUrl();
  const { events, isLoading, isError, refetch } = useTransactionHistory(address, role);
  const [showAll, setShowAll] = useState(false);

  if (!address) return null;

  const visible = showAll ? events : events.slice(0, PAGE_SIZE);

  return (
    <div>
      <div className="mb-3">
        <h2 className="font-display text-[16px] font-semibold tracking-tight text-[var(--fg)]">
          Recent activity
        </h2>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--color-surface-2)] px-4 py-5 text-center"
        >
          <AlertTriangle
            size={16}
            strokeWidth={2}
            className="text-[var(--danger)]"
          />
          <p className="text-[12.5px] text-[var(--fg-dim)]">
            Couldn&apos;t load recent activity. RPC may be unavailable.
          </p>
          <button
            type="button"
            onClick={refetch}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--color-surface)] px-3 py-1 text-[11.5px] font-medium text-[var(--fg)] transition-colors hover:bg-[var(--color-surface-3)]"
          >
            <RefreshCw size={11} strokeWidth={2.25} />
            Retry
          </button>
        </div>
      ) : events.length === 0 ? (
        <p className="py-4 text-center text-[12.5px] text-[var(--fg-faint)]">
          No recent activity.
        </p>
      ) : (
        <>
          <div className="-mx-3 flex flex-col">
            {visible.map((event, i) => (
              <TxRow
                key={`${event.txHash}-${i}`}
                event={event}
                role={role}
                currentBlock={blockNumber ?? event.blockNumber}
                tokenList={tokenList}
                explorerUrl={explorerUrl}
              />
            ))}
          </div>
          {events.length > PAGE_SIZE && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
              aria-label={
                showAll
                  ? `Hide ${events.length - PAGE_SIZE} additional transactions`
                  : `Show ${events.length - PAGE_SIZE} more transactions`
              }
              className="mt-2 w-full rounded-xl py-2 text-[12.5px] font-medium text-[var(--fg-mute)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-3)]"
            >
              {showAll
                ? "Show less"
                : `Show ${events.length - PAGE_SIZE} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
