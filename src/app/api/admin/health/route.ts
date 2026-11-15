import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { requireAdmin } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissing, loadRunState } from "@/lib/system-runs";
import { LIMITS, cronHealth } from "@/lib/system-runs-rules";

export const dynamic = "force-dynamic";

type ErrRow = { signature: string; source: string; message: string; path: string | null; count: number; last_seen: string };

/**
 * Số liệu cho khối "Sức khoẻ hệ thống" (admin): lượt chạy gần nhất của từng
 * việc tự động, lượt SQL tự chạy lúc deploy, dung lượng so với trần gói Free,
 * lỗi 7 ngày qua. Ba câu hỏi nhỏ tới database, chạy song song.
 *
 * Chưa chạy migration he_thong_van_hanh.sql → migrated: false, màn hình chỉ
 * cách cập nhật thay vì báo "mọi thứ bình thường" trên một bảng không tồn tại.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [state, statsRes, errRes] = await Promise.all([
    loadRunState(db),
    db.rpc("system_stats"),
    db
      .from("system_errors")
      .select("signature, source, message, path, count, last_seen")
      .gte("last_seen", since)
      .order("last_seen", { ascending: false })
      .limit(400),
  ]);
  const migrated = !!state && !isMissing(errRes.error);

  // Một chữ ký có một dòng mỗi ngày → gộp lại; dòng đầu gặp là lần mới nhất.
  const byId = new Map<string, { signature: string; source: string; message: string; path: string | null; count: number; lastAt: string }>();
  for (const r of (errRes.data ?? []) as ErrRow[]) {
    const cur = byId.get(r.signature);
    if (cur) cur.count += r.count;
    else byId.set(r.signature, { signature: r.signature, source: r.source, message: r.message, path: r.path, count: r.count, lastAt: r.last_seen });
  }

  const sql = state?.runs.find((r) => r.kind === "sql") ?? null;
  const d = (sql?.detail ?? {}) as { sha256?: unknown; git_sha?: unknown; error?: unknown };
  return NextResponse.json(
    {
      migrated,
      // Có gói SQL riêng cho tính năng này thì màn hình đưa link chép; không thì chỉ tên file.
      setupSql: existsSync(join(process.cwd(), "supabase", "he-thong-van-hanh.sql")) ? "/api/setup-sql/he-thong-van-hanh" : null,
      // Thiếu CRON_SECRET là mọi cron trả 401 và không để lại dòng nào.
      cronSecretSet: !!process.env.CRON_SECRET,
      crons: cronHealth(state),
      sql: sql
        ? {
            name: sql.name,
            ok: !!sql.ok,
            at: sql.started_at,
            durationMs: sql.duration_ms ?? null,
            sha: typeof d.sha256 === "string" ? d.sha256.slice(0, 12) : null,
            gitSha: typeof d.git_sha === "string" && d.git_sha ? d.git_sha.slice(0, 7) : null,
            error: typeof d.error === "string" ? d.error.slice(-400) : null,
          }
        : null,
      stats: statsRes.error ? null : statsRes.data,
      errors: [...byId.values()].slice(0, 20),
      limits: LIMITS,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
