import { TOKENS as SDK_TOKENS } from "trickle-sdk";

export interface TokenInfo {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  icon?: string;
}

// Canonical addresses + decimals come from the published trickle-sdk (single
// source of truth); name/symbol/icon are dApp-side presentation. USDm is the
// display symbol for Mento Dollar (cUSD on-chain).
const MAINNET_TOKENS: Record<string, TokenInfo> = {
  USDm: {
    address: SDK_TOKENS.cUSD.address as `0x${string}`,
    symbol: "USDm",
    name: "Mento Dollar",
    decimals: SDK_TOKENS.cUSD.decimals,
    icon: "/tokens/cusd.svg",
  },
  USDC: {
    address: SDK_TOKENS.USDC.address as `0x${string}`,
    symbol: "USDC",
    name: "USD Coin",
    decimals: SDK_TOKENS.USDC.decimals,
    icon: "/tokens/usdc.svg",
  },
  USDT: {
    address: SDK_TOKENS.USDT.address as `0x${string}`,
    symbol: "USDT",
    name: "Tether USD",
    decimals: SDK_TOKENS.USDT.decimals,
    icon: "/tokens/usdt.svg",
  },
  CELO: {
    address: SDK_TOKENS.CELO.address as `0x${string}`,
    symbol: "CELO",
    name: "Celo Native Token",
    decimals: SDK_TOKENS.CELO.decimals,
    icon: "/tokens/celo.svg",
  },
};

export const TOKENS = MAINNET_TOKENS;
export const TOKEN_LIST = Object.values(MAINNET_TOKENS);

export function tokensFor(): Record<string, TokenInfo> {
  return TOKENS;
}

export function tokenListFor(): TokenInfo[] {
  return TOKEN_LIST;
}