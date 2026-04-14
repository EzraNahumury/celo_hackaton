"use client";

import { http, createConfig } from "wagmi";
import { celo, celoAlfajores } from "wagmi/chains";
import { injected, metaMask, coinbaseWallet } from "wagmi/connectors";

export const config = createConfig({
  chains: [celo, celoAlfajores],
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
    [celo.id]: http(),
    [celoAlfajores.id]: http(),
  },
});
