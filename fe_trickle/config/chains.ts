import { celo } from "wagmi/chains";
import {
  TRICKLE_VAULT_ADDRESS as SDK_TRICKLE_VAULT_ADDRESS,
  CELOSCAN_URL,
} from "trickle-sdk";

export const MAINNET_ID = celo.id;
export const DEFAULT_CHAIN_ID = MAINNET_ID;

export const SUPPORTED_CHAIN_IDS: readonly number[] = [MAINNET_ID];

export const VAULT_ADDRESS = (
  process.env.NEXT_PUBLIC_TRICKLE_VAULT_ADDRESS ??
  SDK_TRICKLE_VAULT_ADDRESS
) as `0x${string}`;

export const EXPLORER_URL = CELOSCAN_URL;
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