import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  FolderKanban,
  Layers,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import { EDITORIAL_COVER_CATALOG } from '../../lib/assets';
import {
  estimateReadingMinutes,
  getDifficultyLabel,
  getReviewStatusLabel,
  isDocumentVerified,
  isSafeHttpUrl,
  normalizeCategoryName,
} from '../../lib/library/validation';
import { Link } from '../../lib/router';
import {
  ArticleReference,
  DocumentBlock,
  DocumentCategory,
  DocumentDifficulty,
  DocumentReviewStatus,
  LibraryCategoryMeta,
  LibraryCollection,
  LibraryDocument,
} from '../../lib/types';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useToast } from '../ui/ToastProvider';
import { HybridMediaCard } from '../visuals/ThemeSyncedHero';

type AdminLibrarySubTab = 'documents' | 'categories' | 'collections';

function slugifyId(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function AdminLibraryConsole() {
  const {
    documents,
    publishedDocuments,
    upsertAdminDocument,
    deleteAdminDocument,
    categories,
    upsertCategory,
    deleteCategory,
    reorderCategories,
    collections,
    upsertCollection,
    deleteCollection,
  } = useApp();
  const { showToast } = useToast();

  const [subTab, setSubTab] = useState<AdminLibrarySubTab>('documents');

  // =========================================================================
  // SUB-TAB 1: DOCUMENTS EDITOR + LIVE PREVIEW
  // =========================================================================
  const [docSearch, setDocSearch] = useState('');
  const [docCategoryFilter, setDocCategoryFilter] = useState<'all' | string>('all');
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [docFormError, setDocFormError] = useState<string | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<LibraryDocument | null>(null);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [author, setAuthor] = useState('Ban Biên tập Học liệu Mạch Ngôn');
  const [source, setSource] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('Triết học và tư tưởng');
  const [difficulty, setDifficulty] = useState<DocumentDifficulty>('explore');
  const [featured, setFeatured] = useState(false);
  const [coverImage, setCoverImage] = useState<string>(EDITORIAL_COVER_CATALOG[0].src);
  const [docStatus, setDocStatus] = useState<'published' | 'draft'>('draft');
  const [reviewStatus, setReviewStatus] = useState<DocumentReviewStatus>('pending_source');
  const [verifiedSource, setVerifiedSource] = useState(false);
  const [keywordsText, setKeywordsText] = useState('');

  const [proseText, setProseText] = useState('');
  const [conceptText, setConceptText] = useState('');
  const [quoteText, setQuoteText] = useState('');
  const [quoteCitation, setQuoteCitation] = useState('');
  const [counterText, setCounterText] = useState('');
  const [questionText, setQuestionText] = useState('');

  // Primary reference citation fields (no blind verified default)
  const [refTitle, setRefTitle] = useState('');
  const [refAuthor, setRefAuthor] = useState('');
  const [refPublisher, setRefPublisher] = useState('');
  const [refYear, setRefYear] = useState('');
  const [refUrl, setRefUrl] = useState('');

  const resetDocForm = () => {
    setEditingDocId(null);
    setTitle('');
    setSubtitle('');
    setAuthor('Ban Biên tập Học liệu Mạch Ngôn');
    setSource('');
    setCategory(categories[0]?.name ?? 'Triết học và tư tưởng');
    setDifficulty('explore');
    setFeatured(false);
    setCoverImage(EDITORIAL_COVER_CATALOG[0].src);
    setDocStatus('draft');
    setReviewStatus('pending_source');
    setVerifiedSource(false);
    setKeywordsText('');
    setProseText('');
    setConceptText('');
    setQuoteText('');
    setQuoteCitation('');
    setCounterText('');
    setQuestionText('');
    setRefTitle('');
    setRefAuthor('');
    setRefPublisher('');
    setRefYear('');
    setRefUrl('');
    setDocFormError(null);
    setShowLivePreview(false);
  };

  const loadDocForEdit = (doc: LibraryDocument) => {
    setEditingDocId(doc.id);
    setTitle(doc.title);
    setSubtitle(doc.subtitle);
    setAuthor(doc.author);
    setSource(doc.source);
    setCategory(normalizeCategoryName(doc.category));
    setDifficulty(doc.difficulty ?? 'explore');
    setFeatured(Boolean(doc.featured));
    setCoverImage(doc.coverImage);
    setDocStatus(doc.status);
    setReviewStatus(doc.reviewStatus ?? (doc.status === 'published' ? 'published' : 'editing'));
    setVerifiedSource(Boolean(doc.verified));
    setKeywordsText(doc.keywords.join(', '));
    setProseText(doc.blocks.find((b) => b.type === 'prose')?.content ?? '');
    setConceptText(doc.blocks.find((b) => b.type === 'concept')?.content ?? '');
    const quoteBlock = doc.blocks.find((b) => b.type === 'quote');
    setQuoteText(quoteBlock?.content ?? '');
    setQuoteCitation(quoteBlock?.citation ?? '');
    setCounterText(doc.blocks.find((b) => b.type === 'counterargument')?.content ?? '');
    setQuestionText(doc.blocks.find((b) => b.type === 'question')?.content ?? '');
    const firstRef = doc.references?.[0];
    setRefTitle(firstRef?.title ?? '');
    setRefAuthor(firstRef?.author ?? '');
    setRefPublisher(firstRef?.publisher ?? '');
    setRefYear(firstRef?.publicationYear ? String(firstRef.publicationYear) : '');
    setRefUrl(firstRef?.url ?? '');
    setDocFormError(null);
    setShowLivePreview(false);
  };

  const buildDraftDocument = (): LibraryDocument => {
    const id =
      editingDocId ||
      `${slugifyId(title || 'tai-lieu-moi') || 'tai-lieu'}-${Date.now().toString(36).slice(-4)}`;
    const existing = editingDocId ? documents.find((d) => d.id === editingDocId) : undefined;

    const blocks: DocumentBlock[] = [];
    const sections: Array<{ id: string; title: string }> = [];

    if (proseText.trim()) {
      sections.push({ id: 'dan-nhap', title: '1. Dẫn nhập vấn đề' });
      blocks.push({
        id: `${id}-b1`,
        sectionId: 'dan-nhap',
        type: 'prose',
        heading: '1. Dẫn nhập vấn đề',
        content: proseText.trim(),
      });
    }
    if (conceptText.trim()) {
      sections.push({ id: 'khai-niem-trong-tam', title: '2. Khái niệm trọng tâm' });
      blocks.push({
        id: `${id}-b2`,
        sectionId: 'khai-niem-trong-tam',
        type: 'concept',
        label: 'Khái niệm trọng tâm',
        heading: '2. Khái niệm trọng tâm',
        content: conceptText.trim(),
      });
    }
    if (quoteText.trim()) {
      blocks.push({
        id: `${id}-b3`,
        sectionId: sections[sections.length - 1]?.id ?? 'dan-nhap',
        type: 'quote',
        label: 'Trích dẫn / Ví dụ minh họa',
        content: quoteText.trim(),
        citation: quoteCitation.trim() || undefined,
      });
    }
    if (counterText.trim()) {
      sections.push({ id: 'goc-nhin-khac', title: '3. Góc nhìn khác và giới hạn' });
      blocks.push({
        id: `${id}-b4`,
        sectionId: 'goc-nhin-khac',
        type: 'counterargument',
        label: 'Góc nhìn phản biện',
        heading: '3. Góc nhìn khác và giới hạn',
        content: counterText.trim(),
      });
    }
    if (questionText.trim()) {
      blocks.push({
        id: `${id}-b5`,
        sectionId: sections[sections.length - 1]?.id ?? 'dan-nhap',
        type: 'question',
        label: 'Câu hỏi gợi suy nghĩ',
        content: questionText.trim(),
      });
    }

    const references: ArticleReference[] = [];
    if (refTitle.trim()) {
      const parsedYear = Number(refYear);
      references.push({
        id: `ref-${id}-1`,
        title: refTitle.trim(),
        author: refAuthor.trim() || undefined,
        publisher: refPublisher.trim() || undefined,
        publicationYear:
          Number.isFinite(parsedYear) && parsedYear >= 1000 && parsedYear <= 2100
            ? parsedYear
            : undefined,
        url: refUrl.trim() && isSafeHttpUrl(refUrl.trim()) ? refUrl.trim() : undefined,
        verified: verifiedSource,
      });
    } else if (existing?.references) {
      references.push(...existing.references);
    }

    const excerptText =
      subtitle.trim() || proseText.trim().slice(0, 180) || 'Chuyên luận học thuật Mạch Ngôn.';
    const keywords = keywordsText
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    const hasVerifiedRef = references.some((r) => r.verified);
    const effectiveVerified = Boolean(verifiedSource && hasVerifiedRef);

    return {
      id,
      title: title.trim() || 'Tài liệu chưa đặt tiêu đề',
      subtitle: subtitle.trim() || excerptText,
      author: author.trim() || 'Ban Biên tập Học liệu Mạch Ngôn',
      source: source.trim() || 'Biên soạn nội bộ Mạch Ngôn',
      publishedDate:
        existing?.publishedDate ??
        new Intl.DateTimeFormat('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(new Date()),
      readingMinutes: estimateReadingMinutes(blocks, excerptText),
      category: normalizeCategoryName(category),
      difficulty,
      featured,
      coverImage,
      coverAlt: title.trim() || 'Ảnh bìa học liệu Mạch Ngôn',
      excerpt: excerptText,
      keywords: keywords.length > 0 ? keywords : [category],
      tags: existing?.tags ?? [category.toLowerCase()],
      sections: sections.length > 0 ? sections : [{ id: 'dan-nhap', title: '1. Dẫn nhập vấn đề' }],
      blocks,
      references,
      relatedConceptIds: existing?.relatedConceptIds ?? [],
      collectionIds: existing?.collectionIds ?? [],
      status: docStatus,
      reviewStatus,
      verified: effectiveVerified,
      reviewedAt: effectiveVerified ? new Date().toISOString().slice(0, 10) : existing?.reviewedAt,
      contentVersion: (existing?.contentVersion ?? 0) + 1,
    };
  };

  const handleDocSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDocFormError(null);

    if (title.trim().length < 5) {
      setDocFormError('Nhan đề tài liệu cần tối thiểu 5 ký tự.');
      return;
    }
    if (proseText.trim().length < 30) {
      setDocFormError('Phần dẫn nhập vấn đề cần tối thiểu 30 ký tự để đảm bảo chất lượng học liệu.');
      return;
    }
    if (refUrl.trim() && !isSafeHttpUrl(refUrl.trim())) {
      setDocFormError('Liên kết nguồn tham khảo chỉ chấp nhận giao thức http:// hoặc https://.');
      return;
    }
    if (verifiedSource && !refTitle.trim() && !(editingDocId && documents.find((d) => d.id === editingDocId)?.references?.length)) {
      setDocFormError('Để đánh dấu “Đã kiểm chứng nguồn”, bắt buộc phải ghi rõ ít nhất một nguồn tham khảo gốc.');
      return;
    }

    const built = buildDraftDocument();
    upsertAdminDocument(built);
    showToast(
      editingDocId
        ? `Đã cập nhật tài liệu "${built.title}".`
        : `Đã lưu tài liệu mới "${built.title}" (${built.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}).`,
      { variant: 'success' }
    );
    resetDocForm();
  };

  const filteredAdminDocs = useMemo(() => {
    return documents.filter((doc) => {
      if (docCategoryFilter !== 'all' && normalizeCategoryName(doc.category) !== docCategoryFilter) {
        return false;
      }
      if (!docSearch.trim()) return true;
      const q = docSearch.trim().toLowerCase();
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.author.toLowerCase().includes(q) ||
        doc.category.toLowerCase().includes(q)
      );
    });
  }, [documents, docCategoryFilter, docSearch]);

  // =========================================================================
  // SUB-TAB 2: CATEGORIES MANAGER
  // =========================================================================
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catShortName, setCatShortName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catIcon, setCatIcon] = useState<LibraryCategoryMeta['iconKey']>('layers');
  const [catHidden, setCatHidden] = useState(false);

  const resetCatForm = () => {
    setEditingCatId(null);
    setCatName('');
    setCatShortName('');
    setCatDesc('');
    setCatIcon('layers');
    setCatHidden(false);
  };

  const handleCatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (catName.trim().length < 2) {
      showToast('Tên danh mục cần tối thiểu 2 ký tự.', { variant: 'warning' });
      return;
    }
    const existing = editingCatId ? categories.find((c) => c.id === editingCatId) : undefined;
    const nextCat: LibraryCategoryMeta = {
      id: editingCatId ?? `cat-${slugifyId(catName)}-${Date.now().toString(36).slice(-3)}`,
      name: catName.trim() as DocumentCategory,
      shortName: catShortName.trim() || catName.trim(),
      description: catDesc.trim() || 'Danh mục chuyên đề học thuật Mạch Ngôn.',
      iconKey: catIcon,
      order: existing?.order ?? categories.length + 1,
      hidden: catHidden,
    };
    upsertCategory(nextCat);
    showToast(
      editingCatId ? `Đã cập nhật danh mục "${nextCat.name}".` : `Đã thêm danh mục "${nextCat.name}".`,
      { variant: 'success' }
    );
    resetCatForm();
  };

  // =========================================================================
  // SUB-TAB 3: COLLECTIONS ("HÀNH TRÌNH TRI THỨC") MANAGER
  // =========================================================================
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [colTitle, setColTitle] = useState('');
  const [colSubtitle, setColSubtitle] = useState('');
  const [colDesc, setColDesc] = useState('');
  const [colCover, setColCover] = useState<string>(EDITORIAL_COVER_CATALOG[6].src);
  const [colStatus, setColStatus] = useState<'published' | 'draft'>('published');
  const [colDocIds, setColDocIds] = useState<string[]>([]);
  const [deleteColTarget, setDeleteColTarget] = useState<LibraryCollection | null>(null);

  const resetColForm = () => {
    setEditingColId(null);
    setColTitle('');
    setColSubtitle('');
    setColDesc('');
    setColCover(EDITORIAL_COVER_CATALOG[6].src);
    setColStatus('published');
    setColDocIds([]);
  };

  const loadColForEdit = (col: LibraryCollection) => {
    setEditingColId(col.id);
    setColTitle(col.title);
    setColSubtitle(col.subtitle);
    setColDesc(col.description);
    setColCover(col.coverImage);
    setColStatus(col.status);
    setColDocIds(col.documentIds);
  };

  const toggleDocInCollection = (docId: string) => {
    setColDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const moveDocInCollection = (index: number, direction: 'up' | 'down') => {
    const swap = direction === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= colDocIds.length) return;
    setColDocIds((prev) => {
      const next = [...prev];
      [next[index], next[swap]] = [next[swap], next[index]];
      return next;
    });
  };

  const handleColSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (colTitle.trim().length < 4) {
      showToast('Tên bộ sưu tập cần tối thiểu 4 ký tự.', { variant: 'warning' });
      return;
    }
    if (colDocIds.length === 0) {
      showToast('Hãy chọn ít nhất 1 tài liệu đã xuất bản cho bộ sưu tập.', { variant: 'warning' });
      return;
    }
    const existing = editingColId ? collections.find((c) => c.id === editingColId) : undefined;
    const nextCol: LibraryCollection = {
      id: editingColId ?? `col-${slugifyId(colTitle)}-${Date.now().toString(36).slice(-3)}`,
      title: colTitle.trim(),
      subtitle: colSubtitle.trim() || `${colDocIds.length} bài đọc theo trình tự gợi ý`,
      description: colDesc.trim() || 'Hành trình đọc chuyên đề do Ban Biên tập Mạch Ngôn tuyển chọn.',
      coverImage: colCover,
      coverAlt: colTitle.trim(),
      documentIds: colDocIds,
      status: colStatus,
      order: existing?.order ?? collections.length + 1,
    };
    upsertCollection(nextCol);
    showToast(
      editingColId
        ? `Đã cập nhật bộ sưu tập "${nextCol.title}".`
        : `Đã tạo bộ sưu tập mới "${nextCol.title}".`,
      { variant: 'success' }
    );
    resetColForm();
  };

  const previewDoc = showLivePreview ? buildDraftDocument() : null;

  return (
    <div className="space-y-6">
      {/* Sub-tabs inside Library Admin */}
      <div
        role="tablist"
        aria-label="Quản trị Thư viện"
        className="flex flex-wrap items-center gap-2"
      >
        {(
          [
            { id: 'documents', label: `Bài viết & Trình biên tập (${documents.length})`, icon: BookOpen },
            { id: 'categories', label: `Quản lý danh mục (${categories.length})`, icon: Layers },
            { id: 'collections', label: `Hành trình tri thức (${collections.length})`, icon: FolderKanban },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSubTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold border transition-colors cursor-pointer ${
                active
                  ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)] border-[var(--color-primary)]/40'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ================================================================= */}
      {/* SUB-TAB 1: ARTICLES & STRUCTURED EDITOR                           */}
      {/* ================================================================= */}
      {subTab === 'documents' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-7 items-start">
          {/* Left: Document List */}
          <section className="xl:col-span-6 rounded-2xl p-5 sm:p-6 surface-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--color-border)]">
              <div>
                <h2 className="font-display text-xl font-semibold text-[var(--color-text)]">
                  Kho tài liệu Library
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {publishedDocuments.length} đã xuất bản · {documents.filter((d) => isDocumentVerified(d)).length} đã kiểm chứng nguồn
                </p>
              </div>
              <button
                type="button"
                onClick={resetDocForm}
                className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Tạo bài mới
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-7 relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
                <input
                  type="search"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  placeholder="Tìm theo nhan đề, tác giả..."
                  className="input-editorial !pl-9 !text-xs"
                />
              </div>
              <div className="sm:col-span-5">
                <select
                  aria-label="Lọc bài viết theo danh mục"
                  value={docCategoryFilter}
                  onChange={(e) => setDocCategoryFilter(e.target.value)}
                  className="input-editorial !text-xs"
                >
                  <option value="all">Tất cả lĩnh vực</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ul className="divide-y divide-[var(--color-border)] max-h-[760px] overflow-y-auto pr-1">
              {filteredAdminDocs.map((doc) => {
                const verified = isDocumentVerified(doc);
                return (
                  <li
                    key={doc.id}
                    className="py-3.5 first:pt-1 last:pb-0 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="hidden sm:block w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--color-border)] mt-0.5">
                        <HybridMediaCard src={doc.coverImage} alt={doc.coverAlt} aspect="4/3" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                          <span className="font-semibold text-[var(--color-primary)]">
                            {doc.category}
                          </span>
                          <span>·</span>
                          <span>{getDifficultyLabel(doc.difficulty)}</span>
                          <span>·</span>
                          <span>{getReviewStatusLabel(doc.reviewStatus)}</span>
                          {verified && (
                            <CheckCircle2
                              className="h-3.5 w-3.5 text-[var(--color-gold)]"
                              aria-label="Đã kiểm chứng nguồn"
                            />
                          )}
                        </div>
                        <h3 className="mt-1 font-display text-sm sm:text-base font-semibold leading-snug text-[var(--color-text)]">
                          {doc.title}
                        </h3>
                        <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                          {doc.status === 'published' ? 'Công khai' : 'Bản nháp'} · {doc.readingMinutes} phút ·{' '}
                          {doc.references?.length ?? 0} nguồn tham khảo
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        title={doc.featured ? 'Bỏ nổi bật' : 'Đặt làm tài liệu nổi bật'}
                        onClick={() => {
                          upsertAdminDocument({ ...doc, featured: !doc.featured });
                          showToast(
                            doc.featured ? 'Đã bỏ đánh dấu nổi bật.' : 'Đã đưa vào mục Tài liệu nổi bật.',
                            { variant: 'info' }
                          );
                        }}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] cursor-pointer ${
                          doc.featured
                            ? 'bg-[var(--color-primary-soft)] text-[var(--color-gold)]'
                            : 'bg-[var(--color-bg)]/60 text-[var(--color-text-muted)] hover:text-[var(--color-gold)]'
                        }`}
                      >
                        <Star className={`h-3.5 w-3.5 ${doc.featured ? 'fill-current' : ''}`} />
                      </button>
                      <Link
                        to={`/library/${doc.id}${doc.status !== 'published' ? '?preview=admin' : ''}`}
                        aria-label={`Xem bài viết ${doc.title}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/60 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => loadDocForEdit(doc)}
                        aria-label={`Chỉnh sửa ${doc.title}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/60 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      {!doc.id.startsWith('triet-hoc-hien-sinh') && (
                        <button
                          type="button"
                          onClick={() => setDeleteDocTarget(doc)}
                          aria-label={`Xóa bản chỉnh sửa ${doc.title}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/60 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Right: Structured Editor + Live Preview Toggle */}
          <section className="xl:col-span-6 rounded-2xl p-5 sm:p-6 surface-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--color-border)]">
              <div>
                <h2 className="font-display text-xl font-semibold text-[var(--color-text)]">
                  {editingDocId ? 'Hiệu đính tài liệu' : 'Soạn thảo học liệu mới'}
                </h2>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  Mặc định bài mới ở trạng thái “Chờ xác minh nguồn” cho tới khi đối chiếu tài liệu gốc.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLivePreview((prev) => !prev)}
                className="btn-secondary !min-h-8 !px-3 !text-xs"
              >
                {showLivePreview ? <Edit3 className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showLivePreview ? 'Quay lại biên tập' : 'Xem trước trực tiếp'}
              </button>
            </div>

            {showLivePreview && previewDoc ? (
              <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
                <div className="text-xs font-semibold text-[var(--color-primary)]">
                  {previewDoc.category} · {getDifficultyLabel(previewDoc.difficulty)} ·{' '}
                  {previewDoc.readingMinutes} phút đọc
                </div>
                <h3 className="font-display text-2xl font-bold text-[var(--color-text)]">
                  {previewDoc.title}
                </h3>
                <p className="font-reading text-sm text-[var(--color-text-muted)]">
                  {previewDoc.subtitle}
                </p>
                <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
                  <HybridMediaCard src={previewDoc.coverImage} alt={previewDoc.coverAlt} aspect="16/9" />
                </div>
                <div className="space-y-3 pt-2">
                  {previewDoc.blocks.map((block) => (
                    <div
                      key={block.id}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                    >
                      {block.label && (
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-gold)]">
                          {block.label}
                        </div>
                      )}
                      {block.heading && (
                        <div className="mt-1 font-display text-base font-semibold text-[var(--color-text)]">
                          {block.heading}
                        </div>
                      )}
                      <p className="mt-1.5 font-reading text-sm leading-relaxed text-[var(--color-text-muted)]">
                        {block.content}
                      </p>
                    </div>
                  ))}
                </div>
                {previewDoc.references && previewDoc.references.length > 0 && (
                  <div className="pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
                    <strong className="text-[var(--color-text)]">Nguồn tham khảo:</strong>{' '}
                    {previewDoc.references[0].author ? `${previewDoc.references[0].author} — ` : ''}
                    {previewDoc.references[0].title}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleDocSubmit} className="space-y-4">
                {docFormError && (
                  <div
                    role="alert"
                    className="rounded-xl px-4 py-3 text-xs border"
                    style={{
                      backgroundColor: 'var(--color-warn-bg)',
                      borderColor: 'var(--color-warn-border)',
                    }}
                  >
                    {docFormError}
                  </div>
                )}

                <div>
                  <label htmlFor="admin-doc-title" className="block text-xs font-medium mb-1">
                    Nhan đề tài liệu *
                  </label>
                  <input
                    id="admin-doc-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ví dụ: Nghệ thuật đặt câu hỏi trong đối thoại Socrates"
                    className="input-editorial"
                  />
                </div>

                <div>
                  <label htmlFor="admin-doc-subtitle" className="block text-xs font-medium mb-1">
                    Đề dẫn / Tóm lược ngắn
                  </label>
                  <input
                    id="admin-doc-subtitle"
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="1–2 câu nêu câu hỏi trung tâm của bài đọc"
                    className="input-editorial"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="admin-doc-author" className="block text-xs font-medium mb-1">
                      Người biên soạn *
                    </label>
                    <input
                      id="admin-doc-author"
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      className="input-editorial"
                    />
                  </div>
                  <div>
                    <label htmlFor="admin-doc-source" className="block text-xs font-medium mb-1">
                      Nguồn biên soạn
                    </label>
                    <input
                      id="admin-doc-source"
                      type="text"
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      placeholder="Ví dụ: Tổng hợp từ giáo trình Triết học"
                      className="input-editorial"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="admin-doc-cat" className="block text-xs font-medium mb-1">
                      Lĩnh vực
                    </label>
                    <select
                      id="admin-doc-cat"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                      className="input-editorial !text-xs"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="admin-doc-diff" className="block text-xs font-medium mb-1">
                      Mức độ đọc
                    </label>
                    <select
                      id="admin-doc-diff"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as DocumentDifficulty)}
                      className="input-editorial !text-xs"
                    >
                      <option value="intro">Nhập môn</option>
                      <option value="explore">Khám phá</option>
                      <option value="advanced">Chuyên sâu</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="admin-doc-status" className="block text-xs font-medium mb-1">
                      Xuất bản
                    </label>
                    <select
                      id="admin-doc-status"
                      value={docStatus}
                      onChange={(e) => setDocStatus(e.target.value as 'published' | 'draft')}
                      className="input-editorial !text-xs"
                    >
                      <option value="draft">Bản nháp nội bộ</option>
                      <option value="published">Công khai lên Library</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5">
                    <label htmlFor="admin-doc-cover" className="block text-xs font-medium mb-1">
                      Ảnh bìa (12 mẫu có sẵn)
                    </label>
                    <select
                      id="admin-doc-cover"
                      value={coverImage}
                      onChange={(e) => setCoverImage(e.target.value)}
                      className="input-editorial !text-xs"
                    >
                      {EDITORIAL_COVER_CATALOG.map((opt) => (
                        <option key={opt.src} value={opt.src}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-5">
                    <label htmlFor="admin-doc-review" className="block text-xs font-medium mb-1">
                      Trạng thái kiểm chứng
                    </label>
                    <select
                      id="admin-doc-review"
                      value={reviewStatus}
                      onChange={(e) => setReviewStatus(e.target.value as DocumentReviewStatus)}
                      className="input-editorial !text-xs"
                    >
                      <option value="editing">Đang biên soạn</option>
                      <option value="pending_source">Chờ xác minh nguồn</option>
                      <option value="verified">Đã kiểm chứng</option>
                      <option value="published">Đã xuất bản</option>
                      <option value="archived">Lưu trữ</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 overflow-hidden rounded-lg border border-[var(--color-border)]">
                    <HybridMediaCard src={coverImage} alt="Xem trước bìa" aspect="4/3" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-5 text-xs">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featured}
                      onChange={(e) => setFeatured(e.target.checked)}
                    />
                    <span>Hiển thị trong mục Tài liệu nổi bật</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={verifiedSource}
                      onChange={(e) => setVerifiedSource(e.target.checked)}
                    />
                    <span>Đã đối chiếu nguồn gốc (Verified)</span>
                  </label>
                </div>

                <div>
                  <label htmlFor="admin-doc-keywords" className="block text-xs font-medium mb-1">
                    Từ khóa tìm kiếm (phân tách bằng dấu phẩy)
                  </label>
                  <input
                    id="admin-doc-keywords"
                    type="text"
                    value={keywordsText}
                    onChange={(e) => setKeywordsText(e.target.value)}
                    placeholder="triết học, tự do, Socrates, lập luận..."
                    className="input-editorial !text-xs"
                  />
                </div>

                <div>
                  <label htmlFor="admin-doc-prose" className="block text-xs font-medium mb-1">
                    1. Dẫn nhập vấn đề *
                  </label>
                  <textarea
                    id="admin-doc-prose"
                    rows={3}
                    value={proseText}
                    onChange={(e) => setProseText(e.target.value)}
                    className="textarea-editorial"
                  />
                </div>

                <div>
                  <label htmlFor="admin-doc-concept" className="block text-xs font-medium mb-1">
                    2. Khối Khái niệm trọng tâm
                  </label>
                  <textarea
                    id="admin-doc-concept"
                    rows={2}
                    value={conceptText}
                    onChange={(e) => setConceptText(e.target.value)}
                    className="textarea-editorial"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="admin-doc-quote" className="block text-xs font-medium mb-1">
                      3. Trích dẫn / Ví dụ (tùy chọn)
                    </label>
                    <textarea
                      id="admin-doc-quote"
                      rows={2}
                      value={quoteText}
                      onChange={(e) => setQuoteText(e.target.value)}
                      className="textarea-editorial !text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="admin-doc-quote-cite" className="block text-xs font-medium mb-1">
                      Nguồn trích dẫn
                    </label>
                    <input
                      id="admin-doc-quote-cite"
                      type="text"
                      value={quoteCitation}
                      onChange={(e) => setQuoteCitation(e.target.value)}
                      placeholder="Tác giả, Tác phẩm (Năm)"
                      className="input-editorial !text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="admin-doc-counter" className="block text-xs font-medium mb-1">
                    4. Khối Góc nhìn phản biện
                  </label>
                  <textarea
                    id="admin-doc-counter"
                    rows={2}
                    value={counterText}
                    onChange={(e) => setCounterText(e.target.value)}
                    className="textarea-editorial"
                  />
                </div>

                <div>
                  <label htmlFor="admin-doc-question" className="block text-xs font-medium mb-1">
                    5. Câu hỏi gợi suy nghĩ (kết bài)
                  </label>
                  <textarea
                    id="admin-doc-question"
                    rows={2}
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    className="textarea-editorial !text-xs"
                  />
                </div>

                {/* Primary Reference Citation */}
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/50 p-3.5 space-y-2.5">
                  <div className="text-xs font-semibold text-[var(--color-text)]">
                    Nguồn tham khảo học thuật chính (References)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={refTitle}
                      onChange={(e) => setRefTitle(e.target.value)}
                      placeholder="Tên tác phẩm / nghiên cứu gốc"
                      className="input-editorial !text-xs"
                    />
                    <input
                      type="text"
                      value={refAuthor}
                      onChange={(e) => setRefAuthor(e.target.value)}
                      placeholder="Tác giả gốc"
                      className="input-editorial !text-xs"
                    />
                    <input
                      type="text"
                      value={refPublisher}
                      onChange={(e) => setRefPublisher(e.target.value)}
                      placeholder="Nhà xuất bản / Tạp chí"
                      className="input-editorial !text-xs"
                    />
                    <input
                      type="number"
                      value={refYear}
                      onChange={(e) => setRefYear(e.target.value)}
                      placeholder="Năm xuất bản (VD: 1958)"
                      className="input-editorial !text-xs"
                    />
                  </div>
                  <input
                    type="url"
                    value={refUrl}
                    onChange={(e) => setRefUrl(e.target.value)}
                    placeholder="Liên kết đối chiếu (https://..., tùy chọn)"
                    className="input-editorial !text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  {editingDocId && (
                    <button
                      type="button"
                      onClick={resetDocForm}
                      className="btn-secondary !min-h-10 !px-4 !text-xs"
                    >
                      Hủy chỉnh sửa
                    </button>
                  )}
                  <button type="submit" className="btn-primary !min-h-10 !px-5">
                    {editingDocId ? 'Lưu hiệu đính' : 'Lưu học liệu'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 2: CATEGORIES MANAGER                                     */}
      {/* ================================================================= */}
      {subTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
          <section className="lg:col-span-7 rounded-2xl p-5 sm:p-6 surface-card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div>
                <h2 className="font-display text-xl font-semibold">Danh mục lĩnh vực</h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Sắp xếp thứ tự, ẩn/hiện hoặc biên tập mô tả. Hệ thống tự chặn xóa danh mục đang có tài liệu.
                </p>
              </div>
              <button
                type="button"
                onClick={resetCatForm}
                className="btn-secondary !min-h-9 !px-3 !text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm danh mục
              </button>
            </div>

            <ul className="divide-y divide-[var(--color-border)]">
              {categories.map((cat, idx) => {
                const count = documents.filter(
                  (d) => normalizeCategoryName(d.category) === cat.name
                ).length;
                return (
                  <li key={cat.id} className="py-3.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
                        <span>{cat.name}</span>
                        <span className="text-[11px] font-mono-num text-[var(--color-primary)]">
                          ({count} tài liệu)
                        </span>
                        {cat.hidden && (
                          <span className="text-[11px] text-[var(--color-text-muted)] italic">
                            · Đang ẩn
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        {cat.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => reorderCategories(cat.id, 'up')}
                        aria-label={`Đưa danh mục ${cat.name} lên`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-35 cursor-pointer"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === categories.length - 1}
                        onClick={() => reorderCategories(cat.id, 'down')}
                        aria-label={`Đưa danh mục ${cat.name} xuống`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-35 cursor-pointer"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          upsertCategory({ ...cat, hidden: !cat.hidden })
                        }
                        title={cat.hidden ? 'Hiện danh mục' : 'Ẩn danh mục'}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] cursor-pointer"
                      >
                        {cat.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCatId(cat.id);
                          setCatName(cat.name);
                          setCatShortName(cat.shortName);
                          setCatDesc(cat.description);
                          setCatIcon(cat.iconKey);
                          setCatHidden(Boolean(cat.hidden));
                        }}
                        aria-label={`Sửa danh mục ${cat.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const res = deleteCategory(cat.id);
                          if (!res.ok) {
                            showToast(res.reason || 'Không thể xóa danh mục này.', {
                              variant: 'warning',
                            });
                          } else {
                            showToast(`Đã xóa danh mục "${cat.name}".`, { variant: 'info' });
                          }
                        }}
                        aria-label={`Xóa danh mục ${cat.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="lg:col-span-5 rounded-2xl p-5 sm:p-6 surface-card">
            <h2 className="font-display text-xl font-semibold pb-3 border-b border-[var(--color-border)]">
              {editingCatId ? 'Chỉnh sửa danh mục' : 'Tạo danh mục mới'}
            </h2>
            <form onSubmit={handleCatSubmit} className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="cat-name" className="block text-xs font-medium mb-1">
                  Tên danh mục *
                </label>
                <input
                  id="cat-name"
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="Ví dụ: Lịch sử tư tưởng"
                  className="input-editorial"
                />
              </div>
              <div>
                <label htmlFor="cat-short" className="block text-xs font-medium mb-1">
                  Tên rút gọn (hiển thị trên tab lọc)
                </label>
                <input
                  id="cat-short"
                  type="text"
                  value={catShortName}
                  onChange={(e) => setCatShortName(e.target.value)}
                  className="input-editorial"
                />
              </div>
              <div>
                <label htmlFor="cat-desc" className="block text-xs font-medium mb-1">
                  Mô tả ngắn (1 câu)
                </label>
                <textarea
                  id="cat-desc"
                  rows={2}
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  className="textarea-editorial"
                />
              </div>
              <div>
                <label htmlFor="cat-icon" className="block text-xs font-medium mb-1">
                  Biểu tượng lĩnh vực
                </label>
                <select
                  id="cat-icon"
                  value={catIcon}
                  onChange={(e) => setCatIcon(e.target.value as LibraryCategoryMeta['iconKey'])}
                  className="input-editorial !text-xs"
                >
                  <option value="languages">Ngôn ngữ (Languages)</option>
                  <option value="feather">Văn học (Feather)</option>
                  <option value="landmark">Triết học (Landmark)</option>
                  <option value="scale">Logic & Lập luận (Scale)</option>
                  <option value="compass">Tư duy phản biện (Compass)</option>
                  <option value="layers">Liên ngành (Layers)</option>
                </select>
              </div>
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={catHidden}
                  onChange={(e) => setCatHidden(e.target.checked)}
                />
                <span>Tạm ẩn danh mục trên giao diện Library công khai</span>
              </label>
              <div className="flex items-center justify-end gap-2 pt-2">
                {editingCatId && (
                  <button type="button" onClick={resetCatForm} className="btn-secondary !text-xs">
                    Hủy
                  </button>
                )}
                <button type="submit" className="btn-primary !text-xs">
                  {editingCatId ? 'Cập nhật danh mục' : 'Lưu danh mục'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 3: COLLECTIONS ("HÀNH TRÌNH TRI THỨC") MANAGER            */}
      {/* ================================================================= */}
      {subTab === 'collections' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
          <section className="lg:col-span-6 rounded-2xl p-5 sm:p-6 surface-card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div>
                <h2 className="font-display text-xl font-semibold">Bộ sưu tập Hành trình Tri thức</h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Nhóm các tài liệu đã xuất bản thành lộ trình đọc có trình tự rõ ràng.
                </p>
              </div>
              <button
                type="button"
                onClick={resetColForm}
                className="btn-secondary !min-h-9 !px-3 !text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Tạo hành trình
              </button>
            </div>

            <ul className="divide-y divide-[var(--color-border)]">
              {collections.map((col) => (
                <li key={col.id} className="py-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="hidden sm:block w-16 shrink-0 overflow-hidden rounded-lg border border-[var(--color-border)]">
                      <HybridMediaCard src={col.coverImage} alt={col.coverAlt} aspect="16/9" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-[var(--color-primary)]">
                        {col.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'} · {col.documentIds.length} bài đọc
                      </div>
                      <h3 className="mt-0.5 font-display text-base font-semibold text-[var(--color-text)]">
                        {col.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-[var(--color-text-muted)] line-clamp-2">
                        {col.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => loadColForEdit(col)}
                      aria-label={`Sửa bộ sưu tập ${col.title}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteColTarget(col)}
                      aria-label={`Xóa bộ sưu tập ${col.title}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="lg:col-span-6 rounded-2xl p-5 sm:p-6 surface-card">
            <h2 className="font-display text-xl font-semibold pb-3 border-b border-[var(--color-border)]">
              {editingColId ? 'Chỉnh sửa Hành trình Tri thức' : 'Tạo Hành trình Tri thức mới'}
            </h2>
            <form onSubmit={handleColSubmit} className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="col-title" className="block text-xs font-medium mb-1">
                  Tên bộ sưu tập *
                </label>
                <input
                  id="col-title"
                  type="text"
                  value={colTitle}
                  onChange={(e) => setColTitle(e.target.value)}
                  placeholder="Ví dụ: Con người, Tự do và Đạo đức"
                  className="input-editorial"
                />
              </div>
              <div>
                <label htmlFor="col-desc" className="block text-xs font-medium mb-1">
                  Mô tả mục tiêu lộ trình
                </label>
                <textarea
                  id="col-desc"
                  rows={2}
                  value={colDesc}
                  onChange={(e) => setColDesc(e.target.value)}
                  className="textarea-editorial"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="col-cover" className="block text-xs font-medium mb-1">
                    Ảnh bìa bộ sưu tập
                  </label>
                  <select
                    id="col-cover"
                    value={colCover}
                    onChange={(e) => setColCover(e.target.value)}
                    className="input-editorial !text-xs"
                  >
                    {EDITORIAL_COVER_CATALOG.map((opt) => (
                      <option key={opt.src} value={opt.src}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="col-status" className="block text-xs font-medium mb-1">
                    Trạng thái
                  </label>
                  <select
                    id="col-status"
                    value={colStatus}
                    onChange={(e) => setColStatus(e.target.value as 'published' | 'draft')}
                    className="input-editorial !text-xs"
                  >
                    <option value="published">Công khai lên Library</option>
                    <option value="draft">Lưu nháp</option>
                  </select>
                </div>
              </div>

              {/* Selected order preview */}
              {colDocIds.length > 0 && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/55 p-3 space-y-1.5">
                  <div className="text-xs font-semibold text-[var(--color-text)]">
                    Trình tự đọc đã chọn ({colDocIds.length} bài):
                  </div>
                  {colDocIds.map((docId, idx) => {
                    const found = publishedDocuments.find((d) => d.id === docId);
                    if (!found) return null;
                    return (
                      <div
                        key={docId}
                        className="flex items-center justify-between gap-2 rounded-lg bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
                      >
                        <span className="truncate">
                          <strong className="text-[var(--color-primary)]">{idx + 1}.</strong> {found.title}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveDocInCollection(idx, 'up')}
                            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === colDocIds.length - 1}
                            onClick={() => moveDocInCollection(idx, 'down')}
                            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Checklist of published documents */}
              <div>
                <div className="text-xs font-medium mb-1.5">
                  Chọn bài đọc đã xuất bản đưa vào hành trình:
                </div>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/40 p-2.5 space-y-1.5">
                  {publishedDocuments.map((doc) => {
                    const checked = colDocIds.includes(doc.id);
                    return (
                      <label
                        key={doc.id}
                        className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-[var(--color-surface)] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDocInCollection(doc.id)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="font-medium text-[var(--color-text)] block">
                            {doc.title}
                          </span>
                          <span className="text-[11px] text-[var(--color-text-muted)]">
                            {doc.category} · {doc.readingMinutes} phút
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                {editingColId && (
                  <button type="button" onClick={resetColForm} className="btn-secondary !text-xs">
                    Hủy
                  </button>
                )}
                <button type="submit" className="btn-primary !text-xs">
                  {editingColId ? 'Cập nhật hành trình' : 'Lưu hành trình'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Confirm Delete Document Modal */}
      <ConfirmModal
        open={Boolean(deleteDocTarget)}
        destructive
        title="Xóa bản chỉnh sửa tài liệu?"
        description={
          deleteDocTarget
            ? `Bạn chắc chắn muốn xóa tài liệu "${deleteDocTarget.title}" khỏi danh sách tùy chỉnh?`
            : ''
        }
        confirmLabel="Xóa tài liệu"
        onCancel={() => setDeleteDocTarget(null)}
        onConfirm={() => {
          if (deleteDocTarget) {
            deleteAdminDocument(deleteDocTarget.id);
            showToast(`Đã xóa tài liệu "${deleteDocTarget.title}".`, { variant: 'info' });
            if (editingDocId === deleteDocTarget.id) resetDocForm();
          }
          setDeleteDocTarget(null);
        }}
      />

      {/* Confirm Delete Collection Modal */}
      <ConfirmModal
        open={Boolean(deleteColTarget)}
        destructive
        title="Xóa Hành trình Tri thức?"
        description={
          deleteColTarget
            ? `Bạn chắc chắn muốn xóa bộ sưu tập "${deleteColTarget.title}"? Các bài đọc bên trong vẫn được giữ nguyên.`
            : ''
        }
        confirmLabel="Xóa bộ sưu tập"
        onCancel={() => setDeleteColTarget(null)}
        onConfirm={() => {
          if (deleteColTarget) {
            deleteCollection(deleteColTarget.id);
            showToast(`Đã xóa bộ sưu tập "${deleteColTarget.title}".`, { variant: 'info' });
            if (editingColId === deleteColTarget.id) resetColForm();
          }
          setDeleteColTarget(null);
        }}
      />
    </div>
  );
}
