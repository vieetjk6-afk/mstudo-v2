import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { reportAutoBackup, runAutoBackup } from "@/lib/admin/system-backup";

export const dynamic = "force-dynamic";
// Đọc toàn bộ database theo trang + nén + đẩy lên Drive.
export const maxDuration = 300;

/**
 * Cron SAO LƯU TỰ ĐỘNG (vercel.json, mỗi đêm ~03h giờ VN): xuất toàn bộ dữ liệu
 * ứng dụng → nén gzip → thư mục riêng "mstudo · Sao lưu hệ thống" trên Google
 * Drive của admin, giữ SYSTEM_BACKUP_KEEP bản mới nhất (mặc định 14).
 *
 * Hỏng (Drive bị ngắt, token hết hạn, bảng đọc lỗi) thì báo admin qua chuông +
 * web push — sao lưu hỏng âm thầm còn tệ hơn không có sao lưu.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const res = await runAutoBackup({ force: false, by: "cron" });
  await reportAutoBackup(res);
  if (!res.ok) return NextResponse.json(res, { status: 500 });
  if (res.skipped) return NextResponse.json({ ok: true, skipped: true, reason: res.reason });
  return NextResponse.json({
    ok: true,
    file: res.file.name,
    bytes: res.file.size,
    rows: res.summary.totalRows,
    missing: res.summary.missing,
    errors: res.summary.errors,
    removed: res.removed,
    ms: res.ms,
  });
}
