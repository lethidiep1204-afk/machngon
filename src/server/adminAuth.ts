import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';

interface PersistedAdminAuth {
  saltHex: string;
  hashHex: string;
  createdAt: string;
}

interface AdminTokenPayload {
  role: 'admin';
  iat: number;
  exp: number;
}

const DEFAULT_AUTH_PATH = path.resolve(process.cwd(), 'data', 'machngon-admin-auth.json');
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getSigningSecret(): string {
  const configured = process.env.ADMIN_SESSION_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : EPHEMERAL_FALLBACK_SECRET;
}

function hashPasscode(passcode: string, saltHex: string): string {
  return crypto.scryptSync(passcode, Buffer.from(saltHex, 'hex'), 64).toString('hex');
}

function constantTimeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export class AdminAuthService {
  private readonly authPath: string;
  private lock: Promise<void> = Promise.resolve();
  private revokedTokens = new Set<string>();

  constructor(authPath: string = DEFAULT_AUTH_PATH) {
    this.authPath = authPath;
  }

  private async withLock<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.lock;
    let release!: () => void;
    this.lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await task();
    } finally {
      release();
    }
  }

  private async readPersistedAuth(): Promise<PersistedAdminAuth | null> {
    try {
      const raw = await fs.readFile(this.authPath, 'utf8');
      const parsed = JSON.parse(raw) as PersistedAdminAuth;
      if (parsed?.saltHex && parsed?.hashHex) return parsed;
      return null;
    } catch {
      return null;
    }
  }

  private async writePersistedAuth(record: PersistedAdminAuth): Promise<void> {
    await fs.mkdir(path.dirname(this.authPath), { recursive: true });
    const tmpPath = `${this.authPath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(record, null, 2), 'utf8');
    await fs.rename(tmpPath, this.authPath);
  }

  async getStatus(): Promise<{
    configured: boolean;
    source: 'env' | 'local-bootstrap' | 'unconfigured';
  }> {
    const envPass = process.env.ADMIN_PASSCODE?.trim();
    if (envPass && envPass.length > 0) {
      return { configured: true, source: 'env' };
    }
    const localRecord = await this.readPersistedAuth();
    if (localRecord) {
      return { configured: true, source: 'local-bootstrap' };
    }
    return { configured: false, source: 'unconfigured' };
  }

  /**
   * One-time atomic first-run setup when ADMIN_PASSCODE env var is not configured.
   * Permanently locks itself after the first administrator claims the passcode.
   */
  async bootstrapPasscode(passcode: string): Promise<{ token: string; expiresAt: string }> {
    const trimmed = passcode.trim();
    if (trimmed.length < 8) {
      throw new Error('Mã quản trị cần tối thiểu 8 ký tự để đảm bảo an toàn.');
    }

    return this.withLock(async () => {
      const status = await this.getStatus();
      if (status.configured) {
        throw new Error('Hệ thống quản trị đã được thiết lập mã bảo vệ. Vui lòng đăng nhập.');
      }

      const saltHex = crypto.randomBytes(16).toString('hex');
      const hashHex = hashPasscode(trimmed, saltHex);
      await this.writePersistedAuth({
        saltHex,
        hashHex,
        createdAt: new Date().toISOString(),
      });

      return this.issueToken();
    });
  }

  async verifyAndLogin(passcode: string): Promise<{ token: string; expiresAt: string } | null> {
    const trimmed = passcode.trim();
    if (!trimmed) return null;

    const envPass = process.env.ADMIN_PASSCODE?.trim();
    if (envPass && envPass.length > 0) {
      if (constantTimeStringEqual(trimmed, envPass)) {
        return this.issueToken();
      }
      return null;
    }

    const localRecord = await this.readPersistedAuth();
    if (!localRecord) return null;

    const candidateHash = hashPasscode(trimmed, localRecord.saltHex);
    if (constantTimeStringEqual(candidateHash, localRecord.hashHex)) {
      return this.issueToken();
    }
    return null;
  }

  issueToken(): { token: string; expiresAt: string } {
    const now = Date.now();
    const exp = now + TOKEN_TTL_MS;
    const payload: AdminTokenPayload = {
      role: 'admin',
      iat: now,
      exp,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = crypto
      .createHmac('sha256', getSigningSecret())
      .update(encodedPayload)
      .digest('base64url');
    return {
      token: `${encodedPayload}.${sig}`,
      expiresAt: new Date(exp).toISOString(),
    };
  }

  verifyToken(token: string): AdminTokenPayload | null {
    if (!token || this.revokedTokens.has(token)) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedPayload, providedSig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', getSigningSecret())
      .update(encodedPayload)
      .digest('base64url');

    if (!constantTimeStringEqual(providedSig, expectedSig)) return null;

    try {
      const parsed = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8')
      ) as AdminTokenPayload;
      if (parsed.role !== 'admin' || typeof parsed.exp !== 'number') return null;
      if (Date.now() > parsed.exp) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  revokeToken(token: string): void {
    if (token) this.revokedTokens.add(token);
  }
}

export const adminAuthService = new AdminAuthService();

export function extractBearerToken(req: Request): string | null {
  const header = req.header('authorization') || req.header('Authorization');
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Yêu cầu xác thực quản trị viên để truy cập tài nguyên này.' });
    return;
  }
  const verified = adminAuthService.verifyToken(token);
  if (!verified) {
    res.status(401).json({ error: 'Phiên đăng nhập quản trị không hợp lệ hoặc đã hết hạn.' });
    return;
  }
  next();
}
