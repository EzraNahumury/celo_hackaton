"use client";

import * as React from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { STREAM_REGISTRY_ABI, STREAM_REGISTRY_ADDRESS } from "@/config/contracts";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/Toast";

/**
 * Employer sets their company name on-chain (StreamRegistry). The name renders
 * as the verified employer on every team payslip. Names are public + permanent
 * on Celo, so writing requires explicit consent.
 */
export function SetEmployerNameCard() {
  const { address } = useAccount();
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [ack, setAck] = React.useState(false);

  const { data: current, refetch } = useReadContract({
    address: STREAM_REGISTRY_ADDRESS,
    abi: STREAM_REGISTRY_ABI,
    functionName: "getEmployerName",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  React.useEffect(() => {
    if (isSuccess) {
      toast({ type: "success", message: "Company name set on-chain" });
      setName("");
      setAck(false);
      refetch();
    }
  }, [isSuccess, toast, refetch]);

  const tooLong = new TextEncoder().encode(name).length > 32;
  const onChainName = typeof current === "string" && current ? current : "";

  return (
    <Card padded={false} className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-faint)]">
        Company name {onChainName ? "· on-chain ✓" : ""}
      </p>
      <p className="mt-1 mb-3 text-[12px] text-[var(--fg-mute)]">
        Appears as the verified employer on your team&apos;s payslips.
      </p>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={onChainName || "e.g. Acme Corp"}
      />
      {tooLong && <p className="mt-1 text-[11.5px] text-[var(--danger,#dc2626)]">Max 32 bytes.</p>}
      <label className="mt-3 flex items-start gap-2 text-[11.5px] text-[var(--fg-mute)]">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I understand this name is published <strong>publicly and permanently</strong> on Celo
          and cannot be deleted.
        </span>
      </label>
      <Button
        shape="pill"
        className="mt-3 w-full"
        disabled={!name || tooLong || !ack || isPending || !address}
        loading={isPending}
        onClick={() =>
          writeContract({
            address: STREAM_REGISTRY_ADDRESS,
            abi: STREAM_REGISTRY_ABI,
            functionName: "setEmployerName",
            args: [name],
          })
        }
      >
        Set company name on-chain
      </Button>
    </Card>
  );
}
