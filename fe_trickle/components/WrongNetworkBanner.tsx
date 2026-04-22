"use client";

import { useChainId, useSwitchChain, useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowRightLeft } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DEFAULT_CHAIN_ID,
  SUPPORTED_CHAIN_IDS,
  chainLabelFor,
} from "@/config/chains";

/**
 * The app runs on Celo Mainnet AND Celo Sepolia — either is fine.
 * We only nag the user if they're on something else entirely (e.g. Ethereum
 * mainnet left over from another dapp) and offer a one-click switch back
 * to mainnet, which is the production target.
 */
export function WrongNetworkBanner() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const [mounted, setMounted] = useState(false);
// eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard
useEffect(() => setMounted(true), []);

  const isWrongNetwork =
    mounted && isConnected && !SUPPORTED_CHAIN_IDS.includes(chainId);

  return (
    <AnimatePresence>
      {isWrongNetwork && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-[68px] inset-x-0 z-30 flex justify-center px-4"
        >
          <div className="flex w-full max-w-[440px] items-center justify-between gap-3 rounded-2xl border border-[var(--warn)]/25 bg-[var(--color-warn-soft)] px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <AlertTriangle
                size={14}
                className="shrink-0 text-[var(--warn)]"
                strokeWidth={2.25}
              />
              <p className="text-[12.5px] font-medium text-[var(--warn)]">
                Wrong network — switch to{" "}
                <span className="font-semibold">
                  {chainLabelFor(DEFAULT_CHAIN_ID)}
                </span>
              </p>
            </div>
            <button
              onClick={() => switchChain({ chainId: DEFAULT_CHAIN_ID })}
              disabled={isPending}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--warn)] px-3 py-1 text-[11.5px] font-semibold text-black transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              <ArrowRightLeft size={11} strokeWidth={2.5} />
              {isPending ? "Switching…" : "Switch"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
