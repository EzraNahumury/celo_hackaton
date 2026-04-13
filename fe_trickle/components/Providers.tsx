"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { config } from "@/config/wagmi";
import { useEffect, useState } from "react";
import { ToastProvider } from "@/components/Toast";

/**
 * Detects MiniPay wallet environment and auto-connects the injected connector.
 * MiniPay injects window.ethereum with isMiniPay = true.
 */
function MiniPayAutoConnect() {
  const { isConnected } = useAccount();
  const { connect } = useConnect();

  useEffect(() => {
    if (isConnected) return;
    if (typeof window === "undefined") return;

    const eth = (window as Window & { ethereum?: Record<string, unknown> }).ethereum;
    if (eth?.isMiniPay) {
      connect({ connector: injected() });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Keep data fresh — streams update every second
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
          <MiniPayAutoConnect />
          {children}
        </ToastProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
