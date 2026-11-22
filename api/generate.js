const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_TOTAL_CHARS = 60_000;
const MAX_TURNS = 50;

const PLACEHOLDER_KEYS = new Set([
  'MY_GEMINI_API_KEY',
  'your_api_key_here',
  'YOUR_GEMINI_API_KEY',
  'CHANGE_ME',
]);

function isConfiguredApiKey(rawKey) {
  if (typeof rawKey !== 'string') return false;
  const trimmed = rawKey.trim();
  return trimmed.length > 0 && !PLACEHOLDER_KEYS.has(trimmed);
}

function parseRequestBody(rawBody) {
  if (rawBody === undefined || rawBody === null) {
    return { ok: false, error: 'Thiếu dữ liệu yêu cầu (request body).' };
  }
  if (typeof rawBody === 'string') {
    const trimmed = rawBody.trim();
    if (!trimmed) {
      return { ok: false, error: 'Nội dung yêu cầu không được để trống.' };
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, error: 'Định dạng JSON không hợp lệ: cần một đối tượng JSON.' };
      }
      return { ok: true, data: parsed };
    } catch {
      return { ok: false, error: 'Dữ liệu gửi lên không phải JSON hợp lệ.' };
    }
  }
  if (typeof rawBody === 'object' && !Array.isArray(rawBody)) {
    return { ok: true, data: rawBody };
  }
  return { ok: false, error: 'Định dạng dữ liệu yêu cầu không hợp lệ.' };
}

function normalizeRole(role) {
  if (role === 'model' || role === 'assistant') return 'model';
  return 'user';
}

function normalizeParts(rawParts) {
  if (!Array.isArray(rawParts)) return [];
  const parts = [];
  for (const part of rawParts) {
    if (part && typeof part === 'object' && typeof part.text === 'string') {
      const text = part.text.trim();
      if (text) {
        parts.push({ text });
      }
    }
  }
  return parts;
}

function buildGeminiPayload(body) {
  const contents = [];

  if (Array.isArray(body.contents)) {
    for (const item of body.contents.slice(-MAX_TURNS)) {
      if (!item || typeof item !== 'object') continue;
      const parts = normalizeParts(item.parts);
      if (parts.length > 0) {
        contents.push({
          role: normalizeRole(item.role),
          parts,
        });
      }
    }
  } else {
    if (Array.isArray(body.history)) {
      for (const turn of body.history.slice(-MAX_TURNS)) {
        if (!turn || typeof turn !== 'object') continue;
        const turnParts = Array.isArray(turn.parts)
          ? normalizeParts(turn.parts)
          : typeof turn.content === 'string' && turn.content.trim()
            ? [{ text: turn.content.trim() }]
            : typeof turn.text === 'string' && turn.text.trim()
              ? [{ text: turn.text.trim() }]
              : [];

        if (turnParts.length > 0) {
          contents.push({
            role: normalizeRole(turn.role),
            parts: turnParts,
          });
        }
      }
    }

    if (typeof body.prompt === 'string' && body.prompt.trim().length > 0) {
      contents.push({
        role: 'user',
        parts: [{ text: body.prompt.trim() }],
      });
    }
  }

  if (contents.length === 0) {
    return {
      ok: false,
      error: 'Vui lòng cung cấp nội dung câu hỏi (prompt, history hoặc contents).',
    };
  }

  if (contents.length > MAX_TURNS) {
    return {
      ok: false,
      error: `Số lượt hội thoại vượt quá giới hạn cho phép (${MAX_TURNS} lượt).`,
    };
  }

  const payload = { contents };
  let totalChars = 0;

  for (const turn of contents) {
    for (const part of turn.parts) {
      totalChars += part.text.length;
    }
  }

  if (typeof body.systemInstruction === 'string' && body.systemInstruction.trim().length > 0) {
    const sysText = body.systemInstruction.trim();
    totalChars += sysText.length;
    payload.systemInstruction = {
      parts: [{ text: sysText }],
    };
  } else if (
    body.systemInstruction &&
    typeof body.systemInstruction === 'object' &&
    Array.isArray(body.systemInstruction.parts)
  ) {
    const sysParts = normalizeParts(body.systemInstruction.parts);
    if (sysParts.length > 0) {
      for (const part of sysParts) {
        totalChars += part.text.length;
      }
      payload.systemInstruction = { parts: sysParts };
    }
  }

  if (totalChars > MAX_TOTAL_CHARS) {
    return {
      ok: false,
      error: 'Tổng dung lượng nội dung gửi lên vượt quá giới hạn cho phép. Hãy rút gọn văn bản và thử lại.',
    };
  }

  if (body.generationConfig && typeof body.generationConfig === 'object' && !Array.isArray(body.generationConfig)) {
    const cfg = body.generationConfig;
    const safeConfig = {};

    if (typeof cfg.temperature === 'number' && Number.isFinite(cfg.temperature)) {
      safeConfig.temperature = Math.min(2, Math.max(0, cfg.temperature));
    }
    if (typeof cfg.topP === 'number' && Number.isFinite(cfg.topP)) {
      safeConfig.topP = Math.min(1, Math.max(0, cfg.topP));
    }
    if (typeof cfg.topK === 'number' && Number.isFinite(cfg.topK)) {
      safeConfig.topK = Math.min(100, Math.max(1, Math.round(cfg.topK)));
    }
    if (typeof cfg.maxOutputTokens === 'number' && Number.isFinite(cfg.maxOutputTokens)) {
      safeConfig.maxOutputTokens = Math.min(8192, Math.max(64, Math.round(cfg.maxOutputTokens)));
    }
    if (cfg.responseMimeType === 'application/json' || cfg.responseMimeType === 'text/plain') {
      safeConfig.responseMimeType = cfg.responseMimeType;
    }
    if (cfg.responseSchema && typeof cfg.responseSchema === 'object' && !Array.isArray(cfg.responseSchema)) {
      safeConfig.responseSchema = cfg.responseSchema;
    }

    if (Object.keys(safeConfig).length > 0) {
      payload.generationConfig = safeConfig;
    }
  }

  return { ok: true, payload };
}

function extractTextFromGeminiData(data) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  const firstCandidate = candidates[0];
  const parts = Array.isArray(firstCandidate?.content?.parts) ? firstCandidate.content.parts : [];
  const text = parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();

  return {
    text,
    finishReason: typeof firstCandidate?.finishReason === 'string' ? firstCandidate.finishReason : null,
    candidates,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'Phương thức không được hỗ trợ. Vui lòng gửi yêu cầu bằng phương thức POST.',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  const rawApiKey = process.env.GEMINI_API_KEY;
  if (!isConfiguredApiKey(rawApiKey)) {
    return res.status(500).json({
      error:
        'Máy chủ chưa được cấu hình khóa API (GEMINI_API_KEY). Vui lòng thêm biến môi trường GEMINI_API_KEY trên Vercel Dashboard rồi triển khai lại.',
      code: 'MISSING_API_KEY',
    });
  }

  const parsedBody = parseRequestBody(req.body);
  if (!parsedBody.ok) {
    return res.status(400).json({
      error: parsedBody.error,
      code: 'INVALID_REQUEST_BODY',
    });
  }

  const built = buildGeminiPayload(parsedBody.data);
  if (!built.ok) {
    return res.status(400).json({
      error: built.error,
      code: 'INVALID_PROMPT_PAYLOAD',
    });
  }

  const apiKey = rawApiKey.trim();
  const endpoint = `${GEMINI_BASE_URL}?key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstreamResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(built.payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const upstreamJson = await upstreamResponse.json().catch(() => null);

    if (!upstreamResponse.ok) {
      const upstreamStatus = upstreamResponse.status;

      if (upstreamStatus === 429) {
        const retryHeader = Number(upstreamResponse.headers.get('retry-after') || '15');
        const retryAfter = Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : 15;
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({
          error:
            'Hệ thống AI đang chạm giới hạn tần suất tạm thời. Nội dung bạn đang viết vẫn được giữ nguyên — hãy thử gửi lại sau vài giây.',
          code: 'RATE_LIMITED',
          retry_after: retryAfter,
        });
      }

      if (upstreamStatus === 401 || upstreamStatus === 403) {
        console.error(`[POST /api/generate] Gemini auth error (status ${upstreamStatus})`);
        return res.status(500).json({
          error:
            'Khóa GEMINI_API_KEY trên máy chủ không hợp lệ hoặc không có quyền truy cập Gemini API. Vui lòng kiểm tra lại cấu hình trong Vercel Dashboard.',
          code: 'INVALID_API_KEY',
        });
      }

      if (upstreamStatus === 400) {
        console.error('[POST /api/generate] Gemini rejected request (status 400)');
        return res.status(400).json({
          error: 'Yêu cầu gửi tới Google Gemini API chưa hợp lệ. Vui lòng kiểm tra lại nội dung đầu vào.',
          code: 'UPSTREAM_BAD_REQUEST',
        });
      }

      console.error(`[POST /api/generate] Gemini upstream failure (status ${upstreamStatus})`);
      return res.status(502).json({
        error: 'Dịch vụ Google Gemini API đang tạm gián đoạn. Vui lòng thử lại sau ít phút.',
        code: 'UPSTREAM_ERROR',
      });
    }

    const { text, finishReason, candidates } = extractTextFromGeminiData(upstreamJson);
    if (!text) {
      return res.status(502).json({
        error: 'Google Gemini API không trả về nội dung phản hồi phù hợp. Vui lòng thử diễn đạt lại câu hỏi.',
        code: 'EMPTY_AI_RESPONSE',
      });
    }

    return res.status(200).json({
      text,
      model: GEMINI_MODEL,
      finishReason,
      candidates,
      usageMetadata: upstreamJson?.usageMetadata ?? null,
    });
  } catch (err) {
    clearTimeout(timeoutId);

    if (err && typeof err === 'object' && err.name === 'AbortError') {
      return res.status(504).json({
        error: 'Kết nối tới Google Gemini API quá thời gian chờ. Vui lòng thử lại.',
        code: 'UPSTREAM_TIMEOUT',
      });
    }

    console.error('[POST /api/generate] Unexpected server error:', err instanceof Error ? err.message : 'Unknown error');
    return res.status(500).json({
      error: 'Không thể kết nối tới máy chủ AI vào lúc này. Vui lòng thử lại sau.',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}
