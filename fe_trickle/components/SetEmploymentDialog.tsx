"use client";

import * as React from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { STREAM_REGISTRY_ABI, STREAM_REGISTRY_ADDRESS } from "@/config/contracts";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/Toast";

/**
 * Employer attests an employee's payslip details (name / role / memo) on-chain
 * for a given payee. Caller is the employer (msg.sender keyed in the contract).
 * Values are public + permanent on Celo → explicit consent required.
 */
export function SetEmploymentDialog({ payee }: { payee: `0x${string}` }) {
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState("");
  const [memo, setMemo] = React.useState("");
  const [ack, setAck] = React.useState(false);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  React.useEffect(() => {
    if (isSuccess) {
      toast({ type: "success", message: "Payslip details saved on-chain" });
      setAck(false);
    }
  }, [isSuccess, toast]);

  const enc = (s: string) => new TextEncoder().encode(s).length;
  const invalid = enc(name) > 32 || enc(role) > 32 || enc(memo) > 64;

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--color-surface)] p-3">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Employee name (≤32)" />
      <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (≤32)" />
      <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Memo (≤64)" />
      {invalid && (
        <p className="text-[11.5px] text-[var(--danger,#dc2626)]">
          Name/role ≤32 bytes, memo ≤64 bytes.
        </p>
      )}
      <label className="flex items-start gap-2 text-[11.5px] text-[var(--fg-mute)]">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Published <strong>publicly &amp; permanently</strong> on Celo; cannot be deleted.
        </span>
      </label>
      <Button
        shape="pill"
        className="w-full"
        disabled={!name || invalid || !ack || isPending}
        loading={isPending}
        onClick={() =>
          writeContract({
            address: STREAM_REGISTRY_ADDRESS,
            abi: STREAM_REGISTRY_ABI,
            functionName: "setEmployment",
            args: [payee, name, role, memo],
          })
        }
      >
        Save payslip details
      </Button>
    </div>
  );
}
