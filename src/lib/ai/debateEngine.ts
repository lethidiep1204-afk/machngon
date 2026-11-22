import { GoogleGenAI, Type } from '@google/genai';
import { SEED_DOCUMENTS } from '../../data/seedDocuments.ts';
import type {
  DebateStepItem,
  LabApiRequestPayload,
  LabApiResponsePayload,
  LibraryDocument,
  ThreeLayerResponse,
} from '../types.ts';
import { runLocalFallbackEngine } from './localFallbackEngine.ts';
import { getSystemPrompt } from './systemPrompts.ts';

// In-memory server map keeping OpenAI Responses API `previous_response_id` per `session_id`
const sessionPreviousResponseMap = new Map<string, string>();

const STRUCTURED_OUTPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'user_claim_summary',
    'ai_claim_summary',
    'new_assumptions',
    'contradiction_note',
    'contradiction_ref',
    'debate_steps',
    'three_layer',
  ],
  properties: {
    user_claim_summary: { type: 'string' },
    ai_claim_summary: { type: 'string' },
    new_assumptions: {
      type: 'array',
      items: { type: 'string' },
    },
    contradiction_note: { type: ['string', 'null'] },
    contradiction_ref: { type: ['string', 'null'] },
    debate_steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'title', 'vietnameseTitle', 'summary'],
        properties: {
          key: {
            type: 'string',
            enum: ['identify', 'analyze', 'challenge', 'synthesize', 'respond'],
          },
          title: { type: 'string' },
          vietnameseTitle: { type: 'string' },
          summary: { type: 'string' },
        },
      },
    },
    three_layer: {
      type: 'object',
      additionalProperties: false,
      required: ['tldr', 'facts', 'assumptions', 'interpretation', 'guidingQuestion', 'questionHint'],
      properties: {
        tldr: { type: 'string' },
        facts: { type: 'string' },
        assumptions: { type: 'string' },
        interpretation: { type: 'string' },
        guidingQuestion: { type: 'string' },
        questionHint: { type: 'string' },
      },
    },
  },
};

function findResourceDocument(id?: string | null): LibraryDocument | null {
  if (!id || typeof id !== 'string') return null;
  const cleaned = id.trim();
  if (!cleaned || cleaned.length > 120) return null;
  return (
    SEED_DOCUMENTS.find((doc) => doc.id === cleaned && doc.status === 'published') ?? null
  );
}

function buildConversationContextPrompt(payload: LabApiRequestPayload): string {
  const parts: string[] = [];

  if (payload.core_assumptions && payload.core_assumptions.length > 0) {
    parts.push(
      `GIẢ ĐỊNH BAN ĐẦU CỦA PHIÊN:\n${payload.core_assumptions.map((a, i) => `- GĐ${i + 1}: ${a}`).join('\n')}`
    );
  }

  if (payload.ledger_snapshot && payload.ledger_snapshot.length > 0) {
    const recentLedger = payload.ledger_snapshot.slice(-16);
    parts.push(
      `SỔ TAY MẠCH LẬP LUẬN (truy xuất để kiểm tra tính nhất quán):\n${recentLedger
        .map((item) => `- ${item.id}: ${item.claim}`)
        .join('\n')}`
    );
  }

  if (payload.history && payload.history.length > 0) {
    const recentTurns = payload.history.slice(-12);
    parts.push(
      `TÓM TẮT LƯỢT TRAO ĐỔI GẦN ĐÂY:\n${recentTurns
        .map((m) => `${m.turnRef ?? m.role}: ${m.content.slice(0, 320)}`)
        .join('\n')}`
    );
  }

  parts.push(`PHÁT BIỂU MỚI NHẤT CỦA NGƯỜI DÙNG:\n${payload.message}`);
  parts.push(
    `Trả về JSON đúng lược đồ với đủ 5 bước debate_steps (identify, analyze, challenge, synthesize, respond) và three_layer (tldr, facts, assumptions, interpretation, guidingQuestion, questionHint). Viết tiếng Việt tự nhiên, trực diện, dễ đọc lướt: dùng gạch đầu dòng ("- ") kèm **in đậm** ý chính đầu dòng, giải thích ngay trong ngoặc đơn nếu có thuật ngữ logic, và luôn kèm 1 ví dụ thực tế ngắn gọn.`
  );

  return parts.join('\n\n');
}

function normalizeDebateSteps(steps: DebateStepItem[] | undefined): DebateStepItem[] {
  const requiredOrder: Array<{ key: DebateStepItem['key']; title: string; vietnameseTitle: string }> = [
    { key: 'identify', title: 'Identify', vietnameseTitle: 'Nắm ý chính' },
    { key: 'analyze', title: 'Analyze', vietnameseTitle: 'Tách lý lẽ' },
    { key: 'challenge', title: 'Challenge', vietnameseTitle: 'Tìm điểm hở' },
    { key: 'synthesize', title: 'Synthesize', vietnameseTitle: 'Đối chiếu mạch' },
    { key: 'respond', title: 'Respond', vietnameseTitle: 'Trả lời gợi mở' },
  ];

  return requiredOrder.map((meta) => {
    const found = steps?.find((s) => s.key === meta.key);
    return {
      key: meta.key,
      title: meta.title,
      vietnameseTitle: meta.vietnameseTitle,
      summary: found?.summary?.trim() || `Hoàn tất bước ${meta.vietnameseTitle} cho lập luận hiện tại.`,
    };
  });
}

function deriveFallbackTldr(
  rawTldr: unknown,
  aiClaimSummary: string,
  interpretation: string
): string {
  if (typeof rawTldr === 'string' && rawTldr.trim().length > 0) {
    return rawTldr.trim();
  }
  const cleanSummary = aiClaimSummary.trim();
  if (cleanSummary.length >= 24) {
    return cleanSummary;
  }
  const firstLine = interpretation
    .replace(/\*\*/g, '')
    .split(/\n+/)
    .map((line) => line.replace(/^[-•]\s*/, '').trim())
    .find(Boolean);
  return firstLine ? firstLine.slice(0, 220) : 'Điểm chính cần làm rõ là phạm vi áp dụng và bằng chứng cho lập luận của bạn.';
}

function normalizeThreeLayer(
  raw: Partial<ThreeLayerResponse> | undefined,
  aiClaimSummary: string
): ThreeLayerResponse {
  const facts = typeof raw?.facts === 'string' ? raw.facts.trim() : '';
  const assumptions = typeof raw?.assumptions === 'string' ? raw.assumptions.trim() : '';
  const interpretation = typeof raw?.interpretation === 'string' ? raw.interpretation.trim() : '';
  const guidingQuestion = typeof raw?.guidingQuestion === 'string' ? raw.guidingQuestion.trim() : '';
  const questionHint =
    typeof raw?.questionHint === 'string' && raw.questionHint.trim().length > 0
      ? raw.questionHint.trim()
      : undefined;

  return {
    tldr: deriveFallbackTldr(raw?.tldr, aiClaimSummary, interpretation),
    facts,
    assumptions,
    interpretation,
    guidingQuestion,
    questionHint,
  };
}

async function callOpenAIResponsesAPI(
  payload: LabApiRequestPayload,
  systemPrompt: string,
  userPrompt: string
): Promise<LabApiResponsePayload> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY_MISSING');
  }

  const prevResponseId =
    payload.previous_response_id ?? sessionPreviousResponseMap.get(payload.session_id) ?? undefined;

  const requestBody: Record<string, unknown> = {
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    instructions: systemPrompt,
    input: userPrompt,
    text: {
      format: {
        type: 'json_schema',
        name: 'mach_ngon_debate_response',
        strict: true,
        schema: STRUCTURED_OUTPUT_JSON_SCHEMA,
      },
    },
  };

  if (
    prevResponseId &&
    prevResponseId.startsWith('resp_') &&
    !prevResponseId.startsWith('resp_local_') &&
    !prevResponseId.startsWith('resp_gem_')
  ) {
    requestBody.previous_response_id = prevResponseId;
  }

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after') || '15');
    const err = new Error('RATE_LIMIT_429') as Error & { status?: number; retryAfter?: number };
    err.status = 429;
    err.retryAfter = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 15;
    throw err;
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`OpenAI Responses API error (${res.status}): ${errorText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    id?: string;
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  const rawJson =
    data.output_text ||
    data.output?.[0]?.content?.find((c) => typeof c.text === 'string')?.text ||
    '';

  const parsed = JSON.parse(rawJson);
  const responseId = data.id || `resp_openai_${Date.now().toString(36)}`;
  sessionPreviousResponseMap.set(payload.session_id, responseId);

  const aiClaimSummary = parsed.ai_claim_summary || 'Phản hồi phân tích 3 lớp dễ hiểu.';

  return {
    session_id: payload.session_id,
    lab_type: payload.lab_type,
    response_id: responseId,
    source_engine: 'openai-responses',
    user_claim_summary: parsed.user_claim_summary || payload.message.slice(0, 120),
    ai_claim_summary: aiClaimSummary,
    new_assumptions: Array.isArray(parsed.new_assumptions) ? parsed.new_assumptions : [],
    contradiction_note: parsed.contradiction_note ?? null,
    contradiction_ref: parsed.contradiction_ref ?? null,
    debate_steps: normalizeDebateSteps(parsed.debate_steps),
    three_layer: normalizeThreeLayer(parsed.three_layer, aiClaimSummary),
  };
}

async function callGeminiStructuredAPI(
  payload: LabApiRequestPayload,
  systemPrompt: string,
  userPrompt: string
): Promise<LabApiResponsePayload> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY_MISSING');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          user_claim_summary: { type: Type.STRING },
          ai_claim_summary: { type: Type.STRING },
          new_assumptions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          contradiction_note: { type: Type.STRING, nullable: true },
          contradiction_ref: { type: Type.STRING, nullable: true },
          debate_steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                key: { type: Type.STRING },
                title: { type: Type.STRING },
                vietnameseTitle: { type: Type.STRING },
                summary: { type: Type.STRING },
              },
              required: ['key', 'title', 'vietnameseTitle', 'summary'],
            },
          },
          three_layer: {
            type: Type.OBJECT,
            properties: {
              tldr: { type: Type.STRING },
              facts: { type: Type.STRING },
              assumptions: { type: Type.STRING },
              interpretation: { type: Type.STRING },
              guidingQuestion: { type: Type.STRING },
              questionHint: { type: Type.STRING },
            },
            required: ['tldr', 'facts', 'assumptions', 'interpretation', 'guidingQuestion'],
          },
        },
        required: [
          'user_claim_summary',
          'ai_claim_summary',
          'new_assumptions',
          'debate_steps',
          'three_layer',
        ],
      },
    },
  });

  const jsonStr = (response.text ?? '').trim();
  const parsed = JSON.parse(jsonStr);
  const responseId = `resp_gem_${payload.session_id.slice(0, 8)}_${Date.now().toString(36)}`;
  sessionPreviousResponseMap.set(payload.session_id, responseId);

  const aiClaimSummary = parsed.ai_claim_summary || 'Phản hồi phân tích 3 lớp dễ hiểu.';

  return {
    session_id: payload.session_id,
    lab_type: payload.lab_type,
    response_id: responseId,
    source_engine: 'gemini',
    user_claim_summary: parsed.user_claim_summary || payload.message.slice(0, 120),
    ai_claim_summary: aiClaimSummary,
    new_assumptions: Array.isArray(parsed.new_assumptions) ? parsed.new_assumptions : [],
    contradiction_note: parsed.contradiction_note ?? null,
    contradiction_ref: parsed.contradiction_ref ?? null,
    debate_steps: normalizeDebateSteps(parsed.debate_steps),
    three_layer: normalizeThreeLayer(parsed.three_layer, aiClaimSummary),
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Unified 5-step Debate Engine pipeline:
 * 1. OpenAI Responses API (/v1/responses + previous_response_id) when OPENAI_API_KEY is set.
 * 2. Gemini API (@google/genai) when GEMINI_API_KEY is available.
 * 3. Local Fallback Engine so Thinking Lab works smoothly out-of-the-box without external keys.
 */
export async function executeDebateEngine(
  payload: LabApiRequestPayload
): Promise<LabApiResponsePayload> {
  const resourceDoc = findResourceDocument(payload.resource_context_id);
  const systemPrompt = getSystemPrompt(
    payload.lab_type,
    resourceDoc
      ? {
          title: resourceDoc.title,
          author: resourceDoc.author,
          excerpt: resourceDoc.excerpt,
        }
      : null
  );
  const userPrompt = buildConversationContextPrompt(payload);

  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0) {
    try {
      return await withTimeout(
        callOpenAIResponsesAPI(payload, systemPrompt, userPrompt),
        12_000,
        'OPENAI'
      );
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 429) {
        throw err;
      }
      console.warn('[DebateEngine] OpenAI Responses fallback triggered:', e.message);
    }
  }

  if (
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY.trim().length > 0 &&
    process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
  ) {
    try {
      return await withTimeout(
        callGeminiStructuredAPI(payload, systemPrompt, userPrompt),
        10_000,
        'GEMINI'
      );
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 429 || e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED')) {
        const rateErr = new Error('RATE_LIMIT_429') as Error & { status?: number; retryAfter?: number };
        rateErr.status = 429;
        rateErr.retryAfter = 15;
        throw rateErr;
      }
      console.warn('[DebateEngine] Gemini API fallback triggered:', e.message);
    }
  }

  return runLocalFallbackEngine(payload, resourceDoc);
}
