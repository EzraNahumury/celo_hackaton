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
