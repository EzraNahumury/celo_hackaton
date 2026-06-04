/**
 * On-chain addresses for the Trickle protocol on Celo Mainnet (chain 42220).
 *
 * Trickle is a real-time payroll streaming protocol: employers deposit
 * stablecoins into the TrickleVault and open per-second salary streams to
 * employees, who withdraw accrued earnings at any time. StreamRegistry holds
 * optional on-chain payslip attestations (employer + employee names/roles).
 */

/** Celo Mainnet chain id. */
export const CELO_CHAIN_ID = 42220 as const;

/** TrickleVault — deposits, streams, withdrawals. Immutable, audited core. */
export const TRICKLE_VAULT_ADDRESS =
  "0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05" as const;

/** StreamRegistry — optional on-chain payslip attestations (employer-keyed). */
export const STREAM_REGISTRY_ADDRESS =
  "0x84D03930631b37Ae71A1b3c6C333ADcD32B88d99" as const;

/** Stablecoins + CELO supported by Trickle on Celo Mainnet. */
export const TOKENS = {
  cUSD: {
    symbol: "cUSD",
    address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    decimals: 18,
  },
  USDC: {
    symbol: "USDC",
    address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    decimals: 6,
  },
  USDT: {
    symbol: "USDT",
    address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    decimals: 6,
  },
  CELO: {
    symbol: "CELO",
    address: "0x471EcE3750Da237f93B8E339c536989b8978a438",
    decimals: 18,
  },
} as const;

export type TokenSymbol = keyof typeof TOKENS;

/** Celoscan explorer base URL. */
export const CELOSCAN_URL = "https://celoscan.io" as const;

/** Build a Celoscan link for an address or tx hash. */
export function celoscan(kind: "address" | "tx", value: string): string {
  return `${CELOSCAN_URL}/${kind}/${value}`;
}
