import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { openRemainderIfSettled } from "@/lib/bank-apply";
import { asPaymentMethod, vnd } from "@/lib/types";
import { logAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

/**
 * Đánh dấu MỘT đợt thanh toán là ĐÃ THU — từ bất cứ đâu, không cần mở hợp đồng.
 *
 * Vì sao cần: khách gửi ảnh chuyển khoản → studio phải mở hợp đồng → tab Thanh
 * toán → tìm đúng đợt → bấm "Đã thu". Bốn bước cho một việc chỉ có hai câu trả
 * lời, mà studio làm nhiều lần mỗi tuần. Route này cho thẻ "chờ đối soát" ở
 * Tổng quan chốt tại chỗ.
 *
 * Làm ĐÚNG những gì màn hợp đồng đang làm, không hơn:
 *   1. ghi một khoản thu thật vào contract_payments,
 *   2. gắn khoản thu đó vào đợt và đóng dấu đã thu,
 *   3. hết đợt mà vẫn còn nợ → mở tiếp một đợt "thanh toán toàn bộ" cho phần dư.
 * Tin Zalo xác nhận cọc do người gọi bắn riêng (như màn hợp đồng), để route này
 * chỉ lo phần TIỀN.
 */
export async function POST(req: Request) {
  const profile = await requireStudio("full");
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { planId, method: rawMethod } = (await req.json().catch(() => ({}))) as { planId?: string; method?: string };
  const method = asPaymentMethod(rawMethod);
  if (!planId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const db = createAdminClient();
  const { data: plan } = await db
    .from("contract_payment_plan")
    .select("id, label, amount, paid, contract:studio_contracts!inner(id, owner_id)")
    .eq("id", planId)
    .maybeSingle();
  const contract = (plan as unknown as { contract: { id: string; owner_id: string } | null } | null)?.contract ?? null;
  // Đợt của studio khác → coi như không tồn tại.
  if (!plan || !contract || contract.owner_id !== profile.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (plan.paid) return NextResponse.json({ ok: true, alreadyPaid: true });

  const amount = Math.max(0, Math.round(Number(plan.amount) || 0));
  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

  const { data: payment } = await db
    .from("contract_payments")
    .insert({ contract_id: contract.id, amount, kind: "installment", method, paid_at: today, note: plan.label })
    .select("id")
    .single();

  const { error } = await db
    .from("contract_payment_plan")
    .update({ paid: true, paid_at: new Date().toISOString(), payment_id: payment?.id ?? null })
    .eq("id", plan.id);
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  await logAction(db, {
    ownerId: contract.owner_id, actorId: (profile.actingUserId as string | undefined) ?? profile.id,
    action: "payment.insert", entity: "payment", entityId: payment?.id ?? null, contractId: contract.id,
    summary: `Ghi thu ${vnd(amount)} · ${plan.label || "đợt thanh toán"} (từ Tổng quan)`,
  });

  // Thu hết các đợt mà hợp đồng vẫn còn dư nợ → mở tiếp một đợt cho phần còn
  // lại, đúng như màn hợp đồng làm. Không có bước này thì phần dư biến mất khỏi
  // mọi danh sách công nợ.
  await openRemainderIfSettled(db, contract.id);

  return NextResponse.json({ ok: true, amount, isDeposit: (plan.label || "").toLowerCase().includes("cọc") });
}
