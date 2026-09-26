import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { studioFor, loadContract } from "@/lib/contract-change";
import { logAction } from "@/lib/audit-log";
import { todayVN } from "@/lib/date";
import { vnd, asPaymentMethod } from "@/lib/types";
import { canRedeem, defaultExpiry, makeVoucherCode, normalizeVoucherCode, type Voucher } from "@/lib/vouchers";

export const dynamic = "force-dynamic";

/**
 * Voucher / thẻ quà (xem supabase/migrations/studio_vouchers.sql).
 *
 * POST { action: "create", title, amount, price, buyer_name, buyer_phone, recipient_name, expires_on, paid, paid_method, note }
 *      { action: "mark_paid", id, paid_method }
 *      { action: "void", id }
 *      { action: "check", code }                 → thông tin thẻ, dùng được không
 *      { action: "redeem", code, contractId }    → ghi khoản thu 'voucher' vào hợp đồng
 */
const ROLES = ["manager", "branch_manager", "accountant"] as const;
const COLS = "id, code, title, amount, price, buyer_name, buyer_phone, recipient_name, paid, paid_method, paid_at, expires_on, status, redeemed_contract_id, redeemed_at, note, created_at";

const str = (v: unknown, max: number) => {
  const s = String(v ?? "").trim().slice(0, max);
  return s || null;
};
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function POST(req: Request) {
  const profile = await studioFor(ROLES);
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = createAdminClient();
  const ownerId = profile.id as string;
  const actor = (profile.actingUserId as string | undefined) ?? ownerId;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const today = todayVN();

  const byId = async (id: unknown) => {
    if (typeof id !== "string") return null;
    const { data } = await db.from("studio_vouchers").select(COLS).eq("id", id).eq("owner_id", ownerId).maybeSingle();
    return (data as Voucher | null) ?? null;
  };
  const byCode = async (code: unknown) => {
    const c = normalizeVoucherCode(String(code ?? ""));
    if (!c) return null;
    const { data } = await db.from("studio_vouchers").select(COLS).eq("owner_id", ownerId).eq("code", c).maybeSingle();
    return (data as Voucher | null) ?? null;
  };

  if (b.action === "create") {
    const amount = Math.round(Number(b.amount) || 0);
    const price = Math.max(0, Math.round(Number(b.price ?? amount) || 0));
    if (amount <= 0 || amount > 1_000_000_000) return NextResponse.json({ error: "bad_amount" }, { status: 400 });
    const paid = b.paid === true;
    const row = {
      owner_id: ownerId,
      title: str(b.title, 120) ?? "Voucher chụp ảnh",
      amount,
      price,
      buyer_name: str(b.buyer_name, 120),
      buyer_phone: str(b.buyer_phone, 20),
      recipient_name: str(b.recipient_name, 120),
      expires_on: isDate(b.expires_on) ? b.expires_on : defaultExpiry(today),
      paid,
      paid_method: paid ? asPaymentMethod(b.paid_method) ?? "transfer" : null,
      paid_at: paid ? today : null,
      note: str(b.note, 500),
      created_by: actor,
    };
    // Mã ngẫu nhiên 31^6 ≈ 887 triệu tổ hợp; trùng thì thử lại vài lần.
    for (let i = 0; i < 5; i++) {
      const { data, error } = await db.from("studio_vouchers").insert({ ...row, code: makeVoucherCode() }).select(COLS).single();
      if (!error) {
        const v = data as Voucher;
        await logAction(db, { ownerId, actorId: actor, action: "voucher.create", entity: "voucher", entityId: v.id, summary: `Bán voucher ${v.code} mệnh giá ${vnd(v.amount)} · giá bán ${vnd(v.price)}${v.paid ? " · đã thu" : " · chưa thu"}`, after: v });
        return NextResponse.json({ ok: true, voucher: v });
      }
      if (error.code !== "23505") {
        if (error.code === "42P01" || /studio_vouchers/.test(error.message)) {
          return NextResponse.json({ error: "missing_migration", file: "supabase/migrations/studio_vouchers.sql" }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    return NextResponse.json({ error: "code_collision" }, { status: 500 });
  }

  if (b.action === "mark_paid" || b.action === "void") {
    const v = await byId(b.id);
    if (!v) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (v.status !== "active") return NextResponse.json({ error: "not_active" }, { status: 409 });
    const patch =
      b.action === "mark_paid"
        ? { paid: true, paid_method: asPaymentMethod(b.paid_method) ?? "transfer", paid_at: today }
        : { status: "void" };
    const { data, error } = await db.from("studio_vouchers").update(patch).eq("id", v.id).eq("status", "active").select(COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAction(db, {
      ownerId, actorId: actor, action: b.action === "mark_paid" ? "voucher.paid" : "voucher.void", entity: "voucher", entityId: v.id,
      summary: b.action === "mark_paid" ? `Thu tiền voucher ${v.code} · ${vnd(v.price)}` : `Huỷ voucher ${v.code} (${vnd(v.amount)})`,
      before: v, after: data,
    });
    return NextResponse.json({ ok: true, voucher: data });
  }

  if (b.action === "check") {
    const v = await byCode(b.code);
    const c = canRedeem(v, today);
    return NextResponse.json({ ok: c.ok, error: c.ok ? undefined : c.error, voucher: v });
  }

  if (b.action === "redeem") {
    const contract = typeof b.contractId === "string" ? await loadContract(db, b.contractId, ownerId) : null;
    if (!contract) return NextResponse.json({ error: "contract_not_found" }, { status: 404 });
    if (contract.status === "cancelled") return NextResponse.json({ error: "contract_cancelled" }, { status: 409 });
    const v = await byCode(b.code);
    const c = canRedeem(v, today);
    if (!c.ok || !v) return NextResponse.json({ error: c.ok ? "not_found" : c.error }, { status: 409 });

    // Giành thẻ TRƯỚC bằng UPDATE có điều kiện — hai người dùng cùng một mã cùng
    // lúc thì chỉ một người thắng, thẻ không bao giờ bị trừ hai lần.
    const { data: claimed } = await db
      .from("studio_vouchers")
      .update({ status: "redeemed", redeemed_contract_id: contract.id, redeemed_at: new Date().toISOString() })
      .eq("id", v.id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (!claimed) return NextResponse.json({ error: "redeemed" }, { status: 409 });

    const { data: payment, error } = await db
      .from("contract_payments")
      .insert({ contract_id: contract.id, amount: v.amount, kind: "voucher", paid_at: today, note: `Voucher ${v.code}`.slice(0, 200) })
      .select("*")
      .single();
    if (error || !payment) {
      await db.from("studio_vouchers").update({ status: "active", redeemed_contract_id: null, redeemed_at: null }).eq("id", v.id);
      if (error?.code === "23514") return NextResponse.json({ error: "missing_migration", file: "supabase/migrations/studio_vouchers.sql" }, { status: 409 });
      return NextResponse.json({ error: error?.message ?? "write_failed" }, { status: 500 });
    }
    await db.from("studio_vouchers").update({ redeemed_payment_id: payment.id }).eq("id", v.id);
    await logAction(db, {
      ownerId, actorId: actor, action: "voucher.redeem", entity: "voucher", entityId: v.id, contractId: contract.id,
      summary: `Dùng voucher ${v.code} (${vnd(v.amount)}) cho HĐ ${contract.code ?? contract.title}`,
    });
    return NextResponse.json({ ok: true, payment });
  }

  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
