"use client";

import * as React from "react";
import { Card } from "./Card";
import { cn } from "@/lib/cn";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  caption,
  icon,
  trailing,
  className,
}: StatCardProps) {
  return (
    <Card padded={false} className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2.5 flex items-center gap-2 text-[12px] font-medium text-[var(--fg-mute)]">
            {icon ? <span className="opacity-90">{icon}</span> : null}
            <span>{label}</span>
          </div>
          <div className="font-display text-[26px] font-semibold leading-none tracking-[-0.02em] tabular text-[var(--fg)]">
            {value}
          </div>
          {caption ? (
            <div className="mt-2 text-[13px] text-[var(--fg-mute)]">{caption}</div>
          ) : null}
        </div>
        {trailing}
      </div>
    </Card>
  );
}
