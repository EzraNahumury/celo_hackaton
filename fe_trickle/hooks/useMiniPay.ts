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

export function useIsMiniPay(): boolean {
  const [isMiniPay, setIsMiniPay] = React.useState(false);

  React.useEffect(() => {
    setIsMiniPay(detectMiniPay());
  }, []);

  return isMiniPay;
}

