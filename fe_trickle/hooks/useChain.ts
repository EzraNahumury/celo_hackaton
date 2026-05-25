"use client";

import {
  vaultAddressFor,
  explorerFor,
  chainLabelFor,
  isSupported,
} from "@/config/chains";
import { tokensFor, tokenListFor, type TokenInfo } from "@/config/tokens";

/**
 * Returns the TrickleVault contract address for the active chain.
 *
 * Thin client wrapper over `vaultAddressFor()` so components don't need to
 * import the chain config directly. The app is mainnet-only today, but the
 * indirection keeps the call site stable if multi-chain selection lands.
 */
export function useVaultAddress(): `0x${string}` {
  return vaultAddressFor();
}

/**
 * Returns the token registry for the active chain keyed by symbol
 * (e.g. `tokens.USDC`). Use this when you need to look up a token by symbol.
 *
 * For ordered iteration prefer {@link useChainTokenList}.
 */
export function useChainTokens(): Record<string, TokenInfo> {
  return tokensFor();
}

/**
 * Returns the active chain's tokens as an ordered array — preferred for
 * rendering selectors and lists. Order is significant; the first entry is
 * treated as the default token by dashboards.
 */
export function useChainTokenList(): TokenInfo[] {
  return tokenListFor();
}

/**
 * Returns the block explorer base URL for the active chain (no trailing slash).
 * Build links as `${explorerUrl}/tx/${hash}` or `${explorerUrl}/address/${addr}`.
 */
export function useExplorerUrl(): string {
  return explorerFor();
}

/**
 * Returns a human-readable label for the active chain (e.g. "Celo Mainnet").
 * Used by ProfileSheet and other surfaces that show the connected network.
 */
export function useChainLabel(): string {
  return chainLabelFor();
}

/**
 * Returns true when the wallet is connected to a chain this app supports.
 * Gate write actions behind this to avoid sending tx on an unintended chain.
 */
export function useIsSupportedChain(): boolean {
  return isSupported();
}

/**
 * Returns true when the active chain is a testnet. Currently always false —
 * the production app is mainnet-only.
 */
export function useIsTestnet(): boolean {
  return false;
}

export { DEFAULT_CHAIN_ID } from "@/config/chains";