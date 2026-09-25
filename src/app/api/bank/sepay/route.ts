import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { vnd } from "@/lib/types";
import {
  parseSepay,
  hookSecretFromHeader,
  payCodeCandidates,
  depositCodeCandidates,
  vnDate,
} from "@/lib/bank-reconcile";
import { applyToPlan, applyToBooking, confirmDepositZalo, notifyStudio } from "@/lib/bank-apply";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Webhook SePay: mỗi lần tài khoản studio có biến động, SePay POST một giao dịch.
 *
 * Nhận ra studio bằng khoá trong header "Authorization: Apikey <khoá>" (khoá
 * sinh ở thẻ "Tự xác nhận chuyển khoản", trang Bảng giá). Không có hoặc sai
 * khoá → 401, không ghi gì.
 *
 * SePay coi mọi phản hồi 2xx kèm {"success": true} là đã nhận, còn lại thì gửi
 * lại. Nên: giao dịch được ghi vào sổ TRƯỚC, unique theo mã giao dịch. SePay gửi
 * lại thì đụng unique và trả "đã nhận" luôn, không bao giờ ghi thu hai lần.
 */
export async function POST(req: NextRequest) {
  const secret = hookSecretFromHeader(req.headers.get("authorization"));
  if (!secret) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { data: hook } = await db
    .from("studio_bank_hooks")
    .select("owner_id, enabled")
    .eq("secret", secret)
    .maybeSingle();
  if (!hook) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });

  const txn = parseSepay(await req.json().catch(() => null));
  if (!txn) return NextResponse.json({ success: false, error: "bad_payload" }, { status: 400 });

  // Tắt thì vẫn trả "đã nhận" để SePay khỏi gửi lại mãi.
  if (!hook.enabled) return NextResponse.json({ success: true, skipped: "disabled" });
  // Tiền RA không phải việc của đối soát thu.
  if (txn.direction !== "in") return NextResponse.json({ success: true, skipped: "outgoing" });

  const ownerId = hook.owner_id as string;
  const { data: row, error: insErr } = await db
    .from("studio_bank_transactions")
    .insert({
      owner_id: ownerId,
      provider: "sepay",
      provider_txn_id: txn.txnId,
      amount: txn.amount,
      content: txn.content,
      account_number: txn.accountNumber,
      gateway: txn.gateway,
      reference_code: txn.referenceCode,
      txn_at: txn.txnAt,
      status: "unmatched",
      note: "no_code",
    })
    .select("id")
    .single();
  if (insErr) {
    // 23505 = unique_violation: SePay gửi lại giao dịch đã xử lý.
    if (insErr.code === "23505") return NextResponse.json({ success: true, duplicate: true });
    return NextResponse.json({ success: false, error: "server_error" }, { status: 500 });
  }
  await db.from("studio_bank_hooks").update({ last_event_at: new Date().toISOString() }).eq("owner_id", ownerId);

  const mark = (patch: Record<string, unknown>) =>
    db.from("studio_bank_transactions").update(patch).eq("id", row.id);
  const money = vnd(txn.amount);

  // ── 1) Mã đợt thanh toán của hợp đồng ────────────────────────────────────
  const codes = payCodeCandidates(txn.content);
  if (codes.length > 0) {
    const { data: plans } = await db
      .from("contract_payment_plan")
      .select("id, contract:studio_contracts!inner(owner_id)")
      .in("pay_code", codes)
      .eq("contract.owner_id", ownerId)
      .limit(1);
    const planId = plans?.[0]?.id as string | undefined;
    if (planId) {
      const res = await applyToPlan(db, {
        ownerId,
        planId,
        received: txn.amount,
        paidAt: vnDate(txn.txnAt),
        source: "SePay",
      });
      if (res.ok) {
        await mark({
          status: "matched",
          note: res.fit === "exact" ? null : res.fit === "over" ? "over" : "partial",
          plan_id: planId,
          contract_id: res.contractId,
          payment_id: res.paymentId,
        });
        const who = res.clientName || res.contractTitle;
        const extra =
          res.fit === "under"
            ? ` · thiếu ${vnd(res.expected - txn.amount)}, đã tách đợt còn lại`
            : res.fit === "over"
              ? ` · dư ${vnd(txn.amount - res.expected)}`
              : "";
        await notifyStudio(db, ownerId, {
          title: "Đã nhận chuyển khoản",
          message: `${who} · ${res.label} · ${money}${extra} (tự xác nhận)`,
          contractId: res.contractId,
          url: `/dashboard/studio/contracts/${res.contractId}?tab=pay`,
          tag: `bank-${row.id}`,
        });
        if (res.label.toLowerCase().includes("cọc")) {
          await confirmDepositZalo(db, ownerId, res.contractId, txn.amount);
        }
      } else {
        await mark({ status: "mismatch", note: res.reason, plan_id: planId, contract_id: res.contractId ?? null });
        await notifyStudio(db, ownerId, {
          title: "Chuyển khoản cần xem lại",
          message: `${money} có mã đợt nhưng chưa tự ghi được: ${res.reason === "already_paid" ? "đợt đã thu từ trước" : "ghi thu hỏng"}`,
          contractId: res.contractId ?? null,
          url: "/dashboard/studio/pricing#tu-xac-nhan",
          tag: `bank-${row.id}`,
        });
      }
      return NextResponse.json({ success: true });
    }
  }

  // ── 2) Mã cọc giữ ngày của yêu cầu đặt lịch ──────────────────────────────
  const depCodes = depositCodeCandidates(txn.content);
  if (depCodes.length > 0) {
    const res = await applyToBooking(db, { ownerId, codes: depCodes, received: txn.amount });
    if (res.ok) {
      await mark({ status: "matched", note: null, booking_id: res.bookingId });
      await notifyStudio(db, ownerId, {
        title: "Đã nhận cọc giữ ngày",
        message: `${res.name || "Khách"} · ${res.code} · ${money} (tự xác nhận)`,
        url: "/dashboard/studio/bookings",
        tag: `bank-${row.id}`,
      });
      return NextResponse.json({ success: true });
    }
    if (res.reason !== "not_found") {
      await mark({ status: "mismatch", note: res.reason, booking_id: res.bookingId ?? null });
      await notifyStudio(db, ownerId, {
        title: "Cọc giữ ngày cần xem lại",
        message: `${money} · ${res.reason === "deposit_under" ? "chuyển thiếu so với mức cọc · bạn có thể nhận luôn số này làm cọc" : "cọc đã xác nhận từ trước"}`,
        url: res.reason === "deposit_under" ? "/dashboard/studio/pricing#tu-xac-nhan" : "/dashboard/studio/bookings",
        tag: `bank-${row.id}`,
      });
      return NextResponse.json({ success: true });
    }
  }

  // ── 3) Không có mã nào → để studio gán tay ở thẻ Tự xác nhận ─────────────
  // Không bắn thông báo: tài khoản có cả tiền riêng, báo mọi khoản là spam.
  return NextResponse.json({ success: true, matched: false });
}
