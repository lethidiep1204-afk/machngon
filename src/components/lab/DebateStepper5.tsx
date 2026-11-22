import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { DebateStepItem } from '../../lib/types';

const STEP_LABELS: Array<{ key: DebateStepItem['key']; vi: string; shortVi: string }> = [
  { key: 'identify', vi: 'Nắm ý chính', shortVi: 'Ý chính' },
  { key: 'analyze', vi: 'Tách lý lẽ', shortVi: 'Lý lẽ' },
  { key: 'challenge', vi: 'Tìm điểm hở', shortVi: 'Điểm hở' },
  { key: 'synthesize', vi: 'Đối chiếu mạch', shortVi: 'Đối chiếu' },
  { key: 'respond', vi: 'Trả lời gợi mở', shortVi: 'Gợi mở' },
];

export function DebateStepperLive({ activeIndex }: { activeIndex: number }) {
  const safeIdx = Math.min(Math.max(activeIndex, 0), 4);
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl p-4 sm:p-5 surface-card space-y-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-primary)]">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>
            Đang phân tích lập luận ({safeIdx + 1}/5)…
          </span>
        </div>
        <span className="font-mono-num text-xs text-[var(--color-text-muted)]">
          Bước {safeIdx + 1}: {STEP_LABELS[safeIdx]?.vi}
        </span>
      </div>

      <ol className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {STEP_LABELS.map((step, idx) => {
          const completed = idx < safeIdx;
          const current = idx === safeIdx;
          return (
            <li
              key={step.key}
              className={`rounded-xl px-2 py-2.5 border text-center transition-colors duration-200 ${
                current
                  ? 'border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface)_90%)]'
                  : completed
                    ? 'border-[var(--color-border)] bg-[var(--color-surface-muted)]/60'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)]/40 opacity-60'
              }`}
            >
              <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-[var(--color-text)]">
                {completed ? (
                  <Check className="h-3 w-3 text-[var(--color-primary)] shrink-0" />
                ) : (
                  <span className="font-mono-num text-[var(--color-primary)]">{idx + 1}.</span>
                )}
                <span className="truncate hidden sm:inline">{step.vi}</span>
                <span className="truncate sm:hidden">{step.shortVi}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function DebateStepperAccordion({ steps }: { steps: DebateStepItem[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!steps || steps.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]/45 transition-colors"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
          <span className="font-semibold text-[var(--color-text)]">
            Cách AI suy luận (5 bước)
          </span>
          <span className="hidden sm:inline text-[11px] text-[var(--color-text-muted)]">
            Nắm ý chính → Tách lý lẽ → Tìm điểm hở → Đối chiếu → Gợi mở
          </span>
        </div>
        <span className="inline-flex items-center gap-1 shrink-0 text-[11px] text-[var(--color-primary)] whitespace-nowrap">
          <span>{expanded ? 'Thu gọn' : 'Xem 5 bước'}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-[var(--color-border)]"
          >
            <ol className="divide-y divide-[var(--color-border)]">
              {steps.map((step, index) => {
                const friendlyLabel =
                  STEP_LABELS.find((item) => item.key === step.key)?.vi || step.vietnameseTitle;
                return (
                  <li
                    key={step.key}
                    className="px-4 py-3 text-xs leading-relaxed bg-[var(--color-surface)]/80"
                  >
                    <div className="flex items-center gap-2 font-semibold text-[var(--color-text)]">
                      <span className="font-mono-num text-[var(--color-primary)]">
                        0{index + 1}.
                      </span>
                      <span>{friendlyLabel}</span>
                    </div>
                    <p className="mt-1 max-w-prose font-reading text-[0.86rem] leading-[1.65] text-[var(--color-text-muted)]">
                      {step.summary}
                    </p>
                  </li>
                );
              })}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
