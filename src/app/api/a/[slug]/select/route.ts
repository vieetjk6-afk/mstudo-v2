import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIp } from "@/lib/rate-limit";
import { excludeDisliked } from "@/lib/album-dislike";
import { verifyAlbumAccess } from "@/lib/album-access";
import { chunk } from "@/lib/photos";
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

  // Chuẩn hoá tên khách + ghi chú MỘT lần ở đây (cắt độ dài theo đúng luật JS cũ)
  // để đường RPC và đường cũ ghi ra cùng một dữ liệu.
  const clientName = body.clientName?.trim().slice(0, 200) || null;
  const cleanNotes: Record<string, string> = {};
  for (const id of [...photoIds, ...dislikedIds]) {
    const n = typeof notes[id] === "string" ? notes[id].trim().slice(0, 2000) : "";
    if (n) cleanNotes[id] = n;
  }

  // Đường CHÍNH: hàm save_album_selection (migrations/luu_lua_chon_album.sql) —
  // chỉ ghi phần chênh lệch, trong MỘT transaction, lọc ảnh lạ ngay trong SQL.
  // Trước đây mỗi cú bấm xoá sạch rồi chèn lại toàn bộ: O(n²) lượt ghi, ~2n sự
  // kiện Realtime, mất photographer_note, và chèn hỏng giữa chừng là khách mất
  // sạch lựa chọn.
  // Mã không phải UUID thì bỏ trước khi gửi: ép kiểu uuid[] trong SQL sẽ làm hỏng
  // CẢ lượt lưu, trong khi luật xưa giờ là "mã lạ thì lờ đi".
  const selUuids = photoIds.filter(laUuid);
  const disUuids = dislikedIds.filter(laUuid);
  const { data: rpc, error: rpcErr } = await admin.rpc("save_album_selection", {
    p_album: album.id,
    p_session: sessionId,
    p_photo_ids: selUuids,
    p_dislike_ids: hasDislikes ? disUuids : null,
    p_client_name: clientName,
    p_notes: cleanNotes,
  });
  if (!rpcErr) {
    const r = (Array.isArray(rpc) ? rpc[0] : rpc) as { selected?: number; disliked?: number } | null;
    return NextResponse.json({ ok: true, count: r?.selected ?? 0, disliked: r?.disliked ?? 0 });
  }
  // Chỉ lùi về đường cũ khi database CHƯA chạy migration (thiếu hàm, hoặc thiếu
  // bảng dislikes mà hàm tham chiếu). Lỗi khác (mất kết nối, mã ảnh không phải
  // UUID…) thì báo lỗi luôn — transaction đã rollback nên lựa chọn cũ còn nguyên.
  if (!chuaCoHamLuu(rpcErr)) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  return saveLegacy(admin, album.id, sessionId, {
    photoIds: selUuids,
    dislikedIds: disUuids,
    hasDislikes,
    clientName,
    notes: cleanNotes,
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function laUuid(id: unknown): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}

/** Lỗi của rpc có phải do database chưa chạy luu_lua_chon_album.sql không. */
function chuaCoHamLuu(e: { code?: string | null; message?: string | null }): boolean {
  // PGRST202 (PostgREST không thấy hàm) / 42883 (Postgres: undefined_function) —
  // cùng bộ mã src/lib/album-rows.ts dùng. Thiếu bảng (42P01/PGRST205) cũng tính:
  // đường cũ biết bỏ qua bảng dislikes chưa có.
  return e.code === "PGRST202" || e.code === "42883" || phanLoaiLoi(e) === "thieu-bang";
}

/** Số mã ảnh mỗi lượt `.in()` — giữ URL PostgREST ngắn (hàng nghìn UUID làm URL gãy). */
const IN_CHUNK = 200;

/**
 * ĐƯỜNG CŨ — chỉ chạy khi database chưa có hàm save_album_selection. Giữ nguyên
 * hành vi trước đây (xoá phiên rồi chèn lại), chỉ khác là kiểm ảnh thuộc album
 * theo từng lô thay vì một `.in()` khổng lồ.
 */
async function saveLegacy(
  admin: ReturnType<typeof createAdminClient>,
  albumId: string,
  sessionId: string,
  o: {
    photoIds: string[];
    dislikedIds: string[];
    hasDislikes: boolean;
    clientName: string | null;
    notes: Record<string, string>;
  }
) {
  // Validate the photos belong to this album and grab their names.
  const allIds = [...new Set([...o.photoIds, ...o.dislikedIds])];
  const valid = new Map<string, string>();
  for (const ids of chunk(allIds, IN_CHUNK)) {
    const { data: photos } = await admin
      .from("photos")
      .select("id, name")
      .eq("album_id", albumId)
      .in("id", ids);
    for (const p of photos ?? []) valid.set(p.id, p.name);
  }

  // Replace this session's selection (delete then insert).
  await admin
    .from("selections")
    .delete()
    .eq("album_id", albumId)
    .eq("session_id", sessionId);

  const rows = o.photoIds
    .filter((id) => valid.has(id))
    .map((id) => ({
      album_id: albumId,
      photo_id: id,
      photo_name: valid.get(id) ?? "",
      session_id: sessionId,
      client_name: o.clientName,
      client_note: o.notes[id] || null,
    }));

  if (rows.length > 0) {
    const { error } = await admin.from("selections").insert(rows);
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  // Danh sách "không thích" — thay thế trọn gói giống selections.
  let dislikeCount = 0;
  if (o.hasDislikes) {
    await admin
      .from("dislikes")
      .delete()
      .eq("album_id", albumId)
      .eq("session_id", sessionId);

    const dRows = o.dislikedIds
      .filter((id) => valid.has(id))
      .map((id) => ({
        album_id: albumId,
        photo_id: id,
        photo_name: valid.get(id) ?? "",
        session_id: sessionId,
        client_note: o.notes[id] || null,
      }));
    dislikeCount = dRows.length;
    if (dRows.length > 0) {
      const { error } = await admin.from("dislikes").insert(dRows);
      // Bảng chưa tồn tại (chưa chạy migration album_dislikes.sql) thì bỏ qua —
      // lựa chọn ảnh phía trên đã lưu xong, không được báo lỗi cho khách.
      if (error && error.code !== "42P01" && error.code !== "PGRST205") {
        return NextResponse.json({ error: "server_error" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true, count: rows.length, disliked: dislikeCount });
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
