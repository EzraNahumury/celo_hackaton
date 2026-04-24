"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Wallet, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { WalletModal } from "./ui/wallet-modal";
import { useIsMiniPay } from "@/hooks/useMiniPay";

interface ConnectWalletPromptProps {
  eyebrow?: string;
  title?: string;
  body?: string;
}

export function ConnectWalletPrompt({
  eyebrow = "Wallet required",
  title = "Connect your wallet",
  body = "Link a Celo wallet to run payroll and stream salaries second by second.",
}: ConnectWalletPromptProps) {
  const [open, setOpen] = React.useState(false);
  const isMiniPay = useIsMiniPay();

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center px-2"
      >
        <div className="relative w-full overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--color-surface)] p-7 text-center shadow-[var(--shadow-sm)]">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(99,102,241,0.08), transparent 70%)",
              filter: "blur(24px)",
            }}
          />

          <div className="relative">
            <div
              className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-[var(--border-strong)] bg-[var(--color-surface-2)]"
            >
              <Wallet size={22} strokeWidth={2.25} className="text-[var(--accent-3)]" />
            </div>

            <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-3)]">
              {eyebrow}
            </p>
            <h2 className="mt-1.5 font-display text-[20px] font-semibold tracking-tight text-[var(--fg)]">
              {title}
            </h2>
            <p className="mx-auto mt-2 max-w-[340px] text-[13.5px] leading-[1.55] text-[var(--fg-mute)]">
              {body}
            </p>

            {!isMiniPay && (
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
            )}

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
