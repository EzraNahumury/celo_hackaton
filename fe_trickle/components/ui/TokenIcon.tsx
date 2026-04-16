"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";

type Fallback = { bg: string; fg: string };

interface TokenIconProps {
  symbol: string;
  icon?: string;
  size?: number;
  rounded?: "full" | "xl" | "lg";
  fallback?: Fallback;
  className?: string;
}

export function TokenIcon({
  symbol,
  icon,
  size = 40,
  rounded = "xl",
  fallback,
  className,
}: TokenIconProps) {
  const radius =
    rounded === "full" ? "rounded-full" : rounded === "lg" ? "rounded-lg" : "rounded-xl";

  if (icon) {
    return (
      <span
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden bg-white/[0.04]",
          radius,
          className,
        )}
        style={{ width: size, height: size }}
      >
        <Image
          src={icon}
          alt={symbol}
          width={size}
          height={size}
          className="h-full w-full object-contain"
          unoptimized
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center font-bold",
        radius,
        className,
      )}
      style={{
        width: size,
        height: size,
        background: fallback?.bg ?? "#252A3D",
        color: fallback?.fg ?? "#B8BECE",
        fontSize: Math.round(size * 0.38),
      }}
    >
      {symbol[0]}
    </span>
  );
}
