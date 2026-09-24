import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { contractTotal, sumAmounts, vnd } from "@/lib/types";
import { sendPushToOwner } from "@/lib/push";
import { autoNotify } from "@/lib/zalo/notify";
import { depositConfirmMessage } from "@/lib/zalo/messages";
import { mainUrl } from "@/lib/hosts";
import { amountFit, type AmountFit } from "@/lib/bank-reconcile";

/**
 * Ghi MỘT khoản tiền đã vào tài khoản vào đúng chỗ của nó: một đợt thanh toán
 * của hợp đồng, hoặc cọc giữ ngày của một yêu cầu đặt lịch.
 *
 * Webhook SePay và nút "Gán vào đợt" của studio cùng gọi file này, nên hai
 * đường ghi tiền không thể lệch nhau. Chỉ chạy bằng service-role; người gọi phải
 * tự chắc chắn ownerId là của studio đang thao tác.
 */

type Db = ReturnType<typeof createAdminClient>;

/** Hết đợt mà hợp đồng vẫn còn nợ → mở đợt "Thanh toán toàn bộ" cho phần dư. Giống màn hợp đồng. */
export async function openRemainderIfSettled(db: Db, contractId: string): Promise<void> {
  const [{ data: allPlans }, { data: items }, { data: pays }] = await Promise.all([
    db.from("contract_payment_plan").select("id, paid").eq("contract_id", contractId),
    db.from("contract_items").select("qty, unit_price").eq("contract_id", contractId),
    db.from("contract_payments").select("amount").eq("contract_id", contractId),
  ]);
  const plans = allPlans ?? [];
  if (plans.length === 0 || !plans.every((p) => p.paid)) return;
  const total = contractTotal((items ?? []) as { qty: number; unit_price: number }[]);
  const balance = total - sumAmounts((pays ?? []) as { amount: number }[]);
  if (balance > 0) {
    await db.from("contract_payment_plan").insert({
      contract_id: contractId,
      label: "Thanh toán toàn bộ hợp đồng",
      amount: balance,
      position: plans.length + 1,
    });
  }
}

export type PlanApplyResult =
  | {
      ok: true;
      fit: AmountFit;
      contractId: string;
      contractTitle: string;
      clientName: string | null;
      label: string;
      expected: number;
      paymentId: string;
    }
  | { ok: false; reason: "not_found" | "already_paid" | "write_failed"; contractId?: string };

/**
 * Ghi `received` đồng vào đợt `planId`.
 *
 *  • khớp tiền → đợt đã thu, như bấm "Đã thu".
 *  • chuyển DƯ → đợt đã thu với đúng số nhận được. Phần dư làm giảm công nợ
 *    còn lại, vì mọi con số dư nợ đều tính từ contract_payments.
 *  • chuyển THIẾU → phần nhận được thành một đợt đã thu, phần còn lại tách
 *    thành đợt mới "(còn lại)". Tổng các đợt vẫn đúng bằng số khách phải trả.
 *
 * Đánh dấu "đã thu" TRƯỚC, có điều kiện paid = false, rồi mới ghi lần thu. Nếu
 * studio vừa bấm "Đã thu" bằng tay đúng lúc đó thì bên chậm hơn thua, và tiền
 * không bị ghi hai lần.
 */
export async function applyToPlan(
  db: Db,
  opts: { ownerId: string; planId: string; received: number; paidAt: string; source: string }
): Promise<PlanApplyResult> {
  const { data: plan } = await db
    .from("contract_payment_plan")
    .select("id, label, amount, due_date, position, paid, contract:studio_contracts!inner(id, owner_id, title, client_name)")
    .eq("id", opts.planId)
    .maybeSingle();
  const contract = (plan as unknown as { contract: { id: string; owner_id: string; title: string; client_name: string | null } | null } | null)?.contract ?? null;
  if (!plan || !contract || contract.owner_id !== opts.ownerId) return { ok: false, reason: "not_found" };
  if (plan.paid) return { ok: false, reason: "already_paid", contractId: contract.id };

  const nowIso = new Date().toISOString();
  const { data: claimed } = await db
    .from("contract_payment_plan")
    .update({ paid: true, paid_at: nowIso })
    .eq("id", plan.id)
    .eq("paid", false)
    .select("id");
  if (!claimed || claimed.length === 0) return { ok: false, reason: "already_paid", contractId: contract.id };

  const received = Math.max(0, Math.round(opts.received));
  const expected = Math.max(0, Math.round(Number(plan.amount) || 0));
  const fit = amountFit(received, expected);
  const label = plan.label || "Đợt thanh toán";

  const { data: payment, error } = await db
    .from("contract_payments")
    .insert({
      contract_id: contract.id,
      amount: received,
      kind: "installment",
      method: "transfer",
      paid_at: opts.paidAt,
      note: `${label} · ${opts.source}`.slice(0, 200),
    })
    .select("id")
    .single();
  if (error || !payment) {
    // Ghi lần thu hỏng (thường là sổ đã khoá) → trả đợt về chưa thu, nếu không
    // đợt hiện "đã thu" mà sổ thu không có đồng nào.
    await db.from("contract_payment_plan").update({ paid: false, paid_at: null }).eq("id", plan.id);
    return { ok: false, reason: "write_failed", contractId: contract.id };
  }

  await db
    .from("contract_payment_plan")
    .update({ payment_id: payment.id, ...(fit === "exact" ? {} : { amount: received }) })
    .eq("id", plan.id);

  if (fit === "under") {
    await db.from("contract_payment_plan").insert({
      contract_id: contract.id,
      label: `${label} (còn lại)`.slice(0, 120),
      amount: expected - received,
      due_date: plan.due_date,
      position: plan.position ?? 0,
    });
  } else {
    await openRemainderIfSettled(db, contract.id);
  }

  return {
    ok: true,
    fit,
    contractId: contract.id,
    contractTitle: contract.title,
    clientName: contract.client_name,
    label,
    expected,
    paymentId: payment.id,
  };
}

/** Đợt cọc → khách nhận tin Zalo xác nhận (nếu studio đã bật mốc và đã kết nối Zalo). */
export async function confirmDepositZalo(db: Db, ownerId: string, contractId: string, amount: number): Promise<void> {
  const [{ data: c }, { data: owner }] = await Promise.all([
    db.from("studio_contracts").select("id, title, client_name, client_phone, client_token").eq("id", contractId).maybeSingle(),
    db.from("profiles").select("full_name").eq("id", ownerId).maybeSingle(),
  ]);
  if (!c?.client_phone) return;
  const body = depositConfirmMessage({
    name: c.client_name,
    amount: amount > 0 ? vnd(amount) : null,
    title: c.title,
    link: c.client_token ? mainUrl(`/c/${c.client_token}`) : null,
    studio: (owner as { full_name?: string | null } | null)?.full_name || "Studio",
  });
  await autoNotify({
    ownerId,
    event: "deposit_confirm",
    audience: "client",
    toPhone: c.client_phone,
    toName: c.client_name,
    body,
    contractId: c.id,
  }).catch(() => undefined);
}

export type BookingApplyResult =
  | { ok: true; bookingId: string; name: string | null; code: string }
  | { ok: false; reason: "not_found" | "deposit_done" | "deposit_under"; bookingId?: string };

/**
 * Xác nhận cọc giữ ngày khi tiền về đủ. Chuyển thiếu thì KHÔNG xác nhận: "giữ
 * ngày" là lời hứa với khách, để studio tự quyết với phần thiếu.
 */
export async function applyToBooking(
  db: Db,
  opts: { ownerId: string; codes: string[]; received: number }
): Promise<BookingApplyResult> {
  if (opts.codes.length === 0) return { ok: false, reason: "not_found" };
  const { data: rows } = await db
    .from("studio_bookings")
    .select("id, name, deposit_code, deposit_amount, deposit_status, deposit_paid_at")
    .eq("owner_id", opts.ownerId)
    .in("deposit_code", opts.codes)
    .limit(1);
  const b = rows?.[0];
  if (!b) return { ok: false, reason: "not_found" };
  if (b.deposit_status === "confirmed") return { ok: false, reason: "deposit_done", bookingId: b.id };
  if (Math.round(opts.received) < Math.round(Number(b.deposit_amount) || 0)) {
    return { ok: false, reason: "deposit_under", bookingId: b.id };
  }
  await db
    .from("studio_bookings")
    .update({ deposit_status: "confirmed", deposit_paid_at: b.deposit_paid_at ?? new Date().toISOString() })
    .eq("id", b.id);
  return { ok: true, bookingId: b.id, name: b.name, code: b.deposit_code };
}

/**
 * Studio chấp nhận khoản cọc giữ ngày khách chuyển THIẾU: mức cọc của yêu cầu
 * đặt lịch đổi thành đúng số đã nhận, rồi xác nhận. Đây là quyết định của
 * studio (bấm tay), webhook không bao giờ tự làm việc này.
 */
export async function acceptBookingDeposit(
  db: Db,
  opts: { ownerId: string; bookingId: string; amount: number }
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "deposit_done" }> {
  const { data: b } = await db
    .from("studio_bookings")
    .select("id, owner_id, deposit_status, deposit_paid_at")
    .eq("id", opts.bookingId)
    .maybeSingle();
  if (!b || b.owner_id !== opts.ownerId) return { ok: false, reason: "not_found" };
  if (b.deposit_status === "confirmed") return { ok: false, reason: "deposit_done" };
  await db
    .from("studio_bookings")
    .update({
      deposit_amount: Math.max(0, Math.round(opts.amount)),
      deposit_status: "confirmed",
      deposit_paid_at: b.deposit_paid_at ?? new Date().toISOString(),
    })
    .eq("id", b.id);
  return { ok: true };
}

/** Chuông + thông báo đẩy cho studio. */
export async function notifyStudio(
  db: Db,
  ownerId: string,
  opts: { title: string; message: string; contractId?: string | null; url: string; tag: string }
): Promise<void> {
  await db.from("studio_notifications").insert({
    owner_id: ownerId,
    contract_id: opts.contractId ?? null,
    kind: "payment",
    message: opts.message,
  });
  await sendPushToOwner(ownerId, { title: opts.title, body: opts.message, url: opts.url, tag: opts.tag });
}
