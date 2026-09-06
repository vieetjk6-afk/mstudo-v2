import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { planProfilePatch, trialDaysFor, type Plan } from "@/lib/plans";

export const dynamic = "force-dynamic";

/**
 * Self-serve free trial (no payment). Basic & Photographer → 30 ngày; Studio →
 * 7 ngày. MỖI TÀI KHOẢN CHỈ DÙNG THỬ MỘT LẦN (mọi gói) — chốt bằng
 * profiles.trial_used_at.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { plan } = (await req.json().catch(() => ({}))) as { plan?: string };
  if (plan !== "basic" && plan !== "photographer" && plan !== "photographer_plus" && plan !== "studio") {
    return NextResponse.json({ error: "bad_plan" }, { status: 400 });
  }
  const days = trialDaysFor(plan as Plan);

  const db = createAdminClient();
  const now = new Date();
  const expires = new Date(now.getTime() + days * 86400000).toISOString();
  const patch = planProfilePatch(plan as Plan);

  // Atomic: khoá hàng profile, kiểm tra "1 trial/account" + "đang trả phí" rồi
  // cập nhật gói trong một transaction (chống race hai request song song).
  const { data: status, error } = await db.rpc("start_free_trial", {
    p_user_id: user.id,
    p_expires: expires,
    p_plan: patch.plan,
    p_album_limit: patch.monthly_album_limit,
    p_can_zip: patch.can_zip,
    p_can_notes: patch.can_notes,
    p_can_galleries: patch.can_galleries,
    p_watermark_pro: patch.can_watermark_pro,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (status !== "ok") {
    // 'already_used' | 'already_paid'
    return NextResponse.json({ error: status }, { status: 400 });
  }

  return NextResponse.json({ ok: true, plan, trial_days: days, expires_at: expires });
}
