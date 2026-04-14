"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/cn";

type Tone = "default" | "soft" | "accent" | "glass";

export interface CardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  tone?: Tone;
  interactive?: boolean;
  padded?: boolean;
  children?: React.ReactNode;
}

const TONE: Record<Tone, string> = {
  default: "surface-elev",
  soft: "surface-soft",
  accent: "surface-accent-soft",
  glass: "surface-glass",
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { tone = "default", interactive = false, padded = true, className, children, ...props },
  ref,
) {
  return (
    <motion.div
      ref={ref}
      whileHover={interactive ? { y: -1 } : undefined}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn("relative", TONE[tone], padded && "p-6", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
});
