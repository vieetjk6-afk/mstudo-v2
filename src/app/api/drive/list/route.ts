import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveSource, walkFolderPhotos } from "@/lib/drive-server";
import { listFilterDrivePhotos } from "@/lib/filter-drive";
import { extractFolderId, isFolderLink } from "@/lib/drive";

export const dynamic = "force-dynamic";

/**
 * Liệt kê ảnh của một link Drive cho công cụ Lọc ảnh / Nén ảnh.
 *
 * Hai đường đọc, ưu tiên từ trên xuống:
 *  1. KẾT NỐI Drive của chính studio (OAuth đã lưu) — đọc được cả thư mục
 *     RIÊNG TƯ. Trước đây chỉ có đường khoá API nên thư mục không chia sẻ công
 *     khai trả về rỗng/404 và người dùng bấm "Tải ảnh" như không có gì xảy ra.
 *  2. GOOGLE_API_KEY — chỉ thấy thư mục đã chia sẻ "bất kỳ ai có đường liên kết".
 *
 * `recursive: true` quét cả thư mục con (ảnh hay được xếp theo JPG/RAW/ngày).
 * Luôn trả 200 kèm `error` chữ Việt để giao diện hiện được lý do.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Phiên đăng nhập đã hết. Hãy đăng nhập lại rồi tải ảnh." },
      { status: 401 }
    );

  const { url, recursive } = (await req.json().catch(() => ({}))) as {
    url?: string;
    recursive?: boolean;
  };
  if (!url?.trim()) return NextResponse.json({ error: "Chưa nhập link Drive." }, { status: 400 });
  const link = url.trim();

  if (isFolderLink(link) && !extractFolderId(link))
    return NextResponse.json({ error: "Không nhận ra link thư mục Drive." }, { status: 200 });

  // 1) Kết nối Drive của studio (thấy cả thư mục riêng tư).
  let oauthError: string | null = null;
  try {
    const viaOauth = await listFilterDrivePhotos(user.id, link, { recursive: !!recursive });
    if (viaOauth) {
      return NextResponse.json({
        files: viaOauth.files.map((f) => ({ id: f.id, name: f.name })),
        folderName: viaOauth.folderName,
        subfolders: viaOauth.subfolders,
        truncated: viaOauth.truncated,
        via: "oauth",
      });
    }
  } catch (e) {
    // Kết nối hỏng/hết hạn → thử tiếp đường khoá API rồi mới báo lỗi này.
    oauthError = e instanceof Error ? e.message : "drive_error";
  }

  // 2) Khoá API — chỉ đọc được link công khai.
  if (!process.env.GOOGLE_API_KEY)
    return NextResponse.json(
      {
        error:
          oauthError ??
          "Máy chủ chưa cấu hình GOOGLE_API_KEY. Hãy bấm “Kết nối Google Drive” để đọc bằng tài khoản của bạn.",
      },
      { status: 200 }
    );

  try {
    const folderId = isFolderLink(link) ? extractFolderId(link) : null;
    if (folderId) {
      const walk = await walkFolderPhotos(folderId, { recursive: !!recursive });
      return NextResponse.json({
        files: walk.files.map((f) => ({ id: f.id, name: f.name })),
        subfolders: walk.subfolders,
        truncated: walk.truncated,
        via: "key",
      });
    }
    const { files, folderName } = await resolveSource(link, "file");
    return NextResponse.json({
      files: files.map((f) => ({ id: f.id, name: f.name })),
      folderName,
      subfolders: 0,
      truncated: false,
      via: "key",
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "drive_error";
    const notFound = /\(40[34]\)/.test(raw);
    return NextResponse.json(
      {
        error: notFound
          ? "Không đọc được thư mục này: link chưa ở chế độ “Bất kỳ ai có đường liên kết”. Hãy bấm “Kết nối Google Drive” một lần để đọc được cả thư mục riêng tư."
          : oauthError ?? raw,
      },
      { status: 200 }
    );
  }
}
