export interface TokenInfo {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
}

// Celo Mainnet stablecoins
export const TOKENS: Record<string, TokenInfo> = {
  cUSD: {
    address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    symbol: "cUSD",
    name: "Celo Dollar",
    decimals: 18,
  },
  USDC: {
    address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  USDT: {
    address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
};

// Alfajores testnet stablecoins
export const TESTNET_TOKENS: Record<string, TokenInfo> = {
  cUSD: {
    address: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
    symbol: "cUSD",
    name: "Celo Dollar",
    decimals: 18,
  },
};

export const TOKEN_LIST = Object.values(TOKENS);
export const TESTNET_TOKEN_LIST = Object.values(TESTNET_TOKENS);
