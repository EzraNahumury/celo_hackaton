# Onboarding Guide ("How It Works") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app, dismissible 5-step "How It Works" guide that auto-opens once for new users and is reopenable anytime from a `?` button in the navbar.

**Architecture:** A self-contained `HowItWorksModal` (portal + framer-motion overlay, mirroring `wallet-modal.tsx`) driven by a `STEPS` array. A tiny `useGuideSeen` hook owns the `localStorage` flag. `Navbar` owns the open state, renders a `?` button, renders the modal, and runs the first-run auto-open effect (it already has `isConnected`/`mounted`/`isDashboard` and already renders `WalletModal`).

**Tech Stack:** Next.js 15 + React, framer-motion, lucide-react, wagmi (`useAccount`), Tailwind theme vars. No test framework → verify = `rtk npx tsc --noEmit` + `npx next build`.

**Spec:** `docs/superpowers/specs/2026-06-03-onboarding-guide-design.md`

**Branch:** `feat/onboarding-guide` (spec already committed). ~18 code commits across 4 PRs.

**Verify note:** "tsc" = `cd fe_trickle && rtk npx tsc --noEmit` (expect `TypeScript compilation completed`). "build" = `cd fe_trickle && npx next build` (expect exit 0, `✓ Compiled successfully`). Run tsc after every task; run build at the end of each PR group.

---

## File Structure

- **Create** `fe_trickle/lib/useGuideSeen.ts` — owns the `localStorage` key + hydration-safe read/markSeen. One responsibility: persistence of "has the user seen the guide".
- **Create** `fe_trickle/components/HowItWorksModal.tsx` — the overlay + carousel UI. One responsibility: present the steps. Stateless about *whether* to show (parent controls `open`).
- **Modify** `fe_trickle/components/Navbar.tsx` — add `?` button, guide open-state, auto-open effect, render the modal.

---

## PR 1 — Scaffold (hook + modal shell)

### Task 1: `useGuideSeen` hook

**Files:**
- Create: `fe_trickle/lib/useGuideSeen.ts`

- [ ] **Step 1: Write the hook**

`fe_trickle/lib/useGuideSeen.ts`:
```ts
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
```

- [ ] **Step 2: Verify tsc**

Run: `cd fe_trickle && rtk npx tsc --noEmit`
Expected: `TypeScript compilation completed`.

- [ ] **Step 3: Commit**

```bash
git add fe_trickle/lib/useGuideSeen.ts
git commit -m "feat(onboarding): useGuideSeen localStorage hook"
```

---

### Task 2: `HowItWorksModal` shell (overlay + close, no content yet)

**Files:**
- Create: `fe_trickle/components/HowItWorksModal.tsx`

- [ ] **Step 1: Write the shell**

`fe_trickle/components/HowItWorksModal.tsx`:
```tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface HowItWorksModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * "How It Works" onboarding guide — a 5-step carousel. Parent decides when it is
 * `open`; this component only presents the steps. Mirrors the overlay pattern of
 * components/ui/wallet-modal.tsx (portal + framer-motion + Esc + scroll lock).
 */
export function HowItWorksModal({ open, onClose }: HowItWorksModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="guide-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-modal-title"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[420px] overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]"
          >
            <div className="flex items-center justify-end px-4 pt-4">
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Close guide"
                className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] bg-[var(--color-surface-2)] text-[var(--fg-mute)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-3)] hover:text-[var(--fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-3)]"
              >
                <X size={15} />
              </button>
            </div>
            <h2 id="guide-modal-title" className="sr-only">
              How Trickle works
            </h2>
            {/* Carousel body added in Task 3+ */}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
```

- [ ] **Step 2: Verify tsc**

Run: `cd fe_trickle && rtk npx tsc --noEmit`
Expected: `TypeScript compilation completed`.

- [ ] **Step 3: Commit**

```bash
git add fe_trickle/components/HowItWorksModal.tsx
git commit -m "feat(onboarding): HowItWorksModal shell (overlay, close, esc, focus)"
```

---

### Task 3: Step model + render active step's icon & title

**Files:**
- Modify: `fe_trickle/components/HowItWorksModal.tsx`

- [ ] **Step 1: Add the STEP type, a one-entry STEPS array, and `step` state**

Add imports + types above the component, and render the active step. Replace the
`lucide-react` import line and insert the model:
```tsx
import { X, Waves, type LucideIcon } from "lucide-react";

interface GuideStep {
  icon: LucideIcon;
  title: string;
  body: React.ReactNode;
}

const STEPS: GuideStep[] = [
  {
    icon: Waves,
    title: "What is Trickle?",
    body: "Real-time payroll on Celo. Salaries flow every second — no batch runs, no waiting for payday.",
  },
];
```
Inside the component, add step state after the refs:
```tsx
  const [step, setStep] = React.useState(0);
  const current = STEPS[step];
```
Reset to the first step whenever the modal opens (add to the existing open effect,
right after `closeButtonRef.current?.focus();`):
```tsx
    setStep(0);
```
Replace the `{/* Carousel body added in Task 3+ */}` comment with:
```tsx
            <div className="px-6 pb-7 pt-1 text-center">
              <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <current.icon size={26} strokeWidth={1.9} />
              </span>
              <h3 className="font-display text-[20px] font-semibold tracking-tight text-[var(--fg)]">
                {current.title}
              </h3>
              <p className="mx-auto mt-2 max-w-[300px] text-[13.5px] leading-relaxed text-[var(--fg-mute)]">
                {current.body}
              </p>
            </div>
```

- [ ] **Step 2: Verify tsc**

Run: `cd fe_trickle && rtk npx tsc --noEmit`
Expected: `TypeScript compilation completed`.

- [ ] **Step 3: Verify build (closes PR 1)**

Run: `cd fe_trickle && npx next build`
Expected: exit 0, `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add fe_trickle/components/HowItWorksModal.tsx
git commit -m "feat(onboarding): step model + render active step icon/title"
```

- [ ] **Step 5: Push branch + open PR 1**

```bash
git push -u origin feat/onboarding-guide
gh pr create --title "feat(onboarding): guide scaffold (hook + modal shell)" --body "Foundation for the in-app How It Works guide: useGuideSeen localStorage hook + HowItWorksModal overlay shell rendering the first step. Spec: docs/superpowers/specs/2026-06-03-onboarding-guide-design.md"
gh pr merge --merge
```

---

## PR 2 — Step content + carousel controls

### Task 4: Step 2 — Pick your role

**Files:**
- Modify: `fe_trickle/components/HowItWorksModal.tsx`

- [ ] **Step 1: Add the icon import + the step**

Extend the lucide import to include `Users`:
```tsx
import { X, Waves, Users, type LucideIcon } from "lucide-react";
```
Append to the `STEPS` array (after the first entry):
```tsx
  {
    icon: Users,
    title: "Pick your role",
    body: (
      <>
        Two sides: <strong className="text-[var(--fg)]">Payroll</strong> (you pay a
        team) and <strong className="text-[var(--fg)]">Earnings</strong> (you get
        paid). Switch them from the bottom bar.
      </>
    ),
  },
```

- [ ] **Step 2: Verify tsc**

Run: `cd fe_trickle && rtk npx tsc --noEmit`
Expected: `TypeScript compilation completed`.

- [ ] **Step 3: Commit**

```bash
git add fe_trickle/components/HowItWorksModal.tsx
git commit -m "feat(onboarding): step 2 — pick your role"
```

---

### Task 5: Step 3 — Employer flow

**Files:**
- Modify: `fe_trickle/components/HowItWorksModal.tsx`

- [ ] **Step 1: Add the icon import + the step**

Extend the lucide import to include `Wallet`:
```tsx
import { X, Waves, Users, Wallet, type LucideIcon } from "lucide-react";
```
Append to `STEPS`:
```tsx
  {
    icon: Wallet,
    title: "Paying a team?",
    body: (
      <>
        1. Deposit funds. 2. Create a stream (who + rate per second). 3. Watch the
        runway and top up before it runs dry.
      </>
    ),
  },
```

- [ ] **Step 2: Verify tsc**

Run: `cd fe_trickle && rtk npx tsc --noEmit`
Expected: `TypeScript compilation completed`.

- [ ] **Step 3: Commit**

```bash
git add fe_trickle/components/HowItWorksModal.tsx
git commit -m "feat(onboarding): step 3 — employer flow"
```

---

### Task 6: Step 4 — Employee flow

**Files:**
- Modify: `fe_trickle/components/HowItWorksModal.tsx`

- [ ] **Step 1: Add the icon import + the step**

Extend the lucide import to include `Download`:
```tsx
import { X, Waves, Users, Wallet, Download, type LucideIcon } from "lucide-react";
```
Append to `STEPS`:
```tsx
  {
    icon: Download,
    title: "Getting paid?",
    body: "Watch your balance tick up live, withdraw anytime, and export a payslip (PDF or CSV) as proof of income.",
  },
```

- [ ] **Step 2: Verify tsc**

Run: `cd fe_trickle && rtk npx tsc --noEmit`
Expected: `TypeScript compilation completed`.

- [ ] **Step 3: Commit**

```bash
git add fe_trickle/components/HowItWorksModal.tsx
git commit -m "feat(onboarding): step 4 — employee flow"
```

---

### Task 7: Step 5 — Verified payslips

**Files:**
- Modify: `fe_trickle/components/HowItWorksModal.tsx`

- [ ] **Step 1: Add the icon import + the step**

Extend the lucide import to include `BadgeCheck`:
```tsx
import { X, Waves, Users, Wallet, Download, BadgeCheck, type LucideIcon } from "lucide-react";
```
Append to `STEPS`:
```tsx
  {
    icon: BadgeCheck,
    title: "Verified payslips",
    body: (
      <>
        Employers can stamp the company + your name on-chain, so your payslip shows a{" "}
        <strong className="text-[var(--success)]">✓ verified</strong> badge. Optional —
        you consent before anything is published.
      </>
    ),
  },
```

- [ ] **Step 2: Verify tsc**

Run: `cd fe_trickle && rtk npx tsc --noEmit`
Expected: `TypeScript compilation completed`.

- [ ] **Step 3: Commit**

```bash
git add fe_trickle/components/HowItWorksModal.tsx
git commit -m "feat(onboarding): step 5 — verified payslips"
```

---

### Task 8: Progress dots + counter

**Files:**
- Modify: `fe_trickle/components/HowItWorksModal.tsx`

- [ ] **Step 1: Add dots + `n / total` under the body**

Immediately after the closing `</div>` of the step body block (the `px-6 pb-7 pt-1
text-center` div), insert:
```tsx
            <div className="flex items-center justify-center gap-1.5 pb-4">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  aria-hidden
                  className={
                    i === step
                      ? "h-1.5 w-4 rounded-full bg-[var(--accent)] transition-all"
                      : "h-1.5 w-1.5 rounded-full bg-[var(--border-strong)] transition-all"
                  }
                />
              ))}
              <span className="ml-2 font-mono text-[11px] text-[var(--fg-faint)]">
                {step + 1} / {STEPS.length}
              </span>
            </div>
```

- [ ] **Step 2: Verify tsc**

Run: `cd fe_trickle && rtk npx tsc --noEmit`
Expected: `TypeScript compilation completed`.

- [ ] **Step 3: Commit**

```bash
git add fe_trickle/components/HowItWorksModal.tsx
git commit -m "feat(onboarding): carousel progress dots + counter"
```

---

### Task 9: Next / Back / Skip / Got it controls

**Files:**
- Modify: `fe_trickle/components/HowItWorksModal.tsx`

- [ ] **Step 1: Import Button + derive flags**

Add the import (near the top):
```tsx
import { Button } from "@/components/ui/Button";
```
Inside the component, after `const current = STEPS[step];`, add:
```tsx
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
```

- [ ] **Step 2: Add the footer controls**

After the dots block, before the closing `</motion.div>` of the dialog card, insert:
```tsx
            <div className="flex items-center justify-between gap-3 border-t border-[var(--divider)] bg-[var(--color-bg-2)] px-5 py-4">
              {isFirst ? (
                <button
                  onClick={onClose}
                  className="text-[13px] font-medium text-[var(--fg-mute)] transition-colors hover:text-[var(--fg)]"
                >
                  Skip
                </button>
              ) : (
                <button
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className="text-[13px] font-medium text-[var(--fg-mute)] transition-colors hover:text-[var(--fg)]"
                >
                  Back
                </button>
              )}
              {isLast ? (
                <Button shape="pill" onClick={onClose}>
                  Got it
                </Button>
              ) : (
                <Button shape="pill" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                  Next
                </Button>
              )}
            </div>
```

- [ ] **Step 3: Verify tsc + build (closes PR 2)**

Run: `cd fe_trickle && rtk npx tsc --noEmit` then `npx next build`
Expected: tsc clean; build exit 0.

- [ ] **Step 4: Commit**

```bash
git add fe_trickle/components/HowItWorksModal.tsx
git commit -m "feat(onboarding): Next/Back/Skip/Got-it carousel controls"
```

- [ ] **Step 5: Push + open PR 2**

```bash
git push
gh pr create --title "feat(onboarding): guide content + carousel controls" --body "All 5 step contents, progress dots + counter, and Back/Next/Skip/Got-it navigation. Spec: docs/superpowers/specs/2026-06-03-onboarding-guide-design.md"
gh pr merge --merge
```

---

## PR 3 — Triggers + wiring (Navbar)

### Task 10: Navbar `?` Help button + render the modal

**Files:**
- Modify: `fe_trickle/components/Navbar.tsx`

- [ ] **Step 1: Add imports + open state**

Add to the imports:
```tsx
import { Wallet, HelpCircle } from "lucide-react";
import { HowItWorksModal } from "./HowItWorksModal";
import { useGuideSeen } from "@/lib/useGuideSeen";
```
(Replace the existing `import { Wallet } from "lucide-react";` line with the
`Wallet, HelpCircle` version above.)

Inside `Navbar`, after `const [walletOpen, setWalletOpen] = useState(false);`:
```tsx
  const [guideOpen, setGuideOpen] = useState(false);
  const { seen, markSeen } = useGuideSeen();
```

- [ ] **Step 2: Add the `?` button (dashboard only)**

In the right-controls `<div className="flex items-center gap-1.5">`, immediately
after the `{isDashboard && <ThemeToggle />}` line, add:
```tsx
              {isDashboard && (
                <button
                  type="button"
                  onClick={() => setGuideOpen(true)}
                  aria-label="How it works"
                  className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] bg-[var(--color-surface-2)] text-[var(--fg-mute)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-3)] hover:text-[var(--fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-3)]"
                >
                  <HelpCircle size={16} strokeWidth={2} />
                </button>
              )}
```

- [ ] **Step 3: Render the modal next to WalletModal**

Replace the line `<WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />` with:
```tsx
      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
      <HowItWorksModal open={guideOpen} onClose={() => setGuideOpen(false)} />
```

- [ ] **Step 4: Verify tsc**

Run: `cd fe_trickle && rtk npx tsc --noEmit`
Expected: `TypeScript compilation completed`.
(Note: `seen` / `markSeen` are unused until Task 11 — that's expected; tsc allows
unused locals. If a lint step flags it, Task 11 immediately consumes them.)

- [ ] **Step 5: Commit**

```bash
git add fe_trickle/components/Navbar.tsx
git commit -m "feat(onboarding): navbar ? button opens the guide"
```

---

### Task 11: First-run auto-open effect

**Files:**
- Modify: `fe_trickle/components/Navbar.tsx`

- [ ] **Step 1: Auto-open once when connected on a dashboard route**

After the existing `useEffect(() => setMounted(true), []);` line, add:
```tsx
  // First-run: open the guide once after the wallet connects on a dashboard
  // screen, then remember it so returning users are never nagged.
  useEffect(() => {
    if (mounted && isConnected && isDashboard && !seen) {
      setGuideOpen(true);
      markSeen();
    }
  }, [mounted, isConnected, isDashboard, seen, markSeen]);
```

- [ ] **Step 2: Verify tsc + build (closes PR 3)**

Run: `cd fe_trickle && rtk npx tsc --noEmit` then `npx next build`
Expected: tsc clean; build exit 0.

- [ ] **Step 3: Commit**

```bash
git add fe_trickle/components/Navbar.tsx
git commit -m "feat(onboarding): auto-open guide once for new users"
```

- [ ] **Step 4: Push + open PR 3**

```bash
git push
gh pr create --title "feat(onboarding): navbar trigger + first-run auto-open" --body "Adds the persistent ? Help button (dashboard) and the first-run auto-open (connected + unseen), gated by useGuideSeen. Spec: docs/superpowers/specs/2026-06-03-onboarding-guide-design.md"
gh pr merge --merge
```

---

## PR 4 — Polish

### Task 12: Respect reduced-motion + smooth step transitions

**Files:**
- Modify: `fe_trickle/components/HowItWorksModal.tsx`

- [ ] **Step 1: Animate the step body on change**

Wrap the step-body inner content in an `AnimatePresence`-driven keyed motion block so
swapping steps cross-fades. Change the step body `<div className="px-6 pb-7 pt-1
text-center">` block to wrap its three children (icon span, h3, p) in:
```tsx
            <div className="px-6 pb-7 pt-1 text-center">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <current.icon size={26} strokeWidth={1.9} />
                  </span>
                  <h3 className="font-display text-[20px] font-semibold tracking-tight text-[var(--fg)]">
                    {current.title}
                  </h3>
                  <p className="mx-auto mt-2 max-w-[300px] text-[13.5px] leading-relaxed text-[var(--fg-mute)]">
                    {current.body}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
```

- [ ] **Step 2: Verify tsc**

Run: `cd fe_trickle && rtk npx tsc --noEmit`
Expected: `TypeScript compilation completed`.

- [ ] **Step 3: Commit**

```bash
git add fe_trickle/components/HowItWorksModal.tsx
git commit -m "feat(onboarding): cross-fade step transitions"
```

---

### Task 13: Mobile bottom-sheet sizing

**Files:**
- Modify: `fe_trickle/components/HowItWorksModal.tsx`

- [ ] **Step 1: Anchor to bottom on mobile, center on desktop**

Change the outer overlay container className from
`"fixed inset-0 z-[100] flex items-center justify-center p-4"` to:
```tsx
          className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
```
And change the dialog card className rounded corners so it reads as a sheet on mobile —
replace `"...rounded-3xl border..."` on the dialog `motion.div` with:
```tsx
            className="relative w-full max-w-[420px] overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] sm:rounded-3xl"
```

- [ ] **Step 2: Verify tsc + build**

Run: `cd fe_trickle && rtk npx tsc --noEmit` then `npx next build`
Expected: tsc clean; build exit 0.

- [ ] **Step 3: Commit**

```bash
git add fe_trickle/components/HowItWorksModal.tsx
git commit -m "feat(onboarding): mobile bottom-sheet sizing"
```

---

### Task 14: README — document the guide

**Files:**
- Modify: `fe_trickle/README.md`

- [ ] **Step 1: Add a short "Onboarding guide" note**

Find a "Features" or top-level section in `fe_trickle/README.md` (read it first to match
heading style) and add one bullet:
```markdown
- **In-app guide** — a "How It Works" walkthrough auto-opens for new users and is
  reopenable anytime from the `?` button in the navbar.
```
If no Features list exists, add a `## Onboarding` section near the top with that bullet.

- [ ] **Step 2: Commit**

```bash
git add fe_trickle/README.md
git commit -m "docs(onboarding): mention the in-app guide in the README"
```

---

### Task 15: Final verification + PR 4

- [ ] **Step 1: Full verify**

Run: `cd fe_trickle && rtk npx tsc --noEmit` then `npx next build`
Expected: tsc clean; build exit 0; `/home`, `/employer`, `/employee` all listed.

- [ ] **Step 2: Manual smoke (describe in PR body)**

Confirm by reasoning/walkthrough: first connected visit auto-opens; Skip/Got-it closes;
reload does not re-open; `?` reopens; Back/Next/dots cycle 1↔5; Esc + backdrop close.

- [ ] **Step 3: Push + open PR 4**

```bash
git push
gh pr create --title "feat(onboarding): polish (transitions, mobile, docs)" --body "Cross-fade step transitions, mobile bottom-sheet sizing, README note. Completes the in-app How It Works guide. Spec: docs/superpowers/specs/2026-06-03-onboarding-guide-design.md"
gh pr merge --merge
```

---

## Post-implementation

- [ ] Confirm the Vercel production deploy (from main) shows the `?` button on `/home`
      and the guide opens. (The `vercel.json` ignoreCommand only builds when `fe_trickle`
      changes — these changes touch `fe_trickle`, so it deploys.)
- [ ] To re-test the auto-open as a "new user", clear `localStorage["trickle_guide_seen"]`
      in devtools and reload while connected.

## Notes

- **No new dependency** — framer-motion, lucide-react, and the `Button` primitive all
  already exist.
- **Keep the guide non-blocking** — it never gates an app action; closing always works.
- The auto-open lives in `Navbar` (not `DashboardLayout`) because Navbar already has
  `isConnected` + `isDashboard` + `mounted` and already renders `WalletModal` — no prop
  drilling, single overlay-owning component.
