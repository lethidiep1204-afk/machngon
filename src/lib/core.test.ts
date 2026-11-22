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
import { SEED_DOCUMENTS } from '../data/seedDocuments';

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
