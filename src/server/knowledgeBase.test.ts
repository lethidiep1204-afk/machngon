import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  formatFullDocumentForPrompt,
  KnowledgeBaseService,
  parseKnowledgeMarkdownFile,
} from './knowledgeBase.ts';
import { getSystemPrompt } from '../lib/ai/systemPrompts.ts';
import { executeDebateEngine, extractJsonObject } from '../lib/ai/debateEngine.ts';
import { SEED_DOCUMENTS } from '../content/seedDocuments.ts';
import type { LabApiRequestPayload, LabApiResponsePayload, LibraryDocument } from '../lib/types.ts';

async function createTempKbEnv() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'machngon-kb-test-'));
  const adminStorePath = path.join(root, 'data', 'machngon-knowledge-base.json');
  const knowledgeDocsDir = path.join(root, 'knowledge_docs');
  await fs.mkdir(knowledgeDocsDir, { recursive: true });
  const service = new KnowledgeBaseService({ adminStorePath, knowledgeDocsDir });
  return { root, adminStorePath, knowledgeDocsDir, service };
}

test('parseKnowledgeMarkdownFile splits Markdown cleanly by ## headings and preserves metadata', () => {
  const md = `# Chuyên đề Ngụy biện Người rơm

> Tác giả: Thầy Minh Khôi
> Chủ đề: Logic và lập luận
> Từ khóa: ngụy biện, người rơm, phản biện

## Khái niệm cốt lõi

Ngụy biện người rơm xảy ra khi người tranh luận bóp méo luận điểm của đối phương thành phiên bản dễ công kích hơn.

## Ví dụ thực tế trong lớp học

> Khi bạn A đề xuất giảm bài tập về nhà, bạn B đáp rằng "Bạn muốn cả lớp không học gì nữa à?" — đó là một ví dụ điển hình.
`;

  const doc = parseKnowledgeMarkdownFile('nguy_bien_nguoi_rom.md', md);
  assert.equal(doc.id, 'kb_file_nguy-bien-nguoi-rom');
  assert.equal(doc.title, 'Chuyên đề Ngụy biện Người rơm');
  assert.equal(doc.author, 'Thầy Minh Khôi');
  assert.equal(doc.category, 'Logic và lập luận');
  assert.equal(doc.status, 'published');
  assert.equal(doc.sections.length, 2);
  assert.equal(doc.sections[0].title, 'Khái niệm cốt lõi');
  assert.equal(doc.sections[1].title, 'Ví dụ thực tế trong lớp học');
  assert.equal(doc.blocks.length, 2);
  assert.equal(doc.blocks[1].type, 'quote');
});

test('KnowledgeBaseService aggregates 3 sources, formats full document, and weights private docs higher in RAG', async () => {
  const { root, service } = await createTempKbEnv();
  try {
    // 1. Sync a custom admin document
    const adminDoc: LibraryDocument = {
      id: 'admin-doc-trach-nhiem-so',
      title: 'Trách nhiệm đạo đức trong kỷ nguyên trí tuệ nhân tạo',
      subtitle: 'Tài liệu riêng từ trang quản trị',
      author: 'Tổ Ngữ Văn THPT',
      source: 'Chuyên đề nội bộ 2026',
      publishedDate: '2026-11-20',
      readingMinutes: 4,
      category: 'Tư duy phản biện',
      coverImage: '',
      coverAlt: 'Trách nhiệm AI',
      excerpt: 'Tư duy phản biện giúp học sinh kiểm chứng nguồn tin khi dùng công cụ AI.',
      keywords: ['trách nhiệm đạo đức', 'trí tuệ nhân tạo', 'kiểm chứng nguồn tin'],
      sections: [
        { id: 'sec-1', title: 'Nguyên tắc kiểm chứng kép' },
        { id: 'sec-2', title: 'Ranh giới giữa hỗ trợ và lệ thuộc' },
      ],
      blocks: [
        {
          id: 'blk-1',
          sectionId: 'sec-1',
          type: 'prose',
          content:
            'Nguyên tắc kiểm chứng kép yêu cầu học sinh đối chiếu dữ kiện do AI cung cấp với nguồn học thuật gốc trước khi trích dẫn.',
        },
        {
          id: 'blk-2',
          sectionId: 'sec-2',
          type: 'counterargument',
          label: 'Phản biện',
          content:
            'Nếu giao toàn bộ khâu lập luận cho máy móc, người học sẽ đánh mất năng lực tự phát hiện lỗ hổng logic.',
        },
      ],
      status: 'published',
    };

    const syncRes = await service.syncAdminDocuments([adminDoc]);
    assert.equal(syncRes.syncedCount, 1);
    assert.equal(syncRes.publishedCount, 1);

    // 2. Upload a local Markdown file into knowledge_docs/
    const uploadRes = await service.uploadKnowledgeFile(
      'chuyen-de-nguyen-tac-bac-ai.md',
      `# Bài giảng riêng về Nguyên tắc Bác ái trong tranh biện

> Tác giả: Cô Thu Hà
> Chủ đề: Logic và lập luận

## Bản chất nguyên tắc bác ái

Khi áp dụng nguyên tắc bác ái (Principle of Charity), người phản biện cần diễn giải lập luận của đối phương theo phiên bản chặt chẽ nhất trước khi phản bác.

## Ứng dụng trong lớp học THPT

Nhờ diễn giải thiện chí, buổi tranh luận tránh được công kích cá nhân và tập trung vào bằng chứng thực tế.
`
    );
    assert.equal(uploadRes.filename, 'chuyen_de_nguyen_tac_bac_ai.md');
    assert.equal(uploadRes.sectionsCount, 2);

    // 3. Verify status combines all 3 sources
    const status = await service.getStatus();
    assert.equal(status.seedCount, SEED_DOCUMENTS.length);
    assert.equal(status.adminCount, 1);
    assert.equal(status.localFileCount, 1);
    assert.equal(status.totalDocuments, SEED_DOCUMENTS.length + 2);

    // 4. Verify getDocumentById + hasPublishedDocument across all 3 sources
    assert.equal(await service.hasPublishedDocument(SEED_DOCUMENTS[0].id), true);
    assert.equal(await service.hasPublishedDocument(adminDoc.id), true);
    assert.equal(await service.hasPublishedDocument(uploadRes.documentId), true);
    assert.equal(await service.hasPublishedDocument('non-existent-doc-xyz'), false);

    const fetchedAdmin = await service.getDocumentById(adminDoc.id);
    assert.ok(fetchedAdmin);
    const fullPromptText = formatFullDocumentForPrompt(fetchedAdmin);
    assert.match(fullPromptText, /Nguyên tắc kiểm chứng kép/);
    assert.match(fullPromptText, /Ranh giới giữa hỗ trợ và lệ thuộc/);
    assert.match(fullPromptText, /\[Phản biện\]/);

    // 5. Verify RAG retrieval surfaces concepts + prioritizes private knowledge_docs/ & /admin docs
    const ragCharity = await service.retrieveRelevantContext(
      'Nguyên tắc bác ái trong tranh biện là gì và ứng dụng ra sao?',
      { maxExcerpts: 4 }
    );
    assert.ok(ragCharity.concepts.length >= 1);
    assert.ok(ragCharity.excerpts.length >= 1 && ragCharity.excerpts.length <= 4);
    assert.equal(ragCharity.excerpts[0].sourceType, 'knowledge_file');
    assert.equal(ragCharity.excerpts[0].documentId, uploadRes.documentId);

    // 6. Verify getSystemPrompt injects full attached doc + RAG excerpts + citation rule
    const prompt = getSystemPrompt(
      'debate',
      {
        title: fetchedAdmin.title,
        author: fetchedAdmin.author,
        excerpt: fetchedAdmin.excerpt,
        fullText: fullPromptText,
      },
      ragCharity
    );
    assert.match(prompt, /HỌC LIỆU ĐÍNH KÈM TRỰC TIẾP TỪ THƯ VIỆN/);
    assert.match(prompt, /KHO TRI THỨC & TÀI LIỆU NỘI BỘ TRUY XUẤT \(RAG\)/);
    assert.match(prompt, /Trích dẫn chính xác tên tài liệu/);
    assert.match(prompt, /Nguyên tắc kiểm chứng kép/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('uploadKnowledgeFile enforces extension allowlist and confines filenames safely inside knowledge_docs', async () => {
  const { root, knowledgeDocsDir, service } = await createTempKbEnv();
  try {
    await assert.rejects(
      () => service.uploadKnowledgeFile('malware.js', 'console.log(1)'),
      /\.md hoặc \.txt/
    );

    const res = await service.uploadKnowledgeFile(
      '../../escape_attempt.md',
      '# Tiêu đề an toàn\n\n## Mục 1\nNội dung kiểm thử bảo mật.'
    );
    assert.equal(res.filename, 'escape_attempt.md');
    const savedInside = await fs.readFile(path.join(knowledgeDocsDir, 'escape_attempt.md'), 'utf8');
    assert.match(savedInside, /Tiêu đề an toàn/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('extractJsonObject handles raw JSON and markdown-fenced JSON cleanly', () => {
  const fenced = '```json\n{"user_claim_summary": "Tự do gắn liền trách nhiệm"}\n```';
  const parsed = extractJsonObject(fenced);
  assert.equal(parsed.user_claim_summary, 'Tự do gắn liền trách nhiệm');
});

test('executeDebateEngine performs automatic 4-tier failover (Gemini 429 -> OpenRouter -> OpenAI -> Local Fallback)', async () => {
  const basePayload: LabApiRequestPayload = {
    session_id: 'failover-test-1',
    lab_type: 'debate',
    message: 'Tự do cá nhân luôn cần đi kèm trách nhiệm với cộng đồng.',
    resource_context_id: null,
  };

  const makeFakeResponse = (
    engine: LabApiResponsePayload['source_engine'],
    responseId: string
  ): LabApiResponsePayload => ({
    session_id: basePayload.session_id,
    lab_type: basePayload.lab_type,
    response_id: responseId,
    source_engine: engine,
    user_claim_summary: 'Tóm tắt lập luận',
    ai_claim_summary: 'Phản hồi thử nghiệm',
    new_assumptions: [],
    contradiction_note: null,
    contradiction_ref: null,
    debate_steps: [
      { key: 'identify', title: 'Identify', vietnameseTitle: 'Lập trường & khái niệm', summary: 'ok' },
      { key: 'analyze', title: 'Analyze', vietnameseTitle: 'Giả định & bằng chứng', summary: 'ok' },
      { key: 'challenge', title: 'Challenge', vietnameseTitle: 'Phản ví dụ thử thách', summary: 'ok' },
      { key: 'synthesize', title: 'Synthesize', vietnameseTitle: 'Điều chỉnh quan điểm', summary: 'ok' },
      { key: 'respond', title: 'Respond', vietnameseTitle: 'Tổng kết & gợi mở', summary: 'ok' },
    ],
    three_layer: {
      tldr: 'Ghi nhận ý chính.',
      facts: 'Cơ sở thực tế.',
      assumptions: 'Giả định ngầm.',
      interpretation: 'Điểm cần kiểm tra.',
      guidingQuestion: 'Bạn nghĩ sao về ngoại lệ này?',
    },
  });

  // Case 1: Gemini fails with HTTP 429 / RESOURCE_EXHAUSTED -> OpenRouter succeeds (no 429 thrown!)
  const order1: string[] = [];
  const res1 = await executeDebateEngine(basePayload, {
    callGemini: async () => {
      order1.push('gemini');
      const err = new Error('429 RESOURCE_EXHAUSTED') as Error & { status?: number };
      err.status = 429;
      throw err;
    },
    callOpenRouter: async () => {
      order1.push('openrouter');
      return makeFakeResponse('openai-responses', 'resp_openrouter_ok');
    },
    callOpenAI: async () => {
      order1.push('openai');
      return makeFakeResponse('openai-responses', 'resp_openai_should_not_run');
    },
  });
  assert.deepEqual(order1, ['gemini', 'openrouter']);
  assert.equal(res1.response_id, 'resp_openrouter_ok');
  assert.equal(res1.source_engine, 'openai-responses');

  // Case 2: Gemini + OpenRouter fail -> OpenAI succeeds
  const order2: string[] = [];
  const res2 = await executeDebateEngine(basePayload, {
    callGemini: async () => {
      order2.push('gemini');
      throw new Error('GEMINI_TIMEOUT');
    },
    callOpenRouter: async () => {
      order2.push('openrouter');
      const err = new Error('OPENROUTER_RATE_LIMIT_429') as Error & { status?: number };
      err.status = 429;
      throw err;
    },
    callOpenAI: async () => {
      order2.push('openai');
      return makeFakeResponse('openai-responses', 'resp_openai_ok');
    },
  });
  assert.deepEqual(order2, ['gemini', 'openrouter', 'openai']);
  assert.equal(res2.response_id, 'resp_openai_ok');

  // Case 3: All 3 cloud APIs fail -> Local Fallback runs smoothly
  const order3: string[] = [];
  const res3 = await executeDebateEngine(basePayload, {
    callGemini: async () => {
      order3.push('gemini');
      throw new Error('429 RESOURCE_EXHAUSTED');
    },
    callOpenRouter: async () => {
      order3.push('openrouter');
      throw new Error('Network error');
    },
    callOpenAI: async () => {
      order3.push('openai');
      throw new Error('OPENAI_TIMEOUT');
    },
  });
  assert.deepEqual(order3, ['gemini', 'openrouter', 'openai']);
  assert.equal(res3.source_engine, 'local-fallback');
  assert.equal(res3.debate_steps.length, 5);
});
