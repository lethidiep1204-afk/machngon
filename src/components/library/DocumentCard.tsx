import React from 'react';
import { ArrowRight, Bookmark, CheckCircle2, Clock } from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import { getDifficultyLabel, isDocumentVerified } from '../../lib/library/validation';
import { Link } from '../../lib/router';
import { loadReadingScrollPosition } from '../../lib/storage';
import { LibraryDocument } from '../../lib/types';
import { useToast } from '../ui/ToastProvider';
import { HybridMediaCard } from '../visuals/ThemeSyncedHero';

interface DocumentCardProps {
  doc: LibraryDocument;
  compact?: boolean;
}

export function DocumentCard({ doc, compact = false }: DocumentCardProps) {
  const { savedDocIds, toggleSavedDoc } = useApp();
  const { showToast } = useToast();
  const isSaved = savedDocIds.includes(doc.id);
  const progress = loadReadingScrollPosition(doc.id);
  const readPct = progress ? Math.round(progress.scrollPercent) : 0;
  const verified = isDocumentVerified(doc);
  const difficultyLabel = getDifficultyLabel(doc.difficulty);

  return (
    <article className="group h-full flex flex-col overflow-hidden rounded-2xl surface-card surface-card-interactive hover:-translate-y-0.5">
      {/* 4:3 Editorial Cover Image */}
      <div className="relative overflow-hidden border-b border-[var(--color-border)]/70">
        <Link to={`/library/${doc.id}`} className="block overflow-hidden">
          <HybridMediaCard
            src={doc.coverImage}
            alt={doc.coverAlt}
            title={doc.title}
            aspect="4/3"
            className="transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
          />
        </Link>
        <button
          type="button"
          onClick={() => {
            toggleSavedDoc(doc.id);
            showToast(
              isSaved
                ? `Đã bỏ lưu "${doc.title}" khỏi tủ sách.`
                : `Đã lưu "${doc.title}" vào tủ sách cá nhân.`,
              { variant: isSaved ? 'info' : 'success' }
            );
          }}
          aria-label={isSaved ? `Bỏ lưu tài liệu ${doc.title}` : `Lưu tài liệu ${doc.title}`}
          aria-pressed={isSaved}
          className={`absolute top-3 right-3 flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
            isSaved
              ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]'
              : 'bg-[var(--color-surface)]/92 text-[var(--color-text)] border-[var(--color-border)] hover:text-[var(--color-primary)]'
          }`}
        >
          <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
        </button>

        {readPct >= 5 && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-black/20" aria-hidden="true">
            <div
              className="h-full transition-[width]"
              style={{ width: `${Math.min(100, readPct)}%`, backgroundColor: 'var(--color-gold)' }}
            />
          </div>
        )}
      </div>

      {/* Card Body — Zero-Pill Metadata Discipline */}
      <div className={`flex flex-1 flex-col ${compact ? 'p-4' : 'p-5'}`}>
        <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-[var(--color-text-muted)]">
          <span className="truncate text-[var(--color-primary)]">{doc.category}</span>
          <span className="shrink-0 flex items-center gap-1.5">
            <span>{difficultyLabel}</span>
            {verified && (
              <span
                className="inline-flex items-center text-[var(--color-gold)]"
                title="Nguồn tham khảo học thuật đã kiểm chứng"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-label="Đã kiểm chứng nguồn" />
              </span>
            )}
          </span>
        </div>

        <Link to={`/library/${doc.id}`} className="mt-2 block">
          <h3 className="font-display lib-scale-h3 font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-2">
            {doc.title}
          </h3>
        </Link>

        <p className="mt-2 flex-1 font-reading lib-scale-body text-[var(--color-text-muted)] line-clamp-3">
          {doc.excerpt}
        </p>

        {/* Bottom Reading Time + CTA */}
        <div className="mt-4 pt-3.5 border-t border-[var(--color-border)] flex items-center justify-between gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-[var(--color-text-muted)] font-mono-num">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {readPct >= 5 ? `${readPct}% · ${doc.readingMinutes} phút` : `${doc.readingMinutes} phút đọc`}
          </span>

          <Link
            to={`/library/${doc.id}`}
            className="inline-flex items-center gap-1 font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors whitespace-nowrap shrink-0"
          >
            {readPct >= 5 ? 'Đọc tiếp' : 'Khám phá'}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
