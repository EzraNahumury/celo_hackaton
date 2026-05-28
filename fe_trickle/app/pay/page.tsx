"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, AlertTriangle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { parsePaymentRequestUrl } from "@/lib/invoiceLink";

export default function PayPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const request = useMemo(
    () => parsePaymentRequestUrl(searchParams),
    [searchParams],
  );

  const perSec = request ? Number(request.amount) / 2592000 : 0;

  if (!request) {
    return (
      <DashboardLayout>
        <div className="mx-auto w-full max-w-[460px] px-5 pt-4">
          <button
            onClick={() => router.back()}
            className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-[var(--fg-mute)] transition-colors hover:text-[var(--fg)]"
          >
            <ArrowLeft size={13} />
            Back
          </button>
          <div className="flex items-start gap-3 rounded-xl border border-[var(--warn)]/20 bg-[var(--warn)]/5 px-4 py-4">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[var(--warn)]" />
            <div>
              <p className="text-[14px] font-semibold text-[var(--fg)]">Invalid payment link</p>
              <p className="mt-1 text-[13px] text-[var(--fg-mute)]">
                This link is missing required information. Ask the sender to generate a new one.
              </p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  function handleOpenStream() {
    const params = new URLSearchParams({
      to: request!.to,
      amount: request!.amount,
      token: request!.token,
    });
    router.push(`/employer/create?${params.toString()}`);
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[460px] px-5">
        <button
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-[var(--fg-mute)] transition-colors hover:text-[var(--fg)]"
        >
          <ArrowLeft size={13} />
          Back
        </button>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-6">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--fg-mute)]">
              Payment request
            </p>
            <h1 className="font-display text-[26px] font-semibold leading-[1.2] tracking-[-0.02em] text-[var(--fg)]">
              {request.desc || `${request.amount} ${request.token}/mo`}
            </h1>
          </div>

          <div className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--color-surface)]">
            <Row label="Recipient" value={
              <span className="font-mono text-[12.5px]">
                {request.to.slice(0, 10)}…{request.to.slice(-8)}
              </span>
            } />
            <Row label="Monthly" value={
              <span className="font-mono tabular">
                {Number(request.amount).toLocaleString()} {request.token}
              </span>
            } />
            <Row label="Per second" value={
              <span className="font-mono tabular text-[var(--accent-3)]">
                {perSec.toFixed(8)} {request.token}
              </span>
            } />
            <Row label="Token" value={request.token} />
            {request.desc && (
              <Row label="Description" value={request.desc} />
            )}
          </div>

          <p className="mt-4 text-[12.5px] text-[var(--fg-mute)]">
            Opening a stream will pay this recipient automatically, every second. You can cancel anytime.
          </p>

          <div className="mt-6">
            <Button
              onClick={handleOpenStream}
              rightIcon={<ArrowRight size={14} />}
              className="w-full"
            >
              Open stream — {Number(request.amount).toLocaleString()} {request.token}/mo
            </Button>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 text-[13px]">
      <span className="text-[var(--fg-mute)]">{label}</span>
      <span className="text-[var(--fg)]">{value}</span>
    </div>
  );
}
