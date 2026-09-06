import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { planProfilePatch } from "@/lib/plans";

export const dynamic = "force-dynamic";

/**
 * Self-serve trial: redeem a discount code that has trial_days > 0 to instantly
 * activate its plan (e.g. Studio) for N days — no manual approval.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const c = (code ?? "").trim().toUpperCase();
  if (!c) return NextResponse.json({ error: "missing_code" }, { status: 400 });

  const db = createAdminClient();
  // Đọc trước để có thông báo lỗi thân thiện + xác định gói/số ngày. Việc chốt
  // (kiểm tra cap + trừ lượt + đánh dấu dùng thử) được làm ATOMIC trong RPC bên
  // dưới, nên đọc ở đây chỉ mang tính thông tin — không còn race.
  const { data } = await db
    .from("discount_codes")
    .select("code, plan, active, max_uses, used_count, expires_at, trial_days")
    .eq("code", c)
    .maybeSingle();

  if (!data || !data.active) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (!data.trial_days || data.trial_days <= 0) return NextResponse.json({ error: "not_trial" }, { status: 400 });
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "expired" }, { status: 400 });

  const plan = data.plan === "basic" || data.plan === "photographer" || data.plan === "photographer_plus" || data.plan === "studio" ? data.plan : "studio";
  const expires = new Date(Date.now() + data.trial_days * 86400000).toISOString();
  const patch = planProfilePatch(plan);

  // Atomic: khoá hàng profile + code, kiểm tra max_uses / trial_used_at / đã đổi
  // rồi cập nhật gói + trừ lượt trong một transaction.
  const { data: status, error: rpcErr } = await db.rpc("redeem_discount_trial", {
    p_code: c,
    p_user_id: user.id,
    p_expires: expires,
    p_plan: patch.plan,
    p_album_limit: patch.monthly_album_limit,
    p_can_zip: patch.can_zip,
    p_can_notes: patch.can_notes,
    p_can_galleries: patch.can_galleries,
    p_watermark_pro: patch.can_watermark_pro,
  });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  if (status !== "ok") {
    // 'invalid' | 'expired' | 'used_up' | 'already_used'
    return NextResponse.json({ error: status }, { status: 400 });
  }

  return NextResponse.json({ ok: true, plan, trial_days: data.trial_days, expires_at: expires });
}
