import { LEGACY_CATEGORY_MAP } from '../../data/library/categories.ts';
import type { DocumentBlock, DocumentCategory, LibraryDocument } from '../types.ts';

/**
 * Normalizes legacy or dash-variant category names into canonical Library categories.
 */
export function normalizeCategoryName(category: string): DocumentCategory {
  const key = category.replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
  return LEGACY_CATEGORY_MAP[key] ?? (category.trim() as DocumentCategory);
}

/**
 * Estimates academic Vietnamese reading time from actual document content (~175 words/min
 * for deliberate reflective reading, clamped to a minimum of 3 minutes).
 */
export function estimateReadingMinutes(blocks: DocumentBlock[], excerpt = ''): number {
  const fullText = [
    excerpt,
    ...blocks.map((b) => `${b.heading ?? ''} ${b.content} ${b.citation ?? ''}`),
  ].join(' ');
  const words = fullText
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  if (words === 0) return 3;
  return Math.max(3, Math.round(words / 175));
}

export function isSafeHttpUrl(url?: string): boolean {
  if (!url || !url.trim()) return true;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isDocumentVerified(doc: LibraryDocument): boolean {
  if (doc.verified !== true) return false;
  if (doc.reviewStatus === 'editing' || doc.reviewStatus === 'pending_source') return false;
  const refs = doc.references ?? [];
  return refs.some((ref) => ref.verified);
}

export function getDifficultyLabel(difficulty?: LibraryDocument['difficulty']): string {
  switch (difficulty) {
    case 'intro':
      return 'Nhập môn';
    case 'advanced':
      return 'Chuyên sâu';
    case 'explore':
    default:
      return 'Khám phá';
  }
}

export function getReviewStatusLabel(status?: LibraryDocument['reviewStatus']): string {
  switch (status) {
    case 'editing':
      return 'Chờ biên tập';
    case 'pending_source':
      return 'Chờ kiểm tra nguồn';
    case 'verified':
      return 'Đã kiểm duyệt';
    case 'published':
      return 'Đã xuất bản';
    case 'archived':
      return 'Đã lưu trữ';
    default:
      return 'Chưa phân loại';
  }
}
