import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound, X } from 'lucide-react';
import { BrandLogo } from '../components/brand/BrandLogo';
import { useToast } from '../components/ui/ToastProvider';
import { HybridMediaCard } from '../components/visuals/ThemeSyncedHero';
import { useApp } from '../lib/AppContext';
import { EDITORIAL_IMAGES } from '../lib/assets';
import { Link, useRouter } from '../lib/router';

export function AuthPage() {
  const { signIn, user } = useApp();
  const { showToast } = useToast();
  const { navigate } = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu cần tối thiểu 6 ký tự.');
      return;
    }
    if (mode === 'register') {
      if (!name.trim()) {
        setError('Vui lòng nhập họ tên đầy đủ của bạn.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Mật khẩu xác nhận chưa trùng khớp.');
        return;
      }
      if (!agreed) {
        setError('Vui lòng xác nhận đồng ý với nguyên tắc học thuật của Mạch Ngôn.');
        return;
      }
    }

    signIn(trimmedEmail, mode === 'register' ? name : user.name);
    showToast(
      mode === 'register'
        ? 'Đăng ký tài khoản thành công! Hãy hoàn tất 5 câu khảo sát sở thích học tập.'
        : 'Chào mừng bạn quay lại thư phòng Mạch Ngôn.',
      { variant: 'success' }
    );
    navigate(mode === 'register' ? '/onboarding' : '/dashboard');
  };

  const handleGoogleContinue = () => {
    signIn(user.email || 'lanphuong@machngon.edu.vn', user.name || 'Lan Phương');
    showToast('Đã đăng nhập bằng hồ sơ học viên.', { variant: 'success' });
    navigate(user.onboardingCompleted ? '/dashboard' : '/onboarding');
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = forgotEmail.trim();
    if (!cleaned || !cleaned.includes('@')) {
      showToast('Vui lòng nhập địa chỉ email hợp lệ để khôi phục.', { variant: 'warning' });
      return;
    }
    setForgotSent(true);
    showToast(
      `Yêu cầu đặt lại mật khẩu cho ${cleaned} đã được ghi nhận (môi trường học tập cục bộ).`,
      { variant: 'info' }
    );
  };

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col">
      <div className="mx-auto w-full max-w-[1000px] px-5 sm:px-8 py-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay về Trang chủ
        </Link>
      </div>

      <main className="flex-1 flex items-center justify-center px-5 sm:px-8 pb-12">
        <div className="w-full max-w-[1000px] overflow-hidden rounded-2xl surface-card grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Left Literary Split Panel */}
          <div
            className="lg:col-span-5 p-7 sm:p-9 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[var(--color-border)]"
            style={{
              backgroundColor:
                'color-mix(in srgb, var(--color-surface-muted) 45%, var(--color-surface) 55%)',
            }}
          >
            <div>
              <BrandLogo size="md" />
              <h1 className="mt-6 font-display text-2xl sm:text-[1.7rem] font-semibold leading-snug text-[var(--color-text)]">
                Không gian đọc chậm và tranh biện có căn cứ
              </h1>
              <p className="mt-3.5 font-reading text-sm sm:text-[0.95rem] italic leading-relaxed text-[var(--color-text-muted)]">
                “Đặt câu hỏi. Khám phá tri thức. Kiến tạo tư duy của riêng bạn.”
              </p>
            </div>

            <div className="mt-7 overflow-hidden rounded-xl border border-[var(--color-border)]">
              <HybridMediaCard
                src={EDITORIAL_IMAGES.coverLanguageThought}
                alt="Bàn học gỗ sồi với sách và lọ mực cổ điển"
                aspect="4/3"
              />
            </div>
          </div>

          {/* Right Form Panel */}
          <div className="lg:col-span-7 p-7 sm:p-10 flex flex-col justify-center">
            <div
              role="tablist"
              aria-label="Chọn đăng nhập hoặc đăng ký"
              className="inline-flex self-start rounded-xl p-1 border border-[var(--color-border)] bg-[var(--color-bg)]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  mode === 'login'
                    ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  mode === 'register'
                    ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                Đăng ký tài khoản
              </button>
            </div>

            <h2 className="mt-6 font-display text-2xl sm:text-[1.75rem] font-semibold text-[var(--color-text)]">
              {mode === 'login' ? 'Chào mừng trở lại thư phòng' : 'Bắt đầu hành trình tri thức'}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text-muted)]">
              {mode === 'login'
                ? 'Tiếp tục các bài đọc dở dang và sổ tay mạch lập luận của bạn.'
                : 'Tạo tài khoản cá nhân để lưu ghi chú đọc sâu và tùy chỉnh không gian học tập.'}
            </p>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl px-4 py-3 text-sm border"
                style={{
                  backgroundColor: 'var(--color-warn-bg)',
                  borderColor: 'var(--color-warn-border)',
                  color: 'var(--color-text)',
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              {mode === 'register' && (
                <div>
                  <label htmlFor="auth-name" className="block text-xs font-medium text-[var(--color-text)] mb-1.5">
                    Họ tên đầy đủ
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nguyễn Lan Phương"
                    className="input-editorial"
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-xs font-medium text-[var(--color-text)] mb-1.5">
                  Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="banhoc@machngon.edu.vn"
                  className="input-editorial"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="auth-password" className="block text-xs font-medium text-[var(--color-text)]">
                    Mật khẩu
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email);
                        setForgotSent(false);
                        setForgotOpen(true);
                      }}
                      className="text-xs font-medium text-[var(--color-primary)] hover:underline cursor-pointer"
                    >
                      Quên mật khẩu?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="input-editorial !pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <>
                  <div>
                    <label htmlFor="auth-confirm" className="block text-xs font-medium text-[var(--color-text)] mb-1.5">
                      Xác nhận mật khẩu
                    </label>
                    <input
                      id="auth-confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu"
                      className="input-editorial"
                    />
                  </div>
                  <label className="flex items-start gap-2.5 text-xs leading-relaxed text-[var(--color-text-muted)] cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-0.5 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
                    />
                    <span>
                      Tôi đồng ý tuân thủ nguyên tắc liêm chính học thuật và đối thoại tôn trọng trong Mạch Ngôn.
                    </span>
                  </label>
                </>
              )}

              <button type="submit" className="btn-primary w-full !min-h-11">
                {mode === 'login' ? 'Đăng nhập' : 'Đăng ký tài khoản'}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
              <span className="h-px flex-1 bg-[var(--color-border)]" />
              <span>hoặc</span>
              <span className="h-px flex-1 bg-[var(--color-border)]" />
            </div>

            <button
              type="button"
              onClick={handleGoogleContinue}
              className="btn-secondary w-full !min-h-11"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.2 0-5.8-2.1-6.8-5H1.2v3.1C3.2 21.4 7.3 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.2 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6H1.2C.4 8.2 0 10 0 12s.4 3.8 1.2 5.4l4-3.1z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.2 2.6 1.2 6.6l4 3.1c1-2.9 3.6-4.9 6.8-4.9z"
                />
              </svg>
              Tiếp tục với tài khoản Google (Học viên mẫu)
            </button>
          </div>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-password-title"
        >
          <div
            onClick={() => setForgotOpen(false)}
            className="fixed inset-0 bg-black/45 backdrop-blur-[1px]"
          />
          <div
            className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
            style={{ boxShadow: 'var(--shadow-float)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-primary)]">
                  <KeyRound className="h-4 w-4" />
                </span>
                <div>
                  <h2 id="forgot-password-title" className="font-display text-lg font-semibold">
                    Khôi phục mật khẩu
                  </h2>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Nhập email đã đăng ký tài khoản Mạch Ngôn.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                aria-label="Đóng hộp thoại"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {forgotSent ? (
              <div className="mt-5 space-y-4">
                <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/70 p-4 text-xs leading-relaxed text-[var(--color-text)]">
                  Mạch Ngôn V1 hiện đang lưu hồ sơ học tập cục bộ trên trình duyệt của bạn (chưa kết nối máy chủ gửi email SMTP). Bạn có thể đăng nhập lại bằng email <strong>{forgotEmail}</strong> và đặt mật khẩu mới bất kỳ từ 6 ký tự trở lên.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(forgotEmail);
                    setForgotOpen(false);
                  }}
                  className="btn-primary w-full !min-h-10 !text-xs"
                >
                  Quay lại đăng nhập
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="forgot-email" className="block text-xs font-medium mb-1.5">
                    Địa chỉ email
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="banhoc@machngon.edu.vn"
                    className="input-editorial"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setForgotOpen(false)}
                    className="btn-secondary !min-h-10 !px-4 !text-xs"
                  >
                    Hủy
                  </button>
                  <button type="submit" className="btn-primary !min-h-10 !px-4 !text-xs">
                    Gửi hướng dẫn
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
