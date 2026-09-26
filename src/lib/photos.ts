/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Read ALL photos of an album, paginating past Supabase's default 1000-row cap.
 * Works with any Supabase client (server / admin / browser).
 */
export async function fetchAllPhotos(
  client: any,
  albumId: string,
  columns = "*"
): Promise<any[]> {
  const out: any[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await client
      .from("photos")
      .select(columns)
      .eq("album_id", albumId)
      // Thứ tự phụ theo id để phá thế hoà `position`: có nó thì thứ tự TỔNG là xác
      // định, nên phân trang phía DB (album/[slug]/photos) khớp đúng với lô SSR —
      // không trùng/sót ảnh ở ranh giới trang.
      .order("position")
      .order("id")
      .range(from, from + size - 1);
    if (error || !data || data.length === 0) break;
    out.push(...data);
    if (data.length < size) break;
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
