import React, { useMemo, useState } from 'react';
import { ArrowRight, BrainCircuit, Scale, Search, Trash2 } from 'lucide-react';
import { WorkspaceShell } from '../components/layout/AppShell';
import { EmptyStateCard, PageHeader } from '../components/ui/EditorialPrimitives';
import { useApp } from '../lib/AppContext';
import { Link } from '../lib/router';
import { matchesVietnameseQuery } from '../lib/vietnamese';

export function HistoryPage() {
  const { sessions, deleteSession, documents } = useApp();
  const [query, setQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | 'concept' | 'debate'>('all');

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (modeFilter !== 'all' && s.labType !== modeFilter) return false;
      if (!query.trim()) return true;
      const haystack = `${s.title} ${s.ledger.map((l) => l.claim).join(' ')}`;
      return matchesVietnameseQuery(haystack, query);
    });
  }, [sessions, modeFilter, query]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <WorkspaceShell>
      <div className="mx-auto max-w-[1040px] px-5 sm:px-8 py-8 lg:py-10 space-y-7">
        <PageHeader
          kicker="Lưu trữ đối thoại học thuật"
          title="Lịch sử"
          description="Xem lại các phiên Concept Lab và Debate Lab kèm toàn bộ Sổ tay mạch lập luận đã ghi nhận."
          action={
            <Link to="/lab" className="btn-primary !min-h-10 !text-sm">
              Bắt đầu phiên mới
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5">
          <div className="relative flex-1 max-w-md">
            <label htmlFor="history-search" className="sr-only">
              Tìm kiếm trong lịch sử phiên tư duy
            </label>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
            <input
              id="history-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo chủ đề hoặc luận điểm..."
              className="input-editorial !pl-10"
            />
          </div>

          <div
            role="group"
            aria-label="Lọc theo chế độ Lab"
            className="inline-flex rounded-xl p-1 border border-[var(--color-border)] bg-[var(--color-surface)] self-start"
          >
            {(
              [
                ['all', 'Tất cả'],
                ['concept', 'Concept Lab'],
                ['debate', 'Debate Lab'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setModeFilter(val)}
                aria-pressed={modeFilter === val}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  modeFilter === val
                    ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Sessions List */}
        {filtered.length === 0 ? (
          <EmptyStateCard
            title="Chưa có phiên tư duy nào phù hợp"
            description="Các cuộc trao đổi trong Concept Lab và Debate Lab sẽ tự động lưu lại tại đây để bạn tiếp tục đối chiếu bất cứ lúc nào."
            action={
              <Link to="/lab" className="btn-primary">
                Mở Thinking Lab
              </Link>
            }
          />
        ) : (
          <div className="space-y-3.5">
            {filtered.map((session) => {
              const linkedDoc = session.resourceContextId
                ? documents.find((d) => d.id === session.resourceContextId)
                : null;
              return (
                <article
                  key={session.id}
                  className="rounded-2xl p-5 sm:p-6 surface-card surface-card-interactive flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-primary)]">
                        {session.labType === 'concept' ? (
                          <BrainCircuit className="h-3.5 w-3.5" />
                        ) : (
                          <Scale className="h-3.5 w-3.5" />
                        )}
                        {session.labType === 'concept' ? 'Concept Lab' : 'Debate Lab'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">{session.messages.length} lượt trao đổi</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">{session.ledger.length} mốc Sổ tay</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">{formatDate(session.updatedAt)}</span>
                    </div>

                    <h2 className="font-display text-lg sm:text-xl font-semibold leading-snug text-[var(--color-text)]">
                      {session.title}
                    </h2>

                    {linkedDoc && (
                      <p className="text-xs text-[var(--color-text-muted)] truncate">
                        Tài liệu đính kèm: {linkedDoc.title}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to={`/lab?session=${encodeURIComponent(session.id)}`}
                      className="btn-primary !min-h-9 !px-4 !py-1.5 !text-xs"
                    >
                      Mở tiếp phiên
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => deleteSession(session.id)}
                      aria-label={`Xóa phiên ${session.title}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)]/45 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
