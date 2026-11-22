import type { DocumentCategory, LibraryCategoryMeta } from '../../lib/types';

export const DEFAULT_LIBRARY_CATEGORIES: LibraryCategoryMeta[] = [
  {
    id: 'ngon-ngu-hoc',
    name: 'Ngôn ngữ học',
    shortName: 'Ngôn ngữ học',
    description:
      'Khám phá cấu trúc ngôn ngữ, ngữ nghĩa, ngữ dụng học, ẩn dụ ý niệm và mối quan hệ biện chứng giữa ngôn từ với tư duy.',
    iconKey: 'languages',
    order: 1,
  },
  {
    id: 'van-hoc-ly-luan',
    name: 'Văn học và lý luận văn học',
    shortName: 'Văn học',
    description:
      'Tiếp cận thi pháp học, tự sự học, lý thuyết tiếp nhận và tinh thần đối thoại liên văn bản trong văn chương Việt Nam và thế giới.',
    iconKey: 'feather',
    order: 2,
  },
  {
    id: 'triet-hoc-tu-tuong',
    name: 'Triết học và tư tưởng',
    shortName: 'Triết học',
    description:
      'Đối thoại cùng các trào lưu tư tưởng lớn về tự do, đạo đức đức hạnh, tri thức luận và phương pháp truy vấn Socrates.',
    iconKey: 'landmark',
    order: 3,
  },
  {
    id: 'logic-lap-luan',
    name: 'Logic và lập luận',
    shortName: 'Logic & Lập luận',
    description:
      'Rèn luyện cấu trúc suy diễn hợp lệ, mô hình lập luận Toulmin, suy luận quy nạp và kỹ năng nhận diện ngụy biện.',
    iconKey: 'scale',
    order: 4,
  },
  {
    id: 'tu-duy-phan-bien',
    name: 'Tư duy phản biện',
    shortName: 'Phản biện',
    description:
      'Thực hành Nguyên tắc Bác ái, bóc tách giả định ngầm, nhận diện thiên kiến nhận thức và kiểm chứng nguồn thông tin.',
    iconKey: 'compass',
    order: 5,
  },
  {
    id: 'kien-thuc-lien-nganh',
    name: 'Kiến thức liên ngành',
    shortName: 'Liên ngành',
    description:
      'Kết nối đạo đức AI, sinh thái học văn hóa, kinh tế học hành vi và không gian công cộng trong kỷ nguyên số.',
    iconKey: 'layers',
    order: 6,
  },
];

export const LEGACY_CATEGORY_MAP: Record<string, DocumentCategory> = {
  'ngôn ngữ học': 'Ngôn ngữ học',
  'ngôn ngữ': 'Ngôn ngữ học',
  'kỹ năng viết': 'Ngôn ngữ học',
  'văn học và lý luận văn học': 'Văn học và lý luận văn học',
  'ngữ văn': 'Văn học và lý luận văn học',
  'văn học': 'Văn học và lý luận văn học',
  'triết học và tư tưởng': 'Triết học và tư tưởng',
  'triết học - tư tưởng': 'Triết học và tư tưởng',
  'triết học': 'Triết học và tư tưởng',
  'logic và lập luận': 'Logic và lập luận',
  'tư duy - lập luận': 'Logic và lập luận',
  'tư duy và lập luận': 'Logic và lập luận',
  'tư duy phản biện': 'Tư duy phản biện',
  'kiến thức liên ngành': 'Kiến thức liên ngành',
  'văn hóa - xã hội': 'Kiến thức liên ngành',
  'lịch sử - văn hóa': 'Kiến thức liên ngành',
  'khác': 'Kiến thức liên ngành',
};

export interface EditorialRoadmapTopic {
  title: string;
  category: DocumentCategory;
  publishedDocId?: string;
}

/**
 * 60-topic editorial curriculum across 6 canonical disciplines
 * (24 published & verified documents + 36 scheduled upcoming topics).
 */
export const EDITORIAL_TOPIC_ROADMAP: EditorialRoadmapTopic[] = [
  // 1. Ngôn ngữ học (4 published + 6 upcoming)
  {
    title: 'Ngôn ngữ và tư duy: Mối liên hệ biện chứng',
    category: 'Ngôn ngữ học',
    publishedDocId: 'ngon-ngu-va-tu-duy-moi-lien-he-bien-chung',
  },
  {
    title: 'Phong cách ngôn ngữ và ẩn dụ trong đời sống',
    category: 'Ngôn ngữ học',
    publishedDocId: 'phong-cach-ngon-ngu-va-an-du-trong-doi-song',
  },
  {
    title: 'Ngữ dụng học và hàm ngôn trong giao tiếp hằng ngày',
    category: 'Ngôn ngữ học',
    publishedDocId: 'ngu-dung-hoc-va-ham-ngon-trong-giao-tiep',
  },
  {
    title: 'Ký hiệu học và cấu trúc tạo nghĩa của ngôn từ',
    category: 'Ngôn ngữ học',
    publishedDocId: 'ky-hieu-hoc-va-cau-truc-cua-nghia',
  },
  { title: 'Hành vi ngôn từ (Speech Acts) và sức mạnh của lời nói', category: 'Ngôn ngữ học' },
  { title: 'Diễn ngôn quyền lực và phân tích diễn ngôn phê phán', category: 'Ngôn ngữ học' },
  { title: 'Lịch sử biến đổi ngữ nghĩa tiếng Việt qua các thời kỳ', category: 'Ngôn ngữ học' },
  { title: 'Song ngữ, chuyển mã và năng lực linh hoạt nhận thức', category: 'Ngôn ngữ học' },
  { title: 'Mạch lạc và liên kết trong văn bản nghị luận học thuật', category: 'Ngôn ngữ học' },
  { title: 'Ngôn ngữ mạng và sự tiến hóa của chuẩn mực giao tiếp', category: 'Ngôn ngữ học' },

  // 2. Văn học và lý luận văn học (4 published + 6 upcoming)
  {
    title: 'Vẻ đẹp hàm súc của thơ ca cổ điển Việt Nam',
    category: 'Văn học và lý luận văn học',
    publishedDocId: 've-dep-ham-suc-cua-tho-ca-co-dien-viet-nam',
  },
  {
    title: 'Người kể chuyện và điểm nhìn tự sự trong văn xuôi hiện đại',
    category: 'Văn học và lý luận văn học',
    publishedDocId: 'nguoi-ke-chuyen-va-diem-nhin-tu-su',
  },
  {
    title: 'Lý thuyết tiếp nhận và vai trò đồng sáng tạo của người đọc',
    category: 'Văn học và lý luận văn học',
    publishedDocId: 'ly-thuyet-tiep-nhan-va-vai-tro-cua-nguoi-doc',
  },
  {
    title: 'Liên văn bản và tinh thần đối thoại trong tác phẩm văn học',
    category: 'Văn học và lý luận văn học',
    publishedDocId: 'lien-van-ban-va-doi-thoai-trong-van-hoc',
  },
  { title: 'Biểu tượng, cổ mẫu và chiều sâu văn hóa trong truyện kể', category: 'Văn học và lý luận văn học' },
  { title: 'Tính đa thanh và tiểu thuyết hiện đại theo Mikhail Bakhtin', category: 'Văn học và lý luận văn học' },
  { title: 'Cấu trúc bi kịch từ Aristotle đến sân khấu đương đại', category: 'Văn học và lý luận văn học' },
  { title: 'Phê bình sinh thái và hình tượng thiên nhiên trong văn chương', category: 'Văn học và lý luận văn học' },
  { title: 'Chủ nghĩa hiện thực và giới hạn của nghệ thuật mô phỏng', category: 'Văn học và lý luận văn học' },
  { title: 'Thơ tự do và nhịp điệu tư duy trong thi ca thế kỷ XX', category: 'Văn học và lý luận văn học' },

  // 3. Triết học và tư tưởng (4 published + 6 upcoming)
  {
    title: 'Triết học hiện sinh: Con người và sự tự do',
    category: 'Triết học và tư tưởng',
    publishedDocId: 'triet-hoc-hien-sinh-con-nguoi-va-su-tu-do',
  },
  {
    title: 'Phương pháp đối thoại Socrates và nghệ thuật đặt câu hỏi',
    category: 'Triết học và tư tưởng',
    publishedDocId: 'phuong-phap-doi-thoai-socrates-va-nghe-thuat-dat-cau-hoi',
  },
  {
    title: 'Đạo đức học đức hạnh và quan niệm hạnh phúc của Aristotle',
    category: 'Triết học và tư tưởng',
    publishedDocId: 'dao-duc-hoc-duc-hanh-va-hanh-phuc-aristotle',
  },
  {
    title: 'Chủ nghĩa Khắc kỷ và tự do nội tâm trước biến cố',
    category: 'Triết học và tư tưởng',
    publishedDocId: 'chu-nghia-khac-ky-va-tu-do-noi-tam',
  },
  { title: 'Mệnh lệnh tuyệt đối của Immanuel Kant và đạo đức bổn phận', category: 'Triết học và tư tưởng' },
  { title: 'Chủ nghĩa vị lợi và bài toán đánh đổi lợi ích cộng đồng', category: 'Triết học và tư tưởng' },
  { title: 'Công lý như sự công bằng trong triết học John Rawls', category: 'Triết học và tư tưởng' },
  { title: 'Hiện tượng học và cách trở về với trải nghiệm sống', category: 'Triết học và tư tưởng' },
  { title: 'Tư tưởng Nho – Đạo – Phật trong đối thoại với triết học hiện đại', category: 'Triết học và tư tưởng' },
  { title: 'Tri thức luận: Làm sao chúng ta biết mình thật sự biết?', category: 'Triết học và tư tưởng' },

  // 4. Logic và lập luận (4 published + 6 upcoming)
  {
    title: 'Ngụy biện trong diễn ngôn công cộng và cách nhận diện',
    category: 'Logic và lập luận',
    publishedDocId: 'nguy-bien-trong-dien-ngon-cong-cong',
  },
  {
    title: 'Tam đoạn luận và ranh giới giữa hợp lệ với vững chắc',
    category: 'Logic và lập luận',
    publishedDocId: 'tam-doan-luan-va-cau-truc-suy-dien-hop-le',
  },
  {
    title: 'Mô hình lập luận Toulmin trong viết luận học thuật',
    category: 'Logic và lập luận',
    publishedDocId: 'mo-hinh-lap-luan-toulmin-trong-viet-hoc-thuat',
  },
  {
    title: 'Suy luận quy nạp, giả thuyết và bài toán bằng chứng khoa học',
    category: 'Logic và lập luận',
    publishedDocId: 'suy-luan-quy-nap-va-bai-toan-bang-chung',
  },
  { title: 'Điều kiện cần, điều kiện đủ và lỗi đảo ngược mệnh đề', category: 'Logic và lập luận' },
  { title: 'Tương quan và nhân quả trong phân tích dữ liệu xã hội', category: 'Logic và lập luận' },
  { title: 'Định nghĩa khái niệm và lỗi đánh tráo thuật ngữ', category: 'Logic và lập luận' },
  { title: 'Phản chứng (Reductio ad absurdum) trong tranh luận chuẩn mực', category: 'Logic và lập luận' },
  { title: 'Suy luận Bayes và cách cập nhật niềm tin trước bằng chứng mới', category: 'Logic và lập luận' },
  { title: 'Cấu trúc phản biện hai chiều và nghệ thuật nhượng bộ có kiểm soát', category: 'Logic và lập luận' },

  // 5. Tư duy phản biện (4 published + 6 upcoming)
  {
    title: 'Nguyên tắc Bác ái và nghệ thuật phản biện xây dựng',
    category: 'Tư duy phản biện',
    publishedDocId: 'nguyen-tac-bac-ai-va-nghe-thuat-phan-bien',
  },
  {
    title: 'Thiên kiến nhận thức và cái bẫy của tư duy nhanh',
    category: 'Tư duy phản biện',
    publishedDocId: 'thien-kien-nhan-thuc-va-bay-tu-duy-nhanh',
  },
  {
    title: 'Phân biệt sự kiện, diễn giải và giả định ngầm',
    category: 'Tư duy phản biện',
    publishedDocId: 'phan-biet-su-kien-dien-giai-va-gia-dinh-ngam',
  },
  {
    title: 'Kiểm chứng thông tin và kỹ năng đọc ngang nguồn tin',
    category: 'Tư duy phản biện',
    publishedDocId: 'kiem-chung-thong-tin-va-doc-hieu-nguon-tin',
  },
  { title: 'Hiệu ứng buồng vang và phân cực quan điểm trên mạng xã hội', category: 'Tư duy phản biện' },
  { title: 'Khiêm tốn tri thức (Intellectual Humility) trong học tập suốt đời', category: 'Tư duy phản biện' },
  { title: 'Đọc biểu đồ và nhận diện cách trình bày số liệu gây hiểu nhầm', category: 'Tư duy phản biện' },
  { title: 'Thí nghiệm tư tưởng như công cụ kiểm thử lập trường đạo đức', category: 'Tư duy phản biện' },
  { title: 'Tư duy hệ thống: Nhìn thấy vòng phản hồi sau sự kiện bề mặt', category: 'Tư duy phản biện' },
  { title: 'Quản trị cảm xúc trong bất đồng và tránh leo thang công kích', category: 'Tư duy phản biện' },

  // 6. Kiến thức liên ngành (4 published + 6 upcoming)
  {
    title: 'Trí tuệ nhân tạo và đạo đức trách nhiệm của con người',
    category: 'Kiến thức liên ngành',
    publishedDocId: 'tri-tue-nhan-tao-va-dao-duc-trach-nhiem',
  },
  {
    title: 'Sinh thái học văn hóa và bài toán phát triển bền vững',
    category: 'Kiến thức liên ngành',
    publishedDocId: 'sinh-thai-hoc-van-hoa-va-phat-trien-ben-vung',
  },
  {
    title: 'Kinh tế học hành vi và cơ chế ra quyết định hằng ngày',
    category: 'Kiến thức liên ngành',
    publishedDocId: 'kinh-te-hoc-hanh-vi-va-quyet-dinh-hang-ngay',
  },
  {
    title: 'Truyền thông số, kinh tế chú ý và không gian công cộng',
    category: 'Kiến thức liên ngành',
    publishedDocId: 'truyen-thong-so-va-khong-gian-cong-cong',
  },
  { title: 'Khoa học nhận thức về trí nhớ, chú ý và học sâu bền vững', category: 'Kiến thức liên ngành' },
  { title: 'Lịch sử in ấn, lưu trữ tri thức và sự hình thành đại học hiện đại', category: 'Kiến thức liên ngành' },
  { title: 'Kiến trúc đô thị và tâm lý học không gian sống cộng đồng', category: 'Kiến thức liên ngành' },
  { title: 'Đạo đức sinh học trong kỷ nguyên chỉnh sửa gen', category: 'Kiến thức liên ngành' },
  { title: 'Toàn cầu hóa, bản sắc địa phương và đối thoại liên văn hóa', category: 'Kiến thức liên ngành' },
  { title: 'Nghệ thuật thị giác, thuật toán gợi ý và gu thẩm mỹ đại chúng', category: 'Kiến thức liên ngành' },
];
