import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { copyFilesToFilterDrive } from "@/lib/filter-drive";
import { PRINT_FOLDER_NAME, normalizeQuota, pickDeliveryFolder } from "@/lib/album-print-rules";

export const dynamic = "force-dynamic";
// Chép vài chục tới vài trăm ảnh, 4 ảnh một lượt — quá thời gian mặc định.
export const maxDuration = 120;

/**
 * Studio xử lý ẢNH IN khách đã chọn trong album giao khách.
 *
 * Body { action: "copy" }:
 *   Tạo (hoặc dùng lại) thư mục "Ảnh in" NGAY TRONG thư mục Drive giao file
 *   hoàn thiện, chép các ảnh khách chọn vào đó bằng kết nối Drive của công cụ
 *   Lọc ảnh (studio_drive.filter_refresh_token — scope `drive`, ghi được vào
 *   thư mục không do app tạo; kết nối Drive đồng bộ hợp đồng chỉ có drive.file
 *   nên không làm được việc này). Ảnh đã có trong thư mục thì bỏ qua. Xong thì
 *   khoá phần chọn của khách (albums.print_copied_at).
 * Body { action: "unlock" }:
 *   Mở lại cho khách chọn / gửi lại ảnh in.
 * Body { action: "quota", quota }:
 *   Số ảnh in tặng của ALBUM LẺ (albums.print_quota). Album của hợp đồng nhập
 *   số ở hợp đồng; máy chủ lấy số lớn hơn của hai nơi (lib/album-print).
 *
 * Danh sách file KHÔNG nhận từ client: máy chủ tự tra print_picks → photos
 * (giống /api/filter/delete-from-drive), nên endpoint không chép được file tuỳ ý.
 */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { action?: string; quota?: unknown };

  // Quyền: đọc qua session nên RLS chỉ trả album của chính studio (hoặc admin).
  const { data: album } = await supabase.from("albums").select("id, title").eq("id", params.id).maybeSingle();
  if (!album) return NextResponse.json({ error: "Không tìm thấy album." }, { status: 404 });

  if (body.action === "unlock") {
    const { error } = await supabase.from("albums").update({ print_copied_at: null }).eq("id", album.id);
    if (error) return NextResponse.json({ error: "Không mở lại được — chạy supabase/migrations/anh_in_tang.sql rồi thử lại." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "quota") {
    const quota = normalizeQuota(body.quota);
    const { error } = await supabase.from("albums").update({ print_quota: quota > 0 ? quota : null }).eq("id", album.id);
    if (error) {
      return NextResponse.json({ error: "Chưa lưu được — chạy supabase/anh-in-tang.sql trên Supabase (SQL Editor) rồi thử lại." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, quota });
  }
  if (body.action !== "copy") return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const [{ data: picks, error: picksErr }, { data: sources }] = await Promise.all([
    supabase.from("print_picks").select("photo_id").eq("album_id", album.id),
    supabase.from("album_sources").select("id, name, stage, drive_url, position").eq("album_id", album.id),
  ]);
  if (picksErr) {
    return NextResponse.json({ error: "Database chưa có bảng ảnh in — chạy supabase/migrations/anh_in_tang.sql trên Supabase." }, { status: 500 });
  }
  if (!picks?.length) return NextResponse.json({ error: "Khách chưa gửi ảnh in nào." }, { status: 400 });

  const folder = pickDeliveryFolder(sources ?? []);
  if (!folder?.drive_url) {
    return NextResponse.json({ error: "Album chưa có link Drive giao file hoàn thiện — lưu link ở mục trên trước." }, { status: 400 });
  }

  const { data: photos } = await supabase
    .from("photos")
    .select("id, drive_file_id, name")
    .eq("album_id", album.id)
    .in("id", picks.map((p) => p.photo_id as string));
  const files = (photos ?? [])
    .filter((p) => p.drive_file_id)
    .map((p) => ({ id: p.drive_file_id as string, name: (p.name as string) || (p.drive_file_id as string) }));
  if (!files.length) return NextResponse.json({ error: "Không tìm thấy file Drive của các ảnh khách chọn." }, { status: 400 });

  const res = await copyFilesToFilterDrive(user.id, {
    files,
    sourceFolderUrl: folder.drive_url,
    newFolderName: PRINT_FOLDER_NAME,
  });
  if (!res.ok) {
    const map: Record<string, string> = {
      not_connected: "not_connected",
      no_target: "Không đọc được link Drive giao file hoàn thiện của album.",
      create_folder_failed:
        "Không tạo được thư mục “Ảnh in” trong thư mục giao khách. Tài khoản Google đã kết nối cần quyền chỉnh sửa thư mục đó (dùng đúng tài khoản sở hữu thư mục).",
    };
    return NextResponse.json({ error: map[res.error] ?? res.error }, { status: 200 });
  }

  // Chép được ít nhất một phần → khoá phần chọn của khách để danh sách không đổi
  // sau khi đã đi in. Ảnh lỗi thì studio bấm copy lại (ảnh đã có sẽ bỏ qua).
  const copiedAt = new Date().toISOString();
  if (res.failed.length < files.length) {
    await supabase.from("albums").update({ print_copied_at: copiedAt }).eq("id", album.id);
  }

  return NextResponse.json({
    ok: true,
    folderUrl: res.folderUrl,
    folderName: res.folderName,
    copied: res.copied,
    skipped: res.skipped,
    failed: res.failed,
    copiedAt: res.failed.length < files.length ? copiedAt : null,
  });
}
