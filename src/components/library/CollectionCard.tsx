import React from 'react';
import { ArrowRight, BookOpen, CheckCircle2, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { Link } from '../../lib/router';
import { loadReadingScrollPosition } from '../../lib/storage';
import { LibraryCollection, LibraryDocument } from '../../lib/types';
import { HybridMediaCard } from '../visuals/ThemeSyncedHero';

interface CollectionCardProps {
  collection: LibraryCollection;
  documents: LibraryDocument[];
  expanded: boolean;
  onToggleExpand: () => void;
  onFilterByCollection?: (collectionId: string) => void;
}

export function CollectionCard({
  collection,
  documents,
  expanded,
  onToggleExpand,
  onFilterByCollection,
}: CollectionCardProps) {
  // Resolve ordered published documents belonging to this collection
  const docById = new Map(documents.map((d) => [d.id, d]));
  const orderedDocs = collection.documentIds
    .map((id) => docById.get(id))
    .filter((d): d is LibraryDocument => Boolean(d && d.status === 'published'));

  if (orderedDocs.length === 0) return null;

  const totalMinutes = orderedDocs.reduce((sum, doc) => sum + doc.readingMinutes, 0);
  const completedCount = orderedDocs.filter((doc) => {
    const pos = loadReadingScrollPosition(doc.id);
    return pos && pos.scrollPercent >= 85;
  }).length;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-all hover:border-[var(--color-primary)]/45">
      <div className="relative overflow-hidden border-b border-[var(--color-border)]/70">
        <HybridMediaCard
          src={collection.coverImage}
          alt={collection.coverAlt}
          title={collection.title}
          aspect="16/9"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-20 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(20, 14, 18, 0.72), transparent)',
          }}
          aria-hidden="true"
        />
        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-white/95">
          <span className="font-semibold tracking-wide">
            {orderedDocs.length} bài đọc theo trình tự
          </span>
          <span className="inline-flex items-center gap-1 font-mono-num">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            ~{totalMinutes} phút
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display lib-scale-h3 font-bold text-[var(--color-text)]">
          {collection.title}
        </h3>
        <p className="mt-1.5 lib-scale-body text-[var(--color-text-muted)]">
          {collection.description}
        </p>

        {completedCount > 0 && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-gold)]">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Đã hoàn thành {completedCount}/{orderedDocs.length} bài trong hành trình
          </p>
        )}

        <div className="mt-4 pt-3.5 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
          >
            {expanded ? (
              <>
                Thu gọn lộ trình đọc <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Xem trình tự {orderedDocs.length} bài đọc <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>

          <div className="flex items-center gap-3">
            {onFilterByCollection && (
              <button
                type="button"
                onClick={() => onFilterByCollection(collection.id)}
                className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] cursor-pointer"
              >
                Lọc danh sách
              </button>
            )}
            <Link
              to={`/library/${orderedDocs[0].id}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors"
            >
              Bắt đầu <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Ordered reading itinerary */}
        {expanded && (
          <ol className="mt-4 space-y-2 border-t border-[var(--color-border)]/70 pt-3.5">
            {orderedDocs.map((doc, idx) => (
              <li key={doc.id}>
                <Link
                  to={`/library/${doc.id}`}
                  className="group flex items-start gap-2.5 rounded-xl px-2.5 py-2 hover:bg-[var(--color-surface-elevated)] transition-colors"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[11px] font-bold font-mono-num text-[var(--color-primary)]">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="lib-scale-small font-medium text-[var(--color-text)] group-hover:text-[var(--color-primary)]">
                      {doc.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)] flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span>{doc.category}</span>
                      <span>·</span>
                      <span>{doc.readingMinutes} phút</span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </article>
  );
}
