import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((this: SpeechRecognitionLike, ev: Event) => unknown) | null;
  onresult: ((this: SpeechRecognitionLike, ev: SpeechRecognitionEventLike) => unknown) | null;
  onerror: ((this: SpeechRecognitionLike, ev: SpeechRecognitionErrorEventLike) => unknown) | null;
  onend: ((this: SpeechRecognitionLike, ev: Event) => unknown) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

/**
 * Strips Markdown formatting tokens (*, **, #, backticks, bullets, links)
 * so Vietnamese Text-to-Speech reads naturally without pronouncing punctuation artifacts.
 */
export function stripMarkdownForSpeech(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/[~>|]/g, ' ')
    .replace(/\n+/g, '. ')
    .replace(/\.\s*\./g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

function selectBestVietnameseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;
  const viVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('vi'));
  if (viVoices.length === 0) return null;

  const preferredPatterns = [/google/i, /natural/i, /neural/i, /hoaimy|namminh|linh|an/i];
  for (const pattern of preferredPatterns) {
    const match = viVoices.find((v) => pattern.test(v.name));
    if (match) return match;
  }
  const exactLocale = viVoices.find((v) => v.lang.toLowerCase() === 'vi-vn');
  return exactLocale || viVoices[0];
}

export interface UseVoiceDebateOptions {
  /** Base text currently in composer before recording starts */
  baseText: string;
  /** Called continuously as interim and final speech recognition results arrive */
  onTranscriptChange: (nextText: string) => void;
  /** Called when speech finishes and hands-free auto-submit should trigger */
  onAutoSubmit?: (finalText: string) => void;
  /** Safe user notification callback when Web Speech API is unavailable or errors */
  onNotify?: (message: string, variant?: 'info' | 'warning' | 'error') => void;
}

export interface UseVoiceDebateReturn {
  sttSupported: boolean;
  ttsSupported: boolean;
  isListening: boolean;
  interimTranscript: string;
  isSpeaking: boolean;
  speakingMessageId: string | null;
  handsFreeMode: boolean;
  setHandsFreeMode: (enabled: boolean) => void;
  toggleHandsFreeMode: () => void;
  startListening: (options?: { clearBeforeStart?: boolean }) => void;
  stopListening: () => void;
  toggleListening: () => void;
  speakText: (text: string, messageId?: string, onComplete?: () => void) => void;
  stopSpeaking: () => void;
}

export function useVoiceDebate({
  baseText,
  onTranscriptChange,
  onAutoSubmit,
  onNotify,
}: UseVoiceDebateOptions): UseVoiceDebateReturn {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [handsFreeMode, setHandsFreeModeState] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef(baseText);
  const prefixBeforeRecordRef = useRef('');
  const accumulatedFinalRef = useRef('');
  const latestComposedRef = useRef('');
  const handsFreeRef = useRef(handsFreeMode);
  const onTranscriptChangeRef = useRef(onTranscriptChange);
  const onAutoSubmitRef = useRef(onAutoSubmit);
  const onNotifyRef = useRef(onNotify);
  const manualStopRef = useRef(false);

  useEffect(() => {
    baseTextRef.current = baseText;
  }, [baseText]);

  useEffect(() => {
    handsFreeRef.current = handsFreeMode;
  }, [handsFreeMode]);

  useEffect(() => {
    onTranscriptChangeRef.current = onTranscriptChange;
  }, [onTranscriptChange]);

  useEffect(() => {
    onAutoSubmitRef.current = onAutoSubmit;
  }, [onAutoSubmit]);

  useEffect(() => {
    onNotifyRef.current = onNotify;
  }, [onNotify]);

  const sttSupported =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const ttsSupported =
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis !== 'undefined' &&
    typeof window.SpeechSynthesisUtterance !== 'undefined';

  // Load available browser TTS voices (Chrome/Edge populate asynchronously)
  useEffect(() => {
    if (!ttsSupported) return;
    const synth = window.speechSynthesis;
    const syncVoices = () => {
      const list = synth.getVoices();
      if (list.length > 0) setVoices(list);
    };
    syncVoices();
    synth.addEventListener?.('voiceschanged', syncVoices);
    return () => {
      synth.removeEventListener?.('voiceschanged', syncVoices);
    };
  }, [ttsSupported]);

  // Clean up speech recognition and TTS on unmount
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // Ignore cleanup error
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore cleanup error
        }
      }
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore cancel errors
      }
    }
    setIsSpeaking(false);
    setSpeakingMessageId(null);
  }, []);

  const stopListening = useCallback(() => {
    manualStopRef.current = true;
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore stop errors
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const startListening = useCallback(
    (options?: { clearBeforeStart?: boolean }) => {
      if (!sttSupported) {
        onNotifyRef.current?.(
          'Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói (Web Speech API). Bạn có thể dùng Chrome hoặc Edge mới nhất, hoặc tiếp tục gõ văn bản.',
          'warning'
        );
        return;
      }

      // Stop TTS before listening so microphone doesn't pick up AI audio
      stopSpeaking();

      const SpeechCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechCtor) return;

      try {
        recognitionRef.current?.abort();
      } catch {
        // Ignore
      }

      const recognition = new SpeechCtor();
      recognition.lang = 'vi-VN';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      manualStopRef.current = false;
      prefixBeforeRecordRef.current = options?.clearBeforeStart
        ? ''
        : baseTextRef.current.trim();
      accumulatedFinalRef.current = '';
      latestComposedRef.current = prefixBeforeRecordRef.current;

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript('');
      };

      recognition.onresult = (event) => {
        let finalChunk = '';
        let interimChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? '';
          if (result.isFinal) {
            finalChunk += text;
          } else {
            interimChunk += text;
          }
        }

        if (finalChunk.trim()) {
          accumulatedFinalRef.current = `${accumulatedFinalRef.current} ${finalChunk.trim()}`.trim();
        }

        const spoken = `${accumulatedFinalRef.current} ${interimChunk.trim()}`.trim();
        const combined = prefixBeforeRecordRef.current
          ? `${prefixBeforeRecordRef.current} ${spoken}`.trim()
          : spoken;

        setInterimTranscript(interimChunk.trim());
        latestComposedRef.current = combined;
        onTranscriptChangeRef.current(combined);
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        setInterimTranscript('');
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          onNotifyRef.current?.(
            'Trình duyệt chưa được cấp quyền Micro. Hãy bật quyền Micro để dùng chế độ nói tiếng Việt.',
            'warning'
          );
          setHandsFreeModeState(false);
        } else if (event.error === 'no-speech') {
          onNotifyRef.current?.(
            'Chưa nghe rõ giọng nói. Bấm lại biểu tượng Micro khi bạn sẵn sàng nói.',
            'info'
          );
        } else if (event.error !== 'aborted') {
          onNotifyRef.current?.(
            'Nhận diện giọng nói tạm gián đoạn. Bạn có thể thử nói lại hoặc gõ trực tiếp.',
            'warning'
          );
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');

        const spokenText = latestComposedRef.current.trim();
        const hasNewSpeech = accumulatedFinalRef.current.trim().length > 0 || spokenText.length > 0;

        if (handsFreeRef.current && !manualStopRef.current && hasNewSpeech && spokenText) {
          onAutoSubmitRef.current?.(spokenText);
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        setIsListening(false);
        onNotifyRef.current?.(
          'Không thể khởi động Micro ngay lúc này. Hãy thử bấm lại.',
          'warning'
        );
      }
    },
    [sttSupported, stopSpeaking]
  );

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const speakText = useCallback(
    (text: string, messageId?: string, onComplete?: () => void) => {
      if (!ttsSupported) {
        onNotifyRef.current?.(
          'Trình duyệt hiện tại chưa hỗ trợ đọc giọng nói (Speech Synthesis).',
          'warning'
        );
        return;
      }

      const cleanText = stripMarkdownForSpeech(text);
      if (!cleanText) return;

      // Toggle off if clicking the same message currently speaking
      if (isSpeaking && messageId && speakingMessageId === messageId && !onComplete) {
        stopSpeaking();
        return;
      }

      stopSpeaking();

      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'vi-VN';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const availableVoices = voices.length > 0 ? voices : synth.getVoices();
      const viVoice = selectBestVietnameseVoice(availableVoices);
      if (viVoice) {
        utterance.voice = viVoice;
        utterance.lang = viVoice.lang;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        setSpeakingMessageId(messageId ?? '__speech__');
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
        onComplete?.();
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
      };

      try {
        synth.speak(utterance);
      } catch {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
      }
    },
    [isSpeaking, speakingMessageId, stopSpeaking, ttsSupported, voices]
  );

  const setHandsFreeMode = useCallback(
    (enabled: boolean) => {
      if (enabled && (!sttSupported || !ttsSupported)) {
        onNotifyRef.current?.(
          'Chế độ Tranh biện rảnh tay cần trình duyệt hỗ trợ đầy đủ Micro và Loa (Chrome/Edge mới nhất).',
          'warning'
        );
        setHandsFreeModeState(false);
        return;
      }
      if (!enabled) {
        stopListening();
        stopSpeaking();
      }
      setHandsFreeModeState(enabled);
    },
    [sttSupported, ttsSupported, stopListening, stopSpeaking]
  );

  const toggleHandsFreeMode = useCallback(() => {
    setHandsFreeMode(!handsFreeRef.current);
  }, [setHandsFreeMode]);

  return {
    sttSupported,
    ttsSupported,
    isListening,
    interimTranscript,
    isSpeaking,
    speakingMessageId,
    handsFreeMode,
    setHandsFreeMode,
    toggleHandsFreeMode,
    startListening,
    stopListening,
    toggleListening,
    speakText,
    stopSpeaking,
  };
}
