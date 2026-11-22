import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ColorMode,
  DEFAULT_THEME_CONFIG,
  PresetId,
  SavedThemeConfig,
  THEME_PRESETS,
  ThemePreset,
} from '../../lib/palettes';
import { loadThemeConfig, saveThemeConfig } from '../../lib/storage';
import { deriveQuickPalette, EightTokenPalette, isDarkColor } from '../../lib/wcag';

interface ThemeContextValue {
  config: SavedThemeConfig;
  activePreset: ThemePreset;
  effectiveTokens: EightTokenPalette;
  isDark: boolean;
  selectPreset: (presetId: PresetId) => void;
  applyCustomPalette: (mode: 'quick' | 'detailed', tokens: EightTokenPalette) => void;
  resetToPreset: (presetId?: PresetId) => void;
  paletteModalOpen: boolean;
  setPaletteModalOpen: (open: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTokensToDom(config: SavedThemeConfig, tokens: EightTokenPalette, dark: boolean) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme-preset', config.presetId);
  root.setAttribute('data-theme-mode', dark ? 'dark' : 'light');
  root.setAttribute('data-color-mode', config.colorMode);
  root.classList.toggle('dark', dark);

  root.style.setProperty('--color-bg', tokens.bg);
  root.style.setProperty('--color-text', tokens.text);
  root.style.setProperty('--color-primary', tokens.primary);
  root.style.setProperty('--color-gold', tokens.gold);
  root.style.setProperty('--color-on-primary', tokens.onPrimary);

  if (config.colorMode === 'quick') {
    // Allow CSS color-mix(in srgb, ...) in index.css to compute derived tokens dynamically
    root.style.removeProperty('--color-surface');
    root.style.removeProperty('--color-surface-muted');
    root.style.removeProperty('--color-text-muted');
    root.style.removeProperty('--color-primary-hover');
    root.style.removeProperty('--color-border');
  } else {
    root.style.setProperty('--color-surface', tokens.surface);
    root.style.setProperty('--color-surface-muted', tokens.surfaceMuted);
    root.style.setProperty('--color-text-muted', tokens.textMuted);
    root.style.setProperty('--color-primary-hover', tokens.primaryHover);
    root.style.setProperty('--color-border', tokens.border);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SavedThemeConfig>(() => {
    const saved = loadThemeConfig();
    return THEME_PRESETS[saved.presetId] ? saved : DEFAULT_THEME_CONFIG;
  });
  const [paletteModalOpen, setPaletteModalOpen] = useState(false);

  const activePreset = THEME_PRESETS[config.presetId] ?? THEME_PRESETS['van-hien'];

  const effectiveTokens = useMemo<EightTokenPalette>(() => {
    if (config.colorMode === 'preset') {
      return activePreset.tokens;
    }
    if (config.colorMode === 'quick') {
      return deriveQuickPalette(
        config.customTokens.bg,
        config.customTokens.text,
        config.customTokens.primary,
        config.customTokens.gold
      );
    }
    return config.customTokens;
  }, [activePreset, config]);

  const isDark = useMemo(() => {
    if (config.colorMode === 'preset') {
      return activePreset.mode === 'dark';
    }
    return isDarkColor(effectiveTokens.bg);
  }, [activePreset, config.colorMode, effectiveTokens.bg]);

  useEffect(() => {
    applyTokensToDom(config, effectiveTokens, isDark);
    saveThemeConfig(config);
  }, [config, effectiveTokens, isDark]);

  const selectPreset = useCallback((presetId: PresetId) => {
    const preset = THEME_PRESETS[presetId];
    if (!preset) return;
    setConfig({
      presetId,
      colorMode: 'preset',
      customTokens: preset.tokens,
    });
  }, []);

  const applyCustomPalette = useCallback((mode: 'quick' | 'detailed', tokens: EightTokenPalette) => {
    setConfig((prev) => ({
      ...prev,
      colorMode: mode as ColorMode,
      customTokens: tokens,
    }));
  }, []);

  const resetToPreset = useCallback((presetId?: PresetId) => {
    setConfig((prev) => {
      const targetId = presetId ?? prev.presetId;
      const preset = THEME_PRESETS[targetId] ?? THEME_PRESETS['van-hien'];
      return {
        presetId: preset.id,
        colorMode: 'preset',
        customTokens: preset.tokens,
      };
    });
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        config,
        activePreset,
        effectiveTokens,
        isDark,
        selectPreset,
        applyCustomPalette,
        resetToPreset,
        paletteModalOpen,
        setPaletteModalOpen,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
}
