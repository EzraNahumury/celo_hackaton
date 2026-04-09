"use client";

import Link from "next/link";
import { useAccount, useDisconnect } from "wagmi";
import { motion } from "framer-motion";

export default function Header() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <motion.header
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="border-b border-white/[0.04]"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#35D07F] text-[11px] font-bold text-[#050a0e]">
            T
          </div>
          <span className="text-[15px] font-semibold text-white">Trickle</span>
        </Link>

        {isConnected && (
          <nav className="flex items-center gap-1">
            <Link
              href="/employer"
              className="rounded-lg px-3 py-1.5 text-[13px] text-gray-500 transition-colors hover:text-white"
            >
              Employer
            </Link>
            <Link
              href="/employee"
              className="rounded-lg px-3 py-1.5 text-[13px] text-gray-500 transition-colors hover:text-white"
            >
              Employee
            </Link>
            <div className="ml-3 flex items-center gap-2">
              <span className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-1 text-[12px] font-mono text-gray-400">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <button
                onClick={() => disconnect()}
                className="rounded-lg p-1.5 text-gray-600 transition-colors hover:text-red-400"
                title="Disconnect"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16,17 21,12 16,7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </nav>
        )}
      </div>
    </motion.header>
  );
}
