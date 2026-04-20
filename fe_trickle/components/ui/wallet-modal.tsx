"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useConnect, type Connector } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Check, Loader2, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { clearDisconnectIntent } from "../Providers";

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Wallet yang direkomendasikan — ditandai pakai EIP-6963 rdns kalau ada,
 * fallback ke nama (case-insensitive) biar tetap kena walau rdns gak diannounce.
 */
const RECOMMENDED_RDNS = new Set(["io.metamask"]);
const RECOMMENDED_NAMES = new Set(["metamask"]);

function isRecommended(c: Connector): boolean {
  const rdns = (c as Connector & { rdns?: string | readonly string[] }).rdns;
  if (Array.isArray(rdns)) {
    if (rdns.some((r) => RECOMMENDED_RDNS.has(r))) return true;
  } else if (typeof rdns === "string") {
    if (RECOMMENDED_RDNS.has(rdns)) return true;
  }
  return RECOMMENDED_NAMES.has(c.name.toLowerCase());
}

function rankConnector(c: Connector): number {
  if (isRecommended(c)) return 0;
  if (c.type === "injected") return 1;
  return 2;
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
      // User explicitly connected — wipe any lingering disconnect intent so
      // future refreshes resume auto-reconnect normally.
      clearDisconnectIntent();
      onClose();
    } catch (err) {
      const msg = (err as Error)?.message ?? "Connection rejected";
      setErrorFor(`${c.id}:${msg.slice(0, 80)}`);
    }
  }

  const ordered = [...connectors].sort(
    (a, b) => rankConnector(a) - rankConnector(b) || a.name.localeCompare(b.name),
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
              {ordered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--color-surface-2)] px-5 py-8 text-center">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--color-surface-3)] text-[var(--fg-mute)]">
                    <Wallet size={18} />
                  </span>
                  <p className="mt-1 text-[13.5px] font-semibold text-[var(--fg)]">
                    No wallets detected
                  </p>
                  <p className="max-w-[280px] text-[12px] leading-relaxed text-[var(--fg-mute)]">
                    Install a browser wallet like MetaMask, Rabby, or OKX and
                    reload this page.
                  </p>
                </div>
              ) : (
                ordered.map((c) => {
                  const loading =
                    isPending && variables?.connector &&
                    "id" in variables.connector &&
                    variables.connector.id === c.id;
                  const err = errorFor?.startsWith(`${c.id}:`)
                    ? errorFor.slice(c.id.length + 1)
                    : null;
                  const recommended = isRecommended(c);
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
                      <WalletIcon connector={c} />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[14.5px] font-semibold text-[var(--fg)]">
                            {c.name}
                          </span>
                          {recommended && (
                            <span className="rounded-md bg-[var(--accent-soft)] px-1.5 py-[1px] text-[10.5px] font-semibold text-[var(--accent)]">
                              Recommended
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[12.5px] text-[var(--fg-mute)]">
                          {err ? (
                            <span className="text-[var(--danger)]">{err}</span>
                          ) : (
                            "Browser extension"
                          )}
                        </span>
                      </span>
                      {loading ? (
                        <Loader2
                          size={16}
                          className="animate-spin text-[var(--fg-dim)]"
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-soft)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--success)]">
                          <Check size={10} strokeWidth={3} />
                          Detected
                        </span>
                      )}
                    </button>
                  );
                })
              )}
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

/**
 * Icon asli dari tiap wallet (EIP-6963 kasih data URI via `connector.icon`).
 * Kalau gak ada, fallback ke inisial di lingkaran gelap.
 */
function WalletIcon({ connector }: { connector: Connector }) {
  const icon = (connector as Connector & { icon?: string }).icon;
  const initial = connector.name.trim().slice(0, 1).toUpperCase();

  if (icon) {
    return (
      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/[0.04]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={icon}
          alt=""
          width={44}
          height={44}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--color-surface-3)] text-[15px] font-bold text-[var(--fg-dim)]">
      {initial || "W"}
    </span>
  );
}
