"use client";

import { useCallback, useEffect, useState } from "react";

// Single source of truth for the "has the user seen the onboarding guide" flag.
const KEY = "trickle_guide_seen";

/**
 * Hydration-safe persistence for the onboarding guide.
 * Defaults to `seen = true` on the server/first render so the guide never
 * flash-opens on every reload; the real value is read from localStorage in an
 * effect. localStorage failures (privacy mode) are swallowed and treated as
 * "seen" so the user is never trapped in a re-opening loop.
 */
export function useGuideSeen() {
  const [seen, setSeen] = useState(true);

  useEffect(() => {
    try {
      setSeen(localStorage.getItem(KEY) === "1");
    } catch {
      setSeen(true);
    }
  }, []);

  const markSeen = useCallback(() => {
    setSeen(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore — best-effort persistence */
    }
  }, []);

  return { seen, markSeen };
}
