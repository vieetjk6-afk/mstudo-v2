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

  const COLS = "id, slug, title, cover_url, status, watermark_enabled, download_enabled, phase, photos(count), selections(count)";
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

  // DB chưa chạy migration album_dislikes.sql thì cả câu select embed
  // `dislikes(count)` lỗi và thư viện album trống trơn — thử lại không kèm cột
  // đó thay vì bỏ trắng cả trang.
  let albums = listRes.data as RawAlbum[] | null;
  if (listRes.error) {
    let retryQ = supabase.from("albums").select(COLS).eq("owner_id", ownerId);
    if (opts.excludeGalleries) retryQ = retryQ.eq("is_gallery", false);
    const { data } = await retryQ.order("updated_at", { ascending: false });
    albums = data as RawAlbum[] | null;
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
    selections: a.selections,
    dislikes: a.dislikes,
    photoCount: a.photos?.[0]?.count ?? 0,
    coverFallback: a.cover_url ? null : coverMap.get(a.id) ?? null,
  }));
}
