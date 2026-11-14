import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { backupGzipStream } from "@/lib/admin/system-backup";
import { backupFileName } from "@/lib/admin/backup-tables";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Tải bản sao lưu TOÀN BỘ hệ thống về máy (file .json.gz). Chỉ admin. Dùng
 * service-role nên bỏ qua RLS, lấy đủ mọi studio. Không chứa mật khẩu đăng nhập
 * và các token/khoá bí mật (xem BACKUP_OMIT_COLUMNS).
 *
 * Trả về theo DÒNG CHẢY + nén: bản cũ dựng cả DB thành một chuỗi JSON rồi trả
 * một lần — vướng trần 4,5 MB thân phản hồi của Vercel và giữ cả DB trong RAM.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { stream } = backupGzipStream(String(admin.email ?? "admin"));
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${backupFileName(new Date())}"`,
      "Cache-Control": "no-store",
    },
  });
}
