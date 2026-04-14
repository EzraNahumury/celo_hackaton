"use client";

import * as React from "react";

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

/**
 * Smoothly tweens to the target value with rAF.
 * Re-eases on every value change. Uses an ease-out cubic.
 */
export function AnimatedNumber({
  value,
  decimals = 2,
  duration = 700,
  className,
  prefix,
  suffix,
}: AnimatedNumberProps) {
  const [display, setDisplay] = React.useState<number>(value);
  const fromRef = React.useRef(value);
  const toRef = React.useRef(value);
  const startRef = React.useRef<number | null>(null);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    fromRef.current = display;
    toRef.current = value;
    startRef.current = null;

    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next =
        fromRef.current + (toRef.current - fromRef.current) * eased;
      setDisplay(next);
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return (
    <span className={className} suppressHydrationWarning>
      {prefix}
      {display.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/**
 * A ticker that increments at a fixed rate-per-second with rAF smoothness.
 * Use this for live streaming counters — not for server-driven values.
 */
export function StreamTicker({
  ratePerSec,
  decimals = 6,
  startValue = 0,
  className,
  suffix,
}: {
  ratePerSec: number;
  decimals?: number;
  startValue?: number;
  className?: string;
  suffix?: string;
}) {
  const [val, setVal] = React.useState(startValue);
  const startedAt = React.useRef<number | null>(null);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    startedAt.current = performance.now();
    const base = startValue;
    const tick = (t: number) => {
      const elapsed = (t - (startedAt.current ?? t)) / 1000;
      setVal(base + ratePerSec * elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [ratePerSec, startValue]);

  return (
    <span className={className} suppressHydrationWarning>
      {val.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
