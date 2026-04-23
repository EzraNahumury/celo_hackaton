"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useAccount, useDisconnect } from "wagmi";
import { config } from "@/config/wagmi";
import { useEffect, useState } from "react";
import { ToastProvider } from "@/components/Toast";

/**
 * Some wallet extensions / in-app browsers monkey-patch `history.pushState`
 * + `replaceState`. When their internal listener gets garbage-collected during HMR
 * or navigation, their patched function throws
 * `TypeError: Cannot read properties of null (reading 'dispatchEvent')`.
 *
 * We wrap both history methods to swallow this specific error, leaving actual
 * navigation working. Module-scope __patched flag keeps it idempotent under Fast Refresh.
 */
if (typeof window !== "undefined") {
  type HistoryWithFlag = History & { __trickle_patched?: boolean };
  const h = window.history as HistoryWithFlag;
  if (!h.__trickle_patched) {
    h.__trickle_patched = true;
    const wrap = <K extends "pushState" | "replaceState">(key: K) => {
      const original = window.history[key].bind(window.history);
      window.history[key] = function (
        this: History,
        ...args: Parameters<History[K]>
      ) {
        try {
          return (original as (...a: unknown[]) => void).apply(this, args);
        } catch (err) {
          if (
            err instanceof TypeError &&
            typeof err.message === "string" &&
            err.message.includes("dispatchEvent")
          ) {
            return;
          }
          throw err;
        }
      } as History[K];
    };
    wrap("pushState");
    wrap("replaceState");
  }
}

/**
 * localStorage flag — set when user explicitly clicks Disconnect.
 * Wagmi auto-reconnects on mount if wallet still has site permission.
 * This flag lets us undo that reconnect immediately after it happens.
 */
export const DISCONNECT_INTENT_KEY = "trickle.manually-disconnected";

export function hasDisconnectIntent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!localStorage.getItem(DISCONNECT_INTENT_KEY);
  } catch {
    return false;
  }
}

export function clearDisconnectIntent() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DISCONNECT_INTENT_KEY);
  } catch {}
}

export function setDisconnectIntent() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DISCONNECT_INTENT_KEY, "1");
  } catch {}
}

/**
 * Watches for wagmi auto-reconnect after a page reload when user previously
 * clicked Disconnect. Immediately undoes that reconnect so the wallet stays
 * disconnected after reload.
 */
function UndoAutoReconnect() {
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (!isConnected) return;
    if (!hasDisconnectIntent()) return;
    disconnect();
    clearDisconnectIntent();
  }, [isConnected, disconnect]);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 8_000,
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <UndoAutoReconnect />
          {children}
        </ToastProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
