import { MAINNET_ID, SEPOLIA_ID, DEFAULT_CHAIN_ID } from "./chains";

export interface TokenInfo {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  icon?: string;
}

/**
 * Celo Mainnet (chain 42220) — stablecoins + native CELO.
 *
 * cUSD  0x765DE816845861e75A25fCA122bb6898B8B1282a  18 dec  Mento Celo Dollar
 * USDC  0xcebA9300f2b948710d2653dD7B07f33A8B32118C   6 dec  Circle native USDC
 * USDT  0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e   6 dec  Tether USD
 * CELO  0x471EcE3750Da237f93B8E339c536989b8978a438  18 dec  GoldToken ERC-20 wrapper
 */
const MAINNET_TOKENS: Record<string, TokenInfo> = {
  cUSD: {
    address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    symbol: "cUSD",
    name: "Celo Dollar",
    decimals: 18,
    icon: "/tokens/cusd.svg",
  },
  USDC: {
    address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    icon: "/tokens/usdc.svg",
  },
  USDT: {
    address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    icon: "/tokens/usdt.svg",
  },
  CELO: {
    address: "0x471EcE3750Da237f93B8E339c536989b8978a438",
    symbol: "CELO",
    name: "Celo Native Token",
    decimals: 18,
    icon: "/tokens/celo.svg",
  },
};

/**
 * Celo Sepolia testnet (chain 11142220).
 *
 * tUSDC – mock token with public mint() for faucet, deployed by DeployMockToken.s.sol
 * USDC  – 0x01C5C0122039549AD1493B8220cABEdD739BC44E   6 dec
 * USDm  – 0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80  18 dec  Mento Dollar (testnet cUSD)
 * USDT  – 0xd077A400968890Eacc75cdc901F0356c943e4fDb   6 dec
 */
const SEPOLIA_TOKENS: Record<string, TokenInfo> = {
  tUSDC: {
    address:
      (process.env.NEXT_PUBLIC_MOCK_TOKEN_ADDRESS as `0x${string}`) ??
      "0x0000000000000000000000000000000000000000",
    symbol: "tUSDC",
    name: "Test USD Coin",
    decimals: 6,
    icon: "/tokens/tusdc.png",
  },
  USDm: {
    address: "0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80",
    symbol: "USDm",
    name: "Mento Dollar (testnet)",
    decimals: 18,
    icon: "/tokens/cusd.png",
  },
  USDC: {
    address: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    icon: "/tokens/tusdc.png",
  },
  USDT: {
    address: "0xd077A400968890Eacc75cdc901F0356c943e4fDb",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    icon: "/tokens/usdt.png",
  },
};

export const TOKENS_BY_CHAIN: Record<number, Record<string, TokenInfo>> = {
  [MAINNET_ID]: MAINNET_TOKENS,
  [SEPOLIA_ID]: SEPOLIA_TOKENS,
};

export function tokensFor(chainId?: number): Record<string, TokenInfo> {
  if (chainId && TOKENS_BY_CHAIN[chainId]) return TOKENS_BY_CHAIN[chainId];
  return TOKENS_BY_CHAIN[DEFAULT_CHAIN_ID];
}

export function tokenListFor(chainId?: number): TokenInfo[] {
  return Object.values(tokensFor(chainId));
}

/**
 * Legacy exports — resolve against the default chain (mainnet). Only use
 * these in non-React modules; React code should prefer `useChainTokens()`.
 */
export const TOKENS: Record<string, TokenInfo> = tokensFor(DEFAULT_CHAIN_ID);
export const TOKEN_LIST: TokenInfo[] = tokenListFor(DEFAULT_CHAIN_ID);
