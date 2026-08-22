import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { planExpiry, planProfilePatch, type Plan } from "@/lib/plans";
import { notifyAdmins } from "@/lib/notify-admin";

export const dynamic = "force-dynamic";

type Db = ReturnType<typeof createAdminClient>;

async function creditAffiliateCommission(
  db: Db,
  userId: string,
  userEmail: string,
  plan: Plan,
  cycle: string,
  saleAmount: number,
) {
  const { data: profile } = await db.from("profiles").select("referred_by").eq("id", userId).maybeSingle();
  if (!profile?.referred_by) return;

  const { data: affCode } = await db
    .from("affiliate_codes")
    .select("user_id")
    .eq("code", profile.referred_by)
    .eq("active", true)
    .maybeSingle();
  if (!affCode) return;

  const planKey = `affiliate_commission_${plan}` as const;
  const { data: settings } = await db.from("site_settings").select(planKey).eq("id", 1).maybeSingle();
  const pct: number = (settings as Record<string, unknown>)?.[planKey] as number ?? 0;
  if (pct <= 0) return;

  const commissionAmount = Math.round(saleAmount * pct / 100);
  await db.from("affiliate_commissions").insert({
    referrer_id: affCode.user_id,
    referred_user_id: userId,
    referred_email: userEmail,
    plan,
    cycle,
    sale_amount: saleAmount,
    commission_pct: pct,
    commission_amount: commissionAmount,
    status: "pending",
  });
}

/** A logged-in photographer requests an account upgrade. */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { note, plan, cycle, discount_code, phone, amount } = (await req.json().catch(() => ({}))) as {
    note?: string;
    plan?: string;
    cycle?: string;
    discount_code?: string;
    phone?: string;
    amount?: number;
  };

  const validPlan = plan === "basic" || plan === "photographer" || plan === "photographer_plus" || plan === "studio" ? (plan as Plan) : null;
  const validCycle = cycle === "year" ? "year" : "month";
  const code = discount_code?.trim().toUpperCase() || null;
  const db = createAdminClient();

  // Đọc trạng thái mã (thông tin) + đã đổi theo tài khoản chưa. Việc chốt lượt
  // thật sự làm ATOMIC bên dưới nên các đọc này chỉ để quyết định luồng.
  type CodeRow = { percent: number; plan: string | null; cycle: string | null; active: boolean; max_uses: number | null; used_count: number | null; expires_at: string | null };
  let alreadyRedeemed = false;
  let dc: CodeRow | null = null;
  if (code) {
    const { data: red } = await db.from("discount_redemptions").select("id").eq("code", code).eq("user_id", user.id).maybeSingle();
    const { data: codeRow } = await db.from("discount_codes").select("percent, plan, cycle, active, max_uses, used_count, expires_at").eq("code", code).maybeSingle();
    alreadyRedeemed = !!red;
    dc = (codeRow as CodeRow | null) ?? null;
  }

  // Mã có áp dụng cho gói/chu kỳ này không? (max_uses được kiểm tra atomic khi chốt).
  const applicable = !!(
    dc && dc.active &&
    (!dc.expires_at || new Date(dc.expires_at).getTime() >= Date.now()) &&
    (!dc.plan || dc.plan === validPlan) &&
    (!dc.cycle || dc.cycle === validCycle)
  );

  // Chốt lượt dùng mã ATOMIC: ghi redemption (unique theo tài khoản) rồi trừ
  // used_count qua RPC (UPDATE … WHERE max_uses … RETURNING). Không còn cảnh hai
  // request cùng vượt max_uses hay mất lượt đếm.
  let claimed = false;
  if (code && applicable && !alreadyRedeemed) {
    const { error: redErr } = await db.from("discount_redemptions").insert({ code, user_id: user.id });
    if (!redErr) {
      const { data: ok } = await db.rpc("consume_discount_code", { p_code: code });
      claimed = ok === true;
      // Hết lượt ngay trước ta → gỡ redemption để không khoá nhầm tài khoản.
      if (!claimed) await db.from("discount_redemptions").delete().eq("code", code).eq("user_id", user.id);
    }
  }

  // Mã 100% đã chốt được lượt → tự kích hoạt gói ngay.
  let activated = false;
  if (claimed && validPlan && dc && dc.percent >= 100) {
    await db
      .from("profiles")
      .update({ ...planProfilePatch(validPlan), plan_cycle: validCycle, plan_expires_at: planExpiry(validCycle) })
      .eq("id", user.id);
    activated = true;

    // M-5: Look up canonical plan price server-side — never trust client-submitted amount
    const planPriceKey = `price_${validPlan}_${validCycle}` as const;
    const { data: priceSettings } = await db.from("site_settings").select(planPriceKey).eq("id", 1).maybeSingle();
    const canonicalAmount: number = (priceSettings as Record<string, unknown>)?.[planPriceKey] as number ?? amount ?? 0;
    await creditAffiliateCommission(db, user.id, user.email ?? "", validPlan, validCycle, canonicalAmount);
  }

  const { error } = await db.from("upgrade_requests").insert({
    user_id: user.id,
    email: user.email,
    note: note?.trim() || null,
    plan: validPlan,
    cycle: validCycle,
    discount_code: code,
    phone: phone?.trim() || null,
    amount: amount != null && Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : null,
    handled: activated, // auto-activated requests are already done
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Báo cho quản trị viên có yêu cầu nâng cấp mới.
  const planLabel = validPlan ? ` gói ${validPlan}/${validCycle}` : "";
  // push: true — đây là việc CÓ TIỀN đang chờ duyệt, để nằm im ở chuông thì
  // admin chỉ thấy khi tình cờ mở dashboard. Ba loại thông báo hệ thống
  // (tài khoản mới, liên hệ, nâng cấp) thì đây là loại duy nhất mất doanh thu
  // nếu trả lời chậm.
  await notifyAdmins(
    "upgrade_request",
    `Yêu cầu nâng cấp${planLabel} từ ${user.email}${activated ? " (đã tự kích hoạt bằng mã giảm giá)" : ""}`,
    { push: true },
  );

  return NextResponse.json({ ok: true, activated });
}
