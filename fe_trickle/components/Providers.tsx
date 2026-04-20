"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  WagmiProvider,
  useAccount,
  useConnect,
  useDisconnect,
} from "wagmi";
import { config } from "@/config/wagmi";
import { useEffect, useState } from "react";
import { ToastProvider } from "@/components/Toast";

/**
 * Some wallet extensions / in-app browsers (MetaMask mobile, Rabby, etc.)
 * monkey-patch `history.pushState` + `replaceState` to notify themselves of
 * SPA navigations. When their internal listener object gets garbage-collected
 * during HMR or navigation, their patched function throws
 * `TypeError: Cannot read properties of null (reading 'dispatchEvent')`.
 *
 * That uncaught throw aborts Next.js's router transition and triggers the
 * dev error overlay (and "This page couldn't load" on iOS Safari).
 *
 * We wrap both history methods ourselves. The real navigation happens inside
 * the extension's wrapper (before its broken dispatch), so catching the throw
 * leaves navigation working and just silences the extension's ghost event.
 *
 * Module-scope ensures this runs before any React effect, and the __patched
 * flag keeps it idempotent under Fast Refresh.
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
            // Swallow: wallet-extension listener fired on a detached object.
            // Navigation itself already succeeded inside the original call.
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
 * localStorage flag. Set when the user explicitly clicks "Disconnect";
 * cleared only on a successful manual reconnect. While it's present, we
 * skip wagmi's auto-reconnect so a refresh doesn't silently log them back in.
 */
export const DISCONNECT_INTENT_KEY = "trickle.manually-disconnected";

export function hasDisconnectIntent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.localStorage.getItem(DISCONNECT_INTENT_KEY);
  } catch {
    return false;
  }
}

export function clearDisconnectIntent() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DISCONNECT_INTENT_KEY);
  } catch {
    // ignore — nothing we can do if storage is blocked
  }
}

/**
 * Wagmi's built-in reconnectOnMount silently reconnects any injected wallet
 * whose site-permission is still approved. That makes "Disconnect" feel
 * broken — refresh and you're back in.
 *
 * We can't cleanly disable reconnect without fighting wagmi's internals
 * (its <Hydrate> runs a synchronous setState during render when
 * reconnectOnMount is false). Instead we let the reconnect happen, then
 * immediately undo it if the user explicitly chose to disconnect. There is
 * a sub-second "flash" of connected state, but it's snappier than any
 * alternative that would need to fight wagmi's render cycle.
 */
function RespectDisconnectIntent() {
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  useEffect(() => {
    if (!isConnected) return;
    if (!hasDisconnectIntent()) return;
    disconnect();
  }, [isConnected, disconnect]);
  return null;
}

/**
 * Auto-connects MiniPay when detected (Celo in-app wallet injects
 * window.ethereum with isMiniPay=true).
 */
function MiniPayAutoConnect() {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  useEffect(() => {
    if (isConnected) return;
    if (typeof window === "undefined") return;

    const eth = (window as Window & { ethereum?: Record<string, unknown> })
      .ethereum;
    if (!eth?.isMiniPay) return;

    const injected = connectors.find((c) => c.id === "injected");
    if (injected) connect({ connector: injected });
  }, [isConnected, connect, connectors]);

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
          <RespectDisconnectIntent />
          <MiniPayAutoConnect />
          {children}
        </ToastProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
