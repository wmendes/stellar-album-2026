import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

const PAGE_EASE = [0.22, 1, 0.36, 1] as const;

/** Shared CTA styling so every button gets the same hover, disabled, and
 *  (importantly) focus-visible treatment. */
export function buttonClass(variant: "primary" | "ghost" | "soft" | "danger" = "primary", size: "sm" | "md" = "md"): string {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-full font-display font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:opacity-40 disabled:shadow-none";
  const sizes = { sm: "px-4 py-2 text-sm", md: "px-6 py-2.5" } as const;
  const variants = {
    primary: "bg-leaf-deep text-paper shadow-md hover:bg-leaf",
    ghost: "text-ink-soft hover:bg-paper",
    soft: "bg-paper/15 text-paper/90 ring-1 ring-paper/30 hover:bg-paper/25",
    danger: "bg-[oklch(0.55_0.16_25)] text-paper shadow-md hover:bg-[oklch(0.5_0.17_25)]",
  } as const;
  return `${base} ${sizes[size]} ${variants[variant]}`;
}

/** Animated page wrapper; drives the route transition. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <motion.main
      className="mx-auto max-w-4xl px-5 pb-24 pt-8"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.28, ease: PAGE_EASE }}
    >
      {children}
    </motion.main>
  );
}

export function SectionHead({ title, right, sub }: { title: string; right?: string; sub?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">{title}</h2>
        {right && <span className="text-sm text-ink-soft">{right}</span>}
      </div>
      {sub && <p className="mt-1 max-w-prose text-sm text-ink-soft">{sub}</p>}
    </div>
  );
}

export function ProgressMeter({ value, max }: { value: number; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-kraft">
        <motion.div
          className="h-full origin-left rounded-full bg-leaf"
          initial={false}
          animate={{ scaleX: max ? value / max : 0 }}
          transition={{ duration: 0.5, ease: PAGE_EASE }}
        />
      </div>
      <span className="font-display text-sm font-bold text-ink">{value}/{max}</span>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
      {label}
      {children}
    </label>
  );
}

export function CounterButton({ title, sub, onClick, disabled }: { title: string; sub: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-1 flex-col items-start rounded-xl bg-paper px-4 py-3 text-left ring-1 ring-edge transition hover:ring-leaf/50 focus-visible:outline-2 focus-visible:outline-leaf disabled:opacity-45 disabled:hover:ring-edge"
    >
      <span className="font-display font-bold text-ink">{title}</span>
      <span className="text-xs text-ink-soft">{sub}</span>
    </button>
  );
}

// Pinned to the bottom of the viewport so feedback is always visible, even when
// the action that triggered it is scrolled off-screen.
export function Toast({ busy, error, onDismiss, onRetry }: { busy?: string; error?: string; onDismiss?: () => void; onRetry?: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[55] flex justify-center px-4">
      <AnimatePresence>
        {busy && (
          <motion.p
            key="busy"
            role="status"
            className="pointer-events-auto rounded-full bg-ink/90 px-4 py-2 text-sm font-semibold text-paper shadow-lg backdrop-blur"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: PAGE_EASE }}
          >
            {busy}…
          </motion.p>
        )}
        {!busy && error && (
          <motion.div
            key="error"
            role="alert"
            className="pointer-events-auto flex max-w-md items-start gap-3 rounded-xl bg-paper px-4 py-3 text-sm text-ink shadow-lg ring-1 ring-edge"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: PAGE_EASE }}
          >
            <span className="flex-1">{error}</span>
            {onRetry && (
              <button onClick={onRetry} className="shrink-0 rounded-full bg-leaf-deep px-3 py-1 text-xs font-bold text-paper transition hover:bg-leaf focus-visible:outline-2 focus-visible:outline-leaf">
                Retry
              </button>
            )}
            {onDismiss && (
              <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 rounded-full px-1 text-ink-soft transition hover:text-ink focus-visible:outline-2 focus-visible:outline-leaf">
                ✕
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
