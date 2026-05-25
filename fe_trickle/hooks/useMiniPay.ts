"use client";

import * as React from "react";

type MiniPayEthereumProvider = {
  isMiniPay?: boolean;
};

function detectMiniPay(): boolean {
  if (typeof window === "undefined") return false;
  const eth = (window as Window & { ethereum?: MiniPayEthereumProvider })
    .ethereum;
  return eth?.isMiniPay === true;
}

/**
 * True when the page is running inside the MiniPay in-app browser.
 *
 * MiniPay announces itself via `window.ethereum.isMiniPay = true`. We detect
 * lazily in an effect — never during SSR — so the initial render always
 * returns `false`. Components that branch on this should treat the first
 * paint as the non-MiniPay path; the value flips after hydration if needed.
 *
 * Use this to:
 *  - Skip the connect-wallet step (MiniPayAutoConnect handles it).
 *  - Show the MiniPay badge in the navbar.
 *  - Suppress wallet-picker UI that would be redundant in-app.
 */
export function useIsMiniPay(): boolean {
  const [isMiniPay, setIsMiniPay] = React.useState(false);

  React.useEffect(() => {
    setIsMiniPay(detectMiniPay());
  }, []);

  return isMiniPay;
}

