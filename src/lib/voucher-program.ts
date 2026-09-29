/* ═══════════════════════════════════════════════════════════════════════════
   CHƯƠNG TRÌNH VOUCHER ƯU ĐÃI — phần thuần (không đụng DB), test bằng node.
   Luật & vòng đời: xem supabase/migrations/studio_voucher_program.sql.
   ═══════════════════════════════════════════════════════════════════════════ */

export type VoucherProgram = {
  enabled: boolean;
  percent: number;
  max_discount: number | null;
  /** null = không giới hạn thời gian */
  valid_months: number | null;
  title: string;
  /** Tên các gói (bảng giá) được dùng voucher · rỗng = mọi gói. Studio tự chọn. */
  package_names: string[];
};

export const DEFAULT_PROGRAM: VoucherProgram = {
  enabled: false,
  percent: 5,
  max_discount: null,
  valid_months: 12,
  title: "Voucher ưu đãi lần sau",
  package_names: [],
};

/**
 * % áp cho MỘT hợp đồng. `contractPercent`: null = theo chương trình, 0 = tắt
 * riêng hợp đồng này, n = n% riêng. Chương trình tắt thì không hợp đồng nào có.
 */
export function effectivePercent(program: VoucherProgram | null | undefined, contractPercent: number | null | undefined): number {
  if (!program?.enabled) return 0;
  if (contractPercent === 0) return 0;
  const p = contractPercent && contractPercent > 0 ? contractPercent : program.percent;
  return Math.max(0, Math.min(100, Math.round(p || 0)));
}

/** Giá trị voucher: % × tổng hợp đồng, làm tròn xuống bội 1.000đ, không vượt trần. */
export function programAmount(total: number, percent: number, max: number | null | undefined): number {
  if (percent <= 0 || total <= 0) return 0;
  let v = Math.floor((Math.round(total) * percent) / 100 / 1000) * 1000;
  if (max && max > 0) v = Math.min(v, max);
  return Math.max(0, v);
}

export type ProgramStage =
  /** chương trình tắt / hợp đồng tắt / giá trị 0 */
  | "off"
  /** chưa ký — cổng khách "nhận voucher lên đến …" */
  | "teaser"
  /** khách đã ký, chờ studio xác nhận cọc và/hoặc ký */
  | "pending"
  /** đủ điều kiện, đã (hoặc sắp) phát voucher */
  | "issued"
  /** hợp đồng huỷ */
  | "cancelled";

export type StageInput = {
  percent: number;
  amount: number;
  cancelled: boolean;
  clientSigned: boolean;
  depositConfirmed: boolean;
  studioSigned: boolean;
};

export function programStage(i: StageInput): ProgramStage {
  if (i.cancelled) return "cancelled";
  if (i.percent <= 0 || i.amount <= 0) return "off";
  if (!i.clientSigned) return "teaser";
  if (!i.depositConfirmed || !i.studioSigned) return "pending";
  return "issued";
}

/** Những việc còn thiếu để phát voucher — hiện cho studio (và nhắc khách). */
export function missingSteps(i: StageInput): string[] {
  const out: string[] = [];
  if (!i.clientSigned) out.push("Khách ký hợp đồng");
  if (!i.depositConfirmed) out.push("Studio xác nhận đã nhận cọc");
  if (!i.studioSigned) out.push("Studio ký xác nhận hợp đồng");
  return out;
}

/** Kiểu lần thu được coi là "đã cọc": mọi lần thu thật, trừ hoàn tiền và trừ bằng voucher. */
export function hasDeposit(payments: { amount: number; kind?: string | null }[]): boolean {
  return payments.some((p) => (p.amount || 0) > 0 && p.kind !== "refund" && p.kind !== "voucher");
}

export function readProgram(row: Partial<VoucherProgram> | null | undefined): VoucherProgram {
  if (!row) return { ...DEFAULT_PROGRAM };
  return {
    enabled: !!row.enabled,
    percent: Number(row.percent) || DEFAULT_PROGRAM.percent,
    max_discount: row.max_discount ? Number(row.max_discount) : null,
    valid_months: row.valid_months == null ? null : Number(row.valid_months),
    title: (row.title || "").trim() || DEFAULT_PROGRAM.title,
    package_names: Array.isArray(row.package_names) ? row.package_names.filter((s) => typeof s === "string" && s.trim()) : [],
  };
}
