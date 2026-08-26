import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { planExpiry, planProfilePatch, type Plan } from "@/lib/plans";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Ghi hoa hồng cho người giới thiệu khi một gói được BÁN (mã 100% tự kích hoạt,
 * hoặc admin xác nhận đã nhận tiền chuyển khoản). Tách khỏi route để hai lối
 * kích hoạt không lệch nhau — trước đây chỉ lối mã giảm giá có ghi hoa hồng.
 */
export async function creditAffiliateCommission(
  db: Db,
  userId: string,
  userEmail: string,
  plan: Plan,
  cycle: string,
  saleAmount: number,
): Promise<void> {
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
  const pct: number = ((settings as Record<string, unknown>)?.[planKey] as number) ?? 0;
  if (pct <= 0) return;

  const commissionAmount = Math.round((saleAmount * pct) / 100);
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

/**
 * Nâng gói cho một tài khoản và ghi hoa hồng đi kèm. Dùng chung cho mã giảm giá
 * 100% và cho lúc admin xác nhận đã nhận tiền chuyển khoản.
 */
export async function activatePlan(opts: {
  db: Db;
  userId: string;
  userEmail: string;
  plan: Plan;
  cycle: "month" | "year";
  /** Số tiền thật sự thu được — cơ sở tính hoa hồng. */
  saleAmount: number;
}): Promise<void> {
  const { db, userId, userEmail, plan, cycle, saleAmount } = opts;
  await db
    .from("profiles")
    .update({ ...planProfilePatch(plan), plan_cycle: cycle, plan_expires_at: planExpiry(cycle) })
    .eq("id", userId);
  await creditAffiliateCommission(db, userId, userEmail, plan, cycle, saleAmount);
}
