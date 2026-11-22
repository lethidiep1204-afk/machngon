import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import {
  DailyQuote,
  QUOTE_CATEGORIES,
  VERIFIED_SEED_QUOTES,
} from '../data/verifiedQuotes.ts';
import {
  DailyQuoteService,
  getNextVietnamMidnightIso,
  getVietnamDateKey,
  normalizeQuoteText,
} from './dailyQuoteService.ts';
import { AdminAuthService } from './adminAuth.ts';

async function makeTempFile(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `machngon-${prefix}-`));
  return path.join(dir, 'state.json');
}

const cleanupDirs: string[] = [];

after(async () => {
  for (const dir of cleanupDirs) {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

describe('Verified Seed Quotes Integrity', () => {
  it('contains 120 unique, verified quotes across all 10 required categories with clear sources', () => {
    assert.equal(QUOTE_CATEGORIES.length, 10);
    assert.equal(VERIFIED_SEED_QUOTES.length, 120);

    const seenIds = new Set<string>();
    const seenNormalized = new Set<string>();
    const perCategory = new Map<string, number>();

    for (const q of VERIFIED_SEED_QUOTES) {
      assert.equal(q.verified, true, `Quote ${q.id} must be verified`);
      assert.ok(q.content.trim().length >= 8, `Quote ${q.id} content too short`);
      assert.ok(q.source.trim().length >= 3, `Quote ${q.id} must cite a source`);
      assert.ok(
        (QUOTE_CATEGORIES as readonly string[]).includes(q.category),
        `Invalid category on ${q.id}`
      );
      assert.ok(!seenIds.has(q.id), `Duplicate ID: ${q.id}`);
      seenIds.add(q.id);

      const norm = normalizeQuoteText(q.content);
      assert.ok(!seenNormalized.has(norm), `Duplicate content: ${q.content}`);
      seenNormalized.add(norm);

      perCategory.set(q.category, (perCategory.get(q.category) ?? 0) + 1);
    }

    for (const cat of QUOTE_CATEGORIES) {
      assert.equal(perCategory.get(cat), 12, `Category "${cat}" should have 12 verified quotes`);
    }
  });
});

describe('Asia/Ho_Chi_Minh Timezone Helpers', () => {
  it('formats Vietnam date accurately across UTC midnight boundaries', () => {
    // 2026-05-10 16:59:59 UTC == 2026-05-10 23:59:59+07:00
    assert.equal(getVietnamDateKey(new Date('2026-05-10T16:59:59Z')), '2026-05-10');
    // 2026-05-10 17:00:00 UTC == 2026-05-11 00:00:00+07:00
    assert.equal(getVietnamDateKey(new Date('2026-05-10T17:00:00Z')), '2026-05-11');
  });

  it('computes exact upcoming 00:00:00+07:00 in UTC ISO', () => {
    const nextIso = getNextVietnamMidnightIso(new Date('2026-05-10T10:30:00Z'));
    // Next VN midnight after 2026-05-10 17:30+07 is 2026-05-11 00:00+07 == 2026-05-10T17:00:00.000Z
    assert.equal(nextIso, '2026-05-10T17:00:00.000Z');
  });
});

describe('DailyQuoteService Rotation, Concurrency & Gating', () => {
  it('returns the exact same quote on repeated & concurrent calls for the same date', async () => {
    const file = await makeTempFile('concurrency');
    cleanupDirs.push(path.dirname(file));

    const service = new DailyQuoteService(file);
    const results = await Promise.all([
      service.getQuoteForDate('2026-06-01'),
      service.getQuoteForDate('2026-06-01'),
      service.getQuoteForDate('2026-06-01'),
      service.getQuoteForDate('2026-06-01'),
    ]);

    const firstId = results[0].quote.id;
    for (const res of results) {
      assert.equal(res.quote.id, firstId);
      assert.equal(res.date, '2026-06-01');
      assert.equal(res.timezone, 'Asia/Ho_Chi_Minh');
    }

    // Fresh instance reading persisted disk state must return the exact same quote
    const reloaded = new DailyQuoteService(file);
    const afterReload = await reloaded.getQuoteForDate('2026-06-01');
    assert.equal(afterReload.quote.id, firstId);
  });

  it('never repeats inside a cycle, reshuffles on cycle #2, avoids yesterday repeat, and excludes unverified/hidden quotes', async () => {
    const file = await makeTempFile('cycle');
    cleanupDirs.push(path.dirname(file));

    const miniPool: DailyQuote[] = [
      {
        id: 'v1',
        content: 'Học, học nữa, học mãi để mở rộng chân trời hiểu biết.',
        author: 'Tác giả A',
        source: 'Nguồn kiểm thử 1',
        category: 'Học tập & tri thức',
        verified: true,
      },
      {
        id: 'v2',
        content: 'Đọc sách hay như trò chuyện với những bộ óc ưu tú nhất.',
        author: 'Tác giả B',
        source: 'Nguồn kiểm thử 2',
        category: 'Đọc sách & ngôn ngữ',
        verified: true,
      },
      {
        id: 'v3',
        content: 'Biết đặt câu hỏi đúng là đã đi được nửa chặng đường tìm chân lý.',
        author: 'Tác giả C',
        source: 'Nguồn kiểm thử 3',
        category: 'Tư duy & phản biện',
        verified: true,
      },
      {
        id: 'v4',
        content: 'Kiên trì mỗi ngày một bước nhỏ sẽ tạo nên thay đổi lớn.',
        author: 'Tác giả D',
        source: 'Nguồn kiểm thử 4',
        category: 'Kiên trì & tự học',
        verified: true,
      },
      {
        id: 'unverified-1',
        content: 'Câu chưa xác minh tuyệt đối không được phép lên lịch hiển thị.',
        author: 'Chưa rõ',
        source: 'Nháp',
        category: 'Đạo đức & trách nhiệm',
        verified: false,
      },
      {
        id: 'hidden-1',
        content: 'Câu đang ẩn cũng không được phép xuất hiện ngoài giao diện.',
        author: 'Ẩn danh',
        source: 'Nguồn ẩn',
        category: 'Văn học & nghệ thuật',
        verified: true,
        hidden: true,
      },
    ];

    const service = new DailyQuoteService(file, miniPool);

    // Cycle 1: 4 eligible verified quotes over 4 days
    const cycle1Ids: string[] = [];
    for (let day = 1; day <= 4; day += 1) {
      const res = await service.getQuoteForDate(`2026-07-0${day}`);
      assert.equal(res.cycleNumber, 1);
      assert.notEqual(res.quote.id, 'unverified-1');
      assert.notEqual(res.quote.id, 'hidden-1');
      cycle1Ids.push(res.quote.id);
    }

    assert.equal(new Set(cycle1Ids).size, 4, 'Cycle 1 must show all 4 verified quotes with zero repeats');

    // Cycle 2: next 4 days
    const cycle2Ids: string[] = [];
    for (let day = 5; day <= 8; day += 1) {
      const res = await service.getQuoteForDate(`2026-07-0${day}`);
      assert.equal(res.cycleNumber, 2);
      assert.notEqual(res.quote.id, 'unverified-1');
      assert.notEqual(res.quote.id, 'hidden-1');
      cycle2Ids.push(res.quote.id);
    }

    assert.equal(new Set(cycle2Ids).size, 4, 'Cycle 2 must show all 4 verified quotes with zero repeats');
    assert.notEqual(
      cycle2Ids[0],
      cycle1Ids[cycle1Ids.length - 1],
      'First day of new cycle must not repeat last day of previous cycle'
    );
    assert.notDeepEqual(cycle2Ids, cycle1Ids, 'Cycle 2 order must differ from Cycle 1 order');
  });

  it('blocks duplicate quotes and unsafe non-http(s) URLs in addQuote', async () => {
    const file = await makeTempFile('crud');
    cleanupDirs.push(path.dirname(file));
    const service = new DailyQuoteService(file);

    const sampleExisting = VERIFIED_SEED_QUOTES[0];
    const matches = await service.findPossibleDuplicates(sampleExisting.content);
    assert.ok(matches.length >= 1);

    await assert.rejects(
      () =>
        service.addQuote({
          content: sampleExisting.content,
          author: sampleExisting.author,
          source: sampleExisting.source,
          category: sampleExisting.category,
          verified: true,
        }),
      /trùng nội dung/i
    );

    await assert.rejects(
      () =>
        service.addQuote({
          content: 'Một câu danh ngôn kiểm thử hợp lệ nhưng chứa đường dẫn không an toàn.',
          author: 'Tác giả kiểm thử',
          source: 'Tài liệu kiểm thử',
          sourceUrl: 'javascript:alert(1)',
          category: 'Học tập & tri thức',
          verified: false,
        }),
      /http:\/\/ hoặc https:\/\//i
    );
  });
});

describe('AdminAuthService RBAC & Token Security', () => {
  it('supports atomic one-time bootstrap, rejects second bootstrap, validates passcodes and revokes tokens', async () => {
    const file = await makeTempFile('admin-auth');
    cleanupDirs.push(path.dirname(file));

    // Temporarily clear ADMIN_PASSCODE in test process if set
    const prevEnv = process.env.ADMIN_PASSCODE;
    delete process.env.ADMIN_PASSCODE;

    try {
      const auth = new AdminAuthService(file);
      const beforeStatus = await auth.getStatus();
      assert.equal(beforeStatus.configured, false);
      assert.equal(beforeStatus.source, 'unconfigured');

      // Short passcode rejected
      await assert.rejects(() => auth.bootstrapPasscode('short'), /tối thiểu 8 ký tự/i);

      // First bootstrap succeeds
      const bootstrapped = await auth.bootstrapPasscode('MachNgonAdmin2026!');
      assert.ok(bootstrapped.token.includes('.'));
      assert.ok(auth.verifyToken(bootstrapped.token));

      // Second bootstrap strictly rejected
      await assert.rejects(
        () => auth.bootstrapPasscode('AnotherPasscode999!'),
        /đã được thiết lập/i
      );

      // Wrong passcode fails login
      const badLogin = await auth.verifyAndLogin('WrongPasscode123!');
      assert.equal(badLogin, null);

      // Correct passcode succeeds
      const goodLogin = await auth.verifyAndLogin('MachNgonAdmin2026!');
      assert.ok(goodLogin);
      assert.ok(auth.verifyToken(goodLogin.token));

      // Tampered token rejected
      const tampered = `${goodLogin.token}x`;
      assert.equal(auth.verifyToken(tampered), null);

      // Revoked token rejected
      auth.revokeToken(goodLogin.token);
      assert.equal(auth.verifyToken(goodLogin.token), null);
    } finally {
      if (prevEnv !== undefined) {
        process.env.ADMIN_PASSCODE = prevEnv;
      }
    }
  });
});
