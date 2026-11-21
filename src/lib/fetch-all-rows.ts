/**
 * Đọc HẾT một truy vấn PostgREST, lật từng trang qua giới hạn max-rows (mặc
 * định 1000) của Supabase.
 *
 * Vì sao cần: `.select()` trơn KHÔNG báo lỗi khi vượt giới hạn — nó lặng lẽ cắt
 * ở hàng thứ 1000. Một trang tổng hợp (KPI, công nợ, việc tắc) tính trên danh
 * sách bị cắt thì ra số SAI mà trông vẫn rất thật.
 *
 * `page(from, to)` phải dựng lại truy vấn kèm `.range(from, to)` và một thứ tự
 * TỔNG (thêm `.order("id")` cuối cùng) — không thì ranh giới trang trùng/sót
 * hàng. Trang lỗi thì dừng và trả về phần đã đọc được, giống cách các chỗ gọi
 * cũ coi `data ?? []` là rỗng chứ không làm sập cả trang.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  size = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error || !data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < size) break;
  }
  return out;
}

/**
 * `.in("cột", ids)` với danh sách DÀI: chia thành từng mẻ rồi gộp kết quả (mỗi
 * mẻ vẫn lật trang qua fetchAllRows).
 *
 * Vì sao cần: PostgREST nhét danh sách vào URL — một nghìn UUID là ~37KB, vượt
 * giới hạn độ dài URL nên cả truy vấn hỏng, và chỗ gọi coi `data ?? []` là rỗng:
 * cron xử lý như thể không có đợt thanh toán / mốc lịch nào.
 */
export async function fetchInChunks<T>(
  ids: string[],
  page: (chunk: string[], from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  chunkSize = 200,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    out.push(...(await fetchAllRows<T>((from, to) => page(chunk, from, to))));
  }
  return out;
}
