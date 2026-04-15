"use client";

import { http, createConfig } from "wagmi";
import { celo } from "wagmi/chains";
import { defineChain } from "viem";
import { injected, metaMask, coinbaseWallet } from "wagmi/connectors";

/**
 * Celo Sepolia Testnet (chain 11142220)
 * Replaces the retired Alfajores testnet (sunset end of 2025).
 * Defined manually because wagmi/chains may not ship it yet.
 */
export const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia Testnet",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.ankr.com/celo_sepolia"] },
    ankr:  { http: ["https://rpc.ankr.com/celo_sepolia"] },
    drpc:  { http: ["https://celo-sepolia.drpc.org"] },
    forno: { http: ["https://forno.celo-sepolia.celo-testnet.org"] },
  },
  blockExplorers: {
    default: { name: "Celoscan", url: "https://sepolia.celoscan.io" },
  },
  testnet: true,
});

export const config = createConfig({
  chains: [celoSepolia, celo],
  connectors: [
    metaMask({
      dappMetadata: { name: "Trickle", url: "https://trickle.app" },
    }),
    coinbaseWallet({
      appName: "Trickle",
      preference: "all",
    }),
    injected({ shimDisconnect: true }),
  ],
  transports: {
    [celoSepolia.id]: http("https://rpc.ankr.com/celo_sepolia"),
    [celo.id]:        http(),
  },
});
