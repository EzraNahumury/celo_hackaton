"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

interface AnimatedBackgroundProps {
  className?: string;
}

export function AnimatedBackground({ className }: AnimatedBackgroundProps) {
  return (
    <div
      aria-hidden
      className={cn("fixed inset-0 z-0", className)}
      style={{ background: "#000000" }}
    />
  );
}
