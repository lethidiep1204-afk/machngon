import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autoBalanceContrast,
  deriveQuickPalette,
  evaluatePaletteContrast,
  getContrastRatio,
  WCAG_AA_MIN_RATIO,
} from './wcag';
import { matchesVietnameseQuery, normalizeVietnamese } from './vietnamese';
import { PRESET_LIST } from './palettes';
import { runLocalFallbackEngine } from './ai/localFallbackEngine';
import { SEED_DOCUMENTS } from '../content/seedDocuments';

test('All 4 academic theme presets pass WCAG 2.1 AA (>= 4.5:1) across all 3 pairs', () => {
  for (const preset of PRESET_LIST) {
    const audit = evaluatePaletteContrast(preset.tokens);
    assert.equal(
      audit.allPass,
      true,
      `Preset "${preset.name}" failed WCAG AA: ${JSON.stringify(audit.pairs)}`
    );
    assert.ok(audit.minRatio >= WCAG_AA_MIN_RATIO);
  }
});

test('WCAG Guardrail flags low-contrast custom palette and autoBalanceContrast fixes it to >= 4.5:1', () => {
  const broken = deriveQuickPalette('#FFFFFF', '#CCCCCC', '#E5D5C5');
  const before = evaluatePaletteContrast(broken);
  assert.equal(before.allPass, false);
  assert.equal(before.pairs[0].passes, false);

  const balanced = autoBalanceContrast(broken);
  const after = evaluatePaletteContrast(balanced);
  assert.equal(after.allPass, true);
  assert.ok(after.minRatio >= WCAG_AA_MIN_RATIO);
  assert.ok(getContrastRatio(balanced.onPrimary, balanced.primary) >= WCAG_AA_MIN_RATIO);
});

test('Vietnamese diacritic-insensitive search normalizes đ/Đ and matches multi-token queries', () => {
  assert.equal(normalizeVietnamese('Triết học hiện sinh: Đường đi'), 'triet hoc hien sinh: duong di');
  assert.equal(
    matchesVietnameseQuery('Triết học hiện sinh: Con người và sự tự do', 'triet hoc tu do'),
    true
  );
  assert.equal(
    matchesVietnameseQuery('Nguyên tắc Bác ái và nghệ thuật phản biện', 'nguyen tac bac ai'),
    true
  );
  assert.equal(
    matchesVietnameseQuery('Ngôn ngữ và tư duy: Mối liên hệ biện chứng', 'vat ly luong tu'),
    false
  );
});

test('Local Debate Engine produces 5 steps, 3 layers, detects absolute claims, and tracks multi-turn contradictions', () => {
  const doc = SEED_DOCUMENTS[0];
  const firstTurn = runLocalFallbackEngine(
    {
      session_id: 'test-session-1',
      lab_type: 'debate',
      message: 'Mọi người đều luôn luôn hoàn toàn tự do trong mọi lựa chọn của mình.',
      resource_context_id: doc.id,
      ledger_snapshot: [],
      core_assumptions: [],
    },
    doc
  );

  assert.equal(firstTurn.debate_steps.length, 5);
  assert.deepEqual(
    firstTurn.debate_steps.map((s) => s.key),
    ['identify', 'analyze', 'challenge', 'synthesize', 'respond']
  );
  assert.ok(firstTurn.three_layer.tldr && firstTurn.three_layer.tldr.length > 20);
  assert.ok(firstTurn.three_layer.facts.length > 20);
  assert.ok(firstTurn.three_layer.assumptions.length > 20);
  assert.ok(firstTurn.three_layer.interpretation.length > 20);
  assert.ok(firstTurn.three_layer.interpretation.includes('- **'));
  assert.ok(firstTurn.three_layer.interpretation.includes('('));
  assert.ok(firstTurn.three_layer.guidingQuestion.includes('?'));
  assert.ok(firstTurn.three_layer.questionHint && firstTurn.three_layer.questionHint.length > 10);
  assert.match(firstTurn.three_layer.interpretation, /luon luon|tuyệt đối/i);

  // Follow-up turn referencing contradiction with A#1
  const secondTurn = runLocalFallbackEngine(
    {
      session_id: 'test-session-1',
      lab_type: 'debate',
      message: 'Nhưng lập luận A#1 của bạn mâu thuẫn với giả định ban đầu về tự do.',
      resource_context_id: doc.id,
      ledger_snapshot: [
        {
          id: 'U#1',
          speaker: 'user',
          turnIndex: 1,
          claim: firstTurn.user_claim_summary,
          assumptions: firstTurn.new_assumptions,
          timestamp: new Date().toISOString(),
        },
        {
          id: 'A#1',
          speaker: 'ai',
          turnIndex: 1,
          claim: firstTurn.ai_claim_summary,
          assumptions: [],
          timestamp: new Date().toISOString(),
        },
      ],
      core_assumptions: firstTurn.new_assumptions,
    },
    doc
  );

  assert.equal(secondTurn.contradiction_ref, 'A#1');
  assert.ok(secondTurn.contradiction_note && secondTurn.contradiction_note.includes('A#1'));
  assert.match(secondTurn.three_layer.interpretation, /thừa nhận|điều chỉnh/i);
});

test('Trợ lý AI MẠCH NGÔN enforces direct tone, triggers A/B recovery after 2 stuck turns, and builds Thinking Trace Maps', () => {
  // 1. Direct tone without generic filler greetings
  const conceptTurn = runLocalFallbackEngine({
    session_id: 'mach-ngon-concept',
    lab_type: 'concept',
    message: 'Em muốn hiểu rõ khái niệm "Tự do" khác gì với "tùy tiện".',
    ledger_snapshot: [],
    core_assumptions: [],
  });
  assert.doesNotMatch(conceptTurn.three_layer.tldr || '', /chào bạn|câu hỏi rất thú vị/i);
  assert.ok(conceptTurn.three_layer.guidingQuestion.includes('?'));

  // 2. Stuck recovery (Cơ chế gỡ bí): 2 consecutive "không biết" turns produce Phương án A & Phương án B
  const stuckTurn = runLocalFallbackEngine({
    session_id: 'mach-ngon-stuck',
    lab_type: 'concept',
    message: 'Em vẫn không biết trả lời sao cả.',
    history: [
      { role: 'user', content: 'Em muốn hiểu về khái niệm Tự do.' },
      { role: 'assistant', content: 'Theo bạn, tự do là gì?' },
      { role: 'user', content: 'Em không biết nữa.' },
      { role: 'assistant', content: 'Thử nghĩ từ một tình huống ở trường xem sao?' },
    ],
    ledger_snapshot: [],
    core_assumptions: [],
  });
  assert.match(stuckTurn.three_layer.interpretation, /Phương án A/i);
  assert.match(stuckTurn.three_layer.interpretation, /Phương án B/i);

  // 3. Thinking Trace Map for Concept Lab
  const conceptMap = runLocalFallbackEngine({
    session_id: 'mach-ngon-concept-map',
    lab_type: 'concept',
    message: 'Hãy tổng kết phiên học này thành Bản đồ truy vết tư duy giúp mình.',
    ledger_snapshot: [
      {
        id: 'U#1',
        speaker: 'user',
        turnIndex: 1,
        claim: 'Tự do là muốn làm gì thì làm.',
        assumptions: ['Chưa tách tự do khỏi việc xâm phạm quyền người khác'],
        timestamp: new Date().toISOString(),
      },
      {
        id: 'U#2',
        speaker: 'user',
        turnIndex: 2,
        claim: 'Tự do là quyền lựa chọn trong giới hạn không làm hại người khác.',
        assumptions: [],
        timestamp: new Date().toISOString(),
      },
    ],
    core_assumptions: ['Chưa tách tự do khỏi việc xâm phạm quyền người khác'],
  });
  assert.match(conceptMap.three_layer.interpretation, /Khái niệm ban đầu của bạn/i);
  assert.match(conceptMap.three_layer.interpretation, /Những ranh giới đã làm rõ/i);
  assert.match(conceptMap.three_layer.interpretation, /Định nghĩa sau khi hoàn thiện/i);

  // 4. Thinking Trace Map for Debate Lab
  const debateMap = runLocalFallbackEngine({
    session_id: 'mach-ngon-debate-map',
    lab_type: 'debate',
    message: 'Tổng kết giúp mình Bản đồ truy vết tư duy của phiên tranh luận này.',
    ledger_snapshot: [
      {
        id: 'U#1',
        speaker: 'user',
        turnIndex: 1,
        claim: 'Tự do cá nhân không nên bị giới hạn.',
        assumptions: ['Đặt quyền cá nhân tách biệt hoàn toàn với bối cảnh cộng đồng'],
        timestamp: new Date().toISOString(),
      },
      {
        id: 'A#1',
        speaker: 'ai',
        turnIndex: 1,
        claim: 'Nêu tình huống tự do cá nhân xung đột với quyền lợi chung của tập thể.',
        assumptions: [],
        timestamp: new Date().toISOString(),
      },
      {
        id: 'U#2',
        speaker: 'user',
        turnIndex: 2,
        claim: 'Tự do cá nhân chỉ nên giới hạn khi có nguy cơ gây hại rõ ràng cho người khác.',
        assumptions: [],
        timestamp: new Date().toISOString(),
      },
    ],
    core_assumptions: ['Đặt quyền cá nhân tách biệt hoàn toàn với bối cảnh cộng đồng'],
  });
  assert.match(debateMap.three_layer.interpretation, /Lập trường & Luận điểm chính/i);
  assert.match(debateMap.three_layer.interpretation, /Phản đề đã đối diện/i);
  assert.match(debateMap.three_layer.interpretation, /Bước chuyển trong lập luận/i);
  assert.match(debateMap.three_layer.interpretation, /Điểm có thể đào sâu thêm/i);
});

test('Auth Guard separates public vs protected routes and sanitizes redirect paths safely', async () => {
  const { isPublicRoute, isProtectedRoute, sanitizeRedirectPath, buildAuthRedirectUrl } =
    await import('./authGuard');

  assert.equal(isPublicRoute('/'), true);
  assert.equal(isPublicRoute('/auth'), true);
  assert.equal(isPublicRoute('/auth/'), true);

  assert.equal(isProtectedRoute('/dashboard'), true);
  assert.equal(isProtectedRoute('/library'), true);
  assert.equal(isProtectedRoute('/library/doc-1'), true);
  assert.equal(isProtectedRoute('/lab'), true);
  assert.equal(isProtectedRoute('/history'), true);
  assert.equal(isProtectedRoute('/profile'), true);
  assert.equal(isProtectedRoute('/guide'), true);
  assert.equal(isProtectedRoute('/admin'), true);
  assert.equal(isProtectedRoute('/onboarding'), true);

  assert.equal(sanitizeRedirectPath('/lab?mode=debate'), '/lab?mode=debate');
  assert.equal(sanitizeRedirectPath('//evil.com'), '/dashboard');
  assert.equal(sanitizeRedirectPath('https://evil.com/phish'), '/dashboard');
  assert.equal(sanitizeRedirectPath('/auth'), '/dashboard');
  assert.equal(
    buildAuthRedirectUrl('/library', '?category=triet-hoc'),
    '/auth?redirect=%2Flibrary%3Fcategory%3Dtriet-hoc&reason=auth_required'
  );
});

test('Voice Debate helpers strip Markdown for TTS and clean Vietnamese spoken fillers cleanly', async () => {
  const { stripMarkdownForSpeech } = await import('../hooks/useVoiceDebate');
  const { cleanSpokenVietnameseFillers, computeDebateStage } = await import('./ai/debateEngine');

  const spoken = stripMarkdownForSpeech(
    '## Tiêu đề\n- **Điểm hở:** Lập luận *chưa chặt* với `ví dụ` [xem thêm](https://example.com).'
  );
  assert.equal(spoken.includes('**'), false);
  assert.equal(spoken.includes('##'), false);
  assert.equal(spoken.includes('`'), false);
  assert.match(spoken, /Điểm hở: Lập luận chưa chặt với ví dụ xem thêm\./);

  const cleanedSpeech = cleanSpokenVietnameseFillers(
    'Kiểu như là thì em thấy tự do cá nhân à mà nghĩa là phải có giới hạn.'
  );
  assert.doesNotMatch(cleanedSpeech, /kiểu như là|thì em thấy|à mà|nghĩa là/i);
  assert.match(cleanedSpeech, /tự do cá nhân/i);
  assert.match(cleanedSpeech, /phải có giới hạn/i);

  assert.equal(computeDebateStage(1, false), 1);
  assert.equal(computeDebateStage(2, false), 2);
  assert.equal(computeDebateStage(3, false), 3);
  assert.equal(computeDebateStage(4, false), 4);
  assert.equal(computeDebateStage(5, false), 5);
  assert.equal(computeDebateStage(2, true), 5);
});


