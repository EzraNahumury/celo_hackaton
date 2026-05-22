"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-9 w-9" />;

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[var(--fg-dim)] transition-colors hover:bg-white/[0.1] hover:text-[var(--fg)]"
    >
      {isDark ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
    </button>
  );
}
