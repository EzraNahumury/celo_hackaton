"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ERC20_ABI, TRICKLE_VAULT_ABI } from "@/config/contracts";
import { useVaultAddress } from "./useChain";

export type DepositPhase = "idle" | "approving" | "depositing" | "done" | "error";

export interface UseDepositReturn {
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
