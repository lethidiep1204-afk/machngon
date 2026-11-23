// Mạch Ngôn V2 – hỏi đáp AI dùng Gemini (Google) có tra cứu Google Search và trả về nguồn.
// Biến môi trường: GEMINI_API_KEY (bắt buộc), GEMINI_MODEL (tùy chọn, mặc định gemini-2.5-flash).
const MODEL = (process.env.GEMINI_MODEL || '').trim() || 'gemini-2.5-flash';
const URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_CHARS = 60000;

const DEFAULT_SYSTEM = `Bạn là trợ lý học tập của Mạch Ngôn, nền tảng phát triển tư duy ngôn ngữ cho học sinh THPT Việt Nam, đặc biệt môn Ngữ văn.
Nguyên tắc chính xác:
- Ưu tiên tư liệu thư viện Mạch Ngôn được cung cấp trong câu hỏi (đã đối chiếu nguồn). Khi cần dữ kiện (năm sáng tác, tiểu sử, xuất xứ, giải thưởng…), hãy tra cứu Google Search và chỉ khẳng định điều có nguồn đáng tin (SGK, nhà xuất bản, viện nghiên cứu, báo chí chính thống, Wikipedia có dẫn nguồn).
- Nếu các nguồn mâu thuẫn hoặc không tìm thấy, nói rõ là chưa chắc chắn, không đoán.
- Tuyệt đối không bịa trích dẫn, câu thơ, số liệu. Không chép dài nguyên văn tác phẩm còn bản quyền; với câu chữ cụ thể, nhắc học sinh đối chiếu SGK.
- Trả lời bằng tiếng Việt chuẩn, phù hợp học sinh.`;

function isKey(k) {
  return typeof k === 'string' && k.trim().length > 20 && !/YOUR_|MY_GEMINI|PLACEHOLDER/i.test(k);
}

function toContents(body) {
  if (Array.isArray(body.messages) && body.messages.length) {
    return body.messages
      .filter((m) => m && typeof m.content === 'string' && m.content.trim())
      .slice(-16)
      .map((m) => ({ role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user', parts: [{ text: m.content.slice(0, 20000) }] }));
  }
  if (typeof body.prompt === 'string' && body.prompt.trim()) return [{ role: 'user', parts: [{ text: body.prompt.trim() }] }];
  return [];
}

function parseGemini(data) {
  const cand = (data && Array.isArray(data.candidates) && data.candidates[0]) || {};
  const parts = (cand.content && Array.isArray(cand.content.parts)) ? cand.content.parts : [];
  const text = parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('').trim();
  const gm = cand.groundingMetadata || {};
  const seen = new Set();
  const sources = (Array.isArray(gm.groundingChunks) ? gm.groundingChunks : [])
    .map((c) => c && c.web)
    .filter((w) => w && w.uri && !seen.has(w.uri) && seen.add(w.uri))
    .slice(0, 8)
    .map((w) => ({ title: String(w.title || w.uri).slice(0, 160), uri: w.uri }));
  return {
    text,
    finishReason: cand.finishReason || null,
    sources,
    queries: Array.isArray(gm.webSearchQueries) ? gm.webSearchQueries.slice(0, 6) : [],
    suggestionsHtml: gm.searchEntryPoint && typeof gm.searchEntryPoint.renderedContent === 'string' ? gm.searchEntryPoint.renderedContent : '',
  };
}

async function callGemini(key, payload) {
  const r = await fetch(URL_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(payload),
  });
  let data = null;
  try { data = await r.json(); } catch (e) { data = null; }
  return { r, data };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Chỉ hỗ trợ phương thức POST.', code: 'METHOD_NOT_ALLOWED' });
  }
  const key = process.env.GEMINI_API_KEY;
  if (!isKey(key)) {
    return res.status(500).json({ error: 'Máy chủ chưa được cấu hình khóa GEMINI_API_KEY.', code: 'MISSING_API_KEY' });
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body && typeof body === 'object' ? body : {};

  const contents = toContents(body);
  const total = contents.reduce((s, c) => s + c.parts[0].text.length, 0);
  if (!contents.length) return res.status(400).json({ error: 'Thiếu nội dung câu hỏi.', code: 'EMPTY' });
  if (total > MAX_CHARS) return res.status(413).json({ error: 'Nội dung quá dài.', code: 'TOO_LONG' });

  const system = (typeof body.system === 'string' && body.system.trim()) ? body.system.trim().slice(0, 8000) : DEFAULT_SYSTEM;
  const wantSearch = body.search !== false;
  const payload = {
    contents,
    systemInstruction: { parts: [{ text: system }] },
    generationConfig: { temperature: wantSearch ? 0.2 : 0.4, maxOutputTokens: 2048 },
  };
  if (wantSearch) payload.tools = [{ google_search: {} }];

  try {
    let { r, data } = await callGemini(key, payload);
    // Nếu mô hình/khóa không hỗ trợ công cụ tìm kiếm, thử lại không tìm kiếm thay vì báo lỗi.
    if (!r.ok && wantSearch && r.status === 400) {
      delete payload.tools;
      ({ r, data } = await callGemini(key, payload));
      if (r.ok) data = { ...data, _searchUnavailable: true };
    }
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || `Gemini trả lỗi ${r.status}`;
      const code = r.status === 429 ? 'RATE_LIMITED' : (r.status === 401 || r.status === 403) ? 'INVALID_API_KEY' : 'UPSTREAM_ERROR';
      return res.status(r.status === 429 ? 429 : 502).json({ error: msg, code });
    }
    const out = parseGemini(data);
    if (!out.text) return res.status(502).json({ error: 'Gemini không trả về nội dung.', code: 'EMPTY_RESPONSE', finishReason: out.finishReason });
    return res.status(200).json({
      text: out.text,
      model: MODEL,
      grounded: wantSearch && !(data && data._searchUnavailable),
      sources: out.sources,
      queries: out.queries,
      suggestionsHtml: out.suggestionsHtml,
    });
  } catch (e) {
    return res.status(502).json({ error: 'Không kết nối được Gemini.', code: 'NETWORK' });
  }
}
