/**
 * Chuẩn hóa chuỗi tiếng Việt (bỏ dấu thanh, dấu mũ và chuyển đ/Đ -> d)
 * phục vụ tìm kiếm không dấu chính xác trong Library.
 */
export function normalizeVietnamese(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Kiểm tra xem văn bản nguồn có khớp với truy vấn tìm kiếm tiếng Việt (có dấu hoặc không dấu) hay không.
 * Hỗ trợ nhiều từ khóa tách bằng dấu cách (tất cả token đều phải xuất hiện).
 */
export function matchesVietnameseQuery(haystack: string, query: string): boolean {
  const normalizedQuery = normalizeVietnamese(query);
  if (!normalizedQuery) return true;
  const normalizedHaystack = normalizeVietnamese(haystack);
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  return tokens.every((token) => normalizedHaystack.includes(token));
}
