import React from 'react';
import { Clock, RefreshCw } from 'lucide-react';

interface RateLimitBannerProps {
  message: string;
  secondsLeft: number;
  onRetryNow: () => void;
}

/**
 * Calm champagne/gold warning banner rendered directly above the Composer on HTTP 429.
 * Reads Retry-After countdown, preserves 100% of user text in Composer, and unlocks with "Thử lại ngay".
 */
export function RateLimitBanner({
  message,
  secondsLeft,
  onRetryNow,
}: RateLimitBannerProps) {
  const readyToRetry = secondsLeft <= 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-3 rounded-xl px-4 py-3 border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      style={{
        backgroundColor: 'var(--color-warn-bg)',
        borderColor: 'var(--color-warn-border)',
        color: 'var(--color-warn-text)',
      }}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <Clock className="h-4.5 w-4.5 shrink-0 mt-0.5 text-[var(--color-gold)]" />
        <div className="text-xs leading-relaxed">
          <div className="font-semibold">
            {readyToRetry
              ? 'Đã sẵn sàng gửi lại phân tích'
              : `Tạm nghỉ nhịp phân tích (HTTP 429) · còn ${secondsLeft} giây`}
          </div>
          <p className="mt-0.5 text-[var(--color-text-muted)]">{message}</p>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-2">
        {readyToRetry ? (
          <button
            type="button"
            onClick={onRetryNow}
            className="btn-primary !min-h-9 !px-3.5 !py-1.5 !text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Thử lại ngay
          </button>
        ) : (
          <span
            aria-label={`Đếm ngược ${secondsLeft} giây`}
            className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-mono-num font-semibold border border-[var(--color-warn-border)] bg-[var(--color-surface)]"
          >
            {String(secondsLeft).padStart(2, '0')}s
          </span>
        )}
      </div>
    </div>
  );
}
