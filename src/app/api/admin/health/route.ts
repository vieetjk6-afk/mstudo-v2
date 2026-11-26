import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { requireAdmin } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissing, loadRunState } from "@/lib/system-runs";
import { LIMITS, cronHealth } from "@/lib/system-runs-rules";
import { thangUtc, tomTatThang, type DongUsage } from "@/lib/luu-luong-rules";

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
  const now = Date.now();
  const dauThang = `${thangUtc(now)}-01`;
  const [state, statsRes, errRes, usageRes, resolvedRes] = await Promise.all([
    loadRunState(db),
    db.rpc("system_stats"),
    db
      .from("system_errors")
      .select("signature, source, message, path, count, last_seen")
      .gte("last_seen", since)
      .order("last_seen", { ascending: false })
      .limit(400),
    // Lưu lượng tháng này (ước tính Supabase do app đếm + số liệu Vercel).
    db
      .from("system_usage")
      .select("day, source, metric, quantity, unit, cost, requests")
      .gte("day", dauThang)
      .limit(2000),
    // Lỗi admin đã bấm "Đã xử lý" (chưa có bảng thì coi như chưa xử lý gì).
    db.from("system_error_resolved").select("signature, resolved_at").limit(1000),
  ]);
  const resolved = new Map<string, string>();
  for (const r of (resolvedRes.error ? [] : resolvedRes.data ?? []) as { signature: string; resolved_at: string }[]) resolved.set(r.signature, r.resolved_at);
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
      // Lỗi đã xử lý mà KHÔNG xảy ra lại sau mốc đó thì ẩn; xảy ra lại thì hiện.
      errors: [...byId.values()].filter((e) => !(resolved.has(e.signature) && Date.parse(e.lastAt) <= Date.parse(resolved.get(e.signature)!))).slice(0, 20),
      errorsResolved: [...byId.values()].filter((e) => resolved.has(e.signature) && Date.parse(e.lastAt) <= Date.parse(resolved.get(e.signature)!)).length,
      // false = chưa có bảng system_error_resolved (chưa chạy SQL) → ẩn nút.
      canResolve: !resolvedRes.error,
      limits: LIMITS,
      // null = chưa chạy migration luu_luong.sql.
      usage: usageRes.error ? null : tomTatThang((usageRes.data ?? []) as DongUsage[], thangUtc(now), now),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * POST { signatures: string[] } — đánh dấu các lỗi là "Đã xử lý". Lỗi xảy ra
 * lại sau mốc này sẽ tự hiện lại trên trang Sức khoẻ.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { signatures?: unknown };
  const sigs = Array.isArray(body.signatures)
    ? [...new Set(body.signatures.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64))].slice(0, 200)
    : [];
  if (!sigs.length) return NextResponse.json({ error: "thieu_signatures" }, { status: 400 });
  const now = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("system_error_resolved")
    .upsert(sigs.map((signature) => ({ signature, resolved_at: now })), { onConflict: "signature" });
  if (error) return NextResponse.json({ error: "ghi_that_bai", detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, resolved: sigs.length });
}
