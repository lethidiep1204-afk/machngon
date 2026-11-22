import React, { useEffect } from 'react';
import { Check, Palette, Sliders, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { PRESET_LIST } from '../../lib/palettes';
import { useRouter } from '../../lib/router';
import { useTheme } from './ThemeProvider';

export function PaletteQuickModal() {
  const { config, selectPreset, paletteModalOpen, setPaletteModalOpen } = useTheme();
  const { navigate } = useRouter();

  useEffect(() => {
    if (!paletteModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPaletteModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paletteModalOpen, setPaletteModalOpen]);

  return (
    <AnimatePresence>
      {paletteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Chọn không gian màu đọc sách"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setPaletteModalOpen(false)}
            className="fixed inset-0 bg-black/45 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-xl rounded-2xl p-6 surface-card"
            style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--color-border)]">
              <div>
                <h2 className="font-display text-xl font-semibold">Không gian đọc & Bảng màu</h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Chuyển đổi 4 bảng màu học thuật được cân chỉnh sẵn theo chuẩn tương phản WCAG 2.1 AA.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaletteModalOpen(false)}
                aria-label="Đóng bảng chọn màu"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PRESET_LIST.map((preset) => {
                const isSelected = config.presetId === preset.id && config.colorMode === 'preset';
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => selectPreset(preset.id)}
                    className={`group text-left rounded-xl p-4 border transition-all duration-200 ${
                      isSelected
                        ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]'
                        : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                    }`}
                    style={{
                      backgroundColor: preset.tokens.bg,
                      color: preset.tokens.text,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-base font-semibold">{preset.name}</span>
                      {isSelected && (
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: preset.tokens.primary,
                            color: preset.tokens.onPrimary,
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    <p
                      className="mt-1 text-xs leading-relaxed"
                      style={{ color: preset.tokens.textMuted }}
                    >
                      {preset.subtitle}
                    </p>
                    <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
                      {(
                        preset.swatches ?? [
                          preset.tokens.bg,
                          preset.tokens.surface,
                          preset.tokens.text,
                          preset.tokens.primary,
                          preset.tokens.gold,
                        ]
                      ).map((swatch, i) => (
                        <span
                          key={i}
                          className="h-4 w-4 rounded-full border border-black/15"
                          style={{ backgroundColor: swatch }}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <Palette className="h-4 w-4" />
                <span>
                  {config.colorMode === 'preset'
                    ? `Đang dùng bộ màu chuẩn: ${PRESET_LIST.find((p) => p.id === config.presetId)?.name}`
                    : 'Đang dùng bảng màu cá nhân (Tầng 2)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPaletteModalOpen(false);
                  navigate('/profile');
                }}
                className="btn-secondary !min-h-9 !px-3.5 !py-1.5 !text-xs"
              >
                <Sliders className="h-3.5 w-3.5" />
                Mở Tùy chỉnh Tầng 2 (8 mã HEX)
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
