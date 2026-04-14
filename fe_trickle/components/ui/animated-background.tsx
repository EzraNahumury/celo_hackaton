"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

interface AnimatedBackgroundProps {
  className?: string;
}

/**
 * Soft ambient background for the light app theme.
 * Three slow blue-tint blobs over a pale gradient vignette, plus a masked grid.
 * Fixed full-screen, pointer-events-none, behind content.
 */
export function AnimatedBackground({ className }: AnimatedBackgroundProps) {
  return (
    <div aria-hidden className={cn("ab-root", className)}>
      <div className="ab-vignette" />
      <div className="ab-blob ab-blob-a" />
      <div className="ab-blob ab-blob-b" />
      <div className="ab-blob ab-blob-c" />
      <div className="ab-grid" />
    </div>
  );
}
