/* ═══════════════════════════════════════════════════════════════════════════
   VOUCHER / THẺ QUÀ — phần thuần (không đụng database), kiểm thử bằng node.
   Hạch toán: xem supabase/migrations/studio_vouchers.sql.
   ═══════════════════════════════════════════════════════════════════════════ */

export type VoucherStatus = "active" | "redeemed" | "void";

export type Voucher = {
  id: string;
  code: string;
  title: string;
  amount: number;
  price: number;
  buyer_name: string | null;
  buyer_phone: string | null;
  recipient_name: string | null;
  paid: boolean;
  paid_method: string | null;
  paid_at: string | null;
  expires_on: string | null;
  status: VoucherStatus;
  redeemed_contract_id: string | null;
  redeemed_at: string | null;
  note: string | null;
  created_at: string;
};

/** Trạng thái HIỂN THỊ: gộp cả hạn dùng và việc đã thu tiền hay chưa. */
export type VoucherState = "usable" | "unpaid" | "expired" | "redeemed" | "void";

export const VOUCHER_STATE_LABEL: Record<VoucherState, string> = {
  usable: "Còn hiệu lực",
  unpaid: "Chưa thu tiền",
  expired: "Hết hạn",
  redeemed: "Đã dùng",
  void: "Đã huỷ",
};

// Không có 0/O, 1/I/L: khách đọc mã qua điện thoại, nhầm một ký tự là hỏng.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Mã thẻ dạng "QUA-7K3M9P". `rand` trả số trong [0,1) — truyền vào để test được. */
export function makeVoucherCode(rand: () => number = Math.random, prefix = "QUA"): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length) % ALPHABET.length];
  return `${prefix}-${s}`;
}

/** Chuẩn hoá mã khách đọc/gõ: bỏ khoảng trắng, viết hoa, gạch dài → gạch nối. */
export function normalizeVoucherCode(raw: string | null | undefined): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[–—_]/g, "-")
    .slice(0, 40);
}

export function voucherState(v: Pick<Voucher, "status" | "paid" | "expires_on">, today: string): VoucherState {
  if (v.status === "void") return "void";
  if (v.status === "redeemed") return "redeemed";
  if (v.expires_on && v.expires_on < today) return "expired";
  if (!v.paid) return "unpaid";
  return "usable";
}

export type RedeemCheck = { ok: true } | { ok: false; error: "not_found" | "unpaid" | "expired" | "redeemed" | "void" };

/** Dùng được thẻ này ở hợp đồng không? */
export function canRedeem(v: Pick<Voucher, "status" | "paid" | "expires_on"> | null | undefined, today: string): RedeemCheck {
  if (!v) return { ok: false, error: "not_found" };
  const s = voucherState(v, today);
  return s === "usable" ? { ok: true } : { ok: false, error: s };
}

export const REDEEM_ERROR_TEXT: Record<Exclude<RedeemCheck, { ok: true }>["error"], string> = {
  not_found: "Không tìm thấy mã voucher này.",
  unpaid: "Voucher chưa thu tiền — ghi nhận đã thu ở màn Voucher trước khi dùng.",
  expired: "Voucher đã hết hạn.",
  redeemed: "Voucher đã được dùng rồi.",
  void: "Voucher đã bị huỷ.",
};

/** Hạn mặc định: 12 tháng kể từ ngày bán (giữ đúng ngày, 29/2 → 28/2). */
export function defaultExpiry(today: string, months = 12): string {
  const [y, m, d] = today.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

export type VoucherSummary = { sold: number; collected: number; outstanding: number; outstandingCount: number; redeemed: number };

/**
 * Tổng quan cho đầu màn Voucher.
 *  - collected: tiền đã thu từ bán thẻ (giá bán, không phải mệnh giá)
 *  - outstanding: mệnh giá các thẻ đã thu tiền, còn hiệu lực — studio còn NỢ khách
 *  - redeemed: mệnh giá đã dùng (đã thành doanh thu ở hợp đồng)
 */
export function voucherSummary(list: Voucher[], today: string): VoucherSummary {
  const out: VoucherSummary = { sold: 0, collected: 0, outstanding: 0, outstandingCount: 0, redeemed: 0 };
  for (const v of list) {
    if (v.status === "void") continue;
    out.sold += 1;
    if (v.paid) out.collected += v.price;
    const s = voucherState(v, today);
    if (s === "usable") {
      out.outstanding += v.amount;
      out.outstandingCount += 1;
    }
    if (s === "redeemed") out.redeemed += v.amount;
  }
  return out;
}
