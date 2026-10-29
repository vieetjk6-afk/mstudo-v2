import { NextResponse } from "next/server";
import { getProfileById, requireUser } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { durableAllowed } from "@/lib/rate-limit";
import { POLL_COLS, cleanChoices, inAudience, tally, type PollRow } from "@/lib/polls";

export const dynamic = "force-dynamic";

/**
 * BÌNH CHỌN HỆ THỐNG — phía người dùng (thẻ nổi trong dashboard, xem
 * @/components/PollCard).
 *
 *   GET  → { poll } — bình chọn ĐANG MỞ mới nhất dành cho tài khoản này, kèm số
 *          phiếu từng phương án và phiếu của chính mình; không có → poll: null.
 *   POST { pollId, choices: number[] } → bỏ phiếu (bỏ lại = sửa phiếu cũ).
 *
 * Database chưa chạy supabase/binh-chon.sql thì bảng chưa có: GET trả poll null
 * (thẻ không hiện), không làm lỗi dashboard.
 */
async function me() {
  const user = await requireUser();
  if (!user) return null;
  const profile = await getProfileById(user.id);
  if (!profile || !profile.is_active) return null;
  return { id: user.id, profile };
}

export async function GET() {
  const who = await me();
  if (!who) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await createAdminClient()
    .from("system_polls")
    .select(POLL_COLS)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return NextResponse.json({ poll: null });

  const poll = ((data ?? []) as PollRow[]).find((p) => inAudience(p, who.profile));
  if (!poll) return NextResponse.json({ poll: null });
  return NextResponse.json({ poll: await tally(poll, who.id) });
}

export async function POST(req: Request) {
  const who = await me();
  if (!who) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Đổi ý vài lần là bình thường; bấm liên tục hàng chục lần thì không.
  if (!(await durableAllowed(`poll-vote:${who.id}`, 20, 10 * 60_000))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { pollId?: unknown; choices?: unknown };
  if (typeof body.pollId !== "string") return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const db = createAdminClient();
  const { data } = await db.from("system_polls").select(POLL_COLS).eq("id", body.pollId).maybeSingle();
  const poll = data as PollRow | null;
  if (!poll || !inAudience(poll, who.profile)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!poll.active) return NextResponse.json({ error: "closed" }, { status: 409 });

  const choices = cleanChoices(body.choices, poll);
  if (!choices) return NextResponse.json({ error: "bad_choices" }, { status: 400 });

  const { error } = await db
    .from("system_poll_votes")
    .upsert(
      { poll_id: poll.id, user_id: who.id, choices, updated_at: new Date().toISOString() },
      { onConflict: "poll_id,user_id" }
    );
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });

  return NextResponse.json({ poll: await tally(poll, who.id) });
}
