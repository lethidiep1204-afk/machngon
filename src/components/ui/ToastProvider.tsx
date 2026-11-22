import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  message: string;
  title?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (
    message: string,
    options?: { title?: string; variant?: ToastVariant; durationMs?: number }
  ) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (
      message: string,
      options?: { title?: string; variant?: ToastVariant; durationMs?: number }
    ) => {
      const id = `toast_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const variant = options?.variant ?? 'success';
      const durationMs = options?.durationMs ?? 3800;

      setToasts((prev) => [...prev.slice(-3), { id, message, title: options?.title, variant }]);

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, durationMs);
    },
    []
  );

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Accessible floating toast stack */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-5 right-5 z-[60] flex w-[calc(100vw-2.5rem)] max-w-sm flex-col gap-2.5 pointer-events-none"
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const Icon =
              toast.variant === 'error' || toast.variant === 'warning'
                ? AlertCircle
                : toast.variant === 'info'
                  ? Info
                  : CheckCircle2;

            const accentColor =
              toast.variant === 'error'
                ? 'var(--color-danger)'
                : toast.variant === 'warning'
                  ? 'var(--color-gold)'
                  : toast.variant === 'info'
                    ? 'var(--color-primary)'
                    : 'var(--color-success)';

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                role="status"
                className="pointer-events-auto flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-xs text-[var(--color-text)]"
                style={{ boxShadow: 'var(--shadow-float)' }}
              >
                <Icon
                  className="h-4 w-4 shrink-0 mt-0.5"
                  style={{ color: accentColor }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  {toast.title && (
                    <div className="font-semibold text-[var(--color-text)] mb-0.5">
                      {toast.title}
                    </div>
                  )}
                  <div className="leading-relaxed text-[var(--color-text-muted)]">
                    {toast.message}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Đóng thông báo"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: () => undefined,
      dismissToast: () => undefined,
    };
  }
  return ctx;
}
