/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Read ALL photos of an album, paginating past Supabase's default 1000-row cap.
 * Works with any Supabase client (server / admin / browser).
 *
 * Trang đầu xin kèm tổng số dòng, rồi các trang còn lại tải SONG SONG (mỗi đợt
 * PARALLEL trang). Trước đây tải nối đuôi từng trang: album 5.000 ảnh là 5 vòng
 * mạng chờ nhau. Kết quả và thứ tự y như cũ — trang nào lỗi/rỗng thì dừng ở đó.
 */
const PAGE = 1000;
const PARALLEL = 6;

export async function fetchAllPhotos(
  client: any,
  albumId: string,
  columns = "*"
): Promise<any[]> {
  const page = (from: number, withCount = false) =>
    client
      .from("photos")
      .select(columns, withCount ? { count: "exact" } : undefined)
      .eq("album_id", albumId)
      // Thứ tự phụ theo id để phá thế hoà `position`: có nó thì thứ tự TỔNG là xác
      // định, nên phân trang phía DB (album/[slug]/photos) khớp đúng với lô SSR —
      // không trùng/sót ảnh ở ranh giới trang.
      .order("position")
      .order("id")
      .range(from, from + PAGE - 1);

  const first = await page(0, true);
  if (first.error || !first.data || first.data.length === 0) return [];
  const out: any[] = [...first.data];
  if (first.data.length < PAGE) return out;

  let from = PAGE;
  // Biết tổng → tải song song phần còn lại theo từng đợt.
  if (typeof first.count === "number") {
    const starts: number[] = [];
    for (let f = PAGE; f < first.count; f += PAGE) starts.push(f);
    for (let i = 0; i < starts.length; i += PARALLEL) {
      const batch = await Promise.all(starts.slice(i, i + PARALLEL).map((f) => page(f)));
      for (const { data, error } of batch) {
        if (error || !data || data.length === 0) return out;
        out.push(...data);
        if (data.length < PAGE) return out;
      }
    }
    from = starts.length ? starts[starts.length - 1] + PAGE : PAGE;
  }
  // Không có tổng, hoặc album vừa thêm ảnh trong lúc tải: đọc nối đuôi như cũ.
  for (; ; from += PAGE) {
    const { data, error } = await page(from);
    if (error || !data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

/**
 * Lọc ảnh hiển thị cho GALLERY GIAO KHÁCH: ưu tiên ảnh thuộc source giai đoạn
 * "delivery"; nếu chưa gắn stage nào thì trả về tất cả (để gallery không trống).
 * Dùng CHUNG giữa SSR (album/[slug]/page.tsx) và API phân trang để hai bên luôn
 * cho ra cùng tập ảnh + cùng thứ tự.
 */
export function filterDeliveryPhotos<T extends { source_id?: string | null }>(
  photos: T[],
  sources: { id: string; stage?: string | null }[]
): T[] {
  const delSourceIds = new Set(sources.filter((s) => s.stage === "delivery").map((s) => s.id));
  if (delSourceIds.size === 0) return photos;
  return photos.filter((ph) => !ph.source_id || delSourceIds.has(ph.source_id));
}

/** Split an array into chunks of `size`. */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
