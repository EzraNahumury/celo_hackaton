"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

interface AnimatedBackgroundProps {
  className?: string;
}

/**
 * Global app background: pure black + animated topographic contour lines.
 * Two parallax layers that morph (feTurbulence baseFrequency animation) and
 * drift (animateTransform translate) on different periods — used behind every
 * page via app/layout.tsx.
 */
export function AnimatedBackground({ className }: AnimatedBackgroundProps) {
  return (
    <div
      aria-hidden
      className={cn("fixed inset-0 z-0 overflow-hidden", className)}
      style={{ background: "#000000" }}
    >
      <TopographicBackground />
    </div>
  );
}

function TopographicBackground() {
  return (
    <svg
      aria-hidden
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 400 800"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <filter
          id="topo-warp"
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.005"
            numOctaves="2"
            seed="9"
          >
            <animate
              attributeName="baseFrequency"
              dur="24s"
              values="0.0045;0.0065;0.0040;0.0055;0.0045"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="220" />
        </filter>
        <filter
          id="topo-warp-2"
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.003"
            numOctaves="2"
            seed="3"
          >
            <animate
              attributeName="baseFrequency"
              dur="36s"
              values="0.0030;0.0045;0.0025;0.0035;0.0030"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="260" />
        </filter>
      </defs>

      {/* Back layer — softer, thicker halo lines, slower drift */}
      <g
        filter="url(#topo-warp-2)"
        fill="none"
        stroke="rgba(255,255,255,0.09)"
        strokeWidth="1.4"
      >
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; -10 6; 4 -4; 8 4; 0 0"
          dur="48s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines="0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1"
        />
        {Array.from({ length: 14 }).map((_, i) => (
          <ellipse
            key={`b-${i}`}
            cx="200"
            cy="420"
            rx={60 + i * 34}
            ry={60 + i * 34}
          />
        ))}
      </g>

      {/* Front layer — crisper lines, opposite drift for parallax */}
      <g
        filter="url(#topo-warp)"
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1"
      >
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; 6 -4; -4 4; -6 -2; 0 0"
          dur="32s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines="0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1"
        />
        {Array.from({ length: 24 }).map((_, i) => (
          <ellipse
            key={`f-${i}`}
            cx="200"
            cy="400"
            rx={24 + i * 22}
            ry={24 + i * 22}
          />
        ))}
      </g>
    </svg>
  );
}
