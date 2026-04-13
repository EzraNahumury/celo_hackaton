"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Employer", href: "/employer" },
  { label: "Employee", href: "/employee" },
];

export default function Navbar() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 isolate">
      {/* Layered glass background */}
      <div className="absolute inset-0 bg-[#060a0d]/80 backdrop-blur-2xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.025] to-transparent pointer-events-none" />

      {/* Top sheen */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/[0.14] to-transparent" />
      {/* Bottom border */}
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />

      {/* Content */}
      <div className="relative mx-auto flex max-w-6xl items-center justify-between px-5 lg:px-10 h-[60px]">

        {/* ── Logo ── */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <Image
            src="/logo.png"
            alt="Trickle"
            width={30}
            height={30}
            className="h-[30px] w-[30px] object-contain transition-transform duration-300 group-hover:scale-105"
            priority
          />
          <span className="text-[15px] font-semibold text-white/90 tracking-tight">
            Trickle
          </span>
        </Link>

        {/* ── Center nav ── */}
        <div className="hidden md:flex items-center rounded-full border border-white/[0.07] bg-white/[0.04] p-[3px] gap-[2px] shadow-inner shadow-black/30">
          {NAV_LINKS.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`relative rounded-full px-5 py-[6px] text-[13px] font-medium transition-all duration-200 ${
                  active
                    ? "bg-white/[0.1] text-white shadow-sm border border-white/[0.09]"
                    : "text-white/45 hover:text-white/75 hover:bg-white/[0.05]"
                }`}
              >
                {link.label}
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-4 rounded-full bg-[#35D07F]/60" />
                )}
              </Link>
            );
          })}
        </div>

        {/* ── Right: wallet ── */}
        {mounted && isConnected ? (
          <div className="flex items-center gap-2">
            {/* Address pill */}
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-white/[0.05] border border-white/[0.07] px-3 py-[6px] shadow-inner shadow-black/20">
              <span className="relative flex h-[7px] w-[7px] shrink-0">
                <span className="absolute inset-0 rounded-full bg-[#35D07F] animate-ping opacity-50" />
                <span className="relative h-[7px] w-[7px] rounded-full bg-[#35D07F]" />
              </span>
              <span className="text-[12px] font-mono text-white/55 tracking-tight">
                {address?.slice(0, 6)}…{address?.slice(-4)}
              </span>
            </div>

            {/* Disconnect */}
            <button
              onClick={() => disconnect()}
              className="rounded-full bg-white/[0.04] border border-white/[0.07] px-4 py-[6px] text-[12px] text-white/45 hover:text-white/75 hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-200"
            >
              Disconnect
            </button>
          </div>
        ) : mounted ? (
          <button
            onClick={() => connect({ connector: injected() })}
            className="hidden sm:inline-flex items-center rounded-full bg-[#35D07F] px-5 py-2 text-[12px] font-semibold text-[#050a0e] hover:bg-[#3de08d] transition-all duration-200 shadow-lg shadow-[#35D07F]/20 active:scale-[0.97]"
          >
            Connect Wallet
          </button>
        ) : null}

        {/* ── Mobile menu hint ── */}
        {mounted && !isConnected && (
          <button
            onClick={() => connect({ connector: injected() })}
            className="sm:hidden rounded-full bg-[#35D07F] px-4 py-1.5 text-[12px] font-semibold text-[#050a0e]"
          >
            Connect
          </button>
        )}
      </div>
    </nav>
  );
}
