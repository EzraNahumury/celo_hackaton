"use client";

import { useChainId } from "wagmi";
import {
  vaultAddressFor,
  explorerFor,
  chainLabelFor,
  isSupported,
  isTestnet,
  DEFAULT_CHAIN_ID,
} from "@/config/chains";
import { tokensFor, tokenListFor, type TokenInfo } from "@/config/tokens";

/** TrickleVault address for the wallet's current chain (mainnet default). */
export function useVaultAddress(): `0x${string}` {
  const chainId = useChainId();
  return vaultAddressFor(chainId ?? DEFAULT_CHAIN_ID);
}

/** Token map keyed by symbol for the wallet's current chain. */
export function useChainTokens(): Record<string, TokenInfo> {
  const chainId = useChainId();
  return tokensFor(chainId ?? DEFAULT_CHAIN_ID);
}

/** Token list for the wallet's current chain. */
export function useChainTokenList(): TokenInfo[] {
  const chainId = useChainId();
  return tokenListFor(chainId ?? DEFAULT_CHAIN_ID);
}

/** Celoscan root URL for the current chain. */
export function useExplorerUrl(): string {
  const chainId = useChainId();
  return explorerFor(chainId ?? DEFAULT_CHAIN_ID);
}

/** Human-readable chain label ("Celo" / "Celo Sepolia"). */
export function useChainLabel(): string {
  const chainId = useChainId();
  return chainLabelFor(chainId ?? DEFAULT_CHAIN_ID);
}

/** True if the current chain is one we ship against. */
export function useIsSupportedChain(): boolean {
  const chainId = useChainId();
  return isSupported(chainId);
}

/** True if the current chain is Sepolia (faucet / testnet affordances). */
export function useIsTestnet(): boolean {
  const chainId = useChainId();
  return isTestnet(chainId);
}
