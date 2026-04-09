"use client";

import Navbar from "./Navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-hero-bg min-h-screen">
      <Navbar />
      <div className="pt-20">{children}</div>
    </div>
  );
}
