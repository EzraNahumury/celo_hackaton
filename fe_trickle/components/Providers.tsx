"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useAccount, useConnect } from "wagmi";
import { config } from "@/config/wagmi";
import { useEffect, useState } from "react";
import { ToastProvider } from "@/components/Toast";

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
          <MiniPayAutoConnect />
          {children}
        </ToastProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
