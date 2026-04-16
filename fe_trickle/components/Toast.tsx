"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "pending" | "info";

export interface ToastItem {
  id: string;
  message: string;
  description?: string;
  type: ToastType;
  /** Celo transaction hash — renders a celoscan link */
  txHash?: string;
  /** Auto-dismiss after ms. 0 = persist until manually dismissed. */
  duration?: number;
}

interface ToastCtx {
  toast: (item: Omit<ToastItem, "id">) => string;
  update: (id: string, patch: Partial<Omit<ToastItem, "id">>) => void;
  dismiss: (id: string) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast: wrap your app with <ToastProvider>");
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

let _seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((p) => p.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (item: Omit<ToastItem, "id">): string => {
      const id = `toast-${++_seq}`;
      const duration =
        item.duration !== undefined
          ? item.duration
          : item.type === "pending"
          ? 0
          : item.type === "error"
          ? 7000
          : 4000;

      setItems((p) => [...p.slice(-4), { ...item, id, duration }]); // max 5 toasts
      if (duration > 0) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const update = useCallback(
    (id: string, patch: Partial<Omit<ToastItem, "id">>) => {
      setItems((p) =>
        p.map((t) => {
          if (t.id !== id) return t;
          const next = { ...t, ...patch };
          if (patch.type && patch.type !== "pending") {
            const dur =
              patch.duration !== undefined
                ? patch.duration
                : patch.type === "error"
                ? 7000
                : 4000;
            if (dur > 0) setTimeout(() => dismiss(id), dur);
          }
          return next;
        })
      );
    },
    [dismiss]
  );

  return (
    <Ctx.Provider value={{ toast, update, dismiss }}>
      {children}
      <ToastList items={items} onDismiss={dismiss} />
    </Ctx.Provider>
  );
}

// ── Visual config per type ────────────────────────────────────────────────────

const ICONS: Record<ToastType, React.ReactNode> = {
  success: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12" />
    </svg>
  ),
  error: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  pending: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  ),
  info: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <circle cx="12" cy="16" r="0.5" fill="currentColor" strokeWidth="3" />
    </svg>
  ),
};

const STYLE: Record<
  ToastType,
  { icon: string; bar: string }
> = {
  success: {
    icon: "text-[var(--success)] bg-[var(--color-success-soft)]",
    bar: "bg-[var(--success)]",
  },
  error: {
    icon: "text-[var(--danger)] bg-[var(--color-danger-soft)]",
    bar: "bg-[var(--danger)]",
  },
  pending: {
    icon: "text-[var(--warn)] bg-[var(--color-warn-soft)]",
    bar: "bg-[var(--warn)]",
  },
  info: {
    icon: "text-[var(--accent)] bg-[var(--accent-soft)]",
    bar: "bg-[var(--accent)]",
  },
};

// ── Toast list ────────────────────────────────────────────────────────────────

function ToastList({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-[116px] right-4 z-[200] flex w-full max-w-[340px] flex-col-reverse gap-2 sm:bottom-6 sm:right-6">
      <AnimatePresence mode="popLayout" initial={false}>
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Single toast card ─────────────────────────────────────────────────────────

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const s = STYLE[item.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95, transition: { duration: 0.14 } }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="pointer-events-auto relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--color-surface-2)] shadow-[var(--shadow-lg)]"
    >
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${s.bar}`} />

      <div className="flex items-start gap-3 px-4 py-3.5 pl-5">
        <span
          className={`mt-[1px] flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${s.icon}`}
        >
          {ICONS[item.type]}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold leading-snug text-[var(--fg)]">
            {item.message}
          </p>
          {item.description && (
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--fg-mute)]">
              {item.description}
            </p>
          )}
          {item.txHash && (
            <a
              href={`https://sepolia.celoscan.io/tx/${item.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 font-mono text-[11.5px] font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-2)]"
            >
              {item.txHash.slice(0, 8)}…{item.txHash.slice(-6)}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15,3 21,3 21,9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          )}
        </div>

        <button
          onClick={() => onDismiss(item.id)}
          className="mt-0.5 flex-shrink-0 rounded p-0.5 text-[var(--fg-faint)] transition-colors hover:text-[var(--fg-dim)]"
          aria-label="Dismiss notification"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}
