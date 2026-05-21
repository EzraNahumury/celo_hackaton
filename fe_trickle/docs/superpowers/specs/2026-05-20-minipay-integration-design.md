# MiniPay Integration — Design Spec

**Date:** 2026-05-20  
**Status:** Approved  
**Scope:** Visual MiniPay badge + landing-page loading state

---

## Context

Partial MiniPay integration already exists and must NOT be broken:
- `hooks/useMiniPay.ts` — `useIsMiniPay()` detects `window.ethereum?.isMiniPay`
- `Providers.tsx` — `MiniPayAutoConnect` auto-connects injected wallet when in MiniPay
- `HeroSection.tsx`, `Navbar.tsx`, `ConnectWalletPrompt.tsx` — already hide "Connect" buttons when `isMiniPay`

Token default: `TOKEN_LIST[0] = cUSD` — already correct, no changes needed.

---

## Goals

1. Fix UX gap: landing page shows nothing when `isMiniPay && !isConnected` (auto-connect in progress but no feedback)
2. Add visible MiniPay indicator across all app screens for hackathon judges
3. Zero regression on existing non-MiniPay flows

---

## Changes

### 1. New: `components/ui/MiniPayBadge.tsx`

Stateless pill component. Shows a green animated dot + "MiniPay" text.

```
Props: none
Usage: <MiniPayBadge />
```

Renders only when called — the parent decides when to show it based on `useIsMiniPay()`.

### 2. Modify: `components/HeroSection.tsx`

Current behavior when `isMiniPay && !isConnected`: renders nothing (no CTA, no feedback).

New behavior:
- Replace the empty slot with an animated "Connecting via MiniPay…" state:
  - Pulse spinner or animated dots
  - Short text: "Connecting your wallet…"
- Add `<MiniPayBadge />` above the CTA area when `isMiniPay` (regardless of connection state)

Existing behaviors unchanged:
- `!isMiniPay && !isConnected` → "Let's get started" CTA
- `isConnected` → "Open dashboard" button (both MiniPay and non-MiniPay)

### 3. Modify: `components/Navbar.tsx`

Current behavior when `isMiniPay`: renders nothing in the right slot (no Connect button, no address).

New behavior when `isMiniPay`:
- `isConnected` → existing address pill stays, add `<MiniPayBadge />` before it
- `!isConnected` → show `<MiniPayBadge />` alone in the right slot (indicates MiniPay is active, connecting)

Existing behaviors unchanged:
- `!isMiniPay && !isConnected` → Connect button
- `!isMiniPay && isConnected` → address pill only

---

## Safety Constraints

- All changes are additive or conditional on `isMiniPay === true`
- `isMiniPay` is always `false` during SSR (hook uses `useEffect` to set state client-side) — no hydration mismatch risk
- `MiniPayBadge` has no side effects, no state, no network calls
- No changes to wallet connection logic, contract calls, or transaction flows
- No changes to `useMiniPay.ts`, `Providers.tsx`, or any page files

---

## Files Changed

| File | Type |
|------|------|
| `components/ui/MiniPayBadge.tsx` | New |
| `components/HeroSection.tsx` | Modify (additive) |
| `components/Navbar.tsx` | Modify (additive) |

---

## Out of Scope

- cUSD default (already cUSD — `TOKEN_LIST[0]`)
- Changes to MiniPay auto-connect logic
- Changes to any page or contract interaction
- Dark/light mode
