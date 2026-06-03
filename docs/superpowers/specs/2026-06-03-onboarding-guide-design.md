# Onboarding Guide ("How It Works") — Design Spec

**Date:** 2026-06-03
**Status:** Approved
**Author:** Trickle team + Claude
**Context:** New users land on Trickle with no idea what real-time payroll streaming is,
which role they are (employer vs employee), or how the core actions work. Add an
in-app, step-by-step guide.

## 1. Summary

A reusable **HowItWorksModal** — a 5-step carousel that explains the app — surfaced two ways:

1. **Auto-opens once** for a new user after their wallet connects (gated by a
   `localStorage` flag so it never nags returning users).
2. A **persistent `?` Help button** in the top Navbar reopens it anytime.

No contract, backend, or new dependency. Pure frontend, mirrors the existing
`WalletModal` / `ProfileSheet` overlay pattern.

## 2. Goals / Non-Goals

**Goals**
- A new user understands, in under a minute: what Trickle is, whether they're the
  payer or the payee, and the key actions for their role.
- Always-available help via an obvious `?` button.
- Non-intrusive: shows once automatically, dismissible, remembered.
- Demoable for judges; reinforces the new on-chain verified-payslip feature.

**Non-Goals**
- No spotlight/coachmark tour anchored to live DOM elements (fragile, out of scope).
- No dedicated `/guide` route (the modal is the single source).
- No backend, analytics, or i18n for the copy.
- No gating of any app action behind the guide — it is purely informational.

## 3. Steps (content)

The modal carousel has exactly 5 steps. Each: an icon, a short title, 1–3 lines of body.

1. **What is Trickle** — "Real-time payroll on Celo. Salaries flow every second — no
   batch runs, no payday waiting." (icon: `Waves` / `Zap`)
2. **Pick your role** — "Two sides: **Payroll** (you pay a team) and **Earnings** (you
   get paid). Switch from the bottom bar." Mentions the bottom-nav tabs. (icon: `Users`)
3. **Employer flow** — "1. Deposit funds. 2. Create a stream (who + rate per second).
   3. Watch the runway and top up before it runs dry." (icon: `Wallet`)
4. **Employee flow** — "Watch your balance tick up live, withdraw anytime, and export a
   payslip (PDF or CSV) as proof of income." (icon: `Download`)
5. **Verified payslips** — "Employers can stamp the company + your name/role on-chain, so
   your payslip shows a ✓ verified badge. Optional, and you consent before anything is
   published." (icon: `BadgeCheck`)

Final step's primary button reads **"Got it"** and closes + sets the seen flag. Steps
1–4 show **Next**; all steps after the first show **Back**; non-final steps show **Skip**.

## 4. Component Design

**`components/HowItWorksModal.tsx`** (new)
- Props: `{ open: boolean; onClose: () => void }`.
- Internal `step` state (0–4); `Next`/`Back` move it; `Skip`/`Got it`/backdrop/`Esc` call `onClose`.
- Renders an overlay (backdrop + centered panel) using framer-motion `AnimatePresence`,
  matching `WalletModal`'s entrance/exit and the project's CSS theme vars.
- A `STEPS` array of `{ icon, title, body }` drives the carousel (DRY; body may be a small
  JSX fragment to allow **bold** emphasis).
- Progress **dots** (one per step, active highlighted) + a small `1 / 5` counter.
- Buttons use the existing `Button` primitive (`shape="pill"`). Fully keyboard-accessible
  (`role="dialog"`, `aria-modal`, focus the panel on open, `Esc` to close).
- Responsive: full-width sheet on mobile, centered card on desktop. Honors dark/light.

**`lib/useGuideSeen.ts`** (new, tiny) — encapsulates the `localStorage` flag so the
key lives in one place:
- `const KEY = "trickle_guide_seen"`.
- `useGuideSeen()` returns `{ seen: boolean; markSeen: () => void }`, hydration-safe
  (reads in `useEffect`, defaults to `seen = true` during SSR so nothing flashes).

## 5. Wiring

`components/DashboardLayout.tsx` already owns `profileOpen` / `walletOpen`. Add:
- `guideOpen` state + handlers.
- A first-run effect: once mounted **and** the wallet is connected **and** `!seen`,
  open the guide and `markSeen()`. Use `useAccount()` for connection state.
- Render `<HowItWorksModal open={guideOpen} onClose={() => setGuideOpen(false)} />`.
- Pass `onHelp={() => setGuideOpen(true)}` to `<Navbar />`.

`components/Navbar.tsx`:
- Accept an optional `onHelp?: () => void` prop.
- Add a `?` icon button (`HelpCircle` from lucide) beside the existing profile/theme
  control, `aria-label="How it works"`, calling `onHelp`.

The auto-open lives in `DashboardLayout`, which wraps the connected app (`/home`,
`/employer`, `/employee`), so the guide fires on the first connected screen — not on the
public hero (`/`), where it would be premature.

## 6. Error / Edge Handling

- **SSR/hydration:** `useGuideSeen` defaults `seen = true` until the client reads
  `localStorage`, preventing a flash-open on every reload.
- **localStorage unavailable** (privacy mode): reads are wrapped in `try/catch`; on
  failure treat as `seen = true` (never trap the user in a re-opening loop).
- **Wallet never connects:** guide simply doesn't auto-open; the `?` button still works.
- **Returning user:** `seen = true` → no auto-open; `?` always reopens.

## 7. Testing / Verification

No FE test framework in this repo. Verify each task with:
- `rtk npx tsc --noEmit` (typecheck), then `npx next build` (production build, must be 0 errors).
- Manual: first visit auto-opens; Skip/Got-it dismisses; reload does **not** re-open;
  `?` reopens; Back/Next/dots work; Esc + backdrop close; dark + mobile look right.

## 8. Commit & PR Plan (~20 commits, ~4 PRs)

Atomic, each doing one real thing — no padding.

- **PR 1 — Scaffold + spec:** spec doc, plan doc, `useGuideSeen` hook, modal shell
  (overlay + close), `STEPS` type/array skeleton.
- **PR 2 — Step content:** one commit per step (1–5), then dots + counter, then
  Back/Next/Skip/Got-it controls.
- **PR 3 — Triggers/wiring:** Navbar `?` button + a11y, DashboardLayout `guideOpen`
  state, first-run auto-open effect, pass-through props.
- **PR 4 — Polish:** Esc/backdrop close, focus management, mobile responsive, dark-mode
  pass, copy/icon tweaks.

## 9. Out of Scope

- DOM-anchored coachmarks / spotlight tours.
- A standalone `/guide` page.
- Per-page contextual tooltips.
- Localization of copy.
