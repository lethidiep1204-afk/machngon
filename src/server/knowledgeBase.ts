import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LIBRARY_CONCEPTS } from '../content/library/concepts.ts';
import { SEED_DOCUMENTS } from '../content/seedDocuments.ts';
import type {
  DocumentBlock,
  DocumentCategory,
  DocumentSection,
  LibraryConcept,
  LibraryDocument,
} from '../lib/types.ts';
import { normalizeVietnamese } from '../lib/vietnamese.ts';

export type KnowledgeSourceType = 'seed' | 'admin' | 'knowledge_file';

export interface IndexedKnowledgeDocument {
  document: LibraryDocument;
  sourceType: KnowledgeSourceType;
  fileName?: string;
}

export interface RagConceptHit {
  id: string;
  term: string;
  englishTerm?: string;
  shortDefinition: string;
  example?: string;
  score: number;
}

export interface RagExcerptHit {
  documentId: string;
  documentTitle: string;
  author: string;
  sectionTitle?: string;
  sourceType: KnowledgeSourceType;
  content: string;
  score: number;
}

export interface RagContextResult {
  concepts: RagConceptHit[];
  excerpts: RagExcerptHit[];
}

export interface KnowledgeBaseStatus {
  seedCount: number;
  adminCount: number;
  adminPublishedCount: number;
  localFileCount: number;
  totalDocuments: number;
  totalPublished: number;
  totalConcepts: number;
  localFiles: Array<{
    filename: string;
    documentId: string;
    title: string;
    sectionsCount: number;
  }>;
  lastSyncedAt: string | null;
}

interface PersistedKnowledgeStore {
  version: number;
  updatedAt: string;
  documents: LibraryDocument[];
}

const DEFAULT_DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'machngon-data')
  : path.resolve(process.cwd(), 'data');
const DEFAULT_ADMIN_STORE_PATH = path.join(DEFAULT_DATA_DIR, 'machngon-knowledge-base.json');
const DEFAULT_KNOWLEDGE_DOCS_DIR = path.resolve(process.cwd(), 'knowledge_docs');

const MAX_UPLOAD_BYTES = 500 * 1024; // 500 KB
const MAX_SYNC_DOCUMENTS = 200;

const VALID_CATEGORIES: Set<DocumentCategory> = new Set([
  'Ngôn ngữ học',
  'Văn học và lý luận văn học',
  'Triết học và tư tưởng',
  'Logic và lập luận',
  'Tư duy phản biện',
  'Kiến thức liên ngành',
  'Ngôn ngữ',
  'Ngữ văn',
  'Tư duy và lập luận',
  'Văn hóa - xã hội',
  'Văn hóa – xã hội',
  'Lịch sử - Văn hóa',
  'Kỹ năng viết',
  'Khác',
]);

const VIETNAMESE_STOPWORDS = new Set([
  'la',
  'va',
  'cua',
  'cho',
  'voi',
  'trong',
  'khong',
  'mot',
  'nhung',
  'cac',
  'duoc',
  'co',
  'khi',
  'thi',
  'den',
  'tu',
  'nhu',
  'nay',
  'do',
  've',
  'de',
  'nguoi',
  'ta',
  'minh',
  'ban',
  'em',
  'toi',
  'chung',
  'hay',
  'hoac',
  'neu',
  'vi',
  'ma',
  'da',
  'se',
  'dang',
  'rat',
  'hon',
  'nhieu',
  'it',
  'chi',
  'tai',
  'theo',
  'tren',
  'duoi',
  'giua',
  'bang',
  'cung',
  'lai',
  'con',
  'phai',
  'nen',
  'can',
  'muon',
  'thay',
  'biet',
  'noi',
  'lam',
  'sao',
  'gi',
  'nao',
  'the',
  'day',
  'roi',
  'qua',
  'het',
]);

function slugifyId(raw: string): string {
  const normalized = normalizeVietnamese(raw)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || `doc-${Date.now().toString(36)}`;
}

function tokenizeForRag(text: string): string[] {
  const normalized = normalizeVietnamese(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return [];
  const rawTokens = normalized.split(' ').filter((tok) => tok.length >= 2);
  const filtered = rawTokens.filter((tok) => !VIETNAMESE_STOPWORDS.has(tok));
  return filtered.length > 0 ? filtered : rawTokens;
}

function buildBigrams(tokens: string[]): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
}

function estimateReadingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

function sanitizeCategory(raw: unknown): DocumentCategory {
  if (typeof raw === 'string' && VALID_CATEGORIES.has(raw as DocumentCategory)) {
    return raw as DocumentCategory;
  }
  return 'Kiến thức liên ngành';
}

function sanitizeAdminDocument(raw: unknown): LibraryDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? obj.id.trim().slice(0, 120) : '';
  const title = typeof obj.title === 'string' ? obj.title.trim().slice(0, 240) : '';
  if (!id || !title) return null;

  const sections: DocumentSection[] = Array.isArray(obj.sections)
    ? obj.sections
        .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
        .map((s, idx) => ({
          id: typeof s.id === 'string' && s.id.trim() ? s.id.trim().slice(0, 80) : `sec-${idx + 1}`,
          title:
            typeof s.title === 'string' && s.title.trim()
              ? s.title.trim().slice(0, 200)
              : `Phần ${idx + 1}`,
        }))
        .slice(0, 60)
    : [];

  const validBlockTypes = new Set(['prose', 'concept', 'quote', 'counterargument', 'question']);
  const blocks: DocumentBlock[] = Array.isArray(obj.blocks)
    ? obj.blocks
        .filter((b): b is Record<string, unknown> => Boolean(b && typeof b === 'object'))
        .map((b, idx): DocumentBlock | null => {
          const content = typeof b.content === 'string' ? b.content.trim().slice(0, 12000) : '';
          if (!content) return null;
          const rawType = typeof b.type === 'string' ? b.type : 'prose';
          return {
            id: typeof b.id === 'string' && b.id.trim() ? b.id.trim().slice(0, 80) : `blk-${idx + 1}`,
            sectionId:
              typeof b.sectionId === 'string' && b.sectionId.trim()
                ? b.sectionId.trim().slice(0, 80)
                : sections[0]?.id ?? 'sec-1',
            type: (validBlockTypes.has(rawType) ? rawType : 'prose') as DocumentBlock['type'],
            label: typeof b.label === 'string' ? b.label.trim().slice(0, 120) : undefined,
            heading: typeof b.heading === 'string' ? b.heading.trim().slice(0, 200) : undefined,
            content,
            citation: typeof b.citation === 'string' ? b.citation.trim().slice(0, 300) : undefined,
          };
        })
        .filter((b): b is DocumentBlock => b !== null)
        .slice(0, 200)
    : [];

  const keywords: string[] = Array.isArray(obj.keywords)
    ? obj.keywords
        .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
        .map((k) => k.trim().slice(0, 80))
        .slice(0, 30)
    : [];

  const excerpt =
    typeof obj.excerpt === 'string' && obj.excerpt.trim()
      ? obj.excerpt.trim().slice(0, 1000)
      : blocks[0]?.content.slice(0, 280) ?? title;

  return {
    id,
    title,
    subtitle: typeof obj.subtitle === 'string' ? obj.subtitle.trim().slice(0, 300) : '',
    author:
      typeof obj.author === 'string' && obj.author.trim()
        ? obj.author.trim().slice(0, 160)
        : 'Biên tập viên Mạch Ngôn',
    source:
      typeof obj.source === 'string' && obj.source.trim()
        ? obj.source.trim().slice(0, 240)
        : 'Tài liệu nội bộ Mạch Ngôn (/admin)',
    publishedDate:
      typeof obj.publishedDate === 'string' && obj.publishedDate.trim()
        ? obj.publishedDate.trim().slice(0, 40)
        : new Date().toISOString().slice(0, 10),
    readingMinutes:
      typeof obj.readingMinutes === 'number' && Number.isFinite(obj.readingMinutes) && obj.readingMinutes > 0
        ? Math.round(obj.readingMinutes)
        : estimateReadingMinutes(blocks.map((b) => b.content).join(' ')),
    category: sanitizeCategory(obj.category),
    coverImage: typeof obj.coverImage === 'string' ? obj.coverImage.slice(0, 400) : '',
    coverAlt: typeof obj.coverAlt === 'string' ? obj.coverAlt.slice(0, 200) : title,
    excerpt,
    keywords,
    sections: sections.length > 0 ? sections : [{ id: 'sec-1', title: 'Nội dung chính' }],
    blocks,
    status: obj.status === 'draft' ? 'draft' : 'published',
  };
}

/**
 * Parses a local Markdown (.md) or plain text (.txt) file inside `knowledge_docs/`
 * into a structured LibraryDocument split cleanly by `## ` headings.
 */
export function parseKnowledgeMarkdownFile(
  fileName: string,
  rawContent: string,
  mtimeIso?: string
): LibraryDocument {
  const baseName = fileName.replace(/\.(md|txt)$/i, '');
  const slug = slugifyId(baseName);
  const docId = `kb_file_${slug}`;

  let content = rawContent.replace(/\r\n/g, '\n').trim();
  let title = baseName.replace(/[-_]+/g, ' ').trim();
  let author = 'Tài liệu nội bộ (knowledge_docs)';
  let source = `knowledge_docs/${fileName}`;
  let category: DocumentCategory = 'Kiến thức liên ngành';
  let keywords: string[] = [];
  let subtitle = '';

  // Optional YAML-style frontmatter block
  if (content.startsWith('---\n')) {
    const endIdx = content.indexOf('\n---', 4);
    if (endIdx !== -1) {
      const fmBlock = content.slice(4, endIdx);
      content = content.slice(endIdx + 4).trim();
      for (const line of fmBlock.split('\n')) {
        const match = line.match(/^([a-zA-ZÀ-ỹ_-]+)\s*:\s*(.+)$/);
        if (!match) continue;
        const key = normalizeVietnamese(match[1]);
        const val = match[2].trim().replace(/^["']|["']$/g, '');
        if (key === 'title' || key === 'tieu de') title = val;
        else if (key === 'subtitle' || key === 'phu de') subtitle = val;
        else if (key === 'author' || key === 'tac gia') author = val;
        else if (key === 'source' || key === 'nguon') source = val;
        else if (key === 'category' || key === 'chu de' || key === 'danh muc') {
          category = sanitizeCategory(val);
        } else if (key === 'keywords' || key === 'tu khoa' || key === 'tags') {
          keywords = val
            .replace(/^\[|\]$/g, '')
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
    }
  }

  // Extract first `# Title` if present
  const lines = content.split('\n');
  const remainingLines: string[] = [];
  let foundH1 = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!foundH1 && /^#\s+(.+)$/.test(line.trim())) {
      title = line.trim().replace(/^#\s+/, '').trim();
      foundH1 = true;
      continue;
    }

    // Inline metadata lines before first `## ` heading (e.g., "> Tác giả: ...")
    if (remainingLines.length < 6 && !line.trim().startsWith('## ')) {
      const metaMatch = line
        .trim()
        .replace(/^>\s*/, '')
        .match(/^\*?\*?(Tác giả|Chủ đề|Danh mục|Nguồn|Từ khóa)\*?\*?\s*:\s*(.+)$/i);
      if (metaMatch) {
        const metaKey = normalizeVietnamese(metaMatch[1]);
        const metaVal = metaMatch[2].trim();
        if (metaKey === 'tac gia') author = metaVal;
        else if (metaKey === 'chu de' || metaKey === 'danh muc') category = sanitizeCategory(metaVal);
        else if (metaKey === 'nguon') source = metaVal;
        else if (metaKey === 'tu khoa') {
          keywords = metaVal
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter(Boolean);
        }
        continue;
      }
    }

    remainingLines.push(line);
  }

  const body = remainingLines.join('\n').trim();
  const rawChunks = body.split(/(?=^##\s+)/m).filter((c) => c.trim().length > 0);

  const sections: DocumentSection[] = [];
  const blocks: DocumentBlock[] = [];

  if (rawChunks.length === 0) {
    sections.push({ id: 'sec-1', title: 'Nội dung chính' });
    if (body) {
      blocks.push({
        id: `${docId}-blk-1`,
        sectionId: 'sec-1',
        type: 'prose',
        content: body,
      });
    }
  } else {
    rawChunks.forEach((chunk, sIdx) => {
      const chunkLines = chunk.trim().split('\n');
      let secTitle = sIdx === 0 ? 'Giới thiệu chung' : `Mục ${sIdx + 1}`;
      let startLine = 0;

      if (chunkLines[0]?.trim().startsWith('## ')) {
        secTitle = chunkLines[0].trim().replace(/^##\s+/, '').trim();
        startLine = 1;
      }

      const secId = `sec-${sIdx + 1}`;
      const secBody = chunkLines.slice(startLine).join('\n').trim();
      if (!secBody && chunkLines[0]?.trim().startsWith('## ')) {
        sections.push({ id: secId, title: secTitle });
        return;
      }

      sections.push({ id: secId, title: secTitle });

      // Split section content into readable blocks by blank lines, merging short adjacent list blocks
      const paragraphs = secBody
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);

      paragraphs.forEach((para, pIdx) => {
        let blockType: DocumentBlock['type'] = 'prose';
        let cleanPara = para;

        if (para.startsWith('> ')) {
          blockType = 'quote';
          cleanPara = para
            .split('\n')
            .map((l) => l.replace(/^>\s?/, ''))
            .join(' ')
            .trim();
        } else if (/^###\s+/.test(para)) {
          const paraLines = para.split('\n');
          const heading = paraLines[0].replace(/^###\s+/, '').trim();
          const rest = paraLines.slice(1).join('\n').trim();
          blocks.push({
            id: `${docId}-s${sIdx + 1}-b${pIdx + 1}`,
            sectionId: secId,
            type: 'concept',
            heading,
            content: rest || heading,
          });
          return;
        }

        blocks.push({
          id: `${docId}-s${sIdx + 1}-b${pIdx + 1}`,
          sectionId: secId,
          type: blockType,
          content: cleanPara,
        });
      });
    });
  }

  const firstBlockText = blocks[0]?.content ?? body;
  const excerpt =
    firstBlockText.replace(/\s+/g, ' ').trim().slice(0, 260) ||
    `Tài liệu riêng "${title}" trong thư mục knowledge_docs.`;

  if (keywords.length === 0) {
    keywords = Array.from(new Set(tokenizeForRag(`${title} ${sections.map((s) => s.title).join(' ')}`))).slice(
      0,
      8
    );
  }

  return {
    id: docId,
    title,
    subtitle: subtitle || `Tài liệu nội bộ (${sections.length} mục)`,
    author,
    source,
    publishedDate: (mtimeIso ?? new Date().toISOString()).slice(0, 10),
    readingMinutes: estimateReadingMinutes(body || title),
    category,
    coverImage: '',
    coverAlt: title,
    excerpt,
    keywords,
    sections,
    blocks,
    status: 'published',
  };
}

/**
 * Formats an entire attached LibraryDocument (metadata + all sections & blocks)
 * into clean Vietnamese prompt text for AI grounding.
 */
export function formatFullDocumentForPrompt(
  doc: LibraryDocument,
  maxChars: number = 12_000
): string {
  const headerLines = [
    `Tiêu đề: "${doc.title}"`,
    doc.subtitle ? `Phụ đề: ${doc.subtitle}` : null,
    `Tác giả: ${doc.author}`,
    `Nguồn: ${doc.source}`,
    `Danh mục: ${doc.category}`,
    doc.keywords.length > 0 ? `Từ khóa: ${doc.keywords.join(', ')}` : null,
    `Tóm tắt: ${doc.excerpt}`,
  ].filter(Boolean);

  const sectionTitleMap = new Map(doc.sections.map((s) => [s.id, s.title]));
  const blocksBySection = new Map<string, DocumentBlock[]>();

  for (const section of doc.sections) {
    blocksBySection.set(section.id, []);
  }
  for (const block of doc.blocks) {
    const existing = blocksBySection.get(block.sectionId);
    if (existing) {
      existing.push(block);
    } else {
      blocksBySection.set(block.sectionId, [block]);
    }
  }

  const bodyParts: string[] = [];
  for (const [secId, secBlocks] of blocksBySection.entries()) {
    if (secBlocks.length === 0) continue;
    const secTitle = sectionTitleMap.get(secId) ?? secId;
    const formattedBlocks = secBlocks.map((b) => {
      const prefixParts: string[] = [];
      if (b.label) prefixParts.push(`[${b.label}]`);
      if (b.heading) prefixParts.push(b.heading);
      const prefix = prefixParts.length > 0 ? `${prefixParts.join(' ')}: ` : '';
      const cite = b.citation ? ` (Nguồn: ${b.citation})` : '';
      return `${prefix}${b.content}${cite}`;
    });
    bodyParts.push(`## ${secTitle}\n${formattedBlocks.join('\n')}`);
  }

  const fullText = `${headerLines.join('\n')}\n\nNỘI DUNG ĐẦY ĐỦ:\n${bodyParts.join('\n\n')}`;
  if (fullText.length <= maxChars) {
    return fullText;
  }
  return `${fullText.slice(0, maxChars).trimEnd()}\n... [Đã rút gọn phần cuối tài liệu để đảm bảo ngữ cảnh tối ưu]`;
}

export class KnowledgeBaseService {
  private readonly adminStorePath: string;
  private readonly knowledgeDocsDir: string;

  constructor(options?: { adminStorePath?: string; knowledgeDocsDir?: string }) {
    this.adminStorePath = options?.adminStorePath ?? DEFAULT_ADMIN_STORE_PATH;
    this.knowledgeDocsDir = options?.knowledgeDocsDir ?? DEFAULT_KNOWLEDGE_DOCS_DIR;
  }

  private async readAdminStore(): Promise<PersistedKnowledgeStore> {
    try {
      const raw = await fs.readFile(this.adminStorePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedKnowledgeStore>;
      const docs = Array.isArray(parsed.documents)
        ? parsed.documents
            .map((d) => sanitizeAdminDocument(d))
            .filter((d): d is LibraryDocument => d !== null)
        : [];
      return {
        version: typeof parsed.version === 'number' ? parsed.version : 1,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
        documents: docs,
      };
    } catch {
      return { version: 1, updatedAt: '', documents: [] };
    }
  }

  private async writeAdminStore(documents: LibraryDocument[]): Promise<string> {
    const updatedAt = new Date().toISOString();
    const payload: PersistedKnowledgeStore = {
      version: 1,
      updatedAt,
      documents,
    };
    const dir = path.dirname(this.adminStorePath);
    await fs.mkdir(dir, { recursive: true });
    const tmpPath = `${this.adminStorePath}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
    await fs.rename(tmpPath, this.adminStorePath);
    return updatedAt;
  }

  private async loadLocalKnowledgeFiles(): Promise<IndexedKnowledgeDocument[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.knowledgeDocsDir);
    } catch {
      return [];
    }

    const supportedFiles = entries
      .filter((name) => /\.(md|txt)$/i.test(name) && !name.startsWith('.'))
      .sort((a, b) => a.localeCompare(b));

    const results: IndexedKnowledgeDocument[] = [];
    const resolvedBase = path.resolve(this.knowledgeDocsDir);

    for (const fileName of supportedFiles) {
      const fullPath = path.resolve(resolvedBase, fileName);
      if (!fullPath.startsWith(resolvedBase + path.sep)) continue;
      try {
        const stat = await fs.stat(fullPath);
        if (!stat.isFile() || stat.size > MAX_UPLOAD_BYTES * 2) continue;
        const content = await fs.readFile(fullPath, 'utf8');
        if (!content.trim()) continue;
        const doc = parseKnowledgeMarkdownFile(fileName, content, stat.mtime.toISOString());
        results.push({
          document: doc,
          sourceType: 'knowledge_file',
          fileName,
        });
      } catch (err) {
        console.warn(`[KnowledgeBase] Không thể đọc tệp ${fileName}:`, err);
      }
    }

    return results;
  }

  /**
   * Aggregates all 3 knowledge sources:
   * 1. SEED_DOCUMENTS (24 built-in docs)
   * 2. Admin custom/edited docs persisted in data/machngon-knowledge-base.json (overrides seed by id)
   * 3. Local .md / .txt files in knowledge_docs/
   */
  async getAllIndexedDocuments(): Promise<IndexedKnowledgeDocument[]> {
    const [adminStore, localFiles] = await Promise.all([
      this.readAdminStore(),
      this.loadLocalKnowledgeFiles(),
    ]);

    const adminMap = new Map(adminStore.documents.map((d) => [d.id, d]));
    const indexed: IndexedKnowledgeDocument[] = [];

    // 1. Seed docs (overridden by admin edits when same ID exists)
    const seedIds = new Set<string>();
    for (const seedDoc of SEED_DOCUMENTS) {
      seedIds.add(seedDoc.id);
      const adminOverride = adminMap.get(seedDoc.id);
      if (adminOverride) {
        indexed.push({ document: adminOverride, sourceType: 'admin' });
      } else {
        indexed.push({ document: seedDoc, sourceType: 'seed' });
      }
    }

    // 2. Newly created admin documents
    for (const adminDoc of adminStore.documents) {
      if (!seedIds.has(adminDoc.id)) {
        indexed.push({ document: adminDoc, sourceType: 'admin' });
      }
    }

    // 3. Local knowledge_docs/*.md|*.txt files
    for (const localItem of localFiles) {
      indexed.push(localItem);
    }

    return indexed;
  }

  /**
   * Returns full LibraryDocument (including all sections & blocks) by ID across all 3 sources.
   */
  async getDocumentById(id?: string | null): Promise<LibraryDocument | null> {
    if (!id || typeof id !== 'string') return null;
    const cleaned = id.trim();
    if (!cleaned || cleaned.length > 140) return null;

    const allDocs = await this.getAllIndexedDocuments();
    const match = allDocs.find((item) => item.document.id === cleaned);
    return match ? match.document : null;
  }

  /**
   * Verifies that a document ID exists and is published across any of the 3 sources.
   */
  async hasPublishedDocument(id?: string | null): Promise<boolean> {
    const doc = await this.getDocumentById(id);
    return Boolean(doc && doc.status === 'published');
  }

  formatFullDocumentForPrompt(doc: LibraryDocument, maxChars?: number): string {
    return formatFullDocumentForPrompt(doc, maxChars);
  }

  /**
   * Retrieves matching concepts from LIBRARY_CONCEPTS and up to `maxExcerpts` (default 4)
   * most relevant document excerpts across the entire knowledge base,
   * prioritizing private documents from /admin and knowledge_docs/.
   */
  async retrieveRelevantContext(
    query: string,
    options?: {
      excludeDocumentId?: string | null;
      maxExcerpts?: number;
      maxConcepts?: number;
    }
  ): Promise<RagContextResult> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return { concepts: [], excerpts: [] };
    }

    const maxExcerpts = options?.maxExcerpts ?? 4;
    const maxConcepts = options?.maxConcepts ?? 3;
    const excludeDocId = options?.excludeDocumentId ?? null;

    const normalizedQuery = normalizeVietnamese(trimmedQuery);
    const queryTokens = Array.from(new Set(tokenizeForRag(trimmedQuery)));
    const queryBigrams = buildBigrams(tokenizeForRag(trimmedQuery));

    if (queryTokens.length === 0) {
      return { concepts: [], excerpts: [] };
    }

    // 1. Score LIBRARY_CONCEPTS
    const scoredConcepts: RagConceptHit[] = [];
    for (const concept of LIBRARY_CONCEPTS) {
      const score = this.scoreConcept(concept, normalizedQuery, queryTokens);
      if (score >= 2.2) {
        scoredConcepts.push({
          id: concept.id,
          term: concept.term,
          englishTerm: concept.englishTerm,
          shortDefinition: concept.shortDefinition,
          example: concept.example,
          score,
        });
      }
    }
    scoredConcepts.sort((a, b) => b.score - a.score);
    const topConcepts = scoredConcepts.slice(0, maxConcepts);

    // 2. Score chunks across all published documents from all 3 sources
    const indexedDocs = await this.getAllIndexedDocuments();
    const candidateExcerpts: RagExcerptHit[] = [];

    for (const { document: doc, sourceType } of indexedDocs) {
      if (doc.status !== 'published') continue;
      if (excludeDocId && doc.id === excludeDocId) continue;

      // Priority weighting for private documents (/admin and knowledge_docs/)
      const sourceMultiplier = sourceType === 'seed' ? 1.0 : 1.65;

      const docTitleNorm = normalizeVietnamese(doc.title);
      const docKeywordsNorm = normalizeVietnamese(
        [doc.subtitle, doc.category, ...doc.keywords, ...(doc.tags ?? [])].join(' ')
      );

      let docMetaBonus = 0;
      for (const token of queryTokens) {
        if (docTitleNorm.includes(token)) docMetaBonus += 1.4;
        else if (docKeywordsNorm.includes(token)) docMetaBonus += 0.7;
      }
      for (const bg of queryBigrams) {
        if (docTitleNorm.includes(bg)) docMetaBonus += 2.2;
        else if (docKeywordsNorm.includes(bg)) docMetaBonus += 1.2;
      }

      const sectionTitleMap = new Map(doc.sections.map((s) => [s.id, s.title]));

      // Group blocks by section to form coherent excerpts (or fallback to excerpt if no blocks)
      const sectionBlocks = new Map<string, string[]>();
      for (const block of doc.blocks) {
        const list = sectionBlocks.get(block.sectionId) ?? [];
        const piece = block.heading ? `${block.heading}: ${block.content}` : block.content;
        list.push(piece);
        sectionBlocks.set(block.sectionId, list);
      }

      if (sectionBlocks.size === 0) {
        const chunkText = doc.excerpt;
        const score =
          (this.scoreTextChunk(chunkText, normalizedQuery, queryTokens, queryBigrams) + docMetaBonus) *
          sourceMultiplier;
        if (score >= 2.0) {
          candidateExcerpts.push({
            documentId: doc.id,
            documentTitle: doc.title,
            author: doc.author,
            sourceType,
            content: chunkText.slice(0, 620),
            score,
          });
        }
        continue;
      }

      for (const [secId, pieces] of sectionBlocks.entries()) {
        const sectionTitle = sectionTitleMap.get(secId) ?? '';
        const combinedText = pieces.join('\n').trim();
        if (!combinedText) continue;

        const secTitleNorm = normalizeVietnamese(sectionTitle);
        let secBonus = 0;
        for (const token of queryTokens) {
          if (secTitleNorm.includes(token)) secBonus += 1.1;
        }
        for (const bg of queryBigrams) {
          if (secTitleNorm.includes(bg)) secBonus += 1.8;
        }

        const chunkScore = this.scoreTextChunk(
          combinedText,
          normalizedQuery,
          queryTokens,
          queryBigrams
        );

        const totalScore = (chunkScore + secBonus + docMetaBonus * 0.65) * sourceMultiplier;
        if (totalScore >= 2.2) {
          candidateExcerpts.push({
            documentId: doc.id,
            documentTitle: doc.title,
            author: doc.author,
            sectionTitle: sectionTitle || undefined,
            sourceType,
            content: this.selectBestSnippet(combinedText, queryTokens, 640),
            score: totalScore,
          });
        }
      }
    }

    candidateExcerpts.sort((a, b) => b.score - a.score);

    // Diversity cap: max 2 excerpts from the same document so multiple sources can surface
    const selectedExcerpts: RagExcerptHit[] = [];
    const docHitCount = new Map<string, number>();

    for (const hit of candidateExcerpts) {
      if (selectedExcerpts.length >= maxExcerpts) break;
      const count = docHitCount.get(hit.documentId) ?? 0;
      if (count >= 2) continue;
      selectedExcerpts.push(hit);
      docHitCount.set(hit.documentId, count + 1);
    }

    return {
      concepts: topConcepts,
      excerpts: selectedExcerpts,
    };
  }

  private scoreConcept(
    concept: LibraryConcept,
    normalizedQuery: string,
    queryTokens: string[]
  ): number {
    const termNorm = normalizeVietnamese(concept.term);
    const engNorm = concept.englishTerm ? normalizeVietnamese(concept.englishTerm) : '';
    const aliasesNorm = (concept.matchAliases ?? []).map((a) => normalizeVietnamese(a));
    const defNorm = normalizeVietnamese(concept.shortDefinition);

    let score = 0;
    if (termNorm.length >= 3 && normalizedQuery.includes(termNorm)) {
      score += 6.0;
    }
    if (engNorm.length >= 3 && normalizedQuery.includes(engNorm)) {
      score += 5.0;
    }
    for (const alias of aliasesNorm) {
      if (alias.length >= 3 && normalizedQuery.includes(alias)) {
        score += 4.8;
        break;
      }
    }

    for (const token of queryTokens) {
      if (termNorm.includes(token)) score += 1.4;
      else if (defNorm.includes(token)) score += 0.45;
    }
    return score;
  }

  private scoreTextChunk(
    text: string,
    normalizedQuery: string,
    queryTokens: string[],
    queryBigrams: string[]
  ): number {
    const normText = normalizeVietnamese(text);
    if (!normText) return 0;

    let score = 0;
    let matchedTokenCount = 0;

    for (const token of queryTokens) {
      if (normText.includes(token)) {
        matchedTokenCount += 1;
        score += 1.0;
      }
    }

    for (const bg of queryBigrams) {
      if (normText.includes(bg)) {
        score += 1.8;
      }
    }

    // Bonus for matching a higher ratio of distinct query terms
    if (queryTokens.length >= 2 && matchedTokenCount >= 2) {
      score += (matchedTokenCount / queryTokens.length) * 1.5;
    }

    // Exact phrase match bonus for concise queries
    if (normalizedQuery.length >= 6 && normalizedQuery.length <= 60 && normText.includes(normalizedQuery)) {
      score += 3.5;
    }

    return score;
  }

  private selectBestSnippet(text: string, queryTokens: string[], maxChars: number): string {
    const clean = text.replace(/\n{3,}/g, '\n\n').trim();
    if (clean.length <= maxChars) return clean;

    const paragraphs = clean.split(/\n+/).filter(Boolean);
    if (paragraphs.length <= 1) {
      return `${clean.slice(0, maxChars).trimEnd()}...`;
    }

    // Rank paragraphs by token overlap and pick the highest-scoring window
    let bestIdx = 0;
    let bestScore = -1;
    paragraphs.forEach((p, idx) => {
      const pNorm = normalizeVietnamese(p);
      const score = queryTokens.reduce((sum, tok) => sum + (pNorm.includes(tok) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });

    const chosen: string[] = [paragraphs[bestIdx]];
    let len = paragraphs[bestIdx].length;
    if (bestIdx + 1 < paragraphs.length && len + paragraphs[bestIdx + 1].length + 1 <= maxChars) {
      chosen.push(paragraphs[bestIdx + 1]);
      len += paragraphs[bestIdx + 1].length + 1;
    }
    const result = chosen.join('\n');
    return result.length <= maxChars ? result : `${result.slice(0, maxChars).trimEnd()}...`;
  }

  /**
   * Synchronizes custom/edited admin documents from /admin into data/machngon-knowledge-base.json.
   */
  async syncAdminDocuments(
    rawDocuments: unknown[]
  ): Promise<{ syncedCount: number; publishedCount: number; updatedAt: string }> {
    if (!Array.isArray(rawDocuments)) {
      throw new Error('Danh sách tài liệu đồng bộ phải là một mảng hợp lệ.');
    }
    if (rawDocuments.length > MAX_SYNC_DOCUMENTS) {
      throw new Error(`Số lượng tài liệu đồng bộ vượt quá giới hạn ${MAX_SYNC_DOCUMENTS} mục.`);
    }

    const dedupMap = new Map<string, LibraryDocument>();
    for (const item of rawDocuments) {
      const sanitized = sanitizeAdminDocument(item);
      if (sanitized) {
        dedupMap.set(sanitized.id, sanitized);
      }
    }

    const sanitizedDocs = Array.from(dedupMap.values());
    const updatedAt = await this.writeAdminStore(sanitizedDocs);
    const publishedCount = sanitizedDocs.filter((d) => d.status === 'published').length;

    return {
      syncedCount: sanitizedDocs.length,
      publishedCount,
      updatedAt,
    };
  }

  /**
   * Saves a validated .md or .txt file safely inside `knowledge_docs/` with strict path confinement.
   */
  async uploadKnowledgeFile(
    rawFilename: string,
    rawContent: string
  ): Promise<{
    filename: string;
    documentId: string;
    title: string;
    sectionsCount: number;
    bytes: number;
  }> {
    if (typeof rawFilename !== 'string' || !rawFilename.trim()) {
      throw new Error('Thiếu tên tệp tài liệu.');
    }
    if (typeof rawContent !== 'string' || !rawContent.trim()) {
      throw new Error('Nội dung tài liệu không được để trống.');
    }

    const trimmedContent = rawContent.trim();
    const byteLength = Buffer.byteLength(trimmedContent, 'utf8');
    if (byteLength > MAX_UPLOAD_BYTES) {
      throw new Error('Tệp tài liệu vượt quá giới hạn tối đa 500 KB.');
    }

    // Reject any path traversal attempts and normalize filename to safe characters
    const baseOnly = path.basename(rawFilename.trim());
    const extMatch = baseOnly.match(/\.(md|txt)$/i);
    if (!extMatch) {
      throw new Error('Chỉ hỗ trợ tệp định dạng .md hoặc .txt.');
    }

    const ext = extMatch[0].toLowerCase();
    const stemRaw = baseOnly.slice(0, -ext.length);
    const safeStem = slugifyId(stemRaw).replace(/-/g, '_');
    if (!safeStem) {
      throw new Error('Tên tệp không hợp lệ.');
    }
    const safeFilename = `${safeStem}${ext}`;

    const resolvedBaseDir = path.resolve(this.knowledgeDocsDir);
    const resolvedTarget = path.resolve(resolvedBaseDir, safeFilename);
    if (!resolvedTarget.startsWith(resolvedBaseDir + path.sep)) {
      throw new Error('Đường dẫn tệp không hợp lệ.');
    }

    await fs.mkdir(resolvedBaseDir, { recursive: true });
    const tmpPath = `${resolvedTarget}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmpPath, `${trimmedContent}\n`, 'utf8');
    await fs.rename(tmpPath, resolvedTarget);

    const parsedDoc = parseKnowledgeMarkdownFile(
      safeFilename,
      trimmedContent,
      new Date().toISOString()
    );

    return {
      filename: safeFilename,
      documentId: parsedDoc.id,
      title: parsedDoc.title,
      sectionsCount: parsedDoc.sections.length,
      bytes: byteLength,
    };
  }

  /**
   * Returns current indexing status across all 3 knowledge sources.
   */
  async getStatus(): Promise<KnowledgeBaseStatus> {
    const [adminStore, localFiles, allIndexed] = await Promise.all([
      this.readAdminStore(),
      this.loadLocalKnowledgeFiles(),
      this.getAllIndexedDocuments(),
    ]);

    return {
      seedCount: SEED_DOCUMENTS.length,
      adminCount: adminStore.documents.length,
      adminPublishedCount: adminStore.documents.filter((d) => d.status === 'published').length,
      localFileCount: localFiles.length,
      totalDocuments: allIndexed.length,
      totalPublished: allIndexed.filter((i) => i.document.status === 'published').length,
      totalConcepts: LIBRARY_CONCEPTS.length,
      localFiles: localFiles.map((item) => ({
        filename: item.fileName ?? `${item.document.id}.md`,
        documentId: item.document.id,
        title: item.document.title,
        sectionsCount: item.document.sections.length,
      })),
      lastSyncedAt: adminStore.updatedAt || null,
    };
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
