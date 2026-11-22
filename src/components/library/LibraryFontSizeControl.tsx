import React from 'react';
import { Minus, Plus, Type } from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import {
  READING_FONT_SIZE_OPTIONS,
  ReadingFontSize,
} from '../../lib/storage';

interface LibraryFontSizeControlProps {
  /** Compact mode for tight toolbars (DocumentDetailPage header / Focus Mode) */
  compact?: boolean;
  className?: string;
}

export function LibraryFontSizeControl({
  compact = false,
  className = '',
}: LibraryFontSizeControlProps) {
  const { layoutPrefs, updateLayoutPrefs } = useApp();
  const currentSize: ReadingFontSize = layoutPrefs.readingFontSize ?? 'md';
  const currentIdx = Math.max(
    0,
    READING_FONT_SIZE_OPTIONS.findIndex((opt) => opt.key === currentSize)
  );
  const currentMeta = READING_FONT_SIZE_OPTIONS[currentIdx] ?? READING_FONT_SIZE_OPTIONS[1];

  const handleSelect = (size: ReadingFontSize) => {
    updateLayoutPrefs({ readingFontSize: size });
  };

  const handleStep = (delta: -1 | 1) => {
    const nextIdx = Math.min(
      READING_FONT_SIZE_OPTIONS.length - 1,
      Math.max(0, currentIdx + delta)
    );
    const next = READING_FONT_SIZE_OPTIONS[nextIdx];
    if (next) {
      handleSelect(next.key);
    }
  };

  if (compact) {
    return (
      <div
        role="group"
        aria-label="Điều chỉnh độ lớn chữ đọc"
        className={`inline-flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 ${className}`}
      >
        <button
          type="button"
          onClick={() => handleStep(-1)}
          disabled={currentIdx === 0}
          aria-label="Giảm cỡ chữ"
          title="Giảm cỡ chữ"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>

        <div className="flex items-center">
          {READING_FONT_SIZE_OPTIONS.map((opt) => {
            const active = opt.key === currentSize;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleSelect(opt.key)}
                aria-pressed={active}
                title={`Cỡ chữ ${opt.label} (${opt.percentLabel})`}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {opt.shortLabel}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => handleStep(1)}
          disabled={currentIdx === READING_FONT_SIZE_OPTIONS.length - 1}
          aria-label="Tăng cỡ chữ"
          title="Tăng cỡ chữ"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Điều chỉnh cỡ chữ trang Thư viện"
      className={`inline-flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 ${className}`}
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] whitespace-nowrap">
        <Type className="h-3.5 w-3.5 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
        <span>Cỡ chữ:</span>
      </span>

      <div className="inline-flex items-center gap-0.5 rounded-lg bg-[var(--color-bg)]/80 p-0.5 border border-[var(--color-border)]/80">
        <button
          type="button"
          onClick={() => handleStep(-1)}
          disabled={currentIdx === 0}
          aria-label="Giảm cỡ chữ"
          title="Giảm cỡ chữ"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>

        {READING_FONT_SIZE_OPTIONS.map((opt) => {
          const active = opt.key === currentSize;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleSelect(opt.key)}
              aria-pressed={active}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] font-semibold'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {opt.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => handleStep(1)}
          disabled={currentIdx === READING_FONT_SIZE_OPTIONS.length - 1}
          aria-label="Tăng cỡ chữ"
          title="Tăng cỡ chữ"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <span className="font-mono-num text-[11px] font-medium text-[var(--color-text-muted)] tabular-nums">
        {currentMeta.percentLabel}
      </span>
    </div>
  );
}
