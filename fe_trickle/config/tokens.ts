export interface TokenInfo {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  icon?: string;
}

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

export const TOKENS = MAINNET_TOKENS;
export const TOKEN_LIST = Object.values(MAINNET_TOKENS);

export function tokensFor(): Record<string, TokenInfo> {
  return TOKENS;
}

export function tokenListFor(): TokenInfo[] {
  return TOKEN_LIST;
}