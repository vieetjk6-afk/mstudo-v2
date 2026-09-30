import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { studioFor, loadContract } from "@/lib/contract-change";
import { logAction } from "@/lib/audit-log";
import { todayVN } from "@/lib/date";
import { vnd, asPaymentMethod } from "@/lib/types";
import {
  VOUCHER_COLS,
  VOUCHER_COLS_BASE,
  VOUCHER_COLS_FULL,
  matchesPackages,
  normalizeTiers,
  topPercent,
  phoneUnlocks,
  canRedeem,
  defaultExpiry,
  isLoyalty,
  makeVoucherCode,
  normalizeVoucherCode,
  voucherDiscount,
  voucherLineName,
  voucherValueLabel,
  type Voucher,
} from "@/lib/vouchers";
import { contractLoyalty } from "@/lib/voucher-program-server";

export const dynamic = "force-dynamic";

/**
 * Voucher / thẻ quà (xem supabase/migrations/studio_vouchers.sql).
 *
 * POST { action: "create", title, amount, price, buyer_name, buyer_phone, recipient_name, expires_on, paid, paid_method, note }
 *      { action: "mark_paid", id, paid_method }
 *      { action: "void", id }
 *      { action: "issue", contractId, discount_type, amount, percent, max_discount, expires_on, title, note }
 *                                                → TẶNG voucher ưu đãi lần sau cho khách của HĐ đã ký
 *      { action: "check", code, contractId? }    → thông tin thẻ, dùng được không
 *      { action: "redeem", code, contractId }    → thẻ quà: khoản thu 'voucher'; ưu đãi: dòng giảm giá
 *      { action: "release", id }                 → trả voucher ưu đãi về "còn hiệu lực" (đã gỡ dòng giảm)
 */
const ROLES = ["manager", "branch_manager", "accountant"] as const;
const LOYALTY_FILE = "supabase/migrations/studio_vouchers_loyalty.sql";

/** Hợp đồng coi là "đã ký" để tặng voucher: khách ký online, hoặc studio đã chốt (không còn nháp / chờ duyệt). */
const SIGNED_STATUSES = new Set(["approved", "in_progress", "post_production", "completed"]);

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

  // DB chưa chạy studio_vouchers_loyalty.sql thì các cột mới chưa có — đọc lại
  // bằng bộ cột cũ để thẻ quà vẫn chạy như trước.
  const one = async (field: "id" | "code", value: string) => {
    for (const cols of [VOUCHER_COLS_FULL, VOUCHER_COLS, VOUCHER_COLS_BASE]) {
      const r = await db.from("studio_vouchers").select(cols).eq("owner_id", ownerId).eq(field, value).maybeSingle();
      if (!r.error) return (r.data as unknown as Voucher | null) ?? null;
    }
    return null;
  };
  const byId = async (id: unknown) => (typeof id === "string" ? one("id", id) : null);
  const byCode = async (code: unknown) => {
    const c = normalizeVoucherCode(String(code ?? ""));
    return c ? one("code", c) : null;
  };
  const COLS = VOUCHER_COLS_BASE;

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

  // ── Chương trình voucher ưu đãi (tự gắn mọi hợp đồng) ────────────────────
  if (b.action === "program_save") {
    // Mốc % theo giá trị hợp đồng sau. Không gửi mốc (trình duyệt cũ) → một mức `percent`.
    const tiers = normalizeTiers(b.tiers).slice(0, 20);
    const percent = tiers.length ? topPercent(tiers) : Math.round(Number(b.percent) || 0);
    if (percent < 1 || percent > 100) return NextResponse.json({ error: "bad_percent" }, { status: 400 });
    const months = b.valid_months == null || b.valid_months === "" ? null : Math.round(Number(b.valid_months) || 0);
    if (months !== null && (months < 1 || months > 120)) return NextResponse.json({ error: "bad_months" }, { status: 400 });
    const row = {
      owner_id: ownerId,
      enabled: b.enabled === true,
      percent,
      max_discount: Number(b.max_discount) > 0 ? Math.round(Number(b.max_discount)) : null,
      valid_months: months,
      title: str(b.title, 120) ?? "Voucher ưu đãi lần sau",
      // Gói được áp dụng: tên gói trong bảng giá (tối đa 100, mỗi tên ≤ 200 ký tự). Rỗng = mọi gói.
      package_names: Array.isArray(b.package_names)
        ? [...new Set((b.package_names as unknown[]).filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, 200)).filter(Boolean))].slice(0, 100)
        : [],
      tiers: tiers.length ? tiers : [{ min: 0, percent }],
      updated_at: new Date().toISOString(),
    };
    let { error } = await db.from("studio_voucher_program").upsert(row, { onConflict: "owner_id" });
    if (error && /package_names|tiers/.test(error.message)) {
      // DB chưa có cột mới (chưa chạy bản SQL mới) → lưu phần còn lại.
      const { package_names: _p, tiers: _t, ...rest } = row;
      void _p;
      void _t;
      ({ error } = await db.from("studio_voucher_program").upsert(rest, { onConflict: "owner_id" }));
    }
    if (error) {
      if (error.code === "42P01" || /studio_voucher_program/.test(error.message)) {
        return NextResponse.json({ error: "missing_migration", file: "supabase/voucher-uu-dai.sql" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await logAction(db, {
      ownerId, actorId: actor, action: "voucher.program", entity: "voucher", entityId: null,
      summary: `${row.enabled ? "Bật" : "Tắt"} chương trình voucher: ${row.tiers.map((t) => `${t.min ? `từ ${vnd(t.min)} ` : ""}${t.percent}%`).join(" · ")}${row.max_discount ? ` · tối đa ${vnd(row.max_discount)}` : ""}${months ? ` · hạn ${months} tháng` : " · không giới hạn"}${row.package_names.length ? ` · gói: ${row.package_names.join(", ")}` : " · mọi gói"}`,
      after: row,
    });
    return NextResponse.json({ ok: true, program: row });
  }

  if (b.action === "loyalty_status" || b.action === "contract_loyalty") {
    const contract = typeof b.contractId === "string" ? await loadContract(db, b.contractId, ownerId) : null;
    if (!contract) return NextResponse.json({ error: "contract_not_found" }, { status: 404 });
    if (b.action === "contract_loyalty") {
      // null = theo chương trình · 0 = tắt riêng hợp đồng này · n = n% riêng
      const p = b.percent == null || b.percent === "" ? null : Math.max(0, Math.min(100, Math.round(Number(b.percent) || 0)));
      const { error } = await db.from("studio_contracts").update({ loyalty_percent: p }).eq("id", contract.id);
      if (error) return NextResponse.json({ error: "missing_migration", file: "supabase/voucher-uu-dai.sql" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, loyalty: await contractLoyalty(db, contract.id) });
  }

  if (b.action === "issue") {
    const contract = typeof b.contractId === "string" ? await loadContract(db, b.contractId, ownerId) : null;
    if (!contract) return NextResponse.json({ error: "contract_not_found" }, { status: 404 });
    const { data: signed } = await db.from("studio_contracts").select("client_signed_at").eq("id", contract.id).maybeSingle();
    if (!signed?.client_signed_at && !SIGNED_STATUSES.has(contract.status)) {
      return NextResponse.json({ error: "contract_not_signed" }, { status: 409 });
    }
    const type = b.discount_type === "percent" ? "percent" : "amount";
    const percent = type === "percent" ? Math.round(Number(b.percent) || 0) : null;
    const amount = type === "amount" ? Math.round(Number(b.amount) || 0) : 0;
    const maxDiscount = type === "percent" && Number(b.max_discount) > 0 ? Math.round(Number(b.max_discount)) : null;
    if (type === "amount" && (amount <= 0 || amount > 1_000_000_000)) return NextResponse.json({ error: "bad_amount" }, { status: 400 });
    if (type === "percent" && (!percent || percent < 1 || percent > 100)) return NextResponse.json({ error: "bad_percent" }, { status: 400 });
    const row = {
      owner_id: ownerId,
      kind: "loyalty",
      title: str(b.title, 120) ?? "Voucher ưu đãi lần sau",
      discount_type: type,
      amount,
      percent,
      max_discount: maxDiscount,
      price: 0,
      recipient_name: contract.client_name,
      buyer_phone: contract.client_phone,
      source_contract_id: contract.id,
      // no_expiry = studio chọn "không giới hạn thời gian".
      expires_on: b.no_expiry === true ? null : isDate(b.expires_on) ? b.expires_on : defaultExpiry(today),
      // Tặng: không có tiền phải thu, nên "đã thu" để luật "còn hiệu lực" dùng chung.
      paid: true,
      paid_at: today,
      note: str(b.note, 500),
      created_by: actor,
    };
    for (let i = 0; i < 5; i++) {
      const { data, error } = await db
        .from("studio_vouchers")
        .insert({ ...row, code: makeVoucherCode(Math.random, "UD"), public_token: randomBytes(16).toString("base64url") })
        .select(VOUCHER_COLS)
        .single();
      if (!error) {
        const v = data as Voucher;
        await logAction(db, {
          ownerId, actorId: actor, action: "voucher.issue", entity: "voucher", entityId: v.id, contractId: contract.id,
          summary: `Tặng voucher ${v.code} · ${voucherValueLabel(v)} cho ${contract.client_name || "khách"} (dùng cho HĐ lần sau)`,
          after: v,
        });
        return NextResponse.json({ ok: true, voucher: v });
      }
      if (error.code === "42703" || error.code === "42P01" || error.code === "23514") {
        return NextResponse.json({ error: "missing_migration", file: LOYALTY_FILE }, { status: 409 });
      }
      if (error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
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
    const { error } = await db.from("studio_vouchers").update(patch).eq("id", v.id).eq("status", "active");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const data = await byId(v.id);
    await logAction(db, {
      ownerId, actorId: actor, action: b.action === "mark_paid" ? "voucher.paid" : "voucher.void", entity: "voucher", entityId: v.id,
      summary: b.action === "mark_paid" ? `Thu tiền voucher ${v.code} · ${vnd(v.price)}` : `Huỷ voucher ${v.code} (${vnd(v.amount)})`,
      before: v, after: data,
    });
    return NextResponse.json({ ok: true, voucher: data });
  }

  if (b.action === "check") {
    const v = await byCode(b.code);
    const c = canRedeem(v, today, typeof b.contractId === "string" ? b.contractId : null);
    return NextResponse.json({ ok: c.ok, error: c.ok ? undefined : c.error, voucher: v, label: v ? voucherValueLabel(v) : null });
  }

  if (b.action === "release") {
    const v = await byId(b.id);
    if (!v || !isLoyalty(v)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (v.status !== "redeemed") return NextResponse.json({ error: "not_redeemed" }, { status: 409 });
    // Dòng giảm giá còn nằm trong hợp đồng thì KHÔNG trả: trả là một voucher
    // giảm được hai lần.
    if (v.redeemed_contract_id) {
      const { data: still } = await db
        .from("contract_items")
        .select("id")
        .eq("contract_id", v.redeemed_contract_id)
        .ilike("name", `%${v.code}%`)
        .limit(1);
      if (still?.length) return NextResponse.json({ error: "still_applied" }, { status: 409 });
    }
    const { data, error } = await db
      .from("studio_vouchers")
      .update({ status: "active", redeemed_contract_id: null, redeemed_at: null })
      .eq("id", v.id)
      .eq("status", "redeemed")
      .select(VOUCHER_COLS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAction(db, {
      ownerId, actorId: actor, action: "voucher.release", entity: "voucher", entityId: v.id, contractId: v.redeemed_contract_id,
      summary: `Trả lại voucher ${v.code} về còn hiệu lực`, before: v, after: data,
    });
    return NextResponse.json({ ok: true, voucher: data });
  }

  if (b.action === "redeem") {
    const contract = typeof b.contractId === "string" ? await loadContract(db, b.contractId, ownerId) : null;
    if (!contract) return NextResponse.json({ error: "contract_not_found" }, { status: 404 });
    if (contract.status === "cancelled") return NextResponse.json({ error: "contract_cancelled" }, { status: 409 });
    const v = await byCode(b.code);
    const c = canRedeem(v, today, contract.id);
    if (!c.ok || !v) return NextResponse.json({ error: c.ok ? "not_found" : c.error }, { status: 409 });
    if (isLoyalty(v)) {
      // SĐT mở khoá: SĐT của hợp đồng đang áp, SĐT studio nhập hộ, hoặc yêu
      // cầu đặt lịch mà máy chủ đã kiểm SĐT lúc khách gửi (bookingId).
      let bookingOk = false;
      if (typeof b.bookingId === "string") {
        const { data: bk } = await db.from("studio_bookings").select("owner_id, voucher_code").eq("id", b.bookingId).maybeSingle();
        bookingOk = !!bk && bk.owner_id === ownerId && bk.voucher_code === v.code;
      }
      if (!bookingOk && !phoneUnlocks(v, contract.client_phone, typeof b.phone === "string" ? b.phone : null)) {
        return NextResponse.json({ error: "phone_mismatch" }, { status: 409 });
      }
      return redeemLoyalty(v, contract);
    }

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

  /**
   * Voucher ưu đãi → một DÒNG GIẢM GIÁ trong hợp đồng (không phải khoản thu:
   * không có đồng nào vào quỹ). Hợp đồng khách đã ký thì giá đã khoá — phải áp
   * trước khi gửi ký, hoặc làm phụ lục.
   */
  async function redeemLoyalty(v: Voucher, contract: { id: string; code: string | null; title: string }) {
    const { data: sig } = await db.from("studio_contracts").select("client_signed_at").eq("id", contract.id).maybeSingle();
    if (sig?.client_signed_at) return NextResponse.json({ error: "contract_signed" }, { status: 409 });

    const { data: items } = await db.from("contract_items").select("name, qty, unit_price, position").eq("contract_id", contract.id);
    const rows = (items ?? []) as { name: string | null; qty: number; unit_price: number; position: number | null }[];
    if (!matchesPackages(v.applies_packages, rows.map((r) => r.name))) {
      return NextResponse.json({ error: "not_package", packages: v.applies_packages }, { status: 409 });
    }
    const total = rows.reduce((t, r) => t + (r.qty || 0) * (r.unit_price || 0), 0);
    const discount = voucherDiscount(v, total);
    if (discount <= 0) return NextResponse.json({ error: "nothing_to_discount" }, { status: 409 });

    const { data: claimed } = await db
      .from("studio_vouchers")
      .update({ status: "redeemed", redeemed_contract_id: contract.id, redeemed_at: new Date().toISOString() })
      .eq("id", v.id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (!claimed) return NextResponse.json({ error: "redeemed" }, { status: 409 });

    const position = rows.reduce((m, r) => Math.max(m, r.position ?? 0), 0) + 1;
    const { data: item, error } = await db
      .from("contract_items")
      .insert({ contract_id: contract.id, name: voucherLineName(v), qty: 1, unit_price: -discount, position })
      .select("*")
      .single();
    if (error || !item) {
      await db.from("studio_vouchers").update({ status: "active", redeemed_contract_id: null, redeemed_at: null }).eq("id", v.id);
      return NextResponse.json({ error: error?.message ?? "write_failed" }, { status: 500 });
    }
    await logAction(db, {
      ownerId, actorId: actor, action: "voucher.redeem", entity: "voucher", entityId: v.id, contractId: contract.id,
      summary: `Dùng voucher ${v.code} (${voucherValueLabel(v)} → −${vnd(discount)}) cho HĐ ${contract.code ?? contract.title}`,
    });
    return NextResponse.json({ ok: true, kind: "loyalty", item, discount });
  }
}
