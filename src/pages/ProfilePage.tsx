import React, { lazy, Suspense, useState } from 'react';
import {
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  History,
  LogOut,
  MessageSquareText,
  Palette,
  Save,
  Shield,
  Sliders,
  UserCheck,
} from 'lucide-react';
import { WorkspaceShell } from '../components/layout/AppShell';
import { useTheme } from '../components/theme/ThemeProvider';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { PageHeader } from '../components/ui/EditorialPrimitives';
import { useToast } from '../components/ui/ToastProvider';
import { ToggleSwitch } from '../components/ui/UiControls';
import { useApp } from '../lib/AppContext';
import { PRESET_LIST } from '../lib/palettes';
import { Link, useRouter } from '../lib/router';

// Code-split Tier 2 Color Customizer so initial bundle stays lean
const Tier2ColorCustomizer = lazy(
  () => import('../components/theme/Tier2ColorCustomizer')
);

const INTEREST_SUGGESTIONS = [
  'Ngữ văn',
  'Triết học và tư tưởng',
  'Ngôn ngữ',
  'Tư duy và lập luận',
  'Văn hóa - xã hội',
  'Lịch sử - Văn hóa',
  'Kỹ năng viết',
];

const AVATAR_TINTS = [
  { id: 'primary', label: 'Đỏ rượu / Chủ đạo', color: 'var(--color-primary)' },
  { id: 'gold', label: 'Vàng đồng', color: 'var(--color-gold)' },
  { id: 'success', label: 'Lục trầm', color: 'var(--color-success)' },
];

export function ProfilePage() {
  const { user, updateUser, signOut, savedDocIds, sessions, notes } = useApp();
  const { config, selectPreset } = useTheme();
  const { showToast } = useToast();
  const { navigate } = useRouter();

  const [name, setName] = useState(user.name);
  const [roleLabel, setRoleLabel] = useState(user.roleLabel);
  const [bio, setBio] = useState(user.bio ?? 'Học để hiểu, hiểu để sống sâu hơn.');
  const [goal, setGoal] = useState(user.goal);
  const [avatarTint, setAvatarTint] = useState(user.avatarTint ?? 'primary');
  const [interests, setInterests] = useState<string[]>(user.interests);

  // Tier 2 drawer is collapsed by default per architecture spec
  const [tier2Open, setTier2Open] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);

  const notifications = user.notifications ?? {
    dailyQuoteReminder: true,
    labFollowUpSuggestions: true,
    libraryNewHighlights: false,
  };
  const privacy = user.privacy ?? {
    saveReadingProgress: true,
    saveLabHistory: true,
  };

  const toggleInterest = (topic: string) => {
    setInterests((prev) =>
      prev.includes(topic) ? prev.filter((item) => item !== topic) : [...prev, topic]
    );
  };

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Vui lòng nhập họ tên hiển thị của bạn.', { variant: 'warning' });
      return;
    }
    updateUser({
      name: name.trim(),
      roleLabel: roleLabel.trim() || 'Người học tự do',
      bio: bio.trim(),
      goal: goal.trim() || user.goal,
      avatarTint,
      interests: interests.length > 0 ? interests : ['Triết học và tư tưởng'],
    });
    showToast('Đã lưu thay đổi hồ sơ cá nhân.', { variant: 'success' });
  };

  const avatarAccent =
    AVATAR_TINTS.find((t) => t.id === avatarTint)?.color ?? 'var(--color-primary)';

  return (
    <WorkspaceShell>
      <div className="mx-auto max-w-[1060px] px-5 sm:px-8 py-8 lg:py-10 space-y-8">
        <PageHeader
          kicker="Tài khoản · Cá nhân hóa thư phòng & thị lực đọc sâu"
          title="Hồ sơ & Cài đặt"
          description="Quản lý thông tin tài khoản, sở thích học tập, hoạt động gần đây, giao diện đọc sách và quyền riêng tư."
          action={
            user.isAuthenticated ? (
              <button
                type="button"
                onClick={() => setSignOutConfirmOpen(true)}
                className="btn-secondary !min-h-10 !px-4 !text-xs"
              >
                <LogOut className="h-3.5 w-3.5" />
                Đăng xuất
              </button>
            ) : (
              <Link to="/auth" className="btn-primary !min-h-10 !px-4 !text-xs">
                <UserCheck className="h-3.5 w-3.5" />
                Đăng nhập tài khoản
              </Link>
            )
          }
        />

        {/* Quick Real Activity & Identity Overview */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-5 rounded-2xl p-6 surface-card flex flex-col justify-between gap-5">
            <div className="flex items-center gap-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl font-display text-2xl font-bold border border-[var(--color-border)]"
                style={{
                  backgroundColor: `color-mix(in srgb, ${avatarAccent} 16%, var(--color-bg) 84%)`,
                  color: avatarAccent,
                }}
              >
                {(name || user.name).slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold truncate text-[var(--color-text)]">
                  {name || user.name}
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] truncate">{roleLabel}</p>
                <p className="mt-0.5 text-[11px] font-mono-num text-[var(--color-text-muted)] truncate">
                  {user.email}
                </p>
              </div>
            </div>

            {bio && (
              <blockquote className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/55 px-4 py-3 font-reading text-sm italic text-[var(--color-text)]">
                “{bio}”
              </blockquote>
            )}

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
              <span className="text-xs text-[var(--color-text-muted)]">Sắc độ ảnh đại diện:</span>
              <div className="flex items-center gap-2">
                {AVATAR_TINTS.map((tint) => (
                  <button
                    key={tint.id}
                    type="button"
                    onClick={() => setAvatarTint(tint.id)}
                    aria-label={tint.label}
                    aria-pressed={avatarTint === tint.id}
                    className={`h-6 w-6 rounded-full border-2 transition-transform cursor-pointer ${
                      avatarTint === tint.id ? 'scale-110 border-[var(--color-text)]' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: tint.color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 rounded-2xl p-6 surface-card flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-[var(--color-text)]">
                Tóm lược hoạt động học tập
              </h2>
              <Link
                to="/history"
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
              >
                <History className="h-3.5 w-3.5" />
                Xem lịch sử đầy đủ
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Link
                to="/library"
                className="rounded-xl p-4 border border-[var(--color-border)] bg-[var(--color-bg)]/50 hover:border-[var(--color-primary)]/45 transition-colors"
              >
                <BookOpen className="h-4 w-4 text-[var(--color-primary)]" />
                <div className="mt-2 font-display text-2xl font-bold font-mono-num text-[var(--color-text)]">
                  {savedDocIds.length}
                </div>
                <div className="text-[11px] text-[var(--color-text-muted)]">Tài liệu đã lưu</div>
              </Link>

              <Link
                to="/lab"
                className="rounded-xl p-4 border border-[var(--color-border)] bg-[var(--color-bg)]/50 hover:border-[var(--color-primary)]/45 transition-colors"
              >
                <MessageSquareText className="h-4 w-4 text-[var(--color-primary)]" />
                <div className="mt-2 font-display text-2xl font-bold font-mono-num text-[var(--color-text)]">
                  {sessions.length}
                </div>
                <div className="text-[11px] text-[var(--color-text-muted)]">Phiên Thinking Lab</div>
              </Link>

              <Link
                to="/history"
                className="rounded-xl p-4 border border-[var(--color-border)] bg-[var(--color-bg)]/50 hover:border-[var(--color-primary)]/45 transition-colors"
              >
                <History className="h-4 w-4 text-[var(--color-primary)]" />
                <div className="mt-2 font-display text-2xl font-bold font-mono-num text-[var(--color-text)]">
                  {notes.length}
                </div>
                <div className="text-[11px] text-[var(--color-text-muted)]">Ghi chú đọc chậm</div>
              </Link>
            </div>

            <div className="text-xs text-[var(--color-text-muted)] leading-relaxed pt-1 border-t border-[var(--color-border)]/70">
              <span>Định hướng hiện tại: </span>
              <strong className="font-medium text-[var(--color-text)]">{user.readingDepth}</strong>
              {user.confidenceLevel && (
                <>
                  <span> · </span>
                  <span>{user.confidenceLevel}</span>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Section 1: Editable Account Info & Learning Interests */}
        <section className="rounded-2xl p-6 sm:p-7 surface-card">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--color-border)]">
            <div>
              <h2 className="font-display text-xl font-semibold text-[var(--color-text)]">
                Thông tin cá nhân & Sở thích học tập
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Cập nhật tên hiển thị, châm ngôn học tập và lĩnh vực tri thức bạn quan tâm.
              </p>
            </div>
            <Link
              to="/onboarding"
              className="text-xs font-medium text-[var(--color-primary)] hover:underline whitespace-nowrap"
            >
              Chỉnh lại khảo sát 5 bước
            </Link>
          </div>

          <form onSubmit={handleProfileSave} className="mt-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-name" className="block text-xs font-medium text-[var(--color-text)] mb-1.5">
                  Họ tên hiển thị
                </label>
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-editorial"
                />
              </div>

              <div>
                <label htmlFor="profile-role" className="block text-xs font-medium text-[var(--color-text)] mb-1.5">
                  Vai trò học tập
                </label>
                <input
                  id="profile-role"
                  type="text"
                  value={roleLabel}
                  onChange={(e) => setRoleLabel(e.target.value)}
                  className="input-editorial"
                />
              </div>

              <div>
                <label htmlFor="profile-bio" className="block text-xs font-medium text-[var(--color-text)] mb-1.5">
                  Châm ngôn / Giới thiệu ngắn
                </label>
                <input
                  id="profile-bio"
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Học để hiểu, hiểu để sống sâu hơn."
                  className="input-editorial"
                />
              </div>

              <div>
                <label htmlFor="profile-goal" className="block text-xs font-medium text-[var(--color-text)] mb-1.5">
                  Mục tiêu tư duy trọng tâm
                </label>
                <input
                  id="profile-goal"
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="input-editorial"
                />
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-[var(--color-text)] mb-2">
                Lĩnh vực tri thức yêu thích (chọn nhiều)
              </div>
              <div className="flex flex-wrap gap-2">
                {INTEREST_SUGGESTIONS.map((topic) => {
                  const active = interests.includes(topic);
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => toggleInterest(topic)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]'
                          : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text)]'
                      }`}
                    >
                      {active && <Check className="h-3 w-3" />}
                      {topic}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-[var(--color-border)]/70">
              <button type="submit" className="btn-primary !min-h-10 !px-5 !text-xs">
                <Save className="h-3.5 w-3.5" />
                Lưu thay đổi hồ sơ
              </button>
            </div>
          </form>
        </section>

        {/* Section 2: Two-Tier Palette Architecture (Văn Hiến Default + Tinh Mộng Mystic Purple) */}
        <section className="rounded-2xl p-6 sm:p-7 surface-card space-y-6">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--color-border)]">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-primary)]">
                <Palette className="h-4 w-4" />
                <span>Hệ thống giao diện 2 tầng · Chuẩn tương phản WCAG 2.1 AA</span>
              </div>
              <h2 className="mt-1.5 font-display text-xl font-semibold text-[var(--color-text)]">
                Tầng 1 — Không gian đọc (Học thuật cổ điển & Tím huyền ảo Tinh Mộng)
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
                Chuyển đổi mượt mà giữa phong cách học thuật cổ điển (Văn Hiến), tím huyền ảo ánh sao (Tinh Mộng) cùng 2 không gian đọc bổ trợ.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PRESET_LIST.map((preset) => {
              const selected = config.presetId === preset.id && config.colorMode === 'preset';
              const swatches = preset.swatches ?? [
                preset.tokens.bg,
                preset.tokens.surface,
                preset.tokens.text,
                preset.tokens.primary,
                preset.tokens.gold,
              ];
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    selectPreset(preset.id);
                    showToast(`Đã chuyển sang giao diện "${preset.name}".`, { variant: 'info' });
                  }}
                  aria-pressed={selected}
                  className={`text-left rounded-2xl p-4 border transition-all duration-200 cursor-pointer ${
                    selected
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
                    {selected && (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
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
                    className="mt-1 text-xs leading-snug"
                    style={{ color: preset.tokens.textMuted }}
                  >
                    {preset.subtitle}
                  </p>
                  <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
                    {swatches.map((swatch, idx) => (
                      <span
                        key={idx}
                        className="h-4 w-4 rounded-full border border-black/15"
                        style={{ backgroundColor: swatch }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tier 2: Collapsed by default, Lazy-Loaded Drawer */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/45 overflow-hidden">
            <button
              type="button"
              onClick={() => setTier2Open((v) => !v)}
              aria-expanded={tier2Open}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-[var(--color-surface-muted)]/45 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Sliders className="h-4.5 w-4.5 text-[var(--color-primary)] shrink-0" />
                <div>
                  <div className="font-display text-base font-semibold text-[var(--color-text)]">
                    Tầng 2 — Tùy chỉnh bảng màu nâng cao & Kiểm định WCAG 2.1
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Chế độ Nhanh (3 màu lõi color-mix) · Chế độ Chi tiết (8 mã HEX) · Live Preview 4 thành phần
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] shrink-0 whitespace-nowrap">
                {tier2Open ? 'Thu gọn' : 'Mở tùy chỉnh'}
                {tier2Open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>

            {tier2Open && (
              <div className="px-5 pb-6 border-t border-[var(--color-border)]">
                <Suspense
                  fallback={
                    <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">
                      Đang tải bộ tinh chỉnh màu Tầng 2…
                    </div>
                  }
                >
                  <Tier2ColorCustomizer />
                </Suspense>
              </div>
            )}
          </div>
        </section>

        {/* Section 3: Notification & Privacy Preferences (Working Toggles) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl p-6 surface-card">
            <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
              <Bell className="h-4 w-4 text-[var(--color-primary)]" />
              <h2 className="font-display text-lg font-semibold">Cài đặt thông báo & gợi ý</h2>
            </div>
            <div className="divide-y divide-[var(--color-border)]/70">
              <ToggleSwitch
                id="pref-daily-quote"
                label="Hiển thị Danh ngôn hôm nay"
                description="Đồng bộ câu danh ngôn học thuật mỗi ngày mới theo giờ Việt Nam."
                checked={notifications.dailyQuoteReminder}
                onChange={(next) => {
                  updateUser({ notifications: { ...notifications, dailyQuoteReminder: next } });
                  showToast('Đã cập nhật tùy chọn Danh ngôn hôm nay.', { variant: 'info' });
                }}
              />
              <ToggleSwitch
                id="pref-lab-followup"
                label="Gợi ý tài liệu sau phiên Thinking Lab"
                description="Đề xuất bài đọc liên quan trong Library ngay dưới cuộc đối thoại."
                checked={notifications.labFollowUpSuggestions}
                onChange={(next) => {
                  updateUser({
                    notifications: { ...notifications, labFollowUpSuggestions: next },
                  });
                  showToast('Đã cập nhật gợi ý đọc tiếp trong Thinking Lab.', { variant: 'info' });
                }}
              />
              <ToggleSwitch
                id="pref-lib-highlights"
                label="Đánh dấu chuyên luận mới xuất bản"
                description="Ưu tiên hiển thị học liệu mới biên tập trên trang Tổng quan."
                checked={notifications.libraryNewHighlights}
                onChange={(next) => {
                  updateUser({
                    notifications: { ...notifications, libraryNewHighlights: next },
                  });
                  showToast('Đã lưu cài đặt thông báo thư viện.', { variant: 'info' });
                }}
              />
            </div>
          </div>

          <div className="rounded-2xl p-6 surface-card">
            <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
              <Shield className="h-4 w-4 text-[var(--color-primary)]" />
              <h2 className="font-display text-lg font-semibold">Quyền riêng tư & dữ liệu</h2>
            </div>
            <div className="divide-y divide-[var(--color-border)]/70">
              <ToggleSwitch
                id="pref-save-read"
                label="Ghi nhớ vị trí đọc trong Library"
                description="Lưu tiến độ cuộn bài đọc cục bộ trong phiên trình duyệt."
                checked={privacy.saveReadingProgress}
                onChange={(next) => {
                  updateUser({ privacy: { ...privacy, saveReadingProgress: next } });
                  showToast('Đã cập nhật cài đặt lưu tiến độ đọc.', { variant: 'info' });
                }}
              />
              <ToggleSwitch
                id="pref-save-lab"
                label="Lưu Sổ tay mạch lập luận cục bộ"
                description="Tự động lưu các phiên Thinking Lab và bản thảo trên thiết bị của bạn."
                checked={privacy.saveLabHistory}
                onChange={(next) => {
                  updateUser({ privacy: { ...privacy, saveLabHistory: next } });
                  showToast('Đã cập nhật quyền lưu trữ lịch sử Thinking Lab.', { variant: 'info' });
                }}
              />
            </div>
          </div>
        </section>
      </div>

      <ConfirmModal
        open={signOutConfirmOpen}
        title="Đăng xuất khỏi thư phòng?"
        description="Các ghi chú đọc chậm và phiên Thinking Lab cục bộ của bạn vẫn được giữ an toàn trên thiết bị này."
        confirmLabel="Đăng xuất"
        onCancel={() => setSignOutConfirmOpen(false)}
        onConfirm={() => {
          setSignOutConfirmOpen(false);
          signOut();
          showToast('Bạn đã đăng xuất thành công.', { variant: 'info' });
          navigate('/');
        }}
      />
    </WorkspaceShell>
  );
}
