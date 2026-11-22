import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  BookMarked,
  BookOpen,
  BrainCircuit,
  Clock,
  PanelRight,
  Plus,
  RefreshCw,
  Scale,
  Send,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ArgumentLedger } from '../components/lab/ArgumentLedger';
import { DebateStepperLive } from '../components/lab/DebateStepper5';
import { RateLimitBanner } from '../components/lab/RateLimitBanner';
import { ThreeLayerResponseCard } from '../components/lab/ThreeLayerResponseCard';
import { WorkspaceShell } from '../components/layout/AppShell';
import { buildLabIntentPrompt } from '../components/library/LibraryToLabActions';
import { useToast } from '../components/ui/ToastProvider';
import { AiAssistantRobotSvg } from '../components/visuals/EditorialSvgIllustrations';
import { useApp } from '../lib/AppContext';
import { getLabFollowUpDocuments } from '../lib/library/recommendations';
import { Link, useRouter, useSearchParams } from '../lib/router';
import { consumeLabHandoff, loadLabDraft, saveLabDraft } from '../lib/storage';
import {
  LabApiRequestPayload,
  LabApiResponsePayload,
  LabMessage,
  LabSession,
  LabType,
  LedgerEntry,
} from '../lib/types';

type LabStatus =
  | 'ready'
  | 'analyzing'
  | 'responding'
  | 'network_error'
  | 'rate_limited';

const CONCEPT_STARTERS = [
  '“Tự do” trong triết học hiện sinh khác gì với tự do làm bất cứ điều gì mình muốn?',
  'Ngôn ngữ chỉ diễn đạt lại ý nghĩ, hay ngôn ngữ định hình trực tiếp tư duy của chúng ta?',
  'Sự “hàm súc” trong thơ cổ điển khác với sự “mơ hồ khó hiểu” ở tiêu chí nào?',
];

const DEBATE_STARTERS = [
  'Mọi người đều luôn luôn hoàn toàn tự do lựa chọn cuộc đời mình bất kể hoàn cảnh.',
  'Sử dụng AI trong học tập sẽ làm suy giảm hoàn toàn năng lực tư duy độc lập của học sinh.',
  'Trong tranh biện công cộng, áp dụng Nguyên tắc Bác ái đôi khi lại hợp thức hóa lập luận sai lệch.',
];

const QUICK_TOPIC_CHIPS = [
  {
    id: 'van-hoc',
    label: 'Văn học',
    conceptPrompt:
      'Ý nghĩa của thủ pháp “ý tại ngôn ngoại” trong thơ ca cổ điển Việt Nam là gì và nó tác động thế nào đến người đọc?',
    debatePrompt:
      'Đọc tác phẩm văn học cổ điển theo chuẩn “bài văn mẫu” đang làm mất đi khả năng cảm thụ độc lập của học sinh.',
  },
  {
    id: 'triet-hoc',
    label: 'Triết học',
    conceptPrompt:
      'Mệnh đề “hiện hữu có trước bản chất” của Jean-Paul Sartre giải thích mối quan hệ giữa tự do và trách nhiệm ra sao?',
    debatePrompt:
      'Con người hoàn toàn chịu trách nhiệm cho mọi lựa chọn của mình, ngay cả khi bị giới hạn bởi hoàn cảnh xã hội.',
  },
  {
    id: 'xa-hoi',
    label: 'Xã hội',
    conceptPrompt:
      'Các ẩn dụ phổ biến trên truyền thông (như “tranh luận là chiến tranh”) ảnh hưởng thế nào đến đối thoại xã hội?',
    debatePrompt:
      'Trong xã hội số hiện nay, nên ưu tiên lối sống thực dụng để thích nghi hay giữ vững các nguyên tắc giá trị dài hạn?',
  },
] as const;

function createFreshSession(labType: LabType, resourceContextId?: string): LabSession {
  const now = new Date().toISOString();
  return {
    id: `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    title: labType === 'concept' ? 'Phiên Concept Lab mới' : 'Phiên Debate Lab mới',
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
  const { user, documents, publishedDocuments, sessions, upsertSession, layoutPrefs, updateLayoutPrefs } =
    useApp();
  const { showToast } = useToast();
  const { navigate } = useRouter();
  const params = useSearchParams();

  const initialModeParam =
    params.get('mode') === 'concept'
      ? 'concept'
      : params.get('mode') === 'debate'
        ? 'debate'
        : null;
  const sessionParam = params.get('session');
  const resourceParam = params.get('resource');

  const [activeSession, setActiveSession] = useState<LabSession>(() => {
    if (sessionParam) {
      const existing = sessions.find((s) => s.id === sessionParam);
      if (existing) return existing;
    }
    if (resourceParam || initialModeParam) {
      return createFreshSession(initialModeParam ?? 'debate', resourceParam ?? undefined);
    }
    return sessions[0] ?? createFreshSession('debate');
  });

  const [composerText, setComposerText] = useState<string>(() => loadLabDraft(activeSession.id));
  const [status, setStatus] = useState<LabStatus>('ready');
  const [analyzingStep, setAnalyzingStep] = useState(0);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [rateLimitState, setRateLimitState] = useState<{
    message: string;
    secondsLeft: number;
  } | null>(null);
  const [autosaveNotice, setAutosaveNotice] = useState<string | null>(null);

  // Adaptive Ledger panels: >=1440px docked, 1024-1439px slide-over, <1024px bottom sheet
  const [slideOverLedgerOpen, setSlideOverLedgerOpen] = useState(false);
  const [mobileLedgerOpen, setMobileLedgerOpen] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Consume pending Library -> Lab handoff (prefills Composer WITHOUT auto-sending)
  useEffect(() => {
    const handoff = consumeLabHandoff();
    if (!handoff) return;

    const fresh = createFreshSession(handoff.labType, handoff.resourceContextId);
    fresh.title = `${handoff.labType === 'concept' ? 'Khái niệm' : 'Tranh biện'}: ${handoff.resourceTitle}`;
    setActiveSession(fresh);

    const prefill = buildLabIntentPrompt(handoff);
    setComposerText(prefill);
    saveLabDraft(fresh.id, prefill);

    window.setTimeout(() => {
      composerRef.current?.focus();
    }, 120);
  }, []);

  // Sync when URL ?session=... changes
  useEffect(() => {
    if (!sessionParam) return;
    const found = sessions.find((s) => s.id === sessionParam);
    if (found && found.id !== activeSession.id) {
      setActiveSession(found);
      setComposerText(loadLabDraft(found.id));
    }
  }, [sessionParam]);

  // Autosave Composer text locally on every change so no input is ever lost
  useEffect(() => {
    saveLabDraft(activeSession.id, composerText);
  }, [activeSession.id, composerText]);

  // Countdown timer for HTTP 429 Retry-After
  useEffect(() => {
    if (!rateLimitState || rateLimitState.secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setRateLimitState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          secondsLeft: Math.max(0, prev.secondsLeft - 1),
        };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [rateLimitState?.secondsLeft]);

  const attachedResource = useMemo(
    () =>
      activeSession.resourceContextId
        ? documents.find((d) => d.id === activeSession.resourceContextId) ?? null
        : null,
    [documents, activeSession.resourceContextId]
  );

  // Suggest a relevant Library document for further reading via unified recommendations engine
  const suggestedFollowUpDoc = useMemo(() => {
    if (activeSession.messages.length < 2) return null;
    if (user.notifications?.labFollowUpSuggestions === false) return null;
    const recentText = activeSession.messages
      .slice(-3)
      .map((m) => m.content)
      .join(' ');
    return (
      getLabFollowUpDocuments(
        activeSession.resourceContextId,
        recentText,
        publishedDocuments,
        undefined,
        1
      )[0] ?? null
    );
  }, [
    activeSession.messages,
    activeSession.resourceContextId,
    publishedDocuments,
    user.notifications?.labFollowUpSuggestions,
  ]);

  const handleModeSwitch = (nextMode: LabType) => {
    if (activeSession.labType === nextMode) return;
    if (activeSession.messages.length === 0) {
      setActiveSession((prev) => ({
        ...prev,
        labType: nextMode,
        title:
          attachedResource
            ? `${nextMode === 'concept' ? 'Khái niệm' : 'Tranh biện'}: ${attachedResource.title}`
            : nextMode === 'concept'
              ? 'Phiên Concept Lab mới'
              : 'Phiên Debate Lab mới',
      }));
    } else {
      // Preserve existing session and open a fresh one in the chosen Lab mode
      const fresh = createFreshSession(nextMode, activeSession.resourceContextId);
      setActiveSession(fresh);
      setComposerText(loadLabDraft(fresh.id));
    }
    setNetworkError(null);
    setRateLimitState(null);
    setStatus('ready');
  };

  const handleStartNewSession = () => {
    const fresh = createFreshSession(activeSession.labType);
    setActiveSession(fresh);
    setComposerText('');
    setNetworkError(null);
    setRateLimitState(null);
    setStatus('ready');
    navigate(`/lab?mode=${fresh.labType}`, { replace: true });
  };

  const insertQuoteIntoComposer = (snippet: string) => {
    setComposerText((prev) => (prev.trim() ? `${prev.trim()}\n\n${snippet}` : snippet));
    setSlideOverLedgerOpen(false);
    setMobileLedgerOpen(false);
    window.setTimeout(() => composerRef.current?.focus(), 80);
  };

  const handleQuoteLedgerEntry = (entry: LedgerEntry) => {
    insertQuoteIntoComposer(
      `Đối chiếu mốc ${entry.id} ("${entry.claim}"): theo tôi có điểm cần làm rõ là `
    );
  };

  const submitMessage = async (options?: { simulate429?: boolean }) => {
    const trimmed = composerText.trim();
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

    setNetworkError(null);
    setAutosaveNotice(null);
    setStatus('analyzing');
    setAnalyzingStep(0);

    // Smooth visual progression across Identify -> Analyze -> Challenge -> Synthesize -> Respond
    const stepInterval = window.setInterval(() => {
      setAnalyzingStep((prev) => (prev < 4 ? prev + 1 : 4));
    }, 260);

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

      const res = await fetch('/api/lab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      window.clearInterval(stepInterval);

      if (res.status === 429) {
        const retryHeader = Number(res.headers.get('Retry-After') || '10');
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          retry_after?: number;
        };
        const seconds = Number.isFinite(body.retry_after)
          ? Number(body.retry_after)
          : Number.isFinite(retryHeader) && retryHeader > 0
            ? retryHeader
            : 10;

        // Preserve 100% of text in Composer & autosave locally
        saveLabDraft(activeSession.id, messageToSend);
        setStatus('rate_limited');
        setRateLimitState({
          message:
            body.error ||
            'Hệ thống đang tạm nghỉ nhịp phân tích. Toàn bộ văn bản bạn đang gõ vẫn được bảo toàn nguyên vẹn.',
          secondsLeft: seconds,
        });
        showToast(`Phòng thí nghiệm tạm nghỉ ${seconds} giây. Bản thảo của bạn được giữ nguyên.`, {
          variant: 'warning',
        });
        return;
      }

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          errBody.error || 'Kết nối tới máy chủ phân tích bị gián đoạn.'
        );
      }

      setStatus('responding');
      setAnalyzingStep(4);
      const data = (await res.json()) as LabApiResponsePayload;

      const userCount = activeSession.ledger.filter((e) => e.speaker === 'user').length + 1;
      const aiCount = activeSession.ledger.filter((e) => e.speaker === 'ai').length + 1;
      const userRef = `U#${userCount}`;
      const aiRef = `A#${aiCount}`;
      const nowIso = new Date().toISOString();

      const userMsg: LabMessage = {
        id: `msg_u_${Date.now().toString(36)}`,
        role: 'user',
        turnRef: userRef,
        content: messageToSend,
        timestamp: nowIso,
      };

      const aiMsg: LabMessage = {
        id: `msg_a_${Date.now().toString(36)}`,
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
      upsertSession(updatedSession);
      setComposerText('');
      saveLabDraft(updatedSession.id, '');
      setRateLimitState(null);
      setStatus('ready');

      window.setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    } catch (err) {
      window.clearInterval(stepInterval);
      // Autosave local draft on network failure
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
  };

  const isBusy = status === 'analyzing' || status === 'responding';
  const isRateCountdownActive = Boolean(rateLimitState && rateLimitState.secondsLeft > 0);
  const starters = activeSession.labType === 'concept' ? CONCEPT_STARTERS : DEBATE_STARTERS;

  return (
    <WorkspaceShell noMainBottomPadding>
      <div className="flex flex-col h-[calc(100dvh-56px-68px)] lg:h-dvh overflow-hidden">
        {/* Top Lab Header: Mode Switcher + Session Title + Resource Context + Panel Controls */}
        <header className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Concept Lab / Debate Lab Segmented Mode Switcher + Session Title */}
            <div className="flex flex-wrap items-center gap-3 min-w-0">
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
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
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
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    activeSession.labType === 'debate'
                      ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <Scale className="h-3.5 w-3.5" />
                  Debate Lab
                </button>
              </div>

              <div className="hidden md:flex items-center gap-2 min-w-0 text-xs">
                <span className="font-medium text-[var(--color-text)] truncate max-w-[240px] xl:max-w-[340px]">
                  {activeSession.title}
                </span>
                <span aria-hidden="true" className="text-[var(--color-text-muted)]">·</span>
                <span className="text-[var(--color-text-muted)] whitespace-nowrap">
                  {activeSession.labType === 'concept'
                    ? 'Tóm tắt · Giải thích · Câu hỏi mở'
                    : 'Tóm tắt · Phản biện · Câu hỏi mở'}
                </span>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleStartNewSession}
                className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Phiên mới
              </button>

              {/* >=1440px toggle docked Ledger */}
              <button
                type="button"
                onClick={() =>
                  updateLayoutPrefs({ rightPanelOpenDesktop: !layoutPrefs.rightPanelOpenDesktop })
                }
                aria-label="Ẩn hoặc hiện Sổ tay mạch lập luận"
                className="hidden wide:inline-flex btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs"
              >
                <PanelRight className="h-3.5 w-3.5" />
                Sổ tay ({activeSession.ledger.length})
              </button>

              {/* <1024px mobile button to open Argument Ledger Bottom Sheet */}
              <button
                type="button"
                onClick={() => setMobileLedgerOpen(true)}
                className="inline-flex lg:hidden btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs"
              >
                <BookMarked className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                Sổ tay ({activeSession.ledger.length})
              </button>
            </div>
          </div>

          {/* State 5: Attached Resource Context Chip with "Quay lại tài liệu" restoring saved scroll */}
          {attachedResource && (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3.5 py-2 border border-[var(--color-border)] bg-[var(--color-bg)]/70 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary)]" />
                <span className="text-[var(--color-text-muted)] shrink-0">Đang khám phá từ Library:</span>
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
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Laptop 1024px–1439px Right Sticky Tab for Slide-over Argument Ledger */}
        <button
          type="button"
          onClick={() => setSlideOverLedgerOpen(true)}
          aria-label="Mở Sổ tay mạch lập luận"
          className="hidden lg:flex wide:hidden fixed right-0 top-1/2 -translate-y-1/2 z-20 flex-col items-center gap-2 rounded-l-xl border border-r-0 border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-4 text-xs font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] shadow-sm transition-colors"
        >
          <BookMarked className="h-4 w-4 text-[var(--color-primary)]" />
          <span className="[writing-mode:vertical-rl] rotate-180 tracking-wide">
            Sổ tay ({activeSession.ledger.length})
          </span>
        </button>

        {/* Body Area: Center Dialogue Canvas + Right Docked Ledger (>=1440px) */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Center Column */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Scrollable Messages */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 sm:py-8">
              <div className="mx-auto max-w-[740px] space-y-5">
                {activeSession.messages.length === 0 ? (
                  <div className="py-3 sm:py-6 space-y-7">
                    {/* Friendly AI Assistant + Editorial Mode-Specific Greeting */}
                    <div className="rounded-2xl p-6 sm:p-8 surface-card">
                      <div className="text-center mb-6">
                        <p className="editorial-kicker">
                          {activeSession.labType === 'concept'
                            ? 'Phòng phân tích khái niệm'
                            : 'Phòng tranh biện phản biện'}
                        </p>
                        <h1 className="mt-1 font-display text-2xl sm:text-[2rem] font-semibold text-[var(--color-text)]">
                          {activeSession.labType === 'concept' ? 'Concept Lab' : 'Debate Lab'}
                        </h1>
                        <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text-muted)] max-w-prose mx-auto">
                          {activeSession.labType === 'concept'
                            ? 'Giải thích khái niệm bằng ngôn ngữ gần gũi, ví dụ đời thường và 3 lớp dễ đọc lướt.'
                            : 'Tranh luận sắc bén, chỉ rõ điểm hở logic kèm ví dụ thực tế theo 3 lớp ngắn gọn.'}
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
                        <div className="shrink-0">
                          <AiAssistantRobotSvg className="h-24 w-24 sm:h-28 sm:w-28" />
                        </div>

                        {/* Structured Editorial Greeting Bubble */}
                        <div className="relative max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-4 text-center sm:text-left">
                          <span
                            aria-hidden="true"
                            className="hidden sm:block absolute -left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rotate-45 border-l border-b border-[var(--color-border)] bg-[var(--color-bg)]"
                          />
                          <p className="font-display text-lg sm:text-xl font-semibold leading-snug text-[var(--color-text)]">
                            {activeSession.labType === 'concept'
                              ? 'Bạn muốn làm rõ khái niệm nào hôm nay?'
                              : 'Hãy nêu một quan điểm để cùng tranh luận!'}
                          </p>
                          <p className="mt-1.5 text-xs leading-[1.6] text-[var(--color-text-muted)]">
                            {activeSession.labType === 'concept'
                              ? 'Mỗi câu trả lời đều tách 3 phần: Tóm tắt ý chính, Phân tích có ví dụ và Câu hỏi cho bạn.'
                              : 'Mình sẽ tóm tắt nhanh, chỉ ra điểm hở kèm ví dụ gần gũi rồi đặt 1 câu hỏi sắc nét để bạn phản hồi.'}
                          </p>
                        </div>
                      </div>

                      {/* Quick Topic Chips (Văn học, Triết học, Xã hội) */}
                      <div className="mt-6 pt-5 border-t border-[var(--color-border)]/80">
                        <div className="flex flex-wrap items-center justify-center gap-2.5">
                          <span className="text-xs font-medium text-[var(--color-text-muted)] mr-1">
                            Chủ đề nhanh:
                          </span>
                          {QUICK_TOPIC_CHIPS.map((topic) => {
                            const active = selectedTopicId === topic.id;
                            return (
                              <button
                                key={topic.id}
                                type="button"
                                aria-pressed={active}
                                onClick={() => {
                                  setSelectedTopicId(topic.id);
                                  const prompt =
                                    activeSession.labType === 'concept'
                                      ? topic.conceptPrompt
                                      : topic.debatePrompt;
                                  setComposerText(prompt);
                                  composerRef.current?.focus();
                                }}
                                className={`rounded-full px-4 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap ${
                                  active
                                    ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]'
                                    : 'bg-[var(--color-bg)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-primary)]/55 hover:text-[var(--color-primary)]'
                                }`}
                              >
                                {topic.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Starter Prompt Suggestions */}
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-[var(--color-text-muted)]">
                        Câu hỏi gợi ý (chọn để điền vào khung soạn thảo):
                      </div>
                      <div className="grid grid-cols-1 gap-2.5">
                        {starters.map((prompt, idx) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => {
                              setSelectedTopicId(null);
                              setComposerText(prompt);
                              composerRef.current?.focus();
                            }}
                            className="group flex items-start justify-between gap-3 text-left rounded-xl px-4 py-3.5 border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/50 transition-colors"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <span className="font-mono-num text-[11px] font-semibold text-[var(--color-primary)] mt-1 shrink-0">
                                0{idx + 1}
                              </span>
                              <span className="font-reading text-sm leading-relaxed text-[var(--color-text)]">
                                {prompt}
                              </span>
                            </div>
                            <ArrowUpRight className="h-4 w-4 shrink-0 mt-0.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  activeSession.messages.map((msg) =>
                    msg.role === 'user' ? (
                      <div key={msg.id} className="flex justify-end">
                        <article className="max-w-[90%] sm:max-w-[82%] rounded-2xl px-5 py-4 border border-[var(--color-border)] bg-[var(--color-surface-muted)]/55">
                          <div className="flex items-center gap-2 text-[11px] font-mono-num font-semibold text-[var(--color-primary)] mb-1.5">
                            <span>{msg.turnRef || 'Bạn'}</span>
                            <span aria-hidden="true" className="text-[var(--color-text-muted)]">·</span>
                            <span className="font-ui font-medium text-[var(--color-text-muted)]">
                              Quan điểm của bạn
                            </span>
                          </div>
                          <p className="max-w-prose font-reading text-[0.96rem] sm:text-[1rem] leading-[1.7] whitespace-pre-wrap text-[var(--color-text)]">
                            {msg.content}
                          </p>
                        </article>
                      </div>
                    ) : (
                      <ThreeLayerResponseCard
                        key={msg.id}
                        message={msg}
                        onQuoteToComposer={insertQuoteIntoComposer}
                      />
                    )
                  )
                )}

                {isBusy && <DebateStepperLive activeIndex={analyzingStep} />}

                {/* Subtle follow-up Library reading suggestion after dialogue turns */}
                {!isBusy && suggestedFollowUpDoc && (
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BookOpen className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                      <div className="min-w-0 text-xs">
                        <span className="text-[var(--color-text-muted)]">Gợi ý đọc tiếp trong Library: </span>
                        <span className="font-semibold text-[var(--color-text)]">
                          {suggestedFollowUpDoc.title}
                        </span>
                      </div>
                    </div>
                    <Link
                      to={`/library/${suggestedFollowUpDoc.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline whitespace-nowrap shrink-0"
                    >
                      Mở tài liệu
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Bottom Pinned Composer with HTTP 429 Banner & Network Retry */}
            <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 sm:px-6 pt-3 pb-3 safe-pb">
              <div className="mx-auto max-w-[740px]">
                {/* State 6: HTTP 429 Rate Limit Calm Countdown Banner */}
                {rateLimitState && (
                  <RateLimitBanner
                    message={rateLimitState.message}
                    secondsLeft={rateLimitState.secondsLeft}
                    onRetryNow={() => {
                      setRateLimitState(null);
                      submitMessage();
                    }}
                  />
                )}

                {/* State 4: Network Error Banner with Retry & Local Autosave Confirmation */}
                {networkError && (
                  <div
                    role="alert"
                    className="mb-3 rounded-xl px-4 py-3 border flex flex-wrap items-center justify-between gap-3 text-xs"
                    style={{
                      backgroundColor: 'var(--color-warn-bg)',
                      borderColor: 'var(--color-warn-border)',
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--color-danger)]" />
                      <div>
                        <div className="font-semibold">{networkError}</div>
                        {autosaveNotice && (
                          <div className="mt-0.5 text-[var(--color-text-muted)]">
                            {autosaveNotice}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => submitMessage()}
                      className="btn-primary !min-h-8 !px-3 !py-1 !text-xs"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Thử lại
                    </button>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitMessage();
                  }}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/65 p-3 focus-within:border-[var(--color-primary)] focus-within:bg-[var(--color-surface)] transition-colors"
                >
                  <label htmlFor="lab-composer-textarea" className="sr-only">
                    Nhập câu hỏi hoặc luận điểm của bạn
                  </label>
                  <textarea
                    ref={composerRef}
                    id="lab-composer-textarea"
                    rows={3}
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        submitMessage();
                      }
                    }}
                    placeholder={
                      activeSession.labType === 'concept'
                        ? 'Nhập khái niệm hoặc câu hỏi bạn muốn hiểu rõ hơn... (Ctrl/Cmd + Enter để gửi)'
                        : 'Nhập quan điểm của bạn hoặc phản hồi câu hỏi phía trên... (Ctrl/Cmd + Enter để gửi)'
                    }
                    className="w-full bg-transparent px-1.5 py-1 text-sm leading-relaxed text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/75 focus:outline-none resize-none"
                  />

                  <div className="mt-2 pt-2.5 border-t border-[var(--color-border)]/75 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
                      <span>Tự động lưu bản thảo cục bộ</span>
                      <button
                        type="button"
                        disabled={isBusy || isRateCountdownActive}
                        onClick={() => submitMessage({ simulate429: true })}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] disabled:opacity-45 transition-colors"
                      >
                        <Clock className="h-3 w-3" />
                        Mô phỏng HTTP 429
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isBusy || isRateCountdownActive || !composerText.trim()}
                      className="btn-primary !min-h-9 !px-4 !py-1.5 !text-xs"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {isBusy
                        ? 'Đang phân tích…'
                        : isRateCountdownActive
                          ? `Chờ ${rateLimitState?.secondsLeft}s`
                          : 'Gửi phân tích'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Right Docked Column: Sổ tay mạch lập luận (>= 1440px when open) */}
          {layoutPrefs.rightPanelOpenDesktop && (
            <aside
              aria-label="Sổ tay mạch lập luận"
              className="hidden wide:block w-[340px] shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)] p-5 overflow-y-auto"
            >
              <ArgumentLedger
                session={activeSession}
                onQuoteEntry={handleQuoteLedgerEntry}
              />
            </aside>
          )}
        </div>
      </div>

      {/* Laptop 1024px–1439px Slide-over Argument Ledger */}
      <AnimatePresence>
        {slideOverLedgerOpen && (
          <div className="fixed inset-0 z-50 hidden lg:block wide:hidden" role="dialog" aria-modal="true" aria-label="Sổ tay mạch lập luận">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSlideOverLedgerOpen(false)}
              className="fixed inset-0 bg-black/35 backdrop-blur-[1px]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 right-0 z-10 w-[360px] bg-[var(--color-surface)] border-l border-[var(--color-border)] p-5 overflow-y-auto"
              style={{ boxShadow: 'var(--shadow-float)' }}
            >
              <div className="flex justify-end mb-2">
                <button
                  type="button"
                  onClick={() => setSlideOverLedgerOpen(false)}
                  aria-label="Đóng sổ tay mạch lập luận"
                  className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--color-surface-muted)]"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
              <ArgumentLedger
                session={activeSession}
                onQuoteEntry={handleQuoteLedgerEntry}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Sheet for Argument Ledger */}
      <AnimatePresence>
        {mobileLedgerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Sổ tay mạch lập luận">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileLedgerOpen(false)}
              className="fixed inset-0 bg-black/45"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-0 bottom-0 z-10 max-h-[80dvh] overflow-y-auto rounded-t-2xl border-t border-[var(--color-border)] bg-[var(--color-surface)] p-5 safe-pb"
            >
              <div className="flex justify-end mb-1">
                <button
                  type="button"
                  onClick={() => setMobileLedgerOpen(false)}
                  aria-label="Đóng sổ tay"
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ArgumentLedger
                session={activeSession}
                onQuoteEntry={handleQuoteLedgerEntry}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </WorkspaceShell>
  );
}
