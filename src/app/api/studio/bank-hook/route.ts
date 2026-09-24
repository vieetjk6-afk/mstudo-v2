import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { phanLoaiLoi } from "@/lib/pg-loi";
import { newHookSecret, vnDate } from "@/lib/bank-reconcile";
import { applyToPlan, confirmDepositZalo } from "@/lib/bank-apply";

export const dynamic = "force-dynamic";

/**
 * Thẻ "Tự xác nhận chuyển khoản": đọc cấu hình + sổ giao dịch, bật/tắt, đổi
 * khoá, gán tay một giao dịch chưa rõ của ai vào một đợt, hoặc bỏ qua nó.
 *
 * Chỉ chủ studio: khoá webhook là chìa khoá để GHI TIỀN vào sổ của studio, và
 * gán giao dịch cũng là ghi tiền.
 */

async function owner() {
  const profile = await requireStudio("booking");
  if (!profile) return null;
  if (profile.actingRole && profile.actingRole !== "owner" && profile.actingRole !== "admin") return null;
  return profile;
}

const missing = () =>
  NextResponse.json({ missing: true, file: "supabase/doi-soat-ngan-hang.sql" });

export async function GET() {
  const profile = await owner();
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data: hook, error } = await db
    .from("studio_bank_hooks")
    .select("secret, enabled, last_event_at, created_at")
    .eq("owner_id", profile.id)
    .maybeSingle();
  if (error) return phanLoaiLoi(error) !== "khac" ? missing() : NextResponse.json({ error: "server_error" }, { status: 500 });

  const [{ data: txns }, { data: plans }] = await Promise.all([
    db
      .from("studio_bank_transactions")
      .select("id, amount, content, gateway, txn_at, created_at, status, note, contract_id, booking_id")
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30),
    // Các đợt còn mở — ô chọn khi gán tay một giao dịch.
    db
      .from("contract_payment_plan")
      .select("id, label, amount, due_date, contract:studio_contracts!inner(id, owner_id, code, title, client_name, status)")
      .eq("contract.owner_id", profile.id)
      .eq("paid", false)
      .neq("contract.status", "cancelled")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(200),
  ]);

  return NextResponse.json({ hook: hook ?? null, txns: txns ?? [], plans: plans ?? [] });
}

export async function POST(req: Request) {
  const profile = await owner();
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { action?: string; txnId?: string; planId?: string };
  const db = createAdminClient();

  // Bật lần đầu hoặc đổi khoá: cùng một việc là sinh khoá mới. Khoá cũ hết
  // hiệu lực ngay, nên đổi khoá là cách cắt một khoá đã lỡ lộ.
  if (b.action === "enable" || b.action === "rotate") {
    const { error } = await db
      .from("studio_bank_hooks")
      .upsert({ owner_id: profile.id, provider: "sepay", secret: newHookSecret(), enabled: true }, { onConflict: "owner_id" });
    if (error) return phanLoaiLoi(error) !== "khac" ? missing() : NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "pause" || b.action === "resume") {
    const { error } = await db
      .from("studio_bank_hooks")
      .update({ enabled: b.action === "resume" })
      .eq("owner_id", profile.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "ignore" || b.action === "assign") {
    if (!b.txnId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    const { data: txn } = await db
      .from("studio_bank_transactions")
      .select("id, owner_id, amount, txn_at, status")
      .eq("id", b.txnId)
      .maybeSingle();
    if (!txn || txn.owner_id !== profile.id) return NextResponse.json({ error: "not_found" }, { status: 404 });
    // Đã ghi thu thì không gán lại: gỡ khoản thu là việc của màn hợp đồng.
    if (txn.status === "matched") return NextResponse.json({ error: "already_matched" }, { status: 409 });

    if (b.action === "ignore") {
      await db.from("studio_bank_transactions").update({ status: "ignored" }).eq("id", txn.id);
      return NextResponse.json({ ok: true });
    }

    if (!b.planId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    const res = await applyToPlan(db, {
      ownerId: profile.id,
      planId: b.planId,
      received: Number(txn.amount) || 0,
      paidAt: vnDate(txn.txn_at),
      source: "SePay (gán tay)",
    });
    if (!res.ok) {
      const status = res.reason === "not_found" ? 404 : res.reason === "already_paid" ? 409 : 500;
      return NextResponse.json({ error: res.reason }, { status });
    }
    await db
      .from("studio_bank_transactions")
      .update({
        status: "matched",
        note: "manual",
        plan_id: b.planId,
        contract_id: res.contractId,
        payment_id: res.paymentId,
      })
      .eq("id", txn.id);
    if (res.label.toLowerCase().includes("cọc")) {
      await confirmDepositZalo(db, profile.id, res.contractId, Number(txn.amount) || 0);
    }
    return NextResponse.json({ ok: true, fit: res.fit, contractId: res.contractId });
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
