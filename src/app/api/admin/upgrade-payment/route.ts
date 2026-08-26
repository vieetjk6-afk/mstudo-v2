import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToOwner } from "@/lib/push";
import { activatePlan } from "@/lib/upgrade-activate";
import type { Plan } from "@/lib/plans";

export const dynamic = "force-dynamic";

/**
 * Admin đối chiếu sao kê rồi chốt một yêu cầu nâng cấp đã chuyển khoản.
 *
 *  • "confirm" — đã thấy tiền → nâng gói NGAY, ghi hoa hồng giới thiệu, báo về
 *    cho studio (chuông + thông báo đẩy).
 *  • "reject"  — chưa thấy tiền → giao dịch thất bại, studio nhận được lý do và
 *    bấm báo lại được sau khi chuyển.
 *
 * Đây là chỗ DUY NHẤT nâng gói theo chuyển khoản: studio không tự đổi được
 * trạng thái của mình (mọi ghi đều qua service-role sau khi kiểm quyền).
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id, action, note } = (await req.json().catch(() => ({}))) as {
    id?: string;
    action?: "confirm" | "reject";
    note?: string;
  };
  if (!id || (action !== "confirm" && action !== "reject")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: row } = await db
    .from("upgrade_requests")
    .select("id, user_id, email, plan, cycle, payment_status, payment_amount, payment_code")
    .eq("id", id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.payment_status === "paid") return NextResponse.json({ error: "already_paid" }, { status: 409 });

  const now = new Date().toISOString();
  const reviewNote = note?.trim() || null;

  if (action === "reject") {
    await db
      .from("upgrade_requests")
      .update({ payment_status: "failed", reviewed_at: now, reviewed_by: admin.id, review_note: reviewNote, handled: false })
      .eq("id", row.id);

    if (row.user_id) {
      const msg = `Giao dịch nâng cấp chưa thành công — MStudo chưa nhận được tiền chuyển khoản${row.payment_code ? ` (${row.payment_code})` : ""}.${reviewNote ? ` ${reviewNote}` : ""}`;
      await db.from("studio_notifications").insert({
        owner_id: row.user_id, contract_id: null, kind: "payment_failed", message: msg,
      });
      await sendPushToOwner(row.user_id, {
        title: "Thanh toán chưa thành công",
        body: msg,
        url: "/dashboard/upgrade",
        tag: `upgrade-${row.id}`,
      });
    }
    return NextResponse.json({ ok: true, status: "failed" });
  }

  // confirm — nâng gói thật.
  const validPlan =
    row.plan === "basic" || row.plan === "photographer" || row.plan === "photographer_plus" || row.plan === "studio"
      ? (row.plan as Plan)
      : null;
  if (!row.user_id || !validPlan) return NextResponse.json({ error: "no_plan" }, { status: 400 });

  await activatePlan({
    db,
    userId: row.user_id,
    userEmail: row.email ?? "",
    plan: validPlan,
    cycle: row.cycle === "year" ? "year" : "month",
    saleAmount: row.payment_amount ?? 0,
  });

  await db
    .from("upgrade_requests")
    .update({ payment_status: "paid", reviewed_at: now, reviewed_by: admin.id, review_note: reviewNote, handled: true })
    .eq("id", row.id);

  const msg = `Đã nhận thanh toán — tài khoản của bạn đã lên gói ${validPlan} (${row.cycle === "year" ? "1 năm" : "1 tháng"}).`;
  await db.from("studio_notifications").insert({
    owner_id: row.user_id, contract_id: null, kind: "plan_activated", message: msg,
  });
  await sendPushToOwner(row.user_id, {
    title: "Nâng cấp thành công 🎉",
    body: msg,
    url: "/dashboard/upgrade",
    tag: `upgrade-${row.id}`,
  });

  return NextResponse.json({ ok: true, status: "paid" });
}
