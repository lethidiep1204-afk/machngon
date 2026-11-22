import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, CornerDownRight, HelpCircle, Layers, Quote } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { LabMessage } from '../../lib/types';
import { DebateStepperAccordion } from './DebateStepper5';

interface ThreeLayerResponseCardProps {
  message: LabMessage;
  onQuoteToComposer: (text: string) => void;
}

/**
 * Renders inline **bold** and *italic* emphasis using pure React nodes (zero raw HTML injection).
 */
function renderInlineEmphasis(text: string): React.ReactNode[] {
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[var(--color-text)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

/**
 * Converts plain or lightly structured markdown text (paragraphs + "- " / "• " bullets + **bold**)
 * into scannable semantic typography blocks with comfortable line-height and measure.
 */
function FormattedScannableText({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  const blocks = useMemo(() => {
    const rawLines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const parsed: Array<{ type: 'list'; items: string[] } | { type: 'paragraph'; text: string }> =
      [];

    for (const line of rawLines) {
      const bulletMatch = line.match(/^(?:[-•*]|\d+[.)])\s+(.+)$/);
      if (bulletMatch) {
        const prev = parsed[parsed.length - 1];
        if (prev && prev.type === 'list') {
          prev.items.push(bulletMatch[1].trim());
        } else {
          parsed.push({ type: 'list', items: [bulletMatch[1].trim()] });
        }
      } else {
        parsed.push({ type: 'paragraph', text: line });
      }
    }

    return parsed;
  }, [text]);

  if (blocks.length === 0) return null;

  return (
    <div
      className={`max-w-prose space-y-2.5 font-reading text-[0.96rem] sm:text-[1rem] leading-[1.7] text-[var(--color-text)] ${className}`}
    >
      {blocks.map((block, index) => {
        if (block.type === 'list') {
          return (
            <ul key={index} className="space-y-2 pl-4 list-disc marker:text-[var(--color-primary)]">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="pl-1">
                  {renderInlineEmphasis(item)}
                </li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{renderInlineEmphasis(block.text)}</p>;
      })}
    </div>
  );
}

/**
 * Backward-compatible TL;DR extractor for older stored messages that predate the `tldr` field.
 */
function resolveTldrText(message: LabMessage): string {
  const layers = message.threeLayer;
  if (!layers) return message.content;
  if (layers.tldr && layers.tldr.trim().length > 0) {
    return layers.tldr.trim();
  }
  if (message.content && message.content.trim().length >= 24) {
    return message.content.trim();
  }
  const firstSentence = layers.interpretation
    .replace(/\*\*/g, '')
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(' ')
    .trim();
  return firstSentence || layers.interpretation.slice(0, 200);
}

export function ThreeLayerResponseCard({
  message,
  onQuoteToComposer,
}: ThreeLayerResponseCardProps) {
  const layers = message.threeLayer;

  // Compute total analysis length so long Layer 2 responses stay uncluttered via progressive disclosure
  const totalAnalysisChars = layers
    ? layers.interpretation.length + layers.assumptions.length + layers.facts.length
    : 0;
  const isLongAnalysis = totalAnalysisChars > 360;

  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [extraContextOpen, setExtraContextOpen] = useState(!isLongAnalysis);

  const tldrText = useMemo(() => resolveTldrText(message), [message]);
  const hasExtraSubsections = Boolean(
    layers && (layers.assumptions.trim().length > 0 || layers.facts.trim().length > 0)
  );

  return (
    <article
      data-testid="three-layer-card"
      className="rounded-2xl p-5 sm:p-7 surface-card space-y-5"
    >
      {/* Quiet Editorial Header Metadata */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center gap-2">
          <span className="font-mono-num font-semibold text-[var(--color-primary)]">
            {message.turnRef || 'AI'}
          </span>
          <span aria-hidden="true">·</span>
          <span>Phản hồi 3 lớp dễ hiểu</span>
        </div>
        {message.turnRef && (
          <button
            type="button"
            onClick={() =>
              onQuoteToComposer(
                `Về ý ở lượt ${message.turnRef}, mình muốn trao đổi thêm điểm sau: `
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] transition-colors whitespace-nowrap"
          >
            <Quote className="h-3.5 w-3.5" />
            Đối chiếu {message.turnRef}
          </button>
        )}
      </div>

      {/* Collapsible 5-Step Thinking Trace */}
      {message.debateSteps && message.debateSteps.length > 0 && (
        <DebateStepperAccordion steps={message.debateSteps} />
      )}

      {layers ? (
        <div className="space-y-4">
          {/* LAYER 1: Tóm tắt ý chính (TL;DR — always visible & prominent) */}
          <section
            aria-label="Tóm tắt ý chính"
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/70 p-4 sm:p-5 space-y-2"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-primary)]">
              <span className="font-mono-num">01</span>
              <span aria-hidden="true">·</span>
              <h3>Tóm tắt ý chính</h3>
            </div>
            <FormattedScannableText
              text={tldrText}
              className="!text-[1rem] sm:!text-[1.04rem] !leading-[1.68]"
            />
          </section>

          {/* LAYER 2: Phân tích chi tiết (Scannable bullets + smooth progressive disclosure) */}
          <section
            aria-label="Phân tích chi tiết"
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-[var(--color-border)]/80 bg-[var(--color-bg)]/35">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text)]">
                <Layers className="h-3.5 w-3.5 text-[var(--color-primary)] shrink-0" />
                <span className="font-mono-num text-[var(--color-text-muted)]">02</span>
                <span aria-hidden="true" className="text-[var(--color-text-muted)]">
                  ·
                </span>
                <h3>Phân tích chi tiết</h3>
              </div>

              <button
                type="button"
                onClick={() => setAnalysisOpen((prev) => !prev)}
                aria-expanded={analysisOpen}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] transition-colors whitespace-nowrap"
              >
                <span>{analysisOpen ? 'Thu gọn' : 'Mở phân tích'}</span>
                {analysisOpen ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            <AnimatePresence initial={false}>
              {analysisOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Primary scannable critique + everyday example */}
                    {layers.interpretation && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-[var(--color-text-muted)]">
                          Góc nhìn phản biện &amp; ví dụ gần gũi
                        </h4>
                        <FormattedScannableText text={layers.interpretation} />
                      </div>
                    )}

                    {/* Progressive Disclosure for Hidden Assumptions & Objective Facts */}
                    {hasExtraSubsections && (
                      <div className="pt-3 border-t border-[var(--color-border)]/80 space-y-3">
                        <button
                          type="button"
                          onClick={() => setExtraContextOpen((prev) => !prev)}
                          aria-expanded={extraContextOpen}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)] hover:underline whitespace-nowrap"
                        >
                          <span>
                            {extraContextOpen
                              ? 'Ẩn phần giả định ngầm & cơ sở dữ kiện'
                              : 'Xem thêm: Giả định ngầm & cơ sở dữ kiện'}
                          </span>
                          {extraContextOpen ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>

                        <AnimatePresence initial={false}>
                          {extraContextOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden space-y-4"
                            >
                              {layers.assumptions && (
                                <div
                                  className="rounded-lg border border-[var(--color-border)]/80 p-3.5 sm:p-4 space-y-1.5"
                                  style={{
                                    backgroundColor:
                                      'color-mix(in srgb, var(--color-gold) 8%, var(--color-surface) 92%)',
                                  }}
                                >
                                  <h4 className="text-xs font-semibold text-[var(--color-gold)]">
                                    Điều đang ngầm giả định
                                  </h4>
                                  <FormattedScannableText
                                    text={layers.assumptions}
                                    className="!text-[0.93rem] !leading-[1.68]"
                                  />
                                </div>
                              )}

                              {layers.facts && (
                                <div className="rounded-lg border border-[var(--color-border)]/80 bg-[var(--color-bg)]/45 p-3.5 sm:p-4 space-y-1.5">
                                  <h4 className="text-xs font-semibold text-[var(--color-text-muted)]">
                                    Cơ sở &amp; dữ kiện liên quan
                                  </h4>
                                  <FormattedScannableText
                                    text={layers.facts}
                                    className="!text-[0.93rem] !leading-[1.68]"
                                  />
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* LAYER 3: Câu hỏi cho bạn (Next Step — always visible & prominent) */}
          {layers.guidingQuestion && (
            <section
              aria-label="Câu hỏi cho bạn"
              className="rounded-xl border border-[var(--color-border)] p-4 sm:p-5 space-y-3"
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--color-primary) 6%, var(--color-surface) 94%)',
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)] mt-0.5">
                  <HelpCircle className="h-4 w-4" />
                </div>
                <div className="space-y-1.5 min-w-0 max-w-prose">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-primary)]">
                    <span className="font-mono-num">03</span>
                    <span aria-hidden="true">·</span>
                    <h3>Câu hỏi cho bạn</h3>
                  </div>
                  <p className="font-reading text-[0.98rem] sm:text-[1.04rem] font-medium leading-[1.68] text-[var(--color-text)]">
                    {renderInlineEmphasis(layers.guidingQuestion)}
                  </p>
                  {layers.questionHint && (
                    <p className="text-xs leading-[1.6] text-[var(--color-text-muted)]">
                      {layers.questionHint}
                    </p>
                  )}
                </div>
              </div>

              <div className="pl-10">
                <button
                  type="button"
                  onClick={() =>
                    onQuoteToComposer(
                      `Trả lời câu hỏi ở ${message.turnRef || 'lượt trên'}: Theo mình, `
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] transition-colors whitespace-nowrap"
                >
                  <CornerDownRight className="h-3.5 w-3.5" />
                  Trả lời câu hỏi này
                </button>
              </div>
            </section>
          )}
        </div>
      ) : (
        <FormattedScannableText text={message.content} />
      )}
    </article>
  );
}
