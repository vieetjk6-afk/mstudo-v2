import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToOwner } from "@/lib/push";
import { activatePlan } from "@/lib/upgrade-activate";
import type { Plan } from "@/lib/plans";

/**
 * Chốt MỘT yêu cầu nâng cấp là đã nhận tiền → nâng gói, ghi hoa hồng, báo studio.
 *
 * Hai nơi gọi: admin bấm "Đã nhận tiền" (/api/admin/upgrade-payment) và webhook
 * SePay của mstudo (/api/bank/sepay-mstudo). Dùng chung một hàm để hai đường
 * không lệch nhau: hoa hồng, hạn gói, câu thông báo đều ra y hệt.
 *
 * Đánh dấu "paid" TRƯỚC, có điều kiện chưa paid, rồi mới nâng gói: admin bấm
 * duyệt đúng lúc SePay báo tiền về thì chỉ một bên thắng, gói không bị cộng hai
 * lần hạn và hoa hồng không bị ghi hai lần.
 */

type Db = ReturnType<typeof createAdminClient>;

export type UpgradeRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  plan: string | null;
  cycle: string | null;
  payment_status: string | null;
  payment_amount: number | null;
  payment_code: string | null;
};

export const UPGRADE_ROW_COLUMNS = "id, user_id, email, plan, cycle, payment_status, payment_amount, payment_code";

function validPlan(p: string | null): Plan | null {
  return p === "basic" || p === "photographer" || p === "photographer_plus" || p === "studio" ? (p as Plan) : null;
}

export async function confirmUpgrade(
  db: Db,
  row: UpgradeRow,
  opts: { reviewedBy: string | null; note: string | null; saleAmount?: number }
): Promise<{ ok: true } | { ok: false; error: "already_paid" | "no_plan" }> {
  const plan = validPlan(row.plan);
  if (!row.user_id || !plan) return { ok: false, error: "no_plan" };

  const { data: claimed } = await db
    .from("upgrade_requests")
    .update({
      payment_status: "paid",
      reviewed_at: new Date().toISOString(),
      reviewed_by: opts.reviewedBy,
      review_note: opts.note,
      handled: true,
    })
    .eq("id", row.id)
    .neq("payment_status", "paid")
    .select("id");
  if (!claimed || claimed.length === 0) return { ok: false, error: "already_paid" };

  const cycle = row.cycle === "year" ? "year" : "month";
  await activatePlan({
    db,
    userId: row.user_id,
    userEmail: row.email ?? "",
    plan,
    cycle,
    saleAmount: opts.saleAmount ?? row.payment_amount ?? 0,
  });

  const msg = `Đã nhận thanh toán — tài khoản của bạn đã lên gói ${plan} (${cycle === "year" ? "1 năm" : "1 tháng"}).`;
  await db.from("studio_notifications").insert({
    owner_id: row.user_id, contract_id: null, kind: "plan_activated", message: msg,
  });
  await sendPushToOwner(row.user_id, {
    title: "Nâng cấp thành công 🎉",
    body: msg,
    url: "/dashboard/upgrade",
    tag: `upgrade-${row.id}`,
  });
  return { ok: true };
}
