import 'dotenv/config';
import express, { type Express } from 'express';
import { executeDebateEngine } from '../lib/ai/debateEngine.ts';
import type { LabApiRequestPayload } from '../lib/types.ts';
import { SEED_DOCUMENTS } from '../data/seedDocuments.ts';
import { QUOTE_CATEGORIES } from '../data/verifiedQuotes.ts';
import {
  dailyQuoteService,
  getVietnamDateKey,
  VIETNAM_TIMEZONE,
} from './dailyQuoteService.ts';
import {
  adminAuthService,
  extractBearerToken,
  requireAdmin,
} from './adminAuth.ts';

// Lightweight per-session sliding window rate limiter (protects /api/lab & /api/admin/auth)
const requestBuckets = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 25;

function checkRateLimit(
  sessionKey: string,
  maxRequests: number = MAX_REQUESTS_PER_WINDOW
): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const timestamps = (requestBuckets.get(sessionKey) ?? []).filter(
    (ts) => now - ts < RATE_WINDOW_MS
  );
  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0] ?? now;
    const retryAfterSeconds = Math.max(5, Math.ceil((RATE_WINDOW_MS - (now - oldest)) / 1000));
    requestBuckets.set(sessionKey, timestamps);
    return { limited: true, retryAfterSeconds };
  }
  timestamps.push(now);
  requestBuckets.set(sessionKey, timestamps);
  return { limited: false, retryAfterSeconds: 0 };
}

function getActiveAiEngine(): 'openai-responses' | 'gemini' | 'local-fallback' {
  if (process.env.OPENAI_API_KEY) return 'openai-responses';
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
    return 'gemini';
  }
  return 'local-fallback';
}

/**
 * Creates the Express app with all /api/* routes mounted.
 * Shared by local/Node server (`server.ts`) and Vercel Serverless entrypoint (`api/index.ts`).
 */
export function createApiApp(): Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      engine: getActiveAiEngine(),
      timezone: VIETNAM_TIMEZONE,
      vietnamDate: getVietnamDateKey(),
    });
  });

  // =========================================================================
  // DAILY QUOTE PUBLIC API (Single source of truth for HomePage & Dashboard)
  // =========================================================================
  app.get('/api/quotes/today', async (_req, res) => {
    try {
      const data = await dailyQuoteService.getQuoteForDate();
      res.setHeader('Cache-Control', 'no-store');
      res.json(data);
    } catch (err) {
      console.error('[GET /api/quotes/today] Error:', err);
      res.status(500).json({
        error: 'Không thể tải danh ngôn hôm nay. Vui lòng thử lại sau.',
      });
    }
  });

  // =========================================================================
  // ADMIN AUTHENTICATION (Real server-side RBAC — HMAC-SHA256 Bearer token)
  // =========================================================================
  app.get('/api/admin/auth/status', async (req, res) => {
    try {
      const status = await adminAuthService.getStatus();
      const token = extractBearerToken(req);
      const authenticated = Boolean(token && adminAuthService.verifyToken(token));
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ...status, authenticated });
    } catch (err) {
      console.error('[GET /api/admin/auth/status] Error:', err);
      res.status(500).json({ error: 'Không thể kiểm tra trạng thái xác thực quản trị.' });
    }
  });

  app.post('/api/admin/auth/bootstrap', async (req, res) => {
    const rate = checkRateLimit(`admin-auth:${req.ip || 'local'}`, 10);
    if (rate.limited) {
      res.status(429).json({
        error: `Quá nhiều yêu cầu xác thực. Vui lòng thử lại sau ${rate.retryAfterSeconds} giây.`,
      });
      return;
    }
    try {
      const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
      const session = await adminAuthService.bootstrapPasscode(passcode);
      res.status(201).json({
        ...session,
        message: 'Đã thiết lập mã quản trị thành công.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể thiết lập mã quản trị.';
      res.status(400).json({ error: msg });
    }
  });

  app.post('/api/admin/auth/login', async (req, res) => {
    const rate = checkRateLimit(`admin-auth:${req.ip || 'local'}`, 10);
    if (rate.limited) {
      res.status(429).json({
        error: `Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ ${rate.retryAfterSeconds} giây.`,
      });
      return;
    }
    try {
      const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
      const session = await adminAuthService.verifyAndLogin(passcode);
      if (!session) {
        res.status(401).json({ error: 'Mã quản trị không chính xác.' });
        return;
      }
      res.json(session);
    } catch (err) {
      console.error('[POST /api/admin/auth/login] Error:', err);
      res.status(500).json({ error: 'Lỗi xác thực máy chủ.' });
    }
  });

  app.post('/api/admin/auth/logout', (req, res) => {
    const token = extractBearerToken(req);
    if (token) {
      adminAuthService.revokeToken(token);
    }
    res.json({ ok: true });
  });

  // =========================================================================
  // ADMIN PROTECTED ROUTES (requireAdmin middleware enforces Bearer token)
  // =========================================================================
  app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
    try {
      const [todayData, listData, nextPreview, authStatus] = await Promise.all([
        dailyQuoteService.getQuoteForDate(),
        dailyQuoteService.listQuotes(),
        dailyQuoteService.previewNextQuote(),
        adminAuthService.getStatus(),
      ]);

      res.setHeader('Cache-Control', 'no-store');
      res.json({
        timezone: VIETNAM_TIMEZONE,
        todayDate: todayData.date,
        nextUpdateAtIso: todayData.nextUpdateAtIso,
        aiEngine: getActiveAiEngine(),
        adminAuthSource: authStatus.source,
        quotesSummary: {
          total: listData.quotes.length,
          verified: listData.totalVerified,
          unverified: listData.totalUnverified,
          hidden: listData.totalHidden,
          cycleNumber: listData.cycleNumber,
          remainingInCycle: listData.remainingInCycle,
          displayedDaysCount: listData.history.length,
          categoriesCount: QUOTE_CATEGORIES.length,
        },
        todayQuote: todayData.quote,
        nextPreview,
      });
    } catch (err) {
      console.error('[GET /api/admin/overview] Error:', err);
      res.status(500).json({ error: 'Không thể tải tổng quan hệ thống.' });
    }
  });

  app.get('/api/admin/quotes', requireAdmin, async (_req, res) => {
    try {
      const [listData, nextPreview] = await Promise.all([
        dailyQuoteService.listQuotes(),
        dailyQuoteService.previewNextQuote(),
      ]);
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        ...listData,
        categories: QUOTE_CATEGORIES,
        nextPreview,
      });
    } catch (err) {
      console.error('[GET /api/admin/quotes] Error:', err);
      res.status(500).json({ error: 'Không thể tải danh sách danh ngôn.' });
    }
  });

  app.get('/api/admin/quotes/preview-next', requireAdmin, async (_req, res) => {
    try {
      const preview = await dailyQuoteService.previewNextQuote();
      res.setHeader('Cache-Control', 'no-store');
      res.json(preview);
    } catch (err) {
      console.error('[GET /api/admin/quotes/preview-next] Error:', err);
      res.status(500).json({ error: 'Không thể xem trước danh ngôn tiếp theo.' });
    }
  });

  app.post('/api/admin/quotes/check-duplicate', requireAdmin, async (req, res) => {
    try {
      const content = typeof req.body?.content === 'string' ? req.body.content : '';
      const excludeId = typeof req.body?.excludeId === 'string' ? req.body.excludeId : undefined;
      const matches = await dailyQuoteService.findPossibleDuplicates(content, excludeId);
      res.json({ matches });
    } catch (err) {
      console.error('[POST /api/admin/quotes/check-duplicate] Error:', err);
      res.status(500).json({ error: 'Không thể kiểm tra trùng lặp.' });
    }
  });

  app.post('/api/admin/quotes', requireAdmin, async (req, res) => {
    try {
      const body = req.body ?? {};
      const result = await dailyQuoteService.addQuote({
        content: typeof body.content === 'string' ? body.content : '',
        author: typeof body.author === 'string' ? body.author : null,
        source: typeof body.source === 'string' ? body.source : '',
        sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined,
        originalLanguage:
          typeof body.originalLanguage === 'string' ? body.originalLanguage : undefined,
        originalText: typeof body.originalText === 'string' ? body.originalText : undefined,
        category: body.category,
        verified: Boolean(body.verified),
      });
      res.status(201).json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể thêm danh ngôn mới.';
      res.status(400).json({ error: msg });
    }
  });

  app.patch('/api/admin/quotes/:id', requireAdmin, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      const body = req.body ?? {};
      const updated = await dailyQuoteService.updateQuote(id, {
        content: typeof body.content === 'string' ? body.content : undefined,
        author:
          body.author === null || typeof body.author === 'string' ? body.author : undefined,
        source: typeof body.source === 'string' ? body.source : undefined,
        sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined,
        originalLanguage:
          typeof body.originalLanguage === 'string' ? body.originalLanguage : undefined,
        originalText: typeof body.originalText === 'string' ? body.originalText : undefined,
        category:
          typeof body.category === 'string'
            ? (body.category as (typeof QUOTE_CATEGORIES)[number])
            : undefined,
        verified: typeof body.verified === 'boolean' ? body.verified : undefined,
        hidden: typeof body.hidden === 'boolean' ? body.hidden : undefined,
      });
      res.json({ quote: updated });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể cập nhật danh ngôn.';
      res.status(400).json({ error: msg });
    }
  });

  app.delete('/api/admin/quotes/:id', requireAdmin, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      await dailyQuoteService.deleteQuote(id);
      res.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể xóa danh ngôn.';
      res.status(400).json({ error: msg });
    }
  });

  // Core Thinking Lab endpoint keeping exact contract:
  // { session_id, lab_type, message, resource_context_id }
  app.post('/api/lab', async (req, res) => {
    try {
      const body = req.body as Partial<LabApiRequestPayload> | undefined;
      const sessionId = typeof body?.session_id === 'string' ? body.session_id.trim() : '';
      const labType =
        body?.lab_type === 'concept' || body?.lab_type === 'debate' ? body.lab_type : null;
      const message = typeof body?.message === 'string' ? body.message.trim() : '';

      if (!sessionId || !labType || !message) {
        res.status(400).json({
          error: 'Yêu cầu chưa hợp lệ: cần đầy đủ session_id, lab_type và nội dung câu hỏi.',
        });
        return;
      }

      if (message.length > 4000) {
        res.status(400).json({
          error: 'Nội dung phát biểu vượt quá giới hạn 4.000 ký tự cho một lượt.',
        });
        return;
      }

      // Deterministic HTTP 429 simulation hook or real sliding-window rate limiter
      if (body?.simulate_429 === true) {
        const retryAfter = 10;
        res.setHeader('Retry-After', String(retryAfter));
        res.status(429).json({
          error:
            'Phòng thí nghiệm tư duy đang tạm nghỉ nhịp để giữ chất lượng phân tích. Nội dung bạn đang viết vẫn được bảo toàn nguyên vẹn.',
          retry_after: retryAfter,
        });
        return;
      }

      const rateStatus = checkRateLimit(sessionId);
      if (rateStatus.limited) {
        res.setHeader('Retry-After', String(rateStatus.retryAfterSeconds));
        res.status(429).json({
          error:
            'Bạn đã gửi nhiều lượt phân tích liên tiếp trong một phút. Hãy dành vài giây suy ngẫm trước khi tiếp tục — bản thảo của bạn vẫn được giữ nguyên.',
          retry_after: rateStatus.retryAfterSeconds,
        });
        return;
      }

      const rawResourceId =
        typeof body?.resource_context_id === 'string' ? body.resource_context_id.trim() : '';
      const verifiedResourceId =
        rawResourceId &&
        SEED_DOCUMENTS.some((doc) => doc.id === rawResourceId && doc.status === 'published')
          ? rawResourceId
          : null;

      const payload: LabApiRequestPayload = {
        session_id: sessionId,
        lab_type: labType,
        message,
        resource_context_id: verifiedResourceId,
        history: Array.isArray(body?.history) ? body.history.slice(-24) : [],
        ledger_snapshot: Array.isArray(body?.ledger_snapshot)
          ? body.ledger_snapshot.slice(-30)
          : [],
        core_assumptions: Array.isArray(body?.core_assumptions)
          ? body.core_assumptions.slice(0, 12)
          : [],
        previous_response_id:
          typeof body?.previous_response_id === 'string' ? body.previous_response_id : null,
      };

      const result = await executeDebateEngine(payload);
      res.json(result);
    } catch (err) {
      const e = err as Error & { status?: number; retryAfter?: number };
      if (e.status === 429) {
        const retryAfter = e.retryAfter ?? 15;
        res.setHeader('Retry-After', String(retryAfter));
        res.status(429).json({
          error:
            'Hệ thống AI đang chạm ngưỡng tần suất tạm thời. Nội dung bạn gõ được giữ nguyên — bạn có thể gửi lại ngay khi đồng hồ kết thúc.',
          retry_after: retryAfter,
        });
        return;
      }
      console.error('[POST /api/lab] Unexpected error:', e);
      res.status(500).json({
        error:
          'Không thể kết nối tới máy chủ phân tích vào lúc này. Bản thảo của bạn đã được tự động lưu cục bộ.',
      });
    }
  });

  return app;
}
