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
  return <span className="tabular-nums">{val.toFixed(6)}</span>;
}

export default function HeroSection() {
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const router = useRouter();

  return (
    <section className="relative min-h-screen flex items-end bg-hero-bg overflow-hidden">
      {/* Spline 3D */}
      <div className="absolute inset-0">
        <Suspense fallback={<div className="absolute inset-0 bg-hero-bg" />}>
          <Spline
            scene="https://prod.spline.design/Slk6b8kz3LRlKiyk/scene.splinecode"
            className="w-full h-full"
          />
        </Suspense>
      </div>

      {/* Overlay gradient - heavier at bottom for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10 z-[1] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 pointer-events-none w-full max-w-[92%] lg:max-w-3xl px-6 md:px-10 pb-12 md:pb-16 pt-32">
        {/* Badge */}
        <div
          className="opacity-0 animate-fade-up inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3.5 py-1.5 mb-6"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] font-medium text-primary tracking-wide">
            Payroll streaming on Celo
          </span>
        </div>

        {/* Heading */}
        <h1
          className="opacity-0 animate-fade-up text-[clamp(2.5rem,7vw,5rem)] font-bold leading-[1.05] tracking-[-0.04em] text-foreground mb-4 md:mb-5"
          style={{ animationDelay: "0.2s" }}
        >
          Get paid every
          <br />
          <span className="text-primary">second.</span>
        </h1>

        {/* Description */}
        <p
          className="opacity-0 animate-fade-up text-muted-foreground text-[clamp(0.9rem,1.5vw,1.15rem)] font-light leading-relaxed mb-6 md:mb-8 max-w-lg"
          style={{ animationDelay: "0.4s" }}
        >
          Employers stream salary in real-time. Employees withdraw
          anytime with sub-cent fees. Powered by Celo stablecoins.
        </p>

        {/* Live counter */}
        <div
          className="opacity-0 animate-fade-up inline-flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.08] px-5 py-3 mb-8"
          style={{ animationDelay: "0.5s" }}
        >
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-0.5">
              Streaming now
            </span>
            <span className="text-xl font-semibold text-primary font-mono">
              <StreamingNumber />
              <span className="text-sm text-muted-foreground ml-1.5">cUSD</span>
            </span>
          </div>
          <div className="h-8 w-px bg-white/[0.08]" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-0.5">
              Rate
            </span>
            <span className="text-sm text-foreground/70">
              $1,000<span className="text-muted-foreground">/mo</span>
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div
          className="opacity-0 animate-fade-up flex flex-wrap items-center gap-3"
          style={{ animationDelay: "0.65s" }}
        >
          {isConnected ? (
            <>
              <button
                onClick={() => router.push("/employer")}
                className="pointer-events-auto bg-primary text-primary-foreground px-6 py-3 md:px-7 md:py-3.5 text-sm font-semibold rounded-lg hover:brightness-110 transition-all active:scale-[0.97]"
              >
                Employer Dashboard
              </button>
              <button
                onClick={() => router.push("/employee")}
                className="pointer-events-auto bg-white/[0.08] border border-white/[0.1] text-foreground px-6 py-3 md:px-7 md:py-3.5 text-sm font-medium rounded-lg hover:bg-white/[0.12] transition-all active:scale-[0.97]"
              >
                Employee Dashboard
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => connect({ connector: injected() })}
                className="pointer-events-auto bg-primary text-primary-foreground px-6 py-3 md:px-7 md:py-3.5 text-sm font-semibold rounded-lg hover:brightness-110 transition-all active:scale-[0.97]"
              >
                Connect Wallet
              </button>
              <button
                onClick={() =>
                  document
                    .getElementById("how-it-works")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="pointer-events-auto bg-white/[0.08] border border-white/[0.1] text-foreground px-6 py-3 md:px-7 md:py-3.5 text-sm font-medium rounded-lg hover:bg-white/[0.12] transition-all active:scale-[0.97]"
              >
                How It Works
              </button>
            </>
          )}
        </div>

        {/* Token badges */}
        <div
          className="opacity-0 animate-fade-up flex flex-wrap items-center gap-2 mt-8"
          style={{ animationDelay: "0.8s" }}
        >
          {["cUSD", "USDC", "USDT"].map((token) => (
            <span
              key={token}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] px-3 py-1 text-[11px] text-muted-foreground/70"
            >
              <span className="h-1 w-1 rounded-full bg-primary/60" />
              {token}
            </span>
          ))}
          <span className="text-[11px] text-muted-foreground/40 ml-1">
            Sub-cent fees on Celo
          </span>
        </div>
      </div>
    </section>
  );
}
