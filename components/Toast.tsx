"use client";

// Toast — a tiny app-wide notification system used to surface the result of
// mutations (e.g. the editor's save/delete) without blocking the UI.
//
// <ToastProvider> wraps the app in the root layout and exposes a `toast(message,
// variant?)` function via the useToast() hook. It renders a fixed, aria-live
// region of stacked toasts that auto-dismiss. Kept dependency-free and theme-token
// styled (foreground/background) so it works in light + dark mode and is reusable
// by any client component (the editor here, ShareToggle later).

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastVariant = "success" | "error";
type ToastItem = { id: number; message: string; variant: ToastVariant };

/** The function components call to raise a toast. */
type ShowToast = (message: string, variant?: ToastVariant) => void;

const ToastContext = createContext<ShowToast | null>(null);

// How long a toast stays on screen before auto-dismissing.
const TOAST_DURATION_MS = 3000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Monotonic id source — a ref so it survives re-renders without being state.
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ShowToast>(
    (message, variant = "success") => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, variant }]);
      setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Live region: additions are announced politely. pointer-events-none on the
          container so it never blocks clicks; each toast re-enables them for its
          dismiss button. */}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
              t.variant === "error" ? "bg-red-600 text-white" : "bg-foreground text-background"
            }`}
          >
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="text-base leading-none opacity-70 transition-opacity hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Raise a toast from any client component. Throws if used outside the provider. */
export function useToast(): ShowToast {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
