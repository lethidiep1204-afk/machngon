import type {
  DebateStepItem,
  LabApiRequestPayload,
  ThreeLayerResponse,
} from '../types.ts';

export const GEMINI_LAB_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    user_claim_summary: { type: 'STRING' },
    ai_claim_summary: { type: 'STRING' },
    new_assumptions: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    contradiction_note: { type: 'STRING', nullable: true },
    contradiction_ref: { type: 'STRING', nullable: true },
    debate_steps: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          key: { type: 'STRING' },
          title: { type: 'STRING' },
          vietnameseTitle: { type: 'STRING' },
          summary: { type: 'STRING' },
        },
        required: ['key', 'title', 'vietnameseTitle', 'summary'],
      },
    },
    three_layer: {
      type: 'OBJECT',
      properties: {
        tldr: { type: 'STRING' },
        facts: { type: 'STRING' },
        assumptions: { type: 'STRING' },
        interpretation: { type: 'STRING' },
        guidingQuestion: { type: 'STRING' },
        questionHint: { type: 'STRING' },
      },
      required: ['tldr', 'facts', 'assumptions', 'interpretation', 'guidingQuestion'],
    },
  },
  required: [
    'user_claim_summary',
    'ai_claim_summary',
    'new_assumptions',
    'debate_steps',
    'three_layer',
  ],
} as const;

const DEBATE_STAGE_GUIDANCE: Record<number, { label: string; directive: string }> = {
  1: {
    label: 'Bước 1/5 — Xác định lập trường & làm rõ khái niệm cốt lõi',
    directive:
      'Tập trung ghi nhận lập trường/cách hiểu hiện tại, chốt khái niệm trọng tâm và hỏi đúng 1 câu làm rõ ranh giới khái niệm.',
  },
  2: {
    label: 'Bước 2/5 — Kiểm tra giả định & bằng chứng',
    directive:
      'Ghi nhận lý lẽ hợp lý, chỉ ra đúng 1 giả định ngầm hoặc điểm thiếu bằng chứng và hỏi đúng 1 câu kiểm chứng căn cứ.',
  },
  3: {
    label: 'Bước 3/5 — Đưa phản ví dụ thực tế để thử thách lập luận',
    directive:
      'Ghi nhận nỗ lực lập luận, đưa đúng 1 phản ví dụ đời thường sắc bén để kiểm thử độ bền và hỏi đúng 1 câu xem lập luận có còn đứng vững không.',
  },
  4: {
    label: 'Bước 4/5 — Hỗ trợ học sinh điều chỉnh quan điểm',
    directive:
      'Ghi nhận cách học sinh phản hồi trước phản ví dụ, chỉ ra điểm cần siết chặt điều kiện áp dụng và hỏi đúng 1 câu giúp họ hoàn thiện lập trường.',
  },
  5: {
    label: 'Bước 5/5 — Tổng kết so sánh sự tiến bộ lập luận',
    directive:
      'Tổng kết đối chiếu giữa lập trường ban đầu (U#1) và kết luận hiện tại theo Bản đồ truy vết tư duy, kết bằng đúng 1 câu hỏi mở nhẹ để đào sâu tiếp.',
  },
};

/**
 * Removes common Vietnamese spoken-language filler phrases (e.g. from Voice STT)
 * without distorting the student's actual core claim.
 */
export function cleanSpokenVietnameseFillers(rawText: string): string {
  if (!rawText) return '';
  let cleaned = rawText.replace(/\s+/g, ' ').trim();

  const fillerPatterns: RegExp[] = [
    /\b(?:kiểu\s+như\s+là|kiểu\s+như|thì\s+em\s+thấy\s+là|thì\s+em\s+thấy|thì\s+mình\s+thấy\s+là|thì\s+mình\s+thấy|à\s+mà|nghĩa\s+là|nói\s+chung\s+là|ý\s+em\s+là|ý\s+mình\s+là|thì\s+là|ừm+|ờm+|à+)\b[\s,]*/giu,
  ];

  for (const pattern of fillerPatterns) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  cleaned = cleaned
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/^[,.;:\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < 6) {
    return rawText.trim();
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Maps current conversation turn count and summary intent to DebateStepper5 stage (1..5).
 */
export function computeDebateStage(userTurnCount: number, isSummary: boolean): number {
  if (isSummary) return 5;
  if (userTurnCount <= 1) return 1;
  if (userTurnCount === 2) return 2;
  if (userTurnCount === 3) return 3;
  if (userTurnCount === 4) return 4;
  return 5;
}

function isStuckReply(text: string): boolean {
  const lower = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
  if (lower.length === 0) return false;
  const stuckPhrases = [
    'khong biet',
    'ko biet',
    'k biet',
    'em chiu',
    'minh chiu',
    'bo tay',
    'bi y tuong',
    'bi qua',
    'chua nghi ra',
    'khong nghi ra',
    'kho qua',
    'em khong ro',
    'minh khong ro',
  ];
  return stuckPhrases.some((phrase) => lower.includes(phrase)) && lower.length <= 90;
}

function isSummaryMapRequest(text: string): boolean {
  const lower = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
  return [
    'tong ket',
    'ban do tu duy',
    'ban do truy vet',
    'tom tat phien',
    'ket thuc phien',
    'tong hop lai',
    'tien bo lap luan',
  ].some((k) => lower.includes(k));
}

export function buildConversationContextPrompt(payload: LabApiRequestPayload): string {
  const parts: string[] = [];
  const userTurnCount =
    (payload.history?.filter((m) => m.role === 'user').length ?? 0) + 1;

  const prevUserMessages = (payload.history ?? []).filter((m) => m.role === 'user');
  const lastPrevUser = prevUserMessages[prevUserMessages.length - 1]?.content ?? '';
  const stuckTwiceInARow = isStuckReply(payload.message) && isStuckReply(lastPrevUser);
  const summaryRequested = isSummaryMapRequest(payload.message);
  const currentStage = computeDebateStage(userTurnCount, summaryRequested);
  const stageMeta = DEBATE_STAGE_GUIDANCE[currentStage];
  const cleanedMessage = cleanSpokenVietnameseFillers(payload.message);

  parts.push(
    `TRẠNG THÁI PHIÊN: Chế độ ${payload.lab_type === 'concept' ? 'Concept Lab (Khám phá khái niệm)' : 'Debate Lab (Tranh biện Socrates)'} · Lượt học sinh thứ ${userTurnCount} · ${stageMeta.label}.`
  );
  parts.push(`NHỊP DẪN DẮT HIỆN TẠI: ${stageMeta.directive}`);

  if (stuckTwiceInARow) {
    parts.push(
      `TÍN HIỆU GỠ BÍ (BẮT BUỘC): Học sinh đang bí ý tưởng hoặc nói "không biết" liên tiếp 2 lần. Hãy kích hoạt **Cơ chế gỡ bí**: đưa đúng **2 phương án/góc nhìn gợi ý (Phương án A hoặc Phương án B)** thật ngắn gọn để học sinh chọn và giải thích lý do.`
    );
  } else if (isStuckReply(payload.message)) {
    parts.push(
      `LƯU Ý ĐỒNG HÀNH: Học sinh vừa bày tỏ chưa nghĩ ra ở lần đầu. Hãy gợi 1 mảnh kiến thức nền ngắn gọn (1–2 câu) kèm 1 ví dụ đời thường rồi hỏi 1 câu thật dễ tiếp cận.`
    );
  }

  if (summaryRequested) {
    parts.push(
      `YÊU CẦU TỔNG KẾT PHIÊN HỌC (BẮT BUỘC): Tổng hợp thành **Bản đồ truy vết tư duy** so sánh lập trường/khái niệm ban đầu với bước tiến hiện tại dựa trên Sổ tay lập luận trong trường \`interpretation\`, kết bằng đúng 1 câu hỏi mở nhẹ.`
    );
  }

  if (payload.core_assumptions && payload.core_assumptions.length > 0) {
    parts.push(
      `GIẢ ĐỊNH BAN ĐẦU CỦA PHIÊN:\n${payload.core_assumptions.map((a, i) => `- GĐ${i + 1}: ${a}`).join('\n')}`
    );
  }

  if (payload.ledger_snapshot && payload.ledger_snapshot.length > 0) {
    const recentLedger = payload.ledger_snapshot.slice(-16);
    parts.push(
      `SỔ TAY MẠCH LẬP LUẬN:\n${recentLedger
        .map((item) => `- ${item.id}: ${item.claim}`)
        .join('\n')}`
    );
  }

  if (payload.history && payload.history.length > 0) {
    const recentTurns = payload.history.slice(-12);
    parts.push(
      `LỊCH SỬ TRAO ĐỔI GẦN ĐÂY:\n${recentTurns
        .map((m) => `${m.turnRef ?? m.role}: ${m.content.slice(0, 320)}`)
        .join('\n')}`
    );
  }

  if (cleanedMessage !== payload.message.trim()) {
    parts.push(
      `PHÁT BIỂU MỚI NHẤT CỦA HỌC SINH (đã lọc từ đệm khẩu ngữ để dễ nắm ý lõi):\n- Nguyên văn: ${payload.message}\n- Ý lõi: ${cleanedMessage}`
    );
  } else {
    parts.push(`PHÁT BIỂU MỚI NHẤT CỦA HỌC SINH:\n${payload.message}`);
  }

  parts.push(
    `BẮT BUỘC: Tuân thủ công thức "1 Công nhận (tldr) + 1 Lỗ hổng/Phản ví dụ (interpretation) + 1 Câu hỏi Socrates duy nhất (guidingQuestion)", tổng độ dài phần hiển thị (tldr + interpretation + guidingQuestion) gọn trong 80–130 từ, không hỏi dồn nhiều câu, không chào hỏi sáo rỗng.`
  );

  return parts.join('\n\n');
}

export function normalizeDebateSteps(steps: DebateStepItem[] | undefined): DebateStepItem[] {
  const requiredOrder: Array<{
    key: DebateStepItem['key'];
    title: string;
    vietnameseTitle: string;
  }> = [
    { key: 'identify', title: 'Identify', vietnameseTitle: 'Lập trường & khái niệm' },
    { key: 'analyze', title: 'Analyze', vietnameseTitle: 'Giả định & bằng chứng' },
    { key: 'challenge', title: 'Challenge', vietnameseTitle: 'Phản ví dụ thử thách' },
    { key: 'synthesize', title: 'Synthesize', vietnameseTitle: 'Điều chỉnh quan điểm' },
    { key: 'respond', title: 'Respond', vietnameseTitle: 'Tổng kết & gợi mở' },
  ];

  return requiredOrder.map((meta) => {
    const found = steps?.find((s) => s.key === meta.key);
    return {
      key: meta.key,
      title: meta.title,
      vietnameseTitle: meta.vietnameseTitle,
      summary:
        found?.summary?.trim() || `Hoàn tất bước ${meta.vietnameseTitle} cho lập luận hiện tại.`,
    };
  });
}

function deriveFallbackTldr(
  rawTldr: unknown,
  aiClaimSummary: string,
  interpretation: string
): string {
  if (typeof rawTldr === 'string' && rawTldr.trim().length > 0) {
    return rawTldr.trim();
  }
  const cleanSummary = aiClaimSummary.trim();
  if (cleanSummary.length >= 24) {
    return cleanSummary;
  }
  const firstLine = interpretation
    .replace(/\*\*/g, '')
    .split(/\n+/)
    .map((line) => line.replace(/^[-•]\s*/, '').trim())
    .find(Boolean);
  return firstLine
    ? firstLine.slice(0, 220)
    : 'Bạn đã nêu được một ý chính rõ ràng để chúng ta cùng kiểm chứng phạm vi áp dụng.';
}

export function normalizeThreeLayer(
  raw: Partial<ThreeLayerResponse> | undefined,
  aiClaimSummary: string
): ThreeLayerResponse {
  const facts = typeof raw?.facts === 'string' ? raw.facts.trim() : '';
  const assumptions = typeof raw?.assumptions === 'string' ? raw.assumptions.trim() : '';
  const interpretation = typeof raw?.interpretation === 'string' ? raw.interpretation.trim() : '';
  const guidingQuestion =
    typeof raw?.guidingQuestion === 'string' ? raw.guidingQuestion.trim() : '';
  const questionHint =
    typeof raw?.questionHint === 'string' && raw.questionHint.trim().length > 0
      ? raw.questionHint.trim()
      : undefined;

  return {
    tldr: deriveFallbackTldr(raw?.tldr, aiClaimSummary, interpretation),
    facts,
    assumptions,
    interpretation,
    guidingQuestion,
    questionHint,
  };
}
