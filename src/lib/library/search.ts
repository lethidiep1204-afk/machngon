import { LIBRARY_CONCEPTS } from '../../data/library/concepts.ts';
import type { LibraryConcept, LibraryDocument } from '../types.ts';

/**
 * Normalizes Vietnamese text for diacritic-insensitive search (including đ/Đ -> d).
 */
export function normalizeVietnameseText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SearchSuggestionsResult {
  documents: LibraryDocument[];
  concepts: LibraryConcept[];
}

export function scoreDocumentMatch(
  doc: LibraryDocument,
  rawQuery: string,
  concepts: LibraryConcept[] = LIBRARY_CONCEPTS
): number {
  const normalizedQuery = normalizeVietnameseText(rawQuery);
  if (!normalizedQuery) return 1;

  const tokens = normalizedQuery.split(' ').filter((token) => token.length > 0);
  if (tokens.length === 0) return 1;

  const title = normalizeVietnameseText(doc.title);
  const subtitle = normalizeVietnameseText(doc.subtitle);
  const category = normalizeVietnameseText(doc.category);
  const author = normalizeVietnameseText(doc.author);
  const excerpt = normalizeVietnameseText(doc.excerpt);
  const keywordsText = normalizeVietnameseText(
    [...doc.keywords, ...(doc.tags ?? [])].join(' ')
  );
  const conceptTermsText = normalizeVietnameseText(
    concepts
      .filter((c) => doc.relatedConceptIds?.includes(c.id) || c.documentIds.includes(doc.id))
      .map((c) => `${c.term} ${c.englishTerm ?? ''} ${(c.matchAliases ?? []).join(' ')}`)
      .join(' ')
  );
  const bodyText = normalizeVietnameseText(
    doc.blocks.map((b) => `${b.heading ?? ''} ${b.content}`).join(' ')
  );

  let score = 0;

  // Full phrase bonuses
  if (title.includes(normalizedQuery)) score += 30;
  if (keywordsText.includes(normalizedQuery)) score += 22;
  if (conceptTermsText.includes(normalizedQuery)) score += 20;
  if (category.includes(normalizedQuery)) score += 16;
  if (subtitle.includes(normalizedQuery) || excerpt.includes(normalizedQuery)) score += 14;
  if (author.includes(normalizedQuery)) score += 10;
  if (bodyText.includes(normalizedQuery)) score += 8;

  // Token-level matching (all tokens must appear somewhere in the searchable corpus)
  const combined = `${title} ${subtitle} ${category} ${author} ${excerpt} ${keywordsText} ${conceptTermsText} ${bodyText}`;
  let matchedTokens = 0;
  for (const token of tokens) {
    if (combined.includes(token)) {
      matchedTokens += 1;
      if (title.includes(token)) score += 8;
      else if (keywordsText.includes(token) || conceptTermsText.includes(token)) score += 6;
      else if (category.includes(token) || subtitle.includes(token)) score += 4;
      else score += 2;
    }
  }

  if (matchedTokens < tokens.length) {
    return 0;
  }

  return score;
}

export function searchDocuments(
  docs: LibraryDocument[],
  rawQuery: string,
  concepts: LibraryConcept[] = LIBRARY_CONCEPTS
): LibraryDocument[] {
  const normalizedQuery = normalizeVietnameseText(rawQuery);
  if (!normalizedQuery) return docs;

  return docs
    .map((doc) => ({ doc, score: scoreDocumentMatch(doc, normalizedQuery, concepts) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.doc);
}

/**
 * Returns live dropdown suggestions strictly backed by real published documents and concepts.
 */
export function getSearchSuggestions(
  rawQuery: string,
  publishedDocs: LibraryDocument[],
  concepts: LibraryConcept[] = LIBRARY_CONCEPTS,
  maxDocs = 4,
  maxConcepts = 3
): SearchSuggestionsResult {
  const normalizedQuery = normalizeVietnameseText(rawQuery);
  if (normalizedQuery.length < 1) {
    return { documents: [], concepts: [] };
  }

  const publishedIds = new Set(publishedDocs.map((d) => d.id));
  const matchedDocs = searchDocuments(publishedDocs, normalizedQuery, concepts).slice(0, maxDocs);

  const matchedConcepts = concepts
    .filter((concept) => {
      const hasPublishedDoc = concept.documentIds.some((id) => publishedIds.has(id));
      if (!hasPublishedDoc) return false;
      const haystack = normalizeVietnameseText(
        `${concept.term} ${concept.englishTerm ?? ''} ${concept.shortDefinition} ${(concept.matchAliases ?? []).join(' ')}`
      );
      return haystack.includes(normalizedQuery);
    })
    .slice(0, maxConcepts);

  return {
    documents: matchedDocs,
    concepts: matchedConcepts,
  };
}

export const LIBRARY_SUGGESTED_KEYWORDS = [
  'Tự do',
  'Hạnh phúc',
  'Ngôn ngữ',
  'Tư duy phản biện',
  'Lập luận',
  'Văn học',
  'Triết học',
] as const;
