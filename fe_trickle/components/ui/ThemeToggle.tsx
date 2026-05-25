"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  // Render the button shell on SSR so the border + background are present
  // immediately on hydration. Only the icon swaps in after mount, avoiding
  // a flash of empty space inside the navbar.
  return (
    <button
      onClick={() => mounted && setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--color-surface-2)] text-[var(--fg-dim)] transition-colors hover:bg-[var(--color-surface-3)] hover:text-[var(--fg)]"
    >
      {mounted ? (
        isDark ? (
          <Sun size={15} strokeWidth={2} />
        ) : (
          <Moon size={15} strokeWidth={2} />
        )
      ) : null}
    </button>
  );
}
