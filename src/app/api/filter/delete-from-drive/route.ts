import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteFilesFromFilterDrive } from "@/lib/filter-drive";

export const dynamic = "force-dynamic";

/**
 * Xoá trên link Drive gốc những ảnh khách đã đánh dấu KHÔNG THÍCH, bằng kết nối
 * Drive toàn quyền đã lưu (không cần đăng nhập lại).
 *
 * Body:
 *  - albumId    album chọn ảnh (bắt buộc).
 *  - photoIds?  chỉ xoá một phần danh sách; bỏ trống = toàn bộ ảnh không thích.
 *  - permanent? true = xoá hẳn; mặc định chuyển vào Thùng rác Drive (phục hồi
 *               được trong 30 ngày).
 *
 * Danh sách file KHÔNG nhận từ client: máy chủ tự tra bảng dislikes của album →
 * photos.drive_file_id. Nhờ vậy một tài khoản đăng nhập không thể mượn endpoint
 * này để xoá file Drive tuỳ ý.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    albumId?: string;
    photoIds?: string[];
    permanent?: boolean;
  };
  const albumId = body.albumId?.trim();
  if (!albumId) return NextResponse.json({ error: "Thiếu album." }, { status: 400 });

  // Quyền: chỉ chủ album (hoặc admin) — đọc qua session nên RLS tự chặn album
  // của studio khác.
  const { data: album } = await supabase.from("albums").select("id, title").eq("id", albumId).maybeSingle();
  if (!album) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const only = Array.isArray(body.photoIds) ? new Set(body.photoIds.slice(0, 5000)) : null;

  const { data: dislikes } = await supabase
    .from("dislikes")
    .select("photo_id, photo_name")
    .eq("album_id", album.id);
  const wanted = (dislikes ?? []).filter((d) => !only || only.has(d.photo_id));
  if (wanted.length === 0) {
    return NextResponse.json({ error: "Không có ảnh nào trong danh sách không thích." }, { status: 200 });
  }

  const { data: photos } = await supabase
    .from("photos")
    .select("id, drive_file_id, name")
    .eq("album_id", album.id)
    .in(
      "id",
      wanted.map((d) => d.photo_id)
    );
  const files = (photos ?? [])
    .filter((p) => p.drive_file_id)
    .map((p) => ({ id: p.drive_file_id as string, name: p.name ?? "" }));
  if (files.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy file Drive tương ứng." }, { status: 200 });
  }

  const res = await deleteFilesFromFilterDrive(user.id, files, { permanent: !!body.permanent });
  if (!res.ok) {
    const map: Record<string, string> = {
      not_connected:
        "Chưa kết nối Google Drive cho công cụ Lọc ảnh. Hãy bấm “Kết nối Google Drive” một lần (bằng tài khoản sở hữu link ảnh gốc).",
      no_files: "Không có ảnh để xoá.",
    };
    return NextResponse.json({ error: map[res.error] ?? res.error }, { status: 200 });
  }

  // Ảnh đã xoá trên Drive thì bỏ luôn khỏi album — nếu không lưới ảnh của khách
  // còn trơ ra thumbnail hỏng. ON DELETE CASCADE dọn cả dislikes/selections.
  const deletedSet = new Set(res.deletedIds);
  const removedPhotoIds = (photos ?? []).filter((p) => deletedSet.has(p.drive_file_id)).map((p) => p.id);
  if (removedPhotoIds.length > 0) {
    // Service role: xoá ảnh khỏi album sau khi đã kiểm tra quyền ở trên.
    await createAdminClient().from("photos").delete().in("id", removedPhotoIds);
  }

  return NextResponse.json({
    ok: true,
    deleted: res.deleted,
    removedPhotoIds,
    permanent: !!body.permanent,
    failed: res.failed,
  });
}
