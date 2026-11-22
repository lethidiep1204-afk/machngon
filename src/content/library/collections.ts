import type { LibraryCollection } from '../../lib/types';

export const DEFAULT_LIBRARY_COLLECTIONS: LibraryCollection[] = [
  {
    id: 'nhap-mon-tu-duy-phan-bien',
    title: 'Nhập môn Tư duy Phản biện & Tranh luận',
    subtitle: 'Từ bóc tách giả định ngầm đến phản biện theo Nguyên tắc Bác ái',
    description:
      'Lộ trình 5 bài đọc nền tảng giúp người học phân biệt sự kiện với diễn giải, nhận diện thiên kiến và ngụy biện, đồng thời xây dựng lập luận chặt chẽ theo mô hình Toulmin.',
    coverImage: '/src/assets/images/cover_critical_inquiry_1795261545337.jpg',
    coverAlt: 'Bàn đọc cổ điển với kính lúp và sổ tay ghi chép tư duy phản biện',
    documentIds: [
      'phan-biet-su-kien-dien-giai-va-gia-dinh-ngam',
      'nguyen-tac-bac-ai-va-nghe-thuat-phan-bien',
      'nguy-bien-trong-dien-ngon-cong-cong',
      'thien-kien-nhan-thuc-va-bay-tu-duy-nhanh',
      'mo-hinh-lap-luan-toulmin-trong-viet-hoc-thuat',
    ],
    status: 'published',
    order: 1,
  },
  {
    id: 'ngon-ngu-dien-ngon-va-y-nghia',
    title: 'Ngôn ngữ, Diễn ngôn và Cấu trúc Ý nghĩa',
    subtitle: 'Cách ngôn từ định hình thế giới quan và giao tiếp xã hội',
    description:
      'Tuyển tập chuyên sâu về mối quan hệ giữa ngôn ngữ và tư duy, ẩn dụ ý niệm trong đời sống, hàm ngôn ngữ dụng học và ký hiệu học.',
    coverImage: '/src/assets/images/cover_language_thought_1795223385514.jpg',
    coverAlt: 'Thư phòng gỗ sồi với sách cổ và bút mực nghiên cứu ngôn ngữ học',
    documentIds: [
      'ngon-ngu-va-tu-duy-moi-lien-he-bien-chung',
      'phong-cach-ngon-ngu-va-an-du-trong-doi-song',
      'ngu-dung-hoc-va-ham-ngon-trong-giao-tiep',
      'ky-hieu-hoc-va-cau-truc-cua-nghia',
    ],
    status: 'published',
    order: 2,
  },
  {
    id: 'doi-thoai-triet-hoc-va-tu-do',
    title: 'Đối thoại Triết học: Tự do, Đạo đức và Nội tâm',
    subtitle: 'Bốn cuộc đối thoại lớn với Socrates, Aristotle, Khắc kỷ và Hiện sinh',
    description:
      'Đi từ nghệ thuật đặt câu hỏi của Socrates đến hạnh phúc tự thực hiện (Eudaimonia), bản lĩnh Khắc kỷ và trách nhiệm tự do trong triết học hiện sinh.',
    coverImage: '/src/assets/images/cover_philosophy_freedom_1795223385361.jpg',
    coverAlt: 'Hành lang đá cổ điển ngập nắng gợi không gian suy tư triết học',
    documentIds: [
      'triet-hoc-hien-sinh-con-nguoi-va-su-tu-do',
      'phuong-phap-doi-thoai-socrates-va-nghe-thuat-dat-cau-hoi',
      'dao-duc-hoc-duc-hanh-va-hanh-phuc-aristotle',
      'chu-nghia-khac-ky-va-tu-do-noi-tam',
    ],
    status: 'published',
    order: 3,
  },
  {
    id: 'doc-sau-van-hoc-va-ly-luan',
    title: 'Đọc sâu Văn học: Từ Thi pháp Cổ điển đến Tiếp nhận',
    subtitle: 'Mở khóa lớp nghĩa thẩm mỹ qua điểm nhìn tự sự và liên văn bản',
    description:
      'Kết nối mỹ học hàm súc của thơ ca cổ điển Việt Nam với các công cụ lý luận văn học hiện đại như tự sự học, chân trời kỳ vọng và đối thoại liên văn bản.',
    coverImage: '/src/assets/images/cover_literature_culture_1795223385935.jpg',
    coverAlt: 'Hiên tre cổ điển Việt Nam bên nghiên mực và tập thơ',
    documentIds: [
      've-dep-ham-suc-cua-tho-ca-co-dien-viet-nam',
      'nguoi-ke-chuyen-va-diem-nhin-tu-su',
      'ly-thuyet-tiep-nhan-va-vai-tro-cua-nguoi-doc',
      'lien-van-ban-va-doi-thoai-trong-van-hoc',
    ],
    status: 'published',
    order: 4,
  },
  {
    id: 'cong-dan-tri-thuc-trong-ky-nguyen-so',
    title: 'Công dân Tri thức trong Kỷ nguyên Số',
    subtitle: 'Đọc ngang nguồn tin, đạo đức AI và không gian công cộng đương đại',
    description:
      'Trang bị năng lực đọc hiểu đa ngành trước thuật toán gợi ý, kinh tế chú ý, quyết định hành vi và trách nhiệm đạo đức khi đồng hành cùng trí tuệ nhân tạo.',
    coverImage: '/src/assets/images/cover_interdisciplinary_world_1795261299848.jpg',
    coverAlt: 'Ban công thư viện mở ra bầu trời sao tượng trưng cho tri thức liên ngành',
    documentIds: [
      'tri-tue-nhan-tao-va-dao-duc-trach-nhiem',
      'truyen-thong-so-va-khong-gian-cong-cong',
      'kiem-chung-thong-tin-va-doc-hieu-nguon-tin',
      'kinh-te-hoc-hanh-vi-va-quyet-dinh-hang-ngay',
    ],
    status: 'published',
    order: 5,
  },
];
