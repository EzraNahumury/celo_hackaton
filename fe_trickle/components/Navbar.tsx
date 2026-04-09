"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

export default function Navbar() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 lg:px-10 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            T
          </div>
          <span className="text-[15px] font-semibold text-foreground tracking-tight">
            Trickle
          </span>
        </Link>

        {/* Center nav */}
        <div className="hidden md:flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/[0.06] px-1.5 py-1">
          {[
            { label: "Employer", href: "/employer" },
            { label: "Employee", href: "/employee" },
          ].map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-full px-4 py-1.5 text-[13px] text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right */}
        {isConnected ? (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/[0.06] px-3 py-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[12px] font-mono text-muted-foreground">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
            </div>
            <button
              onClick={() => disconnect()}
              className="rounded-full bg-white/[0.06] border border-white/[0.06] px-4 py-1.5 text-[12px] text-muted-foreground hover:text-foreground hover:border-white/[0.12] transition-all"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={() => connect({ connector: injected() })}
            className="hidden sm:inline-flex rounded-full bg-primary px-5 py-2 text-[12px] font-semibold text-primary-foreground hover:brightness-110 transition-all active:scale-[0.97]"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  );
}
