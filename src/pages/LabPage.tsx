import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookMarked,
  BookOpen,
  BrainCircuit,
  Clock,
  Headphones,
  Map as MapIcon,
  Mic,
  MicOff,
  Plus,
  RefreshCw,
  Scale,
  Send,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ArgumentLedger } from '../components/lab/ArgumentLedger';
import { DebateStepperBar, DebateStepperLive } from '../components/lab/DebateStepper5';
import { ThreeLayerResponseCard } from '../components/lab/ThreeLayerResponseCard';
import { WorkspaceShell } from '../components/layout/AppShell';
import { useToast } from '../components/ui/ToastProvider';
import { AiAssistantRobotSvg } from '../components/visuals/EditorialSvgIllustrations';
import { useVoiceDebate } from '../hooks/useVoiceDebate';
import { useApp } from '../lib/AppContext';
import { useRouter, useSearchParams } from '../lib/router';
import {
  consumeLabHandoff,
  loadLabDraft,
  saveLabDraft,
} from '../lib/storage';
import {
  LabApiRequestPayload,
  LabMessage,
  LabSession,
  LabType,
  LedgerEntry,
} from '../lib/types';
import { AIRateLimitError, requestLabAnalysis } from '../services/aiService';

type LabStatus = 'ready' | 'analyzing' | 'responding' | 'rate_limited' | 'network_error';

const CONCEPT_STARTERS = [
  {
    label: 'Tự do vs Tùy tiện',
    prompt:
      'Mình nghĩ tự do là được làm bất cứ điều gì mình thích mà không bị ai cấm đoán.',
  },
  {
    label: 'Ngôn ngữ & Tư duy',
    prompt:
      'Theo bạn, ngôn ngữ chỉ là công cụ diễn đạt suy nghĩ có sẵn, hay chính ngôn ngữ định hình cách ta nghĩ?',
  },
  {
    label: 'Đồng cảm vs Thương hại',
    prompt:
      'Mình hay nhầm giữa "đồng cảm" và "thương hại". Làm sao phân biệt rõ ranh giới hai khái niệm này?',
  },
];

const DEBATE_STARTERS = [
  {
    label: 'Tự do cá nhân & Cộng đồng',
    prompt:
      'Em đồng ý là nên giới hạn tự do cá nhân vì lợi ích cộng đồng, vì nếu ai cũng chỉ nghĩ cho mình thì xã hội sẽ loạn hết.',
  },
  {
    label: 'AI trong học tập THPT',
    prompt:
      'Học sinh dùng AI để hỗ trợ viết bài luận luôn luôn làm giảm khả năng tư duy độc lập.',
  },
  {
    label: 'Lối sống thực dụng',
    prompt:
      'Trong thời đại cạnh tranh, học sinh chỉ nên tập trung vào các môn học mang lại hiệu quả thực dụng ngay lập tức.',
  },
];

/**
 * Computes 3 context-aware Quick Reply Chips positioned directly above the composer
 * based on lab mode and current DebateStepper5 stage (1..5).
 */
function getContextualQuickReplies(labType: LabType, stage: number, hasMessages: boolean): string[] {
  if (!hasMessages) {
    if (labType === 'concept') {
      return [
        'Giúp tôi làm rõ khái niệm này',
        'Cho tôi một phản ví dụ thực tế',
        'So sánh với khái niệm gần nghĩa dễ nhầm',
      ];
    }
    return [
      'Cho tôi một phản ví dụ thực tế',
      'Giúp tôi làm rõ khái niệm này',
      'Tôi muốn bảo vệ quan điểm bằng dẫn chứng',
    ];
  }

  if (labType === 'concept') {
    if (stage <= 2) {
      return [
        'Giúp tôi làm rõ khái niệm này',
        'Cho tôi một phản ví dụ thực tế',
        'Chỉ rõ giả định ngầm trong cách hiểu của tôi',
      ];
    }
    if (stage === 3) {
      return [
        'So sánh với một khái niệm dễ nhầm lẫn',
        'Tôi muốn điều chỉnh lại định nghĩa cho chặt hơn',
        'Cho tôi thêm một tình huống đời thường',
      ];
    }
    return [
      'Tổng kết Bản đồ truy vết tư duy cho phiên này',
      'Kiểm tra xem định nghĩa mới của tôi còn lỗ hổng nào không',
      'Cho tôi một phản ví dụ thực tế',
    ];
  }

  // Debate Lab stage-specific quick reply chips
  if (stage <= 1) {
    return [
      'Giúp tôi làm rõ khái niệm này',
      'Tôi muốn bảo vệ quan điểm bằng dẫn chứng',
      'Cho tôi một phản ví dụ thực tế',
    ];
  }
  if (stage === 2) {
    return [
      'Tôi muốn bảo vệ quan điểm bằng dẫn chứng',
      'Chỉ rõ giả định ngầm trong lập luận của tôi',
      'Cho tôi một phản ví dụ thực tế',
    ];
  }
  if (stage === 3) {
    return [
      'Tôi muốn bảo vệ quan điểm bằng dẫn chứng',
      'Tôi muốn điều chỉnh lại giới hạn lập luận',
      'Giúp tôi làm rõ khái niệm này',
    ];
  }
  return [
    'Tổng kết so sánh sự tiến bộ lập luận của tôi',
    'Thử thách lại lập trường đã điều chỉnh của tôi',
    'Cho tôi một phản ví dụ thực tế',
  ];
}

function createEmptySession(
  labType: LabType,
  resourceContextId?: string,
  title?: string
): LabSession {
  const now = new Date().toISOString();
  return {
    id: `lab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    title:
      title ||
      (labType === 'concept' ? 'Phiên phân tích khái niệm mới' : 'Phiên tranh biện mới'),
    labType,
    resourceContextId,
    messages: [],
    ledger: [],
    coreAssumptions: [],
    contradictions: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function LabPage() {
  const { documents, sessions, upsertSession } = useApp();
  const { showToast } = useToast();
  const { navigate } = useRouter();
  const searchParams = useSearchParams();

  const queryMode = searchParams.get('mode') === 'concept' ? 'concept' : 'debate';
  const querySessionId = searchParams.get('session');
  const queryResourceId = searchParams.get('resource') || undefined;

  const [activeSession, setActiveSession] = useState<LabSession>(() => {
    if (querySessionId) {
      const existing = sessions.find((s) => s.id === querySessionId);
      if (existing) return existing;
    }
    const matchingResource = queryResourceId
      ? documents.find((d) => d.id === queryResourceId)
      : undefined;
    return createEmptySession(
      queryMode,
      queryResourceId,
      matchingResource ? `Tranh biện · ${matchingResource.title}` : undefined
    );
  });

  const [composerText, setComposerText] = useState<string>(() => loadLabDraft(activeSession.id));
  const [status, setStatus] = useState<LabStatus>('ready');
  const [analyzingStep, setAnalyzingStep] = useState<number>(0);
  const [rateLimitState, setRateLimitState] = useState<{
    message: string;
    secondsLeft: number;
  } | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [autosaveNotice, setAutosaveNotice] = useState<string | null>(null);

  // Single unified collapsible right drawer for ArgumentLedger (collapsed by default so chat gets ~80% width)
  const [ledgerOpen, setLedgerOpen] = useState(false);

  // Track which newly received AI message should run the smooth typing reveal effect
  const [latestAnimatedMsgId, setLatestAnimatedMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const submitMessageRef = useRef<
    ((options?: { simulate429?: boolean; overrideText?: string }) => Promise<void>) | null
  >(null);

  // Voice Debate Mode hook (Vietnamese STT + TTS + Hands-free orchestration)
  const voice = useVoiceDebate({
    baseText: composerText,
    onTranscriptChange: (nextText) => {
      setComposerText(nextText);
    },
    onAutoSubmit: (spokenText) => {
      if (spokenText.trim()) {
        void submitMessageRef.current?.({ overrideText: spokenText });
      }
    },
    onNotify: (msg, variant = 'info') => {
      showToast(msg, { variant });
    },
  });

  // Load handoff payload from DocumentDetailPage if present
  useEffect(() => {
    const handoff = consumeLabHandoff();
    if (handoff) {
      const fresh = createEmptySession(
        handoff.labType,
        handoff.resourceContextId,
        `${handoff.labType === 'concept' ? 'Phân tích' : 'Tranh biện'} · ${handoff.resourceTitle}`
      );
      setActiveSession(fresh);
      setLatestAnimatedMsgId(null);

      let promptSeed = '';
      switch (handoff.actionIntent) {
        case 'explain':
          promptSeed = `Từ học liệu "${handoff.resourceTitle}" (${handoff.blockLabel || 'trích đoạn'}): "${handoff.quoteText}" — hãy giúp mình phân tích khái niệm này một cách trực quan và dễ hiểu trước khi đặt câu hỏi gợi mở.`;
          break;
        case 'examples_counterexamples':
          promptSeed = `Với trích đoạn từ "${handoff.resourceTitle}": "${handoff.quoteText}" — hãy gợi ý 1 ví dụ thực tế và 1 phản ví dụ đời thường để kiểm thử ý này.`;
          break;
        case 'guiding_questions':
          promptSeed = `Mình đang đọc "${handoff.resourceTitle}" đoạn "${handoff.quoteText}". Hãy đặt 1 câu hỏi Socrates trọng tâm để mình tự suy ngẫm sâu hơn.`;
          break;
        case 'debate_claim':
          promptSeed = `Từ học liệu "${handoff.resourceTitle}", mình muốn tranh biện nhận định: "${handoff.quoteText}". Theo mình nhận định này hợp lý ở một phần, nhưng hãy thử chỉ ra giả định ngầm hoặc phản ví dụ để kiểm chứng.`;
          break;
        default:
          promptSeed = `Từ học liệu "${handoff.resourceTitle}" (${handoff.blockLabel || 'trích đoạn'}): "${handoff.quoteText}" — mình muốn phân tích kỹ khái niệm và lập luận của đoạn này.`;
      }
      setComposerText(promptSeed);
      saveLabDraft(fresh.id, promptSeed);
      showToast('Đã mang trích đoạn từ Library vào Thinking Lab.', { variant: 'info' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load session when ?session= changes
  useEffect(() => {
    if (!querySessionId) return;
    const found = sessions.find((s) => s.id === querySessionId);
    if (found && found.id !== activeSession.id) {
      setActiveSession(found);
      setLatestAnimatedMsgId(null);
      setComposerText(loadLabDraft(found.id));
      setRateLimitState(null);
      setNetworkError(null);
    }
  }, [querySessionId, sessions, activeSession.id]);

  // Autosave composer draft per session
  useEffect(() => {
    saveLabDraft(activeSession.id, composerText);
  }, [activeSession.id, composerText]);

  // HTTP 429 calm countdown timer
  useEffect(() => {
    if (!rateLimitState || rateLimitState.secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setRateLimitState((prev) => {
        if (!prev) return null;
        if (prev.secondsLeft <= 1) {
          setStatus('ready');
          return null;
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [rateLimitState]);

  const attachedResource = useMemo(
    () =>
      activeSession.resourceContextId
        ? documents.find((d) => d.id === activeSession.resourceContextId) ?? null
        : null,
    [activeSession.resourceContextId, documents]
  );

  // Derive current DebateStepper5 stage (1..5) from user turns
  const currentStage = useMemo(() => {
    const userTurns = activeSession.messages.filter((m) => m.role === 'user').length;
    const lastMsg = activeSession.messages[activeSession.messages.length - 1];
    const hasSummary = Boolean(
      lastMsg?.threeLayer?.interpretation &&
        (lastMsg.threeLayer.interpretation.includes('Bản đồ truy vết tư duy') ||
          lastMsg.threeLayer.interpretation.includes('Lập trường & Luận điểm chính') ||
          lastMsg.threeLayer.interpretation.includes('Khái niệm ban đầu của bạn'))
    );
    if (hasSummary) return 5;
    if (userTurns === 0) return 1;
    return Math.min(userTurns + 1, 5);
  }, [activeSession.messages]);

  const quickReplies = useMemo(
    () =>
      getContextualQuickReplies(
        activeSession.labType,
        currentStage,
        activeSession.messages.length > 0
      ),
    [activeSession.labType, currentStage, activeSession.messages.length]
  );

  const handleModeSwitch = (nextMode: LabType) => {
    if (nextMode === activeSession.labType) return;
    voice.stopSpeaking();
    voice.stopListening();
    if (activeSession.messages.length === 0) {
      setActiveSession((prev) => ({
        ...prev,
        labType: nextMode,
        title:
          nextMode === 'concept' ? 'Phiên phân tích khái niệm mới' : 'Phiên tranh biện mới',
      }));
      return;
    }
    const fresh = createEmptySession(nextMode, activeSession.resourceContextId);
    setActiveSession(fresh);
    setLatestAnimatedMsgId(null);
    setComposerText(loadLabDraft(fresh.id));
    setRateLimitState(null);
    setNetworkError(null);
    showToast(
      `Đã chuyển sang ${nextMode === 'concept' ? 'Concept Lab' : 'Debate Lab'} (phiên mới).`,
      { variant: 'info' }
    );
  };

  const handleStartNewSession = () => {
    voice.stopSpeaking();
    voice.stopListening();
    const fresh = createEmptySession(activeSession.labType);
    setActiveSession(fresh);
    setLatestAnimatedMsgId(null);
    setComposerText('');
    setRateLimitState(null);
    setNetworkError(null);
    setAutosaveNotice(null);
    showToast('Đã khởi tạo phiên đối thoại mới.', { variant: 'info' });
  };

  const handleQuoteToComposer = (prefixText: string) => {
    setComposerText((prev) => (prev.trim() ? `${prev.trim()}\n${prefixText}` : prefixText));
    composerRef.current?.focus();
  };

  const handleQuoteLedgerEntry = (entry: LedgerEntry) => {
    setLedgerOpen(false);
    handleQuoteToComposer(
      `Đối chiếu mốc ${entry.id} ("${entry.claim}"): theo mình có điểm cần làm rõ là `
    );
  };

  const submitMessage = useCallback(
    async (options?: { simulate429?: boolean; overrideText?: string }) => {
      const trimmed = (options?.overrideText ?? composerText).trim();
      if (!trimmed) {
        if (options?.simulate429) {
          const demoDraft =
            'Mọi người đều luôn luôn tự do lựa chọn, nhưng lập luận này cần kiểm tra lại dưới góc nhìn xã hội.';
          setComposerText(demoDraft);
          saveLabDraft(activeSession.id, demoDraft);
        } else {
          return;
        }
      }

      const messageToSend =
        trimmed ||
        'Mọi người đều luôn luôn tự do lựa chọn, nhưng lập luận này cần kiểm tra lại dưới góc nhìn xã hội.';

      if (rateLimitState && rateLimitState.secondsLeft > 0) {
        return;
      }

      // Stop any ongoing voice input/output before sending
      voice.stopListening();
      voice.stopSpeaking();

      setNetworkError(null);
      setAutosaveNotice(null);
      setStatus('analyzing');
      setAnalyzingStep(0);

      const stepInterval = window.setInterval(() => {
        setAnalyzingStep((prev) => (prev < 4 ? prev + 1 : 4));
      }, 240);

      try {
        const payload: LabApiRequestPayload = {
          session_id: activeSession.id,
          lab_type: activeSession.labType,
          message: messageToSend,
          resource_context_id: activeSession.resourceContextId ?? null,
          history: activeSession.messages.map((m) => ({
            role: m.role,
            content: m.threeLayer
              ? `${m.threeLayer.tldr ? `${m.threeLayer.tldr} ` : ''}${m.threeLayer.interpretation}`
              : m.content,
            turnRef: m.turnRef,
          })),
          ledger_snapshot: activeSession.ledger,
          core_assumptions: activeSession.coreAssumptions,
          previous_response_id: activeSession.previousResponseId ?? null,
          simulate_429: options?.simulate429 ?? false,
        };

        const data = await requestLabAnalysis(payload, attachedResource);

        window.clearInterval(stepInterval);
        setStatus('responding');
        setAnalyzingStep(4);

        const userCount = activeSession.ledger.filter((e) => e.speaker === 'user').length + 1;
        const aiCount = activeSession.ledger.filter((e) => e.speaker === 'ai').length + 1;
        const userRef = `U#${userCount}`;
        const aiRef = `A#${aiCount}`;
        const nowIso = new Date().toISOString();
        const aiMsgId = `msg_a_${Date.now().toString(36)}`;

        const userMsg: LabMessage = {
          id: `msg_u_${Date.now().toString(36)}`,
          role: 'user',
          turnRef: userRef,
          content: messageToSend,
          timestamp: nowIso,
        };

        const aiMsg: LabMessage = {
          id: aiMsgId,
          role: 'assistant',
          turnRef: aiRef,
          content: data.ai_claim_summary,
          timestamp: nowIso,
          threeLayer: data.three_layer,
          debateSteps: data.debate_steps,
          sourceEngine: data.source_engine,
          responseId: data.response_id,
        };

        const newLedgerEntries: LedgerEntry[] = [
          {
            id: userRef,
            speaker: 'user',
            turnIndex: userCount,
            claim: data.user_claim_summary,
            assumptions: data.new_assumptions,
            contradictionFlag: data.contradiction_note ?? undefined,
            timestamp: nowIso,
          },
          {
            id: aiRef,
            speaker: 'ai',
            turnIndex: aiCount,
            claim: data.ai_claim_summary,
            assumptions: [],
            timestamp: nowIso,
          },
        ];

        const mergedAssumptions = Array.from(
          new Set([...activeSession.coreAssumptions, ...data.new_assumptions])
        ).slice(0, 8);

        const nextContradictions = data.contradiction_note
          ? [
              ...activeSession.contradictions,
              {
                id: `c_${Date.now().toString(36)}`,
                refA: userRef,
                refB: data.contradiction_ref || 'U#1',
                note: data.contradiction_note,
              },
            ]
          : activeSession.contradictions;

        const updatedSession: LabSession = {
          ...activeSession,
          title:
            activeSession.messages.length === 0 && !attachedResource
              ? messageToSend.slice(0, 62) + (messageToSend.length > 62 ? '…' : '')
              : activeSession.title,
          previousResponseId: data.response_id,
          messages: [...activeSession.messages, userMsg, aiMsg],
          ledger: [...activeSession.ledger, ...newLedgerEntries],
          coreAssumptions: mergedAssumptions,
          contradictions: nextContradictions,
          updatedAt: nowIso,
        };

        setActiveSession(updatedSession);
        setLatestAnimatedMsgId(aiMsgId);
        upsertSession(updatedSession);
        if (!options?.overrideText) {
          setComposerText('');
          saveLabDraft(updatedSession.id, '');
        }
        setRateLimitState(null);
        setStatus('ready');

        window.setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 120);

        // Hands-free Voice Debate Mode: speak the Socratic question, then auto-open mic
        if (voice.handsFreeMode && data.three_layer.guidingQuestion) {
          const spokenReply = [
            data.three_layer.tldr,
            data.three_layer.interpretation,
            data.three_layer.guidingQuestion,
          ]
            .filter(Boolean)
            .join('. ');

          window.setTimeout(() => {
            voice.speakText(spokenReply, aiMsgId, () => {
              // Automatically start listening for the student's reply once AI finishes speaking
              voice.startListening({ clearBeforeStart: true });
            });
          }, 260);
        }
      } catch (err) {
        window.clearInterval(stepInterval);

        if (err instanceof AIRateLimitError) {
          saveLabDraft(activeSession.id, messageToSend);
          setStatus('rate_limited');
          setRateLimitState({
            message: err.message,
            secondsLeft: err.retryAfter,
          });
          showToast(
            `Phòng thí nghiệm tạm nghỉ ${err.retryAfter} giây. Bản thảo của bạn được giữ nguyên.`,
            {
              variant: 'warning',
            }
          );
          return;
        }

        saveLabDraft(activeSession.id, messageToSend);
        setStatus('network_error');
        setNetworkError(
          err instanceof Error
            ? err.message
            : 'Không thể kết nối tới máy chủ. Vui lòng thử lại.'
        );
        setAutosaveNotice('Bản thảo của bạn đã được tự động lưu cục bộ (local autosave).');
        showToast('Kết nối phân tích tạm gián đoạn. Bản thảo đã được tự động lưu cục bộ.', {
          variant: 'error',
        });
      }
    },
    [
      activeSession,
      attachedResource,
      composerText,
      rateLimitState,
      showToast,
      upsertSession,
      voice,
    ]
  );

  useEffect(() => {
    submitMessageRef.current = submitMessage;
  }, [submitMessage]);

  const isBusy = status === 'analyzing' || status === 'responding';
  const isRateCountdownActive = Boolean(rateLimitState && rateLimitState.secondsLeft > 0);
  const starters = activeSession.labType === 'concept' ? CONCEPT_STARTERS : DEBATE_STARTERS;

  return (
    <WorkspaceShell noMainBottomPadding>
      <div className="flex flex-col h-[calc(100dvh-56px-68px)] lg:h-dvh overflow-hidden">
        {/* Top Lab Header: Mode Switcher + Voice Mode Toggle + New Session + Single Unified Sổ tay Button */}
        <header className="shrink-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 sm:px-5 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Left: Segmented Mode Switcher + Compact Session Title */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                role="tablist"
                aria-label="Chuyển đổi giữa Concept Lab và Debate Lab"
                className="inline-flex rounded-xl p-1 border border-[var(--color-border)] bg-[var(--color-bg)] shrink-0"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeSession.labType === 'concept'}
                  onClick={() => handleModeSwitch('concept')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeSession.labType === 'concept'
                      ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <BrainCircuit className="h-3.5 w-3.5" />
                  Concept Lab
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeSession.labType === 'debate'}
                  onClick={() => handleModeSwitch('debate')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeSession.labType === 'debate'
                      ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <Scale className="h-3.5 w-3.5" />
                  Debate Lab
                </button>
              </div>

              <span className="hidden xl:inline-block text-xs font-medium text-[var(--color-text-muted)] truncate max-w-[260px]">
                {activeSession.title}
              </span>
            </div>

            {/* Right Controls: Hands-free Voice Toggle + Phiên mới + SINGLE Unified Sổ tay Button */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={voice.toggleHandsFreeMode}
                aria-pressed={voice.handsFreeMode}
                title="Tự động đọc câu hỏi Socrates và mở Micro lắng nghe câu trả lời của bạn"
                className={`inline-flex items-center gap-1.5 rounded-xl min-h-9 px-3 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                  voice.handsFreeMode
                    ? 'border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_13%,var(--color-surface)_87%)] text-[var(--color-primary)] font-semibold'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]'
                }`}
              >
                <Headphones className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">
                  {voice.handsFreeMode ? 'Rảnh tay: Bật' : 'Tranh biện rảnh tay'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleStartNewSession}
                className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Phiên mới</span>
              </button>

              {/* SINGLE unified Sổ tay (N) button across ALL viewports (Desktop + Tablet + Mobile) */}
              <button
                type="button"
                data-testid="toggle-ledger-btn"
                onClick={() => setLedgerOpen((prev) => !prev)}
                aria-pressed={ledgerOpen}
                aria-expanded={ledgerOpen}
                aria-label="Đóng hoặc mở Sổ tay mạch lập luận"
                className={`inline-flex items-center gap-1.5 rounded-xl min-h-9 px-3 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                  ledgerOpen
                    ? 'border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_13%,var(--color-surface)_87%)] text-[var(--color-primary)] font-semibold'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]'
                }`}
              >
                <BookMarked className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary)]" />
                <span>Sổ tay ({activeSession.ledger.length})</span>
              </button>
            </div>
          </div>

          {/* Attached Library Resource Context Chip */}
          {attachedResource && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-1.5 border border-[var(--color-border)] bg-[var(--color-bg)]/70 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary)]" />
                <span className="text-[var(--color-text-muted)] shrink-0">Học liệu Library:</span>
                <span className="font-medium text-[var(--color-text)] truncate">
                  {attachedResource.title}
                </span>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/library/${attachedResource.id}`, { preserveScroll: true })
                  }
                  className="inline-flex items-center gap-1 font-medium text-[var(--color-primary)] hover:underline whitespace-nowrap cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Quay lại tài liệu
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveSession((prev) => ({ ...prev, resourceContextId: undefined }))
                  }
                  aria-label="Gỡ ngữ cảnh tài liệu"
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Slim Horizontal 5-Step Progress Strip at Top of Chat Frame */}
        <DebateStepperBar
          currentStage={currentStage}
          labType={activeSession.labType}
          isAnalyzing={isBusy}
          analyzingStepIndex={analyzingStep}
        />

        {/* Body Area: Expansive Chat Canvas (75-80%+ width) + Collapsible Right Sổ tay Drawer */}
        <div className="relative flex-1 min-h-0 flex overflow-hidden">
          {/* Center Dialogue Column */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Scrollable Messages Stream */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
              <div className="mx-auto max-w-[800px] space-y-6">
                {activeSession.messages.length === 0 ? (
                  <div className="py-4 sm:py-8 space-y-6">
                    {/* Airy Welcome State inspired by ChatGPT / Gemini */}
                    <div className="rounded-2xl p-6 sm:p-8 surface-card text-center space-y-5">
                      <div className="flex justify-center">
                        <AiAssistantRobotSvg className="h-20 w-20 sm:h-24 sm:w-24" />
                      </div>
                      <div className="space-y-2 max-w-xl mx-auto">
                        <p className="editorial-kicker">
                          {activeSession.labType === 'concept'
                            ? 'Concept Lab · Khám phá khái niệm Socrates'
                            : 'Debate Lab · Tranh biện Socrates & Giọng nói tiếng Việt'}
                        </p>
                        <h1 className="font-display text-2xl sm:text-[2rem] font-semibold text-[var(--color-text)]">
                          {activeSession.labType === 'concept'
                            ? 'Bạn muốn hiểu sâu khái niệm nào hôm nay?'
                            : 'Bạn muốn kiểm chứng quan điểm nào hôm nay?'}
                        </h1>
                        <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
                          Gõ ý kiến của bạn hoặc bấm biểu tượng Micro để nói trực tiếp bằng tiếng Việt. Mỗi lượt mình sẽ phản hồi gọn gàng: công nhận phần hợp lý, soi đúng 1 điểm hở và đặt duy nhất 1 câu hỏi gợi mở.
                        </p>
                      </div>

                      {/* Topic Starter Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-left">
                        {starters.map((starter) => (
                          <button
                            key={starter.label}
                            type="button"
                            onClick={() => {
                              setComposerText(starter.prompt);
                              composerRef.current?.focus();
                            }}
                            className="group rounded-xl p-3.5 border border-[var(--color-border)] bg-[var(--color-bg)]/60 hover:bg-[var(--color-surface)] hover:border-[var(--color-primary)]/45 transition-all cursor-pointer flex flex-col justify-between gap-2"
                          >
                            <span className="text-xs font-semibold text-[var(--color-primary)]">
                              {starter.label}
                            </span>
                            <span className="text-xs leading-relaxed text-[var(--color-text-muted)] line-clamp-3 group-hover:text-[var(--color-text)] transition-colors">
                              “{starter.prompt}”
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  activeSession.messages.map((msg) =>
                    msg.role === 'user' ? (
                      <div key={msg.id} className="flex justify-end">
                        <div className="max-w-[85%] sm:max-w-[74%] rounded-2xl rounded-br-md px-4 sm:px-5 py-3.5 border border-[color-mix(in_srgb,var(--color-primary)_22%,var(--color-border)_78%)] bg-[color-mix(in_srgb,var(--color-primary)_9%,var(--color-surface)_91%)]">
                          <div className="flex items-center justify-end gap-1.5 text-[11px] text-[var(--color-text-muted)] mb-1">
                            <span className="font-mono-num font-semibold text-[var(--color-primary)]">
                              {msg.turnRef || 'Bạn'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>Quan điểm của bạn</span>
                          </div>
                          <p className="font-reading text-[0.98rem] sm:text-[1.02rem] leading-[1.72] text-[var(--color-text)] whitespace-pre-line">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <ThreeLayerResponseCard
                        key={msg.id}
                        message={msg}
                        animateTyping={msg.id === latestAnimatedMsgId}
                        onQuoteToComposer={handleQuoteToComposer}
                        onSpeakMessage={(text, id) => voice.speakText(text, id)}
                        isSpeaking={
                          voice.isSpeaking &&
                          (voice.speakingMessageId === msg.id ||
                            voice.speakingMessageId === `${msg.id}_q`)
                        }
                      />
                    )
                  )
                )}

                {/* Inline Live Analyzing Status */}
                {isBusy && <DebateStepperLive activeIndex={analyzingStep} />}

                {/* Calm HTTP 429 Countdown Banner */}
                {rateLimitState && rateLimitState.secondsLeft > 0 && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="rounded-xl p-4 border flex items-start gap-3"
                    style={{
                      backgroundColor: 'var(--color-warn-bg)',
                      borderColor: 'var(--color-warn-border)',
                    }}
                  >
                    <Clock className="h-4.5 w-4.5 shrink-0 text-[var(--color-gold)] mt-0.5" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[var(--color-text)]">
                          Hệ thống đang tạm nghỉ nhịp phân tích (HTTP 429)
                        </span>
                        <span className="font-mono-num text-xs font-semibold text-[var(--color-primary)]">
                          Còn {rateLimitState.secondsLeft}s
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                        {rateLimitState.message}
                      </p>
                    </div>
                  </div>
                )}

                {/* Network Error Recovery Banner */}
                {networkError && (
                  <div
                    role="alert"
                    className="rounded-xl p-4 border border-[var(--color-danger)]/35 bg-[var(--color-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="h-4.5 w-4.5 shrink-0 text-[var(--color-danger)] mt-0.5" />
                      <div className="text-xs space-y-1">
                        <p className="font-semibold text-[var(--color-text)]">{networkError}</p>
                        {autosaveNotice && (
                          <p className="text-[var(--color-text-muted)]">{autosaveNotice}</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => submitMessage()}
                      className="btn-secondary !min-h-9 !px-3.5 !text-xs shrink-0"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Thử gửi lại
                    </button>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Bottom Composer Dock: 3 Contextual Quick Reply Chips + ChatGPT-style Input Bar with Voice Mic */}
            <div className="shrink-0 border-t border-[var(--color-border)]/80 bg-[var(--color-bg)]/95 backdrop-blur-sm px-3 sm:px-6 lg:px-10 py-3">
              <div className="mx-auto max-w-[800px] space-y-2.5">
                {/* 3 Context-Aware Quick Reply Chips */}
                <div
                  aria-label="Gợi ý phản hồi nhanh"
                  className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5"
                >
                  <Sparkles
                    className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary)]"
                    aria-hidden="true"
                  />
                  {quickReplies.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      disabled={isBusy || isRateCountdownActive}
                      onClick={() => submitMessage({ overrideText: chip })}
                      className="shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] hover:bg-[color-mix(in_srgb,var(--color-primary)_6%,var(--color-surface)_94%)] disabled:opacity-45 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Live Voice Recording Status Strip */}
                <AnimatePresence>
                  {(voice.isListening || voice.isSpeaking || voice.handsFreeMode) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-xs border border-[color-mix(in_srgb,var(--color-primary)_28%,var(--color-border)_72%)] bg-[color-mix(in_srgb,var(--color-primary)_7%,var(--color-surface)_93%)]">
                        <div className="flex items-center gap-2 min-w-0">
                          {voice.isListening ? (
                            <>
                              <span className="flex items-end gap-0.5 h-3.5" aria-hidden="true">
                                <span className="w-0.5 h-2 rounded-full bg-red-500 animate-bounce" />
                                <span className="w-0.5 h-3.5 rounded-full bg-red-500 animate-pulse" />
                                <span className="w-0.5 h-2.5 rounded-full bg-red-500 animate-bounce" />
                              </span>
                              <span className="font-semibold text-red-600 dark:text-red-400">
                                Đang lắng nghe tiếng Việt…
                              </span>
                              {voice.interimTranscript && (
                                <span className="text-[var(--color-text-muted)] truncate">
                                  “{voice.interimTranscript}”
                                </span>
                              )}
                            </>
                          ) : voice.isSpeaking ? (
                            <>
                              <Volume2 className="h-3.5 w-3.5 text-[var(--color-primary)] animate-pulse" />
                              <span className="font-medium text-[var(--color-text)]">
                                Trợ lý Mạch Ngôn đang đọc câu hỏi…
                              </span>
                            </>
                          ) : (
                            <>
                              <Headphones className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                              <span className="text-[var(--color-text-muted)]">
                                Chế độ rảnh tay đang bật: AI đọc xong sẽ tự mở Micro nghe bạn trả lời.
                              </span>
                            </>
                          )}
                        </div>
                        {voice.isSpeaking && (
                          <button
                            type="button"
                            onClick={voice.stopSpeaking}
                            className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
                          >
                            Dừng đọc
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Composer Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitMessage();
                  }}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 sm:p-3 transition-colors focus-within:border-[var(--color-primary)]/60 shadow-2xs"
                >
                  <label htmlFor="lab-composer-textarea" className="sr-only">
                    Nhập hoặc nói quan điểm tranh biện của bạn
                  </label>
                  <textarea
                    ref={composerRef}
                    id="lab-composer-textarea"
                    rows={2}
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        submitMessage();
                      }
                    }}
                    placeholder={
                      voice.isListening
                        ? 'Hãy nói suy nghĩ của bạn bằng tiếng Việt…'
                        : activeSession.labType === 'concept'
                          ? 'Nhập khái niệm hoặc bấm Micro để nói… (Enter để gửi, Shift+Enter xuống dòng)'
                          : 'Trả lời câu hỏi gợi mở hoặc bấm Micro để nói… (Enter để gửi, Shift+Enter xuống dòng)'
                    }
                    className="w-full bg-transparent px-2 py-1 text-sm leading-relaxed text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/75 focus:outline-none resize-none"
                  />

                  <div className="mt-2 pt-2 border-t border-[var(--color-border)]/70 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
                      {activeSession.messages.length >= 2 && (
                        <button
                          type="button"
                          disabled={isBusy || isRateCountdownActive}
                          onClick={() =>
                            submitMessage({
                              overrideText:
                                'Hãy tổng kết phiên học này thành Bản đồ truy vết tư duy giúp mình.',
                            })
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary)] hover:underline disabled:opacity-45 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <MapIcon className="h-3 w-3" />
                          Tổng kết · Bản đồ tư duy
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isBusy || isRateCountdownActive}
                        onClick={() => submitMessage({ simulate429: true })}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] disabled:opacity-45 transition-colors cursor-pointer"
                      >
                        <Clock className="h-3 w-3" />
                        Mô phỏng 429
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Microphone Button (STT vi-VN) with red recording pulse */}
                      <button
                        type="button"
                        onClick={voice.toggleListening}
                        disabled={isBusy || isRateCountdownActive}
                        aria-pressed={voice.isListening}
                        aria-label={
                          voice.isListening
                            ? 'Dừng ghi âm giọng nói'
                            : 'Nói bằng giọng tiếng Việt (Micro)'
                        }
                        title={
                          voice.isListening
                            ? 'Bấm để dừng thu âm'
                            : 'Nói bằng giọng tiếng Việt'
                        }
                        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer disabled:opacity-45 ${
                          voice.isListening
                            ? 'border-red-500 bg-red-500 text-white shadow-sm'
                            : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)]'
                        }`}
                      >
                        {voice.isListening && (
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 rounded-xl border-2 border-red-400 animate-ping opacity-60"
                          />
                        )}
                        {voice.isListening ? (
                          <MicOff className="h-4 w-4 relative z-10" />
                        ) : (
                          <Mic className="h-4 w-4" />
                        )}
                      </button>

                      {/* Primary Send Button */}
                      <button
                        type="submit"
                        disabled={isBusy || isRateCountdownActive || !composerText.trim()}
                        className="btn-primary !min-h-9 !px-4 !py-1.5 !text-xs"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {isBusy
                          ? 'Đang suy luận…'
                          : isRateCountdownActive
                            ? `Chờ ${rateLimitState?.secondsLeft}s`
                            : 'Gửi'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Unified Right Collapsible Drawer for ArgumentLedger (Desktop + Mobile) */}
          <AnimatePresence>
            {ledgerOpen && (
              <>
                {/* Backdrop on smaller screens so clicking outside closes smoothly */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => setLedgerOpen(false)}
                  aria-hidden="true"
                  className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] xl:hidden"
                />

                <motion.aside
                  data-testid="argument-ledger-drawer"
                  aria-label="Sổ tay mạch lập luận"
                  initial={{ x: '100%', opacity: 0.6 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: '100%', opacity: 0.6 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed inset-y-0 right-0 z-40 xl:static xl:z-10 w-[330px] max-w-[88vw] shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col overflow-hidden shadow-lg xl:shadow-none"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/50 shrink-0">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text)]">
                      <BookMarked className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                      Sổ tay mạch lập luận ({activeSession.ledger.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setLedgerOpen(false)}
                      aria-label="Đóng sổ tay mạch lập luận"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] transition-colors cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                    <ArgumentLedger
                      session={activeSession}
                      onQuoteEntry={handleQuoteLedgerEntry}
                    />
                  </div>
                </motion.aside>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </WorkspaceShell>
  );
}
