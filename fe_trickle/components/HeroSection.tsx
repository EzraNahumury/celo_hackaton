"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useRouter } from "next/navigation";

const Spline = React.lazy(() => import("@splinetool/react-spline"));

function StreamingNumber() {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setVal((v) => v + 0.000385), 1000);
    return () => clearInterval(iv);
  }, []);
  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {val.toFixed(6)}
    </span>
  );
}

export default function HeroSection() {
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const router = useRouter();

  // Must be mounted before we read wagmi state — prevents SSR/client mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const showConnected = mounted && isConnected;

  return (
    <section className="relative flex min-h-screen items-end overflow-hidden bg-[#070b0e]">
      {/* Spline 3D background */}
      <div className="absolute inset-0">
        <Suspense fallback={<div className="absolute inset-0 bg-[#070b0e]" />}>
          <Spline
            scene="https://prod.spline.design/Slk6b8kz3LRlKiyk/scene.splinecode"
            className="h-full w-full"
          />
        </Suspense>
      </div>

      {/* Gradient overlay */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-[#070b0e]/90 via-[#070b0e]/30 to-transparent" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-[92%] px-6 pb-14 pt-36 md:max-w-3xl md:px-10 md:pb-20">

        {/* Badge */}
        <div
          className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-[#35D07F]/20 bg-[#35D07F]/8 px-3.5 py-1.5 opacity-0"
          style={{ animationDelay: "0.1s" }}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#35D07F]" />
          <span className="text-[11px] font-medium tracking-wide text-[#35D07F]">
            Payroll streaming on Celo
          </span>
        </div>

        {/* Heading */}
        <h1
          className="animate-fade-up mb-5 text-[clamp(2.6rem,7vw,5rem)] font-bold leading-[1.04] tracking-[-0.04em] text-white opacity-0"
          style={{ animationDelay: "0.2s" }}
        >
          Get paid every
          <br />
          <span className="text-[#35D07F]">second.</span>
        </h1>

        {/* Description */}
        <p
          className="animate-fade-up mb-8 max-w-lg text-[clamp(0.9rem,1.5vw,1.1rem)] font-light leading-relaxed text-white/50 opacity-0"
          style={{ animationDelay: "0.35s" }}
        >
          Employers stream salary in real-time. Employees withdraw anytime
          with sub-cent fees on Celo.
        </p>

        {/* Live counter */}
        <div
          className="animate-fade-up mb-8 inline-flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-5 py-3.5 opacity-0 backdrop-blur-sm"
          style={{ animationDelay: "0.45s" }}
        >
          <div>
            <p className="mb-0.5 text-[9px] uppercase tracking-widest text-white/30">
              Streaming now
            </p>
            <p className="font-mono text-lg font-semibold text-[#35D07F]">
              <StreamingNumber />
              <span className="ml-1.5 text-sm font-normal text-white/30">cUSD</span>
            </p>
          </div>
          <div className="h-8 w-px bg-white/[0.07]" />
          <div>
            <p className="mb-0.5 text-[9px] uppercase tracking-widest text-white/30">
              Rate
            </p>
            <p className="text-sm text-white/60">
              $1,000<span className="text-white/30">/mo</span>
            </p>
          </div>
        </div>

        {/* CTA Buttons — wrapped to prevent hydration mismatch */}
        <div
          className="animate-fade-up flex flex-wrap items-center gap-3 opacity-0"
          style={{ animationDelay: "0.6s" }}
          suppressHydrationWarning
        >
          {showConnected ? (
            <>
              <button
                onClick={() => router.push("/employer")}
                className="pointer-events-auto rounded-xl bg-[#35D07F] px-7 py-3 text-sm font-semibold text-[#050a0e] shadow-lg shadow-[#35D07F]/25 transition-all hover:bg-[#3de08d] hover:shadow-[#35D07F]/35 active:scale-[0.97]"
              >
                Employer Dashboard
              </button>
              <button
                onClick={() => router.push("/employee")}
                className="pointer-events-auto rounded-xl border border-white/[0.1] bg-white/[0.06] px-7 py-3 text-sm font-medium text-white/80 transition-all hover:bg-white/[0.1] active:scale-[0.97]"
              >
                Employee Dashboard
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => connect({ connector: injected() })}
                className="pointer-events-auto rounded-xl bg-[#35D07F] px-7 py-3 text-sm font-semibold text-[#050a0e] shadow-lg shadow-[#35D07F]/25 transition-all hover:bg-[#3de08d] active:scale-[0.97]"
              >
                Connect Wallet
              </button>
              <button
                onClick={() =>
                  document
                    .getElementById("how-it-works")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="pointer-events-auto rounded-xl border border-white/[0.1] bg-white/[0.06] px-7 py-3 text-sm font-medium text-white/70 transition-all hover:bg-white/[0.1] active:scale-[0.97]"
              >
                How It Works
              </button>
            </>
          )}
        </div>

        {/* Token badges */}
        <div
          className="animate-fade-up mt-8 flex flex-wrap items-center gap-2 opacity-0"
          style={{ animationDelay: "0.75s" }}
        >
          {["cUSD", "USDC", "USDT"].map((token) => (
            <span
              key={token}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[11px] text-white/35"
            >
              <span className="h-1 w-1 rounded-full bg-[#35D07F]/50" />
              {token}
            </span>
          ))}
          <span className="ml-1 text-[11px] text-white/20">
            Sub-cent fees on Celo
          </span>
        </div>
      </div>
    </section>
  );
}
