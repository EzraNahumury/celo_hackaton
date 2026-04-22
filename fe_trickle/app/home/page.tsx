"use client";

import Link from "next/link";
import { useAccount, useBlockNumber, useReadContract } from "wagmi";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useEffect, useState } from "react";
import { TRICKLE_VAULT_ABI } from "@/config/contracts";
import {
  useVaultAddress,
  useChainLabel,
  useIsTestnet,
} from "@/hooks/useChain";
import { cn } from "@/lib/cn";

export default function HomePage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
// eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard
useEffect(() => setMounted(true), []);

  const TRICKLE_VAULT_ADDRESS = useVaultAddress();
  const chainLabel = useChainLabel();
  const isTestnet = useIsTestnet();

  // Live block — the heartbeat of the app
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    query: { refetchInterval: 5_000 },
  });

  // Live counts — only if wallet connected
  const { data: payerIds } = useReadContract({
    address: TRICKLE_VAULT_ADDRESS,
    abi: TRICKLE_VAULT_ABI,
    functionName: "getPayerStreamIds",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });
  const { data: payeeIds } = useReadContract({
    address: TRICKLE_VAULT_ADDRESS,
    abi: TRICKLE_VAULT_ABI,
    functionName: "getPayeeStreamIds",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const payerCount = Array.isArray(payerIds) ? payerIds.length : 0;
  const payeeCount = Array.isArray(payeeIds) ? payeeIds.length : 0;

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[480px] px-5">
        {/* Greeting — no eyebrow, no welcome message. Just the user. */}
        <motion.header
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="pt-2"
        >
          <h1 className="font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--fg)]">
            {mounted && isConnected && address
              ? <>Welcome back.<br /><span className="text-[var(--fg-mute)]">What are you streaming today?</span></>
              : <>Payroll,<br /><span className="text-[var(--fg-mute)]">second by second.</span></>}
          </h1>
        </motion.header>

        {/* Role cards — with live stream counts when connected */}
        <div className="mt-7 grid grid-cols-1 gap-3">
          <RoleCard
            href="/employer"
            title="Run payroll"
            subtitle="Fund the flow, pay your team per second"
            meta={
              mounted && isConnected
                ? {
                    count: payerCount,
                    label: payerCount === 1 ? "active stream" : "active streams",
                    direction: "out",
                  }
                : null
            }
            delay={0.06}
          />
          <RoleCard
            href="/employee"
            title="Collect earnings"
            subtitle="Watch salary flow in, withdraw anytime"
            meta={
              mounted && isConnected
                ? {
                    count: payeeCount,
                    label: payeeCount === 1 ? "incoming" : "incoming",
                    direction: "in",
                  }
                : null
            }
            delay={0.12}
          />
        </div>

        {/* Live network strip — single row, real data, replaces the "Why Trickle" block */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8"
        >
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--color-surface)]/60 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                </span>
                <span className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-[var(--fg-mute)]">
                  {chainLabel}
                </span>
              </div>
              <span
                className="font-mono text-[12px] tabular text-[var(--fg-dim)]"
                suppressHydrationWarning
              >
                {blockNumber
                  ? `#${blockNumber.toLocaleString("en-US")}`
                  : "syncing…"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 divide-x divide-[var(--divider)]">
              <StripStat label="Block time" value="~1s" />
              <StripStat label="Gas" value="sub-cent" />
              <StripStat label="Status" value={isTestnet ? "Testnet" : "Mainnet"} />
            </div>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

function RoleCard({
  href,
  title,
  subtitle,
  meta,
  delay,
}: {
  href: string;
  title: string;
  subtitle: string;
  meta: { count: number; label: string; direction: "in" | "out" } | null;
  delay: number;
}) {
  const Arrow = meta?.direction === "out" ? ArrowUpRight : ArrowDownLeft;
  const accent =
    meta?.direction === "out"
      ? "var(--accent-3)"
      : "var(--success)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={href}
        className="group relative flex items-stretch overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--color-surface)]/75 backdrop-blur-md transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-2)]/85"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        {/* Left rail with direction indicator */}
        <span
          aria-hidden
          className="w-1 shrink-0"
          style={{ background: accent, opacity: 0.55 }}
        />

        <div className="flex flex-1 items-center gap-4 px-4 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-semibold tracking-tight text-[var(--fg)]">
                {title}
              </p>
              {meta && meta.count > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular",
                  )}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: accent,
                  }}
                >
                  <Arrow size={9} strokeWidth={2.75} />
                  {meta.count} {meta.label}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[12.5px] text-[var(--fg-mute)]">
              {subtitle}
            </p>
          </div>
          <ArrowRight
            size={16}
            strokeWidth={2.2}
            className="text-[var(--fg-faint)] transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--fg)]"
          />
        </div>
      </Link>
    </motion.div>
  );
}

function StripStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--fg-faint)]">
        {label}
      </p>
      <p className="mt-0.5 text-[12px] font-semibold text-[var(--fg-dim)]">
        {value}
      </p>
    </div>
  );
}
