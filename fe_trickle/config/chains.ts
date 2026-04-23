import { celo } from "wagmi/chains";

export const MAINNET_ID = celo.id;
export const DEFAULT_CHAIN_ID = MAINNET_ID;

export const SUPPORTED_CHAIN_IDS: readonly number[] = [MAINNET_ID];

export const VAULT_ADDRESS = (
  process.env.NEXT_PUBLIC_TRICKLE_VAULT_ADDRESS ??
  "0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05"
) as `0x${string}`;

export const EXPLORER_URL = "https://celoscan.io";
export const CHAIN_LABEL = "Celo";

export function vaultAddressFor(): `0x${string}` {
  return VAULT_ADDRESS;
}

export function explorerFor(): string {
  return EXPLORER_URL;
}

export function chainLabelFor(): string {
  return CHAIN_LABEL;
}

export function isSupported(): boolean {
  return true;
}

export function isTestnet(): boolean {
  return false;
}