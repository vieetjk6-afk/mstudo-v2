import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { adminDriveConfigured, listAdminDriveBackups } from "@/lib/mstudo-drive";
import { backupEveryDays, backupKeep, reportAutoBackup, runAutoBackup } from "@/lib/admin/system-backup";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Trạng thái sao lưu tự động: Drive đã nối chưa + các bản đang có trên Drive. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const base = { configured: adminDriveConfigured(), keep: backupKeep(), everyDays: backupEveryDays() };
  try {
    const files = await listAdminDriveBackups();
    return NextResponse.json({ ...base, connected: files !== null, files: files ?? [], error: null });
  } catch (e) {
    return NextResponse.json({ ...base, connected: true, files: [], error: (e as Error)?.message || String(e) });
  }
}

/** "Sao lưu ngay" — chạy một lượt lên Drive, không chờ tới đêm. */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const res = await runAutoBackup({ force: true, by: String(admin.email ?? "admin") });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
  await reportAutoBackup(res);
  if (res.skipped) return NextResponse.json({ ok: true, skipped: true });
  return NextResponse.json({
    ok: true,
    file: res.file,
    rows: res.summary.totalRows,
    missing: res.summary.missing,
    errors: res.summary.errors,
    removed: res.removed,
  });
}
