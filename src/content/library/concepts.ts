import type { LibraryConcept } from '../../lib/types';

export const LIBRARY_CONCEPTS: LibraryConcept[] = [
  {
    id: 'sapir-whorf',
    term: 'Giả thuyết Sapir-Whorf',
    englishTerm: 'Linguistic Relativity (Sapir-Whorf Hypothesis)',
    category: 'Ngôn ngữ học',
    shortDefinition:
      'Quan điểm cho rằng cấu trúc và vốn từ vựng của ngôn ngữ mẹ đẻ không quyết định cứng nhắc nhưng có ảnh hưởng đáng kể đến cách người nói phân loại, chú ý và ghi nhớ thế giới.',
    example:
      'Những ngôn ngữ phân biệt rạch ròi sắc thái xanh lam nhạt và xanh lam đậm giúp người nói nhận diện ranh giới màu sắc nhanh hơn một chút trong thí nghiệm thị giác.',
    relatedConceptIds: ['an-du-y-niem', 'ky-hieu-ngon-ngu'],
    documentIds: ['ngon-ngu-va-tu-duy-moi-lien-he-bien-chung'],
    matchAliases: ['Sapir-Whorf', 'tương đối ngôn ngữ', 'giả thuyết Sapir-Whorf'],
  },
  {
    id: 'an-du-y-niem',
    term: 'Ẩn dụ ý niệm',
    englishTerm: 'Conceptual Metaphor',
    category: 'Ngôn ngữ học',
    shortDefinition:
      'Cơ chế nhận thức trong đó con người hiểu một lĩnh vực trừu tượng thông qua cấu trúc của một lĩnh vực cụ thể, quen thuộc hơn trong trải nghiệm thể chất.',
    example:
      'Khi nói "tiết kiệm thời gian" hay "lãng phí cả buổi chiều", ta đang tư duy theo ẩn dụ ý niệm THỜI GIAN LÀ TIỀN BẠC.',
    relatedConceptIds: ['sapir-whorf', 'ngu-dung-hoc'],
    documentIds: ['phong-cach-ngon-ngu-va-an-du-trong-doi-song'],
    matchAliases: ['ẩn dụ ý niệm', 'Conceptual Metaphor', 'ẩn dụ nhận thức'],
  },
  {
    id: 'ngu-dung-hoc',
    term: 'Ngữ dụng học & Hàm ngôn',
    englishTerm: 'Pragmatics & Conversational Implicature',
    category: 'Ngôn ngữ học',
    shortDefinition:
      'Nhánh ngôn ngữ học nghiên cứu cách ngữ cảnh, mục đích người nói và quy ước hội thoại tạo ra ý nghĩa hàm ẩn vượt ra ngoài nghĩa đen câu chữ.',
    example:
      'Khi ai đó hỏi "Phòng này hơi lạnh nhỉ?", nghĩa đen là nhận xét nhiệt độ nhưng hàm ngôn có thể là lời đề nghị đóng cửa sổ hoặc tăng nhiệt độ điều hòa.',
    relatedConceptIds: ['ky-hieu-ngon-ngu', 'an-du-y-niem'],
    documentIds: ['ngu-dung-hoc-va-ham-ngon-trong-giao-tiep'],
    matchAliases: ['ngữ dụng học', 'hàm ngôn', 'hàm ngôn hội thoại', 'Grice'],
  },
  {
    id: 'ky-hieu-ngon-ngu',
    term: 'Ký hiệu ngôn ngữ',
    englishTerm: 'Linguistic Sign (Signifier & Signified)',
    category: 'Ngôn ngữ học',
    shortDefinition:
      'Theo Ferdinand de Saussure, ký hiệu ngôn ngữ gồm hai mặt gắn liền: cái biểu đạt (hình ảnh âm thanh/chữ viết) và cái được biểu đạt (khái niệm trong tâm trí), liên kết với nhau mang tính võ đoán theo quy ước cộng đồng.',
    example:
      'Cùng một khái niệm "cái cây", tiếng Việt gọi là "cây", tiếng Anh là "tree", tiếng Pháp là "arbre" — sự gắn kết này do quy ước xã hội tạo thành.',
    relatedConceptIds: ['sapir-whorf', 'ngu-dung-hoc'],
    documentIds: ['ky-hieu-hoc-va-cau-truc-cua-nghia'],
    matchAliases: ['ký hiệu ngôn ngữ', 'cái biểu đạt', 'cái được biểu đạt', 'Saussure'],
  },
  {
    id: 'diem-nhin-tu-su',
    term: 'Điểm nhìn tự sự',
    englishTerm: 'Narrative Focalization',
    category: 'Văn học và lý luận văn học',
    shortDefinition:
      'Vị trí quan sát, tri giác và đánh giá mà qua đó các sự kiện trong truyện được lọc và trình bày tới người đọc, tách biệt với câu hỏi "ai đang kể".',
    example:
      'Cùng một buổi chia tay, nếu kể qua điểm nhìn của đứa trẻ, câu chuyện đầy ngơ ngác; nếu qua điểm nhìn người cha, từng cử chỉ lại mang nặng trách nhiệm và tiếc nuối.',
    relatedConceptIds: ['chan-troi-ky-vong', 'lien-van-ban'],
    documentIds: ['nguoi-ke-chuyen-va-diem-nhin-tu-su'],
    matchAliases: ['điểm nhìn tự sự', 'tiêu cự hóa', 'người kể chuyện'],
  },
  {
    id: 'chan-troi-ky-vong',
    term: 'Chân trời kỳ vọng',
    englishTerm: 'Horizon of Expectations',
    category: 'Văn học và lý luận văn học',
    shortDefinition:
      'Hệ thống kinh nghiệm thẩm mỹ, tri thức văn hóa và chuẩn mực thể loại mà người đọc mang theo khi tiếp xúc với một tác phẩm, tạo nên đối thoại giữa tác phẩm và thời đại.',
    example:
      'Một bài thơ tự do không vần có thể gây sốc cho độc giả quen thơ Đường luật đầu thế kỷ XX, nhưng lại trở thành chuẩn mực quen thuộc với độc giả đương đại.',
    relatedConceptIds: ['diem-nhin-tu-su', 'lien-van-ban'],
    documentIds: [
      'ly-thuyet-tiep-nhan-va-vai-tro-cua-nguoi-doc',
      've-dep-ham-suc-cua-tho-ca-co-dien-viet-nam',
    ],
    matchAliases: ['chân trời kỳ vọng', 'lý thuyết tiếp nhận', 'khoảng trống văn bản'],
  },
  {
    id: 'lien-van-ban',
    term: 'Liên văn bản',
    englishTerm: 'Intertextuality',
    category: 'Văn học và lý luận văn học',
    shortDefinition:
      'Hiện tượng mỗi văn bản văn học không tồn tại cô lập mà luôn vang vọng, trích dẫn, cải biến hoặc đối thoại ngầm với các văn bản và truyền thống văn hóa đi trước.',
    example:
      'Truyện Kiều của Nguyễn Du vừa kế thừa cốt truyện Kim Vân Kiều truyện, vừa đối thoại sâu sắc với kho tàng ca dao, điển cố và tâm thức người Việt.',
    relatedConceptIds: ['chan-troi-ky-vong', 'diem-nhin-tu-su'],
    documentIds: [
      'lien-van-ban-va-doi-thoai-trong-van-hoc',
      've-dep-ham-suc-cua-tho-ca-co-dien-viet-nam',
    ],
    matchAliases: ['liên văn bản', 'tính đối thoại', 'Intertextuality'],
  },
  {
    id: 'hien-huu-co-truoc-ban-chat',
    term: 'Hiện hữu có trước bản chất',
    englishTerm: 'Existence Precedes Essence',
    category: 'Triết học và tư tưởng',
    shortDefinition:
      'Luận điểm cốt lõi của Jean-Paul Sartre: con người không sinh ra với một bản chất định sẵn như một đồ vật, mà tự kiến tạo bản thân thông qua lựa chọn và hành động có trách nhiệm.',
    example:
      'Chiếc kéo được thiết kế trước khi chế tạo nên có công dụng cố định; còn con người bước vào đời trước rồi mới tự định nghĩa mình là ai qua cách sống mỗi ngày.',
    relatedConceptIds: ['phuong-phap-socrates', 'eudaimonia'],
    documentIds: ['triet-hoc-hien-sinh-con-nguoi-va-su-tu-do'],
    matchAliases: ['hiện hữu có trước bản chất', 'tự do hiện sinh', 'ngụy tín'],
  },
  {
    id: 'phuong-phap-socrates',
    term: 'Phương pháp Socrates',
    englishTerm: 'Socratic Method (Elenchus)',
    category: 'Triết học và tư tưởng',
    shortDefinition:
      'Phương pháp đối thoại truy vấn liên hoàn nhằm kiểm tra tính nhất quán của định nghĩa và giả định ngầm, giúp người đối thoại tự phát hiện giới hạn hiểu biết của mình.',
    example:
      'Thay vì áp đặt định nghĩa "công bằng là gì", người hỏi đề nghị đối phương nêu định nghĩa rồi lần lượt thử nghiệm bằng các tình huống ngoại lệ.',
    relatedConceptIds: ['nguyen-tac-bac-ai', 'hien-huu-co-truoc-ban-chat'],
    documentIds: ['phuong-phap-doi-thoai-socrates-va-nghe-thuat-dat-cau-hoi'],
    matchAliases: ['phương pháp Socrates', 'đối thoại Socrates', 'Elenchus'],
  },
  {
    id: 'eudaimonia',
    term: 'Eudaimonia (Hạnh phúc tự thực hiện)',
    englishTerm: 'Eudaimonia / Human Flourishing',
    category: 'Triết học và tư tưởng',
    shortDefinition:
      'Trong đạo đức học Aristotle, Eudaimonia không phải khoái lạc nhất thời mà là trạng thái sống viên mãn, phát triển trọn vẹn lý trí và các đức hạnh suốt đời người.',
    example:
      'Một người rèn luyện sự dũng cảm, công bằng và tiết độ trong công việc hằng ngày đang kiến tạo Eudaimonia bền vững hơn cảm giác vui thú thoáng qua.',
    relatedConceptIds: ['hien-huu-co-truoc-ban-chat', 'phuong-phap-socrates'],
    documentIds: [
      'dao-duc-hoc-duc-hanh-va-hanh-phuc-aristotle',
      'chu-nghia-khac-ky-va-tu-do-noi-tam',
    ],
    matchAliases: ['Eudaimonia', 'đạo đức đức hạnh', 'trung dung vàng'],
  },
  {
    id: 'nguy-bien-rom',
    term: 'Ngụy biện người rơm',
    englishTerm: 'Straw Man Fallacy',
    category: 'Logic và lập luận',
    shortDefinition:
      'Lỗi lập luận xảy ra khi ta bóp méo, đơn giản hóa quá mức hoặc cực đoan hóa quan điểm của đối phương thành một phiên bản yếu ớt dễ công kích, thay vì phản biện lập luận thật của họ.',
    example:
      'A đề xuất giảm thời lượng dùng điện thoại trong giờ học; B đáp lại: "Bạn muốn cấm học sinh tiếp cận công nghệ và quay về thời đồ đá sao?"',
    relatedConceptIds: ['nguyen-tac-bac-ai', 'tinh-hop-le-va-tinh-vung-chac'],
    documentIds: [
      'nguy-bien-trong-dien-ngon-cong-cong',
      'nguyen-tac-bac-ai-va-nghe-thuat-phan-bien',
    ],
    matchAliases: ['ngụy biện người rơm', 'bù nhìn rơm', 'Straw Man'],
  },
  {
    id: 'tinh-hop-le-va-tinh-vung-chac',
    term: 'Tính hợp lệ & Tính vững chắc',
    englishTerm: 'Validity vs. Soundness',
    category: 'Logic và lập luận',
    shortDefinition:
      'Một lập luận suy diễn là "hợp lệ" khi kết luận tất yếu suy ra từ tiền đề về mặt hình thức, và chỉ "vững chắc" khi nó vừa hợp lệ vừa có mọi tiền đề đúng với thực tế.',
    example:
      'Lập luận "Mọi loài chim đều biết bay; chim cánh cụt là chim; vậy chim cánh cụt biết bay" hợp lệ về hình thức nhưng không vững chắc vì tiền đề thứ nhất sai.',
    relatedConceptIds: ['nguy-bien-rom', 'thien-kien-xac-nhan'],
    documentIds: [
      'tam-doan-luan-va-cau-truc-suy-dien-hop-le',
      'mo-hinh-lap-luan-toulmin-trong-viet-hoc-thuat',
      'suy-luan-quy-nap-va-bai-toan-bang-chung',
    ],
    matchAliases: ['tính hợp lệ', 'tính vững chắc', 'tam đoạn luận', 'Toulmin'],
  },
  {
    id: 'nguyen-tac-bac-ai',
    term: 'Nguyên tắc Bác ái',
    englishTerm: 'Principle of Charity / Steelmanning',
    category: 'Tư duy phản biện',
    shortDefinition:
      'Chuẩn mực đạo đức trí tuệ yêu cầu ta diễn giải quan điểm của người khác theo cách hợp lý, nhất quán và mạnh mẽ nhất có thể trước khi tiến hành phê phán.',
    example:
      'Trước khi phản bác một bài viết có câu chữ chưa chặt, bạn tóm tắt lại phiên bản thuyết phục nhất của luận điểm đó và xác nhận với tác giả rồi mới phân tích chỗ bất đồng.',
    relatedConceptIds: ['nguy-bien-rom', 'phuong-phap-socrates'],
    documentIds: [
      'nguyen-tac-bac-ai-va-nghe-thuat-phan-bien',
      'phan-biet-su-kien-dien-giai-va-gia-dinh-ngam',
    ],
    matchAliases: ['Nguyên tắc Bác ái', 'Steelman', 'nguyên tắc bác ái'],
  },
  {
    id: 'thien-kien-xac-nhan',
    term: 'Thiên kiến xác nhận',
    englishTerm: 'Confirmation Bias',
    category: 'Tư duy phản biện',
    shortDefinition:
      'Xu hướng tâm lý khiến con người ưu tiên tìm kiếm, diễn giải và ghi nhớ các thông tin củng cố niềm tin có sẵn, đồng thời bỏ qua hoặc hạ thấp bằng chứng trái chiều.',
    example:
      'Khi tin rằng một phương pháp học là tốt nhất, ta dễ nhớ vài người thành công nhờ nó và vô thức bỏ qua số đông người không phù hợp.',
    relatedConceptIds: ['nguyen-tac-bac-ai', 'khong-gian-cong-cong'],
    documentIds: [
      'thien-kien-nhan-thuc-va-bay-tu-duy-nhanh',
      'kiem-chung-thong-tin-va-doc-hieu-nguon-tin',
      'kinh-te-hoc-hanh-vi-va-quyet-dinh-hang-ngay',
    ],
    matchAliases: ['thiên kiến xác nhận', 'thiên kiến nhận thức', 'Hệ thống 1'],
  },
  {
    id: 'khong-gian-cong-cong',
    term: 'Không gian công cộng',
    englishTerm: 'Public Sphere',
    category: 'Kiến thức liên ngành',
    shortDefinition:
      'Khái niệm do Jürgen Habermas phát triển, chỉ môi trường xã hội nơi công dân có thể trao đổi thông tin, thảo luận lý tính và hình thành dư luận chung một cách tự do, bình đẳng.',
    example:
      'Các diễn đàn học thuật, báo chí độc lập hay không gian thảo luận cộng đồng được điều phối lành mạnh giúp tranh luận công khai dựa trên lý lẽ thay vì tiếng ồn cảm xúc.',
    relatedConceptIds: ['thien-kien-xac-nhan', 'nguyen-tac-bac-ai'],
    documentIds: [
      'truyen-thong-so-va-khong-gian-cong-cong',
      'tri-tue-nhan-tao-va-dao-duc-trach-nhiem',
      'sinh-thai-hoc-van-hoa-va-phat-trien-ben-vung',
    ],
    matchAliases: ['không gian công cộng', 'kinh tế chú ý', 'Habermas'],
  },
];
