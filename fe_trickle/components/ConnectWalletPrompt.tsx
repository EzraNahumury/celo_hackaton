"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Wallet, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { WalletModal } from "./ui/wallet-modal";

interface ConnectWalletPromptProps {
  eyebrow?: string;
  title?: string;
  body?: string;
}

export function ConnectWalletPrompt({
  eyebrow = "Wallet required",
  title = "Connect your wallet",
  body = "Link a Celo wallet to view your vault and manage salary streams.",
}: ConnectWalletPromptProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center px-2"
      >
        <div className="relative w-full overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--color-surface)] p-7 text-center shadow-[var(--shadow-md)]">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(99,102,241,0.22), transparent 70%)",
              filter: "blur(10px)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 -bottom-16 h-40 w-40 rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(79,70,229,0.16), transparent 70%)",
              filter: "blur(10px)",
            }}
          />

          <div className="relative">
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl"
              style={{
                background:
                  "linear-gradient(140deg, #818CF8 0%, #4F46E5 100%)",
                boxShadow:
                  "0 12px 28px -8px rgba(99,102,241,0.55), inset 0 1px 0 rgba(255,255,255,0.3)",
              }}
            >
              <Wallet size={22} strokeWidth={2.25} className="text-white" />
            </motion.div>

            <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-3)]">
              {eyebrow}
            </p>
            <h2 className="mt-1.5 font-display text-[20px] font-semibold tracking-tight text-[var(--fg)]">
              {title}
            </h2>
            <p className="mx-auto mt-2 max-w-[340px] text-[13.5px] leading-[1.55] text-[var(--fg-mute)]">
              {body}
            </p>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setOpen(true)}
              className="mx-auto mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[var(--accent-2)]"
              style={{ boxShadow: "var(--shadow-accent)" }}
            >
              <Wallet size={15} strokeWidth={2.25} />
              Connect wallet
              <ArrowRight size={14} strokeWidth={2.25} />
            </motion.button>

            <div className="mt-6 flex items-center justify-center gap-5 text-[11.5px] text-[var(--fg-mute)]">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-[var(--accent-3)]" />
                Non-custodial
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Zap size={12} className="text-[var(--accent-3)]" />
                Sub-cent fees
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      <WalletModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
