export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface ContrastPairCheck {
  id: 'text-on-bg' | 'text-on-surface' | 'on-primary';
  label: string;
  foreground: string;
  background: string;
  ratio: number;
  passes: boolean;
}

export interface ContrastAuditResult {
  allPass: boolean;
  minRatio: number;
  pairs: ContrastPairCheck[];
}

export interface EightTokenPalette {
  bg: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryHover: string;
  border: string;
  gold: string;
  onPrimary: string;
}

export const WCAG_AA_MIN_RATIO = 4.5;

export function normalizeHex(input: string): string {
  const cleaned = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const expanded = cleaned
      .split('')
      .map((c) => c + c)
      .join('');
    return `#${expanded.toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toUpperCase()}`;
  }
  return '#000000';
}

export function isValidHex(input: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(input.trim());
}

export function hexToRgb(hex: string): RgbColor {
  const normalized = normalizeHex(hex).slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Mix two HEX colors in sRGB space matching CSS `color-mix(in srgb, hexA weightA%, hexB (100-weightA)%)`.
 */
export function mixHexColors(hexA: string, hexB: string, weightA: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const w = Math.max(0, Math.min(1, weightA));
  return rgbToHex({
    r: a.r * w + b.r * (1 - w),
    g: a.g * w + b.g * (1 - w),
    b: a.b * w + b.b * (1 - w),
  });
}

/**
 * Compute WCAG 2.1 Relative Luminance for a HEX color.
 */
export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const transform = (channel: number) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
}

/**
 * Compute WCAG 2.1 contrast ratio between two HEX colors (1.0 to 21.0).
 */
export function getContrastRatio(hexA: string, hexB: string): number {
  const l1 = getRelativeLuminance(hexA);
  const l2 = getRelativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export function isDarkColor(hex: string): boolean {
  return getRelativeLuminance(hex) < 0.24;
}

export function pickReadableOnColor(backgroundHex: string): string {
  const whiteRatio = getContrastRatio('#FFFFFF', backgroundHex);
  const inkRatio = getContrastRatio('#161513', backgroundHex);
  return whiteRatio >= inkRatio ? '#FFFFFF' : '#161513';
}

/**
 * Derive the 5 secondary tokens from 3 core tokens (bg, text, primary),
 * mirroring CSS `color-mix(in srgb, ...)` for accurate pre-save WCAG audits.
 */
export function deriveQuickPalette(
  bg: string,
  text: string,
  primary: string,
  gold = '#B99A62'
): EightTokenPalette {
  const normBg = normalizeHex(bg);
  const normText = normalizeHex(text);
  const normPrimary = normalizeHex(primary);
  const dark = isDarkColor(normBg);

  const surface = dark
    ? mixHexColors(normBg, '#FFFFFF', 0.88)
    : mixHexColors(normBg, '#FFFFFF', 0.46);
  const surfaceMuted = dark
    ? mixHexColors(normBg, '#FFFFFF', 0.80)
    : mixHexColors(normBg, normText, 0.88);
  const textMuted = dark
    ? mixHexColors(normText, normBg, 0.72)
    : mixHexColors(normText, normBg, 0.68);
  const primaryHover = dark
    ? mixHexColors(normPrimary, '#FFFFFF', 0.86)
    : mixHexColors(normPrimary, '#000000', 0.85);
  const border = dark
    ? mixHexColors(normText, normBg, 0.16)
    : mixHexColors(normText, normBg, 0.15);
  const onPrimary = pickReadableOnColor(normPrimary);

  return {
    bg: normBg,
    surface,
    surfaceMuted,
    text: normText,
    textMuted,
    primary: normPrimary,
    primaryHover,
    border,
    gold: normalizeHex(gold),
    onPrimary,
  };
}

/**
 * Evaluate the 3 mandatory WCAG 2.1 AA pairs (>= 4.5:1):
 * 1. Chữ chính / Nền chính
 * 2. Chữ chính / Nền card
 * 3. Chữ nút Primary / Màu nhấn
 */
export function evaluatePaletteContrast(palette: Pick<EightTokenPalette, 'bg' | 'surface' | 'text' | 'primary' | 'onPrimary'>): ContrastAuditResult {
  const pairs: ContrastPairCheck[] = [
    {
      id: 'text-on-bg',
      label: 'Chữ chính / Nền chính',
      foreground: normalizeHex(palette.text),
      background: normalizeHex(palette.bg),
      ratio: getContrastRatio(palette.text, palette.bg),
      passes: getContrastRatio(palette.text, palette.bg) >= WCAG_AA_MIN_RATIO,
    },
    {
      id: 'text-on-surface',
      label: 'Chữ chính / Nền thẻ (card)',
      foreground: normalizeHex(palette.text),
      background: normalizeHex(palette.surface),
      ratio: getContrastRatio(palette.text, palette.surface),
      passes: getContrastRatio(palette.text, palette.surface) >= WCAG_AA_MIN_RATIO,
    },
    {
      id: 'on-primary',
      label: 'Chữ nút Primary / Màu nhấn',
      foreground: normalizeHex(palette.onPrimary),
      background: normalizeHex(palette.primary),
      ratio: getContrastRatio(palette.onPrimary, palette.primary),
      passes: getContrastRatio(palette.onPrimary, palette.primary) >= WCAG_AA_MIN_RATIO,
    },
  ];

  const minRatio = Math.min(...pairs.map((p) => p.ratio));
  return {
    allPass: pairs.every((p) => p.passes),
    minRatio,
    pairs,
  };
}

function adjustColorUntilContrast(
  colorHex: string,
  againstHex: string,
  targetRatio: number,
  towardHex: string
): string {
  let candidate = normalizeHex(colorHex);
  if (getContrastRatio(candidate, againstHex) >= targetRatio) {
    return candidate;
  }
  for (let step = 1; step <= 24; step++) {
    const t = step / 24;
    candidate = mixHexColors(towardHex, colorHex, t);
    if (getContrastRatio(candidate, againstHex) >= targetRatio) {
      return candidate;
    }
  }
  return normalizeHex(towardHex);
}

/**
 * Automatically rebalance a custom palette so all 3 mandatory pairs satisfy WCAG 2.1 AA (>= 4.5:1)
 * while preserving the user's chosen hue family as closely as possible.
 */
export function autoBalanceContrast(palette: EightTokenPalette): EightTokenPalette {
  const bg = normalizeHex(palette.bg);
  const darkBg = isDarkColor(bg);
  let surface = normalizeHex(palette.surface);

  // Ensure surface shares polarity with bg so a single text color works crisply on both
  if (isDarkColor(surface) !== darkBg) {
    surface = darkBg
      ? mixHexColors(bg, '#FFFFFF', 0.88)
      : mixHexColors(bg, '#FFFFFF', 0.48);
  }

  const textTarget = darkBg ? '#F6F3EC' : '#1A1715';
  let text = adjustColorUntilContrast(palette.text, bg, 5.2, textTarget);
  text = adjustColorUntilContrast(text, surface, 5.2, textTarget);

  let primary = normalizeHex(palette.primary);
  let onPrimary = pickReadableOnColor(primary);
  if (getContrastRatio(onPrimary, primary) < WCAG_AA_MIN_RATIO) {
    // Shift primary slightly darker (for white text) or lighter (for dark ink) until >= 4.8:1
    const darkerPrimary = adjustColorUntilContrast(primary, '#FFFFFF', 4.8, '#1A1215');
    const lighterPrimary = adjustColorUntilContrast(primary, '#161513', 4.8, '#F2DEC0');
    primary = darkBg ? lighterPrimary : darkerPrimary;
    onPrimary = pickReadableOnColor(primary);
  }

  const textMuted = darkBg
    ? mixHexColors(text, bg, 0.72)
    : mixHexColors(text, bg, 0.68);
  const primaryHover = darkBg
    ? mixHexColors(primary, '#FFFFFF', 0.86)
    : mixHexColors(primary, '#000000', 0.85);
  const surfaceMuted = darkBg
    ? mixHexColors(bg, '#FFFFFF', 0.82)
    : mixHexColors(bg, text, 0.88);
  const border = darkBg
    ? mixHexColors(text, bg, 0.18)
    : mixHexColors(text, bg, 0.15);

  return {
    ...palette,
    bg,
    surface,
    surfaceMuted,
    text,
    textMuted,
    primary,
    primaryHover,
    border,
    onPrimary,
  };
}
