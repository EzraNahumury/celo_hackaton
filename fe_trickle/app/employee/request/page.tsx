"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Check, Share2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { ConnectWalletPrompt } from "@/components/ConnectWalletPrompt";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useChainTokenList } from "@/hooks/useChain";
import { TokenSelector } from "@/components/TokenSelector";
import { buildPaymentRequestUrl } from "@/lib/invoiceLink";

export default function RequestPaymentPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const TOKEN_LIST = useChainTokenList();

  const [amount, setAmount] = useState("");
  const [token, setToken] = useState(TOKEN_LIST[0]?.symbol ?? "USDm");
  const [desc, setDesc] = useState("");
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);

  if (!isConnected || !address) {
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
          <ConnectWalletPrompt
            eyebrow="Sign in required"
            title="Connect to request payment"
            body="Link your Celo wallet to generate a payment request link for your employer."
          />
        </div>
      </DashboardLayout>
    );
  }

  const amountNum = Number(amount);
  const isValid = amountNum > 0 && Number.isFinite(amountNum) && !!token;
  const perSec = amountNum > 0 ? amountNum / 2592000 : 0;

  function handleGenerate() {
    if (!isValid) return;
    const path = buildPaymentRequestUrl({
      to: address as `0x${string}`,
      amount,
      token,
      desc: desc.trim() || undefined,
    });
    const full = `${window.location.origin}${path}`;
    setGenerated(full);
  }

  async function handleCopy() {
    if (!generated) return;
    await navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!generated) return;
    const text = `Payment request: ${desc.trim() || `${amount} ${token}/mo`}\n${generated}`;
    if (navigator.share) {
      navigator.share({ title: "Payment Request", text, url: generated }).catch(() => {});
    } else {
      await handleCopy();
    }
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

        <div className="mb-7">
          <h1 className="font-display text-[26px] font-semibold leading-[1.2] tracking-[-0.02em] text-[var(--fg)]">
            Request payment
          </h1>
          <p className="mt-1.5 text-[13.5px] text-[var(--fg-mute)]">
            Generate a link to send your employer. They open it and your stream starts automatically.
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--fg-mute)]">
              Your wallet
            </label>
            <div className="flex h-11 items-center rounded-xl border border-[var(--border)] bg-[var(--color-surface)] px-3">
              <span className="font-mono text-[12.5px] text-[var(--fg-dim)]">
                {address.slice(0, 10)}…{address.slice(-8)}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--fg-mute)]">
              Token
            </label>
            <TokenSelector tokens={TOKEN_LIST} selected={token} onChange={setToken} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--fg-mute)]">
                Monthly amount
              </label>
              {amountNum > 0 && (
                <span className="text-[11px] text-[var(--fg-faint)]">
                  {perSec.toFixed(8)} {token}/sec
                </span>
              )}
            </div>
            <Input
              type="number"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setGenerated(null); }}
              placeholder="1,500"
              trailing={`${token}/mo`}
              min="0"
            />
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--fg-mute)]">
              Description{" "}
              <span className="normal-case text-[var(--fg-faint)]">(optional)</span>
            </label>
            <Input
              value={desc}
              onChange={(e) => { setDesc(e.target.value); setGenerated(null); }}
              placeholder="May 2026 salary"
            />
          </div>

          {!generated ? (
            <Button onClick={handleGenerate} disabled={!isValid} className="w-full">
              Generate payment link
            </Button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <div className="rounded-xl border border-[var(--success)]/30 bg-[var(--success)]/5 px-4 py-3">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--success)]/70">
                  Payment link ready
                </p>
                <p className="break-all font-mono text-[11px] text-[var(--fg-dim)]">
                  {generated}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={handleCopy}
                  leftIcon={copied ? <Check size={13} /> : <Copy size={13} />}
                  className="flex-1"
                >
                  {copied ? "Copied!" : "Copy link"}
                </Button>
                <Button
                  onClick={handleShare}
                  leftIcon={<Share2 size={13} />}
                  className="flex-1"
                >
                  Share
                </Button>
              </div>
              <button
                onClick={() => setGenerated(null)}
                className="w-full text-center text-[12px] text-[var(--fg-faint)] hover:text-[var(--fg-mute)] transition-colors"
              >
                Edit details
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
