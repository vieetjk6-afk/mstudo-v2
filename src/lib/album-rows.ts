import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlbumRow } from "@/app/dashboard/AlbumList";
import { phanLoaiLoi } from "@/lib/pg-loi";

/**
 * Tải danh sách album cho thư viện (đã tối ưu).
 *
 * Đường NHANH (đã chạy migrations/tang_toc_thu_vien_album.sql): MỘT câu select
 * albums không embed gì + MỘT lượt rpc album_library_stats, chạy song song. Hàm
 * SQL đếm ảnh / lượt chọn / ảnh "không thích" và lấy ảnh bìa dự phòng trong một
 * lượt, không phải chạy policy RLS cho từng dòng ảnh như embed `photos(count)`.
 *
 * Đường CŨ (chưa chạy migration): embed `photos(count), selections(count),
 * dislikes(count)` + một câu lấy ảnh bìa dự phòng — y như trước đây.
 */

type ErrLike = { code?: string | null; message?: string | null } | null;

/**
 * Lỗi do database CHƯA CHẠY migration (thiếu bảng / cột / hàm / quan hệ embed)?
 * Chỉ lỗi loại này mới được ghi nhớ — rớt mạng hay hết giờ thì lần sau phải thử
 * lại bản đầy đủ, không được tự hạ cấp cả tiến trình vì một lần chập chờn.
 */
function laLoiLuocDo(e: ErrLike): boolean {
  if (!e) return false;
  if (phanLoaiLoi(e) !== "khac") return true;
  // PGRST200: không thấy quan hệ để embed (bảng dislikes chưa có).
  // PGRST202 / 42883: không thấy hàm (rpc chưa tạo).
  return e.code === "PGRST200" || e.code === "PGRST202" || e.code === "42883";
}

/**
 * Nhớ ở cấp module (một tiến trình máy chủ) thứ gì database này CHƯA có, để mỗi
 * lượt mở thư viện không phải đâm vào cùng một câu hỏng rồi mới lùi. Nhớ có hạn:
 * chủ studio chạy SQL xong thì vài phút sau app tự dùng lại bản đầy đủ, không
 * cần khởi động lại.
 */
const NHO_MS = 5 * 60_000;
const nho = {
  /** Hết hạn lúc nào thì thử lại rpc. 0 = chưa biết thiếu. */
  rpcThieuDen: 0,
  /** Nấc cột của đường CŨ đã biết chạy được, kèm hạn. */
  nacCu: 0 as 0 | 1 | 2,
  nacCuDen: 0,
  /** Đường nhanh: thiếu cột selection_done_at. */
  thieuDoneDen: 0,
};
const conNho = (den: number) => den > Date.now();

// Cột LÕI — có ở mọi database, kể cả cái chưa chạy migration nào gần đây.
// `is_gallery` đi kèm `phase`: cờ cũ vẫn quyết định giai đoạn của album đời
// đầu (phase còn null) — thư viện phải đọc CÙNG luật với trang khách, xem
// @/lib/album-phase.
const CORE_COLS = "id, slug, title, cover_url, status, watermark_enabled, download_enabled, phase, is_gallery";
// + mốc khách chốt chọn ảnh (migrations/album_selection_done.sql).
const DONE_COL = "selection_done_at";

type RawAlbum = Omit<AlbumRow, "photoCount" | "coverFallback" | "selections"> & {
  selections?: { count: number }[];
  photos?: { count: number }[];
};

type StatRow = {
  album_id: string;
  photo_count: number | string | null;
  pick_count: number | string | null;
  dislike_count: number | string | null;
  first_drive_file_id: string | null;
};

export async function fetchAlbumRows(
  supabase: SupabaseClient,
  ownerId: string,
  opts: { excludeGalleries?: boolean } = {}
): Promise<AlbumRow[]> {
  if (!ownerId) return [];

  if (!conNho(nho.rpcThieuDen)) {
    const fast = await fetchFast(supabase, ownerId, opts);
    if (fast) return fast;
  }
  return fetchLegacy(supabase, ownerId, opts);
}

/** Đường nhanh. Trả null khi rpc không dùng được → người gọi lùi về đường cũ. */
async function fetchFast(
  supabase: SupabaseClient,
  ownerId: string,
  opts: { excludeGalleries?: boolean }
): Promise<AlbumRow[] | null> {
  const listOf = (cols: string) => {
    let q = supabase.from("albums").select(cols).eq("owner_id", ownerId);
    if (opts.excludeGalleries) q = q.eq("is_gallery", false);
    return q.order("updated_at", { ascending: false });
  };
  const coDone = !conNho(nho.thieuDoneDen);

  const [listRes, statRes] = await Promise.all([
    listOf(coDone ? `${CORE_COLS}, ${DONE_COL}` : CORE_COLS),
    supabase.rpc("album_library_stats", { p_owner: ownerId }),
  ]);

  if (statRes.error) {
    if (laLoiLuocDo(statRes.error)) nho.rpcThieuDen = Date.now() + NHO_MS;
    return null;
  }

  let albums = listRes.data as unknown as RawAlbum[] | null;
  if (listRes.error) {
    if (!coDone) return null;
    // Thiếu selection_done_at → bỏ đúng cột đó, thư viện vẫn phải hiện.
    if (laLoiLuocDo(listRes.error)) nho.thieuDoneDen = Date.now() + NHO_MS;
    const second = await listOf(CORE_COLS);
    if (second.error) return null;
    albums = second.data as unknown as RawAlbum[] | null;
  }

  const stats = new Map<string, StatRow>();
  for (const s of (statRes.data ?? []) as StatRow[]) stats.set(s.album_id, s);
  // bigint của Postgres về tới JS có thể là chuỗi — đổi sang số cho chắc.
  const so = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

  return (albums ?? []).map((a) => {
    const s = stats.get(a.id);
    return toRow(a, {
      photoCount: so(s?.photo_count),
      picks: so(s?.pick_count),
      dislikes: so(s?.dislike_count),
      cover: s?.first_drive_file_id ?? null,
    });
  });
}

/** Đường cũ — embed đếm qua RLS. Giữ nguyên cách lùi từng nấc như trước. */
async function fetchLegacy(
  supabase: SupabaseClient,
  ownerId: string,
  opts: { excludeGalleries?: boolean }
): Promise<AlbumRow[]> {
  const BASE_COLS = `${CORE_COLS}, photos(count), selections(count)`;
  const COLS = `${BASE_COLS}, ${DONE_COL}`;
  // Một cột/embed thiếu là hỏng CẢ câu select, và thư viện album trắng trơn —
  // thà mất một tính năng phụ còn hơn mất cả trang. Nên hạ dần từng nấc, mỗi
  // nấc bỏ đúng thứ mà một migration chưa chạy có thể gây ra:
  //   0. đủ cả  →  1. bỏ dislikes(count)   (migrations/album_dislikes.sql)
  //              →  2. bỏ selection_done_at (migrations/album_selection_done.sql)
  // Nấc 2 chỉ còn cột lõi nên gần như không thể hỏng. Nấc đã biết chạy được thì
  // nhớ lại (có hạn) để lần sau khỏi đâm vào câu hỏng trước.
  const NAC = [`${COLS}, dislikes(count)`, COLS, BASE_COLS];
  const runList = (cols: string) => {
    let q = supabase.from("albums").select(cols).eq("owner_id", ownerId);
    if (opts.excludeGalleries) q = q.eq("is_gallery", false);
    return q.order("updated_at", { ascending: false });
  };

  let coverQ = supabase
    .from("albums")
    .select("id, photos(drive_file_id)")
    .eq("owner_id", ownerId)
    .is("cover_url", null)
    .order("position", { referencedTable: "photos", ascending: true })
    .limit(1, { referencedTable: "photos" });
  if (opts.excludeGalleries) coverQ = coverQ.eq("is_gallery", false);

  const batDau = conNho(nho.nacCuDen) ? nho.nacCu : 0;
  const [listRes, { data: coverRows }] = await Promise.all([runList(NAC[batDau]), coverQ]);

  let albums = listRes.data as unknown as RawAlbum[] | null;
  if (listRes.error) {
    let loiLuocDo = laLoiLuocDo(listRes.error);
    albums = null;
    for (let nac = batDau + 1; nac < NAC.length; nac++) {
      const res = await runList(NAC[nac]);
      if (!res.error) {
        albums = res.data as unknown as RawAlbum[] | null;
        if (loiLuocDo) {
          nho.nacCu = nac as 1 | 2;
          nho.nacCuDen = Date.now() + NHO_MS;
        }
        break;
      }
      loiLuocDo = loiLuocDo || laLoiLuocDo(res.error);
    }
  }

  const coverMap = new Map<string, string>();
  for (const r of (coverRows ?? []) as { id: string; photos: { drive_file_id: string }[] }[]) {
    const d = r.photos?.[0]?.drive_file_id;
    if (d) coverMap.set(r.id, d);
  }

  return (albums ?? []).map((a) =>
    toRow(a, {
      photoCount: a.photos?.[0]?.count ?? 0,
      picks: a.selections?.[0]?.count ?? 0,
      dislikes: a.dislikes ? a.dislikes[0]?.count ?? 0 : undefined,
      cover: coverMap.get(a.id) ?? null,
    })
  );
}

function toRow(
  a: RawAlbum,
  n: { photoCount: number; picks: number; dislikes: number | undefined; cover: string | null }
): AlbumRow {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    cover_url: a.cover_url,
    status: a.status,
    watermark_enabled: a.watermark_enabled,
    download_enabled: a.download_enabled,
    phase: a.phase,
    // Thiếu dòng này thì album đời đầu (phase null, is_gallery bật) rơi vào tab
    // "Chọn ảnh" của thư viện dù khách đang thấy trang giao khách — AlbumList
    // chia tab bằng isDeliveryPhase(), cần cả hai cột.
    is_gallery: a.is_gallery ?? null,
    selection_done_at: a.selection_done_at ?? null,
    selections: [{ count: n.picks }],
    dislikes: n.dislikes === undefined ? undefined : [{ count: n.dislikes }],
    photoCount: n.photoCount,
    coverFallback: a.cover_url ? null : n.cover,
  };
}
