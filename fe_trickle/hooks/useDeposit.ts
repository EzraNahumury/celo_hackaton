"use client";

import { useEffect, useRef, useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ERC20_ABI, TRICKLE_VAULT_ABI, TRICKLE_VAULT_ADDRESS } from "@/config/contracts";

export type DepositPhase = "idle" | "approving" | "depositing" | "done" | "error";

export interface UseDepositReturn {
  /** Start the approve → deposit sequence */
  deposit: (tokenAddress: `0x${string}`, amount: bigint) => void;
  phase: DepositPhase;
  approveTxHash: `0x${string}` | undefined;
  depositTxHash: `0x${string}` | undefined;
  reset: () => void;
  isIdle: boolean;
  isPending: boolean;
  isDone: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Properly chains approve → deposit, waiting for each transaction
 * to be confirmed on-chain before triggering the next one.
 * Replaces the fragile setTimeout approach.
 */
export function useDeposit(): UseDepositReturn {
  const [phase, setPhase] = useState<DepositPhase>("idle");
  // Store pending params in a ref to avoid stale closures in useEffect
  const pending = useRef<{ tokenAddress: `0x${string}`; amount: bigint } | null>(null);

  // ── Step 1: approve ────────────────────────────────────────────────────────
  const {
    writeContract: doApprove,
    data: approveTxHash,
    error: approveWriteError,
    reset: resetApprove,
  } = useWriteContract();

  const { isSuccess: approveConfirmed, isError: approveReceiptFailed } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  // ── Step 2: deposit ────────────────────────────────────────────────────────
  const {
    writeContract: doDeposit,
    data: depositTxHash,
    error: depositWriteError,
    reset: resetDeposit,
  } = useWriteContract();

  const { isSuccess: depositConfirmed, isError: depositReceiptFailed } =
    useWaitForTransactionReceipt({ hash: depositTxHash });

  // ── Transition: approving → depositing ────────────────────────────────────
  useEffect(() => {
    if (phase === "approving" && approveConfirmed && pending.current) {
      setPhase("depositing");
      doDeposit({
        address: TRICKLE_VAULT_ADDRESS,
        abi: TRICKLE_VAULT_ABI,
        functionName: "deposit",
        args: [pending.current.tokenAddress, pending.current.amount],
      });
    }
  }, [approveConfirmed, phase, doDeposit]);

  // ── Transition: depositing → done ─────────────────────────────────────────
  useEffect(() => {
    if (phase === "depositing" && depositConfirmed) {
      setPhase("done");
    }
  }, [depositConfirmed, phase]);

  // ── Error handling ────────────────────────────────────────────────────────
  useEffect(() => {
    if ((approveWriteError || approveReceiptFailed) && phase === "approving") {
      setPhase("error");
    }
  }, [approveWriteError, approveReceiptFailed, phase]);

  useEffect(() => {
    if ((depositWriteError || depositReceiptFailed) && phase === "depositing") {
      setPhase("error");
    }
  }, [depositWriteError, depositReceiptFailed, phase]);

  // ── Public API ────────────────────────────────────────────────────────────

  function deposit(tokenAddress: `0x${string}`, amount: bigint) {
    pending.current = { tokenAddress, amount };
    setPhase("approving");
    doApprove({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [TRICKLE_VAULT_ADDRESS, amount],
    });
  }

  function reset() {
    pending.current = null;
    setPhase("idle");
    resetApprove();
    resetDeposit();
  }

  const error = (approveWriteError ?? depositWriteError ?? null) as Error | null;

  return {
    deposit,
    phase,
    approveTxHash,
    depositTxHash,
    reset,
    isIdle: phase === "idle",
    isPending: phase === "approving" || phase === "depositing",
    isDone: phase === "done",
    isError: phase === "error",
    error,
  };
}
