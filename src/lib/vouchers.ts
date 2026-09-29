/* ═══════════════════════════════════════════════════════════════════════════
   VOUCHER / THẺ QUÀ — phần thuần (không đụng database), kiểm thử bằng node.
   Hạch toán: xem supabase/migrations/studio_vouchers.sql.
   ═══════════════════════════════════════════════════════════════════════════ */

export type VoucherStatus = "active" | "redeemed" | "void";
/** gift = thẻ quà studio BÁN; loyalty = voucher ưu đãi studio TẶNG khách đã ký cho lần sau. */
export type VoucherKind = "gift" | "loyalty";
export type DiscountType = "amount" | "percent";

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
  // Cột của studio_vouchers_loyalty.sql — thiếu (DB chưa chạy migration) = thẻ quà.
  kind?: VoucherKind | null;
  discount_type?: DiscountType | null;
  percent?: number | null;
  max_discount?: number | null;
  source_contract_id?: string | null;
  public_token?: string | null;
  /** 'wedding' = chỉ dùng cho gói phóng sự cưới · null = mọi gói */
  applies_to?: string | null;
};

/** Cột đọc ra ở mọi nơi. Bản CŨ dùng khi DB chưa chạy studio_vouchers_loyalty.sql. */
export const VOUCHER_COLS_BASE =
  "id, code, title, amount, price, buyer_name, buyer_phone, recipient_name, paid, paid_method, paid_at, expires_on, status, redeemed_contract_id, redeemed_at, note, created_at";
export const VOUCHER_COLS = `${VOUCHER_COLS_BASE}, kind, discount_type, percent, max_discount, source_contract_id, public_token`;
/** Có thêm applies_to (studio_voucher_program.sql). Đọc bằng loyaltyCols() để DB cũ không hỏng. */
export const VOUCHER_COLS_FULL = `${VOUCHER_COLS}, applies_to`;

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

export type RedeemCheck =
  | { ok: true }
  | { ok: false; error: "not_found" | "unpaid" | "expired" | "redeemed" | "void" | "same_contract" | "not_wedding" | "phone_mismatch" };

/**
 * Dùng được thẻ này ở hợp đồng không? `contractId` (tuỳ chọn) = hợp đồng định
 * dùng: voucher ưu đãi không dùng được ở chính hợp đồng đã tặng ra nó.
 */
export function canRedeem(
  v: Pick<Voucher, "status" | "paid" | "expires_on" | "source_contract_id"> | null | undefined,
  today: string,
  contractId?: string | null
): RedeemCheck {
  if (!v) return { ok: false, error: "not_found" };
  const s = voucherState(v, today);
  if (s !== "usable") return { ok: false, error: s };
  if (contractId && v.source_contract_id && v.source_contract_id === contractId) return { ok: false, error: "same_contract" };
  return { ok: true };
}

export const REDEEM_ERROR_TEXT: Record<Exclude<RedeemCheck, { ok: true }>["error"], string> = {
  not_found: "Không tìm thấy mã voucher này.",
  unpaid: "Voucher chưa thu tiền — ghi nhận đã thu ở màn Voucher trước khi dùng.",
  expired: "Voucher đã hết hạn.",
  redeemed: "Voucher đã được dùng rồi.",
  void: "Voucher đã bị huỷ.",
  same_contract: "Voucher này được tặng từ chính hợp đồng này — chỉ dùng được cho hợp đồng lần sau.",
  not_wedding: "Voucher chỉ áp dụng cho gói phóng sự cưới.",
  phone_mismatch: "Cần nhập đúng số điện thoại của hợp đồng đã được tặng voucher.",
};

export const isLoyalty = (v: Pick<Voucher, "kind">) => v.kind === "loyalty";

/** "Giảm 10% (tối đa 2.000.000đ)" · "Giảm 500.000đ" · thẻ quà: "2.000.000đ". */
export function voucherValueLabel(v: Pick<Voucher, "kind" | "discount_type" | "percent" | "max_discount" | "amount">): string {
  const money = (n: number) => Math.round(n).toLocaleString("vi-VN") + "đ";
  if (v.discount_type === "percent" && v.percent) {
    return `Giảm ${v.percent}%${v.max_discount ? ` (tối đa ${money(v.max_discount)})` : ""}`;
  }
  return isLoyalty(v) ? `Giảm ${money(v.amount)}` : money(v.amount);
}

/**
 * Số tiền voucher ưu đãi trừ vào hợp đồng có tổng `total` (trước voucher).
 * % làm tròn xuống bội 1.000đ (không ai muốn thấy "giảm 1.234.567đ"), chặn
 * trần max_discount, và không bao giờ vượt quá tổng hợp đồng.
 */
export function voucherDiscount(
  v: Pick<Voucher, "discount_type" | "percent" | "max_discount" | "amount">,
  total: number
): number {
  const base = Math.max(0, Math.round(total));
  let d: number;
  if (v.discount_type === "percent" && v.percent) {
    d = Math.floor((base * v.percent) / 100 / 1000) * 1000;
    if (v.max_discount && v.max_discount > 0) d = Math.min(d, v.max_discount);
  } else {
    d = Math.max(0, Math.round(v.amount));
  }
  return Math.min(d, base);
}

/** Tên dòng giảm giá ghi vào hợp đồng — có MÃ để luôn truy ngược được về voucher. */
export function voucherLineName(v: Pick<Voucher, "code" | "discount_type" | "percent" | "kind" | "max_discount" | "amount">): string {
  return `Voucher ${v.code} · ${voucherValueLabel(v)}`.slice(0, 200);
}


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
    // Voucher ưu đãi là quà tặng, không phải tiền khách đã trả: không vào các
    // con số "đã thu / còn nợ khách / đã thành doanh thu".
    if (v.status === "void" || isLoyalty(v)) continue;
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

/* ── Luật dùng voucher ưu đãi ──────────────────────────────────────────── */

const digitsOf = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
/** Cùng một SĐT (so 9 số cuối — bỏ qua 0 / +84 ở đầu). */
export function samePhoneNumber(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = digitsOf(a);
  const y = digitsOf(b);
  return x.length >= 9 && y.length >= 9 && x.slice(-9) === y.slice(-9);
}

/**
 * Người dùng voucher có đúng là người được tặng không. Voucher ưu đãi tặng
 * được cho người khác, NHƯNG phải nhập đúng SĐT của hợp đồng đã tặng nó — biết
 * mã thôi chưa đủ (mã in trên ảnh, ai chụp lại cũng thấy).
 * Voucher không ghi SĐT (tặng tay bản cũ, thẻ quà) thì không cần kiểm.
 */
export function phoneUnlocks(v: Pick<Voucher, "buyer_phone" | "kind">, ...phones: (string | null | undefined)[]): boolean {
  if (v.kind !== "loyalty" || digitsOf(v.buyer_phone).length < 9) return true;
  return phones.some((p) => samePhoneNumber(p, v.buyer_phone));
}

/**
 * Hợp đồng có phải GÓI PHÓNG SỰ CƯỚI không — theo loại dịch vụ, tên dịch vụ và
 * tên các hạng mục (studio hay gõ "Cưới · Phóng sự x2", "PSC trọn gói").
 */
export function isWeddingContract(shootType: string | null | undefined, names: (string | null | undefined)[]): boolean {
  if (shootType === "psc" || shootType === "wedding") return true;
  const hay = names.filter(Boolean).join(" ").toLowerCase();
  if (/pre[\s-]?wed|prewedding/.test(hay) && !/phóng sự|psc/.test(hay)) return false;
  return /phóng sự|psc|cưới|wedding|đám cưới|vu quy|tân hôn|thành hôn|rước dâu|đón dâu/.test(hay);
}

/** Dòng điều kiện in trên voucher / trang khách. */
export function voucherTerms(v: Pick<Voucher, "applies_to" | "kind">): string[] {
  if (v.kind !== "loyalty") return ["Không quy đổi thành tiền mặt."];
  const out = [];
  if (v.applies_to === "wedding") out.push("Áp dụng cho gói phóng sự cưới.");
  out.push("Tặng được người khác, khi dùng nhập đúng SĐT hợp đồng gốc.");
  out.push("Không có giá trị quy đổi thành tiền mặt.");
  return out;
}
