"use client";

import * as React from "react";

interface MiniChartProps {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  className?: string;
  strokeWidth?: number;
}

/**
 * Lightweight SVG area chart. Normalizes `values` to the viewBox and draws
 * a smooth line + filled area. No axes, no ticks — a sparkline-style figure.
 */
export function MiniChart({
  values,
  width = 600,
  height = 160,
  stroke = "var(--color-accent)",
  fill = "rgba(99, 102, 241, 0.22)",
  className,
  strokeWidth = 1.8,
}: MiniChartProps) {
  const path = React.useMemo(() => buildPath(values, width, height), [
    values,
    width,
    height,
  ]);
  const area = React.useMemo(
    () => `${path} L ${width} ${height} L 0 ${height} Z`,
    [path, width, height],
  );

  const gradId = React.useId();

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className ?? "h-full w-full"}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function buildPath(values: number[], w: number, h: number): string {
  if (values.length === 0) return `M 0 ${h} L ${w} ${h}`;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padY = h * 0.08;
  const innerH = h - padY * 2;
  const step = values.length > 1 ? w / (values.length - 1) : w;

  const points = values.map((v, i) => {
    const x = i * step;
    const y = h - padY - ((v - min) / range) * innerH;
    return [x, y] as const;
  });

  // Smooth via Catmull-Rom to Bezier
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? points[i + 1];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}
