import React from 'react';
import { AlertTriangle, BookMarked, Quote } from 'lucide-react';
import { LabSession, LedgerEntry } from '../../lib/types';

interface ArgumentLedgerProps {
  session: LabSession;
  onQuoteEntry: (entry: LedgerEntry) => void;
  hideTitle?: boolean;
}

export function ArgumentLedger({
  session,
  onQuoteEntry,
  hideTitle = false,
}: ArgumentLedgerProps) {
  return (
    <div className="space-y-5">
      {hideTitle ? (
        <p className="text-xs leading-[1.6] text-[var(--color-text-muted)]">
          Tóm tắt ngắn từng lượt trao đổi (U#n của bạn · A#n của AI) và những điều đang ngầm giả định để dễ đối chiếu.
        </p>
      ) : (
        <div className="pb-3.5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2 font-display text-base font-semibold text-[var(--color-text)]">
            <BookMarked className="h-4 w-4 text-[var(--color-primary)] shrink-0" />
            <h2>Sổ tay mạch lập luận</h2>
          </div>
          <p className="mt-1.5 text-xs leading-[1.6] text-[var(--color-text-muted)]">
            Tóm tắt ngắn từng lượt trao đổi (U#n của bạn · A#n của AI) và những điều đang ngầm giả định để dễ đối chiếu.
          </p>
        </div>
      )}

      {/* Core Assumptions */}
      <section className="rounded-xl p-4 surface-subtle">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-[var(--color-text)]">
            Điều đang ngầm giả định
          </h3>
          <span className="font-mono-num text-[11px] text-[var(--color-text-muted)]">
            {session.coreAssumptions.length}
          </span>
        </div>
        {session.coreAssumptions.length === 0 ? (
          <p className="mt-2 text-xs leading-[1.6] text-[var(--color-text-muted)]">
            Sẽ tự động ghi lại khi bạn gửi ý kiến đầu tiên.
          </p>
        ) : (
          <ul className="mt-2.5 space-y-2.5">
            {session.coreAssumptions.map((assumption, idx) => (
              <li
                key={idx}
                className="text-xs leading-[1.65] text-[var(--color-text)] flex items-start gap-2"
              >
                <span className="font-mono-num text-[11px] text-[var(--color-gold)] font-semibold shrink-0 mt-0.5">
                  GĐ{idx + 1}.
                </span>
                <span className="font-reading text-[0.84rem] leading-[1.65]">{assumption}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Contradiction Flags */}
      {session.contradictions.length > 0 && (
        <section
          className="rounded-xl p-4 border"
          style={{
            backgroundColor: 'var(--color-warn-bg)',
            borderColor: 'var(--color-warn-border)',
          }}
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text)]">
            <AlertTriangle className="h-4 w-4 text-[var(--color-gold)] shrink-0" />
            <span>Điểm cần đối chiếu lại ({session.contradictions.length})</span>
          </div>
          <ul className="mt-2.5 space-y-2.5">
            {session.contradictions.map((flag) => (
              <li key={flag.id} className="text-xs leading-[1.65] text-[var(--color-text)]">
                <span className="font-mono-num font-semibold text-[var(--color-primary)]">
                  {flag.refA} ↔ {flag.refB}:
                </span>{' '}
                <span className="font-reading text-[0.84rem]">{flag.note}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Numbered Turn Claims */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)]">
            Tóm tắt các lượt
          </h3>
          <span className="font-mono-num text-[11px] text-[var(--color-text-muted)]">
            {session.ledger.length} lượt
          </span>
        </div>
        {session.ledger.length === 0 ? (
          <div className="rounded-xl p-5 border border-dashed border-[var(--color-border)] bg-[var(--color-bg)]/35 text-xs leading-[1.6] text-[var(--color-text-muted)] text-center">
            Chưa có lượt trao đổi nào trong phiên này.
          </div>
        ) : (
          <ul className="space-y-2.5">
            {session.ledger.map((entry) => (
              <li
                key={entry.id}
                className={`rounded-xl p-3.5 border border-[var(--color-border)] space-y-2 transition-colors ${
                  entry.speaker === 'user'
                    ? 'bg-[var(--color-bg)]/55'
                    : 'bg-[var(--color-surface)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-mono-num text-[11px] font-semibold ${
                      entry.speaker === 'user'
                        ? 'text-[var(--color-primary)]'
                        : 'text-[var(--color-text-muted)]'
                    }`}
                  >
                    {entry.id} · {entry.speaker === 'user' ? 'Bạn' : 'Trợ lý Lab'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onQuoteEntry(entry)}
                    aria-label={`Trích dẫn mốc ${entry.id} vào ô soạn thảo`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] transition-colors whitespace-nowrap"
                  >
                    <Quote className="h-3 w-3" />
                    Trích dẫn
                  </button>
                </div>
                <p className="font-reading text-[0.84rem] leading-[1.65] text-[var(--color-text)]">
                  {entry.claim}
                </p>
                {entry.contradictionFlag && (
                  <p className="text-[11px] leading-[1.6] text-[var(--color-danger)] pt-1.5 border-t border-[var(--color-border)]/70">
                    Lưu ý: {entry.contradictionFlag}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
