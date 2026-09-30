/* ═══════════════════════════════════════════════════════════════════════════
   CHƯƠNG TRÌNH VOUCHER ƯU ĐÃI — phần thuần (không đụng DB), test bằng node.
   Luật & vòng đời: xem supabase/migrations/studio_voucher_program.sql.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { PercentTier } from "./vouchers";

export type VoucherProgram = {
  enabled: boolean;
  /** % mặc định cũ (một mức). Chương trình mới dùng `tiers`. */
  percent: number;
  /**
   * Mốc % theo giá trị hợp đồng KHÁCH CHỐT: hợp đồng càng lớn thì voucher tặng
   * % càng cao. % đó chốt vào voucher và áp nguyên cho hợp đồng sau. Studio tự
   * điền. Không có mốc → một mức `percent`.
   */
  tiers: PercentTier[];
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
  tiers: [{ min: 0, percent: 5 }],
  max_discount: null,
  valid_months: 12,
  title: "Voucher ưu đãi lần sau",
  package_names: [],
};

/**
 * Mốc % áp cho voucher của MỘT hợp đồng. `contractPercent`: null = theo chương
 * trình, 0 = tắt riêng hợp đồng này, n = một mức n% riêng. Chương trình tắt thì
 * không hợp đồng nào có.
 */
export function effectiveTiers(program: VoucherProgram | null | undefined, contractPercent: number | null | undefined): PercentTier[] {
  if (!program?.enabled) return [];
  if (contractPercent === 0) return [];
  if (contractPercent && contractPercent > 0) return [{ min: 0, percent: Math.min(100, Math.round(contractPercent)) }];
  return cleanTiers(program.tiers);
}

/** Bản làm sạch mốc (giống normalizeTiers ở vouchers.ts — chép lại để file này tự đứng khi test). */
export function cleanTiers(raw: unknown): PercentTier[] {
  if (!Array.isArray(raw)) return [];
  const byMin = new Map<number, PercentTier>();
  for (const t of raw) {
    const min = Math.max(0, Math.round(Number((t as PercentTier)?.min) || 0));
    const percent = Math.round(Number((t as PercentTier)?.percent) || 0);
    const max = Math.round(Number((t as PercentTier)?.max) || 0);
    if (percent >= 1 && percent <= 100) byMin.set(min, { min, percent, ...(max > 0 ? { max } : {}) });
  }
  return [...byMin.values()].sort((a, b) => a.min - b.min);
}

export const maxTierPercent = (t: PercentTier[]) => t.reduce((m, x) => Math.max(m, x.percent), 0);

/** Mốc hợp đồng chốt `total` đạt được (mốc cao nhất ≤ total) · null = chưa đạt mốc thấp nhất. */
export function tierAt(tiers: PercentTier[], total: number): PercentTier | null {
  let hit: PercentTier | null = null;
  for (const t of cleanTiers(tiers)) if (total >= t.min) hit = t;
  return hit;
}

/** % voucher tặng cho hợp đồng chốt `total` (0 = chưa đạt mốc thấp nhất). */
export function previewPercent(tiers: PercentTier[], total: number): number {
  return tierAt(tiers, total)?.percent ?? 0;
}

/** Trần số tiền giảm của voucher: trần riêng của mốc, không có thì trần chung. */
export function tierMax(tier: PercentTier | null | undefined, programMax: number | null | undefined): number | null {
  if (tier?.max && tier.max > 0) return tier.max;
  return programMax && programMax > 0 ? programMax : null;
}

export type ProgramStage =
  /** chương trình tắt / hợp đồng tắt / chưa đạt mốc thấp nhất */
  | "off"
  /** chưa ký — cổng khách mời "ký & cọc để nhận voucher X%" */
  | "teaser"
  /** khách đã ký, chờ studio xác nhận cọc và/hoặc ký */
  | "pending"
  /** đủ điều kiện, đã (hoặc sắp) phát voucher */
  | "issued"
  /** hợp đồng huỷ */
  | "cancelled";

export type StageInput = {
  /** % voucher hợp đồng này được tặng (theo mốc) — 0 = không có voucher. */
  percent: number;
  cancelled: boolean;
  clientSigned: boolean;
  depositConfirmed: boolean;
  studioSigned: boolean;
};

export function programStage(i: StageInput): ProgramStage {
  if (i.cancelled) return "cancelled";
  if (i.percent <= 0) return "off";
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
    // Chưa có mốc (bản cũ / chưa chạy SQL mới) → một mức theo `percent`.
    tiers: cleanTiers(row.tiers).length ? cleanTiers(row.tiers) : [{ min: 0, percent: Number(row.percent) || DEFAULT_PROGRAM.percent }],
    max_discount: row.max_discount ? Number(row.max_discount) : null,
    valid_months: row.valid_months == null ? null : Number(row.valid_months),
    title: (row.title || "").trim() || DEFAULT_PROGRAM.title,
    package_names: Array.isArray(row.package_names) ? row.package_names.filter((s) => typeof s === "string" && s.trim()) : [],
  };
}

/** Mốc kế tiếp cao hơn mức hợp đồng đang đạt — để gợi ý khách "thêm … nhận Y%". */
export function nextTier(tiers: PercentTier[], total: number): PercentTier | null {
  const cur = previewPercent(tiers, total);
  return cleanTiers(tiers).find((t) => t.min > total && t.percent > cur) ?? null;
}
