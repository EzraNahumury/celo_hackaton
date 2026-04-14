"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useConnect, type Connector } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
}

interface WalletMeta {
  id: string;
  name: string;
  description?: string;
  icon: React.ReactNode;
  recommended?: boolean;
}

const BRAND: Record<string, WalletMeta> = {
  metaMaskSDK: {
    id: "metaMaskSDK",
    name: "MetaMask",
    description: "Browser extension · Mobile",
    icon: <MetaMaskLogo />,
    recommended: true,
  },
  coinbaseWalletSDK: {
    id: "coinbaseWalletSDK",
    name: "Coinbase Wallet",
    description: "Smart wallet · Extension · Mobile",
    icon: <CoinbaseLogo />,
  },
  injected: {
    id: "injected",
    name: "Browser wallet",
    description: "Rabby, Brave, OKX, or other injected wallet",
    icon: <BrowserLogo />,
  },
};

function metaFor(connector: Connector): WalletMeta {
  return (
    BRAND[connector.id] ?? {
      id: connector.id,
      name: connector.name,
      icon: <BrowserLogo />,
    }
  );
}

export function WalletModal({ open, onClose }: WalletModalProps) {
  const { connectors, connectAsync, isPending, variables } = useConnect();
  const [mounted, setMounted] = React.useState(false);
  const [errorFor, setErrorFor] = React.useState<string | null>(null);

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

  async function handleConnect(c: Connector) {
    setErrorFor(null);
    try {
      await connectAsync({ connector: c });
      onClose();
    } catch (err) {
      const msg = (err as Error)?.message ?? "Connection rejected";
      setErrorFor(`${c.id}:${msg.slice(0, 80)}`);
    }
  }

  const ORDER = ["metaMaskSDK", "coinbaseWalletSDK", "injected"];
  const ordered = [...connectors].sort(
    (a, b) =>
      ORDER.indexOf(a.id) - ORDER.indexOf(b.id) ||
      (a.id === "injected" ? 1 : 0),
  );

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="wallet-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
          />

          {/* Card */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-modal-title"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[440px] overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div>
                <h2
                  id="wallet-modal-title"
                  className="font-display text-[20px] font-semibold tracking-tight text-[var(--fg)]"
                >
                  Connect a wallet
                </h2>
                <p className="mt-1 text-[13px] text-[var(--fg-mute)]">
                  Choose how you&apos;d like to sign in
                </p>
              </div>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] bg-[var(--color-surface-2)] text-[var(--fg-mute)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-3)] hover:text-[var(--fg)]"
              >
                <X size={15} />
              </button>
            </div>

            {/* List */}
            <div className="flex flex-col gap-2 px-4 pb-4">
              {ordered.map((c) => {
                const meta = metaFor(c);
                const loading =
                  isPending && variables?.connector &&
                  "id" in variables.connector &&
                  variables.connector.id === c.id;
                const err = errorFor?.startsWith(`${c.id}:`)
                  ? errorFor.slice(c.id.length + 1)
                  : null;
                const installed = detectInstalled(c.id);
                return (
                  <button
                    key={c.uid}
                    onClick={() => handleConnect(c)}
                    disabled={loading}
                    className={cn(
                      "group flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--color-surface-2)] px-3.5 py-3 text-left transition-all duration-200",
                      "hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-3)]",
                      loading && "opacity-80",
                    )}
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl">
                      {meta.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-[14.5px] font-semibold text-[var(--fg)]">
                          {meta.name}
                        </span>
                        {meta.recommended && (
                          <span className="rounded-md bg-[var(--accent-soft)] px-1.5 py-[1px] text-[10.5px] font-semibold text-[var(--accent)]">
                            Recommended
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[12.5px] text-[var(--fg-mute)]">
                        {err ? (
                          <span className="text-[var(--danger)]">{err}</span>
                        ) : (
                          meta.description
                        )}
                      </span>
                    </span>
                    {loading ? (
                      <Loader2
                        size={16}
                        className="animate-spin text-[var(--fg-dim)]"
                      />
                    ) : installed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-soft)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--success)]">
                        <Check size={10} strokeWidth={3} />
                        Installed
                      </span>
                    ) : (
                      <ArrowRight
                        size={15}
                        className="text-[var(--fg-faint)] transition-colors group-hover:text-[var(--fg-dim)]"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--divider)] bg-[var(--color-bg-2)] px-6 py-4">
              <p className="text-[12px] text-[var(--fg-mute)]">
                New to Ethereum wallets?{" "}
                <a
                  href="https://ethereum.org/en/wallets/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[var(--accent)] underline-offset-4 transition-colors hover:underline"
                >
                  Learn more
                </a>
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function detectInstalled(connectorId: string): boolean {
  if (typeof window === "undefined") return false;
  const eth = (window as unknown as { ethereum?: Record<string, unknown> })
    .ethereum;
  if (connectorId === "metaMaskSDK") return Boolean(eth?.isMetaMask);
  if (connectorId === "coinbaseWalletSDK") return Boolean(eth?.isCoinbaseWallet);
  if (connectorId === "injected") return Boolean(eth);
  return false;
}

/* ─── Wallet logos ──────────────────────────────────────────────────────── */

function MetaMaskLogo() {
  return (
    <svg viewBox="0 0 44 44" className="h-full w-full" fill="none">
      <rect width="44" height="44" rx="12" fill="#2A1B0E" />
      <g transform="translate(6 7)">
        <path d="M28 2L18.5 8.5L20.5 4.2L28 2Z" fill="#E2761B" />
        <path d="M4 2L13.3 8.6L11.5 4.2L4 2Z" fill="#E4761B" />
        <path d="M24.5 22L22 26L27 27.3L28.5 22.1L24.5 22Z" fill="#E4761B" />
        <path d="M3.5 22.1L5 27.3L10 26L7.5 22L3.5 22.1Z" fill="#E4761B" />
        <path d="M9.7 14L8.3 16.3L13.2 16.5L13.1 11.3L9.7 14Z" fill="#E4761B" />
        <path d="M22.3 14L18.8 11.2L18.7 16.5L23.6 16.3L22.3 14Z" fill="#E4761B" />
        <path d="M10 26L13 24.4L10.4 22.2L10 26Z" fill="#D7C1B3" />
        <path d="M19 24.4L22 26L21.6 22.2L19 24.4Z" fill="#D7C1B3" />
        <path d="M22 26L19 24.4L19.2 26.5L19.2 27.2L22 26Z" fill="#233447" />
        <path d="M10 26L12.8 27.2L12.8 26.5L13 24.4L10 26Z" fill="#233447" />
      </g>
    </svg>
  );
}

function CoinbaseLogo() {
  return (
    <svg viewBox="0 0 44 44" className="h-full w-full" fill="none">
      <rect width="44" height="44" rx="12" fill="#0E1A3A" />
      <circle cx="22" cy="22" r="12" fill="#0052FF" />
      <rect x="17" y="17" width="10" height="10" rx="1.4" fill="#fff" />
    </svg>
  );
}

function BrowserLogo() {
  return (
    <svg viewBox="0 0 44 44" className="h-full w-full" fill="none">
      <rect width="44" height="44" rx="12" fill="#252A3D" />
      <rect
        x="12"
        y="15"
        width="20"
        height="15"
        rx="3"
        stroke="#B8BECE"
        strokeWidth="1.5"
      />
      <path
        d="M25 22.5h6"
        stroke="#B8BECE"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="28.5" cy="22.5" r="1.3" fill="#B8BECE" />
    </svg>
  );
}
