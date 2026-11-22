import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_DOCUMENTS, DOCUMENT_CATEGORIES } from '../../data/seedDocuments.ts';
import {
  DEFAULT_LIBRARY_CATEGORIES,
  EDITORIAL_TOPIC_ROADMAP,
} from '../../data/library/categories.ts';
import { LIBRARY_CONCEPTS } from '../../data/library/concepts.ts';
import { DEFAULT_LIBRARY_COLLECTIONS } from '../../data/library/collections.ts';
import {
  estimateReadingMinutes,
  isDocumentVerified,
  isSafeHttpUrl,
  normalizeCategoryName,
} from './validation.ts';
import {
  getSearchSuggestions,
  normalizeVietnameseText,
  searchDocuments,
} from './search.ts';
import {
  getLabFollowUpDocuments,
  getPersonalizedRecommendations,
  getRelatedDocuments,
} from './recommendations.ts';
import type { LibraryDocument, UserProfile } from '../types.ts';

const LEGACY_V1_IDS = [
  'triet-hoc-hien-sinh-con-nguoi-va-su-tu-do',
  'ngon-ngu-va-tu-duy-moi-lien-he-bien-chung',
  'nguyen-tac-bac-ai-va-nghe-thuat-phan-bien',
  've-dep-ham-suc-cua-tho-ca-co-dien-viet-nam',
  'nguy-bien-trong-dien-ngon-cong-cong',
  'phong-cach-ngon-ngu-va-an-du-trong-doi-song',
];

test('Library catalog has 24 verified published documents across 6 standardized categories', () => {
  assert.equal(SEED_DOCUMENTS.length, 24);
  assert.equal(DEFAULT_LIBRARY_CATEGORIES.length, 6);
  // DOCUMENT_CATEGORIES includes 'Tất cả' + 6 canonical disciplines
  assert.equal(DOCUMENT_CATEGORIES.length, 7);
  assert.equal(DOCUMENT_CATEGORIES[0], 'Tất cả');

  const ids = new Set<string>();
  const conceptIds = new Set(LIBRARY_CONCEPTS.map((c) => c.id));
  const collectionIds = new Set(DEFAULT_LIBRARY_COLLECTIONS.map((c) => c.id));
  const canonicalCategoryNames = DEFAULT_LIBRARY_CATEGORIES.map((c) => c.name);
  const countByCategory = new Map<string, number>();

  for (const doc of SEED_DOCUMENTS) {
    assert.ok(!ids.has(doc.id), `Duplicate document id found: ${doc.id}`);
    ids.add(doc.id);

    assert.equal(doc.status, 'published', `Seed document ${doc.id} must be published`);
    assert.equal(
      isDocumentVerified(doc),
      true,
      `Seed document ${doc.id} must pass isDocumentVerified()`
    );
    assert.ok(doc.readingMinutes >= 3, `Document ${doc.id} readingMinutes must be >= 3`);
    assert.ok(doc.blocks.length >= 3, `Document ${doc.id} must have >= 3 content blocks`);
    assert.ok(
      (doc.references?.length ?? 0) >= 2,
      `Document ${doc.id} must have >= 2 verified references`
    );

    const canonicalCategory = normalizeCategoryName(doc.category);
    assert.ok(
      canonicalCategoryNames.includes(canonicalCategory),
      `Document ${doc.id} category "${doc.category}" not in canonical 6 categories`
    );
    countByCategory.set(canonicalCategory, (countByCategory.get(canonicalCategory) ?? 0) + 1);

    for (const cid of doc.relatedConceptIds ?? []) {
      assert.ok(conceptIds.has(cid), `Document ${doc.id} references unknown concept ${cid}`);
    }
    for (const colId of doc.collectionIds ?? []) {
      assert.ok(collectionIds.has(colId), `Document ${doc.id} references unknown collection ${colId}`);
    }
  }

  for (const legacyId of LEGACY_V1_IDS) {
    assert.ok(ids.has(legacyId), `Legacy V1 document ID "${legacyId}" must be preserved`);
  }

  for (const category of canonicalCategoryNames) {
    assert.equal(
      countByCategory.get(category),
      4,
      `Category "${category}" expected 4 documents, got ${countByCategory.get(category)}`
    );
  }
});

test('Collections (5), Concepts (15), and 60-topic Editorial Roadmap maintain referential integrity', () => {
  const publishedIds = new Set(SEED_DOCUMENTS.map((d) => d.id));

  assert.equal(DEFAULT_LIBRARY_COLLECTIONS.length, 5);
  for (const col of DEFAULT_LIBRARY_COLLECTIONS) {
    assert.ok(col.documentIds.length >= 3, `Collection ${col.id} must contain at least 3 docs`);
    for (const docId of col.documentIds) {
      assert.ok(
        publishedIds.has(docId),
        `Collection ${col.id} references missing document ${docId}`
      );
    }
  }

  assert.equal(LIBRARY_CONCEPTS.length, 15);
  for (const concept of LIBRARY_CONCEPTS) {
    assert.ok(concept.documentIds.length >= 1, `Concept ${concept.id} must link to >= 1 doc`);
    for (const docId of concept.documentIds) {
      assert.ok(
        publishedIds.has(docId),
        `Concept ${concept.id} references missing document ${docId}`
      );
    }
  }

  assert.equal(EDITORIAL_TOPIC_ROADMAP.length, 60);
  const publishedTopics = EDITORIAL_TOPIC_ROADMAP.filter((t) => Boolean(t.publishedDocId));
  const upcomingTopics = EDITORIAL_TOPIC_ROADMAP.filter((t) => !t.publishedDocId);
  assert.equal(publishedTopics.length, 24);
  assert.equal(upcomingTopics.length, 36);
  for (const topic of publishedTopics) {
    assert.ok(
      topic.publishedDocId && publishedIds.has(topic.publishedDocId),
      `Published roadmap topic "${topic.title}" must link to an existing document`
    );
  }
});

test('Vietnamese search and live suggestions handle diacritics, concepts, and never leak drafts', () => {
  assert.equal(normalizeVietnameseText('Đạo đức & Tư duy phản biện'), 'dao duc & tu duy phan bien');

  const freedomMatches = searchDocuments(SEED_DOCUMENTS, 'tu do');
  assert.ok(
    freedomMatches.some((d) => d.id === 'triet-hoc-hien-sinh-con-nguoi-va-su-tu-do'),
    'Search "tu do" should match existentialism freedom document'
  );

  const fallacyMatches = searchDocuments(SEED_DOCUMENTS, 'nguy bien');
  assert.ok(
    fallacyMatches.some((d) => d.id === 'nguy-bien-trong-dien-ngon-cong-cong'),
    'Search "nguy bien" should match fallacies document'
  );

  const socratesMatches = searchDocuments(SEED_DOCUMENTS, 'Socrates');
  assert.ok(socratesMatches.length >= 1, 'Search "Socrates" should match Socratic/philosophy docs');

  const sapirMatches = searchDocuments(SEED_DOCUMENTS, 'Sapir-Whorf');
  assert.ok(
    sapirMatches.some((d) => d.id === 'ngon-ngu-va-tu-duy-moi-lien-he-bien-chung'),
    'Search "Sapir-Whorf" should match language & thought document via concept metadata'
  );

  const suggestions = getSearchSuggestions('ngu dung', SEED_DOCUMENTS);
  assert.ok(suggestions.documents.length > 0 || suggestions.concepts.length > 0);
  for (const doc of suggestions.documents) {
    assert.equal(doc.status, 'published');
  }
});

test('Unified recommendation engine excludes current doc and drafts while respecting limits', () => {
  const current = SEED_DOCUMENTS[0];
  const fakeDraft: LibraryDocument = {
    ...SEED_DOCUMENTS[1],
    id: 'secret-draft-doc',
    title: 'Bản nháp nội bộ chưa xuất bản',
    status: 'draft',
  };
  const mixedCatalog = [...SEED_DOCUMENTS, fakeDraft];

  const related = getRelatedDocuments(current, mixedCatalog, 3);
  assert.equal(related.length, 3);
  assert.ok(related.every((d) => d.id !== current.id && d.status === 'published'));

  const mockUser: UserProfile = {
    name: 'Minh An',
    email: 'minhan@example.com',
    roleLabel: 'Học sinh',
    isAuthenticated: true,
    onboardingCompleted: true,
    interests: ['Triết học và tư tưởng', 'Logic và lập luận'],
    readingDepth: 'Phân tích chuyên sâu',
    debateStyle: 'Socratic gợi mở',
    goal: 'Rèn tư duy phản biện',
    weeklyRhythm: '3 buổi / tuần',
    exploreTopic: 'lập luận',
  };

  const personalized = getPersonalizedRecommendations(mockUser, mixedCatalog, {}, [], 3);
  assert.equal(personalized.length, 3);
  assert.ok(personalized.every((d) => d.status === 'published'));

  const labFollowUp = getLabFollowUpDocuments(current.id, '', mixedCatalog, LIBRARY_CONCEPTS, 3);
  assert.equal(labFollowUp.length, 3);
  assert.ok(labFollowUp.every((d) => d.id !== current.id && d.status === 'published'));
});

test('Security & validation helpers enforce safe URLs, reading time floor, and legacy category normalization', () => {
  assert.equal(isSafeHttpUrl('https://plato.stanford.edu/entries/socrates/'), true);
  assert.equal(isSafeHttpUrl('http://example.org/paper'), true);
  assert.equal(isSafeHttpUrl(''), true);
  assert.equal(isSafeHttpUrl('javascript:alert(1)'), false);
  assert.equal(isSafeHttpUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isSafeHttpUrl('vbscript:msgbox(1)'), false);

  assert.equal(normalizeCategoryName('Triết học – Tư tưởng'), 'Triết học và tư tưởng');
  assert.equal(normalizeCategoryName('Ngôn ngữ'), 'Ngôn ngữ học');
  assert.equal(normalizeCategoryName('Tư duy – Lập luận'), 'Logic và lập luận');
  assert.equal(normalizeCategoryName('Văn hóa – Xã hội'), 'Kiến thức liên ngành');

  assert.equal(estimateReadingMinutes([], ''), 3);
});
