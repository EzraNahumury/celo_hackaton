"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Wallet,
  Download,
  Timer,
  ChartLine,
  KeyRound,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useEffect, useState } from "react";

export default function HomePage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
            {mounted && isConnected && address
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
            <Highlight icon={<Timer size={14} strokeWidth={2.1} />} label="Per-second" kind="pulse" delay={0} />
            <Highlight icon={<ChartLine size={14} strokeWidth={2.1} />} label="Live accrual" kind="wave" delay={0.15} />
            <Highlight icon={<KeyRound size={14} strokeWidth={2.1} />} label="Non-custodial" kind="breathe" delay={0.3} />
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

type IconLoop = {
  animate: Record<string, number[]>;
  transition: { duration: number; repeat: number; ease: [number, number, number, number] };
};

const ICON_LOOPS: Record<"pulse" | "wave" | "breathe", IconLoop> = {
  pulse: {
    animate: { scale: [1, 1.14, 1] },
    transition: { duration: 1.7, repeat: Infinity, ease: [0.45, 0, 0.55, 1] },
  },
  wave: {
    animate: { rotate: [-6, 6, -6], y: [0, -1.5, 0] },
    transition: { duration: 2.2, repeat: Infinity, ease: [0.45, 0, 0.55, 1] },
  },
  breathe: {
    animate: { scale: [1, 1.08, 1], opacity: [0.9, 1, 0.9] },
    transition: { duration: 2.8, repeat: Infinity, ease: [0.45, 0, 0.55, 1] },
  },
};

function Highlight({
  icon,
  label,
  kind,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  kind: keyof typeof ICON_LOOPS;
  delay: number;
}) {
  const loop = ICON_LOOPS[kind];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.18 + delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className="group relative flex flex-col items-start gap-2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--color-surface)]/60 px-3 py-3 backdrop-blur-md transition-colors duration-200 hover:border-[var(--border-strong)]"
    >
      {/* Ambient glow yang nyala pas hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(140% 80% at 0% 0%, rgba(99,102,241,0.16), transparent 55%)",
        }}
      />

      {/* Soft pulse ring dibalik icon — subtle tapi hidup */}
      <span className="relative grid h-7 w-7 shrink-0 place-items-center">
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-lg bg-[var(--color-accent-soft)]"
          animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.12, 1] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: [0.45, 0, 0.55, 1],
            delay,
          }}
        />
        <motion.span
          className="relative grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--accent-3)]"
          animate={loop.animate}
          transition={{ ...loop.transition, delay }}
        >
          {icon}
        </motion.span>
      </span>

      <span className="relative text-[12px] font-medium leading-tight text-[var(--fg-dim)] transition-colors duration-200 group-hover:text-[var(--fg)]">
        {label}
      </span>
    </motion.div>
  );
}
