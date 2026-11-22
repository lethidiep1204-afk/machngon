import React from 'react';
import { ArrowRight, BookOpen, BrainCircuit, Layers, Scale, ShieldCheck } from 'lucide-react';
import { WorkspaceShell } from '../components/layout/AppShell';
import { PageHeader } from '../components/ui/EditorialPrimitives';
import { ChapterDividerSvg } from '../components/visuals/EditorialSvgIllustrations';
import { Link } from '../lib/router';

export function GuidePage() {
  return (
    <WorkspaceShell>
      <div className="mx-auto max-w-[960px] px-5 sm:px-8 py-8 lg:py-10 space-y-8">
        <PageHeader
          kicker="Phương pháp luận học thuật"
          title="Hướng dẫn đọc sâu & tranh biện có căn cứ"
          description="Mạch Ngôn không đưa ra đáp án đóng gói sẵn. Thay vào đó, nền tảng cung cấp kỷ luật đọc và khung đối thoại giúp bạn tự kiểm chứng lập luận của chính mình."
        />

        {/* Pillar 1: Three Cognitive Layers */}
        <section className="rounded-2xl p-6 sm:p-8 surface-card space-y-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)]"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-primary) 9%, var(--color-surface) 91%)',
                color: 'var(--color-primary)',
              }}
            >
              <Layers className="h-5 w-5" />
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-[var(--color-text)]">
              1. Kỷ luật tách bạch 3 tầng nhận thức
            </h2>
          </div>
          <p className="font-reading text-[0.98rem] leading-[1.78] text-[var(--color-text-muted)]">
            Phần lớn tranh cãi đi vào ngõ cụt vì người nói trộn lẫn dữ kiện khách quan với giả định ngầm và đánh giá cá nhân. Mọi phản hồi trong Thinking Lab đều tách rõ ba tầng:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {[
              {
                tag: '[1. SỰ THẬT / DỮ KIỆN]',
                color: 'var(--color-primary)',
                body: 'Thông tin có thể kiểm chứng hoặc định nghĩa nguyên bản từ tài liệu. Nếu thiếu dữ liệu, hệ thống nói rõ là thiếu chứ không bịa nguồn.',
              },
              {
                tag: '[2. GIẢ ĐỊNH NGẦM]',
                color: 'var(--color-gold)',
                body: 'Những tiền đề chưa được nói ra mà lập luận đang mặc nhiên dựa vào — thường là điểm mù quan trọng nhất của một cuộc tranh luận.',
              },
              {
                tag: '[3. Ý KIẾN / DIỄN GIẢI]',
                color: 'var(--color-text)',
                body: 'Nhận định giá trị, phản đề đối trọng và đánh giá chủ quan có lý lẽ để bạn tiếp tục đối thoại hoặc điều chỉnh lập trường.',
              },
            ].map((item) => (
              <div
                key={item.tag}
                className="rounded-xl p-4 sm:p-5 border border-[var(--color-border)] bg-[var(--color-bg)]/50"
              >
                <div
                  className="text-[11px] font-semibold uppercase tracking-[0.06em]"
                  style={{ color: item.color }}
                >
                  {item.tag}
                </div>
                <p className="mt-2.5 font-reading text-xs sm:text-[0.875rem] leading-relaxed text-[var(--color-text-muted)]">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Pillar 2: 5-Step Debate Engine */}
        <section className="rounded-2xl p-6 sm:p-8 surface-card space-y-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)]"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-primary) 9%, var(--color-surface) 91%)',
                color: 'var(--color-primary)',
              }}
            >
              <Scale className="h-5 w-5" />
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-[var(--color-text)]">
              2. Quy trình tranh biện 5 bước (Debate Engine)
            </h2>
          </div>
          <ol className="divide-y divide-[var(--color-border)]">
            {[
              ['01', 'Identify (Xác định)', 'Làm rõ luận điểm trung tâm, phạm vi khẳng định và phát hiện các từ khóa tuyệt đối hóa.'],
              ['02', 'Analyze (Phân tích)', 'Áp dụng Nguyên tắc Bác ái (Principle of Charity) để diễn giải ý bạn ở dạng mạnh nhất trước khi bóc tách giả định ngầm.'],
              ['03', 'Challenge (Thử thách)', 'Đưa ra phản ví dụ thực tiễn, trường hợp biên hoặc lỗ hổng suy luận để kiểm thử độ bền của lập luận.'],
              ['04', 'Synthesize (Tổng hợp)', 'Đối chiếu với các lượt U#n / A#n trước đó trong Sổ tay mạch lập luận để phát hiện mâu thuẫn hoặc dịch chuyển tiêu chí.'],
              ['05', 'Respond (Phản hồi)', 'Trình bày câu trả lời có chiều sâu theo 3 tầng nhận thức và kết thúc bằng 1 câu hỏi gợi mở sắc bén.'],
            ].map(([num, title, desc]) => (
              <li
                key={num}
                className="py-4 first:pt-1 last:pb-0 flex flex-col sm:flex-row sm:items-baseline gap-1.5 sm:gap-5"
              >
                <div className="flex items-baseline gap-2.5 sm:w-56 shrink-0">
                  <span className="font-mono-num text-xs font-semibold text-[var(--color-primary)]">
                    {num}.
                  </span>
                  <span className="font-display text-base font-semibold text-[var(--color-text)]">
                    {title}
                  </span>
                </div>
                <span className="font-reading text-sm leading-relaxed text-[var(--color-text-muted)]">
                  {desc}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* Pillar 3: Library -> Thinking Lab Bridge */}
        <section className="rounded-2xl p-6 sm:p-8 surface-card space-y-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)]"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-primary) 9%, var(--color-surface) 91%)',
                color: 'var(--color-primary)',
              }}
            >
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-[var(--color-text)]">
              3. Mẹo sử dụng Library và Thinking Lab liền mạch
            </h2>
          </div>
          <ul className="space-y-3.5 font-reading text-[0.95rem] leading-[1.75] text-[var(--color-text-muted)]">
            <li className="rounded-xl p-4 surface-subtle">
              <strong className="font-ui text-sm text-[var(--color-text)]">
                Chế độ Đọc tập trung (phím F):
              </strong>{' '}
              Trong trang chi tiết tài liệu, bấm phím{' '}
              <code className="font-mono-num text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]">
                F
              </code>{' '}
              để ẩn các thanh công cụ hai bên và tập trung hoàn toàn vào văn bản.
            </li>
            <li className="rounded-xl p-4 surface-subtle">
              <strong className="font-ui text-sm text-[var(--color-text)]">
                Chuyển đoạn trích không đứt mạch đọc:
              </strong>{' '}
              Bấm nút <em>“Hỏi trong Lab”</em> trên từng khối bài đọc (hoặc bôi đen đoạn văn trên máy tính) để điền sẵn trích dẫn vào khung soạn thảo. Khi quay lại bài đọc từ chip ngữ cảnh trong Lab, trang tự cuộn về đúng vị trí bạn đang đọc dở.
            </li>
            <li className="rounded-xl p-4 surface-subtle">
              <strong className="font-ui text-sm text-[var(--color-text)]">
                Kiểm tra nhất quán dài hạn:
              </strong>{' '}
              Sau nhiều lượt trao đổi, bấm nút <em>“Trích dẫn”</em> cạnh bất kỳ mốc{' '}
              <code className="font-mono-num text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]">
                U#n
              </code>{' '}
              hoặc{' '}
              <code className="font-mono-num text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]">
                A#n
              </code>{' '}
              nào trong Sổ tay mạch lập luận để chất vấn lại điểm mâu thuẫn.
            </li>
          </ul>
        </section>

        <ChapterDividerSvg />

        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <Link to="/library" className="btn-secondary">
            <BookOpen className="h-4 w-4 text-[var(--color-primary)]" />
            Đọc tài liệu trong Library
          </Link>
          <Link to="/lab" className="btn-primary">
            <BrainCircuit className="h-4 w-4" />
            Thực hành ngay trong Thinking Lab
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </WorkspaceShell>
  );
}
