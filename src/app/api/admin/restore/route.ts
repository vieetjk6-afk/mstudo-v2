import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRestorableTable, rowForRestore } from "@/lib/admin/backup-tables";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Khôi phục MỘT LÔ dòng của MỘT bảng từ bản sao lưu. Chỉ admin.
 *
 * Trình duyệt đọc file sao lưu (.json hoặc .json.gz), tự xem trước số dòng, rồi
 * gửi từng lô (≤ 500 dòng, ≤ ~1,5 MB) theo đúng thứ tự BACKUP_TABLES (bảng cha
 * → con). Trước đây cả file được gửi trong MỘT request — Vercel chặn thân
 * request > 4,5 MB nên khôi phục hỏng ngay khi hệ thống có dữ liệu thật.
 *
 * UPSERT theo khoá chính: bản ghi cũ được cập nhật, bản ghi thiếu được tạo lại
 * — KHÔNG xoá dữ liệu hiện có không nằm trong bản sao lưu. Cột đặc quyền của
 * profiles (H6), cột sinh tự động và cột bí mật bị gạt (rowForRestore).
 *
 * body: { table: string, rows: object[] }
 */
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_ROWS = 1000;

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { table, rows } = (body ?? {}) as { table?: unknown; rows?: unknown };
  if (typeof table !== "string" || !isRestorableTable(table)) {
    return NextResponse.json({ error: "bad_table" }, { status: 400 });
  }
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_ROWS) {
    return NextResponse.json({ error: "bad_rows" }, { status: 400 });
  }
  if (!rows.every((r) => r && typeof r === "object" && !Array.isArray(r))) {
    return NextResponse.json({ error: "bad_rows" }, { status: 400 });
  }

  const safe = (rows as Record<string, unknown>[]).map((r) => rowForRestore(table, r));
  const { error } = await createAdminClient().from(table).upsert(safe, { ignoreDuplicates: false });
  if (error) return NextResponse.json({ error: error.message, code: error.code ?? null }, { status: 422 });
  return NextResponse.json({ ok: true, restored: safe.length });
}
