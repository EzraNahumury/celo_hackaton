import { celo } from "wagmi/chains";
import { celoSepolia } from "./wagmi";

export const MAINNET_ID = celo.id;
export const SEPOLIA_ID = celoSepolia.id;

/** Primary chain the app is pointed at. Wallet can still switch to Sepolia. */
export const DEFAULT_CHAIN_ID = MAINNET_ID;

export const SUPPORTED_CHAIN_IDS: readonly number[] = [MAINNET_ID, SEPOLIA_ID];

/** TrickleVault per chain. Override with NEXT_PUBLIC_TRICKLE_VAULT_ADDRESS_<ID>. */
export const VAULT_ADDRESS_BY_CHAIN: Record<number, `0x${string}`> = {
  [MAINNET_ID]:
    (process.env.NEXT_PUBLIC_TRICKLE_VAULT_ADDRESS_MAINNET as `0x${string}`) ??
    "0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05",
  [SEPOLIA_ID]:
    (process.env.NEXT_PUBLIC_TRICKLE_VAULT_ADDRESS_SEPOLIA as `0x${string}`) ??
    "0x42cADdd47E795A6e04d820A6c140AF04159C7542",
};

export const EXPLORER_URL_BY_CHAIN: Record<number, string> = {
  [MAINNET_ID]: "https://celoscan.io",
  [SEPOLIA_ID]: "https://sepolia.celoscan.io",
};

export const CHAIN_LABEL_BY_ID: Record<number, string> = {
  [MAINNET_ID]: "Celo",
  [SEPOLIA_ID]: "Celo Sepolia",
};

export function vaultAddressFor(chainId?: number): `0x${string}` {
  if (chainId && VAULT_ADDRESS_BY_CHAIN[chainId]) return VAULT_ADDRESS_BY_CHAIN[chainId];
  return VAULT_ADDRESS_BY_CHAIN[DEFAULT_CHAIN_ID];
}

export function explorerFor(chainId?: number): string {
  if (chainId && EXPLORER_URL_BY_CHAIN[chainId]) return EXPLORER_URL_BY_CHAIN[chainId];
  return EXPLORER_URL_BY_CHAIN[DEFAULT_CHAIN_ID];
}

export function chainLabelFor(chainId?: number): string {
  if (chainId && CHAIN_LABEL_BY_ID[chainId]) return CHAIN_LABEL_BY_ID[chainId];
  return CHAIN_LABEL_BY_ID[DEFAULT_CHAIN_ID];
}

export function isSupported(chainId?: number): boolean {
  return !!chainId && SUPPORTED_CHAIN_IDS.includes(chainId);
}

export function isTestnet(chainId?: number): boolean {
  return chainId === SEPOLIA_ID;
}
