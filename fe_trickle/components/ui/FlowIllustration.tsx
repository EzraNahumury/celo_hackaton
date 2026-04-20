"use client";

import * as React from "react";
import { motion } from "framer-motion";

interface FlowIllustrationProps {
  /** px height of the block */
  height?: number;
  /** number of time-tick marks on the axis */
  ticks?: number;
  className?: string;
}

/**
 * Minimal line-art illustration for empty states. Suggests money-streaming
 * visually: a horizontal time axis with tick marks + a thin dashed line that
 * animates left → right, like a stream crossing time.
 *
 * No stock art, no neon — pure geometry in the app's accent hue.
 */
export function FlowIllustration({
  height = 84,
  ticks = 9,
  className,
}: FlowIllustrationProps) {
  const width = 220;
  const axisY = height - 18;
  const streamY = height * 0.42;

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Time axis */}
      <line
        x1="8"
        x2={width - 8}
        y1={axisY}
        y2={axisY}
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="1"
      />
      {Array.from({ length: ticks }).map((_, i) => {
        const x = 8 + ((width - 16) / (ticks - 1)) * i;
        return (
          <line
            key={i}
            x1={x}
            x2={x}
            y1={axisY - 4}
            y2={axisY}
            stroke="currentColor"
            strokeOpacity={i === Math.floor(ticks / 2) ? 0.55 : 0.25}
            strokeWidth="1"
          />
        );
      })}

      {/* Stream line — dashed, scrolling */}
      <motion.line
        x1="8"
        x2={width - 8}
        y1={streamY}
        y2={streamY}
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeWidth="1.6"
        strokeDasharray="4 6"
        initial={{ strokeDashoffset: 0 }}
        animate={{ strokeDashoffset: -60 }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
      />

      {/* Leading droplet */}
      <motion.circle
        cy={streamY}
        r="2.2"
        fill="currentColor"
        initial={{ cx: 8 }}
        animate={{ cx: width - 8 }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
      />

      {/* Now marker on axis (matches droplet travel) */}
      <motion.circle
        cy={axisY}
        r="2"
        fill="currentColor"
        fillOpacity="0.6"
        initial={{ cx: 8 }}
        animate={{ cx: width - 8 }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
      />
    </svg>
  );
}
