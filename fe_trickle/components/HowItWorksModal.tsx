"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Waves, type LucideIcon } from "lucide-react";

interface HowItWorksModalProps {
  open: boolean;
  onClose: () => void;
}

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

/**
 * "How It Works" onboarding guide — a 5-step carousel. Parent decides when it is
 * `open`; this component only presents the steps. Mirrors the overlay pattern of
 * components/ui/wallet-modal.tsx (portal + framer-motion + Esc + scroll lock).
 */
export function HowItWorksModal({ open, onClose }: HowItWorksModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const current = STEPS[step];
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    setStep(0);
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
