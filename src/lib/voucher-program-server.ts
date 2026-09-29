import "server-only";
import { randomBytes } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { todayVN } from "@/lib/date";
import { logAction } from "@/lib/audit-log";
import { vnd } from "@/lib/types";
import { VOUCHER_COLS, VOUCHER_COLS_FULL, defaultExpiry, makeVoucherCode, type Voucher } from "@/lib/vouchers";
import {
  effectivePercent,
  hasDeposit,
  missingSteps,
  programAmount,
  programStage,
  readProgram,
  type ProgramStage,
  type VoucherProgram,
} from "@/lib/voucher-program";

type Db = ReturnType<typeof createAdminClient>;

export type ContractLoyalty = {
  stage: ProgramStage;
  percent: number;
  /** Chưa phát: giá trị ước tính theo tổng hiện tại. Đã phát: đúng mệnh giá voucher. */
  amount: number;
  max: number | null;
  missing: string[];
  title: string;
  voucher: Voucher | null;
  /** Luật chương trình hiện tại (cho lời mời trước khi phát). */
  weddingOnly: boolean;
};

const OFF: ContractLoyalty = { stage: "off", percent: 0, amount: 0, max: null, missing: [], title: "", voucher: null, weddingOnly: false };

export async function loadProgram(db: Db, ownerId: string): Promise<VoucherProgram | null> {
  const q = (cols: string) => db.from("studio_voucher_program").select(cols).eq("owner_id", ownerId).maybeSingle();
  let r = await q("enabled, percent, max_discount, valid_months, title, wedding_only");
  if (r.error) r = await q("enabled, percent, max_discount, valid_months, title");
  if (r.error) return null; // chưa chạy migration → coi như chương trình tắt
  return readProgram(r.data as unknown as Partial<VoucherProgram> | null);
}

async function issuedVoucher(db: Db, contractId: string): Promise<Voucher | null> {
  for (const cols of [VOUCHER_COLS_FULL, VOUCHER_COLS]) {
    const r = await db.from("studio_vouchers").select(cols).eq("source_contract_id", contractId).eq("program_issued", true).maybeSingle();
    if (!r.error) return (r.data as unknown as Voucher | null) ?? null;
  }
  return null;
}

/**
 * Voucher ưu đãi của MỘT hợp đồng theo chương trình của studio — và PHÁT nó
 * nếu hợp đồng vừa đủ điều kiện (khách ký + studio xác nhận cọc + studio ký).
 *
 * Được gọi ở mọi chỗ người ta NHÌN voucher (cổng khách, màn hợp đồng) thay vì
 * móc vào từng nơi ghi cọc / ký — có tới năm sáu lối ghi cọc, bỏ sót một lối là
 * khách đủ điều kiện mà không bao giờ nhận voucher. Phát đúng một lần nhờ chỉ
 * mục duy nhất trên (source_contract_id) where program_issued.
 */
export async function contractLoyalty(db: Db, contractId: string, opts: { issue?: boolean } = {}): Promise<ContractLoyalty> {
  const full = await db
    .from("studio_contracts")
    .select("id, owner_id, code, title, status, client_name, client_phone, client_signed_at, studio_signed_at, loyalty_percent")
    .eq("id", contractId)
    .maybeSingle();
  if (full.error) return OFF; // chưa chạy migration (thiếu loyalty_percent)
  const c = full.data as {
    id: string; owner_id: string; code: string | null; title: string; status: string;
    client_name: string | null; client_phone: string | null;
    client_signed_at: string | null; studio_signed_at: string | null; loyalty_percent: number | null;
  } | null;
  if (!c) return OFF;

  const program = await loadProgram(db, c.owner_id);
  const existing = await issuedVoucher(db, c.id);
  if (existing) {
    return {
      stage: existing.status === "void" || c.status === "cancelled" ? "cancelled" : "issued",
      percent: effectivePercent(program, c.loyalty_percent),
      amount: existing.amount,
      max: program?.max_discount ?? null,
      missing: [],
      title: existing.title,
      voucher: existing,
      weddingOnly: existing.applies_to === "wedding",
    };
  }
  if (!program) return OFF;

  const [{ data: items }, { data: pays }] = await Promise.all([
    db.from("contract_items").select("qty, unit_price").eq("contract_id", c.id),
    db.from("contract_payments").select("amount, kind").eq("contract_id", c.id),
  ]);
  const total = ((items ?? []) as { qty: number; unit_price: number }[]).reduce((t, r) => t + (r.qty || 0) * (r.unit_price || 0), 0);
  const percent = effectivePercent(program, c.loyalty_percent);
  const amount = programAmount(total, percent, program.max_discount);
  const input = {
    percent,
    amount,
    cancelled: c.status === "cancelled",
    clientSigned: !!c.client_signed_at,
    depositConfirmed: hasDeposit((pays ?? []) as { amount: number; kind: string | null }[]),
    studioSigned: !!c.studio_signed_at,
  };
  const stage = programStage(input);
  const base: ContractLoyalty = { stage, percent, amount, max: program.max_discount, missing: missingSteps(input), title: program.title, voucher: null, weddingOnly: program.wedding_only };
  if (stage !== "issued" || opts.issue === false) return base;

  const today = todayVN();
  for (let i = 0; i < 5; i++) {
    const { data, error } = await db
      .from("studio_vouchers")
      .insert({
        owner_id: c.owner_id,
        kind: "loyalty",
        program_issued: true,
        code: makeVoucherCode(Math.random, "UD"),
        public_token: randomBytes(16).toString("base64url"),
        title: program.title,
        discount_type: "amount",
        amount,
        price: 0,
        paid: true,
        paid_at: today,
        recipient_name: c.client_name,
        buyer_phone: c.client_phone,
        source_contract_id: c.id,
        expires_on: program.valid_months ? defaultExpiry(today, program.valid_months) : null,
        note: `Chương trình ${percent}% giá trị HĐ ${c.code ?? c.title}`.slice(0, 500),
        ...(program.wedding_only ? { applies_to: "wedding" } : {}),
      })
      .select(VOUCHER_COLS)
      .single();
    if (!error && data) {
      const v = data as Voucher;
      await logAction(db, {
        ownerId: c.owner_id, actorId: null, action: "voucher.issue", entity: "voucher", entityId: v.id, contractId: c.id,
        summary: `Tự tặng voucher ${v.code} · ${vnd(amount)} (${percent}% HĐ) cho ${c.client_name || "khách"}`,
      }).catch(() => undefined);
      return { ...base, voucher: v, missing: [] };
    }
    if (error?.code === "23505") {
      // Bên khác vừa phát (cổng khách + màn studio mở cùng lúc) hoặc trùng mã → đọc lại.
      const again = await issuedVoucher(db, c.id);
      if (again) return { ...base, amount: again.amount, voucher: again, missing: [] };
      continue;
    }
    return base; // lỗi khác: không phát lần này, lần xem sau thử lại
  }
  return base;
}
