import { GoogleGenAI, Type } from '@google/genai';
import { knowledgeBaseService } from '../../server/knowledgeBase.ts';
import type {
  DebateStepItem,
  LabApiRequestPayload,
  LabApiResponsePayload,
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

const OPENROUTER_JSON_CONTRACT_INSTRUCTION = `
BẮT BUỘC TRẢ VỀ DUY NHẤT MỘT JSON OBJECT HỢP LỆ (không kèm giải thích ngoài JSON, không markdown code block) theo đúng cấu trúc sau:
{
  "user_claim_summary": "Tóm tắt ngắn gọn lập luận của học sinh (1 câu)",
  "ai_claim_summary": "Tóm tắt ngắn gọn phản biện/gợi mở của AI (1 câu)",
  "new_assumptions": ["Giả định ngầm mới phát hiện (nếu có)"],
  "contradiction_note": null,
  "contradiction_ref": null,
  "debate_steps": [
    { "key": "identify", "title": "Identify", "vietnameseTitle": "Lập trường & khái niệm", "summary": "..." },
    { "key": "analyze", "title": "Analyze", "vietnameseTitle": "Giả định & bằng chứng", "summary": "..." },
    { "key": "challenge", "title": "Challenge", "vietnameseTitle": "Phản ví dụ thử thách", "summary": "..." },
    { "key": "synthesize", "title": "Synthesize", "vietnameseTitle": "Điều chỉnh quan điểm", "summary": "..." },
    { "key": "respond", "title": "Respond", "vietnameseTitle": "Tổng kết & gợi mở", "summary": "..." }
  ],
  "three_layer": {
    "tldr": "1-2 câu công nhận ngắn gọn",
    "facts": "1 ý ngắn ghi nhận cơ sở/dẫn chứng (nêu chính xác tên tài liệu nếu trích từ kho)",
    "assumptions": "1 ý ngắn nêu giả định ngầm cần kiểm chứng",
    "interpretation": "2-3 câu ngắn chỉ ra đúng 1 lỗ hổng / phản ví dụ thực tế",
    "guidingQuestion": "DUY NHẤT 1 câu hỏi Socrates sắc bén kết thúc bằng dấu ?",
    "questionHint": "Gợi ý rất ngắn (tối đa 16 từ)"
  }
}
`.trim();

const DEBATE_STAGE_GUIDANCE: Record<number, { label: string; directive: string }> = {
  1: {
    label: 'Bước 1/5 — Xác định lập trường & làm rõ khái niệm cốt lõi',
    directive:
      'Tập trung ghi nhận lập trường/cách hiểu hiện tại, chốt khái niệm trọng tâm và hỏi đúng 1 câu làm rõ ranh giới khái niệm.',
  },
  2: {
    label: 'Bước 2/5 — Kiểm tra giả định & bằng chứng',
    directive:
      'Ghi nhận lý lẽ hợp lý, chỉ ra đúng 1 giả định ngầm hoặc điểm thiếu bằng chứng và hỏi đúng 1 câu kiểm chứng căn cứ.',
  },
  3: {
    label: 'Bước 3/5 — Đưa phản ví dụ thực tế để thử thách lập luận',
    directive:
      'Ghi nhận nỗ lực lập luận, đưa đúng 1 phản ví dụ đời thường sắc bén để kiểm thử độ bền và hỏi đúng 1 câu xem lập luận có còn đứng vững không.',
  },
  4: {
    label: 'Bước 4/5 — Hỗ trợ học sinh điều chỉnh quan điểm',
    directive:
      'Ghi nhận cách học sinh phản hồi trước phản ví dụ, chỉ ra điểm cần siết chặt điều kiện áp dụng và hỏi đúng 1 câu giúp họ hoàn thiện lập trường.',
  },
  5: {
    label: 'Bước 5/5 — Tổng kết so sánh sự tiến bộ lập luận',
    directive:
      'Tổng kết đối chiếu giữa lập trường ban đầu (U#1) và kết luận hiện tại theo Bản đồ truy vết tư duy, kết bằng đúng 1 câu hỏi mở nhẹ để đào sâu tiếp.',
  },
};

/**
 * Removes common Vietnamese spoken-language filler phrases (e.g. from Voice STT)
 * without distorting the student's actual core claim.
 * Uses Unicode-safe whitespace/punctuation boundaries because JS `\b` is ASCII-only.
 */
export function cleanSpokenVietnameseFillers(rawText: string): string {
  if (!rawText) return '';
  let cleaned = rawText.replace(/\s+/g, ' ').trim();

  const fillerPatterns: RegExp[] = [
    /(?<=^|[\s,.;:!?])(?:kiểu\s+như\s+là|kiểu\s+như|thì\s+em\s+thấy\s+là|thì\s+em\s+thấy|thì\s+mình\s+thấy\s+là|thì\s+mình\s+thấy|à\s+mà|nghĩa\s+là|nói\s+chung\s+là|ý\s+em\s+là|ý\s+mình\s+là|thì\s+là|ừm+|ờm+|à+)(?=$|[\s,.;:!?])[\s,]*/giu,
  ];

  for (const pattern of fillerPatterns) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  cleaned = cleaned
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/^[,.;:\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < 6) {
    return rawText.trim();
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Maps current conversation turn count and summary intent to DebateStepper5 stage (1..5).
 */
export function computeDebateStage(userTurnCount: number, isSummary: boolean): number {
  if (isSummary) return 5;
  if (userTurnCount <= 1) return 1;
  if (userTurnCount === 2) return 2;
  if (userTurnCount === 3) return 3;
  if (userTurnCount === 4) return 4;
  return 5;
}

/**
 * Safely extracts and parses a JSON object from model text, even if wrapped in markdown fences.
 */
export function extractJsonObject(rawText: string): Record<string, unknown> {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('EMPTY_JSON_RESPONSE');
  }

  // Strip optional ```json ... ``` wrapper
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to outermost brace extraction
  }

  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const sliced = candidate.slice(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(sliced);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }

  throw new Error('INVALID_JSON_OBJECT_RESPONSE');
}

function isStuckReply(text: string): boolean {
  const lower = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
  if (lower.length === 0) return false;
  const stuckPhrases = [
    'khong biet',
    'ko biet',
    'k biet',
    'em chiu',
    'minh chiu',
    'bo tay',
    'bi y tuong',
    'bi qua',
    'chua nghi ra',
    'khong nghi ra',
    'kho qua',
    'em khong ro',
    'minh khong ro',
  ];
  return stuckPhrases.some((phrase) => lower.includes(phrase)) && lower.length <= 90;
}

function isSummaryMapRequest(text: string): boolean {
  const lower = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
  return [
    'tong ket',
    'ban do tu duy',
    'ban do truy vet',
    'tom tat phien',
    'ket thuc phien',
    'tong hop lai',
    'tien bo lap luan',
  ].some((k) => lower.includes(k));
}

function buildConversationContextPrompt(payload: LabApiRequestPayload): string {
  const parts: string[] = [];
  const userTurnCount =
    (payload.history?.filter((m) => m.role === 'user').length ?? 0) + 1;

  const prevUserMessages = (payload.history ?? []).filter((m) => m.role === 'user');
  const lastPrevUser = prevUserMessages[prevUserMessages.length - 1]?.content ?? '';
  const stuckTwiceInARow = isStuckReply(payload.message) && isStuckReply(lastPrevUser);
  const summaryRequested = isSummaryMapRequest(payload.message);
  const currentStage = computeDebateStage(userTurnCount, summaryRequested);
  const stageMeta = DEBATE_STAGE_GUIDANCE[currentStage];
  const cleanedMessage = cleanSpokenVietnameseFillers(payload.message);

  parts.push(
    `TRẠNG THÁI PHIÊN: Chế độ ${payload.lab_type === 'concept' ? 'Concept Lab (Khám phá khái niệm)' : 'Debate Lab (Tranh biện Socrates)'} · Lượt học sinh thứ ${userTurnCount} · ${stageMeta.label}.`
  );
  parts.push(`NHỊP DẪN DẮT HIỆN TẠI: ${stageMeta.directive}`);

  if (stuckTwiceInARow) {
    parts.push(
      `TÍN HIỆU GỠ BÍ (BẮT BUỘC): Học sinh đang bí ý tưởng hoặc nói "không biết" liên tiếp 2 lần. Hãy kích hoạt **Cơ chế gỡ bí**: đưa đúng **2 phương án/góc nhìn gợi ý (Phương án A hoặc Phương án B)** thật ngắn gọn để học sinh chọn và giải thích lý do.`
    );
  } else if (isStuckReply(payload.message)) {
    parts.push(
      `LƯU Ý ĐỒNG HÀNH: Học sinh vừa bày tỏ chưa nghĩ ra ở lần đầu. Hãy gợi 1 mảnh kiến thức nền ngắn gọn (1–2 câu) kèm 1 ví dụ đời thường rồi hỏi 1 câu thật dễ tiếp cận.`
    );
  }

  if (summaryRequested) {
    parts.push(
      `YÊU CẦU TỔNG KẾT PHIÊN HỌC (BẮT BUỘC): Tổng hợp thành **Bản đồ truy vết tư duy** so sánh lập trường/khái niệm ban đầu với bước tiến hiện tại dựa trên Sổ tay lập luận trong trường \`interpretation\`, kết bằng đúng 1 câu hỏi mở nhẹ.`
    );
  }

  if (payload.core_assumptions && payload.core_assumptions.length > 0) {
    parts.push(
      `GIẢ ĐỊNH BAN ĐẦU CỦA PHIÊN:\n${payload.core_assumptions.map((a, i) => `- GĐ${i + 1}: ${a}`).join('\n')}`
    );
  }

  if (payload.ledger_snapshot && payload.ledger_snapshot.length > 0) {
    const recentLedger = payload.ledger_snapshot.slice(-16);
    parts.push(
      `SỔ TAY MẠCH LẬP LUẬN:\n${recentLedger
        .map((item) => `- ${item.id}: ${item.claim}`)
        .join('\n')}`
    );
  }

  if (payload.history && payload.history.length > 0) {
    const recentTurns = payload.history.slice(-12);
    parts.push(
      `LỊCH SỬ TRAO ĐỔI GẦN ĐÂY:\n${recentTurns
        .map((m) => `${m.turnRef ?? m.role}: ${m.content.slice(0, 320)}`)
        .join('\n')}`
    );
  }

  if (cleanedMessage !== payload.message.trim()) {
    parts.push(
      `PHÁT BIỂU MỚI NHẤT CỦA HỌC SINH (đã lọc từ đệm khẩu ngữ để dễ nắm ý lõi):\n- Nguyên văn: ${payload.message}\n- Ý lõi: ${cleanedMessage}`
    );
  } else {
    parts.push(`PHÁT BIỂU MỚI NHẤT CỦA HỌC SINH:\n${payload.message}`);
  }

  parts.push(
    `BẮT BUỘC: Tuân thủ công thức "1 Công nhận (tldr) + 1 Lỗ hổng/Phản ví dụ (interpretation) + 1 Câu hỏi Socrates duy nhất (guidingQuestion)", tổng độ dài phần hiển thị (tldr + interpretation + guidingQuestion) gọn trong 80–130 từ, không hỏi dồn nhiều câu, không chào hỏi sáo rỗng.`
  );

  return parts.join('\n\n');
}

function buildRagQuery(payload: LabApiRequestPayload): string {
  const pieces: string[] = [cleanSpokenVietnameseFillers(payload.message)];
  if (payload.message.trim().length < 60 && payload.history && payload.history.length > 0) {
    const recentUserTexts = payload.history
      .filter((m) => m.role === 'user')
      .slice(-2)
      .map((m) => m.content);
    pieces.push(...recentUserTexts);
  }
  return pieces.join(' ').trim();
}

function normalizeDebateSteps(steps: DebateStepItem[] | undefined): DebateStepItem[] {
  const requiredOrder: Array<{ key: DebateStepItem['key']; title: string; vietnameseTitle: string }> = [
    { key: 'identify', title: 'Identify', vietnameseTitle: 'Lập trường & khái niệm' },
    { key: 'analyze', title: 'Analyze', vietnameseTitle: 'Giả định & bằng chứng' },
    { key: 'challenge', title: 'Challenge', vietnameseTitle: 'Phản ví dụ thử thách' },
    { key: 'synthesize', title: 'Synthesize', vietnameseTitle: 'Điều chỉnh quan điểm' },
    { key: 'respond', title: 'Respond', vietnameseTitle: 'Tổng kết & gợi mở' },
  ];

  return requiredOrder.map((meta) => {
    const found = Array.isArray(steps) ? steps.find((s) => s?.key === meta.key) : undefined;
    return {
      key: meta.key,
      title: meta.title,
      vietnameseTitle: meta.vietnameseTitle,
      summary:
        typeof found?.summary === 'string' && found.summary.trim()
          ? found.summary.trim()
          : `Hoàn tất bước ${meta.vietnameseTitle} cho lập luận hiện tại.`,
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
  return firstLine
    ? firstLine.slice(0, 220)
    : 'Bạn đã nêu được một ý chính rõ ràng để chúng ta cùng kiểm chứng phạm vi áp dụng.';
}

function normalizeThreeLayer(
  raw: Partial<ThreeLayerResponse> | undefined,
  aiClaimSummary: string
): ThreeLayerResponse {
  const facts = typeof raw?.facts === 'string' ? raw.facts.trim() : '';
  const assumptions = typeof raw?.assumptions === 'string' ? raw.assumptions.trim() : '';
  const interpretation = typeof raw?.interpretation === 'string' ? raw.interpretation.trim() : '';
  const guidingQuestion =
    typeof raw?.guidingQuestion === 'string' && raw.guidingQuestion.trim().length > 0
      ? raw.guidingQuestion.trim()
      : 'Theo bạn, nếu đặt lập luận này vào một tình huống thực tế trái chiều thì điểm nào cần điều chỉnh trước tiên?';
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

function normalizeModelPayload(
  parsed: Record<string, unknown>,
  payload: LabApiRequestPayload,
  responseId: string,
  sourceEngine: LabApiResponsePayload['source_engine']
): LabApiResponsePayload {
  const aiClaimSummary =
    typeof parsed.ai_claim_summary === 'string' && parsed.ai_claim_summary.trim()
      ? parsed.ai_claim_summary.trim()
      : 'Phản hồi đối thoại Socrates.';

  const userClaimSummary =
    typeof parsed.user_claim_summary === 'string' && parsed.user_claim_summary.trim()
      ? parsed.user_claim_summary.trim()
      : payload.message.slice(0, 120);

  const newAssumptions = Array.isArray(parsed.new_assumptions)
    ? parsed.new_assumptions.filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
    : [];

  const contradictionNote =
    typeof parsed.contradiction_note === 'string' && parsed.contradiction_note.trim()
      ? parsed.contradiction_note.trim()
      : null;

  const contradictionRef =
    typeof parsed.contradiction_ref === 'string' && parsed.contradiction_ref.trim()
      ? parsed.contradiction_ref.trim()
      : null;

  const rawThreeLayer =
    parsed.three_layer && typeof parsed.three_layer === 'object'
      ? (parsed.three_layer as Partial<ThreeLayerResponse>)
      : undefined;

  return {
    session_id: payload.session_id,
    lab_type: payload.lab_type,
    response_id: responseId,
    source_engine: sourceEngine,
    user_claim_summary: userClaimSummary,
    ai_claim_summary: aiClaimSummary,
    new_assumptions: newAssumptions,
    contradiction_note: contradictionNote,
    contradiction_ref: contradictionRef,
    debate_steps: normalizeDebateSteps(parsed.debate_steps as DebateStepItem[] | undefined),
    three_layer: normalizeThreeLayer(rawThreeLayer, aiClaimSummary),
  };
}

function hasValidGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(
    key && key.length > 0 && key !== 'MY_GEMINI_API_KEY' && key !== 'your_api_key_here'
  );
}

function hasValidOpenRouterKey(): boolean {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  return Boolean(key && key.length > 0);
}

function hasValidOpenAIKey(): boolean {
  const key = process.env.OPENAI_API_KEY?.trim();
  return Boolean(key && key.length > 0);
}

async function callGeminiStructuredAPI(
  payload: LabApiRequestPayload,
  systemPrompt: string,
  userPrompt: string
): Promise<LabApiResponsePayload> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'your_api_key_here') {
    throw new Error('GEMINI_API_KEY_MISSING');
  }

  const modelName = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const response = await ai.models.generateContent({
    model: modelName,
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

  const parsed = extractJsonObject(response.text ?? '');
  const responseId = `resp_gem_${payload.session_id.slice(0, 8)}_${Date.now().toString(36)}`;
  sessionPreviousResponseMap.set(payload.session_id, responseId);

  return normalizeModelPayload(parsed, payload, responseId, 'gemini');
}

async function callOpenRouterAPI(
  payload: LabApiRequestPayload,
  systemPrompt: string,
  userPrompt: string
): Promise<LabApiResponsePayload> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY_MISSING');
  }

  const baseUrl = (process.env.OPENROUTER_BASE_URL?.trim() || 'https://openrouter.ai/api/v1').replace(
    /\/+$/,
    ''
  );
  const modelName = process.env.OPENROUTER_MODEL?.trim() || 'openrouter/free';
  const appUrl =
    process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
      ? process.env.APP_URL
      : 'http://localhost:3000';

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': appUrl,
      'X-Title': 'Mach Ngon Thinking Lab',
    },
    body: JSON.stringify({
      model: modelName,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `${systemPrompt}\n\n${OPENROUTER_JSON_CONTRACT_INSTRUCTION}`,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    }),
  });

  if (res.status === 429) {
    const err = new Error('OPENROUTER_RATE_LIMIT_429') as Error & { status?: number };
    err.status = 429;
    throw err;
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`OpenRouter API error (${res.status}): ${errorText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    id?: string;
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };

  const rawContent = data.choices?.[0]?.message?.content;
  const contentText =
    typeof rawContent === 'string'
      ? rawContent
      : Array.isArray(rawContent)
        ? rawContent.map((part) => part.text ?? '').join('')
        : '';

  const parsed = extractJsonObject(contentText);
  const responseId = `resp_openrouter_${payload.session_id.slice(0, 8)}_${Date.now().toString(36)}`;
  sessionPreviousResponseMap.set(payload.session_id, responseId);

  // Uses 'openai-responses' to match LabApiResponsePayload['source_engine'] contract in src/lib/types.ts
  return normalizeModelPayload(parsed, payload, responseId, 'openai-responses');
}

async function callOpenAIResponsesAPI(
  payload: LabApiRequestPayload,
  systemPrompt: string,
  userPrompt: string
): Promise<LabApiResponsePayload> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY_MISSING');
  }

  const prevResponseId =
    payload.previous_response_id ?? sessionPreviousResponseMap.get(payload.session_id) ?? undefined;

  const requestBody: Record<string, unknown> = {
    model: process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini',
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
    !prevResponseId.startsWith('resp_gem_') &&
    !prevResponseId.startsWith('resp_openrouter_')
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
    const err = new Error('OPENAI_RATE_LIMIT_429') as Error & { status?: number };
    err.status = 429;
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

  const parsed = extractJsonObject(rawJson);
  const responseId = data.id || `resp_openai_${Date.now().toString(36)}`;
  sessionPreviousResponseMap.set(payload.session_id, responseId);

  return normalizeModelPayload(parsed, payload, responseId, 'openai-responses');
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

function isQuotaOrRateLimitError(err: unknown): boolean {
  const e = err as Error & { status?: number; code?: number };
  const msg = String(e?.message ?? '');
  return (
    e?.status === 429 ||
    e?.code === 429 ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('RATE_LIMIT')
  );
}

export interface DebateEngineProviderOverrides {
  callGemini?: typeof callGeminiStructuredAPI;
  callOpenRouter?: typeof callOpenRouterAPI;
  callOpenAI?: typeof callOpenAIResponsesAPI;
}

/**
 * Unified 4-tier Multi-API Failover + Private RAG Debate Engine:
 * 1. Priority 1: Gemini API (GEMINI_API_KEY, GEMINI_MODEL || 'gemini-2.5-flash')
 * 2. Priority 2: OpenRouter API (OPENROUTER_API_KEY, OPENROUTER_MODEL || 'openrouter/free')
 * 3. Priority 3: OpenAI Responses API (OPENAI_API_KEY, OPENAI_MODEL || 'gpt-4.1-mini')
 * 4. Priority 4: Local Fallback Engine (only when all cloud APIs are unconfigured or fail)
 */
export async function executeDebateEngine(
  payload: LabApiRequestPayload,
  overrides?: DebateEngineProviderOverrides
): Promise<LabApiResponsePayload> {
  const rawDoc = await knowledgeBaseService.getDocumentById(payload.resource_context_id);
  const resourceDoc = rawDoc && rawDoc.status === 'published' ? rawDoc : null;

  const ragQuery = buildRagQuery(payload);
  const ragContext = await knowledgeBaseService.retrieveRelevantContext(ragQuery, {
    excludeDocumentId: resourceDoc?.id ?? null,
    maxExcerpts: 4,
    maxConcepts: 3,
  });

  const systemPrompt = getSystemPrompt(
    payload.lab_type,
    resourceDoc
      ? {
          title: resourceDoc.title,
          author: resourceDoc.author,
          excerpt: resourceDoc.excerpt,
          source: resourceDoc.source,
          fullText: knowledgeBaseService.formatFullDocumentForPrompt(resourceDoc),
        }
      : null,
    ragContext
  );
  const userPrompt = buildConversationContextPrompt(payload);

  const geminiCaller = overrides?.callGemini ?? callGeminiStructuredAPI;
  const openRouterCaller = overrides?.callOpenRouter ?? callOpenRouterAPI;
  const openAICaller = overrides?.callOpenAI ?? callOpenAIResponsesAPI;

  // Priority 1: Gemini API
  if (hasValidGeminiKey() || overrides?.callGemini) {
    try {
      return await withTimeout(geminiCaller(payload, systemPrompt, userPrompt), 15_000, 'GEMINI');
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const tag = isQuotaOrRateLimitError(err) ? 'HTTP 429 / RESOURCE_EXHAUSTED' : 'error/timeout';
      console.warn(
        `[DebateEngine] Priority 1 (Gemini) failed (${tag}: ${reason}). Automatically failing over to Priority 2 (OpenRouter)...`
      );
    }
  }

  // Priority 2: OpenRouter API
  if (hasValidOpenRouterKey() || overrides?.callOpenRouter) {
    try {
      return await withTimeout(
        openRouterCaller(payload, systemPrompt, userPrompt),
        18_000,
        'OPENROUTER'
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const tag = isQuotaOrRateLimitError(err) ? 'HTTP 429 / Rate Limit' : 'error/timeout';
      console.warn(
        `[DebateEngine] Priority 2 (OpenRouter) failed (${tag}: ${reason}). Automatically failing over to Priority 3 (OpenAI Responses)...`
      );
    }
  }

  // Priority 3: OpenAI Responses API
  if (hasValidOpenAIKey() || overrides?.callOpenAI) {
    try {
      return await withTimeout(openAICaller(payload, systemPrompt, userPrompt), 15_000, 'OPENAI');
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const tag = isQuotaOrRateLimitError(err) ? 'HTTP 429 / Rate Limit' : 'error/timeout';
      console.warn(
        `[DebateEngine] Priority 3 (OpenAI Responses) failed (${tag}: ${reason}). Falling back to Priority 4 (Local Fallback Engine)...`
      );
    }
  }

  // Priority 4: Local Fallback Engine (only when all cloud APIs are unconfigured or failed)
  return runLocalFallbackEngine(payload, resourceDoc);
}
