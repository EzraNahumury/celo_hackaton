"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";
type Shape = "rounded" | "pill";

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  shape?: Shape;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-white shadow-[var(--shadow-accent)] hover:bg-[var(--accent-2)] disabled:bg-[var(--accent)]/40 disabled:shadow-none",
  secondary:
    "bg-[var(--color-surface-2)] text-[var(--fg)] border border-[var(--border-strong)] hover:bg-[var(--color-surface-3)] hover:border-white/15 disabled:opacity-50",
  ghost:
    "bg-transparent text-[var(--fg-dim)] hover:bg-[var(--color-surface-2)] hover:text-[var(--fg)] disabled:opacity-50",
  danger:
    "bg-[var(--color-surface-2)] text-[var(--danger)] border border-[var(--danger)]/25 hover:bg-[var(--color-danger-soft)] hover:border-[var(--danger)]/40 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[12.5px] gap-1.5",
  md: "h-10 px-4 text-[13.5px] gap-2",
  lg: "h-12 px-6 text-[14.5px] gap-2",
};

const SHAPES: Record<Size, Record<Shape, string>> = {
  sm: { rounded: "rounded-lg", pill: "rounded-full" },
  md: { rounded: "rounded-xl", pill: "rounded-full" },
  lg: { rounded: "rounded-2xl", pill: "rounded-full" },
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      shape = "rounded",
      loading,
      leftIcon,
      rightIcon,
      className,
      disabled,
      children,
      ...props
    },
    ref,
  ) {
    const inert = disabled || loading;
    return (
      <motion.button
        ref={ref}
        whileHover={inert ? undefined : { scale: 1.015 }}
        whileTap={inert ? undefined : { scale: 0.98 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        disabled={inert}
        className={cn(
          "relative inline-flex items-center justify-center font-semibold tracking-tight",
          "transition-[background-color,border-color,color,box-shadow] duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent-ring)]",
          "disabled:cursor-not-allowed",
          SIZES[size],
          SHAPES[size][shape],
          VARIANTS[variant],
          className,
        )}
        {...props}
      >
        {loading ? (
          <Spinner />
        ) : (
          <>
            {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
            <span className="truncate">{children}</span>
            {rightIcon ? <span className="shrink-0">{rightIcon}</span> : null}
          </>
        )}
      </motion.button>
    );
  },
);

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}
