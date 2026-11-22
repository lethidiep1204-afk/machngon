import type { DocumentCategory, LibraryDocument } from '../lib/types';
import { DEFAULT_LIBRARY_CATEGORIES } from './library/categories.ts';
import { ALL_LIBRARY_DOCUMENTS } from './library/documents/index.ts';

export const SEED_DOCUMENTS: LibraryDocument[] = ALL_LIBRARY_DOCUMENTS;

export const DOCUMENT_CATEGORIES: Array<'Tất cả' | DocumentCategory> = [
  'Tất cả',
  ...DEFAULT_LIBRARY_CATEGORIES.map((c) => c.name),
];
