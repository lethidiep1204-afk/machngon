import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import handler from '../../api/generate.js';

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  setHeader: (name: string, value: string) => void;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
}

function createMockRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = String(value);
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

const originalApiKey = process.env.GEMINI_API_KEY;
const originalFetch = globalThis.fetch;

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalApiKey;
  }
  globalThis.fetch = originalFetch;
});

describe('Vercel Serverless Proxy api/generate.js', () => {
  it('rejects non-POST methods with HTTP 405 and Allow: POST header', async () => {
    const res = createMockRes();
    await handler({ method: 'GET', body: {} }, res);

    assert.equal(res.statusCode, 405);
    assert.equal(res.headers['allow'], 'POST');
    assert.equal((res.body as { code?: string }).code, 'METHOD_NOT_ALLOWED');
  });

  it('returns HTTP 500 with clear Vietnamese error when GEMINI_API_KEY is missing or placeholder', async () => {
    delete process.env.GEMINI_API_KEY;
    const resMissing = createMockRes();
    await handler({ method: 'POST', body: { prompt: 'Xin chào' } }, resMissing);

    assert.equal(resMissing.statusCode, 500);
    assert.equal((resMissing.body as { code?: string }).code, 'MISSING_API_KEY');
    assert.match((resMissing.body as { error: string }).error, /GEMINI_API_KEY/);

    process.env.GEMINI_API_KEY = 'your_api_key_here';
    const resPlaceholder = createMockRes();
    await handler({ method: 'POST', body: { prompt: 'Xin chào' } }, resPlaceholder);
    assert.equal(resPlaceholder.statusCode, 500);
    assert.equal((resPlaceholder.body as { code?: string }).code, 'MISSING_API_KEY');
  });

  it('returns HTTP 400 when request body is empty or missing prompt/contents', async () => {
    process.env.GEMINI_API_KEY = 'test-secret-key-12345';
    const res = createMockRes();
    await handler({ method: 'POST', body: { prompt: '   ' } }, res);

    assert.equal(res.statusCode, 400);
    assert.equal((res.body as { code?: string }).code, 'INVALID_PROMPT_PAYLOAD');
  });

  it('forwards prompt, systemInstruction, history, and generationConfig to Gemini 2.5 Flash and returns clean JSON', async () => {
    const fakeSecret = 'AIzaTestSecretKeyShouldNeverLeak999';
    process.env.GEMINI_API_KEY = fakeSecret;

    let capturedUrl = '';
    let capturedBody: Record<string, unknown> = {};

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(String(init?.body || '{}'));
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [{ text: 'Phản hồi Socratic thử nghiệm.' }],
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: { totalTokenCount: 42 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const res = createMockRes();
    await handler(
      {
        method: 'POST',
        body: {
          systemInstruction: 'Bạn là trợ lý Mạch Ngôn.',
          history: [
            { role: 'user', content: 'Tự do là gì?' },
            { role: 'assistant', content: 'Bạn hiểu tự do theo nghĩa nào?' },
          ],
          prompt: 'Tự do là làm điều mình muốn.',
          generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
        },
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.ok(
      capturedUrl.startsWith(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='
      )
    );
    assert.equal((capturedBody.contents as unknown[]).length, 3);
    assert.deepEqual(capturedBody.systemInstruction, {
      parts: [{ text: 'Bạn là trợ lý Mạch Ngôn.' }],
    });
    assert.equal((res.body as { text: string }).text, 'Phản hồi Socratic thử nghiệm.');
    assert.equal((res.body as { model: string }).model, 'gemini-2.5-flash');
    assert.equal(JSON.stringify(res.body).includes(fakeSecret), false);
  });

  it('sanitizes upstream 403/429 errors and never leaks GEMINI_API_KEY in responses', async () => {
    const fakeSecret = 'AIzaNeverExposeMe777';
    process.env.GEMINI_API_KEY = fakeSecret;

    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({ error: { message: `Invalid key ${fakeSecret}` } }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const res403 = createMockRes();
    await handler({ method: 'POST', body: { prompt: 'Kiểm tra bảo mật' } }, res403);
    assert.equal(res403.statusCode, 500);
    assert.equal((res403.body as { code?: string }).code, 'INVALID_API_KEY');
    assert.equal(JSON.stringify(res403.body).includes(fakeSecret), false);

    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ error: { message: 'Quota exceeded' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '12' },
      });
    }) as typeof fetch;

    const res429 = createMockRes();
    await handler({ method: 'POST', body: { prompt: 'Kiểm tra 429' } }, res429);
    assert.equal(res429.statusCode, 429);
    assert.equal((res429.body as { retry_after?: number }).retry_after, 12);
    assert.equal(res429.headers['retry-after'], '12');
  });
});
