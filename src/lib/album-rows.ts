import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlbumRow } from "@/app/dashboard/AlbumList";

/**
 * Tải danh sách album cho thư viện (đã tối ưu): chỉ ĐẾM ảnh (photos(count)) thay
 * vì kéo drive_file_id của mọi ảnh, và lấy đúng 1 ảnh bìa dự phòng cho những
 * album chưa đặt cover_url. Nhẹ hơn nhiều khi studio có nhiều album/ảnh.
 */
export async function fetchAlbumRows(
  supabase: SupabaseClient,
  ownerId: string,
  opts: { excludeGalleries?: boolean } = {}
): Promise<AlbumRow[]> {
  if (!ownerId) return [];

  // Cột LÕI — có ở mọi database, kể cả cái chưa chạy migration nào gần đây.
  const BASE_COLS = "id, slug, title, cover_url, status, watermark_enabled, download_enabled, phase, photos(count), selections(count)";
  // + mốc khách chốt chọn ảnh (migrations/album_selection_done.sql).
  const COLS = `${BASE_COLS}, selection_done_at`;
  let listQ = supabase
    .from("albums")
    .select(`${COLS}, dislikes(count)`)
    .eq("owner_id", ownerId);
  let coverQ = supabase
    .from("albums")
    .select("id, photos(drive_file_id)")
    .eq("owner_id", ownerId)
    .is("cover_url", null)
    .order("position", { referencedTable: "photos", ascending: true })
    .limit(1, { referencedTable: "photos" });
  if (opts.excludeGalleries) {
    listQ = listQ.eq("is_gallery", false);
    coverQ = coverQ.eq("is_gallery", false);
  }

  const [listRes, { data: coverRows }] = await Promise.all([
    listQ.order("updated_at", { ascending: false }),
    coverQ,
  ]);

  type RawAlbum = Omit<AlbumRow, "photoCount" | "coverFallback"> & { photos: { count: number }[] };

  // Một cột/embed thiếu là hỏng CẢ câu select, và thư viện album trắng trơn —
  // thà mất một tính năng phụ còn hơn mất cả trang. Nên hạ dần từng nấc, mỗi
  // nấc bỏ đúng thứ mà một migration chưa chạy có thể gây ra:
  //   1. đủ cả  →  2. bỏ dislikes(count)   (migrations/album_dislikes.sql)
  //              →  3. bỏ selection_done_at (migrations/album_selection_done.sql)
  // Nấc 3 chỉ còn cột lõi nên gần như không thể hỏng.
  const runList = async (cols: string) => {
    let q = supabase.from("albums").select(cols).eq("owner_id", ownerId);
    if (opts.excludeGalleries) q = q.eq("is_gallery", false);
    return q.order("updated_at", { ascending: false });
  };

  let albums = listRes.data as RawAlbum[] | null;
  if (listRes.error) {
    const second = await runList(COLS);
    albums = second.data as unknown as RawAlbum[] | null;
    if (second.error) {
      const third = await runList(BASE_COLS);
      albums = third.data as unknown as RawAlbum[] | null;
    }
  }

  const coverMap = new Map<string, string>();
  for (const r of (coverRows ?? []) as { id: string; photos: { drive_file_id: string }[] }[]) {
    const d = r.photos?.[0]?.drive_file_id;
    if (d) coverMap.set(r.id, d);
  }

  return (albums ?? []).map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    cover_url: a.cover_url,
    status: a.status,
    watermark_enabled: a.watermark_enabled,
    download_enabled: a.download_enabled,
    phase: a.phase,
    selection_done_at: a.selection_done_at ?? null,
    selections: a.selections,
    dislikes: a.dislikes,
    photoCount: a.photos?.[0]?.count ?? 0,
    coverFallback: a.cover_url ? null : coverMap.get(a.id) ?? null,
  }));
}
