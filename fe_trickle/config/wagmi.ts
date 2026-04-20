"use client";

import { http, createConfig } from "wagmi";
import { celo } from "wagmi/chains";
import { defineChain } from "viem";

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
    default: { http: ["https://forno.celo-sepolia.celo-testnet.org"] },
    forno: { http: ["https://forno.celo-sepolia.celo-testnet.org"] },
    drpc:  { http: ["https://celo-sepolia.drpc.org"] },
    ankr:  { http: ["https://rpc.ankr.com/celo_sepolia"] },
  },
  blockExplorers: {
    default: { name: "Celoscan", url: "https://sepolia.celoscan.io" },
  },
  testnet: true,
});

/**
 * Connectors dibiarkan kosong — wagmi auto-discover semua wallet yang pasang
 * EIP-6963 (MetaMask, Rabby, OKX, Brave, Talisman, dll). Masing-masing
 * connector bawa `icon`, `name`, dan `rdns`-nya sendiri.
 */
export const config = createConfig({
  chains: [celo, celoSepolia],
  connectors: [],
  transports: {
    [celo.id]:        http("https://forno.celo.org"),
    [celoSepolia.id]: http("https://forno.celo-sepolia.celo-testnet.org"),
  },
});
