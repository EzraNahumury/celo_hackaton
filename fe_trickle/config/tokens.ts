import { MAINNET_ID, SEPOLIA_ID, DEFAULT_CHAIN_ID } from "./chains";

export interface TokenInfo {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  icon?: string;
}

/**
 * Celo Mainnet (chain 42220) — production USDC.
 */
const MAINNET_TOKENS: Record<string, TokenInfo> = {
  USDC: {
    address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    icon: "/tokens/usdt.png",
  },
};

/**
 * Celo Sepolia (chain 11142220) — testnet USDC/USDm plus our own mock
 * with a public `mint()` (faucet button), deployed by
 * `forge script script/DeployMockToken.s.sol` and pinned via
 * NEXT_PUBLIC_MOCK_TOKEN_ADDRESS.
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
  USDC: {
    address: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    icon: "/tokens/usdt.png",
  },
  USDm: {
    address: "0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80",
    symbol: "USDm",
    name: "Mento Dollar",
    decimals: 18,
    icon: "/tokens/usdm.png",
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
