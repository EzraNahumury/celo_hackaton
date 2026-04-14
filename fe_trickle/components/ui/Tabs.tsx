"use client";

import * as React from "react";
import { motion, LayoutGroup } from "framer-motion";
import { cn } from "@/lib/cn";

export interface TabItem {
  value: string;
  label: React.ReactNode;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  id?: string;
  className?: string;
}

export function Tabs({
  items,
  value,
  onChange,
  size = "md",
  id,
  className,
}: TabsProps) {
  const layoutId = React.useId();
  const groupId = id ?? layoutId;

  const h = size === "sm" ? "h-8 text-[12px] px-3.5" : "h-9 text-[12.5px] px-4";

  return (
    <LayoutGroup id={groupId}>
      <div
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--color-surface-2)] p-1",
          className,
        )}
      >
        {items.map((t) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              onClick={() => onChange(t.value)}
              className={cn(
                "relative rounded-full font-medium tracking-tight transition-colors duration-200",
                h,
                active ? "text-white" : "text-[var(--fg-mute)] hover:text-[var(--fg-dim)]",
              )}
            >
              {active && (
                <motion.span
                  layoutId={`tab-${groupId}`}
                  className="absolute inset-0 rounded-full bg-[var(--accent)]"
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
