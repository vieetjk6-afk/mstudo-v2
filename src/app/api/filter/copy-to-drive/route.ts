import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { copyFilesToFilterDrive } from "@/lib/filter-drive";

export const dynamic = "force-dynamic";

/**
 * Chép ảnh đã lọc sang Drive bằng kết nối Drive toàn quyền đã lưu — KHÔNG cần
 * đăng nhập lại. Yêu cầu đăng nhập (chủ studio) + đã kết nối Drive cho Lọc ảnh.
 *
 * Body:
 *  - files: [{ id, name }]  các file Drive cần chép.
 *  - sourceFolderUrl?       link ảnh gốc → tạo thư mục con "Anh Chon" bên trong.
 *  - targetFolderUrl?       link thư mục đích có sẵn (studio tự chọn).
 *  - newFolderName?         tên thư mục con khi tạo mới (mặc định "Anh Chon").
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    files?: { id: string; name: string }[];
    sourceFolderUrl?: string;
    targetFolderUrl?: string;
    newFolderName?: string;
  };

  const files = (Array.isArray(body.files) ? body.files : [])
    .filter((f) => f && typeof f.id === "string" && typeof f.name === "string")
    .slice(0, 3000);
  if (!files.length) return NextResponse.json({ error: "Không có ảnh để copy." }, { status: 400 });

  const res = await copyFilesToFilterDrive(user.id, {
    files,
    sourceFolderUrl: body.sourceFolderUrl,
    targetFolderUrl: body.targetFolderUrl,
    newFolderName: body.newFolderName,
  });

  if (!res.ok) {
    const map: Record<string, string> = {
      not_connected: "Chưa kết nối Google Drive cho công cụ Lọc ảnh. Hãy bấm “Kết nối Google Drive” một lần.",
      no_files: "Không có ảnh để copy.",
      no_target: "Chưa xác định được thư mục đích (thiếu link ảnh gốc để tạo thư mục con).",
      target_not_folder: "Link đích không phải là thư mục Drive.",
      target_unreachable: "Không mở được thư mục đích. Tài khoản Drive đã kết nối không có quyền vào thư mục này.",
      create_folder_failed:
        "Không tạo được thư mục trong link ảnh gốc. Tài khoản Drive đã kết nối cần có quyền chỉnh sửa link đó (bạn sở hữu, hoặc link ở chế độ “Bất kỳ ai có đường liên kết → Người chỉnh sửa”).",
    };
    return NextResponse.json({ error: map[res.error] ?? res.error }, { status: 200 });
  }

  return NextResponse.json(res);
}
