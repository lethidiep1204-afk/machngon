import React, { useMemo } from 'react';
import { ArrowRight, BookOpenCheck, Clock } from 'lucide-react';
import { Link } from '../../lib/router';
import { getAllReadingProgress } from '../../lib/storage';
import { LibraryDocument } from '../../lib/types';
import { HybridMediaCard } from '../visuals/ThemeSyncedHero';

interface ContinueReadingProps {
  publishedDocuments: LibraryDocument[];
}

export function ContinueReading({ publishedDocuments }: ContinueReadingProps) {
  const items = useMemo(() => {
    const progressMap = getAllReadingProgress();
    const docById = new Map(publishedDocuments.map((d) => [d.id, d]));

    return Object.entries(progressMap)
      .filter(([, state]) => state && state.scrollPercent >= 5)
      .map(([docId, state]) => {
        const doc = docById.get(docId);
        if (!doc) return null;
        return { doc, state };
      })
      .filter((entry): entry is { doc: LibraryDocument; state: NonNullable<typeof progressMap[string]> } => entry !== null)
      .sort((a, b) => b.state.updatedAt.localeCompare(a.state.updatedAt))
      .slice(0, 3);
  }, [publishedDocuments]);

  // Gracefully hide section if the user has no real reading progress yet
  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="continue-reading-heading" className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-gold)]">
            Đang đọc gần đây
          </p>
          <h2
            id="continue-reading-heading"
            className="mt-1 font-display lib-scale-h2 font-bold text-[var(--color-text)]"
          >
            Tiếp tục khám phá
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map(({ doc, state }) => {
          const pct = Math.min(100, Math.max(5, Math.round(state.scrollPercent)));
          const isFinished = pct >= 95;
          return (
            <Link
              key={doc.id}
              to={`/library/${doc.id}`}
              className="group flex gap-3.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 hover:border-[var(--color-primary)]/50 transition-all"
            >
              <div className="w-20 shrink-0 overflow-hidden rounded-xl border border-[var(--color-border)]/70 self-start">
                <HybridMediaCard
                  src={doc.coverImage}
                  alt={doc.coverAlt}
                  title={doc.title}
                  aspect="4/3"
                  className="transition-transform duration-300 group-hover:scale-105"
                />
              </div>

              <div className="flex flex-1 flex-col min-w-0">
                <span className="text-[11px] font-medium text-[var(--color-primary)] truncate">
                  {doc.category}
                </span>
                <h3 className="mt-0.5 font-display lib-scale-small font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-2">
                  {doc.title}
                </h3>

                <div className="mt-auto pt-2.5">
                  <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)] mb-1">
                    <span className="inline-flex items-center gap-1 font-mono-num">
                      {isFinished ? (
                        <BookOpenCheck className="h-3 w-3 text-[var(--color-gold)]" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      {isFinished ? 'Đã đọc xong' : `Đã đọc ${pct}%`}
                    </span>
                    <span className="inline-flex items-center gap-0.5 font-semibold text-[var(--color-primary)]">
                      {isFinished ? 'Đọc lại' : 'Đọc tiếp'}
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-elevated)]">
                    <div
                      className="h-full rounded-full transition-[width]"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: 'var(--color-primary)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
