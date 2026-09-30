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
  /** Tên các gói trong bảng giá được dùng voucher này · null/rỗng = mọi gói */
  applies_packages?: string[] | null;
  /** Mốc %: giá trị hợp đồng DÙNG voucher càng cao thì % càng cao. Có mốc thì bỏ qua `percent`. */
  percent_tiers?: PercentTier[] | null;
};

/** Một mốc: hợp đồng từ `min` đồng trở lên được giảm `percent`%. */
export type PercentTier = { min: number; percent: number };

/** Cột đọc ra ở mọi nơi. Bản CŨ dùng khi DB chưa chạy studio_vouchers_loyalty.sql. */
export const VOUCHER_COLS_BASE =
  "id, code, title, amount, price, buyer_name, buyer_phone, recipient_name, paid, paid_method, paid_at, expires_on, status, redeemed_contract_id, redeemed_at, note, created_at";
export const VOUCHER_COLS = `${VOUCHER_COLS_BASE}, kind, discount_type, percent, max_discount, source_contract_id, public_token`;
/** Có thêm applies_packages (studio_voucher_program.sql). Luôn đọc kèm đường lùi về VOUCHER_COLS. */
export const VOUCHER_COLS_FULL = `${VOUCHER_COLS}, applies_packages, percent_tiers`;

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
  | { ok: false; error: "not_found" | "unpaid" | "expired" | "redeemed" | "void" | "same_contract" | "not_package" | "phone_mismatch" };

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
  not_package: "Voucher không áp dụng cho gói dịch vụ của hợp đồng này.",
  phone_mismatch: "Cần nhập đúng số điện thoại của hợp đồng đã được tặng voucher.",
};

export const isLoyalty = (v: Pick<Voucher, "kind">) => v.kind === "loyalty";

/** "Giảm 10% (tối đa 2.000.000đ)" · "Giảm 500.000đ" · thẻ quà: "2.000.000đ". */
export function voucherValueLabel(v: Pick<Voucher, "kind" | "discount_type" | "percent" | "max_discount" | "amount" | "percent_tiers">): string {
  const money = (n: number) => Math.round(n).toLocaleString("vi-VN") + "đ";
  const tiers = normalizeTiers(v.percent_tiers);
  if (tiers.length > 1) {
    return `Giảm đến ${topPercent(tiers)}%${v.max_discount ? ` (tối đa ${money(v.max_discount)})` : ""}`;
  }
  if (tiers.length === 1) {
    return `Giảm ${tiers[0].percent}%${v.max_discount ? ` (tối đa ${money(v.max_discount)})` : ""}`;
  }
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
  v: Pick<Voucher, "discount_type" | "percent" | "max_discount" | "amount" | "percent_tiers">,
  total: number
): number {
  const base = Math.max(0, Math.round(total));
  let d: number;
  const tiers = normalizeTiers(v.percent_tiers);
  if (tiers.length) {
    // Mốc % theo giá trị CHÍNH hợp đồng đang dùng voucher.
    const pct = tierFor(tiers, base);
    d = Math.floor((base * pct) / 100 / 1000) * 1000;
    if (v.max_discount && v.max_discount > 0) d = Math.min(d, v.max_discount);
  } else if (v.discount_type === "percent" && v.percent) {
    d = Math.floor((base * v.percent) / 100 / 1000) * 1000;
    if (v.max_discount && v.max_discount > 0) d = Math.min(d, v.max_discount);
  } else {
    d = Math.max(0, Math.round(v.amount));
  }
  return Math.min(d, base);
}

/** Tên dòng giảm giá ghi vào hợp đồng — có MÃ để luôn truy ngược được về voucher. */
export function voucherLineName(v: Pick<Voucher, "code" | "discount_type" | "percent" | "kind" | "max_discount" | "amount" | "percent_tiers">): string {
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

const plain = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Hợp đồng có gói nằm trong danh sách studio chọn không. So theo TÊN gói (bỏ
 * dấu, không phân biệt hoa thường) nằm trong tên hạng mục — hạng mục từ bảng
 * giá mang đúng tên gói, còn từ trang đặt lịch thì có thêm tiền tố "Cưới · …".
 * Danh sách rỗng = mọi gói.
 */
export function matchesPackages(packages: string[] | null | undefined, itemNames: (string | null | undefined)[]): boolean {
  const want = (packages ?? []).map(plain).filter(Boolean);
  if (want.length === 0) return true;
  const have = itemNames.map(plain).filter(Boolean);
  return have.some((n) => want.some((w) => n === w || n.includes(w)));
}

/** Dòng điều kiện in trên voucher / trang khách. */
export function voucherTerms(v: Pick<Voucher, "applies_packages" | "kind" | "percent_tiers">): string[] {
  if (v.kind !== "loyalty") return ["Không quy đổi thành tiền mặt."];
  const out = [];
  const tl = tiersLabel(normalizeTiers(v.percent_tiers));
  if (tl) out.push(tl);
  const pk = (v.applies_packages ?? []).filter(Boolean);
  if (pk.length) out.push(`Áp dụng cho: ${pk.join(", ")}.`);
  out.push("Tặng được người khác, khi dùng nhập đúng SĐT hợp đồng gốc.");
  out.push("Không có giá trị quy đổi thành tiền mặt.");
  return out;
}

/* ── Mốc % theo giá trị hợp đồng ───────────────────────────────────────── */

/** Làm sạch mốc studio nhập: bỏ dòng hỏng, % trong 1–100, mỗi mức tiền một mốc, xếp tăng dần. */
export function normalizeTiers(raw: unknown): PercentTier[] {
  if (!Array.isArray(raw)) return [];
  const byMin = new Map<number, number>();
  for (const t of raw) {
    const min = Math.max(0, Math.round(Number((t as PercentTier)?.min) || 0));
    const percent = Math.round(Number((t as PercentTier)?.percent) || 0);
    if (percent < 1 || percent > 100) continue;
    byMin.set(min, percent);
  }
  return [...byMin.entries()].map(([min, percent]) => ({ min, percent })).sort((a, b) => a.min - b.min);
}

/** % của hợp đồng có tổng `total`: mốc cao nhất mà hợp đồng đạt. Chưa đạt mốc nào = 0. */
export function tierFor(tiers: PercentTier[], total: number): number {
  let pct = 0;
  for (const t of normalizeTiers(tiers)) if (total >= t.min) pct = t.percent;
  return pct;
}

export function topPercent(tiers: PercentTier[]): number {
  return normalizeTiers(tiers).reduce((m, t) => Math.max(m, t.percent), 0);
}

/** "HĐ từ 30.000.000đ giảm 10% · từ 15.000.000đ giảm 7% · dưới 15.000.000đ giảm 5%." */
export function tiersLabel(tiers: PercentTier[]): string {
  const t = normalizeTiers(tiers);
  if (t.length <= 1) {
    return t.length && t[0].min > 0 ? `Áp dụng cho hợp đồng từ ${money0(t[0].min)}.` : "";
  }
  const parts = [...t].reverse().map((x, i, arr) => {
    const isLowest = i === arr.length - 1;
    if (isLowest && x.min === 0) return `dưới ${money0(arr[i - 1].min)} giảm ${x.percent}%`;
    return `${i === 0 ? "HĐ từ" : "từ"} ${money0(x.min)} giảm ${x.percent}%`;
  });
  return parts.join(" · ") + ".";
}

const money0 = (n: number) => Math.round(n).toLocaleString("vi-VN") + "đ";
