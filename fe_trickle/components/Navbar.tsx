"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Droplets, Check, Loader } from "lucide-react";
import { WalletModal } from "./ui/wallet-modal";
import { useToast } from "./Toast";
import { TOKENS } from "@/config/tokens";

const MINT_ABI = [
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// Mint 1,000 tUSDC (6 desimal)
const FAUCET_AMOUNT = 1_000n * 10n ** 6n;

// Hanya tampil kalau address mock token sudah di-deploy (bukan zero address)
const MOCK_TOKEN_ADDRESS = TOKENS.tUSDC?.address;
const IS_MOCK_DEPLOYED =
  MOCK_TOKEN_ADDRESS &&
  MOCK_TOKEN_ADDRESS !== "0x0000000000000000000000000000000000000000";

export default function Navbar() {
  const { address, isConnected } = useAccount();
  const { toast, update } = useToast();
  const [mounted, setMounted] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [claimed, setClaimed] = useState(false);
  // Simpan ID toast pending agar bisa di-update (bukan buat toast baru)
  const pendingToastId = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const { writeContract: doMint, data: mintTxHash, isPending: isMinting } =
    useWriteContract();

  const { isSuccess: mintSuccess, isError: mintFailed } =
    useWaitForTransactionReceipt({
      hash: mintTxHash,
      pollingInterval: 2_000, // cek setiap 2 detik, lebih responsif
    });

  useEffect(() => {
    if (mintSuccess) {
      // Update toast pending yang sama → otomatis ganti jadi success + auto-dismiss
      if (pendingToastId[0]) {
        update(pendingToastId[0], {
          type: "success",
          message: "Faucet claimed!",
          description: "1,000 tUSDC ditambahkan ke wallet kamu",
          txHash: mintTxHash,
        });
        pendingToastId[1](null);
      }
      setClaimed(true);
      setTimeout(() => setClaimed(false), 3000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mintSuccess]);

  useEffect(() => {
    if (mintFailed) {
      if (pendingToastId[0]) {
        update(pendingToastId[0], {
          type: "error",
          message: "Faucet gagal",
          description: "Coba lagi",
        });
        pendingToastId[1](null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mintFailed]);

  function handleFaucet() {
    if (!address || !IS_MOCK_DEPLOYED) return;
    doMint({
      address: MOCK_TOKEN_ADDRESS as `0x${string}`,
      abi: MINT_ABI,
      functionName: "mint",
      args: [address, FAUCET_AMOUNT],
    });
    // Simpan ID toast agar bisa di-update nanti
    const id = toast({ type: "pending", message: "Minting 1,000 tUSDC…" });
    pendingToastId[1](id);
  }

  const showFaucet = mounted && isConnected && IS_MOCK_DEPLOYED;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-4">
      <motion.nav
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-auto relative w-full max-w-[440px]"
      >
        <div
          className="relative rounded-[24px] border border-white/[0.07]"
          style={{
            background: "rgba(16, 18, 28, 0.55)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            boxShadow:
              "0 20px 40px -12px rgba(0,0,0,0.5), 0 6px 16px -8px rgba(0,0,0,0.35)",
          }}
        >
          <div className="relative flex h-[52px] items-center justify-between px-2.5">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 rounded-full px-2 py-1 transition-colors hover:bg-white/[0.06]"
            >
              <span className="grid h-7 w-7 place-items-center">
                <Image
                  src="/logo.png"
                  alt=""
                  width={22}
                  height={22}
                  className="h-[22px] w-[22px] object-contain"
                  priority
                />
              </span>
              <span className="text-[14px] font-semibold tracking-tight text-[var(--fg)]">
                Trickle
              </span>
            </Link>

            {/* Right controls */}
            <div className="flex items-center gap-1.5">
              {mounted && isConnected && address ? (
                <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-3">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[#10B981]"
                    aria-hidden
                  />
                  <span className="font-mono text-[11.5px] font-medium text-[var(--fg-dim)]">
                    {address.slice(0, 5)}…{address.slice(-4)}
                  </span>
                </span>
              ) : (
                mounted && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => setWalletOpen(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#2F3FFF] px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#1D2BE8]"
                    style={{
                      boxShadow: "0 6px 16px -4px rgba(47,63,255,0.5)",
                    }}
                  >
                    <Wallet size={13} strokeWidth={2.25} />
                    Connect
                  </motion.button>
                )
              )}

              {/* Faucet button — hanya muncul saat connected + mock token deployed */}
              <AnimatePresence>
                {showFaucet && (
                  <motion.button
                    key="faucet"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={handleFaucet}
                    disabled={isMinting}
                    aria-label="Claim faucet tUSDC"
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-3 text-[12px] font-semibold text-[var(--fg-dim)] transition-colors hover:bg-white/[0.13] hover:text-[var(--fg)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isMinting ? (
                      <Loader size={13} strokeWidth={2} className="animate-spin" />
                    ) : claimed ? (
                      <Check size={13} strokeWidth={2.5} className="text-[var(--success)]" />
                    ) : (
                      <Droplets size={13} strokeWidth={2} className="text-[#7DD3FC]" />
                    )}
                    <span>
                      {isMinting ? "Minting…" : claimed ? "Claimed!" : "Faucet"}
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.nav>

      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  );
}
