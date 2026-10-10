import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePlan, type Plan } from "@/lib/plans";
import { albumAiGiftExpiry, albumAiStatusOf } from "@/lib/albumai";
import { isMissingColumn } from "@/lib/missing-column";

export const dynamic = "force-dynamic";

/**
 * Máy chủ Album AI (albumai.mstudo.com) hỏi: email này có bản quyền Album AI
 * tặng kèm gói Studio không? Xem docs/album-ai.md.
 *
 *   POST /api/albumai/license
 *   Authorization: Bearer $ALBUMAI_LICENSE_SECRET
 *   { "email": "chu-studio@example.com" }
 *
 * Lần hỏi ĐẦU TIÊN của một tài khoản Studio đủ điều kiện là lúc KÍCH HOẠT: ghi
 * mốc bắt đầu + hết hạn (1 năm). Đăng nhập lại chỉ đọc mốc đã ghi, không kéo
 * dài thêm.
 *
 * Fail-closed như /api/cron/*: thiếu khoá thì khoá cửa. Route này trả lời "email
 * X có phải chủ studio gói Studio không", để mở là ai cũng dò được danh sách
 * khách của mstudo.
 */
function authorized(req: Request): boolean {
  const secret = process.env.ALBUMAI_LICENSE_SECRET;
  if (!secret) return false;
  const got = Buffer.from((req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(secret);
  return got.length === want.length && timingSafeEqual(got, want);
}

type Row = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  plan: Plan | null;
  plan_cycle: string | null;
  plan_expires_at: string | null;
  studio_owner_id: string | null;
  albumai_activated_at: string | null;
  albumai_expires_at: string | null;
};

const NO_MIGRATION = { error: "missing_migration", message: "Chưa chạy supabase/migrations/albumai_license.sql" };

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  // Email trong profiles chép từ auth.users — Supabase luôn lưu chữ thường.
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("profiles")
    .select("id, email, role, is_active, plan, plan_cycle, plan_expires_at, studio_owner_id, albumai_activated_at, albumai_expires_at")
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingColumn(error, "albumai")) return NextResponse.json(NO_MIGRATION, { status: 503 });
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const p = data as Row | null;
  if (!p) return NextResponse.json({ email, licensed: false, reason: "no_account" });
  if (!p.is_active) return NextResponse.json({ email, licensed: false, reason: "inactive" });

  const plan = effectivePlan(p.plan, p.plan_expires_at);
  const status = albumAiStatusOf(p, !!p.studio_owner_id);

  if (status.state === "active") {
    return NextResponse.json({ email, licensed: true, source: "studio_gift", activatedAt: p.albumai_activated_at, expiresAt: status.expiresAt });
  }
  if (status.state !== "ready") {
    const reason = { expired: "gift_expired", trial: "studio_trial", staff: "staff_account", upgrade: "not_studio" }[status.state];
    return NextResponse.json({
      email,
      licensed: false,
      reason,
      plan,
      expiresAt: status.state === "expired" ? status.expiresAt : null,
    });
  }

  // Kích hoạt. Điều kiện `albumai_expires_at is null` để hai lượt đăng nhập
  // chạy song song không ghi đè mốc của nhau — lượt thua đọc lại mốc đã ghi.
  const now = new Date();
  const patch = { albumai_activated_at: now.toISOString(), albumai_expires_at: albumAiGiftExpiry(now) };
  const { data: won, error: upErr } = await db
    .from("profiles")
    .update(patch)
    .eq("id", p.id)
    .is("albumai_expires_at", null)
    .select("albumai_activated_at, albumai_expires_at")
    .maybeSingle();
  if (upErr) {
    if (isMissingColumn(upErr, "albumai")) return NextResponse.json(NO_MIGRATION, { status: 503 });
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  let granted = won as { albumai_activated_at: string; albumai_expires_at: string } | null;
  if (!granted) {
    const { data: again } = await db.from("profiles").select("albumai_activated_at, albumai_expires_at").eq("id", p.id).maybeSingle();
    granted = again as typeof granted;
  }
  if (!granted?.albumai_expires_at) return NextResponse.json({ error: "db_error" }, { status: 500 });

  return NextResponse.json({
    email,
    licensed: new Date(granted.albumai_expires_at).getTime() > Date.now(),
    source: "studio_gift",
    activatedAt: granted.albumai_activated_at,
    expiresAt: granted.albumai_expires_at,
    justActivated: !!won,
  });
}
