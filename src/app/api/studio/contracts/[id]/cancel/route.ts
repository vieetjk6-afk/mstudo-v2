import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncContractCalendar } from "@/lib/gcal-sync";
import { mainUrl } from "@/lib/hosts";
import { todayVN, fmtDate } from "@/lib/date";
import { vnd, asPaymentMethod } from "@/lib/types";
import { cancelQuote, cancelPolicyOf, cancelClientMessage } from "@/lib/contract-cancel";
import { studioFor, loadContract, contractCrew, notifyContractChanged, netCollected } from "@/lib/contract-change";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Huỷ hợp đồng, kèm hoàn / giữ cọc.
 *
 * Chỉ CHỦ STUDIO: hoàn tiền là việc tài chính, mà vai trò "Quản lý" được mô tả
 * là "toàn bộ studio, trừ mục tài chính".
 *
 * GET  → số đã thu + gợi ý hoàn theo chính sách huỷ của studio.
 * POST { refund, method, reason } → ghi khoản hoàn (số ÂM), bỏ các đợt chưa
 *      thu, đổi trạng thái sang "Đã huỷ", gỡ lịch thợ / lịch hẹn / Google Lịch.
 */

async function guard(id: string) {
  const profile = await studioFor([]);
  if (!profile) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  const db = createAdminClient();
  const contract = await loadContract(db, id, profile.id);
  if (!contract) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  return { db, contract, profile };
}

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const g = await guard(id);
  if ("error" in g) return g.error;
  const { db, contract, profile } = g;
  const collected = await netCollected(db, contract.id);
  const policy = cancelPolicyOf(profile as { cancel_early_days?: number; cancel_early_refund_pct?: number; cancel_late_refund_pct?: number });
  const quote = cancelQuote({ collected, eventDate: contract.event_date, today: todayVN(), policy });
  return NextResponse.json({ collected, policy, quote, status: contract.status });
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const g = await guard(id);
  if ("error" in g) return g.error;
  const { db, contract, profile } = g;
  if (contract.status === "cancelled") return NextResponse.json({ error: "already_cancelled" }, { status: 409 });

  const b = (await req.json().catch(() => ({}))) as { refund?: number; method?: string; reason?: string };
  const reason = (b.reason || "").trim().slice(0, 300) || null;
  const collected = await netCollected(db, contract.id);
  const refund = Math.round(Number(b.refund) || 0);
  if (refund < 0 || refund > Math.max(0, collected)) {
    return NextResponse.json({ error: "bad_refund", collected }, { status: 400 });
  }

  // 1) Khoản hoàn: một lần thu SỐ ÂM. Mọi tổng tiền (công nợ, báo cáo, két tiền
  //    mặt, xuất kế toán) tự trừ đúng. Ghi TRƯỚC khi đổi trạng thái: hỏng ở đây
  //    (sổ đã khoá, chưa chạy migration) thì hợp đồng còn nguyên, bấm lại được.
  if (refund > 0) {
    const { error } = await db.from("contract_payments").insert({
      contract_id: contract.id,
      amount: -refund,
      kind: "refund",
      method: asPaymentMethod(b.method) ?? "transfer",
      paid_at: todayVN(),
      note: `Hoàn tiền huỷ hợp đồng${reason ? `: ${reason}` : ""}`.slice(0, 200),
    });
    if (error) {
      // 23514 = check_violation: chưa chạy migration nên 'refund' chưa hợp lệ.
      if (error.code === "23514" && /kind/.test(error.message)) {
        return NextResponse.json({ error: "missing_migration", file: "supabase/huy-doi-lich.sql" }, { status: 409 });
      }
      return NextResponse.json({ error: "write_failed", message: error.message }, { status: 500 });
    }
  }

  // 2) Đợt chưa thu không còn là nợ: để lại thì chúng cứ hiện "quá hạn" ở Tổng quan.
  await db.from("contract_payment_plan").delete().eq("contract_id", contract.id).eq("paid", false);

  // 3) Trạng thái. Hai cột mới ghi ở lượt riêng: chưa chạy migration thì vẫn huỷ được.
  const { error: stErr } = await db
    .from("studio_contracts")
    .update({ status: "cancelled", completed_at: null })
    .eq("id", contract.id);
  if (stErr) return NextResponse.json({ error: "write_failed", message: stErr.message }, { status: 500 });
  await db
    .from("studio_contracts")
    .update({ cancelled_at: new Date().toISOString(), cancel_reason: reason })
    .eq("id", contract.id)
    .then(undefined, () => undefined);

  // 4) Ngày đó thợ rảnh lại: gỡ mốc lịch thợ của hợp đồng. Lịch hẹn (thử đồ,
  //    trang điểm…) chưa diễn ra chuyển sang "đã huỷ" chứ không xoá, còn dấu vết.
  const crew = await contractCrew(db, contract.id);
  if (crew.length) {
    await db.from("crew_unavailable").delete().in("contract_crew_id", crew.map((c) => c.id)).then(undefined, () => undefined);
  }
  await db
    .from("studio_appointments")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("contract_id", contract.id)
    .eq("status", "scheduled")
    .then(undefined, () => undefined);

  await notifyContractChanged(
    db,
    profile.id,
    contract.id,
    `Huỷ hợp đồng “${contract.title}”${contract.event_date ? ` ngày ${fmtDate(contract.event_date)}` : ""}${refund > 0 ? ` · hoàn ${vnd(refund)}` : ""}`
  );

  // 5) Google Lịch: hợp đồng huỷ thì syncContractCalendar tự gỡ sự kiện.
  await syncContractCalendar(profile.id, contract.id);

  const kept = Math.max(0, collected - refund);
  return NextResponse.json({
    ok: true,
    refund,
    kept,
    clientMessage: cancelClientMessage({
      name: contract.client_name,
      title: contract.title,
      refund: refund > 0 ? vnd(refund) : null,
      studio: profile.full_name,
    }),
    link: contract.client_token ? mainUrl(`/c/${contract.client_token}`) : null,
  });
}
