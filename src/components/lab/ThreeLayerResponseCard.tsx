import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  CornerDownRight,
  Map as MapIcon,
  Quote,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { LabMessage } from '../../lib/types';
import { DebateStepperAccordion } from './DebateStepper5';

interface ThreeLayerResponseCardProps {
  message: LabMessage;
  onQuoteToComposer: (text: string) => void;
  /** Enable smooth typing/streaming reveal effect for newly received AI messages */
  animateTyping?: boolean;
  /** Callback to speak or stop speaking this AI message via Vietnamese TTS */
  onSpeakMessage?: (textToSpeak: string, messageId: string) => void;
  /** Whether this specific message is currently being spoken aloud */
  isSpeaking?: boolean;
}

/**
 * Renders inline **bold**, *italic*, and `code` Markdown cleanly via React nodes (zero raw HTML).
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
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
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="rounded px-1.5 py-0.5 text-[0.88em] bg-[var(--color-surface-muted)] text-[var(--color-primary)]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

/**
 * Airy Markdown renderer for short paragraphs, bullet lists, and bold emphasis.
 */
function ConversationalMarkdown({
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
      className={`space-y-3 font-reading text-[0.98rem] sm:text-[1.03rem] leading-[1.78] text-[var(--color-text)] ${className}`}
    >
      {blocks.map((block, index) => {
        if (block.type === 'list') {
          return (
            <ul key={index} className="space-y-2 pl-5 list-disc marker:text-[var(--color-primary)]">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="pl-0.5">
                  {renderInlineMarkdown(item)}
                </li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{renderInlineMarkdown(block.text)}</p>;
      })}
    </div>
  );
}

function resolveOpeningText(message: LabMessage): string {
  const layers = message.threeLayer;
  if (!layers) return message.content;
  if (layers.tldr && layers.tldr.trim().length > 0) {
    return layers.tldr.trim();
  }
  if (message.content && message.content.trim().length >= 24) {
    return message.content.trim();
  }
  return '';
}

function isThinkingTraceMap(text: string): boolean {
  return (
    text.includes('Khái niệm ban đầu của bạn') ||
    text.includes('Lập trường & Luận điểm chính') ||
    text.includes('Bản đồ truy vết tư duy')
  );
}

/**
 * ChatGPT / Gemini-inspired minimalist Socratic conversation bubble:
 * - Clean airy body (Markdown paragraphs + bold emphasis + smooth streaming typing effect)
 * - Highlighted editorial blockquote callout for the ONE Socratic closing question
 * - Built-in Vietnamese TTS speaker button in the top-right corner
 * - Optional collapsed drawer for underlying assumptions, evidence, and 5-step trace
 */
export function ThreeLayerResponseCard({
  message,
  onQuoteToComposer,
  animateTyping = false,
  onSpeakMessage,
  isSpeaking = false,
}: ThreeLayerResponseCardProps) {
  const layers = message.threeLayer;
  const [detailsOpen, setDetailsOpen] = useState(false);

  const openingText = useMemo(() => resolveOpeningText(message), [message]);
  const fullBodyText = useMemo(() => {
    if (!layers) return message.content;
    return [openingText, layers.interpretation].filter((s) => s && s.trim().length > 0).join('\n\n');
  }, [layers, message.content, openingText]);

  const fullSpeechText = useMemo(() => {
    if (!layers) return message.content;
    return [openingText, layers.interpretation, layers.guidingQuestion]
      .filter((s) => s && s.trim().length > 0)
      .join('. ');
  }, [layers, message.content, openingText]);

  const isMapCard = useMemo(
    () =>
      Boolean(
        layers &&
          (isThinkingTraceMap(openingText) || isThinkingTraceMap(layers.interpretation))
      ),
    [layers, openingText]
  );

  // Smooth word-chunk streaming effect for newly received AI messages
  const [revealedCount, setRevealedCount] = useState<number>(() =>
    animateTyping ? 0 : fullBodyText.length
  );

  useEffect(() => {
    if (!animateTyping) {
      setRevealedCount(fullBodyText.length);
      return;
    }

    setRevealedCount(0);
    const total = fullBodyText.length;
    if (total === 0) return;

    const stepSize = Math.max(4, Math.ceil(total / 38));
    const timer = window.setInterval(() => {
      setRevealedCount((prev) => {
        if (prev + stepSize >= total) {
          window.clearInterval(timer);
          return total;
        }
        return prev + stepSize;
      });
    }, 18);

    return () => window.clearInterval(timer);
  }, [animateTyping, fullBodyText, message.id]);

  const isStreaming = revealedCount < fullBodyText.length;
  const visibleBodyText = isStreaming ? fullBodyText.slice(0, revealedCount) : fullBodyText;

  const hasDetailsDrawer = Boolean(
    (layers && (layers.assumptions.trim().length > 0 || layers.facts.trim().length > 0)) ||
      (message.debateSteps && message.debateSteps.length > 0)
  );

  return (
    <article
      data-testid="three-layer-card"
      className="group flex items-start gap-3 sm:gap-3.5"
    >
      {/* Minimalist Mentor Avatar */}
      <div
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)] mt-0.5 shadow-2xs"
      >
        <Sparkles className="h-4 w-4" />
      </div>

      {/* Main Conversational Bubble */}
      <div className="flex-1 min-w-0 space-y-3.5">
        {/* Quiet Top Row: Name + Turn Ref + Speaker + Quote */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="font-semibold text-[var(--color-text)]">Trợ lý Mạch Ngôn</span>
            {message.turnRef && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num text-[11px] font-medium text-[var(--color-primary)]">
                  {message.turnRef}
                </span>
              </>
            )}
            {isMapCard && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface)_90%)] text-[var(--color-primary)]">
                <MapIcon className="h-2.5 w-2.5" />
                Bản đồ tư duy
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {onSpeakMessage && (
              <button
                type="button"
                onClick={() => onSpeakMessage(fullSpeechText, message.id)}
                aria-label={isSpeaking ? 'Dừng đọc tin nhắn' : 'Nghe phản hồi bằng giọng nói'}
                title={isSpeaking ? 'Dừng đọc' : 'Nghe lại tin nhắn này'}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  isSpeaking
                    ? 'bg-[color-mix(in_srgb,var(--color-primary)_14%,var(--color-surface)_86%)] text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)]'
                }`}
              >
                {isSpeaking ? (
                  <>
                    <Square className="h-3 w-3 fill-current" />
                    <span className="hidden sm:inline text-[11px]">Dừng</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-[11px]">Nghe</span>
                  </>
                )}
              </button>
            )}

            {message.turnRef && (
              <button
                type="button"
                onClick={() =>
                  onQuoteToComposer(
                    `Về ý ở lượt ${message.turnRef}, mình muốn trao đổi thêm: `
                  )
                }
                aria-label={`Đối chiếu lượt ${message.turnRef}`}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Quote className="h-3 w-3" />
                <span className="hidden sm:inline">Đối chiếu</span>
              </button>
            )}
          </div>
        </div>

        {/* Clean Dialogue Body (with smooth streaming cursor while typing) */}
        <div
          onClick={() => {
            if (isStreaming) setRevealedCount(fullBodyText.length);
          }}
          className={isStreaming ? 'cursor-pointer' : undefined}
        >
          {isMapCard && !isStreaming ? (
            <div className="space-y-3">
              {openingText && <ConversationalMarkdown text={openingText} />}
              {layers?.interpretation && (
                <section
                  aria-label="Bản đồ truy vết tư duy"
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5 space-y-2.5"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
                    <MapIcon className="h-3.5 w-3.5 shrink-0" />
                    <span>Bản đồ truy vết tư duy</span>
                  </div>
                  <ConversationalMarkdown text={layers.interpretation} />
                </section>
              )}
            </div>
          ) : (
            <div className="relative">
              <ConversationalMarkdown text={visibleBodyText} />
              {isStreaming && (
                <span
                  aria-hidden="true"
                  className="inline-block ml-1 h-4 w-1.5 align-middle rounded-full bg-[var(--color-primary)] animate-pulse"
                />
              )}
            </div>
          )}
        </div>

        {/* Highlighted Editorial Callout for the ONE Socratic Closing Question */}
        {layers?.guidingQuestion && !isStreaming && (
          <motion.blockquote
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            aria-label="Câu hỏi Socrates chốt hạ"
            className="rounded-r-xl rounded-l-md border border-[color-mix(in_srgb,var(--color-primary)_26%,var(--color-border)_74%)] border-l-4 border-l-[var(--color-primary)] px-4 py-3.5 sm:px-5 sm:py-4 space-y-2.5"
            style={{
              backgroundColor:
                'color-mix(in srgb, var(--color-primary) 7%, var(--color-surface) 93%)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-wide text-[var(--color-primary)]">
                Câu hỏi gợi mở dành cho bạn
              </span>
              {onSpeakMessage && (
                <button
                  type="button"
                  onClick={() =>
                    onSpeakMessage(layers.guidingQuestion, `${message.id}_q`)
                  }
                  aria-label="Nghe câu hỏi gợi mở"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                >
                  <Volume2 className="h-3 w-3" />
                  <span>Đọc câu hỏi</span>
                </button>
              )}
            </div>

            <p className="font-reading text-[1.02rem] sm:text-[1.07rem] font-semibold leading-[1.68] text-[var(--color-text)]">
              {renderInlineMarkdown(layers.guidingQuestion)}
            </p>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              {layers.questionHint ? (
                <p className="text-xs leading-[1.55] text-[var(--color-text-muted)]">
                  {layers.questionHint}
                </p>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() =>
                  onQuoteToComposer(
                    `Trả lời câu hỏi ở ${message.turnRef || 'lượt trên'}: Theo mình, `
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text)] hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] transition-colors whitespace-nowrap cursor-pointer"
              >
                <CornerDownRight className="h-3 w-3" />
                Trả lời ngay
              </button>
            </div>
          </motion.blockquote>
        )}

        {/* Subtle Progressive Disclosure for Underlying Assumptions & 5-Step Trace */}
        {hasDetailsDrawer && !isStreaming && (
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => setDetailsOpen((prev) => !prev)}
              aria-expanded={detailsOpen}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Compass className="h-3.5 w-3.5 shrink-0" />
              <span>
                {detailsOpen
                  ? 'Ẩn phân tích căn cứ & 5 bước'
                  : 'Soi căn cứ, giả định ngầm & 5 bước'}
              </span>
              {detailsOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            <AnimatePresence initial={false}>
              {detailsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-2.5 space-y-2.5">
                    {layers?.assumptions && (
                      <div
                        className="rounded-xl border border-[var(--color-border)]/80 px-3.5 py-3 space-y-1"
                        style={{
                          backgroundColor:
                            'color-mix(in srgb, var(--color-gold) 7%, var(--color-surface) 93%)',
                        }}
                      >
                        <h4 className="text-[11px] font-semibold text-[var(--color-gold)]">
                          Giả định ngầm cần kiểm chứng
                        </h4>
                        <p className="font-reading text-[0.88rem] leading-[1.65] text-[var(--color-text)]">
                          {layers.assumptions}
                        </p>
                      </div>
                    )}

                    {layers?.facts && (
                      <div className="rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-surface)]/80 px-3.5 py-3 space-y-1">
                        <h4 className="text-[11px] font-semibold text-[var(--color-text-muted)]">
                          Căn cứ &amp; học liệu nền
                        </h4>
                        <p className="font-reading text-[0.88rem] leading-[1.65] text-[var(--color-text)]">
                          {layers.facts}
                        </p>
                      </div>
                    )}

                    {message.debateSteps && message.debateSteps.length > 0 && (
                      <DebateStepperAccordion steps={message.debateSteps} />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </article>
  );
}
