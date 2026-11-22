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

function detectReferencedPriorTurn(
  message: string,
  ledger: LedgerEntry[]
): { referencedEntry: LedgerEntry | null; mentionsContradiction: boolean } {
  const norm = normalizeVietnamese(message);
  const mentionsContradiction = CONTRADICTION_REFERENCES.some((k) => norm.includes(k));

  // Explicit U#n or A#n reference
  const explicitMatch = message.match(/\b([UA])#(\d+)\b/i);
  if (explicitMatch) {
    const code = `${explicitMatch[1].toUpperCase()}#${explicitMatch[2]}`;
    const found = ledger.find((item) => item.id.toUpperCase() === code) ?? null;
    return { referencedEntry: found, mentionsContradiction };
  }

  // Ordinal reference like "lập luận thứ hai" or "lập luận đầu tiên"
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
      'Mọi người đều có điều kiện sống và thông tin ngang nhau để tự chọn hướng đi cho mình.'
    );
  }
  if (norm.includes('ngon ngu') || norm.includes('tu vung') || norm.includes('an du')) {
    found.push(
      'Cách một người nói ra bằng lời phản ánh trọn vẹn mọi điều họ đang nghĩ trong đầu.'
    );
  }
  if (norm.includes('cong nghe') || norm.includes('ai') || norm.includes('tri tue nhan tao')) {
    found.push(
      'Dùng công cụ hỗ trợ (như AI) tự động đồng nghĩa với việc người học bỏ qua khâu tự suy nghĩ.'
    );
  }
  if (norm.includes('nen') || norm.includes('phai') || norm.includes('bat buoc')) {
    found.push(
      'Tồn tại một tiêu chuẩn chung về điều "nên/phải" làm mà ai cũng mặc nhiên đồng ý.'
    );
  }
  if (norm.includes('thuc dung') || norm.includes('hieu qua') || norm.includes('thanh cong')) {
    found.push(
      'Giá trị của một quyết định có thể đo trọn vẹn bằng kết quả nhìn thấy ngay trong ngắn hạn.'
    );
  }

  if (found.length === 0) {
    found.push(
      labType === 'concept'
        ? 'Khái niệm này có một định nghĩa cố định, ít thay đổi dù đặt trong hoàn cảnh nào.'
        : 'Cùng một quy tắc đánh giá đúng/sai có thể áp dụng y hệt cho mọi hoàn cảnh và ngoại lệ.'
    );
  }
  return found.slice(0, 2);
}

function pickEverydayExample(message: string, labType: 'concept' | 'debate'): string {
  const norm = normalizeVietnamese(message);

  if (norm.includes('tu do') || norm.includes('lua chon')) {
    return 'Một học sinh sinh ra ở vùng thiếu trường lớp và tài chính vẫn có quyền mơ ước, nhưng rõ ràng không có nhiều lựa chọn thực tế như bạn cùng trang lứa ở thành phố lớn.';
  }
  if (norm.includes('ai') || norm.includes('tri tue nhan tao') || norm.includes('cong nghe')) {
    return 'Giống như máy tính bỏ túi: học sinh bấm máy để chép đáp án sẽ yếu tính nhẩm, nhưng dùng máy để kiểm tra lại bài toán khó lại học nhanh và sâu hơn.';
  }
  if (norm.includes('ngon ngu') || norm.includes('an du') || norm.includes('tu vung')) {
    return 'Nhiều lúc ta cảm thấy rất rõ một nỗi buồn hay một ý tưởng hay trong đầu, nhưng phải loay hoay mãi mới tìm được từ tiếng Việt diễn đạt đúng ý đó.';
  }
  if (norm.includes('tho') || norm.includes('van hoc') || norm.includes('van mau')) {
    return 'Cùng đọc một bài thơ bốn câu về mùa thu, người lớn tuổi thấy nỗi hoài niệm, còn học sinh lại thấy cảm giác háo hức ngày tựu trường.';
  }
  if (norm.includes('thuc dung') || norm.includes('thanh cong')) {
    return 'Chọn ngành học chỉ vì lương khởi điểm cao có thể lợi trước mắt, nhưng dễ hụt hơi sau vài năm nếu hoàn toàn không hợp sở trường.';
  }

  return labType === 'concept'
    ? 'Giống như từ "công bằng": chia đều mỗi người một chiếc ghế cao bằng nhau trông có vẻ đều, nhưng lại không giúp người thấp hơn nhìn qua hàng rào.'
    : 'Chẳng hạn quy tắc "uống nhiều nước luôn tốt cho sức khỏe" nghe rất đúng, nhưng với người đang suy thận nặng hoặc uống quá mức trong một giờ lại có thể gây nguy hiểm.';
}

/**
 * Local analytical engine running immediately when no external API key is present.
 * Produces UX-first, scannable Vietnamese 3-layer responses with plain-language explanations,
 * everyday examples, 5-step reasoning traces, and multi-turn Argument Ledger tracking.
 */
export function runLocalFallbackEngine(
  payload: LabApiRequestPayload,
  resourceDoc?: LibraryDocument | null
): LabApiResponsePayload {
  const { session_id, lab_type, message, ledger_snapshot = [], core_assumptions = [] } = payload;
  const trimmed = message.trim();
  const userTurnNum = ledger_snapshot.filter((e) => e.speaker === 'user').length + 1;
  const aiTurnNum = ledger_snapshot.filter((e) => e.speaker === 'ai').length + 1;
  const absolutes = detectAbsoluteClaims(trimmed);
  const { referencedEntry, mentionsContradiction } = detectReferencedPriorTurn(
    trimmed,
    ledger_snapshot
  );
  const newAssumptions = inferHiddenAssumptions(trimmed, lab_type);
  const everydayExample = pickEverydayExample(trimmed, lab_type);

  const userSummary = extractShortSummary(trimmed, 120);
  const contextLine = resourceDoc
    ? `Đang đối chiếu với tài liệu "${resourceDoc.title}" (${resourceDoc.author}).`
    : 'Phiên đang chạy độc lập, chưa gắn tài liệu cụ thể từ Thư viện.';

  const hasLongMemory = ledger_snapshot.length >= 2;
  const firstAssumption = core_assumptions[0] ?? ledger_snapshot[0]?.assumptions?.[0];

  let contradictionNote: string | null = null;
  let contradictionRef: string | null = null;

  if (mentionsContradiction && referencedEntry) {
    contradictionRef = referencedEntry.id;
    contradictionNote = `Cần đối chiếu lại ${referencedEntry.id} ("${extractShortSummary(referencedEntry.claim, 64)}"): có điểm vênh về điều kiện áp dụng giữa hai lượt.`;
  } else if (absolutes.length > 0 && hasLongMemory) {
    contradictionRef = ledger_snapshot[0]?.id ?? null;
    contradictionNote = `Câu vừa rồi dùng cách nói tuyệt đối ("${absolutes.join(', ')}"), dễ xung đột với phạm vi đã thống nhất ở ${ledger_snapshot[0]?.id ?? 'lượt đầu'}.`;
  }

  // Step 1: Identify
  const identifyText =
    lab_type === 'concept'
      ? `Chốt khái niệm cần bàn ở lượt U#${userTurnNum}: "${userSummary}". Mục tiêu là phân rõ bản chất và ranh giới dễ nhầm.`
      : `Chốt luận điểm chính ở lượt U#${userTurnNum}: "${userSummary}".${
          absolutes.length > 0
            ? ` Phát hiện từ ngữ khẳng định tuyệt đối ("${absolutes.join('", "')}").`
            : ' Cần kiểm tra xem lập luận có đứng vững trước ngoại lệ hay không.'
        }`;

  // Step 2: Analyze
  const analyzeText =
    mentionsContradiction && referencedEntry
      ? `Đối chiếu lại mốc ${referencedEntry.id} ("${extractShortSummary(referencedEntry.claim, 72)}")${firstAssumption ? ` với giả định ban đầu ("${extractShortSummary(firstAssumption, 68)}")` : ''}. Tách rõ đâu là chỗ mình diễn đạt quá rộng và đâu là mâu thuẫn thật.`
      : `Hiểu ý bạn theo hướng hợp lý nhất (Nguyên tắc Bác ái), sau đó gọi tên điều đang ngầm giả định: ${newAssumptions[0]}`;

  // Step 3: Challenge
  const challengeText =
    lab_type === 'concept'
      ? `Đưa ra một tình huống nằm sát ranh giới (trường hợp biên) để kiểm tra xem định nghĩa hiện tại có đủ rõ để phân biệt đúng – sai không.`
      : absolutes.length > 0
        ? `Thử thách cách nói tuyệt đối ("${absolutes[0]}") bằng lỗi Khái quát hóa vội vã (vơ đũa cả nắm): chỉ cần 1 ngoại lệ thực tế là mệnh đề cần thu hẹp lại.`
        : `Nêu góc nhìn ngược lại cùng 1 ví dụ gần gũi để xem yếu tố bạn chọn là điều kiện đủ hay mới chỉ là một phần nguyên nhân.`;

  // Step 4: Synthesize
  const synthesizeText = hasLongMemory
    ? `Rà soát lại ${ledger_snapshot.length} lượt đã lưu trong Sổ tay${firstAssumption ? ` và giả định ban đầu` : ''}. ${
        contradictionNote
          ? `Đã đánh dấu điểm cần đối chiếu tại ${contradictionRef} để hai bên chỉnh lại cho khớp mạch.`
          : 'Mạch tranh luận hiện vẫn khớp nhau, nhưng nên chốt rõ phạm vi ở lượt tới.'
      }`
    : `Ghi mốc mở đầu cho phiên (U#${userTurnNum} → A#${aiTurnNum}). ${contextLine}`;

  // Step 5: Respond
  const respondSummary =
    lab_type === 'concept'
      ? 'Tóm tắt ý chính, phân tích bằng gạch đầu dòng kèm ví dụ đời thường và đặt 1 câu hỏi mở.'
      : 'Chốt nhanh điểm đồng tình – phản biện, chỉ ra điểm hở kèm ví dụ thực tế và đặt 1 câu hỏi sắc nét.';

  const debateSteps: DebateStepItem[] = [
    { key: 'identify', title: 'Identify', vietnameseTitle: 'Nắm ý chính', summary: identifyText },
    { key: 'analyze', title: 'Analyze', vietnameseTitle: 'Tách lý lẽ', summary: analyzeText },
    { key: 'challenge', title: 'Challenge', vietnameseTitle: 'Tìm điểm hở', summary: challengeText },
    {
      key: 'synthesize',
      title: 'Synthesize',
      vietnameseTitle: 'Đối chiếu mạch',
      summary: synthesizeText,
    },
    {
      key: 'respond',
      title: 'Respond',
      vietnameseTitle: 'Trả lời gợi mở',
      summary: respondSummary,
    },
  ];

  // Layer 1 (TL;DR — max 2 crisp sentences)
  let tldr = '';
  if (mentionsContradiction && referencedEntry) {
    tldr = `Bạn chỉ ra rất trúng điểm vênh liên quan đến mốc ${referencedEntry.id} và mình thẳng thắn thừa nhận cần điều chỉnh lại cho chặt hơn. Thay vì giữ phạm vi quá rộng, hãy cùng chốt rõ điều kiện áp dụng để mạch tranh luận nhất quán.`;
  } else if (lab_type === 'concept') {
    tldr = `Bạn đang chạm đúng chỗ thú vị nhất của khái niệm này: ranh giới giữa định nghĩa trên giấy và cách nó diễn ra ngoài đời. Để không bị hiểu nhầm, ta cần tách rõ phần lõi bắt buộc khỏi những yếu tố chỉ phụ thuộc vào hoàn cảnh.`;
  } else if (absolutes.length > 0) {
    tldr = `Mình hiểu bạn muốn nhấn mạnh một quan điểm rõ ràng, không nước đôi ở lượt U#${userTurnNum}. Tuy nhiên, cách dùng từ tuyệt đối ("${absolutes[0]}") đang khiến lập luận rất dễ bị bẻ gãy chỉ bằng một ngoại lệ đời thường.`;
  } else {
    tldr = `Ý của bạn ở U#${userTurnNum} có điểm hợp lý khi đặt trong hoàn cảnh thông thường. Nhưng để lập luận thật sự khó bị phản bác, ta cần kiểm tra thêm các yếu tố hoàn cảnh có thể làm đảo ngược kết luận.`;
  }

  // Layer 2 — Facts (concise, honest about missing evidence)
  const facts = resourceDoc
    ? `- **Điểm tựa tài liệu:** Bài *"${resourceDoc.title}"* (${resourceDoc.author}) thuộc mục *${resourceDoc.category}* đặt vấn đề này trong khung đối chiếu khái niệm rõ ràng.\n- **Về bằng chứng hiện tại:** Lượt U#${userTurnNum} chưa đính kèm số liệu hay nghiên cứu cụ thể, nên ta sẽ kiểm tra trước ở mặt logic (không tự bịa thêm nguồn ngoài).`
    : `- **Tình trạng dữ liệu:** Lượt U#${userTurnNum} đang nêu một nhận định/quan điểm, chưa kèm số liệu hay nguồn kiểm chứng cụ thể.\n- **Cơ sở đối chiếu:** ${
        referencedEntry
          ? `Trong Sổ tay phiên này, mốc ${referencedEntry.id} đã ghi lại: *"${extractShortSummary(referencedEntry.claim, 90)}"*.`
          : 'Vì chưa có dữ liệu đo lường đi kèm, bước chắc chắn nhất lúc này là tách rõ phần định nghĩa và phần suy luận.'
      }`;

  // Layer 2 — Hidden Assumptions (scannable bullets)
  const assumptions = newAssumptions
    .map((item) => `- **Giả định ngầm:** ${item}`)
    .join('\n');

  // Layer 2 — Interpretation / Critique + Plain-Language Term Explanation + 1-sentence Everyday Example
  let interpretation = '';
  if (mentionsContradiction && referencedEntry) {
    interpretation = [
      `- **Thừa nhận & điều chỉnh:** Ở mốc ${referencedEntry.id}, cách diễn đạt trước dễ khiến lập trường bị đẩy sang quá cực đoan so với giả định ban đầu. Mình điều chỉnh lại phạm vi hẹp hơn: nhận định chỉ đúng khi đi kèm điều kiện cụ thể, không đúng vô điều kiện.`,
      `- **Cách giữ mạch logic:** Khi phát hiện mâu thuẫn nội bộ (hai ý tự đá nhau trong cùng một cuộc tranh luận), bước tốt nhất là cùng thống nhất 1 tiêu chí chung thay vì cãi tiếp trên hai thước đo khác nhau.`,
      `- **Ví dụ gần gũi:** ${everydayExample}`,
    ].join('\n');
  } else if (lab_type === 'concept') {
    interpretation = [
      `- **Góc nhìn sát nghĩa nhất:** Áp dụng *Nguyên tắc Bác ái* (hiểu ý đối phương theo cách hợp lý nhất trước khi phản biện), câu hỏi của bạn giúp tránh cách hiểu hời hợt chỉ thuộc lòng định nghĩa.`,
      `- **Điểm dễ nhầm lẫn:** Nếu gom chung phần cốt lõi và biểu hiện bên ngoài làm một, ta sẽ lúng túng ngay khi gặp *trường hợp biên* (tình huống nằm sát ranh giới, trông na ná nhưng bản chất khác).`,
      `- **Ví dụ gần gũi:** ${everydayExample}`,
    ].join('\n');
  } else if (absolutes.length > 0) {
    interpretation = [
      `- **Điểm hở logic:** Cách dùng cụm từ tuyệt đối như **"${absolutes.join('", "')}"** dễ rơi vào lỗi *Khái quát hóa vội vã* (vơ đũa cả nắm — lấy một vài trường hợp đúng rồi kết luận đúng cho tất cả).`,
      `- **Góc nhìn phản biện:** Chỉ cần 1 ngoại lệ hợp lý là câu khẳng định tuyệt đối sẽ sụp đổ; nếu bạn thu hẹp thành *"trong đa số trường hợp có điều kiện X..."*, lập luận sẽ khó bị bắt bẻ hơn nhiều.`,
      `- **Ví dụ gần gũi:** ${everydayExample}`,
    ].join('\n');
  } else {
    interpretation = [
      `- **Điểm mạnh cần giữ:** Theo *Nguyên tắc Bác ái* (hiểu ý bạn theo hướng chặt chẽ nhất trước khi phản biện), bạn đang chỉ đúng một yếu tố quan trọng tác động tới vấn đề.`,
      `- **Điểm hở cần kiểm tra:** Lập luận hiện dễ nhầm giữa *điều kiện cần* (yếu tố phải có) và *điều kiện đủ* (chỉ cần yếu tố đó là chắc chắn ra kết quả), vì chưa tính đến tác động của hoàn cảnh hay ngoại lệ.`,
      `- **Ví dụ gần gũi:** ${everydayExample}`,
    ].join('\n');
  }

  // Layer 3 — Single sharp, accessible guiding question + short practical hint
  const guidingQuestion =
    mentionsContradiction && referencedEntry
      ? `Sau khi điều chỉnh lại điểm vênh ở ${referencedEntry.id}, bạn muốn đặt điều kiện giới hạn nào để bảo vệ ý của mình mà không tự mâu thuẫn?`
      : lab_type === 'concept'
        ? `Bạn có thể nghĩ ra 1 ví dụ ngoài đời trông rất giống nhưng thực chất KHÔNG phải là khái niệm ta đang bàn không?`
        : `Nếu có người đưa ra ví dụ ngoại lệ như trên, bạn sẽ bổ sung điều kiện nào để câu khẳng định ở U#${userTurnNum} đứng vững hơn?`;

  const questionHint =
    mentionsContradiction && referencedEntry
      ? 'Gợi ý: Thử bắt đầu bằng “Ý của mình chỉ áp dụng trong trường hợp…”'
      : lab_type === 'concept'
        ? 'Gợi ý: Chọn một tình huống quen thuộc ở trường học hoặc đời sống hằng ngày.'
        : 'Gợi ý: Bạn có thể thu hẹp phạm vi (“phần lớn…”) hoặc nêu thêm 1 bằng chứng bảo vệ ý cũ.';

  const aiClaimSummary = extractShortSummary(
    mentionsContradiction && referencedEntry
      ? `Thừa nhận điểm vênh với ${referencedEntry.id} và điều chỉnh phạm vi điều kiện cho nhất quán.`
      : lab_type === 'concept'
        ? `Tách khái niệm thành phần cốt lõi và yếu tố hoàn cảnh kèm ví dụ đời thường.`
        : `Góp ý điểm hở ở U#${userTurnNum}${absolutes.length > 0 ? ` do dùng từ tuyệt đối ("${absolutes[0]}")` : ''} kèm ví dụ thực tế.`,
    115
  );

  return {
    session_id,
    lab_type,
    response_id: `resp_local_${session_id.slice(0, 8)}_${Date.now().toString(36)}`,
    source_engine: 'local-fallback',
    user_claim_summary: userSummary,
    ai_claim_summary: aiClaimSummary,
    new_assumptions: newAssumptions,
    contradiction_note: contradictionNote,
    contradiction_ref: contradictionRef,
    debate_steps: debateSteps,
    three_layer: {
      tldr,
      facts,
      assumptions,
      interpretation,
      guidingQuestion,
      questionHint,
    },
  };
}
