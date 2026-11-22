import React from 'react';

export function BrandBookMarkSvg({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M5 8.5C5 7.4 5.9 6.5 7 6.5H13.5C14.88 6.5 16 7.62 16 9V25.5C16 24.4 15.1 23.5 14 23.5H7C5.9 23.5 5 22.6 5 21.5V8.5Z"
        stroke="var(--color-primary)"
        strokeWidth="1.6"
        fill="color-mix(in srgb, var(--color-primary) 10%, var(--color-surface) 90%)"
      />
      <path
        d="M27 8.5C27 7.4 26.1 6.5 25 6.5H18.5C17.12 6.5 16 7.62 16 9V25.5C16 24.4 16.9 23.5 18 23.5H25C26.1 23.5 27 22.6 27 21.5V8.5Z"
        stroke="var(--color-primary)"
        strokeWidth="1.6"
        fill="color-mix(in srgb, var(--color-gold) 14%, var(--color-surface) 86%)"
      />
      <path
        d="M8.5 11H13M8.5 14.5H13M19 11H23.5M19 14.5H23.5"
        stroke="var(--color-gold)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="16" cy="5" r="1.4" fill="var(--color-gold)" />
    </svg>
  );
}

/**
 * Editorial line-art SVG fallback used automatically whenever an image fails or is unavailable.
 * Dynamically inherits CSS variables (--color-primary, --color-gold, --color-text-muted, --color-surface).
 */
export function EditorialFallbackCoverSvg({
  title,
  variant = 'arch',
  className = 'h-full w-full',
}: {
  title?: string;
  variant?: 'arch' | 'quill' | 'scales';
  className?: string;
}) {
  return (
    <div
      className={`relative flex flex-col items-center justify-center overflow-hidden p-6 select-none ${className}`}
      style={{
        background:
          'linear-gradient(145deg, color-mix(in srgb, var(--color-surface) 88%, var(--color-gold) 12%), color-mix(in srgb, var(--color-bg) 82%, var(--color-primary) 18%))',
      }}
    >
      <svg
        viewBox="0 0 320 200"
        fill="none"
        className="w-full max-w-[240px] h-auto opacity-90"
        aria-hidden="true"
      >
        <rect
          x="16"
          y="16"
          width="288"
          height="168"
          rx="4"
          stroke="var(--color-gold)"
          strokeWidth="1"
          strokeOpacity="0.55"
        />
        <rect
          x="24"
          y="24"
          width="272"
          height="152"
          rx="2"
          stroke="var(--color-text-muted)"
          strokeWidth="0.75"
          strokeOpacity="0.35"
        />
        {variant === 'arch' && (
          <>
            <path
              d="M95 162V104C95 68 124 44 160 44C196 44 225 68 225 104V162"
              stroke="var(--color-primary)"
              strokeWidth="1.5"
            />
            <path
              d="M112 162V108C112 80 133 60 160 60C187 60 208 80 208 108V162"
              stroke="var(--color-gold)"
              strokeWidth="1.1"
            />
            <line x1="78" y1="162" x2="242" y2="162" stroke="var(--color-primary)" strokeWidth="1.5" />
            <circle cx="160" cy="96" r="16" stroke="var(--color-primary)" strokeWidth="1.2" />
            <path d="M160 72V120M136 96H184" stroke="var(--color-gold)" strokeWidth="0.9" />
          </>
        )}
        {variant === 'quill' && (
          <>
            <path
              d="M108 148C124 102 168 62 214 48C202 86 176 124 134 140L108 148Z"
              stroke="var(--color-primary)"
              strokeWidth="1.5"
              fill="color-mix(in srgb, var(--color-gold) 14%, transparent)"
            />
            <path d="M104 152L188 74" stroke="var(--color-gold)" strokeWidth="1.2" />
            <line x1="78" y1="156" x2="238" y2="156" stroke="var(--color-text-muted)" strokeWidth="1" />
          </>
        )}
        {variant === 'scales' && (
          <>
            <line x1="160" y1="54" x2="160" y2="152" stroke="var(--color-primary)" strokeWidth="1.5" />
            <line x1="104" y1="80" x2="216" y2="80" stroke="var(--color-primary)" strokeWidth="1.5" />
            <path d="M104 80L88 118H120L104 80Z" stroke="var(--color-gold)" strokeWidth="1.2" />
            <path d="M216 80L200 118H232L216 80Z" stroke="var(--color-gold)" strokeWidth="1.2" />
            <line x1="128" y1="152" x2="192" y2="152" stroke="var(--color-primary)" strokeWidth="1.5" />
          </>
        )}
      </svg>
      {title && (
        <span className="mt-2 max-w-[240px] truncate font-display text-xs text-[var(--color-text-muted)]">
          {title}
        </span>
      )}
    </div>
  );
}

export function EmptyArchiveSvg({ className = 'w-44 h-32' }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 140" fill="none" aria-hidden="true" className={className}>
      <rect
        x="34"
        y="34"
        width="152"
        height="84"
        rx="6"
        stroke="var(--color-border)"
        strokeWidth="1.4"
        fill="var(--color-surface)"
      />
      <path
        d="M52 54H168M52 72H144M52 90H122"
        stroke="var(--color-text-muted)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeOpacity="0.45"
      />
      <circle
        cx="164"
        cy="88"
        r="16"
        fill="color-mix(in srgb, var(--color-gold) 18%, var(--color-surface) 82%)"
        stroke="var(--color-gold)"
        strokeWidth="1.4"
      />
      <path
        d="M164 81V95M157 88H171"
        stroke="var(--color-primary)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M110 16L114 23L121 27L114 31L110 38L106 31L99 27L106 23L110 16Z"
        fill="var(--color-gold)"
        fillOpacity="0.7"
      />
    </svg>
  );
}

export function OnboardingOrnamentSvg({ className = 'w-28 h-28' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" aria-hidden="true" className={className}>
      <circle cx="60" cy="60" r="46" stroke="var(--color-gold)" strokeWidth="1" strokeDasharray="3 4" />
      <circle cx="60" cy="60" r="32" stroke="var(--color-primary)" strokeWidth="1.3" strokeOpacity="0.7" />
      <path
        d="M60 22L65 55L98 60L65 65L60 98L55 65L22 60L55 55L60 22Z"
        stroke="var(--color-primary)"
        strokeWidth="1.2"
        fill="color-mix(in srgb, var(--color-gold) 16%, transparent)"
      />
      <circle cx="60" cy="60" r="4.5" fill="var(--color-primary)" />
    </svg>
  );
}

export function ChapterDividerSvg({ className = 'w-full max-w-xs mx-auto my-8' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-px flex-1 bg-[var(--color-border)]" />
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none">
        <path
          d="M12 3L15 12L21 12L15 12L12 21L9 12L3 12L9 12L12 3Z"
          stroke="var(--color-gold)"
          strokeWidth="1.4"
          fill="color-mix(in srgb, var(--color-gold) 30%, transparent)"
        />
      </svg>
      <span className="h-px flex-1 bg-[var(--color-border)]" />
    </div>
  );
}

/**
 * Friendly AI assistant robot icon for Thinking Lab empty state.
 * Dynamically adapts to every theme preset (Văn Hiến, Dạ Thư, Tân Biên Tập, Lục Bản).
 */
export function AiAssistantRobotSvg({ className = 'h-24 w-24' }: { className?: string }) {
  return (
    <svg viewBox="0 0 112 112" fill="none" aria-hidden="true" className={className}>
      {/* Soft circular halo */}
      <circle
        cx="56"
        cy="60"
        r="46"
        fill="color-mix(in srgb, var(--color-primary) 10%, var(--color-surface) 90%)"
        stroke="var(--color-border)"
        strokeWidth="1.25"
      />
      {/* Subtle floating sparkle */}
      <path
        d="M91 20L93.2 24.8L98 27L93.2 29.2L91 34L88.8 29.2L84 27L88.8 24.8L91 20Z"
        fill="var(--color-gold)"
      />
      {/* Antenna */}
      <line
        x1="56"
        y1="26"
        x2="56"
        y2="34"
        stroke="var(--color-primary)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle
        cx="56"
        cy="22"
        r="4.5"
        fill="var(--color-gold)"
        stroke="var(--color-primary)"
        strokeWidth="1.6"
      />
      {/* Side ear pods */}
      <rect
        x="21"
        y="49"
        width="7"
        height="16"
        rx="3.5"
        fill="color-mix(in srgb, var(--color-primary) 26%, var(--color-surface) 74%)"
        stroke="var(--color-primary)"
        strokeWidth="1.8"
      />
      <rect
        x="84"
        y="49"
        width="7"
        height="16"
        rx="3.5"
        fill="color-mix(in srgb, var(--color-primary) 26%, var(--color-surface) 74%)"
        stroke="var(--color-primary)"
        strokeWidth="1.8"
      />
      {/* Robot head shell */}
      <rect
        x="28"
        y="34"
        width="56"
        height="44"
        rx="20"
        fill="var(--color-surface)"
        stroke="var(--color-primary)"
        strokeWidth="2.2"
      />
      {/* Visor face screen */}
      <rect
        x="36"
        y="43"
        width="40"
        height="26"
        rx="12"
        fill="var(--color-primary)"
      />
      {/* Friendly glowing eyes */}
      <circle cx="48" cy="54" r="3.6" fill="var(--color-on-primary)" />
      <circle cx="64" cy="54" r="3.6" fill="var(--color-on-primary)" />
      <circle cx="49.2" cy="52.8" r="1.2" fill="var(--color-gold)" />
      <circle cx="65.2" cy="52.8" r="1.2" fill="var(--color-gold)" />
      {/* Warm friendly smile */}
      <path
        d="M50 61.5C51.6 64 60.4 64 62 61.5"
        stroke="var(--color-on-primary)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Collar & shoulders */}
      <path
        d="M39 84C39 79.5 46.6 77 56 77C65.4 77 73 79.5 73 84V90C73 91.6 71.6 93 70 93H42C40.4 93 39 91.6 39 90V84Z"
        fill="color-mix(in srgb, var(--color-primary) 16%, var(--color-surface) 84%)"
        stroke="var(--color-primary)"
        strokeWidth="1.8"
      />
      <circle cx="56" cy="85" r="2.5" fill="var(--color-gold)" />
    </svg>
  );
}
