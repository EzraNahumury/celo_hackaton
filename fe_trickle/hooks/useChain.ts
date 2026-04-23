"use client";

import {
  vaultAddressFor,
  explorerFor,
  chainLabelFor,
  isSupported,
} from "@/config/chains";
import { tokensFor, tokenListFor, type TokenInfo } from "@/config/tokens";

export function useVaultAddress(): `0x${string}` {
  return vaultAddressFor();
}

export function useChainTokens(): Record<string, TokenInfo> {
  return tokensFor();
}

export function useChainTokenList(): TokenInfo[] {
  return tokenListFor();
}

export function useExplorerUrl(): string {
  return explorerFor();
}

export function useChainLabel(): string {
  return chainLabelFor();
}

export function useIsSupportedChain(): boolean {
  return isSupported();
}

export function useIsTestnet(): boolean {
  return false;
}

export { DEFAULT_CHAIN_ID } from "@/config/chains";