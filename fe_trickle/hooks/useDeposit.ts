"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ERC20_ABI, TRICKLE_VAULT_ABI } from "@/config/contracts";
import { useVaultAddress } from "./useChain";

/**
 * Lifecycle of a two-step deposit flow.
 *
 * - `idle` — no deposit in flight; safe to call `deposit()`
 * - `approving` — ERC20.approve sent, waiting for receipt
 * - `depositing` — Vault.deposit sent (auto-triggered after approve confirms),
 *   waiting for receipt
 * - `done` — both tx confirmed; consumer should refresh balances and `reset()`
 * - `error` — either approve or deposit reverted/failed; consumer should
 *   surface `error` and call `reset()`
 */
export type DepositPhase = "idle" | "approving" | "depositing" | "done" | "error";

/** Surface area of {@link useDeposit}. */
export interface UseDepositReturn {
  /** Kick off the flow. Calling this while a deposit is in flight is a no-op
   *  on the contract side but will queue a new approve — prefer to wait for
   *  `isDone` or call `reset()` between invocations. */
  deposit: (tokenAddress: `0x${string}`, amount: bigint) => void;
  /** Current lifecycle phase — see {@link DepositPhase}. */
  phase: DepositPhase;
  /** Tx hash of the approve, present once the wallet returns it. */
  approveTxHash: `0x${string}` | undefined;
  /** Tx hash of the deposit, present once the wallet returns it. */
  depositTxHash: `0x${string}` | undefined;
  /** Clears all internal state and underlying wagmi mutations. Call this on
   *  successful completion or after handling an error to return to `idle`. */
  reset: () => void;
  isIdle: boolean;
  /** True for both `approving` and `depositing` phases. */
  isPending: boolean;
  isDone: boolean;
  isError: boolean;
  /** Whichever underlying mutation surfaced an error first. */
  error: Error | null;
}

/**
 * Two-step deposit into TrickleVault: ERC20.approve then Vault.deposit.
 *
 * The hook owns the orchestration — it watches the approve receipt and
 * automatically fires the deposit when it confirms, so consumers see a single
 * `phase` state machine instead of juggling two wagmi mutations.
 *
 * Tx hashes are surfaced as soon as the wallet returns them so toasts can
 * link out to the explorer immediately.
 */
export function useDeposit(): UseDepositReturn {
  const TRICKLE_VAULT_ADDRESS = useVaultAddress();
  const [phase, setPhase] = useState<DepositPhase>("idle");
  const [pendingAmount, setPendingAmount] = useState<bigint | null>(null);
  const [pendingToken, setPendingToken] = useState<`0x${string}` | null>(null);
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>(undefined);
  const [depositHash, setDepositHash] = useState<`0x${string}` | undefined>(undefined);

  const {
    writeContract: doApprove,
    data: aHash,
    error: approveWriteError,
    reset: resetApprove,
  } = useWriteContract();

  const { isSuccess: approveConfirmed, isError: approveReceiptFailed } =
    useWaitForTransactionReceipt({ hash: approveHash, pollingInterval: 1_500 });

  const {
    writeContract: doDeposit,
    data: dHash,
    error: depositWriteError,
    reset: resetDeposit,
  } = useWriteContract();

  const { isSuccess: depositConfirmed, isError: depositReceiptFailed } =
    useWaitForTransactionReceipt({ hash: depositHash, pollingInterval: 1_500 });

  if (aHash !== undefined && aHash !== approveHash) setApproveHash(aHash);
  if (dHash !== undefined && dHash !== depositHash) setDepositHash(dHash);

  if (approveConfirmed && phase === "approving" && pendingToken && pendingAmount) {
    setPhase("depositing");
    doDeposit({
      address: TRICKLE_VAULT_ADDRESS,
      abi: TRICKLE_VAULT_ABI,
      functionName: "deposit",
      args: [pendingToken, pendingAmount],
    });
  }

  if (depositConfirmed && phase === "depositing") {
    setPhase("done");
  }

  if ((approveWriteError || approveReceiptFailed) && phase === "approving") {
    setPhase("error");
  }
  if ((depositWriteError || depositReceiptFailed) && phase === "depositing") {
    setPhase("error");
  }

  function deposit(tokenAddress: `0x${string}`, amount: bigint) {
    setPendingToken(tokenAddress);
    setPendingAmount(amount);
    setPhase("approving");
    doApprove({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [TRICKLE_VAULT_ADDRESS, amount],
    });
  }

  function reset() {
    setPendingToken(null);
    setPendingAmount(null);
    setPhase("idle");
    resetApprove();
    resetDeposit();
  }

  const error = (approveWriteError ?? depositWriteError ?? null) as Error | null;

  return {
    deposit,
    phase,
    approveTxHash: approveHash,
    depositTxHash: depositHash,
    reset,
    isIdle: phase === "idle",
    isPending: phase === "approving" || phase === "depositing",
    isDone: phase === "done",
    isError: phase === "error",
    error,
  };
}
