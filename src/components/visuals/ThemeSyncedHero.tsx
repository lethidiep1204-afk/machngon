import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { resolveEditorialAsset } from '../../lib/assets';
import { useTheme } from '../theme/ThemeProvider';
import { EditorialFallbackCoverSvg } from './EditorialSvgIllustrations';

interface ThemeSyncedHeroProps {
  children: React.ReactNode;
}

/**
 * Renders ONLY the active preset's Hero artwork (never preloads unused themes)
 * with a smooth crossfade when switching presets, bundled asset resolution, and SVG fallback.
 */
export function ThemeSyncedHero({ children }: ThemeSyncedHeroProps) {
  const { activePreset, isDark } = useTheme();
  const [failedSrcs, setFailedSrcs] = useState<Record<string, boolean>>({});

  const resolvedHeroSrc = resolveEditorialAsset(activePreset.heroImage);
  const imageFailed = Boolean(failedSrcs[resolvedHeroSrc]);

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-[var(--color-border)]"
      style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }}
    >
      {/* Background synced artwork layer */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <AnimatePresence mode="sync">
          <motion.div
            key={activePreset.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            {imageFailed ? (
              <EditorialFallbackCoverSvg variant="arch" className="h-full w-full" />
            ) : (
              <img
                src={resolvedHeroSrc}
                alt={activePreset.heroAlt}
                fetchPriority="high"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() =>
                  setFailedSrcs((prev) => ({ ...prev, [resolvedHeroSrc]: true }))
                }
                className="h-full w-full object-cover object-center hybrid-media-img"
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Measured editorial scrim ensuring high contrast on left typography while letting library artwork breathe on the right */}
        <div
          className="absolute inset-0 transition-colors duration-250"
          style={{
            background: isDark
              ? 'linear-gradient(96deg, color-mix(in srgb, var(--color-bg) 93%, transparent) 0%, color-mix(in srgb, var(--color-bg) 78%, transparent) 44%, color-mix(in srgb, var(--color-bg) 38%, transparent) 78%, color-mix(in srgb, var(--color-bg) 28%, transparent) 100%)'
              : 'linear-gradient(96deg, color-mix(in srgb, var(--color-bg) 94%, transparent) 0%, color-mix(in srgb, var(--color-bg) 78%, transparent) 42%, color-mix(in srgb, var(--color-bg) 30%, transparent) 76%, color-mix(in srgb, var(--color-bg) 20%, transparent) 100%)',
          }}
        />
        <div className="absolute inset-0 hybrid-media-tint" />

        {/* Subtle ambient starlight layer when Tinh Mộng (Mystic Purple) theme is selected */}
        {activePreset.id === 'da-thu' && (
          <svg
            viewBox="0 0 1200 420"
            fill="none"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-55"
            aria-hidden="true"
            preserveAspectRatio="xMidYMid slice"
          >
            <path
              d="M980 54L984 65L995 69L984 73L980 84L976 73L965 69L976 65L980 54Z"
              fill="var(--color-gold)"
              fillOpacity="0.8"
            />
            <path
              d="M540 42L542.8 49.5L550 52L542.8 54.5L540 62L537.2 54.5L530 52L537.2 49.5L540 42Z"
              fill="var(--color-gold)"
              fillOpacity="0.65"
            />
            <path
              d="M1110 175L1112.5 182L1119 184.5L1112.5 187L1110 194L1107.5 187L1101 184.5L1107.5 182L1110 175Z"
              fill="var(--color-gold)"
              fillOpacity="0.6"
            />
            <circle cx="845" cy="96" r="2.2" fill="var(--color-gold)" fillOpacity="0.7" />
            <circle cx="670" cy="78" r="1.6" fill="var(--color-gold)" fillOpacity="0.55" />
            <circle cx="1055" cy="112" r="1.8" fill="var(--color-gold)" fillOpacity="0.65" />
            <circle cx="468" cy="115" r="1.4" fill="var(--color-gold)" fillOpacity="0.5" />
          </svg>
        )}
      </div>

      {/* Foreground editorial content */}
      <div className="relative z-10 px-6 py-9 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
        {children}
      </div>
    </section>
  );
}

interface HybridMediaCardProps {
  src: string;
  alt: string;
  title?: string;
  aspect?: '4/3' | '3/2' | '16/9';
  fallbackVariant?: 'arch' | 'quill' | 'scales';
  className?: string;
}

/**
 * CLS-safe media container locking explicit aspect-ratio with Vite asset resolution,
 * skeleton shimmer, mix-blend theme harmonization, and SVG fallback on error.
 */
export function HybridMediaCard({
  src,
  alt,
  title,
  aspect = '4/3',
  fallbackVariant = 'quill',
  className = '',
}: HybridMediaCardProps) {
  const resolvedSrc = resolveEditorialAsset(src);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [erroredSrc, setErroredSrc] = useState<string | null>(null);

  const loaded = loadedSrc === resolvedSrc;
  const errored = erroredSrc === resolvedSrc;

  const aspectClass =
    aspect === '3/2' ? 'aspect-[3/2]' : aspect === '16/9' ? 'aspect-[16/9]' : 'aspect-[4/3]';

  return (
    <div
      className={`relative w-full overflow-hidden bg-[var(--color-surface-muted)] ${aspectClass} ${className}`}
    >
      {!loaded && !errored && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{ backgroundColor: 'var(--color-surface-muted)' }}
        />
      )}
      {errored ? (
        <EditorialFallbackCoverSvg title={title} variant={fallbackVariant} />
      ) : (
        <>
          <img
            src={resolvedSrc}
            alt={alt}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setLoadedSrc(resolvedSrc)}
            onError={() => setErroredSrc(resolvedSrc)}
            className={`h-full w-full object-cover object-center hybrid-media-img ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div className="absolute inset-0 hybrid-media-tint" aria-hidden="true" />
        </>
      )}
    </div>
  );
}
