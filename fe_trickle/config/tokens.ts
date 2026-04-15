export interface TokenInfo {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
}

/**
 * Tokens on Celo Sepolia Testnet (chain 11142220)
 * USDC is the primary token for TrickleVault streams.
 */
export const TOKENS: Record<string, TokenInfo> = {
  USDC: {
    address: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  USDm: {
    address: "0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80",
    symbol: "USDm",
    name: "Mento Dollar",
    decimals: 18,
  },
  USDT: {
    address: "0xd077A400968890Eacc75cdc901F0356c943e4fDb",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
};

export const TOKEN_LIST = Object.values(TOKENS);

// Kept for reference — Alfajores was sunset end of 2025, do not use
export const TESTNET_TOKENS = TOKENS;
export const TESTNET_TOKEN_LIST = TOKEN_LIST;
