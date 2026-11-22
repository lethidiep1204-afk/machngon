import React from 'react';
import {
  ArrowRight,
  Compass,
  Feather,
  Landmark,
  Languages,
  Layers,
  Scale,
} from 'lucide-react';
import { normalizeCategoryName } from '../../lib/library/validation';
import { DocumentCategory, LibraryCategoryMeta, LibraryDocument } from '../../lib/types';

interface CategoryGridProps {
  categories: LibraryCategoryMeta[];
  publishedDocuments: LibraryDocument[];
  activeCategory: 'Tất cả' | DocumentCategory;
  onSelectCategory: (category: DocumentCategory) => void;
}

const CATEGORY_ICON_MAP = {
  languages: Languages,
  feather: Feather,
  landmark: Landmark,
  scale: Scale,
  compass: Compass,
  layers: Layers,
} as const;

export function CategoryGrid({
  categories,
  publishedDocuments,
  activeCategory,
  onSelectCategory,
}: CategoryGridProps) {
  return (
    <section aria-labelledby="category-grid-heading" className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-gold)]">
          Cấu trúc tri thức
        </p>
        <h2
          id="category-grid-heading"
          className="mt-1 font-display lib-scale-h2 font-bold text-[var(--color-text)]"
        >
          Khám phá theo lĩnh vực
        </h2>
        <p className="mt-1 lib-scale-body text-[var(--color-text-muted)]">
          Chọn một lĩnh vực để lọc nhanh kho học liệu theo mối quan tâm học thuật của bạn.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const Icon = CATEGORY_ICON_MAP[cat.iconKey] ?? Layers;
          const count = publishedDocuments.filter(
            (doc) => normalizeCategoryName(doc.category) === cat.name
          ).length;
          const isSelected = activeCategory === cat.name;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.name)}
              aria-pressed={isSelected}
              className={`group flex flex-col justify-between text-left rounded-2xl border p-5 transition-all cursor-pointer ${
                isSelected
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/50 hover:-translate-y-0.5'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                      isSelected
                        ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                        : 'bg-[var(--color-surface-elevated)] text-[var(--color-primary)] group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-on-primary)]'
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold font-mono-num text-[var(--color-text-muted)]">
                    {count} bài đọc
                  </span>
                </div>

                <h3 className="mt-4 font-display lib-scale-h3 font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                  {cat.name}
                </h3>

                <p className="mt-1.5 lib-scale-body text-[var(--color-text-muted)] line-clamp-3">
                  {cat.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--color-border)]/80 flex items-center justify-between text-xs font-semibold text-[var(--color-primary)]">
                <span>{isSelected ? 'Đang lọc lĩnh vực này' : 'Khám phá lĩnh vực'}</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
