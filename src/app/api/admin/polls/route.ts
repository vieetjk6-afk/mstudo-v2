import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToOwners } from "@/lib/push";
import { POLL_COLS, POLL_LIMITS, tally, type PollAudience, type PollRow } from "@/lib/polls";

export const dynamic = "force-dynamic";

/**
 * BÌNH CHỌN HỆ THỐNG — phía admin (Cài đặt hệ thống → Bình chọn). Chỉ admin.
 *
 *   GET   → { polls } — mọi bình chọn, mới nhất trước, kèm kết quả.
 *   POST  { question, options[], multi, audience, push } → tạo và MỞ ngay.
 *         push = true → gửi thêm thông báo đẩy tới điện thoại chủ studio.
 *   PATCH { id, active } → đóng / mở lại.
 */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data, error } = await createAdminClient()
    .from("system_polls")
    .select(POLL_COLS)
    .order("created_at", { ascending: false })
    .limit(20);
  // Bảng chưa có (chưa chạy supabase/binh-chon.sql) → báo để màn admin nhắc.
  if (error) return NextResponse.json({ polls: [], missingTable: true });
  const polls = await Promise.all(((data ?? []) as PollRow[]).map(async (p) => ({ ...(await tally(p, null)), audience: p.audience, created_at: p.created_at })));
  return NextResponse.json({ polls });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    question?: unknown;
    options?: unknown;
    multi?: unknown;
    audience?: unknown;
    push?: unknown;
  };
  const question = String(body.question ?? "").trim().slice(0, POLL_LIMITS.question);
  const options = (Array.isArray(body.options) ? body.options : [])
    .map((o) => String(o ?? "").trim().slice(0, POLL_LIMITS.option))
    .filter(Boolean);
  if (!question) return NextResponse.json({ error: "empty_question" }, { status: 400 });
  if (options.length < POLL_LIMITS.minOptions || options.length > POLL_LIMITS.maxOptions) {
    return NextResponse.json({ error: "bad_options" }, { status: 400 });
  }
  const audience: PollAudience = body.audience === "owners" ? "owners" : "everyone";

  const db = createAdminClient();
  const { data, error } = await db
    .from("system_polls")
    .insert({ question, options, multi: body.multi === true, audience, created_by: admin.id })
    .select(POLL_COLS)
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "insert_failed" }, { status: 500 });

  // Thông báo đẩy (tuỳ chọn): kéo người không mở webapp quay lại bỏ phiếu. Đăng
  // ký đẩy gắn theo chủ studio, nên chỉ chủ tài khoản nhận được.
  let pushed = 0;
  if (body.push === true) {
    const { data: owners } = await db.from("profiles").select("id").eq("is_active", true).is("studio_owner_id", null);
    pushed = await sendPushToOwners(
      ((owners ?? []) as { id: string }[]).map((o) => o.id),
      { title: "Bình chọn mới", body: question, url: "/dashboard", tag: `mstudo-poll-${(data as PollRow).id}` }
    ).catch(() => 0);
  }

  return NextResponse.json({ poll: await tally(data as PollRow, null), pushed });
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; active?: unknown };
  if (typeof body.id !== "string" || typeof body.active !== "boolean") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { error } = await createAdminClient()
    .from("system_polls")
    .update({ active: body.active, closed_at: body.active ? null : new Date().toISOString() })
    .eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
