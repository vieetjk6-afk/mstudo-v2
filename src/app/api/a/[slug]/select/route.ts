import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIp } from "@/lib/rate-limit";
import { excludeDisliked } from "@/lib/album-dislike";
import { verifyAlbumAccess } from "@/lib/album-access";
import { chunk, diffRows, onlyUuids, type SavedRow } from "@/lib/album-selection-save";
import { phanLoaiLoi } from "@/lib/pg-loi";

export const dynamic = "force-dynamic";

/**
 * Persist a customer's selection for an album. Public endpoint (no login):
 * a selection belongs to a client-generated session id, so customers can
 * revisit and adjust their picks.
 *
 * Cùng một lượt ghi cũng lưu danh sách ảnh khách KHÔNG THÍCH (dislikedIds) —
 * bảng riêng public.dislikes, để danh sách "khách chọn" không lẫn ảnh bị loại.
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  // Chặn spam/flood ghi bảng selections từ 1 IP.
  const limited = limitByIp(req, `album-select:${params.slug}`, 20, 60_000);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    clientName?: string;
    photoIds?: string[];
    dislikedIds?: string[];
    notes?: Record<string, string>;
    access?: string;
  };

  const sessionId = body.sessionId?.trim().slice(0, 100);
  // Giới hạn số ảnh mỗi lần ghi (chống payload khổng lồ khi album không đặt hạn mức).
  const rawPhotoIds = (Array.isArray(body.photoIds) ? body.photoIds : []).slice(0, 5000);
  // Chỉ ghi lại bảng dislikes khi client THỰC SỰ gửi trường này — client cũ
  // (tab đang mở từ bản trước) không được vô tình xoá sạch danh sách không thích.
  const hasDislikes = Array.isArray(body.dislikedIds);
  const dislikedIds = hasDislikes ? body.dislikedIds!.slice(0, 5000) : [];
  const photoIds = excludeDisliked(rawPhotoIds, dislikedIds);
  const notes = body.notes && typeof body.notes === "object" ? body.notes : {};

  if (!sessionId) {
    return NextResponse.json({ error: "missing_session" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: album } = await admin
    .from("albums")
    .select("id, status, selection_limit, password_hash")
    .eq("slug", params.slug)
    .single();

  if (!album || album.status !== "published") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Album CÓ mật khẩu: chỉ ghi được khi kèm vé hợp lệ do /access phát ra sau khi
  // nhập đúng mật khẩu. Không vé → không được đụng vào lựa chọn của khách (trước
  // đây ai biết slug cũng xoá sạch/đổi được lựa chọn của album có khoá).
  if (album.password_hash && !verifyAlbumAccess(album.id, album.password_hash, body.access)) {
    return NextResponse.json({ error: "wrong_password" }, { status: 401 });
  }

  if (album.selection_limit && photoIds.length > album.selection_limit) {
    return NextResponse.json({ error: "limit_exceeded" }, { status: 400 });
  }

  const clientName = body.clientName?.trim().slice(0, 200) || null;
  const pickIds = onlyUuids(photoIds);
  const dislikeIds = onlyUuids(dislikedIds);
  // Chỉ gửi ghi chú của đúng những ảnh đang lưu, đã cắt gọn.
  const cleanNotes: Record<string, string> = {};
  for (const id of [...pickIds, ...dislikeIds]) {
    const n = notes[id];
    const t = typeof n === "string" ? n.trim().slice(0, 2000) : "";
    if (t) cleanNotes[id] = t;
  }

  // Đường chính: một transaction trong Postgres, mảng đi trong thân POST.
  if (!conNho(rpcThieuDen)) {
    const { data, error } = await admin.rpc("save_album_selection", {
      p_album_id: album.id,
      p_session_id: sessionId,
      p_client_name: clientName,
      p_photo_ids: pickIds,
      p_notes: cleanNotes,
      p_disliked_ids: hasDislikes ? dislikeIds : null,
    });
    if (!error) {
      const row = (Array.isArray(data) ? data[0] : data) as { pick_count?: number; dislike_count?: number } | null;
      return NextResponse.json({ ok: true, count: row?.pick_count ?? 0, disliked: row?.dislike_count ?? 0 });
    }
    if (!thieuHam(error)) return NextResponse.json({ error: "server_error" }, { status: 500 });
    // Database chưa chạy migrations/luu_chon_anh_tung_phan.sql → lùi về đường cũ.
    rpcThieuDen = Date.now() + NHO_MS;
  }

  return saveByDiff(admin, {
    albumId: album.id,
    sessionId,
    clientName,
    pickIds,
    dislikeIds: hasDislikes ? dislikeIds : null,
    notes: cleanNotes,
  });
}

/**
 * Nhớ (cấp tiến trình, có hạn) rằng database CHƯA có hàm save_album_selection,
 * để mỗi lần khách bấm không phải đâm vào lỗi rồi mới lùi. Hết hạn thì thử lại —
 * chủ studio chạy SQL xong là app tự dùng đường nhanh, không cần khởi động lại.
 */
const NHO_MS = 5 * 60_000;
let rpcThieuDen = 0;
const conNho = (den: number) => den > Date.now();
// PGRST202 / 42883: không thấy hàm (rpc chưa tạo).
const thieuHam = (e: { code?: string | null }) => e.code === "PGRST202" || e.code === "42883";

const thieuBang = (e: { code?: string | null; message?: string | null } | null) => phanLoaiLoi(e) === "thieu-bang";

/**
 * Đường LÙI khi chưa có hàm SQL: vẫn ghi theo phần chênh (upsert dòng mới/đổi,
 * xoá đúng dòng đã bỏ) và chia nhỏ mọi `.in()`. Upsert chạy TRƯỚC xoá — hỏng
 * giữa chừng thì khách chỉ còn thừa vài ảnh cũ, không bao giờ mất ảnh đã chọn.
 */
async function saveByDiff(
  admin: ReturnType<typeof createAdminClient>,
  o: {
    albumId: string;
    sessionId: string;
    clientName: string | null;
    pickIds: string[];
    dislikeIds: string[] | null;
    notes: Record<string, string>;
  }
) {
  // Ảnh có thật trong album? Mỗi khúc một câu ngắn, chạy song song.
  const allIds = [...new Set([...o.pickIds, ...(o.dislikeIds ?? [])])];
  const valid = new Map<string, string>();
  const found = await Promise.all(
    chunk(allIds).map((ids) => admin.from("photos").select("id, name").eq("album_id", o.albumId).in("id", ids))
  );
  for (const { data, error } of found) {
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
    for (const p of data ?? []) valid.set(p.id, p.name ?? "");
  }

  const rows = o.pickIds
    .filter((id) => valid.has(id))
    .map((id) => ({
      album_id: o.albumId,
      photo_id: id,
      photo_name: valid.get(id) ?? "",
      session_id: o.sessionId,
      client_name: o.clientName,
      client_note: o.notes[id] ?? null,
    }));
  const res = await syncTable(admin, "selections", "photo_id, photo_name, client_name, client_note", o, rows);
  if (res !== "ok") return NextResponse.json({ error: "server_error" }, { status: 500 });

  // Danh sách "không thích" — cùng cách ghi theo phần chênh.
  let dislikeCount = 0;
  if (o.dislikeIds) {
    const dRows = o.dislikeIds
      .filter((id) => valid.has(id))
      .map((id) => ({
        album_id: o.albumId,
        photo_id: id,
        photo_name: valid.get(id) ?? "",
        session_id: o.sessionId,
        client_note: o.notes[id] ?? null,
      }));
    dislikeCount = dRows.length;
    const dRes = await syncTable(admin, "dislikes", "photo_id, photo_name, client_note", o, dRows);
    // Bảng chưa tồn tại (chưa chạy migration album_dislikes.sql) thì bỏ qua —
    // lựa chọn ảnh phía trên đã lưu xong, không được báo lỗi cho khách.
    if (dRes === "error") return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: rows.length, disliked: dislikeCount });
}

/** Đưa các dòng của một phiên trong `table` về đúng `want`, chỉ ghi phần chênh. */
async function syncTable(
  admin: ReturnType<typeof createAdminClient>,
  table: "selections" | "dislikes",
  cols: string,
  o: { albumId: string; sessionId: string },
  want: SavedRow[]
): Promise<"ok" | "missing" | "error"> {
  // Đọc dòng đang lưu theo trang — PostgREST cắt mỗi lượt ở max_rows (1000).
  const existing: SavedRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from(table)
      .select(cols)
      .eq("album_id", o.albumId)
      .eq("session_id", o.sessionId)
      .order("photo_id")
      .range(from, from + 999);
    if (error) return thieuBang(error) ? "missing" : "error";
    existing.push(...((data ?? []) as unknown as SavedRow[]));
    if (!data || data.length < 1000) break;
  }

  const { upsert, remove } = diffRows(existing, want);
  for (const part of chunk(upsert, 500)) {
    const { error } = await admin.from(table).upsert(part, { onConflict: "album_id,photo_id,session_id" });
    if (error) return thieuBang(error) ? "missing" : "error";
  }
  for (const ids of chunk(remove)) {
    const { error } = await admin
      .from(table)
      .delete()
      .eq("album_id", o.albumId)
      .eq("session_id", o.sessionId)
      .in("photo_id", ids);
    if (error) return "error";
  }
  return "ok";
}

/**
 * Return the album's shared selection so any visitor can see what has already
 * been chosen (and avoid picking the same photos).
 */
export async function GET(req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const admin = createAdminClient();
  const { data: album } = await admin
    .from("albums")
    .select("id, status, password_hash")
    .eq("slug", params.slug)
    .single();

  if (!album || album.status !== "published") {
    return NextResponse.json({ selected: [], disliked: [], notes: {} });
  }

  // Album CÓ mật khẩu: chỉ trả lựa chọn + ghi chú (client_note là văn bản tự do
  // của khách) cho ai cầm vé hợp lệ. Không vé → trả rỗng như album chưa có gì,
  // nên không phân biệt được "sai vé" với "chưa chọn" → không làm máy dò.
  if (
    album.password_hash &&
    !verifyAlbumAccess(album.id, album.password_hash, req.headers.get("x-album-access"))
  ) {
    return NextResponse.json({ selected: [], disliked: [], notes: {} });
  }

  const [{ data: sel }, { data: dis }] = await Promise.all([
    admin.from("selections").select("photo_id, client_note").eq("album_id", album.id),
    admin.from("dislikes").select("photo_id, client_note").eq("album_id", album.id),
  ]);

  const selected = (sel ?? []).map((s) => s.photo_id);
  const disliked = (dis ?? []).map((d) => d.photo_id);
  const notes: Record<string, string> = {};
  for (const s of sel ?? []) if (s.client_note) notes[s.photo_id] = s.client_note;
  for (const d of dis ?? []) if (d.client_note) notes[d.photo_id] = d.client_note;
  return NextResponse.json({ selected, disliked, notes });
}
