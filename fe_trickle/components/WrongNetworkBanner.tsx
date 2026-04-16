"use client";

import { useChainId, useSwitchChain, useAccount } from "wagmi";
import { celoSepolia } from "@/config/wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowRightLeft } from "lucide-react";
import { useEffect, useState } from "react";

export function WrongNetworkBanner() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isWrongNetwork = mounted && isConnected && chainId !== celoSepolia.id;

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
                Jaringan salah — butuh{" "}
                <span className="font-semibold">Celo Sepolia</span>
              </p>
            </div>
            <button
              onClick={() => switchChain({ chainId: celoSepolia.id })}
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
