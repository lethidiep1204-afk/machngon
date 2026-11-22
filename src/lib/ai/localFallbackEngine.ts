import type {
  DebateStepItem,
  LabApiRequestPayload,
  LabApiResponsePayload,
  LedgerEntry,
  LibraryDocument,
} from '../types.ts';
import { normalizeVietnamese } from '../vietnamese.ts';

const ABSOLUTE_MARKERS: Array<{ key: string; label: string }> = [
  { key: 'luon luon', label: 'luôn luôn' },
  { key: 'tat ca', label: 'tất cả' },
  { key: 'khong bao gio', label: 'không bao giờ' },
  { key: 'duy nhat', label: 'duy nhất' },
  { key: 'chac chan 100', label: 'chắc chắn 100%' },
  { key: 'moi nguoi deu', label: 'mọi người đều' },
  { key: 'hien nhien', label: 'hiển nhiên' },
  { key: 'tuyet doi', label: 'tuyệt đối' },
  { key: 'hoan toan dung', label: 'hoàn toàn đúng' },
  { key: 'hoan toan sai', label: 'hoàn toàn sai' },
  { key: 'khong the nao', label: 'không thể nào' },
];

const CONTRADICTION_REFERENCES = [
  'mau thuan',
  'lap luan thu',
  'gia dinh ban dau',
  'luot truoc',
  'ban vua noi',
  'u#',
  'a#',
  'khac voi',
  'tu phu nhan',
];

const STUCK_PHRASES = [
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

const SUMMARY_MARKERS = [
  'tong ket',
  'ban do tu duy',
  'ban do truy vet',
  'tom tat phien',
  'ket thuc phien',
  'tong hop lai',
  'tien bo lap luan',
];

function stripSpokenVietnameseFillers(rawText: string): string {
  if (!rawText) return '';
  let cleaned = rawText
    .replace(/\s+/g, ' ')
    .replace(
      /(?<=^|[\s,.;:!?])(?:kiểu\s+như\s+là|kiểu\s+như|thì\s+em\s+thấy\s+là|thì\s+em\s+thấy|thì\s+mình\s+thấy\s+là|thì\s+mình\s+thấy|à\s+mà|nghĩa\s+là|nói\s+chung\s+là|ý\s+em\s+là|ý\s+mình\s+là|thì\s+là|ừm+|ờm+)(?=$|[\s,.;:!?])[\s,]*/giu,
      ' '
    )
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/^[,.;:\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < 6) return rawText.trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function extractShortSummary(text: string, maxLen = 115): string {
  const cleaned = text.replace(/\s+/g, ' ').replace(/^["“”'\s]+|["“”'\s]+$/g, '').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen).trimEnd()}…`;
}

function detectAbsoluteClaims(message: string): string[] {
  const norm = normalizeVietnamese(message);
  return ABSOLUTE_MARKERS.filter((marker) => norm.includes(marker.key)).map(
    (marker) => marker.label
  );
}

function isStuckMessage(message: string): boolean {
  const norm = normalizeVietnamese(message);
  return norm.length <= 95 && STUCK_PHRASES.some((phrase) => norm.includes(phrase));
}

function isSummaryRequest(message: string): boolean {
  const norm = normalizeVietnamese(message);
  return SUMMARY_MARKERS.some((marker) => norm.includes(marker));
}

function detectReferencedPriorTurn(
  message: string,
  ledger: LedgerEntry[]
): { referencedEntry: LedgerEntry | null; mentionsContradiction: boolean } {
  const norm = normalizeVietnamese(message);
  const mentionsContradiction = CONTRADICTION_REFERENCES.some((k) => norm.includes(k));

  const explicitMatch = message.match(/\b([UA])#(\d+)\b/i);
  if (explicitMatch) {
    const code = `${explicitMatch[1].toUpperCase()}#${explicitMatch[2]}`;
    const found = ledger.find((item) => item.id.toUpperCase() === code) ?? null;
    return { referencedEntry: found, mentionsContradiction };
  }

  const aiEntries = ledger.filter((l) => l.speaker === 'ai');
  const userEntries = ledger.filter((l) => l.speaker === 'user');
  if (norm.includes('thu hai') || norm.includes('thu 2')) {
    return {
      referencedEntry: aiEntries[1] ?? userEntries[1] ?? ledger[1] ?? null,
      mentionsContradiction: true,
    };
  }
  if (norm.includes('dau tien') || norm.includes('ban dau') || norm.includes('thu nhat')) {
    return {
      referencedEntry: ledger[0] ?? null,
      mentionsContradiction,
    };
  }
  if (mentionsContradiction && ledger.length > 0) {
    return {
      referencedEntry: aiEntries[aiEntries.length - 1] ?? ledger[ledger.length - 1],
      mentionsContradiction: true,
    };
  }
  return { referencedEntry: null, mentionsContradiction: false };
}

function inferHiddenAssumptions(message: string, labType: 'concept' | 'debate'): string[] {
  const norm = normalizeVietnamese(message);
  const found: string[] = [];

  if (norm.includes('tu do') || norm.includes('lua chon')) {
    found.push(
      'Tự do cá nhân có thể tách rời khỏi hoàn cảnh thực tế và tác động lên người xung quanh.'
    );
  }
  if (norm.includes('ngon ngu') || norm.includes('tu vung') || norm.includes('an du')) {
    found.push(
      'Lời nói phát ra bên ngoài phản ánh trọn vẹn mọi tầng suy nghĩ bên trong người nói.'
    );
  }
  if (
    norm.includes('cong nghe') ||
    /\bAI\b/.test(message) ||
    norm.includes('tri tue nhan tao') ||
    norm.includes('chatgpt')
  ) {
    found.push(
      'Sử dụng công cụ hỗ trợ (như AI) mặc nhiên đồng nghĩa với việc người học bỏ qua quá trình tự tư duy.'
    );
  }
  if (/\bnen\b/.test(norm) || /\bphai\b/.test(norm) || norm.includes('bat buoc')) {
    found.push(
      'Đã có sẵn một tiêu chuẩn chung về điều "nên/phải" làm mà mọi thành viên đều đồng thuận.'
    );
  }
  if (norm.includes('thuc dung') || norm.includes('hieu qua') || norm.includes('thanh cong')) {
    found.push(
      'Giá trị của một lựa chọn có thể đo trọn vẹn bằng kết quả nhìn thấy ngay trong ngắn hạn.'
    );
  }

  if (found.length === 0) {
    found.push(
      labType === 'concept'
        ? 'Khái niệm này có một ranh giới cố định, không đổi dù đặt trong những tình huống khác nhau.'
        : 'Cùng một tiêu chí đúng/sai có thể áp dụng đồng đều cho mọi hoàn cảnh mà không cần ngoại lệ.'
    );
  }
  return found.slice(0, 2);
}

function buildEverydayExample(message: string, labType: 'concept' | 'debate'): string {
  const norm = normalizeVietnamese(message);
  if (norm.includes('tu do') || norm.includes('tuy tien') || norm.includes('cong dong')) {
    return 'nếu một người bật loa lớn lúc 2 giờ sáng trong khu trọ, họ đang "làm điều mình thích" nhưng lại tước mất quyền nghỉ ngơi của cả xóm';
  }
  if (norm.includes('cong nghe') || /\bAI\b/.test(message) || norm.includes('tri tue nhan tao')) {
    return 'dùng máy tính bỏ túi giúp học sinh bớt sai phép nhân, nhưng người đó vẫn phải tự hiểu cách lập phương trình';
  }
  if (norm.includes('thuc dung') || norm.includes('hieu qua') || norm.includes('diem')) {
    return 'một môn học giúp rèn cách đọc và đặt câu hỏi có thể chưa ra tiền ngay, nhưng lại quyết định khả năng tự học nhiều năm sau';
  }
  if (norm.includes('ngon ngu') || norm.includes('van hoc') || norm.includes('an du')) {
    return 'cùng một câu "bạn làm nhanh ghê" có thể là lời khen thật lòng hoặc lời châm biếm tùy giọng điệu và bối cảnh';
  }
  return labType === 'concept'
    ? 'cùng một quy tắc trong lớp học đôi khi cần hiểu linh hoạt hơn khi đặt vào hoàn cảnh ngoại lệ'
    : 'một quy định có lợi cho đa số đôi khi lại gây bất công cho một nhóm nhỏ có hoàn cảnh đặc biệt';
}

function buildThinkingTraceMap(
  labType: 'concept' | 'debate',
  ledger: LedgerEntry[],
  coreAssumptions: string[],
  resourceDoc?: LibraryDocument | null
): { tldr: string; interpretation: string; guidingQuestion: string; questionHint: string } {
  const userEntries = ledger.filter((e) => e.speaker === 'user');
  const aiEntries = ledger.filter((e) => e.speaker === 'ai');
  const firstClaim = userEntries[0]?.claim || 'Cách hiểu ban đầu bạn đặt ra ở đầu phiên.';
  const latestClaim =
    userEntries.length > 1
      ? userEntries[userEntries.length - 1].claim
      : 'Lập trường đã được làm rõ hơn qua các lượt trao đổi.';
  const keyBoundary =
    coreAssumptions[0] ||
    'Phân biệt giữa phần đã có căn cứ và giả định ngầm phụ thuộc vào bối cảnh thực tế.';
  const counterPoint =
    aiEntries[aiEntries.length - 1]?.claim ||
    'Tình huống biên và góc nhìn trái chiều giúp kiểm thử độ vững của lập luận.';

  if (labType === 'concept') {
    return {
      tldr: `Dưới đây là **Bản đồ truy vết tư duy** tóm tắt bước tiến của bạn qua ${userEntries.length || 1} lượt khám phá khái niệm:`,
      interpretation: [
        `- **Khái niệm ban đầu của bạn:** "${firstClaim}"`,
        `- **Những ranh giới đã làm rõ:** Đã kiểm tra điểm dễ nhầm lẫn (${keyBoundary})${resourceDoc ? ` và đối chiếu với "${resourceDoc.title}"` : ''}.`,
        `- **Định nghĩa sau khi hoàn thiện:** "${latestClaim}"`,
      ].join('\n'),
      guidingQuestion:
        'Nếu phải giải thích lại khái niệm này trong đúng 1 câu ngắn cho một người bạn, bạn sẽ giữ lại điều gì cốt lõi nhất?',
      questionHint: 'Gợi ý: Chốt 1 đặc điểm bản chất nhất kèm ranh giới không thể vượt qua.',
    };
  }

  return {
    tldr: `Dưới đây là **Bản đồ truy vết tư duy** đối chiếu lập trường ban đầu và kết luận sau ${userEntries.length || 1} lượt tranh biện:`,
    interpretation: [
      `- **Lập trường & Luận điểm chính:** Khởi đầu từ "${firstClaim}".`,
      `- **Phản đề đã đối diện:** ${counterPoint}`,
      `- **Bước chuyển trong lập luận:** Tinh chỉnh sang "${latestClaim}" và nhận diện giả định ngầm (${keyBoundary}).`,
      `- **Điểm có thể đào sâu thêm:** Thử tìm 1 dẫn chứng đời thực hoặc trường hợp ngoại lệ mới để tiếp tục kiểm chứng.`,
    ].join('\n'),
    guidingQuestion:
      'Nhìn lại chặng đường từ lượt đầu đến bây giờ, lập luận nào khiến bạn thay đổi hoặc củng cố suy nghĩ nhiều nhất?',
    questionHint: 'Gợi ý: Nêu 1 điều bạn đã điều chỉnh và lý do vì sao.',
  };
}

/**
 * Concise, natural Vietnamese Socratic local fallback engine (~80–130 words per turn):
 * Follows "1 Công nhận + 1 Lỗ hổng/Phản ví dụ + 1 Câu hỏi Socrates duy nhất",
 * strips spoken Vietnamese fillers, syncs with DebateStepper5 (steps 1..5),
 * supports A/B stuck recovery and Bản đồ truy vết tư duy.
 */
export function runLocalFallbackEngine(
  payload: LabApiRequestPayload,
  resourceDoc?: LibraryDocument | null
): LabApiResponsePayload {
  const ledger = payload.ledger_snapshot ?? [];
  const history = payload.history ?? [];
  const rawMessage = payload.message.trim();
  const cleanedMessage = stripSpokenVietnameseFillers(rawMessage);
  const nextUserTurn = ledger.filter((l) => l.speaker === 'user').length + 1;
  const userTurnRef = `U#${nextUserTurn}`;

  const absoluteClaims = detectAbsoluteClaims(cleanedMessage);
  const newAssumptions = inferHiddenAssumptions(cleanedMessage, payload.lab_type);
  const { referencedEntry, mentionsContradiction } = detectReferencedPriorTurn(
    cleanedMessage,
    ledger
  );
  const prevUserMessages = history.filter((m) => m.role === 'user');
  const lastPrevUser = prevUserMessages[prevUserMessages.length - 1]?.content ?? '';
  const stuckNow = isStuckMessage(cleanedMessage);
  const stuckTwiceInARow = stuckNow && isStuckMessage(lastPrevUser);
  const summaryRequested = isSummaryRequest(cleanedMessage);

  const userClaimSummary = extractShortSummary(cleanedMessage, 115);
  const everydayExample = buildEverydayExample(cleanedMessage, payload.lab_type);

  let contradictionNote: string | null = null;
  let contradictionRef: string | null = null;

  if (mentionsContradiction && referencedEntry) {
    contradictionRef = referencedEntry.id;
    contradictionNote = `Đối chiếu ${userTurnRef} với mốc ${referencedEntry.id} ("${extractShortSummary(
      referencedEntry.claim,
      70
    )}").`;
  } else if (absoluteClaims.length > 0 && ledger.length >= 2) {
    const firstUser = ledger.find((e) => e.speaker === 'user');
    if (firstUser) {
      contradictionRef = firstUser.id;
      contradictionNote = `Lượt ${userTurnRef} dùng lối khẳng định tuyệt đối (${absoluteClaims.join(
        ', '
      )}), cần đối chiếu lại giới hạn đặt ra ở ${firstUser.id}.`;
    }
  }

  const factsSummary = resourceDoc
    ? `Điểm tựa học liệu: "${resourceDoc.title}" (${resourceDoc.author}) và ý chính bạn vừa nêu ở ${userTurnRef}.`
    : `Điểm đã có căn cứ: lập trường trực tiếp bạn vừa nêu ở ${userTurnRef} (chưa kèm số liệu hay dẫn chứng độc lập).`;

  const assumptionsSummary = `Giả định ngầm cần kiểm chứng: ${newAssumptions[0]}`;

  let tldr = '';
  let interpretation = '';
  let guidingQuestion = '';
  let questionHint = '';
  let aiClaimSummary = '';

  if (summaryRequested) {
    const mapData = buildThinkingTraceMap(
      payload.lab_type,
      ledger,
      [...(payload.core_assumptions ?? []), ...newAssumptions],
      resourceDoc
    );
    tldr = mapData.tldr;
    interpretation = mapData.interpretation;
    guidingQuestion = mapData.guidingQuestion;
    questionHint = mapData.questionHint;
    aiClaimSummary = 'Tổng kết Bản đồ truy vết tư duy cho toàn bộ phiên học.';
  } else if (stuckTwiceInARow) {
    tldr = 'Không sao cả, dừng lại ở điểm khó này cho thấy bạn đang chạm đúng nút thắt của vấn đề.';
    interpretation = [
      `- **Phương án A (Ưu tiên cá nhân):** Giữ rộng quyền lựa chọn của mỗi người và chỉ đặt giới hạn khi có bằng chứng gây hại trực tiếp (ví dụ: ${everydayExample}).`,
      `- **Phương án B (Ưu tiên hài hòa chung):** Đặt một bộ quy tắc tối thiểu để quyền của người này không xâm phạm quyền cơ bản của người khác.`,
    ].join('\n');
    guidingQuestion =
      'Giữa **Phương án A** và **Phương án B**, bạn thấy hướng nào thuyết phục hơn trong tình huống thực tế và vì sao?';
    questionHint = 'Gợi ý: Chọn A hoặc B rồi nêu 1 lý do gần gũi nhất với bạn.';
    aiClaimSummary = 'Kích hoạt cơ chế gỡ bí với 2 lựa chọn A/B để học sinh tự phân tích.';
  } else if (stuckNow) {
    tldr = 'Điểm này thực ra rất dễ vướng nếu chỉ nhìn ở mức khái niệm trừu tượng.';
    interpretation = `- **Mảnh ghép gợi mở:** Thử thu nhỏ câu chuyện về một tình huống cụ thể (phản ví dụ đời thường): ${everydayExample}.`;
    guidingQuestion =
      'Đặt mình vào tình huống đó, bạn sẽ đồng ý hay phản đối hành động kia dựa trên lý do đầu tiên nào?';
    questionHint = 'Gợi ý: Bắt đầu từ cảm nhận trực giác của bạn rồi nêu 1 lý do ngắn.';
    aiClaimSummary = 'Cung cấp ví dụ đời thường ngắn để học sinh dễ gỡ nút thắt.';
  } else if (mentionsContradiction && referencedEntry) {
    tldr = `Mình **thừa nhận** và cảm ơn bạn đã soi lại mốc **${referencedEntry.id}** — phản biện đó hoàn toàn xác đáng.`;
    interpretation = `- **Điều chỉnh cho chặt hơn:** Mình cần thu hẹp lại nhận định ở ${referencedEntry.id} (giới hạn phạm vi áp dụng theo bối cảnh thực tế thay vì nói chung chung) để giữ đúng mạch đối thoại với bạn.`;
    guidingQuestion =
      'Sau khi thu hẹp điều kiện như vậy, bạn thấy điểm nào trong lập luận của chúng ta vẫn còn lỗ hổng cần kiểm chứng tiếp?';
    questionHint = 'Gợi ý: Chỉ ra 1 ngoại lệ khiến nguyên tắc mới vẫn có thể gãy.';
    aiClaimSummary = `Thừa nhận và điều chỉnh phạm vi lập luận tại mốc ${referencedEntry.id}.`;
  } else if (absoluteClaims.length > 0) {
    const markerLabel = absoluteClaims.map((w) => `"${w}"`).join(', ');
    tldr = `Bạn nêu lập trường rất rõ ràng và dứt khoát ở ${userTurnRef}.`;
    interpretation = `- **Điểm hở do tuyệt đối hóa (${markerLabel}):** Khi khẳng định không chừa ngoại lệ, chỉ cần 1 tình huống đời thường ngược lại là lập luận dễ bị bẻ gãy (ví dụ: ${everydayExample}).`;
    guidingQuestion = `Nếu bỏ từ ${markerLabel} đi, bạn sẽ thêm **điều kiện cụ thể nào** để lập luận của mình đứng vững hơn?`;
    questionHint = 'Gợi ý: Dùng mẫu "Điều này đúng trong trường hợp..., trừ khi...".';
    aiClaimSummary = `Chỉ ra điểm hở do khẳng định tuyệt đối (${markerLabel}) kèm phản ví dụ.`;
  } else if (payload.lab_type === 'concept') {
    if (nextUserTurn === 1) {
      tldr = `Cách diễn đạt của bạn đã chạm đúng một phần lõi của khái niệm (**${extractShortSummary(cleanedMessage, 55)}**).`;
      interpretation = `- **Thử ranh giới bằng tình huống biên (phản ví dụ):** Hãy thử đặt cách hiểu này vào đời sống: ${everydayExample}.`;
      guidingQuestion =
        'Trong tình huống vừa nêu, cách hiểu ban đầu của bạn vẫn giữ nguyên hay cần thêm một ranh giới phân biệt rõ hơn?';
      questionHint = 'Gợi ý: Nêu 1 điều kiện bắt buộc để phân biệt đúng bản chất khái niệm.';
      aiClaimSummary = 'Ghi nhận phần lõi khái niệm và kiểm thử ranh giới bằng phản ví dụ.';
    } else if (nextUserTurn === 2) {
      tldr = 'Bạn đã bắt đầu tách rõ hơn đặc điểm cốt lõi thay vì định nghĩa chung chung.';
      interpretation = `- **Giả định ngầm cần soi kỹ:** Cách hiểu này vẫn đang dựa trên một điều mặc định (${newAssumptions[0]}).`;
      guidingQuestion =
        'Nếu đặt khái niệm này cạnh một khái niệm gần nghĩa dễ nhầm, **một dấu hiệu duy nhất** nào giúp bạn phân biệt dứt khoát hai bên?';
      questionHint = 'Gợi ý: So sánh mục đích hoặc hệ quả thực tế của hai khái niệm.';
      aiClaimSummary = 'Soi giả định ngầm và mời phân biệt với khái niệm gần nghĩa.';
    } else {
      tldr = 'Định nghĩa của bạn đã sắc nét và có ranh giới rõ ràng hơn hẳn lượt đầu.';
      interpretation = `- **Kiểm tra lần cuối:** Điều kiện bạn vừa thêm giúp loại bỏ nhiều trường hợp mơ hồ (tính nhất quán của khái niệm trong nhiều hoàn cảnh khác nhau).`;
      guidingQuestion =
        'Bạn có muốn chốt lại định nghĩa hoàn chỉnh trong 1 câu ngắn để mình lập **Bản đồ truy vết tư duy** không?';
      questionHint = 'Gợi ý: Viết lại định nghĩa trọn vẹn hoặc bấm "Tổng kết · Bản đồ tư duy".';
      aiClaimSummary = 'Ghi nhận định nghĩa đã tinh chỉnh và mời chốt Bản đồ truy vết tư duy.';
    }
  } else {
    // Debate Lab synchronized with 5 stages
    if (nextUserTurn === 1) {
      tldr = `Bạn đã chốt được lập trường rõ ràng ở lượt đầu (**${extractShortSummary(cleanedMessage, 58)}**).`;
      interpretation = `- **Giả định ngầm cần làm rõ:** Lập trường này đang mặc định rằng **${newAssumptions[0]}** (tiền đề chưa được kiểm chứng bằng dẫn chứng cụ thể).`;
      guidingQuestion =
        'Bằng chứng hoặc ví dụ thực tế nào khiến bạn tin tưởng nhất vào lập trường vừa nêu?';
      questionHint = 'Gợi ý: Nêu 1 trải nghiệm thực tế ở trường học hoặc đời sống.';
      aiClaimSummary = 'Ghi nhận lập trường ban đầu và hỏi bằng chứng nền tảng.';
    } else if (nextUserTurn === 2) {
      tldr = 'Lý lẽ bạn vừa bổ sung giúp lập trường có cơ sở cụ thể hơn hẳn.';
      interpretation = `- **Phản ví dụ thử thách (góc nhìn trái chiều):** Tuy nhiên, hãy thử đặt lập luận này vào tình huống thực tế sau: ${everydayExample}.`;
      guidingQuestion =
        'Trước phản ví dụ đó, bạn sẽ bảo vệ quan điểm ban đầu bằng cách nào hay cần điều chỉnh giới hạn của nó?';
      questionHint = 'Gợi ý: Bảo vệ bằng nguyên tắc sâu hơn hoặc thêm ngoại lệ hợp lý.';
      aiClaimSummary = 'Đưa 1 phản ví dụ đời thường để kiểm thử độ bền của lập luận.';
    } else if (nextUserTurn === 3) {
      tldr = 'Bạn đã đối diện trực diện với phản ví dụ thay vì né tránh — đó là điểm mạnh khi tranh biện.';
      interpretation = `- **Điểm cần siết chặt:** Để lập trường không bị phản bác ngược, cần làm rõ **tiêu chí ranh giới** (khi nào nguyên tắc của bạn áp dụng và khi nào nên có ngoại lệ).`;
      guidingQuestion =
        'Nếu một người phản đối hỏi "vậy đâu là giới hạn cụ thể?", bạn sẽ đặt ra **1 tiêu chí rõ ràng** nào?';
      questionHint = 'Gợi ý: Nêu 1 nguyên tắc dễ kiểm chứng thay vì nói chung chung.';
      aiClaimSummary = 'Hỗ trợ học sinh điều chỉnh ranh giới và tiêu chí của lập trường.';
    } else {
      tldr = 'Lập luận của bạn qua các lượt đã chuyển từ cảm tính sang có điều kiện và căn cứ rõ ràng hơn.';
      interpretation = `- **Đối chiếu chặng đường:** Bạn đã giữ được ý lõi từ U#1 nhưng biết thêm giới hạn hợp lý (tư duy phản biện cân bằng giữa nguyên tắc và ngoại lệ thực tế).`;
      guidingQuestion =
        'Bạn muốn tự chốt kết luận cuối cùng trong 1–2 câu để mình tổng kết so sánh tiến bộ cho phiên tranh biện này chứ?';
      questionHint = 'Gợi ý: Tóm tắt quan điểm sau cùng hoặc yêu cầu tổng kết phiên.';
      aiClaimSummary = 'Ghi nhận bước tiến lập luận và mời học sinh tự rút kết luận cuối.';
    }
  }

  const debateSteps: DebateStepItem[] = [
    {
      key: 'identify',
      title: 'Identify',
      vietnameseTitle: 'Lập trường & khái niệm',
      summary: `Nắm ý cốt lõi ở ${userTurnRef}: "${userClaimSummary}".`,
    },
    {
      key: 'analyze',
      title: 'Analyze',
      vietnameseTitle: 'Giả định & bằng chứng',
      summary: `Kiểm tra căn cứ và tách giả định ngầm: ${newAssumptions[0]}`,
    },
    {
      key: 'challenge',
      title: 'Challenge',
      vietnameseTitle: 'Phản ví dụ thử thách',
      summary:
        absoluteClaims.length > 0
          ? `Soi điểm hở từ lối khẳng định tuyệt đối (${absoluteClaims.join(', ')}) bằng phản ví dụ thực tế.`
          : `Đưa tình huống đời thường (${extractShortSummary(everydayExample, 70)}) để thử độ bền lập luận.`,
    },
    {
      key: 'synthesize',
      title: 'Synthesize',
      vietnameseTitle: 'Điều chỉnh quan điểm',
      summary: contradictionNote
        ? `Đối chiếu mạch lập luận: ${contradictionNote}`
        : resourceDoc
          ? `Kết nối với học liệu "${resourceDoc.title}" và ${ledger.length} mốc trong Sổ tay.`
          : `Đồng bộ với ${ledger.length} mốc đã ghi trong Sổ tay mạch lập luận.`,
    },
    {
      key: 'respond',
      title: 'Respond',
      vietnameseTitle: 'Tổng kết & gợi mở',
      summary: `Hoàn thiện phản hồi gọn theo công thức 1 Công nhận + 1 Lỗ hổng + 1 Câu hỏi Socrates duy nhất.`,
    },
  ];

  return {
    session_id: payload.session_id,
    lab_type: payload.lab_type,
    response_id: `resp_local_${payload.session_id.slice(0, 8)}_${Date.now().toString(36)}`,
    source_engine: 'local-fallback',
    user_claim_summary: userClaimSummary,
    ai_claim_summary: aiClaimSummary,
    new_assumptions: newAssumptions,
    contradiction_note: contradictionNote,
    contradiction_ref: contradictionRef,
    debate_steps: debateSteps,
    three_layer: {
      tldr,
      facts: factsSummary,
      assumptions: assumptionsSummary,
      interpretation,
      guidingQuestion,
      questionHint,
    },
  };
}
