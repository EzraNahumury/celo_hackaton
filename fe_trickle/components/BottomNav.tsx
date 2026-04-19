"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  motion,
  LayoutGroup,
  useMotionValue,
  useMotionTemplate,
  useTransform,
  animate,
  AnimatePresence,
} from "framer-motion";
import { Home, Wallet, Download, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface Item {
  href?: string;
  icon: LucideIcon;
  label: string;
  match: (pathname: string) => boolean;
  onClick?: () => void;
}

interface BottomNavProps {
  onProfile?: () => void;
}

interface Ripple {
  x: number;
  y: number;
  id: number;
}

const BASE_R = 26;

// Two spring profiles — press snaps, release bounces
const PRESS = { type: "spring" as const, stiffness: 380, damping: 22, mass: 0.9 };
const RELEASE = { type: "spring" as const, stiffness: 180, damping: 11, mass: 0.9 };

export function BottomNav({ onProfile }: BottomNavProps) {
  const pathname = usePathname() ?? "/";
  const cardRef = React.useRef<HTMLDivElement>(null);

  // ── Motion values ────────────────────────────────────────────────────
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const skewX = useMotionValue(0);
  const scaleX = useMotionValue(1);
  const scaleY = useMotionValue(1);

  const brTL = useMotionValue(BASE_R);
  const brTR = useMotionValue(BASE_R);
  const brBR = useMotionValue(BASE_R);
  const brBL = useMotionValue(BASE_R);

  const borderRadius = useMotionTemplate`${brTL}px ${brTR}px ${brBR}px ${brBL}px`;

  // Shadow offset follows tilt → deeper 3D feel
  const shadowX = useTransform(rotateY, [-14, 14], [-22, 22]);
  const shadowY = useTransform(rotateX, [-8, 8], [36, 12]);
  const boxShadow = useMotionTemplate`${shadowX}px ${shadowY}px 52px -14px rgba(0,0,0,0.5), 0 8px 18px -10px rgba(0,0,0,0.35)`;

  // ── Ripples ──────────────────────────────────────────────────────────
  const [ripples, setRipples] = React.useState<Ripple[]>([]);
  const rippleTimersRef = React.useRef<Set<ReturnType<typeof setTimeout>>>(
    new Set(),
  );

  React.useEffect(
    () => () => {
      rippleTimersRef.current.forEach((t) => clearTimeout(t));
      rippleTimersRef.current.clear();
    },
    [],
  );

  function addRipple(x: number, y: number) {
    const id = Date.now() + Math.random();
    setRipples((r) => [...r, { x, y, id }]);
    const handle = setTimeout(() => {
      setRipples((r) => r.filter((rp) => rp.id !== id));
      rippleTimersRef.current.delete(handle);
    }, 800);
    rippleTimersRef.current.add(handle);
  }

  // ── Deformation ──────────────────────────────────────────────────────
  const pressed = React.useRef(false);

  function applyDeform(clientX: number, clientY: number) {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const mx = clamp((x - rect.width / 2) / (rect.width / 2), -1, 1);
    const my = clamp((y - rect.height / 2) / (rect.height / 2), -1, 1);

    animate(rotateY, mx * 14, PRESS);
    animate(rotateX, -my * 7, PRESS);
    animate(skewX, mx * 1.4, PRESS);
    animate(scaleX, 0.94, PRESS);
    animate(scaleY, 0.93, PRESS);

    // Per-corner morph: corners nearest tap shrink hard, far corners bulge
    const DIAG = 2.828;
    const SHRINK = 18;
    const BULGE = 10;
    const d = (cx: number, cy: number) =>
      Math.hypot(mx - cx, my - cy) / DIAG; // 0 = at tap, 1 = farthest

    // near corner: BASE_R - SHRINK; far corner: BASE_R + BULGE
    const radius = (dist: number) => {
      // dist close to 0 → strong shrink; close to 1 → bulge
      return BASE_R - SHRINK * (1 - dist) + BULGE * (dist - 0.5);
    };

    animate(brTL, radius(d(-1, -1)), PRESS);
    animate(brTR, radius(d(1, -1)), PRESS);
    animate(brBR, radius(d(1, 1)), PRESS);
    animate(brBL, radius(d(-1, 1)), PRESS);
  }

  function reset() {
    pressed.current = false;
    animate(rotateY, 0, RELEASE);
    animate(rotateX, 0, RELEASE);
    animate(skewX, 0, RELEASE);
    animate(scaleX, 1, RELEASE);
    animate(scaleY, 1, RELEASE);
    animate(brTL, BASE_R, RELEASE);
    animate(brTR, BASE_R, RELEASE);
    animate(brBR, BASE_R, RELEASE);
    animate(brBL, BASE_R, RELEASE);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    pressed.current = true;
    applyDeform(e.clientX, e.clientY);
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) addRipple(e.clientX - rect.left, e.clientY - rect.top);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pressed.current) return;
    applyDeform(e.clientX, e.clientY);
  }

  const items: Item[] = [
    { href: "/home", icon: Home, label: "Home", match: (p) => p === "/home" },
    {
      href: "/employer",
      icon: Wallet,
      label: "Vault",
      match: (p) => p.startsWith("/employer"),
    },
    {
      href: "/employee",
      icon: Download,
      label: "Earnings",
      match: (p) => p.startsWith("/employee"),
    },
    {
      icon: User,
      label: "Profile",
      match: () => false,
      onClick: onProfile,
    },
  ];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
      <motion.nav
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-auto relative w-full max-w-[440px]"
        style={{ perspective: 700 }}
      >
        <motion.div
          ref={cardRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={reset}
          onPointerCancel={reset}
          onPointerLeave={reset}
          style={{
            rotateX,
            rotateY,
            skewX,
            scaleX,
            scaleY,
            borderRadius,
            boxShadow,
            transformStyle: "preserve-3d",
            background: "var(--nav-bg)",
            backdropFilter: "blur(22px) saturate(160%)",
            WebkitBackdropFilter: "blur(22px) saturate(160%)",
            willChange: "transform, border-radius, box-shadow",
          }}
          className="relative overflow-hidden"
        >
          {/* Ripples */}
          <AnimatePresence>
            {ripples.map((r) => (
              <motion.span
                key={r.id}
                initial={{ opacity: 0.45, scale: 0.25 }}
                animate={{ opacity: 0, scale: 3.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="pointer-events-none absolute h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  left: r.x,
                  top: r.y,
                  background:
                    "radial-gradient(closest-side, rgba(47,63,255,0.35), rgba(47,63,255,0.1) 45%, transparent 72%)",
                }}
              />
            ))}
          </AnimatePresence>

          {/* Top hairline */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border-strong)] to-transparent"
          />

          <LayoutGroup id="bnav">
            <div className="relative grid grid-cols-4 px-1 pt-3 pb-2.5">
              {items.map((item) => {
                const active = item.match(pathname);
                const content = (
                  <NavItem
                    icon={item.icon}
                    label={item.label}
                    active={active}
                  />
                );
                if (item.onClick) {
                  return (
                    <button
                      key={item.label}
                      onClick={item.onClick}
                      className="appearance-none bg-transparent outline-none focus-visible:outline-none"
                    >
                      {content}
                    </button>
                  );
                }
                return (
                  <Link
                    key={item.label}
                    href={item.href ?? "/"}
                    className="outline-none focus-visible:outline-none"
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          </LayoutGroup>
        </motion.div>
      </motion.nav>
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  return (
    <div className="relative flex flex-col items-center justify-center gap-1 py-1">
      {active && (
        <motion.span
          layoutId="bnav-tick"
          className="absolute -top-3 h-[3px] w-7 rounded-full bg-[#2F3FFF]"
          transition={{ type: "spring", stiffness: 500, damping: 34 }}
          style={{
            boxShadow: "0 2px 6px rgba(47,63,255,0.45)",
          }}
        />
      )}

      <motion.span
        animate={{ scale: active ? 1.05 : 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 24 }}
        className={cn(
          "grid h-7 w-7 place-items-center transition-colors duration-200",
          active ? "text-[#2F3FFF]" : "text-[var(--fg-mute)]",
        )}
      >
        <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
      </motion.span>

      <span
        className={cn(
          "text-[11px] tracking-tight transition-colors duration-200",
          active
            ? "font-semibold text-[#2F3FFF]"
            : "font-medium text-[var(--fg-mute)]",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
