# Dark / Light Mode — Design Spec

**Date:** 2026-05-21
**Status:** Approved
**Scope:** Dashboard pages only (`/home`, `/employer/*`, `/employee`)

---

## Context

App is currently dark-only. All color tokens live in CSS custom properties in `globals.css`. `AnimatedBackground` uses a hardcoded `#000000` background. `Providers.tsx` wraps the app but has no theme awareness.

---

## Goals

1. Add a sun/moon toggle button visible only on dashboard pages
2. Light mode replaces all dark surface/text tokens — zero changes to individual components
3. System preference respected on first visit; choice persisted to localStorage
4. Zero regression on landing page (stays dark always)
5. No hydration mismatch (SSR-safe)

---

## Approach: `next-themes` + CSS variable override

`next-themes` adds a `class` attribute to `<html>` (`"dark"` or `"light"`). Selecting on `html.light` in CSS lets us override all tokens in one place.

- `defaultTheme: "dark"` — app starts dark
- `attribute: "class"` — toggles `html.light` / `html.dark`
- `enableSystem: true` — respects `prefers-color-scheme` on first visit

---

## Changes

### 1. Dependency

```
next-themes
```

### 2. `app/globals.css` — add light token block

Add after the existing `:root { }` aliases block:

```css
html.light {
  --color-bg: #F0F2F8;
  --color-bg-2: #F5F7FC;
  --color-bg-3: #FAFBFF;
  --color-surface: #FFFFFF;
  --color-surface-2: #F0F2F8;
  --color-surface-3: #E8EAF0;
  --color-fg: #0F1119;
  --color-fg-dim: #3A4055;
  --color-fg-mute: #6B7280;
  --color-fg-faint: #9CA3AF;
  --color-border: rgba(0, 0, 0, 0.07);
  --color-border-strong: rgba(0, 0, 0, 0.12);
  --color-divider: rgba(0, 0, 0, 0.08);
  --bg: var(--color-bg);
  --surface: var(--color-surface);
  --fg: var(--color-fg);
  --fg-dim: var(--color-fg-dim);
  --fg-mute: var(--color-fg-mute);
  --fg-faint: var(--color-fg-faint);
  --border: var(--color-border);
  --border-strong: var(--color-border-strong);
  --divider: var(--color-divider);
}
```

Accent, success, danger, warn — unchanged (indigo/green/red/amber work on both themes).

Also fix scrollbar for light mode:
```css
html.light ::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
}
html.light ::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.2);
}
```

### 3. `components/Providers.tsx` — wrap with ThemeProvider

```tsx
import { ThemeProvider } from "next-themes";

// wrap children:
<ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
  {children}
</ThemeProvider>
```

`disableTransitionOnChange` prevents flash during theme swap.

### 4. New: `components/ui/ThemeToggle.tsx`

Stateless toggle button. Uses `useTheme()` from `next-themes`. Renders nothing until mounted (prevents hydration mismatch).

```
Props: none
Renders: sun icon (dark mode) | moon icon (light mode)
On click: toggles theme
```

### 5. `components/Navbar.tsx` — add ThemeToggle

Show `<ThemeToggle />` in right controls only when on a dashboard route.

```tsx
const pathname = usePathname(); // from next/navigation
const isDashboard = pathname.startsWith("/home") ||
  pathname.startsWith("/employer") ||
  pathname.startsWith("/employee");

// in right controls div:
{isDashboard && <ThemeToggle />}
```

### 6. `components/ui/animated-background.tsx` — fix hardcoded black

Change `style={{ background: "#000000" }}` to `className` using `bg-[var(--color-bg)]` so it follows the theme token.

---

## Safety Constraints

- Landing page (`/`) unaffected — Navbar shows toggle only on dashboard routes
- `next-themes` with `suppressHydrationWarning` on `<html>` (already present in `layout.tsx`) = no hydration error
- `ThemeToggle` renders null until mounted — no SSR mismatch
- No changes to wallet logic, contract calls, or any page behavior

---

## Files Changed

| File | Type |
|------|------|
| `package.json` | Modify (add dep) |
| `app/globals.css` | Modify (add light block) |
| `components/Providers.tsx` | Modify (add ThemeProvider) |
| `components/ui/ThemeToggle.tsx` | New |
| `components/Navbar.tsx` | Modify (add toggle) |
| `components/ui/animated-background.tsx` | Modify (fix bg) |

---

## Out of Scope

- Landing page theming
- Per-page theme overrides
- Custom theme colors beyond light/dark
