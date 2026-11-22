# Hướng dẫn biên soạn tài liệu riêng cho Kho Tri Thức Mạch Ngôn

> Tác giả: Ban biên tập Mạch Ngôn
> Chủ đề: Tư duy phản biện
> Nguồn: Tài liệu mẫu hướng dẫn kho tri thức nội bộ (knowledge_docs)
> Từ khóa: tài liệu riêng, RAG, mạch ngôn, trích dẫn, tư duy phản biện, đối thoại Socrates

## Cách cấu trúc một tài liệu Markdown chuẩn

Mỗi tệp `.md` hoặc `.txt` đặt trong thư mục `knowledge_docs/` ở gốc dự án sẽ được hệ thống Kho Tri Thức Mạch Ngôn tự động đọc và lập chỉ mục theo từng mục nội dung.

Để AI truy xuất chính xác nhất khi học sinh đặt câu hỏi trong Concept Lab hoặc Debate Lab, hãy dùng một tiêu đề chính duy nhất bắt đầu bằng `# ` ở đầu tệp và chia nội dung thành các phần rõ ràng bằng tiêu đề cấp hai `## `.

## Quy tắc tách đoạn và trích dẫn bằng chứng

Mỗi phần `## ` nên tập trung vào một luận điểm, một khái niệm cốt lõi hoặc một phản ví dụ cụ thể. Đoạn văn ngắn gọn (2–4 câu) giúp bộ máy RAG chọn đúng đoạn dẫn chứng liên quan mà không làm loãng ngữ cảnh.

> Khi đưa câu trích dẫn nguyên văn từ tác giả hoặc tác phẩm học thuật, hãy đặt dấu `>` ở đầu dòng kèm tên nguồn rõ ràng để Trợ lý AI viện dẫn chính xác tên tài liệu trong lượt phản biện.

## Gợi ý tổ chức tài liệu theo 3 nguồn tri thức

Hệ thống RAG của Mạch Ngôn tổng hợp đồng thời ba nguồn: 24 học liệu chuẩn có sẵn trong Thư viện, các bài viết mới hoặc bài đã chỉnh sửa từ trang Quản trị nội dung (`/admin`), và toàn bộ tệp `.md`/`.txt` trong thư mục `knowledge_docs/`.

Các tài liệu riêng từ `/admin` và `knowledge_docs/` luôn được chấm điểm ưu tiên cao hơn để Trợ lý AI bám sát giáo trình, chuyên đề lớp học hoặc bộ dẫn chứng riêng của giáo viên và học sinh.
