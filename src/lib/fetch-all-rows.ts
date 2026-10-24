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
