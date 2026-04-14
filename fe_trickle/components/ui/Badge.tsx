"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "warn" | "danger" | "success";

const TONE: Record<Tone, string> = {
  neutral: "text-[var(--fg-dim)] bg-[var(--color-surface-2)] border-[var(--border)]",
  accent: "text-[var(--accent-2)] bg-[var(--accent-soft)] border-[var(--accent)]/15",
  warn: "text-[var(--warn)] bg-[var(--color-warn-soft)] border-[var(--warn)]/20",
  danger: "text-[var(--danger)] bg-[var(--color-danger-soft)] border-[var(--danger)]/20",
  success: "text-[var(--success)] bg-[var(--color-success-soft)] border-[var(--success)]/20",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  dot,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium tracking-tight",
        TONE[tone],
        className,
      )}
    >
      {dot ? (
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      ) : null}
      {children}
    </span>
  );
}
