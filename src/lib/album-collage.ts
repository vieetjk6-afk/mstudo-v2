import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDeliveryPhase } from "@/lib/album-phase";
import { verifyAlbumAccess, verifyPrintKey } from "@/lib/album-access";
import { printPhoneKeys } from "@/lib/album-print-rules";
import { effectivePlan, planAllowsCollage, type Plan } from "@/lib/plans";
import { fetchAllPhotos, filterDeliveryPhotos } from "@/lib/photos";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { COLLAGE_LIMITS, type CollageDoc } from "@/lib/collage/types";
import { sanitizeDoc, cleanTitle, docPhotoIds } from "@/lib/collage/validate";
import { categorize, type CatResult } from "@/lib/collage/categories";
import { collageEnabledFor } from "@/lib/collage/enabled";

/* ═══════════════════════════════════════════════════════════════════════════
   GHÉP LAYOUT ẢNH — phần máy chủ (đọc DB, kiểm quyền). Logic thuần ở
   src/lib/collage/*.

   Ai dùng được (phải thoả CẢ BA, kiểm ở mọi route — không route nào tin route
   nào):
     1. Album đang ở giai đoạn giao khách, đã xuất bản; album có mật khẩu thì
        phải kèm vé mở khoá (album-access).
     2. Studio gói Photographer Plus / Studio (planAllowsCollage) VÀ công tắc
        ghép layout đang bật: của hợp đồng dùng album này
        (studio_contracts.collage_enabled), hoặc của chính album nếu là album
        lẻ (albums.collage_enabled) — cả hai mặc định bật.
     3. Chỉ cô dâu / chú rể: hợp đồng có SĐT khách / cô dâu / chú rể thì phải
        kèm vé SĐT — CÙNG vé với chọn ảnh in (mintPrintKey), nên khách xác minh
        một lần trên máy là dùng được cả hai. Hợp đồng không ghi SĐT nào, hoặc
        album lẻ (không có SĐT để đối chiếu), thì ai mở được album cũng dùng
        được (giống ảnh in).
   ═══════════════════════════════════════════════════════════════════════════ */

/** Trạng thái gửi xuống trang album giao khách. */
export interface CollageState {
  /** true = cần nhập đúng SĐT cô dâu / chú rể trước khi ghép (vé lưu trên máy). */
  coupleOnly: boolean;
}

type AlbumRow = {
  id: string;
  owner_id: string;
  status: string | null;
  is_gallery: boolean | null;
  phase: string | null;
  password_hash: string | null;
  gallery_pinned: boolean | null;
};

/**
 * Album này có bật ghép layout không + SĐT khách / cô dâu / chú rể của hợp đồng
 * (đã chuẩn hoá, để đối chiếu vé). Album thuộc hợp đồng theo công tắc hợp đồng;
 * album lẻ theo công tắc của album (luật ở collageEnabledFor). Một truy vấn hợp
 * đồng cho cả cờ lẫn SĐT; chỉ album lẻ mới đọc thêm cột của album.
 */
export async function loadCollageSetting(db: SupabaseClient, albumId: string): Promise<{ enabled: boolean; phones: string[] }> {
  const q = (cols: string) =>
    db
      .from("studio_contracts")
      .select(cols)
      .or(`selection_album_id.eq.${albumId},gallery_album_id.eq.${albumId}`)
      .limit(5);
  let res = await q("collage_enabled, client_phone, bride_phone, groom_phone");
  // DB chưa chạy migration SĐT cô dâu / chú rể (hop-dong-co-dau-ngay-phu.sql).
  if (res.error) res = await q("collage_enabled, client_phone");
  const rows = res.error ? null : ((res.data ?? []) as unknown as Record<string, unknown>[]);
  let albumFlag: unknown = undefined;
  if (rows && rows.length === 0) {
    const { data, error } = await db.from("albums").select("collage_enabled").eq("id", albumId).maybeSingle();
    if (!error && data) albumFlag = (data as { collage_enabled?: unknown }).collage_enabled;
  }
  return {
    enabled: collageEnabledFor(rows, albumFlag),
    phones: rows ? printPhoneKeys(rows.flatMap((r) => [r.client_phone, r.bride_phone, r.groom_phone])) : [],
  };
}

/** Gói của chủ album có mở ghép layout không. */
export function ownerAllowsCollage(owner: { plan?: unknown; plan_expires_at?: string | null; role?: string | null } | null | undefined): boolean {
  if (!owner) return false;
  return planAllowsCollage(effectivePlan(owner.plan as Plan, owner.plan_expires_at), owner.role === "admin");
}

/**
 * Trạng thái cho trang /album/[slug]: null = album này không có ghép layout
 * (gói thấp, hợp đồng tắt, album lẻ, DB chưa chạy migration).
 */
export async function loadCollageState(
  db: SupabaseClient,
  albumId: string,
  owner: { plan?: unknown; plan_expires_at?: string | null; role?: string | null } | null | undefined,
): Promise<CollageState | null> {
  if (!ownerAllowsCollage(owner)) return null;
  const c = await loadCollageSetting(db, albumId);
  return c.enabled ? { coupleOnly: c.phones.length > 0 } : null;
}

/* ── Cổng kiểm quyền dùng chung cho các route /api/album/[slug]/collage/* ── */

export type CollageGate =
  | { ok: true; db: SupabaseClient; album: AlbumRow; phones: string[] }
  | { ok: false; res: NextResponse };

const deny = (error: string, status: number) => ({ ok: false as const, res: NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } }) });

/**
 * Kiểm đủ ba điều ở đầu file. `needKey = false` chỉ cho route xác minh SĐT
 * (đó là nơi PHÁT vé). Không bao giờ trả SĐT nào về trình duyệt.
 */
export async function collageGate(slug: string, cred: { access?: unknown; key?: unknown }, needKey = true): Promise<CollageGate> {
  const db = createAdminClient();
  const { data } = await db
    .from("albums")
    .select("id, owner_id, status, is_gallery, phase, password_hash, gallery_pinned")
    .eq("slug", slug)
    .maybeSingle();
  const album = data as AlbumRow | null;
  if (!album || album.status !== "published" || !isDeliveryPhase(album)) return deny("not_found", 404);
  if (!album.gallery_pinned && album.password_hash && !verifyAlbumAccess(album.id, album.password_hash, typeof cred.access === "string" ? cred.access : undefined)) {
    return deny("wrong_password", 401);
  }
  const [{ data: owner }, setting] = await Promise.all([
    db.from("profiles").select("plan, plan_expires_at, role").eq("id", album.owner_id).maybeSingle(),
    loadCollageSetting(db, album.id),
  ]);
  if (!ownerAllowsCollage(owner) || !setting.enabled) return deny("not_enabled", 403);
  const phones = setting.phones;
  if (needKey && phones.length > 0 && !verifyPrintKey(album.id, phones, cred.key)) return deny("need_verify", 403);
  return { ok: true, db, album, phones };
}

/* ── Ảnh của album + nhóm gợi ý ──────────────────────────────────────────── */

const VIDEO_RE = /\.(mp4|mov|m4v|webm|avi|mkv|wmv|flv|3gp)$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Một ảnh trong trình chọn ảnh ghép (khoá ngắn cho JSON gọn). */
export interface CollagePhotoRow {
  id: string;
  /** drive_file_id — để hiện ảnh. */
  d: string;
  /** source_id */
  s: string | null;
}

/**
 * Ảnh giao khách (bỏ video) + nhóm gợi ý. Khuôn mặt, người trong album và dấu
 * "đã quét" đọc kiểu best-effort: bảng / cột chưa có thì nhóm theo mặt trống,
 * vẫn còn nhóm theo thư mục và gợi ý trải đều.
 */
export async function loadCollagePhotos(db: SupabaseClient, albumId: string): Promise<{ photos: CollagePhotoRow[]; groups: CatResult }> {
  const [all, { data: sources }] = await Promise.all([
    fetchAllPhotos(db, albumId, "id, drive_file_id, name, source_id, position, is_video"),
    db.from("album_sources").select("id, name, position, stage").eq("album_id", albumId).order("position"),
  ]);
  const shown = filterDeliveryPhotos(all ?? [], sources ?? []).filter(
    (p: { is_video?: boolean | null; name?: string | null }) => !p.is_video && !VIDEO_RE.test(p.name ?? ""),
  ) as { id: string; drive_file_id: string; source_id: string | null; position: number }[];
  const ids = new Set(shown.map((p) => p.id));

  const [faces, scannedRows, people, links] = await Promise.all([
    fetchAllRows<{ photo_id: string; box: number[]; sharpness: number | null }>((from, to) =>
      db.from("album_faces").select("photo_id, at, box, sharpness").eq("album_id", albumId).order("photo_id").order("at").range(from, to),
    ).catch(() => []),
    fetchAllRows<{ id: string }>((from, to) =>
      db.from("photos").select("id").eq("album_id", albumId).not("faces_scanned_at", "is", null).order("id").range(from, to),
    ).catch(() => []),
    db.from("album_people").select("id, name").eq("album_id", albumId).then((r) => (r.error ? [] : (r.data ?? []) as { id: string; name: string }[])),
    fetchAllRows<{ person_id: string; photo_id: string }>((from, to) =>
      db.from("album_photo_people").select("person_id, photo_id").eq("album_id", albumId).order("photo_id").order("person_id").range(from, to),
    ).catch(() => []),
  ]);

  const usedSources = new Set(shown.map((p) => p.source_id).filter(Boolean));
  const groups = categorize({
    photos: shown.map((p) => ({ id: p.id, source_id: p.source_id, position: p.position })),
    sources: (sources ?? []).filter((s) => usedSources.has(s.id)).map((s) => ({ id: s.id as string, name: (s.name as string) ?? "" })),
    faces: faces.filter((f) => ids.has(f.photo_id)),
    scanned: new Set(scannedRows.map((r) => r.id).filter((id) => ids.has(id))),
    people,
    links: links.filter((l) => ids.has(l.photo_id)),
  });
  return { photos: shown.map((p) => ({ id: p.id, d: p.drive_file_id, s: p.source_id })), groups };
}

/* ── Bộ layout đã lưu (giữ 1 ngày) ───────────────────────────────────────── */

export interface CollageSetRow {
  id: string;
  title: string;
  data: CollageDoc;
  updated_at: string;
  expires_at: string;
}

/** Bảng chưa có (chưa chạy migration) — để route nói "chưa sẵn sàng" thay vì lỗi thô. */
function missingTable(e: { code?: string; message?: string } | null): boolean {
  return !!e && (e.code === "42P01" || e.code === "PGRST205" || /album_collages/.test(e.message ?? ""));
}

/** Xoá bộ layout đã hết hạn của album (dọn tại chỗ, không đợi cron). */
async function purgeExpired(db: SupabaseClient, albumId: string) {
  await db.from("album_collages").delete().eq("album_id", albumId).lt("expires_at", new Date().toISOString());
}

/** Các bộ layout còn hạn, mới sửa trước. null = bảng chưa có. */
export async function listCollages(db: SupabaseClient, albumId: string): Promise<CollageSetRow[] | null> {
  await purgeExpired(db, albumId).catch(() => {});
  const { data, error } = await db
    .from("album_collages")
    .select("id, title, data, updated_at, expires_at")
    .eq("album_id", albumId)
    .gt("expires_at", new Date().toISOString())
    .order("updated_at", { ascending: false })
    .limit(COLLAGE_LIMITS.sets);
  if (error) return missingTable(error) ? null : [];
  return (data ?? []) as CollageSetRow[];
}

export type SaveResult =
  | { ok: true; id: string; updatedAt: string; expiresAt: string }
  | { ok: false; error: string; status: number };

/**
 * Lưu (tạo mới hoặc ghi đè) một bộ layout. Mọi ảnh trong bộ phải là ảnh giao
 * khách của ĐÚNG album này (sanitizeDoc từ chối id lạ). Mỗi lần lưu gia hạn
 * thêm 1 ngày tính từ lúc lưu.
 */
export async function saveCollage(db: SupabaseClient, albumId: string, body: { id?: unknown; title?: unknown; doc?: unknown }): Promise<SaveResult> {
  // Chỉ đối chiếu đúng các ảnh bộ layout dùng (tự lưu chạy liên tục — đọc cả
  // album mỗi lần là phí). Ảnh nào không thuộc album / không phải ảnh giao
  // khách thì không có trong `allowed` và sanitizeDoc từ chối cả bộ.
  const want = docPhotoIds(body.doc).filter((id) => UUID_RE.test(id));
  if (want.length > COLLAGE_LIMITS.photos * 2) return { ok: false, error: "too_many_photos", status: 400 };
  const [{ data: rows }, { data: sources }] = await Promise.all([
    want.length
      ? db.from("photos").select("id, source_id, name, is_video").eq("album_id", albumId).in("id", want)
      : Promise.resolve({ data: [] as { id: string; source_id: string | null; name: string | null; is_video: boolean | null }[] }),
    db.from("album_sources").select("id, stage").eq("album_id", albumId),
  ]);
  const allowed = new Set(
    filterDeliveryPhotos((rows ?? []) as { id: string; source_id: string | null; name: string | null; is_video: boolean | null }[], sources ?? [])
      .filter((p) => !p.is_video && !VIDEO_RE.test(p.name ?? ""))
      .map((p) => p.id),
  );
  const check = sanitizeDoc(body.doc, allowed);
  if (!check.ok) return { ok: false, error: check.error, status: 400 };

  const now = new Date();
  const row = {
    title: cleanTitle(body.title),
    data: check.doc,
    updated_at: now.toISOString(),
    expires_at: new Date(now.getTime() + COLLAGE_LIMITS.keepMs).toISOString(),
  };
  // KHÔNG dọn bộ hết hạn ở đây: tự lưu chạy liên tục, mỗi lượt thêm một câu
  // DELETE là phí. Dọn khi mở danh sách (listCollages) + cron hằng ngày là đủ.

  const id = typeof body.id === "string" && UUID_RE.test(body.id) ? body.id : null;
  if (id) {
    const { data, error } = await db.from("album_collages").update(row).eq("id", id).eq("album_id", albumId).select("id").maybeSingle();
    if (error) return { ok: false, error: missingTable(error) ? "not_ready" : "save_failed", status: missingTable(error) ? 503 : 500 };
    // Bộ cũ đã hết hạn / bị xoá ở máy khác → lưu thành bộ mới, khách không mất việc đang làm.
    if (data) return { ok: true, id, updatedAt: row.updated_at, expiresAt: row.expires_at };
  }
  const { count, error: cErr } = await db.from("album_collages").select("id", { count: "exact", head: true }).eq("album_id", albumId);
  if (cErr) return { ok: false, error: missingTable(cErr) ? "not_ready" : "save_failed", status: missingTable(cErr) ? 503 : 500 };
  if ((count ?? 0) >= COLLAGE_LIMITS.sets) return { ok: false, error: "too_many_sets", status: 409 };
  const { data, error } = await db.from("album_collages").insert({ album_id: albumId, ...row }).select("id").single();
  if (error || !data) return { ok: false, error: missingTable(error) ? "not_ready" : "save_failed", status: missingTable(error) ? 503 : 500 };
  return { ok: true, id: data.id as string, updatedAt: row.updated_at, expiresAt: row.expires_at };
}

export async function deleteCollage(db: SupabaseClient, albumId: string, id: string): Promise<boolean> {
  if (!UUID_RE.test(id)) return false;
  const { error } = await db.from("album_collages").delete().eq("id", id).eq("album_id", albumId);
  return !error;
}

/** Cron hằng ngày: xoá mọi bộ layout đã hết hạn (album không ai mở lại thì không được dọn tại chỗ). */
export async function purgeAllExpiredCollages(db: SupabaseClient): Promise<number> {
  const { data, error } = await db.from("album_collages").delete().lt("expires_at", new Date().toISOString()).select("id");
  if (error) return 0;
  return data?.length ?? 0;
}
