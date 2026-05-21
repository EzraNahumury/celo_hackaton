# MiniPay Badge & Loading State — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visible MiniPay badge across Navbar + HeroSection, and fix the blank landing page when MiniPay is auto-connecting.

**Architecture:** New stateless `MiniPayBadge` component consumed by both Navbar and HeroSection. All changes conditional on `isMiniPay === true` — zero regression on non-MiniPay flows. No changes to wallet logic, contracts, or pages.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, framer-motion, wagmi

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `components/ui/MiniPayBadge.tsx` | **Create** | Stateless badge: green dot + "MiniPay" text |
| `components/HeroSection.tsx` | **Modify** | Import badge; add badge above CTA; add connecting state |
| `components/Navbar.tsx` | **Modify** | Import badge; show badge in right slot when isMiniPay |

---

### Task 1: Create `MiniPayBadge` component

**Files:**
- Create: `fe_trickle/components/ui/MiniPayBadge.tsx`

- [ ] **Step 1: Create the file**

```tsx
export function MiniPayBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 backdrop-blur-sm">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#10B981]" />
      </span>
      <span className="text-[11px] font-semibold tracking-tight text-white/75">
        MiniPay
      </span>
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add fe_trickle/components/ui/MiniPayBadge.tsx
git commit -m "feat(ui): add stateless MiniPayBadge component"
```

---

### Task 2: Modify `HeroSection.tsx`

**Files:**
- Modify: `fe_trickle/components/HeroSection.tsx`

**Behavior matrix:**

| State | Before | After |
|-------|--------|-------|
| `isMiniPay && !showConnected` | nothing | badge + "Connecting your wallet…" text + animated dots |
| `isMiniPay && showConnected` | "Open dashboard" button | badge + "Open dashboard" button |
| `!isMiniPay && !showConnected` | "Let's get started" | unchanged |
| `!isMiniPay && showConnected` | "Open dashboard" | unchanged |

- [ ] **Step 1: Add import**

In `HeroSection.tsx` line 11 (after `useIsMiniPay` import), add:

```tsx
import { MiniPayBadge } from "./ui/MiniPayBadge";
```

- [ ] **Step 2: Replace the bottom CTA section (lines 77–103)**

Replace:
```tsx
        {/* ── Bottom: Greeting + CTA ───────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-5"
          suppressHydrationWarning
        >
          <p className="text-center text-[14px] leading-[1.5] text-white/55">
            {showConnected
              ? "Wallet connected. Open your dashboard."
              : "Payroll that flows per second. Ready when you are."}
          </p>

          {showConnected ? (
            <CTAButton
              onClick={() => router.push("/home")}
              label="Open dashboard"
            />
          ) : (
            mounted && !isMiniPay && (
              <CTAButton
                onClick={() => setWalletOpen(true)}
                label="Let's get started"
              />
            )
          )}
        </motion.div>
```

With:
```tsx
        {/* ── Bottom: Greeting + CTA ───────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-5"
          suppressHydrationWarning
        >
          {mounted && isMiniPay && <MiniPayBadge />}

          <p className="text-center text-[14px] leading-[1.5] text-white/55">
            {showConnected
              ? "Wallet connected. Open your dashboard."
              : isMiniPay
              ? "Connecting your wallet…"
              : "Payroll that flows per second. Ready when you are."}
          </p>

          {showConnected ? (
            <CTAButton
              onClick={() => router.push("/home")}
              label="Open dashboard"
            />
          ) : mounted && isMiniPay ? (
            <div className="flex items-center gap-1.5" aria-label="Connecting via MiniPay">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full bg-white/35 animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          ) : (
            mounted && !isMiniPay && (
              <CTAButton
                onClick={() => setWalletOpen(true)}
                label="Let's get started"
              />
            )
          )}
        </motion.div>
```

- [ ] **Step 3: Commit**

```bash
git add fe_trickle/components/HeroSection.tsx
git commit -m "feat(hero): add MiniPay badge + connecting state on landing page"
```

---

### Task 3: Modify `Navbar.tsx`

**Files:**
- Modify: `fe_trickle/components/Navbar.tsx`

**Behavior matrix:**

| State | Before | After |
|-------|--------|-------|
| `isMiniPay && isConnected` | address pill only | badge + address pill |
| `isMiniPay && !isConnected` | nothing | badge alone |
| `!isMiniPay && isConnected` | address pill | unchanged |
| `!isMiniPay && !isConnected` | Connect button | unchanged |

- [ ] **Step 1: Add import**

After line 10 (`import { useIsMiniPay }`), add:

```tsx
import { MiniPayBadge } from "./ui/MiniPayBadge";
```

- [ ] **Step 2: Replace the right controls `<div>` (lines 60–88)**

Replace:
```tsx
            {/* Right controls */}
            <div className="flex items-center gap-1.5">
              {mounted && isConnected && address ? (
                <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-3">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[#10B981]"
                    aria-hidden
                  />
                  <span className="font-mono text-[11.5px] font-medium text-[var(--fg-dim)]">
                    {address.slice(0, 5)}…{address.slice(-4)}
                  </span>
                </span>
              ) : (
                mounted && !isMiniPay && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => setWalletOpen(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#2F3FFF] px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#1D2BE8]"
                    style={{
                      boxShadow: "0 6px 16px -4px rgba(47,63,255,0.5)",
                    }}
                  >
                    <Wallet size={13} strokeWidth={2.25} />
                    Connect
                  </motion.button>
                )
              )}
            </div>
```

With:
```tsx
            {/* Right controls */}
            <div className="flex items-center gap-1.5">
              {mounted && isMiniPay && <MiniPayBadge />}
              {mounted && isConnected && address && (
                <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-3">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[#10B981]"
                    aria-hidden
                  />
                  <span className="font-mono text-[11.5px] font-medium text-[var(--fg-dim)]">
                    {address.slice(0, 5)}…{address.slice(-4)}
                  </span>
                </span>
              )}
              {mounted && !isMiniPay && !isConnected && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => setWalletOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#2F3FFF] px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#1D2BE8]"
                  style={{
                    boxShadow: "0 6px 16px -4px rgba(47,63,255,0.5)",
                  }}
                >
                  <Wallet size={13} strokeWidth={2.25} />
                  Connect
                </motion.button>
              )}
            </div>
```

- [ ] **Step 3: Commit**

```bash
git add fe_trickle/components/Navbar.tsx
git commit -m "feat(nav): show MiniPay badge in navbar right slot"
```

---

### Task 4: TypeScript check + push

- [ ] **Step 1: Run tsc**

```bash
cd fe_trickle && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Push + open PR**

```bash
git push
gh pr create --title "feat: MiniPay badge + connecting state" --body "..."
```
