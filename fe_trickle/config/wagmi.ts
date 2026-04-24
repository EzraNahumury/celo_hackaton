"use client";

import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { celo } from "wagmi/chains";

// injected() handles MiniPay's window.ethereum injection (no EIP-6963 announcement)
export const config = createConfig({
  chains: [celo],
  connectors: [injected()],
  transports: {
    [celo.id]: http("https://forno.celo.org"),
  },
});