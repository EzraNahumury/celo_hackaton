"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { Wallet } from "lucide-react";
import { WalletModal } from "./ui/wallet-modal";

export default function Navbar() {
  const { address, isConnected } = useAccount();
  const [walletOpen, setWalletOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard
  useEffect(() => setMounted(true), []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-4">
      <motion.nav
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-auto relative w-full max-w-[440px]"
      >
        <div
          className="relative rounded-[24px] border border-white/[0.07]"
          style={{
            background: "rgba(16, 18, 28, 0.55)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            boxShadow:
              "0 20px 40px -12px rgba(0,0,0,0.5), 0 6px 16px -8px rgba(0,0,0,0.35)",
          }}
        >
          <div className="relative flex h-[52px] items-center justify-between px-2.5">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 rounded-full px-2 py-1 transition-colors hover:bg-white/[0.06]"
            >
              <span className="grid h-7 w-7 place-items-center">
                <Image
                  src="/logo.png"
                  alt=""
                  width={22}
                  height={22}
                  className="h-[22px] w-[22px] object-contain"
                  priority
                />
              </span>
              <span className="text-[14px] font-semibold tracking-tight text-[var(--fg)]">
                Trickle
              </span>
            </Link>

            {/* Right controls */}
            <div className="flex items-center gap-1.5">
              {mounted && isConnected && address ? (
                <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-3">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[#10B981]"
                    aria-hidden
                  />
                  <span className="font-mono text-[11.5px] font-medium text-[var(--fg-dim)]">
                    {address.slice(0, 5)}…{address.slice(-4)}
                  </span>
                </span>
              ) : (
                mounted && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => setWalletOpen(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#2F3FFF] px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#1D2BE8]"
                    style={{
                      boxShadow: "0 6px 16px -4px rgba(47,63,255,0.5)",
                    }}
                  >
                    <Wallet size={13} strokeWidth={2.25} />
                    Connect
                  </motion.button>
                )
              )}
            </div>
          </div>
        </div>
      </motion.nav>

      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  );
}