"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  useAccount,
  useDisconnect,
  useReadContracts,
  type Connector,
} from "wagmi";
import { formatUnits } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Copy,
  Check,
  Power,
  ExternalLink,
  Wallet,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { TOKEN_LIST } from "@/config/tokens";
import { ERC20_ABI } from "@/config/contracts";
import { TokenIcon } from "./ui/TokenIcon";
import { DISCONNECT_INTENT_KEY } from "./Providers";

interface ProfileSheetProps {
  open: boolean;
  onClose: () => void;
  onConnect?: () => void;
}

const ZERO = "0x0000000000000000000000000000000000000000";

/**
 * Full disconnect: (1) mark intent so AutoReconnect skips on next load,
 * (2) best-effort EIP-2255 wallet_revokePermissions so the wallet itself
 * forgets the site approval, (3) disconnect from wagmi state.
 */
function handleDisconnect(wagmiDisconnect: () => void) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(DISCONNECT_INTENT_KEY, "1");
    } catch {
      // localStorage unavailable — next load may auto-reconnect, acceptable fallback
    }
    const eth = (
      window as Window & {
        ethereum?: {
          request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
        };
      }
    ).ethereum;
    // Not every wallet implements wallet_revokePermissions yet — fire-and-forget
    eth?.request?.({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    }).catch(() => {});
  }
  wagmiDisconnect();
}

const TOKEN_ACCENT: Record<string, { bg: string; fg: string }> = {
  tUSDC: { bg: "rgba(125, 211, 252, 0.12)", fg: "#7DD3FC" },
  USDC:  { bg: "rgba(47, 99, 255, 0.14)",  fg: "#6B8EFF" },
  USDm:  { bg: "rgba(110, 231, 183, 0.12)", fg: "#6EE7B7" },
  _:     { bg: "rgba(255,255,255,0.06)",   fg: "#B8BECE" },
};

export function ProfileSheet({ open, onClose, onConnect }: ProfileSheetProps) {
  const { address, isConnected, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

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

  // Baca saldo semua token sekali panggil
  const validTokens = TOKEN_LIST.filter((t) => t.address !== ZERO);
  const balanceCalls = address
    ? validTokens.map((t) => ({
        address: t.address,
        abi: ERC20_ABI,
        functionName: "balanceOf" as const,
        args: [address] as const,
      }))
    : [];

  const {
    data: balanceResults,
    refetch: refetchBalances,
    isFetching: balancesFetching,
  } = useReadContracts({
    contracts: balanceCalls,
    query: {
      enabled: !!address && open,
      staleTime: 0,
      refetchOnMount: "always",
      // Refresh tiap 3 detik selama sheet terbuka — selalu up-to-date sama on-chain
      refetchInterval: open ? 3_000 : false,
    },
  });

  // Paksa refetch tiap kali sheet dibuka — tangani kasus user baru deposit
  // dari panel lain dan langsung buka Profile dalam <staleTime detik.
  React.useEffect(() => {
    if (open && address) refetchBalances();
  }, [open, address, refetchBalances]);

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1400);
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
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[440px] overflow-hidden rounded-t-[28px] border border-white/[0.06] shadow-[var(--shadow-lg)] sm:rounded-[28px]"
            style={{
              background: "rgba(10, 11, 20, 0.82)",
              backdropFilter: "blur(32px) saturate(160%)",
              WebkitBackdropFilter: "blur(32px) saturate(160%)",
            }}
          >
            <div className="mx-auto mt-2.5 mb-1 h-[3px] w-9 rounded-full bg-white/15 sm:hidden" />

            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="font-display text-[15px] font-semibold tracking-tight text-[var(--fg)]">
                Account
              </h2>
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full text-[var(--fg-mute)] transition-colors hover:bg-white/[0.06] hover:text-[var(--fg)]"
              >
                <X size={14} strokeWidth={2.2} />
              </button>
            </div>

            {isConnected && address ? (
              <div className="px-5 pb-5">
                {/* Identity row */}
                <div className="flex items-center gap-3 pb-4">
                  <WalletAvatar connector={connector} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-[13.5px] font-semibold tracking-tight text-[var(--fg)]">
                        {address.slice(0, 6)}…{address.slice(-4)}
                      </p>
                      <button
                        onClick={copyAddress}
                        aria-label={copied ? "Copied" : "Copy address"}
                        className="grid h-6 w-6 place-items-center rounded-md text-[var(--fg-faint)] transition-colors hover:bg-white/[0.06] hover:text-[var(--fg)]"
                      >
                        {copied ? (
                          <Check
                            size={12}
                            strokeWidth={2.5}
                            className="text-[var(--success)]"
                          />
                        ) : (
                          <Copy size={12} strokeWidth={2} />
                        )}
                      </button>
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-[var(--fg-mute)]">
                      {connector?.name ? `${connector.name} · ` : ""}Celo Sepolia · Testnet
                    </p>
                  </div>
                </div>

                {/* Token balances */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                  <div className="flex items-center justify-between px-4 pt-3 pb-2">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--fg-faint)]">
                      Balances
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10.5px] font-medium text-[var(--fg-faint)]">
                        {validTokens.length} tokens
                      </span>
                      <button
                        onClick={() => refetchBalances()}
                        disabled={balancesFetching}
                        aria-label="Refresh balances"
                        className="grid h-6 w-6 place-items-center rounded-md text-[var(--fg-faint)] transition-colors hover:bg-white/[0.06] hover:text-[var(--fg)] disabled:cursor-not-allowed"
                      >
                        <RefreshCw
                          size={11}
                          strokeWidth={2.2}
                          className={cn(
                            "transition-transform",
                            balancesFetching && "animate-spin",
                          )}
                        />
                      </button>
                    </div>
                  </div>
                  <div className="px-1.5 pb-1.5">
                    {validTokens.map((token, i) => {
                      const raw = balanceResults?.[i];
                      const balance =
                        raw?.status === "success" && raw.result != null
                          ? parseFloat(
                              formatUnits(raw.result as bigint, token.decimals)
                            )
                          : null;
                      const accent = TOKEN_ACCENT[token.symbol] ?? TOKEN_ACCENT._;
                      return (
                        <div
                          key={token.symbol}
                          className="flex items-center justify-between rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.03]"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <TokenIcon
                              symbol={token.symbol}
                              icon={token.icon}
                              size={32}
                              rounded="full"
                              fallback={accent}
                            />
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-[var(--fg)]">
                                {token.symbol}
                              </p>
                              <p className="truncate text-[11px] text-[var(--fg-mute)]">
                                {token.name}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {balance === null ? (
                              <span className="skeleton inline-block h-3.5 w-16 rounded" />
                            ) : (
                              <>
                                <p className="font-mono text-[13px] font-semibold tabular text-[var(--fg)]">
                                  {balance.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 4,
                                  })}
                                </p>
                                <p className="text-[10.5px] text-[var(--fg-faint)]">
                                  {token.symbol}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-col">
                  <SheetAction
                    icon={<ExternalLink size={14} strokeWidth={2} />}
                    label="View on Celoscan"
                    hint="Explorer"
                    href={`https://sepolia.celoscan.io/address/${address}`}
                    external
                    trailing={<ChevronRight size={14} className="text-[var(--fg-faint)]" />}
                  />
                  <SheetAction
                    icon={<Power size={14} strokeWidth={2} />}
                    label="Disconnect"
                    tone="danger"
                    onClick={() => {
                      onClose();
                      handleDisconnect(disconnect);
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="px-5 pb-5">
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-center">
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

/**
 * Avatar besar di header — pake icon wallet yang lagi connect (dari EIP-6963
 * `connector.icon`). Kalau connector gak announce icon, fallback ke inisial
 * dari nama wallet di atas gradient indigo.
 */
function WalletAvatar({ connector }: { connector: Connector | undefined }) {
  const icon = (connector as (Connector & { icon?: string }) | undefined)?.icon;
  const initial = connector?.name?.trim().slice(0, 1).toUpperCase() ?? "W";

  return (
    <span
      className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full"
      style={{
        background: icon
          ? "rgba(255,255,255,0.04)"
          : "linear-gradient(140deg, #818CF8 0%, #4F46E5 100%)",
        boxShadow: icon
          ? "0 4px 12px -6px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.08)"
          : "0 6px 16px -6px rgba(79,70,229,0.55), inset 0 1px 0 rgba(255,255,255,0.2)",
      }}
    >
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={icon}
          alt={connector?.name ?? "Wallet"}
          width={44}
          height={44}
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="text-[13px] font-semibold text-white">{initial}</span>
      )}
      <span
        aria-hidden
        className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0A0B14] bg-[var(--success)]"
      />
    </span>
  );
}

function SheetAction({
  icon,
  label,
  hint,
  onClick,
  href,
  external,
  tone,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  tone?: "danger";
  trailing?: React.ReactNode;
}) {
  const cls = cn(
    "group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-[13px] font-medium transition-colors",
    tone === "danger"
      ? "text-[var(--fg-dim)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--danger)]"
      : "text-[var(--fg)] hover:bg-white/[0.04]",
  );
  const iconCls = cn(
    "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
    tone === "danger"
      ? "bg-white/[0.04] text-[var(--fg-mute)] group-hover:bg-[var(--color-danger-soft)] group-hover:text-[var(--danger)]"
      : "bg-white/[0.04] text-[var(--fg-dim)] group-hover:text-[var(--fg)]",
  );
  const content = (
    <>
      <span className={iconCls}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block leading-tight">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-[11px] font-normal text-[var(--fg-faint)]">
            {hint}
          </span>
        )}
      </span>
      {trailing}
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
