import React from 'react';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Check,
  Compass,
  Gem,
  ShieldCheck,
  Sprout,
} from 'lucide-react';
import { motion } from 'motion/react';
import { BrandLogo } from '../components/brand/BrandLogo';
import { PublicHeader } from '../components/layout/AppShell';
import { DocumentCard } from '../components/library/DocumentCard';
import { DailyQuoteCard } from '../components/quote/DailyQuoteCard';
import { useTheme } from '../components/theme/ThemeProvider';
import { SectionHeading } from '../components/ui/EditorialPrimitives';
import { ChapterDividerSvg } from '../components/visuals/EditorialSvgIllustrations';
import { ThemeSyncedHero } from '../components/visuals/ThemeSyncedHero';
import { useApp } from '../lib/AppContext';
import { PRESET_LIST } from '../lib/palettes';
import { Link } from '../lib/router';

const HOW_IT_WORKS_STEPS = [
  {
    num: 1,
    icon: BookOpen,
    title: 'Khám phá tài liệu trong Library',
    detail: 'Đọc sâu chuyên luận trích dẫn chuẩn xác trong không gian biên tập tĩnh tại.',
  },
  {
    num: 2,
    icon: BrainCircuit,
    title: 'Tương tác với AI trong Thinking Lab',
    detail: 'Phân tích khái niệm hoặc tranh biện theo quy trình 5 bước và 3 tầng nhận thức.',
  },
  {
    num: 3,
    icon: Compass,
    title: 'Phát triển tư duy và xây dựng lập luận',
    detail: 'Lưu giữ mạch lập luận trong Sổ tay để đối chiếu giả định và hoàn thiện góc nhìn.',
  },
];

const CORE_VALUES = [
  {
    icon: BookOpen,
    title: 'Thư viện tri thức (Library)',
    description: 'Tài liệu chất lượng, được tuyển chọn và biên tập học thuật.',
  },
  {
    icon: BrainCircuit,
    title: 'Phòng thí nghiệm tư duy (Thinking Lab)',
    description: 'Tương tác AI phản biện sâu sắc, tách bạch dữ kiện và diễn giải.',
  },
  {
    icon: Gem,
    title: 'Giao diện tinh tế',
    description: 'Trải nghiệm đọc mượt mà, tôn trọng khoảng trắng và truyền cảm hứng.',
  },
  {
    icon: ShieldCheck,
    title: 'An toàn & minh bạch',
    description: 'Bảo mật dữ liệu, kiểm chứng nguồn dẫn và trách nhiệm với người học.',
  },
  {
    icon: Sprout,
    title: 'Đồng hành lâu dài',
    description: 'Cùng bạn bền bỉ trên hành trình đọc chậm và mở rộng tư duy.',
  },
];

export function HomePage() {
  const { user, publishedDocuments } = useApp();
  const { config, activePreset, isDark, selectPreset } = useTheme();
  const featuredDocs = publishedDocuments.slice(0, 3);

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        <div className="mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-10 pt-6 pb-12 sm:pt-8 sm:pb-16">
          {/* Section 1: 2-Zone Editorial Hero (Left: Brand & Thesis · Right: 2 Large Feature Cards) */}
          <ThemeSyncedHero>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              {/* Left Zone (5 cols) */}
              <div className="lg:col-span-5 flex flex-col">
                <p className="text-xs font-medium tracking-wide text-[var(--color-primary)]">
                  Tri thức để hiểu · Tư duy để khám phá
                </p>
                <h1 className="mt-2.5 font-display text-4xl sm:text-5xl xl:text-[3.5rem] font-bold leading-[1.1] tracking-tight text-[var(--color-primary)]">
                  MẠCH NGÔN
                </h1>
                <p className="mt-2.5 font-reading text-lg sm:text-xl italic leading-snug text-[var(--color-text)]">
                  Nền tảng học tập và phát triển tư duy
                </p>

                {/* Daily Quote System ("DANH NGÔN HÔM NAY") replacing static slogan */}
                <DailyQuoteCard variant="hero" />

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    to={
                      user.isAuthenticated
                        ? '/dashboard'
                        : '/auth?mode=register&redirect=%2Fonboarding'
                    }
                    className="btn-primary px-6"
                  >
                    {user.isAuthenticated ? 'Tiếp tục học tập' : 'Bắt đầu ngay'}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/guide" className="btn-secondary">
                    Phương pháp đọc
                  </Link>
                </div>
              </div>

              {/* Right Zone (7 cols): Two Large Feature Cards side-by-side */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                <Link
                  to="/library"
                  className="group flex flex-col justify-between rounded-2xl p-6 sm:p-7 border border-[var(--color-border)] bg-[var(--color-surface)]/95 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary)]/55"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <div>
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border)]"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg) 90%)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      <BookOpen className="h-6 w-6" />
                    </div>
                    <h2 className="mt-4 font-display text-2xl font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                      Library
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
                      Khám phá tri thức qua những chuyên luận chọn lọc về triết học, ngôn ngữ, văn học và lập luận.
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-[var(--color-border)]/80 flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono-num text-[var(--color-text-muted)]">
                      {publishedDocuments.length} tài liệu tuyển chọn
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary)]">
                      Khám phá
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>

                <Link
                  to="/lab"
                  className="group flex flex-col justify-between rounded-2xl p-6 sm:p-7 border border-[var(--color-border)] bg-[var(--color-surface)]/95 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary)]/55"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <div>
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border)]"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg) 90%)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      <BrainCircuit className="h-6 w-6" />
                    </div>
                    <h2 className="mt-4 font-display text-2xl font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                      Thinking Lab
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
                      Tương tác cùng AI để phân tích khái niệm, phản biện 5 bước và lưu Sổ tay mạch lập luận.
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-[var(--color-border)]/80 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[var(--color-text-muted)]">
                      Concept · Debate Lab
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary)]">
                      Mở phòng tư duy
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </div>
            </div>

            {/* Quiet Theme Atmosphere Switcher Strip inside Hero Footer */}
            <div className="mt-8 rounded-xl px-4 py-3 border border-[var(--color-border)] bg-[var(--color-surface)]/92 backdrop-blur-[2px] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-[var(--color-text-muted)] mr-1">
                  Không gian đọc:
                </span>
                {PRESET_LIST.map((preset) => {
                  const active = config.presetId === preset.id && config.colorMode === 'preset';
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => selectPreset(preset.id)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? 'border-[var(--color-primary)] bg-[var(--color-bg)] text-[var(--color-text)]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-black/15 shrink-0"
                        style={{ backgroundColor: preset.tokens.primary }}
                        aria-hidden="true"
                      />
                      <span>{preset.name}</span>
                      {active && <Check className="h-3 w-3 text-[var(--color-primary)]" />}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-[var(--color-text-muted)] sm:text-right">
                {activePreset.atmosphere}
              </p>
            </div>
          </ThemeSyncedHero>

          {/* Section 2: Cách thức hoạt động (3 connected editorial stages) */}
          <motion.section
            id="cach-thuc-hoat-dong"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            aria-labelledby="how-it-works-heading"
            className="mt-10 rounded-2xl px-6 py-7 sm:px-9 sm:py-9 surface-card scroll-mt-20"
          >
            <div className="text-center max-w-xl mx-auto">
              <p className="editorial-kicker">Quy trình học tập cốt lõi</p>
              <h2
                id="how-it-works-heading"
                className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-[var(--color-text)]"
              >
                Cách thức hoạt động
              </h2>
            </div>

            <div className="mt-7 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 lg:gap-3">
              {HOW_IT_WORKS_STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <React.Fragment key={step.num}>
                    <div className="flex-1 flex items-start gap-4 rounded-xl p-4 sm:p-5 bg-[var(--color-bg)]/55 border border-[var(--color-border)]/85">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono-num text-sm font-semibold mt-0.5"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          color: 'var(--color-on-primary)',
                        }}
                      >
                        {step.num}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0 text-[var(--color-gold)]" aria-hidden="true" />
                          <h3 className="font-display text-base font-semibold leading-snug text-[var(--color-text)]">
                            {step.title}
                          </h3>
                        </div>
                        <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-[var(--color-text-muted)]">
                          {step.detail}
                        </p>
                      </div>
                    </div>
                    {index < HOW_IT_WORKS_STEPS.length - 1 && (
                      <div
                        aria-hidden="true"
                        className="hidden lg:flex items-center justify-center shrink-0 text-[var(--color-gold)] px-1"
                      >
                        <ArrowRight className="h-5 w-5" />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </motion.section>

          <ChapterDividerSvg className="w-full max-w-xs mx-auto my-10" />

          {/* Section 3: Featured Library Documents */}
          <section aria-labelledby="featured-library-heading">
            <SectionHeading
              id="featured-library-heading"
              title="Thư viện tài liệu nổi bật"
              description="Những chuyên luận nền tảng để khởi đầu hành trình đọc sâu, phân tích khái niệm và tranh biện."
              action={
                <Link
                  to="/library"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:underline whitespace-nowrap"
                >
                  Xem toàn bộ Library
                  <ArrowRight className="h-4 w-4" />
                </Link>
              }
            />

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {featuredDocs.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} />
              ))}
            </div>
          </section>

          {/* Section 4: 5-Column Core Values Ecosystem ("Về dự án") */}
          <motion.section
            id="ve-du-an"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            aria-labelledby="core-values-heading"
            className="mt-14 rounded-2xl overflow-hidden surface-card scroll-mt-20"
          >
            <div
              className="px-6 py-4 text-center border-b border-[var(--color-border)]"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-surface-muted) 65%, var(--color-surface) 35%)',
              }}
            >
              <h2
                id="core-values-heading"
                className="font-display text-lg sm:text-xl font-semibold tracking-tight text-[var(--color-text)]"
              >
                Mạch Ngôn V1 — Hệ sinh thái học tập và tư duy toàn diện
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 lg:divide-x divide-[var(--color-border)]">
              {CORE_VALUES.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex flex-col items-center text-center px-5 py-7"
                  >
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-border)]"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--color-primary) 9%, var(--color-bg) 91%)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-display text-sm font-bold leading-snug text-[var(--color-text)]">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.section>
        </div>
      </main>

      {/* Refined Compact Editorial Footer (Deep ink bar in light presets matching reference; muted surface in dark mode) */}
      <footer
        className="border-t border-[var(--color-border)] transition-colors duration-250"
        style={
          isDark
            ? { backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }
            : { backgroundColor: 'var(--color-text)', color: 'var(--color-bg)' }
        }
      >
        <div className="mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-10 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" showWordmark={false} inverted={!isDark} />
            <div>
              <div className="font-display text-base font-bold tracking-tight">MẠCH NGÔN V1</div>
              <div className="text-xs opacity-75">
                Tri thức để hiểu · Tư duy để khám phá · Dự án học tập & nghiên cứu ngôn ngữ.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium">
            <Link to="/library" className="opacity-85 hover:opacity-100 hover:underline transition-opacity">
              Library
            </Link>
            <Link to="/lab" className="opacity-85 hover:opacity-100 hover:underline transition-opacity">
              Thinking Lab
            </Link>
            <Link to="/guide" className="opacity-85 hover:opacity-100 hover:underline transition-opacity">
              Hướng dẫn
            </Link>
            <Link to="/onboarding" className="opacity-85 hover:opacity-100 hover:underline transition-opacity">
              Khảo sát học tập
            </Link>
            <Link to="/profile" className="opacity-85 hover:opacity-100 hover:underline transition-opacity">
              Hồ sơ & Bảng màu
            </Link>
            <span className="opacity-30 hidden sm:inline" aria-hidden="true">|</span>
            <span className="font-normal opacity-75">Cùng bạn trên hành trình tri thức · © 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
