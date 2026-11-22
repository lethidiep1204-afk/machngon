import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw, ShieldCheck, Wand2 } from 'lucide-react';
import {
  autoBalanceContrast,
  deriveQuickPalette,
  EightTokenPalette,
  evaluatePaletteContrast,
  isValidHex,
  normalizeHex,
  pickReadableOnColor,
  WCAG_AA_MIN_RATIO,
} from '../../lib/wcag';
import { useTheme } from './ThemeProvider';

const DETAILED_FIELDS: Array<{
  key: keyof EightTokenPalette;
  label: string;
  hint: string;
}> = [
  { key: 'bg', label: 'Nền chính (--color-bg)', hint: 'Màu giấy nền toàn trang' },
  { key: 'surface', label: 'Nền thẻ (--color-surface)', hint: 'Thẻ bài đọc, cột biên' },
  { key: 'surfaceMuted', label: 'Nền phụ (--color-surface-muted)', hint: 'Khối trích dẫn, trạng thái di chuột' },
  { key: 'text', label: 'Chữ chính (--color-text)', hint: 'Văn bản đọc sâu và tiêu đề' },
  { key: 'textMuted', label: 'Chữ phụ (--color-text-muted)', hint: 'Tác giả, ngày xuất bản, chú thích' },
  { key: 'primary', label: 'Màu nhấn (--color-primary)', hint: 'Nút hành động chính và liên kết' },
  { key: 'primaryHover', label: 'Nhấn khi rê chuột (--color-primary-hover)', hint: 'Trạng thái tương tác nút chính' },
  { key: 'border', label: 'Viền mảnh (--color-border)', hint: 'Đường phân chia học thuật' },
];

export default function Tier2ColorCustomizer() {
  const { config, effectiveTokens, applyCustomPalette, resetToPreset } = useTheme();
  const [subMode, setSubMode] = useState<'quick' | 'detailed'>(
    config.colorMode === 'detailed' ? 'detailed' : 'quick'
  );
  const [draftTokens, setDraftTokens] = useState<EightTokenPalette>(effectiveTokens);
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({ ...effectiveTokens });
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const previewTokens = useMemo<EightTokenPalette>(() => {
    if (subMode === 'quick') {
      return deriveQuickPalette(
        draftTokens.bg,
        draftTokens.text,
        draftTokens.primary,
        draftTokens.gold
      );
    }
    return {
      ...draftTokens,
      onPrimary: pickReadableOnColor(draftTokens.primary),
    };
  }, [draftTokens, subMode]);

  const contrastAudit = useMemo(() => evaluatePaletteContrast(previewTokens), [previewTokens]);

  const updateToken = (key: keyof EightTokenPalette, value: string) => {
    setSavedNotice(null);
    setRawInputs((prev) => ({ ...prev, [key]: value }));
    if (isValidHex(value)) {
      const normalized = normalizeHex(value);
      setDraftTokens((prev) => {
        const next = { ...prev, [key]: normalized };
        if (key === 'primary') {
          next.onPrimary = pickReadableOnColor(normalized);
        }
        return next;
      });
    }
  };

  const handleAutoBalance = () => {
    const balanced = autoBalanceContrast(previewTokens);
    setDraftTokens(balanced);
    setRawInputs({ ...balanced });
    setSavedNotice('Đã tự động cân chỉnh độ tương phản an toàn đạt chuẩn WCAG 2.1 AA (≥ 4.5:1).');
  };

  const handleSave = () => {
    if (!contrastAudit.allPass) return;
    applyCustomPalette(subMode, previewTokens);
    setSavedNotice('Đã lưu và áp dụng bảng màu cá nhân trên toàn hệ thống.');
  };

  const handleReset = () => {
    resetToPreset();
    setSavedNotice('Đã khôi phục về bảng màu chuẩn đang chọn.');
  };

  const failingPairs = contrastAudit.pairs.filter((p) => !p.passes);

  return (
    <div className="space-y-6 pt-5">
      {/* Sub-mode switcher: Quick (3 cores + color-mix) vs Detailed (8 HEX) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Chế độ tinh chỉnh bảng màu Tầng 2"
          className="inline-flex rounded-xl p-1 border border-[var(--color-border)] bg-[var(--color-surface)]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subMode === 'quick'}
            onClick={() => setSubMode('quick')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              subMode === 'quick'
                ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Chế độ Nhanh (3 màu lõi · color-mix)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subMode === 'detailed'}
            onClick={() => {
              setDraftTokens(previewTokens);
              setRawInputs({ ...previewTokens });
              setSubMode('detailed');
            }}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              subMode === 'detailed'
                ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Chế độ Chi tiết (8 mã HEX)
          </button>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="btn-ghost !min-h-9 !px-3 !text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Khôi phục Preset gốc
        </button>
      </div>

      {/* Color Pickers Grid */}
      {subMode === 'quick' ? (
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
            Chỉnh 3 màu cốt lõi bên dưới; 5 token còn lại (nền thẻ, nền phụ, chữ phụ, trạng thái rê chuột và đường viền) được nội suy tự động bằng CSS{' '}
            <code className="font-mono-num">color-mix(in srgb, …)</code>.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(
              [
                { key: 'bg', label: 'Nền chính (--color-bg)' },
                { key: 'text', label: 'Chữ chính (--color-text)' },
                { key: 'primary', label: 'Màu nhấn (--color-primary)' },
              ] as const
            ).map((field) => (
              <div
                key={field.key}
                className="rounded-xl p-4 border border-[var(--color-border)] bg-[var(--color-surface)]"
              >
                <label
                  htmlFor={`quick-hex-${field.key}`}
                  className="block text-xs font-medium text-[var(--color-text)] mb-2.5"
                >
                  {field.label}
                </label>
                <div className="flex items-center gap-2.5">
                  <input
                    type="color"
                    aria-label={`Chọn màu ${field.label}`}
                    value={draftTokens[field.key]}
                    onChange={(e) => updateToken(field.key, e.target.value)}
                    className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-[var(--color-border)] bg-transparent p-0.5"
                  />
                  <input
                    id={`quick-hex-${field.key}`}
                    type="text"
                    value={rawInputs[field.key] ?? draftTokens[field.key]}
                    onChange={(e) => updateToken(field.key, e.target.value)}
                    spellCheck={false}
                    className="input-editorial !min-h-10 !py-1.5 !text-xs font-mono-num"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-4 surface-subtle">
            <div className="text-xs font-medium text-[var(--color-text-muted)] mb-2.5">
              5 token được nội suy tự động từ color-mix():
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono-num">
              {(
                [
                  ['surface', 'Nền thẻ'],
                  ['surfaceMuted', 'Nền phụ'],
                  ['textMuted', 'Chữ phụ'],
                  ['primaryHover', 'Hover'],
                  ['border', 'Viền'],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 shrink-0 rounded border border-black/15"
                    style={{ backgroundColor: previewTokens[k] }}
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-ui text-[var(--color-text-muted)] truncate">
                      {label}
                    </div>
                    <div className="text-[11px] text-[var(--color-text)]">{previewTokens[k]}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {DETAILED_FIELDS.map((field) => (
            <div
              key={field.key}
              className="rounded-xl p-3.5 border border-[var(--color-border)] bg-[var(--color-surface)]"
            >
              <label
                htmlFor={`detail-hex-${field.key}`}
                className="block text-xs font-medium text-[var(--color-text)]"
              >
                {field.label}
              </label>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 mb-2.5">
                {field.hint}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={`Chọn màu ${field.label}`}
                  value={draftTokens[field.key]}
                  onChange={(e) => updateToken(field.key, e.target.value)}
                  className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-[var(--color-border)] bg-transparent p-0.5"
                />
                <input
                  id={`detail-hex-${field.key}`}
                  type="text"
                  value={rawInputs[field.key] ?? draftTokens[field.key]}
                  onChange={(e) => updateToken(field.key, e.target.value)}
                  spellCheck={false}
                  className="input-editorial !min-h-9 !py-1.5 !px-2.5 !text-xs font-mono-num"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Live Preview 4 Components (Sidebar, Document Card, Primary Button, Reading Paragraph) */}
      <div>
        <h4 className="text-xs font-semibold text-[var(--color-text-muted)] mb-2.5">
          Xem trước trực tiếp 4 thành phần cốt lõi
        </h4>
        <div
          className="rounded-2xl p-4 border transition-colors duration-200 grid grid-cols-1 lg:grid-cols-12 gap-4"
          style={{
            backgroundColor: previewTokens.bg,
            borderColor: previewTokens.border,
            color: previewTokens.text,
          }}
        >
          {/* 1. Mini Sidebar */}
          <div
            className="lg:col-span-3 rounded-xl p-3.5 border flex flex-col justify-between gap-2"
            style={{
              backgroundColor: previewTokens.surface,
              borderColor: previewTokens.border,
            }}
          >
            <div className="space-y-1.5">
              <div className="font-display text-sm font-bold tracking-tight">MẠCH NGÔN</div>
              <div
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: previewTokens.primary,
                  color: previewTokens.onPrimary,
                }}
              >
                Library
              </div>
              <div className="px-2.5 py-1 text-xs" style={{ color: previewTokens.textMuted }}>
                Thinking Lab
              </div>
              <div className="px-2.5 py-1 text-xs" style={{ color: previewTokens.textMuted }}>
                Lịch sử
              </div>
            </div>
          </div>

          {/* 2. Mini Document Card + 3. Primary Button */}
          <div
            className="lg:col-span-4 rounded-xl p-3.5 border flex flex-col justify-between gap-3"
            style={{
              backgroundColor: previewTokens.surface,
              borderColor: previewTokens.border,
            }}
          >
            <div>
              <div className="text-[11px]" style={{ color: previewTokens.textMuted }}>
                Triết học · 8 phút đọc
              </div>
              <div className="mt-1 font-display text-sm font-semibold leading-snug">
                Triết học hiện sinh: Con người và sự tự do
              </div>
            </div>
            <div>
              <span
                className="inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-xs font-medium"
                style={{
                  backgroundColor: previewTokens.primary,
                  color: previewTokens.onPrimary,
                }}
              >
                Mở trong Thinking Lab
              </span>
            </div>
          </div>

          {/* 4. Mini Reading Paragraph */}
          <div
            className="lg:col-span-5 rounded-xl p-3.5 border"
            style={{
              backgroundColor: previewTokens.surfaceMuted,
              borderColor: previewTokens.border,
            }}
          >
            <div className="text-[11px] font-medium mb-1" style={{ color: previewTokens.textMuted }}>
              Đoạn văn đọc sâu (Lora Serif)
            </div>
            <p className="font-reading text-xs leading-relaxed" style={{ color: previewTokens.text }}>
              “Con người trước hết hiện hữu trong thế giới, chạm trán hoàn cảnh, rồi mới tự định hình bản chất thông qua từng lựa chọn có trách nhiệm.”
            </p>
          </div>
        </div>
      </div>

      {/* WCAG 2.1 Guardrail Audit Box */}
      <div
        className="rounded-2xl p-4 sm:p-5 border"
        style={{
          backgroundColor: contrastAudit.allPass
            ? 'color-mix(in srgb, var(--color-success) 8%, var(--color-surface) 92%)'
            : 'var(--color-warn-bg)',
          borderColor: contrastAudit.allPass
            ? 'color-mix(in srgb, var(--color-success) 35%, var(--color-border) 65%)'
            : 'var(--color-warn-border)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            {contrastAudit.allPass ? (
              <ShieldCheck className="h-4.5 w-4.5" style={{ color: 'var(--color-success)' }} />
            ) : (
              <AlertTriangle className="h-4.5 w-4.5" style={{ color: 'var(--color-danger)' }} />
            )}
            <span className="text-sm font-semibold">
              {contrastAudit.allPass
                ? 'Kiểm định WCAG 2.1 AA đạt chuẩn (≥ 4.5:1)'
                : `Cảnh báo độ tương phản dưới chuẩn 4.5:1 (${failingPairs.length} cặp chưa đạt)`}
            </span>
          </div>
          {!contrastAudit.allPass && (
            <button
              type="button"
              onClick={handleAutoBalance}
              className="btn-primary !min-h-9 !px-3.5 !py-1.5 !text-xs"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Tự cân chỉnh độ tương phản an toàn
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {contrastAudit.pairs.map((pair) => (
            <div
              key={pair.id}
              className="rounded-xl px-3.5 py-2.5 border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">{pair.label}</div>
                <div className="text-[11px] font-mono-num text-[var(--color-text-muted)]">
                  {pair.foreground} / {pair.background}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div
                  className="text-xs font-mono-num font-semibold"
                  style={{ color: pair.passes ? 'var(--color-success)' : 'var(--color-danger)' }}
                >
                  {pair.ratio.toFixed(2)}:1
                </div>
                <div className="text-[11px] text-[var(--color-text-muted)]">
                  {pair.passes ? 'Đạt AA' : `< ${WCAG_AA_MIN_RATIO}:1`}
                </div>
              </div>
            </div>
          ))}
        </div>

        {!contrastAudit.allPass && (
          <p className="mt-3 text-xs text-[var(--color-text)] leading-relaxed">
            Cặp màu chưa đạt chuẩn:{' '}
            <strong>
              {failingPairs.map((p) => `${p.label} (${p.ratio.toFixed(2)}:1)`).join(', ')}
            </strong>
            . Nút lưu bảng màu đã tạm khóa để bảo vệ thị lực khi đọc dài.
          </p>
        )}
      </div>

      {/* Save Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="text-xs text-[var(--color-text-muted)] min-h-5">
          {savedNotice && (
            <span
              className="inline-flex items-center gap-1.5 font-medium"
              style={{ color: 'var(--color-success)' }}
            >
              <CheckCircle2 className="h-4 w-4" />
              {savedNotice}
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={!contrastAudit.allPass}
          onClick={handleSave}
          className="btn-primary !min-h-10 !px-5"
        >
          Lưu bảng màu cá nhân
        </button>
      </div>
    </div>
  );
}
