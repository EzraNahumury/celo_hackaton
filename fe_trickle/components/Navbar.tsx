"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { Wallet, Bell } from "lucide-react";
import { WalletModal } from "./ui/wallet-modal";

export default function Navbar() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
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
          className="relative rounded-[24px] border border-black/5"
          style={{
            background: "rgba(255, 255, 255, 0.96)",
            backdropFilter: "blur(22px) saturate(160%)",
            WebkitBackdropFilter: "blur(22px) saturate(160%)",
            boxShadow:
              "0 20px 36px -12px rgba(0,0,0,0.4), 0 6px 14px -8px rgba(0,0,0,0.25)",
          }}
        >
          <div className="relative flex h-[52px] items-center justify-between px-2.5">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-full px-2 py-1 transition-colors hover:bg-slate-100/80"
            >
              <span
                className="grid h-7 w-7 place-items-center overflow-hidden rounded-xl"
                style={{
                  background:
                    "linear-gradient(140deg, #E0E7FF 0%, #C7D2FE 100%)",
                }}
              >
                <Image
                  src="/logo.png"
                  alt=""
                  width={16}
                  height={16}
                  className="h-4 w-4 object-contain"
                  priority
                />
              </span>
              <span className="text-[14px] font-semibold tracking-tight text-slate-900">
                Trickle
              </span>
            </Link>

            <div className="flex items-center gap-1.5">
              {mounted && isConnected && address ? (
                <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[#10B981]"
                    aria-hidden
                  />
                  <span className="font-mono text-[11.5px] font-medium text-slate-600">
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
              <button
                aria-label="Notifications"
                className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
              >
                <Bell size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  );
}
