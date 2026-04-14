"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  trailing?: React.ReactNode;
  leading?: React.ReactNode;
  invalid?: boolean;
  mono?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    { className, trailing, leading, invalid, mono, type = "text", ...props },
    ref,
  ) {
    return (
      <div
        className={cn(
          "group relative flex items-center rounded-xl border bg-[var(--color-surface-2)] transition-[border-color,background-color,box-shadow] duration-200 ease-out",
          invalid
            ? "border-[var(--danger)]/35 focus-within:border-[var(--danger)]/55 focus-within:shadow-[0_0_0_4px_rgba(239,68,68,0.12)]"
            : "border-[var(--border)] hover:border-[var(--border-strong)] focus-within:bg-[var(--color-surface-3)] focus-within:border-[var(--accent)]/50 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.14)]",
          className,
        )}
      >
        {leading ? (
          <span className="pointer-events-none pl-3.5 text-[12.5px] text-[var(--fg-mute)]">
            {leading}
          </span>
        ) : null}
        <input
          ref={ref}
          type={type}
          className={cn(
            "peer w-full bg-transparent px-3.5 py-2.5 text-[14px] text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:outline-none",
            mono && "font-mono text-[13px]",
            leading && "pl-2",
            trailing && "pr-2",
          )}
          {...props}
        />
        {trailing ? (
          <span className="pointer-events-none pr-3.5 text-[12.5px] text-[var(--fg-mute)]">
            {trailing}
          </span>
        ) : null}
      </div>
    );
  },
);
