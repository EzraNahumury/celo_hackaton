export interface TokenInfo {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  icon?: string;
}

/**
 * Tokens on Celo Sepolia Testnet (chain 11142220)
 * tUSDC adalah token test dengan mint publik — gunakan untuk testing.
 * Address tUSDC diisi setelah menjalankan: forge script script/DeployMockToken.s.sol
 * Set NEXT_PUBLIC_MOCK_TOKEN_ADDRESS di .env.local untuk override.
 */
export const TOKENS: Record<string, TokenInfo> = {
  tUSDC: {
    address: (process.env.NEXT_PUBLIC_MOCK_TOKEN_ADDRESS ??
      "0x0000000000000000000000000000000000000000") as `0x${string}`,
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

export const TOKEN_LIST = Object.values(TOKENS);

// Kept for reference — Alfajores was sunset end of 2025, do not use
export const TESTNET_TOKENS = TOKENS;
export const TESTNET_TOKEN_LIST = TOKEN_LIST;
