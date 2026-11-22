import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Feather, Sparkles } from 'lucide-react';
import type { DailyQuote } from '../../content/verifiedQuotes';
import { useToast } from '../ui/ToastProvider';

interface DailyQuoteApiPayload {
  date: string;
  timezone: string;
  cycleNumber: number;
  remainingInCycle: number;
  totalVerified: number;
  nextUpdateAtIso: string;
  quote: DailyQuote;
}

interface DailyQuoteCardProps {
  variant?: 'hero' | 'compact';
  className?: string;
}

function formatVietnamDateBadge(dateIso: string): string {
  const parts = dateIso.split('-');
  if (parts.length !== 3) return dateIso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Shared Daily Quote component ("DANH NGÔN HÔM NAY") backed by GET /api/quotes/today.
 * - Identical quote across all users, devices, and page refreshes on the same Vietnam calendar day.
 * - Automatically refreshes at 00:00 Asia/Ho_Chi_Minh if the user keeps the tab open.
 * - Zero fabricated fallback quotes: shows a clean loading or retry state if the API is unreachable.
 */
export function DailyQuoteCard({ variant = 'hero', className = '' }: DailyQuoteCardProps) {
  const { showToast } = useToast();
  const [payload, setPayload] = useState<DailyQuoteApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchTodayQuote = useCallback(async () => {
    try {
      const res = await fetch('/api/quotes/today', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Không thể tải danh ngôn hôm nay.');
      }
      const data = (await res.json()) as DailyQuoteApiPayload;
      setPayload(data);
      setError(null);
    } catch {
      setError('Không thể kết nối máy chủ để tải Danh ngôn hôm nay.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayQuote();
  }, [fetchTodayQuote]);

  // Schedule automatic refresh right after 00:00 Asia/Ho_Chi_Minh + sync on tab visibility
  useEffect(() => {
    if (!payload?.nextUpdateAtIso) return;
    const msUntilMidnight = new Date(payload.nextUpdateAtIso).getTime() - Date.now();
    const delay = Math.max(1500, Math.min(msUntilMidnight + 1200, 24 * 60 * 60 * 1000));
    const timer = window.setTimeout(() => {
      fetchTodayQuote();
    }, delay);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTodayQuote();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [payload?.nextUpdateAtIso, fetchTodayQuote]);

  const handleCopy = async () => {
    if (!payload?.quote) return;
    const { content, author, source } = payload.quote;
    const attribution = author ? `${author} (${source})` : source;
    const text = `“${content}” — ${attribution}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast('Đã sao chép danh ngôn hôm nay vào bộ nhớ tạm.', { variant: 'success' });
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      showToast('Không thể sao chép tự động trên trình duyệt này.', { variant: 'warning' });
    }
  };

  if (loading) {
    return (
      <div
        className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 ${
          variant === 'hero' ? 'p-4 sm:p-5 mt-4' : 'p-5'
        } ${className}`}
        aria-busy="true"
      >
        <div className="h-3 w-28 rounded bg-[var(--color-surface-muted)] animate-pulse" />
        <div className="mt-3 h-4 w-full rounded bg-[var(--color-surface-muted)] animate-pulse" />
        <div className="mt-2 h-4 w-3/4 rounded bg-[var(--color-surface-muted)] animate-pulse" />
      </div>
    );
  }

  if (error || !payload?.quote) {
    return (
      <div
        className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/88 ${
          variant === 'hero' ? 'p-4 mt-4' : 'p-5'
        } ${className}`}
      >
        <div className="text-xs text-[var(--color-text-muted)] flex items-center justify-between gap-3">
          <span>{error || 'Chưa có danh ngôn cho hôm nay.'}</span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchTodayQuote();
            }}
            className="font-semibold text-[var(--color-primary)] hover:underline cursor-pointer shrink-0"
          >
            Tải lại
          </button>
        </div>
      </div>
    );
  }

  const { quote, date } = payload;
  const attributionLabel = quote.author ? quote.author : quote.source;
  const secondarySource = quote.author ? quote.source : null;

  if (variant === 'compact') {
    return (
      <aside
        aria-label="Danh ngôn hôm nay"
        className={`rounded-2xl p-5 sm:p-6 surface-card relative overflow-hidden ${className}`}
      >
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1"
          style={{ backgroundColor: 'var(--color-gold)' }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 pl-2">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--color-primary)]">
            <Feather className="h-3.5 w-3.5 text-[var(--color-gold)]" aria-hidden="true" />
            <span>Danh ngôn hôm nay</span>
            <Sparkles className="h-3 w-3 text-[var(--color-gold)] opacity-80" aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
            <span className="font-mono-num">{formatVietnamDateBadge(date)}</span>
            <span aria-hidden="true">·</span>
            <span>{quote.category}</span>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Sao chép danh ngôn hôm nay"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/70 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <blockquote className="mt-3 pl-2 font-reading text-base sm:text-[1.06rem] italic leading-relaxed text-[var(--color-text)]">
          “{quote.content}”
        </blockquote>

        <div className="mt-2.5 pl-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-muted)]">
          <span className="font-semibold text-[var(--color-text)]">— {attributionLabel}</span>
          {secondarySource && (
            <>
              <span aria-hidden="true">·</span>
              <span>{secondarySource}</span>
            </>
          )}
          {quote.sourceUrl && (
            <a
              href={quote.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline ml-1"
            >
              <span>Nguồn</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </aside>
    );
  }

  // Hero editorial variant (replaces old static slogan inside HomePage Hero)
  return (
    <figure
      aria-label="Danh ngôn hôm nay"
      className={`mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/92 backdrop-blur-[2px] px-4 py-3.5 sm:px-5 sm:py-4 relative overflow-hidden ${className}`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: 'var(--color-gold)' }}
      />
      <div className="flex items-center justify-between gap-2 pl-1.5">
        <div className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.11em] text-[var(--color-primary)]">
          <Feather className="h-3 w-3 text-[var(--color-gold)]" aria-hidden="true" />
          <span>Danh ngôn hôm nay</span>
          <Sparkles className="h-2.5 w-2.5 text-[var(--color-gold)] opacity-80" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
          <span className="font-mono-num">{formatVietnamDateBadge(date)}</span>
          <button
            type="button"
            onClick={handleCopy}
            title="Sao chép danh ngôn"
            aria-label="Sao chép danh ngôn hôm nay"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      </div>

      <blockquote className="mt-2 pl-1.5 font-reading text-sm sm:text-[0.98rem] italic leading-[1.68] text-[var(--color-text)]">
        “{quote.content}”
      </blockquote>

      <figcaption className="mt-2 pl-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-text-muted)]">
        <span className="font-semibold text-[var(--color-text)]">— {attributionLabel}</span>
        {secondarySource && (
          <>
            <span aria-hidden="true">·</span>
            <span className="line-clamp-1">{secondarySource}</span>
          </>
        )}
        {quote.sourceUrl && (
          <a
            href={quote.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
          >
            <span>Nguồn</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </figcaption>
    </figure>
  );
}
