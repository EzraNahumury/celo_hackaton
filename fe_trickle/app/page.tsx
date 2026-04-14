"use client";

import * as React from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import { BottomNav } from "@/components/BottomNav";
import { ProfileSheet } from "@/components/ProfileSheet";
import { WalletModal } from "@/components/ui/wallet-modal";

export default function Home() {
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [walletOpen, setWalletOpen] = React.useState(false);

  return (
    <div className="relative min-h-[100dvh] text-[var(--fg)]">
      <Navbar />
      <div className="pb-[108px]">
        <HeroSection />
      </div>
      <BottomNav onProfile={() => setProfileOpen(true)} />
      <ProfileSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onConnect={() => setWalletOpen(true)}
      />
      <WalletModal
        open={walletOpen}
        onClose={() => setWalletOpen(false)}
      />
    </div>
  );
}
