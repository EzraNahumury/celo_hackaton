"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Wallet,
  Download,
  Activity,
  Zap,
  ShieldCheck,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function HomePage() {
  const { address, isConnected } = useAccount();

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[480px] px-5">
        {/* Greeting */}
        <motion.header
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="pt-2"
        >
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--fg-faint)]">
            Welcome to Trickle
          </p>
          <h1 className="mt-2 font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--fg)]">
            Stream your salary,
            <br />
            second by second.
          </h1>
          <p className="mt-3 text-[14px] leading-[1.55] text-[var(--fg-mute)]">
            {isConnected && address
              ? `Signed in as ${address.slice(0, 6)}…${address.slice(-4)}. Pick a role to get going.`
              : "Connect a wallet to manage streams or earnings."}
          </p>
        </motion.header>

        {/* Role cards */}
        <div className="mt-7 grid grid-cols-1 gap-3">
          <RoleCard
            href="/employer"
            icon={<Wallet size={18} strokeWidth={2.1} />}
            title="Open Vault"
            subtitle="Deposit, manage streams, pay your team"
            accent="var(--accent)"
            delay={0.06}
          />
          <RoleCard
            href="/employee"
            icon={<Download size={18} strokeWidth={2.1} />}
            title="Your Earnings"
            subtitle="Watch salary accrue live, withdraw anytime"
            accent="var(--accent-3)"
            delay={0.12}
          />
        </div>

        {/* Quick stats / highlights */}
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.3,
            delay: 0.18,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="mt-8"
        >
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fg-faint)]">
            Why Trickle
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Highlight icon={<Zap size={14} />} label="Per-second" />
            <Highlight icon={<Activity size={14} />} label="Live accrual" />
            <Highlight icon={<ShieldCheck size={14} />} label="Non-custodial" />
          </div>
        </motion.section>
      </div>
    </DashboardLayout>
  );
}

function RoleCard({
  href,
  icon,
  title,
  subtitle,
  accent,
  delay,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={href}
        className="group relative flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--color-surface)]/75 p-4 backdrop-blur-md transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-2)]/85"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
          style={{
            background: "var(--color-accent-soft)",
            color: accent,
          }}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tracking-tight text-[var(--fg)]">
            {title}
          </p>
          <p className="mt-0.5 truncate text-[12.5px] text-[var(--fg-mute)]">
            {subtitle}
          </p>
        </div>
        <ArrowRight
          size={16}
          strokeWidth={2.2}
          className="text-[var(--fg-faint)] transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--fg)]"
        />
      </Link>
    </motion.div>
  );
}

function Highlight({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--color-surface)]/60 px-3 py-3 backdrop-blur-md">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--accent-3)]">
        {icon}
      </span>
      <span className="text-[12px] font-medium leading-tight text-[var(--fg-dim)]">
        {label}
      </span>
    </div>
  );
}
