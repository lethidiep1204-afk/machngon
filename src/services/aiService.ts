import { runLocalFallbackEngine } from '../lib/ai/localFallbackEngine';
import {
  buildConversationContextPrompt,
  GEMINI_LAB_RESPONSE_SCHEMA,
  normalizeDebateSteps,
  normalizeThreeLayer,
} from '../lib/ai/promptBuilder';
import { getSystemPrompt } from '../lib/ai/systemPrompts';
import type {
  LabApiRequestPayload,
  LabApiResponsePayload,
  LibraryDocument,
} from '../lib/types';

export interface GenerateHistoryTurn {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

export interface GenerateAIRequest {
  prompt?: string;
  systemInstruction?: string;
  history?: GenerateHistoryTurn[];
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    responseMimeType?: 'application/json' | 'text/plain';
    responseSchema?: Record<string, unknown>;
  };
}

export interface GenerateAIResponse {
  text: string;
  model: string;
  finishReason: string | null;
}

export class AIRateLimitError extends Error {
  readonly status = 429;
  readonly retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'AIRateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class AIServiceError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'AIServiceError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Sends an AI generation request securely to our Vercel Serverless Function (/api/generate).
 * No API key or third-party AI SDK is ever loaded or exposed in the browser.
 */
export async function generateWithAI(request: GenerateAIRequest): Promise<GenerateAIResponse> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (res.status === 429) {
    const retryHeader = Number(res.headers.get('Retry-After') || '10');
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      retry_after?: number;
    };
    const seconds = Number.isFinite(body.retry_after)
      ? Number(body.retry_after)
      : Number.isFinite(retryHeader) && retryHeader > 0
        ? retryHeader
        : 10;

    throw new AIRateLimitError(
      body.error ||
        'Hệ thống đang tạm nghỉ nhịp phân tích. Toàn bộ văn bản bạn đang gõ vẫn được bảo toàn nguyên vẹn.',
      seconds
    );
  }

  const data = (await res.json().catch(() => ({}))) as {
    text?: string;
    model?: string;
    finishReason?: string | null;
    error?: string;
    code?: string;
  };

  if (!res.ok) {
    throw new AIServiceError(
      data.error || 'Kết nối tới máy chủ phân tích bị gián đoạn.',
      res.status,
      data.code
    );
  }

  if (typeof data.text !== 'string' || !data.text.trim()) {
    throw new AIServiceError(
      'Máy chủ AI không trả về nội dung hợp lệ. Vui lòng thử lại.',
      502,
      'EMPTY_AI_RESPONSE'
    );
  }

  return {
    text: data.text,
    model: data.model || 'gemini-2.5-flash',
    finishReason: data.finishReason ?? null,
  };
}

function extractJsonObject(rawText: string): Record<string, unknown> {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Phản hồi JSON từ AI không đúng cấu trúc.');
  }
  return parsed as Record<string, unknown>;
}

/**
 * Executes a Thinking Lab (Concept Lab / Debate Lab) turn via the secure /api/generate proxy.
 * Preserves local fallback when GEMINI_API_KEY is not yet configured in local/preview environments.
 */
export async function requestLabAnalysis(
  payload: LabApiRequestPayload,
  attachedResource: LibraryDocument | null = null
): Promise<LabApiResponsePayload> {
  if (payload.simulate_429) {
    throw new AIRateLimitError(
      'Phòng thí nghiệm tư duy đang tạm nghỉ nhịp để giữ chất lượng phân tích. Nội dung bạn đang viết vẫn được bảo toàn nguyên vẹn.',
      10
    );
  }

  const systemInstruction = getSystemPrompt(
    payload.lab_type,
    attachedResource
      ? {
          title: attachedResource.title,
          author: attachedResource.author,
          excerpt: attachedResource.excerpt,
        }
      : null
  );

  const prompt = buildConversationContextPrompt(payload);

  try {
    const aiResponse = await generateWithAI({
      prompt,
      systemInstruction,
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: GEMINI_LAB_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
      },
    });

    const parsed = extractJsonObject(aiResponse.text);
    const aiClaimSummary =
      typeof parsed.ai_claim_summary === 'string' && parsed.ai_claim_summary.trim()
        ? parsed.ai_claim_summary.trim()
        : 'Phản hồi đối thoại Socrates.';

    const responseId = `resp_gem_${payload.session_id.slice(0, 8)}_${Date.now().toString(36)}`;

    return {
      session_id: payload.session_id,
      lab_type: payload.lab_type,
      response_id: responseId,
      source_engine: 'gemini',
      user_claim_summary:
        typeof parsed.user_claim_summary === 'string' && parsed.user_claim_summary.trim()
          ? parsed.user_claim_summary.trim()
          : payload.message.slice(0, 120),
      ai_claim_summary: aiClaimSummary,
      new_assumptions: Array.isArray(parsed.new_assumptions)
        ? parsed.new_assumptions.filter((item): item is string => typeof item === 'string')
        : [],
      contradiction_note:
        typeof parsed.contradiction_note === 'string' ? parsed.contradiction_note : null,
      contradiction_ref:
        typeof parsed.contradiction_ref === 'string' ? parsed.contradiction_ref : null,
      debate_steps: normalizeDebateSteps(
        Array.isArray(parsed.debate_steps) ? (parsed.debate_steps as LabApiResponsePayload['debate_steps']) : undefined
      ),
      three_layer: normalizeThreeLayer(
        parsed.three_layer && typeof parsed.three_layer === 'object'
          ? (parsed.three_layer as Partial<LabApiResponsePayload['three_layer']>)
          : undefined,
        aiClaimSummary
      ),
    };
  } catch (err) {
    if (err instanceof AIRateLimitError) {
      throw err;
    }

    // If the environment hasn't configured GEMINI_API_KEY yet (e.g., local preview),
    // keep Thinking Lab usable via the deterministic local fallback engine.
    if (err instanceof AIServiceError && err.code === 'MISSING_API_KEY') {
      return runLocalFallbackEngine(payload, attachedResource);
    }

    throw err;
  }
}
