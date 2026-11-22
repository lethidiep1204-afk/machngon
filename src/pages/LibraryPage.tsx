import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpenCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  X,
} from 'lucide-react';
import { WorkspaceShell } from '../components/layout/AppShell';
import { CategoryGrid } from '../components/library/CategoryGrid';
import { CollectionCard } from '../components/library/CollectionCard';
import { ConceptPopoverDialog } from '../components/library/ConceptTooltip';
import { ContinueReading } from '../components/library/ContinueReading';
import { DocumentCard } from '../components/library/DocumentCard';
import { FeaturedDocuments } from '../components/library/FeaturedDocuments';
import { LibraryFontSizeControl } from '../components/library/LibraryFontSizeControl';
import { LibraryHero } from '../components/library/LibraryHero';
import { LibrarySearch } from '../components/library/LibrarySearch';
import { EmptyStateCard } from '../components/ui/EditorialPrimitives';
import { useToast } from '../components/ui/ToastProvider';
import { Pagination } from '../components/ui/UiControls';
import { EDITORIAL_TOPIC_ROADMAP } from '../content/library/categories';
import { LIBRARY_CONCEPTS } from '../content/library/concepts';
import { useApp } from '../lib/AppContext';
import { searchDocuments } from '../lib/library/search';
import { normalizeCategoryName } from '../lib/library/validation';
import { Link, useRouter } from '../lib/router';
import { DocumentCategory, DocumentDifficulty, LibraryConcept } from '../lib/types';

const PAGE_SIZE = 9;

type SortMode = 'default' | 'shortest' | 'newest';

function parseDateValue(dateStr: string): number {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts.map(Number);
    return new Date(yyyy, mm - 1, dd).getTime() || 0;
  }
  return Date.parse(dateStr) || 0;
}

export function LibraryPage() {
  const { publishedDocuments, visibleCategories, publishedCollections } = useApp();
  const { showToast } = useToast();
  const { search: urlSearch } = useRouter();

  const initialParams = useMemo(() => new URLSearchParams(urlSearch), [urlSearch]);

  const [rawQuery, setRawQuery] = useState(() => initialParams.get('q') ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(() => initialParams.get('q') ?? '');
  const [activeCategory, setActiveCategory] = useState<'Tất cả' | DocumentCategory>(() => {
    const cat = initialParams.get('category');
    return cat ? normalizeCategoryName(cat) : 'Tất cả';
  });
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    () => initialParams.get('collection')
  );
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | DocumentDifficulty>('all');
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [page, setPage] = useState(1);

  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(
    publishedCollections[0]?.id ?? null
  );
  const [selectedConcept, setSelectedConcept] = useState<LibraryConcept | null>(null);
  const [roadmapOpen, setRoadmapOpen] = useState(false);

  const catalogRef = useRef<HTMLElement | null>(null);
  const collectionsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(rawQuery);
      setPage(1);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [rawQuery]);

  const scrollToCatalog = () => {
    catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToCollections = () => {
    collectionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const activeCollection = useMemo(
    () => publishedCollections.find((c) => c.id === activeCollectionId) ?? null,
    [publishedCollections, activeCollectionId]
  );

  const filteredDocuments = useMemo(() => {
    let list = debouncedQuery.trim()
      ? searchDocuments(publishedDocuments, debouncedQuery, LIBRARY_CONCEPTS)
      : [...publishedDocuments];

    if (activeCategory !== 'Tất cả') {
      list = list.filter((doc) => normalizeCategoryName(doc.category) === activeCategory);
    }

    if (activeCollection) {
      const idSet = new Set(activeCollection.documentIds);
      list = list.filter((doc) => idSet.has(doc.id));
    }

    if (difficultyFilter !== 'all') {
      list = list.filter((doc) => (doc.difficulty ?? 'explore') === difficultyFilter);
    }

    if (sortMode === 'shortest') {
      list = [...list].sort((a, b) => a.readingMinutes - b.readingMinutes);
    } else if (sortMode === 'newest') {
      list = [...list].sort(
        (a, b) => parseDateValue(b.publishedDate) - parseDateValue(a.publishedDate)
      );
    }

    return list;
  }, [
    publishedDocuments,
    debouncedQuery,
    activeCategory,
    activeCollection,
    difficultyFilter,
    sortMode,
  ]);

  const isSearching = debouncedQuery.trim().length > 0;
  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedDocuments = filteredDocuments.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const resetAllFilters = () => {
    setRawQuery('');
    setDebouncedQuery('');
    setActiveCategory('Tất cả');
    setActiveCollectionId(null);
    setDifficultyFilter('all');
    setSortMode('default');
    setPage(1);
  };

  const publishedRoadmapCount = EDITORIAL_TOPIC_ROADMAP.filter((t) =>
    Boolean(t.publishedDocId && publishedDocuments.some((d) => d.id === t.publishedDocId))
  ).length;

  return (
    <WorkspaceShell>
      <div className="mx-auto max-w-[1220px] px-5 sm:px-8 lg:px-10 py-8 space-y-10">
        {/* Top Reading Comfort Bar: Synced Font Size Control (persisted in localStorage) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            Tùy chỉnh độ lớn chữ để đọc thoải mái trên mọi thiết bị — đồng bộ cả trang Thư viện và bài đọc chi tiết.
          </p>
          <LibraryFontSizeControl />
        </div>

        {/* 1. Library Hero */}
        <LibraryHero
          totalDocs={publishedDocuments.length}
          totalCategories={visibleCategories.length}
          totalCollections={publishedCollections.length}
          totalConcepts={LIBRARY_CONCEPTS.length}
          onJumpToCatalog={scrollToCatalog}
          onJumpToCollections={scrollToCollections}
        />

        {/* 2. Central Academic Search & Autocomplete */}
        <LibrarySearch
          query={rawQuery}
          onQueryChange={setRawQuery}
          publishedDocuments={publishedDocuments}
          onSelectConcept={(concept) => setSelectedConcept(concept)}
          onSubmitSearch={scrollToCatalog}
        />

        {/* 3. Continue Reading (real progress only; auto-hides when empty) */}
        {!isSearching && <ContinueReading publishedDocuments={publishedDocuments} />}

        {/* 4. Featured Curated Documents */}
        {!isSearching && (
          <FeaturedDocuments
            documents={publishedDocuments}
            onViewAll={() => {
              resetAllFilters();
              scrollToCatalog();
            }}
          />
        )}

        {/* 5. Explore by 6 Core Disciplines */}
        {!isSearching && (
          <CategoryGrid
            categories={visibleCategories}
            publishedDocuments={publishedDocuments}
            activeCategory={activeCategory}
            onSelectCategory={(cat) => {
              setActiveCategory(cat);
              setActiveCollectionId(null);
              setPage(1);
              scrollToCatalog();
            }}
          />
        )}

        {/* 6. Academic Collections ("HÀNH TRÌNH TRI THỨC") */}
        {!isSearching && publishedCollections.length > 0 && (
          <section
            ref={collectionsRef}
            aria-labelledby="collections-heading"
            className="space-y-5 scroll-mt-20"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-gold)]">
                Lộ trình đọc có hệ thống
              </p>
              <h2
                id="collections-heading"
                className="mt-1 font-display lib-scale-h2 font-bold text-[var(--color-text)]"
              >
                Hành trình tri thức
              </h2>
              <p className="mt-1 lib-scale-body text-[var(--color-text-muted)]">
                Các bộ sưu tập chuyên đề được sắp xếp theo trình tự đọc từ nền tảng đến phản biện sâu.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {publishedCollections.map((collection) => (
                <CollectionCard
                  key={collection.id}
                  collection={collection}
                  documents={publishedDocuments}
                  expanded={expandedCollectionId === collection.id}
                  onToggleExpand={() =>
                    setExpandedCollectionId((prev) =>
                      prev === collection.id ? null : collection.id
                    )
                  }
                  onFilterByCollection={(colId) => {
                    setActiveCollectionId(colId);
                    setActiveCategory('Tất cả');
                    setPage(1);
                    scrollToCatalog();
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* 7. Full Paginated Catalog with Filters & Sorting */}
        <section
          ref={catalogRef}
          aria-labelledby="catalog-heading"
          className="space-y-5 pt-2 scroll-mt-20"
        >
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-border)] pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-gold)]">
                Kho học liệu đầy đủ
              </p>
              <h2
                id="catalog-heading"
                className="mt-1 font-display lib-scale-h2 font-bold text-[var(--color-text)]"
              >
                {activeCollection
                  ? `Hành trình: ${activeCollection.title}`
                  : activeCategory === 'Tất cả'
                    ? 'Tất cả tài liệu học thuật'
                    : activeCategory}
              </h2>
            </div>

            <div className="text-xs text-[var(--color-text-muted)] font-mono-num">
              Hiển thị <strong className="text-[var(--color-text)]">{filteredDocuments.length}</strong> /{' '}
              {publishedDocuments.length} tài liệu
            </div>
          </div>

          {/* Filter Strip: Categories + Difficulty + Sort */}
          <div className="space-y-3">
            <div
              role="tablist"
              aria-label="Lọc tài liệu theo lĩnh vực"
              className="flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeCategory === 'Tất cả' && !activeCollectionId}
                onClick={() => {
                  setActiveCategory('Tất cả');
                  setActiveCollectionId(null);
                  setPage(1);
                }}
                className={`rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeCategory === 'Tất cả' && !activeCollectionId
                    ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text)]'
                }`}
              >
                Tất cả ({publishedDocuments.length})
              </button>

              {visibleCategories.map((cat) => {
                const count = publishedDocuments.filter(
                  (d) => normalizeCategoryName(d.category) === cat.name
                ).length;
                const selected = activeCategory === cat.name;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => {
                      setActiveCategory(cat.name);
                      setActiveCollectionId(null);
                      setPage(1);
                    }}
                    className={`rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selected
                        ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]'
                        : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    {cat.shortName} ({count})
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)] font-medium">
                  <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                  Mức độ:
                </span>
                {(
                  [
                    { key: 'all', label: 'Tất cả' },
                    { key: 'intro', label: 'Cơ bản' },
                    { key: 'explore', label: 'Trung cấp' },
                    { key: 'advanced', label: 'Nâng cao' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setDifficultyFilter(item.key);
                      setPage(1);
                    }}
                    className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                      difficultyFilter === item.key
                        ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-semibold'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}

                {(activeCollection || activeCategory !== 'Tất cả' || difficultyFilter !== 'all' || isSearching) && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:underline cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                    Xóa bộ lọc
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <label htmlFor="library-sort-select" className="text-[var(--color-text-muted)]">
                  Sắp xếp:
                </label>
                <select
                  id="library-sort-select"
                  value={sortMode}
                  onChange={(e) => {
                    setSortMode(e.target.value as SortMode);
                    setPage(1);
                  }}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                >
                  <option value="default">Tuyển chọn mặc định</option>
                  <option value="newest">Mới cập nhật</option>
                  <option value="shortest">Thời lượng đọc ngắn nhất</option>
                </select>
              </div>
            </div>
          </div>

          {/* Document Grid or Empty State */}
          {pagedDocuments.length === 0 ? (
            <EmptyStateCard
              title="Chưa tìm thấy tài liệu phù hợp"
              description="Thử nới rộng từ khóa, đổi mức độ đọc hoặc đặt lại bộ lọc để duyệt toàn bộ kho học liệu."
              action={
                <button type="button" onClick={resetAllFilters} className="btn-primary">
                  Đặt lại toàn bộ bộ lọc
                </button>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch">
                {pagedDocuments.map((doc) => (
                  <DocumentCard key={doc.id} doc={doc} />
                ))}
              </div>

              {totalPages > 1 && (
                <Pagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  onPageChange={(nextPage) => {
                    setPage(nextPage);
                    scrollToCatalog();
                  }}
                  className="pt-4"
                />
              )}
            </>
          )}
        </section>

        {/* 8. Transparent 60-Topic Editorial Curriculum Roadmap */}
        <section
          aria-label="Lộ trình biên soạn học liệu"
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-gold)]">
                Lộ trình biên soạn minh bạch
              </p>
              <h3 className="mt-1 font-display lib-scale-h3 font-bold text-[var(--color-text)]">
                Khung chương trình {EDITORIAL_TOPIC_ROADMAP.length} chủ đề học thuật ({publishedRoadmapCount} đã xuất bản & kiểm chứng)
              </h3>
              <p className="mt-1 lib-scale-small text-[var(--color-text-muted)]">
                Mọi bài đọc mới đều trải qua quy trình biên soạn và đối chiếu nguồn tham khảo thực trước khi công bố.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRoadmapOpen((prev) => !prev)}
              aria-expanded={roadmapOpen}
              className="btn-secondary !min-h-9 !text-xs shrink-0"
            >
              {roadmapOpen ? (
                <>
                  Thu gọn lộ trình <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  Xem danh mục 60 chủ đề <ChevronDown className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          {roadmapOpen && (
            <div className="mt-5 pt-5 border-t border-[var(--color-border)] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleCategories.map((cat) => {
                const topics = EDITORIAL_TOPIC_ROADMAP.filter((t) => t.category === cat.name);
                return (
                  <div
                    key={cat.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/60 p-4"
                  >
                    <h4 className="font-display text-sm font-bold text-[var(--color-text)] pb-2 border-b border-[var(--color-border)]">
                      {cat.name}
                    </h4>
                    <ul className="mt-2.5 space-y-2 text-xs">
                      {topics.map((topic) => {
                        const isLive = Boolean(
                          topic.publishedDocId &&
                            publishedDocuments.some((d) => d.id === topic.publishedDocId)
                        );
                        return (
                          <li key={topic.title} className="flex items-start gap-2">
                            {isLive ? (
                              <BookOpenCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--color-primary)]" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--color-text-muted)]/60" />
                            )}
                            {isLive && topic.publishedDocId ? (
                              <Link
                                to={`/library/${topic.publishedDocId}`}
                                className="font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] hover:underline"
                              >
                                {topic.title}
                              </Link>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  showToast(
                                    `Chủ đề "${topic.title}" hiện đang trong quá trình biên soạn và kiểm chứng nguồn.`,
                                    { variant: 'info' }
                                  )
                                }
                                className="text-left text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
                              >
                                {topic.title}{' '}
                                <span className="italic opacity-75">(đang biên soạn)</span>
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Interactive Concept Dialog when user selects a concept from Search */}
      <ConceptPopoverDialog
        concept={selectedConcept}
        onClose={() => setSelectedConcept(null)}
        onSelectConcept={(concept) => setSelectedConcept(concept)}
        allPublishedDocuments={publishedDocuments}
      />
    </WorkspaceShell>
  );
}
