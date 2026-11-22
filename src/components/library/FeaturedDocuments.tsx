import React from 'react';
import { ArrowRight } from 'lucide-react';
import { LibraryDocument } from '../../lib/types';
import { DocumentCard } from './DocumentCard';

interface FeaturedDocumentsProps {
  documents: LibraryDocument[];
  onViewAll: () => void;
}

export function FeaturedDocuments({ documents, onViewAll }: FeaturedDocumentsProps) {
  const featured = documents.filter((doc) => doc.featured).slice(0, 6);
  if (featured.length === 0) return null;

  return (
    <section aria-labelledby="featured-docs-heading" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-gold)]">
            Tuyển chọn học thuật
          </p>
          <h2
            id="featured-docs-heading"
            className="mt-1 font-display lib-scale-h2 font-bold text-[var(--color-text)]"
          >
            Tài liệu nổi bật
          </h2>
          <p className="mt-1 lib-scale-body text-[var(--color-text-muted)]">
            Những bài đọc nền tảng tiêu biểu trải đều qua các lĩnh vực tri thức cốt lõi.
          </p>
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
        >
          Xem toàn bộ kho tài liệu
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {featured.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} />
        ))}
      </div>
    </section>
  );
}
