"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAccount, useBlockNumber } from "wagmi";
import { ArrowRight } from "lucide-react";
import { WalletModal } from "./ui/wallet-modal";
import { useChainLabel } from "@/hooks/useChain";
import { useIsMiniPay } from "@/hooks/useMiniPay";

export default function HeroSection() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const [mounted, setMounted] = React.useState(false);
  const [walletOpen, setWalletOpen] = React.useState(false);
  const isMiniPay = useIsMiniPay();
  // null = haven't observed a value yet; first run records it without redirecting.
  const prevConnectedRef = React.useRef<boolean | null>(null);
  React.useEffect(() => setMounted(true), []);

  const showConnected = mounted && isConnected;

  React.useEffect(() => {
    if (!mounted) return;
    const prev = prevConnectedRef.current;
    prevConnectedRef.current = isConnected;
    // Skip the initial observation — returning visitors with an already-
    // connected wallet should still see the landing page.
    if (prev === null) return;
    // Only auto-navigate on the false → true transition (user just connected).
    if (!prev && isConnected) {
      setWalletOpen(false);
      router.replace("/home");
    }
  }, [mounted, isConnected, router]);

  return (
    <section className="relative isolate">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-[460px] flex-col px-6 pt-[max(56px,env(safe-area-inset-top))] pb-[max(28px,env(safe-area-inset-bottom))]">
        {/* ── Top: Headline ─────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <h1 className="font-display text-[34px] font-semibold leading-[1.08] tracking-[-0.028em] text-white">
            Stream your salary,
            <br />
            live on Celo.
          </h1>
        </motion.header>

        {/* ── Middle: Illustration + version pill ──────────── */}
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="relative grid h-[320px] w-full place-items-center sm:h-[360px]"
          >
            <IllustrationRobot />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <VersionPill />
          </motion.div>
        </div>

        {/* ── Bottom: Greeting + CTA ───────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-5"
          suppressHydrationWarning
        >
          <p className="text-center text-[14px] leading-[1.5] text-white/55">
            {showConnected
              ? "Wallet connected. Open your dashboard."
              : "Payroll that flows per second. Ready when you are."}
          </p>

          {showConnected ? (
            <CTAButton
              onClick={() => router.push("/home")}
              label="Open dashboard"
            />
          ) : (
            mounted && !isMiniPay && (
              <CTAButton
                onClick={() => setWalletOpen(true)}
                label="Let's get started"
              />
            )
          )}
        </motion.div>
      </div>

      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </section>
  );
}

/* ─── Central robot illustration ────────────────────────── */
function IllustrationRobot() {
  return (
    <div className="relative h-full w-full">
      {/* Soft ambient halo beneath the robot */}
      <div
        aria-hidden
        className="absolute left-1/2 top-[58%] h-[46%] w-[72%] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(129,140,248,0.11), transparent 65%)",
          filter: "blur(34px)",
        }}
      />

      {/* Floor shadow under the robot */}
      <div
        aria-hidden
        className="absolute bottom-[4%] left-1/2 h-[10%] w-[56%] -translate-x-1/2 rounded-[50%]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.55), transparent 70%)",
          filter: "blur(10px)",
        }}
      />

      {/* Robot character */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5.5, ease: [0.45, 0, 0.55, 1], repeat: Infinity }}
        className="relative h-full w-full"
      >
        <Image
          src="/robot.png"
          alt="Trickle assistant"
          fill
          priority
          sizes="(max-width: 640px) 100vw, 460px"
          className="object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.55)]"
        />
      </motion.div>
    </div>
  );
}

/* ─── Live chain-status pill — real block number, heartbeats green ─────── */
function VersionPill() {
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    query: { refetchInterval: 5_000 },
  });
  const chainLabel = useChainLabel();
  const label = blockNumber
    ? `Block ${blockNumber.toLocaleString("en-US")}`
    : "Connecting to Celo…";
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 backdrop-blur-md"
      suppressHydrationWarning
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#10B981]" />
      </span>
      <span className="font-mono text-[11px] font-medium tracking-[0.02em] text-white/75 tabular">
        {label}
      </span>
      <span className="h-3 w-px bg-white/10" />
      <span className="text-[11px] font-medium tracking-tight text-white/55">
        {chainLabel}
      </span>
    </div>
  );
}

/* ─── Full-width white pill CTA ─────────────────────────── */
function CTAButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className="group relative flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold tracking-tight text-black"
      style={{
        boxShadow:
          "0 10px 30px -10px rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.08)",
      }}
    >
      <span>{label}</span>
      <ArrowRight
        size={16}
        strokeWidth={2.5}
        className="transition-transform duration-200 group-hover:translate-x-0.5"
      />
    </motion.button>
  );
}
