"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useAccount, useDisconnect } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Copy,
  Check,
  Power,
  ExternalLink,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface ProfileSheetProps {
  open: boolean;
  onClose: () => void;
  onConnect?: () => void;
}

export function ProfileSheet({ open, onClose, onConnect }: ProfileSheetProps) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="profile-sheet"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6"
        >
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[460px] overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] sm:rounded-3xl"
          >
            <div className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-[var(--border-strong)] sm:hidden" />

            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <h2 className="font-display text-[16px] font-semibold tracking-tight text-[var(--fg)]">
                Profile
              </h2>
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--color-surface-2)] text-[var(--fg-mute)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
              >
                <X size={14} />
              </button>
            </div>

            {isConnected && address ? (
              <div className="px-5 pb-5">
                {/* Avatar + address */}
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--color-surface-2)] p-4">
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[14px] font-semibold text-white"
                    style={{
                      background:
                        "linear-gradient(140deg, #818CF8 0%, #4F46E5 100%)",
                    }}
                  >
                    {address.slice(2, 3).toUpperCase()}
                    {address.slice(-1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] font-medium uppercase tracking-[0.1em] text-[var(--fg-mute)]">
                      Connected on Celo
                    </p>
                    <p className="mt-0.5 break-all font-mono text-[12.5px] text-[var(--fg-dim)]">
                      {address}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex flex-col gap-1">
                  <SheetAction
                    icon={
                      copied ? (
                        <Check
                          size={16}
                          strokeWidth={2.25}
                          className="text-[var(--success)]"
                        />
                      ) : (
                        <Copy size={16} strokeWidth={2} />
                      )
                    }
                    label={copied ? "Address copied" : "Copy address"}
                    onClick={copyAddress}
                  />
                  <SheetAction
                    icon={<ExternalLink size={16} strokeWidth={2} />}
                    label="View on Celoscan"
                    href={`https://celoscan.io/address/${address}`}
                    external
                  />
                  <SheetAction
                    icon={<Power size={16} strokeWidth={2} />}
                    label="Disconnect wallet"
                    tone="danger"
                    onClick={() => {
                      onClose();
                      disconnect();
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="px-5 pb-5">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--color-surface-2)] p-5 text-center">
                  <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-[var(--color-accent-soft)] text-[var(--accent-3)]">
                    <Wallet size={18} />
                  </div>
                  <p className="text-[14px] font-semibold text-[var(--fg)]">
                    No wallet connected
                  </p>
                  <p className="mx-auto mt-1 max-w-[320px] text-[12.5px] text-[var(--fg-mute)]">
                    Connect a wallet to start streaming or receiving salary on Celo.
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      onConnect?.();
                    }}
                    className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 text-[13px] font-semibold text-white shadow-[var(--shadow-accent)] transition-colors hover:bg-[var(--accent-2)]"
                  >
                    <Wallet size={14} />
                    Connect wallet
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function SheetAction({
  icon,
  label,
  onClick,
  href,
  external,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  tone?: "danger";
}) {
  const cls = cn(
    "flex items-center gap-3 rounded-xl px-3.5 py-3 text-[13.5px] font-medium transition-colors",
    tone === "danger"
      ? "text-[var(--fg-dim)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--danger)]"
      : "text-[var(--fg)] hover:bg-[var(--color-surface-2)]",
  );
  const content = (
    <>
      <span
        className={cn(
          "grid h-8 w-8 place-items-center rounded-lg",
          tone === "danger"
            ? "bg-[var(--color-surface-2)]"
            : "bg-[var(--color-surface-2)]",
        )}
      >
        {icon}
      </span>
      <span className="flex-1">{label}</span>
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className={cls}
      >
        {content}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={cls}>
      {content}
    </button>
  );
}
