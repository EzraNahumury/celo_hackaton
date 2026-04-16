"use client";

import * as React from "react";
import Navbar from "./Navbar";
import { BottomNav } from "./BottomNav";
import { ProfileSheet } from "./ProfileSheet";
import { WalletModal } from "./ui/wallet-modal";
import { WrongNetworkBanner } from "./WrongNetworkBanner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [walletOpen, setWalletOpen] = React.useState(false);

  return (
    <div className="relative min-h-[100dvh]">
      <Navbar />
      <WrongNetworkBanner />

      {/* Content area — phone-feel width on larger screens, edge-to-edge on mobile */}
      <div className="relative pt-[80px] pb-[108px]">{children}</div>

      <BottomNav onProfile={() => setProfileOpen(true)} />

      <ProfileSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onConnect={() => setWalletOpen(true)}
      />
      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  );
}
