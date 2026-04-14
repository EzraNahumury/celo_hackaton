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

  const connected = mounted && isConnected;

  return (
    /* Outer: full-width fixed, pointer-events-none so content below is clickable */
    <div className="pointer-events-none fixed left-0 right-0 top-4 z-50 flex justify-center px-4">

      {/* Floating glass pill */}
      <div
        className="pointer-events-auto relative w-full max-w-[720px] overflow-hidden rounded-2xl"
        style={{
          background: "rgba(5, 8, 12, 0.82)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 255, 255, 0.09)",
          boxShadow:
            "0 8px 40px rgba(0,0,0,0.6), 0 2px 0 rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        {/* Top-edge highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="flex h-[52px] items-center justify-between px-4">

          {/* ── Logo ── */}
          <Link href="/" className="group flex shrink-0 items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Trickle"
              width={28}
              height={28}
              className="h-7 w-7 object-contain transition-transform duration-300 group-hover:scale-105"
              priority
            />
            <span className="text-[14px] font-semibold tracking-tight text-white/85">
              Trickle
            </span>
          </Link>

          {/* ── Center nav — only when connected ── */}
          {connected && (
            <div className="absolute left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-0.5 rounded-xl bg-white/[0.05] p-[3px]">
                {NAV_LINKS.map((link) => {
                  const active = pathname?.startsWith(link.href);
                  return (
                    <Link
                      key={link.label}
                      href={link.href}
                      className={`relative rounded-lg px-4 py-1.5 text-[12px] font-medium transition-all duration-200 ${
                        active
                          ? "bg-white/[0.1] text-white shadow-sm"
                          : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      {link.label}
                      {active && (
                        <span className="absolute bottom-[3px] left-1/2 h-[2px] w-3 -translate-x-1/2 rounded-full bg-[#35D07F]/70" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Right: wallet ── */}
          <div className="flex shrink-0 items-center gap-2">
            {connected ? (
              <>
                {/* Address pill */}
                <div className="hidden items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-1.5 sm:flex">
                  <span className="relative flex h-[7px] w-[7px] shrink-0">
                    <span className="absolute inset-0 animate-ping rounded-full bg-[#35D07F] opacity-50" />
                    <span className="relative h-[7px] w-[7px] rounded-full bg-[#35D07F]" />
                  </span>
                  <span className="font-mono text-[11px] text-white/50">
                    {address?.slice(0, 6)}…{address?.slice(-4)}
                  </span>
                </div>

                {/* Disconnect */}
                <button
                  onClick={() => disconnect()}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-1.5 text-[12px] text-white/40 transition-all hover:border-white/[0.12] hover:text-white/70"
                >
                  Disconnect
                </button>
              </>
            ) : (
              mounted && (
                <button
                  onClick={() => connect({ connector: injected() })}
                  className="rounded-xl bg-[#35D07F] px-4 py-1.5 text-[12px] font-semibold text-[#050a0e] shadow-md shadow-[#35D07F]/30 transition-all hover:bg-[#3de08d] active:scale-[0.97]"
                >
                  Connect
                </button>
              )
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
