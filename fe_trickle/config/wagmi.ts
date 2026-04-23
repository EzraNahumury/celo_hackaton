"use client";

import { http, createConfig } from "wagmi";
import { celo } from "wagmi/chains";

/**
 * Connectors dibiarkan kosong — wagmi auto-discover semua wallet yang pasang
 * EIP-6963 (MetaMask, Rabby, OKX, Brave, Talisman, dll). Masing-masing
 * connector bawa `icon`, `name`, dan `rdns`-nya sendiri.
 */
export const config = createConfig({
  chains: [celo],
  connectors: [],
  transports: {
    [celo.id]: http("https://forno.celo.org"),
  },
});