"use client";

import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { formatUnits } from "viem";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { TRICKLE_VAULT_ABI, TRICKLE_VAULT_ADDRESS } from "@/config/contracts";
import StreamCard from "@/components/StreamCard";
import DashboardLayout from "@/components/DashboardLayout";

type Stream = {
  payer: string; payee: string; token: string;
  amountPerSec: bigint; lastPaid: number; startTime: number;
};

export default function EmployeeDashboard() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: streamIds } = useReadContract({
    address: TRICKLE_VAULT_ADDRESS, abi: TRICKLE_VAULT_ABI,
    functionName: "getPayeeStreamIds",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const streamCalls = (streamIds ?? []).map((id: `0x${string}`) => ({
    address: TRICKLE_VAULT_ADDRESS, abi: TRICKLE_VAULT_ABI,
    functionName: "getStream" as const, args: [id] as const,
  }));

  const { data: streamResults } = useReadContracts({
    contracts: streamCalls,
    query: { enabled: streamCalls.length > 0 },
  });

  const streams: Stream[] = (streamResults ?? [])
    .filter((r) => r.status === "success" && r.result)
    .map((r) => {
      const s = r.result as unknown as {
        payer: string; payee: string; token: string;
        amountPerSec: bigint; lastPaid: bigint; startTime: bigint;
      };
      return {
        payer: s.payer, payee: s.payee, token: s.token,
        amountPerSec: s.amountPerSec,
        lastPaid: Number(s.lastPaid), startTime: Number(s.startTime),
      };
    })
    .filter((s) => s.startTime > 0);

  const totalWithdrawable = streams.reduce((acc, s) => {
    const elapsed = BigInt(Math.max(0, now - s.lastPaid));
    return acc + s.amountPerSec * elapsed;
  }, 0n);

  const totalMonthly = streams.reduce((acc, s) => acc + s.amountPerSec * 2592000n, 0n);

  const { writeContract: withdraw, isPending: isWithdrawPending } = useWriteContract();

  function handleWithdraw(stream: Stream) {
    withdraw({
      address: TRICKLE_VAULT_ADDRESS, abi: TRICKLE_VAULT_ABI,
      functionName: "withdraw",
      args: [stream.payer as `0x${string}`, stream.token as `0x${string}`, stream.amountPerSec],
    });
  }

  if (!isConnected) { router.push("/"); return null; }

  return (
    <DashboardLayout>
    <div className="mx-auto max-w-xl px-6 py-10">
      <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8 text-xl font-semibold text-white">
        Employee
      </motion.h1>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-8 grid grid-cols-2 gap-3">
        <div className="card-highlight p-5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[#35D07F]/50 mb-2">Withdrawable</p>
          <p className="font-mono text-xl font-semibold text-[#35D07F] tabular-nums">
            {streams.length > 0 ? parseFloat(formatUnits(totalWithdrawable, 18)).toFixed(6) : "0.000000"}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-gray-600 mb-2">Monthly Income</p>
          <p className="text-xl font-semibold text-white tabular-nums">
            {streams.length > 0 ? parseFloat(formatUnits(totalMonthly, 18)).toFixed(2) : "0.00"}
          </p>
        </div>
      </motion.div>

      {/* Streams */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
        <p className="mb-4 text-[13px] text-gray-500">
          Incoming streams <span className="text-gray-700">({streams.length})</span>
        </p>

        {streams.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-[13px] text-gray-600">No incoming streams</p>
            <p className="mt-1 text-[12px] text-gray-700">Ask your employer to create a stream to your address</p>
          </div>
        ) : (
          <div className="space-y-3">
            {streams.map((s, i) => (
              <StreamCard key={i} {...s} role="payee" onWithdraw={() => handleWithdraw(s)} isPending={isWithdrawPending} />
            ))}
          </div>
        )}
      </motion.div>

      {/* Address */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-10 text-center">
        <p className="text-[10px] uppercase tracking-[0.12em] text-gray-700 mb-1.5">Your address</p>
        <p className="font-mono text-[11px] text-gray-600 break-all">{address}</p>
      </motion.div>
    </div>
    </DashboardLayout>
  );
}
