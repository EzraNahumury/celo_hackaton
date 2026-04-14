"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import {
  ArrowRight,
  Zap,
  Clock,
  Wallet,
  TrendingUp,
  Coins,
  ShieldCheck,
} from "lucide-react";
import { Button } from "./ui/Button";
import { WalletModal } from "./ui/wallet-modal";

export default function HeroSection() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const [mounted, setMounted] = React.useState(false);
  const [walletOpen, setWalletOpen] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const showConnected = mounted && isConnected;

  return (
    <section className="relative isolate">
      <div className="relative mx-auto flex min-h-[100svh] max-w-[520px] flex-col items-center px-6 pb-10 pt-28">
        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--color-surface)]/70 px-3 py-1.5 backdrop-blur-md"
        >
          <Image
            src="/logo.png"
            alt=""
            width={14}
            height={14}
            className="h-[14px] w-[14px] object-contain"
            priority
          />
          <span className="text-[12px] font-semibold tracking-tight text-[var(--fg)]">
            Trickle
          </span>
        </motion.div>

        {/* Illustration */}
        <div className="relative mt-10 grid h-[320px] w-full place-items-center sm:h-[360px]">
          <IllustrationCoin />
        </div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 text-center font-display text-[34px] font-bold leading-[1.1] tracking-[-0.025em] text-[var(--fg)]"
        >
          Stream your salary,
          <br />
          every <span className="text-[var(--accent-3)]">second.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.18 }}
          className="mt-4 max-w-[420px] text-center text-[14.5px] leading-[1.55] text-[var(--fg-mute)]"
        >
          Employers pay by the second. Employees earn live and withdraw
          anytime — with sub-cent fees on Celo.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.24 }}
          className="mt-8 flex w-full flex-col items-center gap-3"
          suppressHydrationWarning
        >
          {showConnected ? (
            <>
              <Button
                size="lg"
                shape="pill"
                onClick={() => router.push("/employer")}
                rightIcon={<ArrowRight size={16} />}
                className="w-full"
              >
                Open dashboard
              </Button>
              <button
                onClick={() => router.push("/employee")}
                className="text-[13.5px] font-medium text-[var(--fg-mute)] transition-colors hover:text-[var(--fg)]"
              >
                View as employee
              </button>
            </>
          ) : (
            mounted && (
              <>
                <Button
                  size="lg"
                  shape="pill"
                  onClick={() => setWalletOpen(true)}
                  rightIcon={<ArrowRight size={16} />}
                  className="w-full"
                >
                  Get Started
                </Button>
                <button
                  onClick={() =>
                    document
                      .getElementById("features")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="text-[13.5px] font-medium text-[var(--fg-mute)] transition-colors hover:text-[var(--fg)]"
                >
                  Explore how it works
                </button>
              </>
            )
          )}
        </motion.div>
      </div>

      <FeaturesSection />

      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </section>
  );
}

/* ─── Illustration: central coin with orbiting chips ──────────────────── */

function IllustrationCoin() {
  return (
    <div className="relative h-full w-full">
      {/* Halo */}
      <div
        aria-hidden
        className="absolute inset-[10%] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(99,102,241,0.32), rgba(129,140,248,0.12) 45%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />

      {/* Outer static ring */}
      <div
        aria-hidden
        className="absolute inset-[14%] rounded-full border border-white/6"
      />
      <div
        aria-hidden
        className="absolute inset-[22%] rounded-full border border-white/4"
      />

      {/* Central coin */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 6, ease: [0.45, 0, 0.55, 1], repeat: Infinity }}
        className="absolute left-1/2 top-1/2 h-[55%] w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 25%, #818CF8 0%, #6366F1 48%, #4338CA 100%)",
          boxShadow:
            "0 24px 48px -18px rgba(99,102,241,0.7), inset 0 2px 0 rgba(255,255,255,0.22), inset 0 -10px 30px rgba(0,0,0,0.35)",
        }}
      >
        {/* Top shine */}
        <div
          aria-hidden
          className="absolute inset-x-[14%] top-[6%] h-[28%] rounded-[40%] opacity-60"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.55), transparent)",
            filter: "blur(1px)",
          }}
        />
        {/* Inner ring */}
        <div
          aria-hidden
          className="absolute inset-[10%] rounded-full border border-white/20"
          style={{ boxShadow: "inset 0 0 18px rgba(255,255,255,0.1)" }}
        />
        {/* Logo mark */}
        <div className="absolute inset-0 grid place-items-center">
          <div className="relative h-[46%] w-[46%]">
            <Image
              src="/logo.png"
              alt="Trickle"
              fill
              priority
              className="object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]"
            />
          </div>
        </div>
      </motion.div>

      {/* Orbit chips */}
      <OrbitChip
        icon={<Zap size={14} />}
        label="live"
        tint="#818CF8"
        bg="#1D2040"
        top="10%"
        left="14%"
        delay={0.1}
        variant="a"
      />
      <OrbitChip
        icon={<TrendingUp size={14} />}
        label="accrue"
        tint="#34D399"
        bg="#0F2A23"
        top="8%"
        right="12%"
        delay={0.4}
        variant="b"
      />
      <OrbitChip
        icon={<Clock size={14} />}
        label="per-sec"
        tint="#F59E0B"
        bg="#2A1F09"
        bottom="16%"
        left="8%"
        delay={0.25}
        variant="b"
      />
      <OrbitChip
        icon={<Wallet size={14} />}
        label="payroll"
        tint="#38BDF8"
        bg="#0E253A"
        bottom="12%"
        right="10%"
        delay={0.55}
        variant="a"
      />
    </div>
  );
}

function OrbitChip({
  icon,
  label,
  tint,
  bg,
  top,
  left,
  right,
  bottom,
  delay = 0,
  variant = "a",
}: {
  icon: React.ReactNode;
  label: string;
  tint: string;
  bg: string;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  delay?: number;
  variant?: "a" | "b";
}) {
  return (
    <div
      className={`absolute ${variant === "a" ? "animate-float-a" : "animate-float-b"}`}
      style={{
        top,
        left,
        right,
        bottom,
        animationDelay: `${delay}s`,
      }}
    >
      <div
        className="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5"
        style={{
          background: bg,
          color: tint,
          borderColor: `${tint}40`,
          boxShadow: `0 10px 24px -10px ${tint}55, inset 0 1px 0 ${tint}22`,
        }}
      >
        <span style={{ color: tint }}>{icon}</span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em]">
          {label}
        </span>
      </div>
    </div>
  );
}

/* ─── Features section (below the fold) ────────────────────────────── */

const features = [
  {
    icon: Coins,
    title: "Deposit",
    body: "Top up a stablecoin vault. cUSD, USDC, and USDT supported natively.",
  },
  {
    icon: Zap,
    title: "Stream",
    body: "Set a per-employee rate. Payments accrue every block, non-stop.",
  },
  {
    icon: ShieldCheck,
    title: "Withdraw",
    body: "Employees pull earnings anytime — no payday, no intermediaries.",
  },
];

function FeaturesSection() {
  return (
    <div
      id="features"
      className="relative mx-auto w-full max-w-[1120px] px-6 pb-24 pt-10 md:px-10"
    >
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8 text-center"
      >
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-3)]">
          How Trickle works
        </p>
        <h2 className="font-display text-[24px] font-semibold leading-[1.2] tracking-[-0.02em] text-[var(--fg)]">
          Three steps. No payday.
        </h2>
      </motion.div>

      <div className="grid gap-3 md:grid-cols-3">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 4 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{
              duration: 0.24,
              delay: 0.05 * i,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="surface-elev p-6"
          >
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--accent-3)]">
              <f.icon size={18} strokeWidth={2} />
            </div>
            <p className="font-display text-[17px] font-semibold tracking-tight text-[var(--fg)]">
              {f.title}
            </p>
            <p className="mt-1.5 text-[13.5px] leading-[1.55] text-[var(--fg-mute)]">
              {f.body}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
