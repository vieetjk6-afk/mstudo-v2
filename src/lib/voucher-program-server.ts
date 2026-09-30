import "server-only";
import { randomBytes } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { todayVN } from "@/lib/date";
import { logAction } from "@/lib/audit-log";
import { vnd } from "@/lib/types";
import { VOUCHER_COLS, VOUCHER_COLS_FULL, defaultExpiry, makeVoucherCode, type Voucher } from "@/lib/vouchers";
import type { PercentTier } from "@/lib/vouchers";
import {
  effectiveTiers,
  hasDeposit,
  maxTierPercent,
  missingSteps,
  programStage,
  readProgram,
  type ProgramStage,
  type VoucherProgram,
} from "@/lib/voucher-program";

type Db = ReturnType<typeof createAdminClient>;

export type ContractLoyalty = {
  stage: ProgramStage;
  /** % cao nhất khách có thể được (mốc cao nhất). */
  percent: number;
  /** Mốc % theo giá trị hợp đồng DÙNG voucher. */
  tiers: PercentTier[];
  max: number | null;
  missing: string[];
  title: string;
  voucher: Voucher | null;
  /** Gói được áp dụng (voucher đã phát: đúng danh sách chốt lúc phát). */
  packages: string[];
};

const OFF: ContractLoyalty = { stage: "off", percent: 0, tiers: [], max: null, missing: [], title: "", voucher: null, packages: [] };

export async function loadProgram(db: Db, ownerId: string): Promise<VoucherProgram | null> {
  const q = (cols: string) => db.from("studio_voucher_program").select(cols).eq("owner_id", ownerId).maybeSingle();
  let r = await q("enabled, percent, max_discount, valid_months, title, package_names, tiers");
  if (r.error) r = await q("enabled, percent, max_discount, valid_months, title, package_names");
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
    const vt = existing.percent_tiers?.length ? existing.percent_tiers : existing.percent ? [{ min: 0, percent: existing.percent }] : [];
    return {
      stage: existing.status === "void" || c.status === "cancelled" ? "cancelled" : "issued",
      percent: maxTierPercent(vt),
      tiers: vt,
      max: existing.max_discount ?? null,
      missing: [],
      title: existing.title,
      voucher: existing,
      packages: existing.applies_packages ?? [],
    };
  }
  if (!program) return OFF;

  const { data: pays } = await db.from("contract_payments").select("amount, kind").eq("contract_id", c.id);
  // Voucher là % cho HỢP ĐỒNG SAU (theo mốc giá trị của hợp đồng đó), không phải
  // số tiền tính từ hợp đồng này — hợp đồng này lớn mà hợp đồng sau nhỏ thì
  // voucher tiền cố định sẽ lớn hơn cả hợp đồng sau.
  const tiers = effectiveTiers(program, c.loyalty_percent);
  const percent = maxTierPercent(tiers);
  const input = {
    percent,
    cancelled: c.status === "cancelled",
    clientSigned: !!c.client_signed_at,
    depositConfirmed: hasDeposit((pays ?? []) as { amount: number; kind: string | null }[]),
    studioSigned: !!c.studio_signed_at,
  };
  const stage = programStage(input);
  const base: ContractLoyalty = { stage, percent, tiers, max: program.max_discount, missing: missingSteps(input), title: program.title, voucher: null, packages: program.package_names };
  if (stage !== "issued" || opts.issue === false) return base;

  const today = todayVN();
  const row = {
    owner_id: c.owner_id,
    kind: "loyalty",
    program_issued: true,
    title: program.title,
    discount_type: "percent",
    percent,
    max_discount: program.max_discount,
    amount: 0,
    price: 0,
    paid: true,
    paid_at: today,
    recipient_name: c.client_name,
    buyer_phone: c.client_phone,
    source_contract_id: c.id,
    expires_on: program.valid_months ? defaultExpiry(today, program.valid_months) : null,
    note: `Chương trình voucher của HĐ ${c.code ?? c.title}: ${tiers.map((t) => `${t.min ? `từ ${vnd(t.min)} ` : ""}${t.percent}%`).join(" · ")}`.slice(0, 500),
  };
  // Mốc % và gói áp dụng là cột MỚI — DB chưa chạy SQL mới thì phát bằng một
  // mức % cao nhất (vẫn đúng hướng, chỉ chưa chia mốc).
  const extras: Record<string, unknown>[] = [
    { percent_tiers: tiers, ...(program.package_names.length ? { applies_packages: program.package_names } : {}) },
    program.package_names.length ? { applies_packages: program.package_names } : {},
    {},
  ];
  let set = 0; // bộ cột đang thử (lùi dần khi DB thiếu cột mới)
  for (let tries = 0; tries < 8 && set < extras.length; tries++) {
    const extra = extras[set];
    const { data, error } = await db
      .from("studio_vouchers")
      .insert({ ...row, ...extra, code: makeVoucherCode(Math.random, "UD"), public_token: randomBytes(16).toString("base64url") })
      .select(VOUCHER_COLS)
      .single();
    if (!error && data) {
      const v = data as Voucher;
      await logAction(db, {
        ownerId: c.owner_id, actorId: null, action: "voucher.issue", entity: "voucher", entityId: v.id, contractId: c.id,
        summary: `Tự tặng voucher ${v.code} · giảm đến ${percent}% HĐ lần sau cho ${c.client_name || "khách"}`,
      }).catch(() => undefined);
      return { ...base, voucher: { ...v, percent_tiers: (extra.percent_tiers as PercentTier[] | undefined) ?? null }, missing: [] };
    }
    if (error?.code === "23505") {
      // Bên khác vừa phát (cổng khách + màn studio mở cùng lúc) hoặc trùng mã → đọc lại.
      const again = await issuedVoucher(db, c.id);
      if (again) return { ...base, voucher: again, missing: [] };
      continue;
    }
    if (error && /percent_tiers|applies_packages/.test(error.message)) {
      set++;
      continue;
    }
    return base; // lỗi khác: không phát lần này, lần xem sau thử lại
  }
  return base;
}
