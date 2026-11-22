import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  type DailyQuote,
  QUOTE_CATEGORIES,
  type QuoteCategory,
  VERIFIED_SEED_QUOTES,
} from '../content/verifiedQuotes.ts';

export const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

export interface DailyQuoteResponse {
  date: string;
  timezone: string;
  cycleNumber: number;
  remainingInCycle: number;
  totalVerified: number;
  nextUpdateAtIso: string;
  quote: DailyQuote;
}

export interface QuoteHistoryItem {
  date: string;
  quoteId: string;
  content: string;
  author: string | null;
  source: string;
  category: QuoteCategory;
}

interface PersistedQuoteState {
  version: number;
  quotes: DailyQuote[];
  cycleNumber: number;
  remainingIds: string[];
  lastCycleOrder: string[];
  history: Record<string, string>;
  lastDisplayedQuoteId: string | null;
}

const DEFAULT_DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'machngon-data')
  : path.resolve(process.cwd(), 'data');
const DEFAULT_STORE_PATH = path.join(DEFAULT_DATA_DIR, 'machngon-quotes-state.json');

/**
 * Returns the calendar date string (YYYY-MM-DD) in Asia/Ho_Chi_Minh (UTC+7).
 */
export function getVietnamDateKey(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Returns the exact ISO UTC timestamp for the upcoming 00:00:00 Asia/Ho_Chi_Minh.
 */
export function getNextVietnamMidnightIso(date: Date = new Date()): string {
  const todayVn = getVietnamDateKey(date);
  const [y, m, d] = todayVn.split('-').map(Number);
  // Asia/Ho_Chi_Minh is fixed UTC+07:00 (no DST).
  // Next midnight VN = (y, m, d + 1) 00:00:00+07:00 = UTC - 7 hours.
  const nextMidnightUtcMs = Date.UTC(y, m - 1, d + 1, 0, 0, 0) - 7 * 60 * 60 * 1000;
  return new Date(nextMidnightUtcMs).toISOString();
}

export function normalizeQuoteText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isValidSafeUrl(url: string | undefined): boolean {
  if (!url || !url.trim()) return true;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidCategory(value: string): value is QuoteCategory {
  return (QUOTE_CATEGORIES as readonly string[]).includes(value);
}

function fisherYatesShuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildFreshCycleOrder(
  eligibleIds: string[],
  previousOrder: string[],
  lastDisplayedId: string | null
): string[] {
  if (eligibleIds.length <= 1) return [...eligibleIds];

  let candidate = fisherYatesShuffle(eligibleIds);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const sameAsPrevOrder =
      candidate.length === previousOrder.length &&
      candidate.every((id, idx) => id === previousOrder[idx]);
    const repeatsYesterdayFirst = lastDisplayedId !== null && candidate[0] === lastDisplayedId;
    if (!sameAsPrevOrder && !repeatsYesterdayFirst) {
      return candidate;
    }
    candidate = fisherYatesShuffle(eligibleIds);
  }

  // Deterministic fallback adjustment if random draws collided on tiny pools
  if (lastDisplayedId !== null && candidate[0] === lastDisplayedId && candidate.length > 1) {
    [candidate[0], candidate[candidate.length - 1]] = [
      candidate[candidate.length - 1],
      candidate[0],
    ];
  }
  if (
    candidate.length === previousOrder.length &&
    candidate.every((id, idx) => id === previousOrder[idx]) &&
    candidate.length > 1
  ) {
    candidate = [...candidate.slice(1), candidate[0]];
  }
  return candidate;
}

export class DailyQuoteService {
  private readonly storePath: string;
  private readonly seedQuotes: DailyQuote[];
  private lock: Promise<void> = Promise.resolve();
  private cachedState: PersistedQuoteState | null = null;

  constructor(
    storePath: string = DEFAULT_STORE_PATH,
    seedQuotes: DailyQuote[] = VERIFIED_SEED_QUOTES
  ) {
    this.storePath = storePath;
    this.seedQuotes = seedQuotes;
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

  private createInitialState(seedQuotes: DailyQuote[] = this.seedQuotes): PersistedQuoteState {
    const quotes = seedQuotes.map((q) => ({ ...q }));
    const eligibleIds = quotes.filter((q) => q.verified && !q.hidden).map((q) => q.id);
    const initialOrder = buildFreshCycleOrder(eligibleIds, [], null);
    return {
      version: 1,
      quotes,
      cycleNumber: 1,
      remainingIds: [...initialOrder],
      lastCycleOrder: [...initialOrder],
      history: {},
      lastDisplayedQuoteId: null,
    };
  }

  private async loadState(): Promise<PersistedQuoteState> {
    if (this.cachedState) return this.cachedState;

    try {
      const raw = await fs.readFile(this.storePath, 'utf8');
      const parsed = JSON.parse(raw) as PersistedQuoteState;
      if (parsed && Array.isArray(parsed.quotes) && parsed.quotes.length > 0) {
        // Merge any newly added seed quotes without overwriting admin edits
        const existingIds = new Set(parsed.quotes.map((q) => q.id));
        const newlyAdded: DailyQuote[] = [];
        for (const seed of this.seedQuotes) {
          if (!existingIds.has(seed.id)) {
            parsed.quotes.push({ ...seed });
            if (seed.verified && !seed.hidden) {
              newlyAdded.push(seed);
            }
          }
        }
        if (newlyAdded.length > 0) {
          parsed.remainingIds.push(...newlyAdded.map((q) => q.id));
          await this.saveState(parsed);
        }
        this.cachedState = parsed;
        return parsed;
      }
    } catch {
      // File does not exist yet or is invalid — initialize cleanly
    }

    const fresh = this.createInitialState();
    await this.saveState(fresh);
    this.cachedState = fresh;
    return fresh;
  }

  private async saveState(state: PersistedQuoteState): Promise<void> {
    const dir = path.dirname(this.storePath);
    await fs.mkdir(dir, { recursive: true });
    const tmpPath = `${this.storePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf8');
    await fs.rename(tmpPath, this.storePath);
    this.cachedState = state;
  }

  private getEligibleQuotes(state: PersistedQuoteState): DailyQuote[] {
    return state.quotes.filter((q) => q.verified && !q.hidden);
  }

  /**
   * Returns the canonical quote for a given Vietnam date (defaults to today in Asia/Ho_Chi_Minh).
   * Concurrency-safe: guarantees identical output for all concurrent users/devices on the same day.
   */
  async getQuoteForDate(dateKey: string = getVietnamDateKey()): Promise<DailyQuoteResponse> {
    return this.withLock(async () => {
      const state = await this.loadState();
      const eligible = this.getEligibleQuotes(state);
      const eligibleMap = new Map(eligible.map((q) => [q.id, q]));

      if (eligible.length === 0) {
        throw new Error('Hiện chưa có danh ngôn nào được xác minh (verified: true) trong hệ thống.');
      }

      // 1. If today already has a valid verified quote assigned, always return it unchanged
      const assignedId = state.history[dateKey];
      if (assignedId && eligibleMap.has(assignedId)) {
        const assignedQuote = eligibleMap.get(assignedId)!;
        return {
          date: dateKey,
          timezone: VIETNAM_TIMEZONE,
          cycleNumber: state.cycleNumber,
          remainingInCycle: state.remainingIds.filter((id) => eligibleMap.has(id)).length,
          totalVerified: eligible.length,
          nextUpdateAtIso: getNextVietnamMidnightIso(),
          quote: {
            ...assignedQuote,
            displayedDate: dateKey,
          },
        };
      }

      // 2. Clean remainingIds to strictly verified & visible quotes
      state.remainingIds = state.remainingIds.filter((id) => eligibleMap.has(id));

      // 3. Start a new shuffled cycle only once all verified quotes in current cycle were displayed
      if (state.remainingIds.length === 0) {
        state.cycleNumber += 1;
        const freshOrder = buildFreshCycleOrder(
          eligible.map((q) => q.id),
          state.lastCycleOrder,
          state.lastDisplayedQuoteId
        );
        state.remainingIds = [...freshOrder];
        state.lastCycleOrder = [...freshOrder];
      }

      // 4. Pop next quote atomically for dateKey
      const chosenId = state.remainingIds.shift()!;
      const chosenQuote = eligibleMap.get(chosenId)!;
      state.history[dateKey] = chosenId;
      state.lastDisplayedQuoteId = chosenId;

      await this.saveState(state);

      return {
        date: dateKey,
        timezone: VIETNAM_TIMEZONE,
        cycleNumber: state.cycleNumber,
        remainingInCycle: state.remainingIds.length,
        totalVerified: eligible.length,
        nextUpdateAtIso: getNextVietnamMidnightIso(),
        quote: {
          ...chosenQuote,
          displayedDate: dateKey,
        },
      };
    });
  }

  /**
   * Deterministic preview of the next scheduled quote without mutating today's state.
   */
  async previewNextQuote(): Promise<{
    nextQuote: DailyQuote | null;
    startsNewCycleTomorrow: boolean;
    remainingInCycle: number;
    cycleNumber: number;
  }> {
    return this.withLock(async () => {
      const state = await this.loadState();
      const eligibleMap = new Map(this.getEligibleQuotes(state).map((q) => [q.id, q]));
      const validRemaining = state.remainingIds.filter((id) => eligibleMap.has(id));
      const nextId = validRemaining[0];
      return {
        nextQuote: nextId ? { ...eligibleMap.get(nextId)! } : null,
        startsNewCycleTomorrow: validRemaining.length === 0,
        remainingInCycle: validRemaining.length,
        cycleNumber: state.cycleNumber,
      };
    });
  }

  async listQuotes(): Promise<{
    quotes: DailyQuote[];
    history: QuoteHistoryItem[];
    cycleNumber: number;
    remainingInCycle: number;
    todayDate: string;
    todayQuoteId: string | null;
    totalVerified: number;
    totalUnverified: number;
    totalHidden: number;
  }> {
    const todayDate = getVietnamDateKey();
    // Ensure today is assigned first
    await this.getQuoteForDate(todayDate);

    return this.withLock(async () => {
      const state = await this.loadState();
      const byId = new Map(state.quotes.map((q) => [q.id, q]));
      const displayedDateByQuoteId = new Map<string, string>();
      const historyEntries: QuoteHistoryItem[] = Object.entries(state.history)
        .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
        .map(([date, quoteId]) => {
          if (!displayedDateByQuoteId.has(quoteId)) {
            displayedDateByQuoteId.set(quoteId, date);
          }
          const q = byId.get(quoteId);
          return {
            date,
            quoteId,
            content: q?.content ?? '(Danh ngôn đã bị xóa)',
            author: q?.author ?? null,
            source: q?.source ?? '',
            category: q?.category ?? 'Học tập & tri thức',
          };
        });

      const eligibleIds = new Set(this.getEligibleQuotes(state).map((q) => q.id));

      return {
        quotes: state.quotes.map((q) => ({
          ...q,
          displayedDate: displayedDateByQuoteId.get(q.id),
        })),
        history: historyEntries,
        cycleNumber: state.cycleNumber,
        remainingInCycle: state.remainingIds.filter((id) => eligibleIds.has(id)).length,
        todayDate,
        todayQuoteId: state.history[todayDate] ?? null,
        totalVerified: state.quotes.filter((q) => q.verified && !q.hidden).length,
        totalUnverified: state.quotes.filter((q) => !q.verified && !q.hidden).length,
        totalHidden: state.quotes.filter((q) => Boolean(q.hidden)).length,
      };
    });
  }

  async findPossibleDuplicates(content: string, excludeId?: string): Promise<DailyQuote[]> {
    return this.withLock(async () => {
      const state = await this.loadState();
      const target = normalizeQuoteText(content);
      if (target.length < 8) return [];
      return state.quotes.filter((q) => {
        if (excludeId && q.id === excludeId) return false;
        const norm = normalizeQuoteText(q.content);
        return norm === target || (target.length > 18 && (norm.includes(target) || target.includes(norm)));
      });
    });
  }

  async addQuote(input: {
    content: string;
    author: string | null;
    source: string;
    sourceUrl?: string;
    originalLanguage?: string;
    originalText?: string;
    category: QuoteCategory;
    verified: boolean;
  }): Promise<{ quote: DailyQuote; duplicateWarning: boolean }> {
    const content = input.content.trim();
    const source = input.source.trim();
    const author = input.author && input.author.trim() ? input.author.trim() : null;
    const sourceUrl = input.sourceUrl?.trim() || undefined;

    if (content.length < 8 || content.length > 600) {
      throw new Error('Nội dung danh ngôn cần từ 8 đến 600 ký tự.');
    }
    if (!source) {
      throw new Error('Vui lòng ghi rõ nguồn trích dẫn hoặc xuất xứ của danh ngôn.');
    }
    if (!isValidCategory(input.category)) {
      throw new Error('Chủ đề danh ngôn không hợp lệ.');
    }
    if (!isValidSafeUrl(sourceUrl)) {
      throw new Error('Đường dẫn nguồn tham khảo phải bắt đầu bằng http:// hoặc https://.');
    }

    return this.withLock(async () => {
      const state = await this.loadState();
      const normalized = normalizeQuoteText(content);
      const exactDup = state.quotes.find((q) => normalizeQuoteText(q.content) === normalized);
      if (exactDup) {
        throw new Error('Danh ngôn này đã tồn tại trong hệ thống (trùng nội dung).');
      }

      const similarDup = state.quotes.some((q) => {
        const norm = normalizeQuoteText(q.content);
        return normalized.length > 18 && (norm.includes(normalized) || normalized.includes(norm));
      });

      const created: DailyQuote = {
        id: `q-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        content,
        author,
        source,
        sourceUrl,
        originalLanguage: input.originalLanguage?.trim() || undefined,
        originalText: input.originalText?.trim() || undefined,
        category: input.category,
        verified: Boolean(input.verified),
        hidden: false,
      };

      state.quotes.unshift(created);
      if (created.verified) {
        // Insert into current cycle's remaining pool at a random slot
        const insertIdx = Math.floor(Math.random() * (state.remainingIds.length + 1));
        state.remainingIds.splice(insertIdx, 0, created.id);
      }

      await this.saveState(state);
      return { quote: created, duplicateWarning: similarDup };
    });
  }

  async updateQuote(
    id: string,
    patch: Partial<{
      content: string;
      author: string | null;
      source: string;
      sourceUrl: string;
      originalLanguage: string;
      originalText: string;
      category: QuoteCategory;
      verified: boolean;
      hidden: boolean;
    }>
  ): Promise<DailyQuote> {
    return this.withLock(async () => {
      const state = await this.loadState();
      const idx = state.quotes.findIndex((q) => q.id === id);
      if (idx === -1) {
        throw new Error('Không tìm thấy danh ngôn cần cập nhật.');
      }

      const current = state.quotes[idx];
      const nextContent = patch.content !== undefined ? patch.content.trim() : current.content;
      const nextSource = patch.source !== undefined ? patch.source.trim() : current.source;
      const nextAuthor =
        patch.author !== undefined
          ? patch.author && patch.author.trim()
            ? patch.author.trim()
            : null
          : current.author;
      const nextSourceUrl =
        patch.sourceUrl !== undefined ? patch.sourceUrl.trim() || undefined : current.sourceUrl;
      const nextCategory = patch.category ?? current.category;

      if (nextContent.length < 8 || nextContent.length > 600) {
        throw new Error('Nội dung danh ngôn cần từ 8 đến 600 ký tự.');
      }
      if (!nextSource) {
        throw new Error('Nguồn trích dẫn không được để trống.');
      }
      if (!isValidCategory(nextCategory)) {
        throw new Error('Chủ đề danh ngôn không hợp lệ.');
      }
      if (!isValidSafeUrl(nextSourceUrl)) {
        throw new Error('Đường dẫn nguồn tham khảo phải bắt đầu bằng http:// hoặc https://.');
      }

      const normalized = normalizeQuoteText(nextContent);
      const dup = state.quotes.find(
        (q) => q.id !== id && normalizeQuoteText(q.content) === normalized
      );
      if (dup) {
        throw new Error('Nội dung vừa sửa bị trùng với một danh ngôn khác đã có.');
      }

      const updated: DailyQuote = {
        ...current,
        content: nextContent,
        author: nextAuthor,
        source: nextSource,
        sourceUrl: nextSourceUrl,
        originalLanguage:
          patch.originalLanguage !== undefined
            ? patch.originalLanguage.trim() || undefined
            : current.originalLanguage,
        originalText:
          patch.originalText !== undefined
            ? patch.originalText.trim() || undefined
            : current.originalText,
        category: nextCategory,
        verified: patch.verified !== undefined ? Boolean(patch.verified) : current.verified,
        hidden: patch.hidden !== undefined ? Boolean(patch.hidden) : current.hidden,
      };

      state.quotes[idx] = updated;

      const isNowEligible = updated.verified && !updated.hidden;
      const alreadyShownInHistory = Object.values(state.history).includes(id);

      if (!isNowEligible) {
        state.remainingIds = state.remainingIds.filter((qid) => qid !== id);
      } else if (!state.remainingIds.includes(id) && !alreadyShownInHistory) {
        state.remainingIds.push(id);
      }

      await this.saveState(state);
      return updated;
    });
  }

  async deleteQuote(id: string): Promise<void> {
    return this.withLock(async () => {
      const state = await this.loadState();
      const idx = state.quotes.findIndex((q) => q.id === id);
      if (idx === -1) {
        throw new Error('Không tìm thấy danh ngôn cần xóa.');
      }

      const remainingVerifiedCount = state.quotes.filter(
        (q) => q.id !== id && q.verified && !q.hidden
      ).length;
      if (remainingVerifiedCount < 1) {
        throw new Error('Hệ thống cần giữ lại ít nhất 1 danh ngôn đã xác minh để hiển thị mỗi ngày.');
      }

      state.quotes.splice(idx, 1);
      state.remainingIds = state.remainingIds.filter((qid) => qid !== id);
      await this.saveState(state);
    });
  }
}

export const dailyQuoteService = new DailyQuoteService();
