"use client";

import Navbar from "./Navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-[#070b0e]">
      {/* Ambient top glow — gives depth without distraction */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[55vh] overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2 h-[420px] w-[70vw] max-w-3xl rounded-full opacity-100"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(53,208,127,0.055) 0%, transparent 70%)",
            filter: "blur(48px)",
          }}
        />
      </div>

      <Navbar />

      <div className="relative pt-[60px]">{children}</div>
    </div>
  );
}
