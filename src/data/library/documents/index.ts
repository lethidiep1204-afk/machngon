import type { LibraryDocument } from '../../../lib/types';
import { PHILOSOPHY_DOCUMENTS } from './philosophy.ts';
import { LINGUISTICS_DOCUMENTS } from './linguistics.ts';
import { LITERATURE_DOCUMENTS } from './literature.ts';
import { LOGIC_DOCUMENTS } from './logic.ts';
import { CRITICAL_THINKING_DOCUMENTS } from './criticalThinking.ts';
import { INTERDISCIPLINARY_DOCUMENTS } from './interdisciplinary.ts';

/**
 * Complete catalog of 24 verified, published Library documents (4 per canonical category).
 * Note: PHILOSOPHY_DOCUMENTS[0] ('triet-hoc-hien-sinh-con-nguoi-va-su-tu-do') is placed first
 * to preserve default V1 document ordering and test compatibility.
 */
export const ALL_LIBRARY_DOCUMENTS: LibraryDocument[] = [
  ...PHILOSOPHY_DOCUMENTS,
  ...LINGUISTICS_DOCUMENTS,
  ...LITERATURE_DOCUMENTS,
  ...LOGIC_DOCUMENTS,
  ...CRITICAL_THINKING_DOCUMENTS,
  ...INTERDISCIPLINARY_DOCUMENTS,
];

export {
  PHILOSOPHY_DOCUMENTS,
  LINGUISTICS_DOCUMENTS,
  LITERATURE_DOCUMENTS,
  LOGIC_DOCUMENTS,
  CRITICAL_THINKING_DOCUMENTS,
  INTERDISCIPLINARY_DOCUMENTS,
};
