/**
 * Phần THUẦN của việc chốt báo giá thành hợp đồng: chọn hạng mục, cộng tổng,
 * áp ưu đãi gói, tính cọc. Không nhập gì để test Node nạp thẳng được
 * (desktop/test/quote-convert.mjs).
 *
 * Vì sao tách ra: khách thấy giá ĐÃ GIẢM ưu đãi gói trên trang báo giá
 * (QuoteClientView), nhưng bản chuyển sang hợp đồng trước đây bỏ quên
 * `bulk_discount_amount` — khách ký xong thì hợp đồng đòi giá gốc, cọc cũng
 * tính trên giá gốc.
 */
import { computeRoundedDeposit } from "./quote-deposit.ts";

/**
 * Cọc an toàn để HIỂN THỊ/LƯU: computeRoundedDeposit trả tối thiểu 500K kể cả
 * khi tổng = 0 hay nhỏ hơn 500K → "Cọc Infinity%" hoặc cọc lớn hơn cả tổng.
 * Kẹp về [0, total].
 */
export function safeDeposit(total: number): number {
  if (!(total > 0)) return 0;
  return Math.min(total, computeRoundedDeposit(total));
}

/** Phần trăm cọc đã làm tròn — 0 khi tổng không dương (không chia cho 0). */
export function depositPercent(total: number, deposit: number): number {
  if (!(total > 0) || !(deposit > 0)) return 0;
  return Math.round((deposit / total) * 100);
}

export type QuoteLineInput = {
  name: string;
  description?: string | null;
  qty: number;
  unit_price: number;
  is_optional: boolean;
  is_discount?: boolean;
  selected: boolean;
  package_group?: string | null;
};

export type QuoteDiscountInput = {
  bulk_discount_amount?: number | null;
  discount_package_group?: string | null;
};

/** Gói đang chọn (các gói loại trừ nhau) — giống hệt QuoteClientView. */
export function selectedPackageGroup(items: QuoteLineInput[]): string | null {
  return items.find((i) => i.package_group && i.selected)?.package_group ?? null;
}

/**
 * Số tiền ưu đãi gói đang áp dụng: chỉ khi khách chọn đúng gói studio chỉ định.
 * Cùng điều kiện với QuoteClientView/QuoteEditor để khách thấy gì, hợp đồng ra đúng thế.
 */
export function activeBulkDiscount(quote: QuoteDiscountInput, items: QuoteLineInput[]): number {
  const amount = Number(quote.bulk_discount_amount) || 0;
  if (!quote.discount_package_group || amount <= 0) return 0;
  return selectedPackageGroup(items) === quote.discount_package_group ? amount : 0;
}

export type ContractLine = {
  name: string;
  description: string | null;
  qty: number;
  unit_price: number;
};

/**
 * Dựng các dòng contract_items + tổng + cọc từ báo giá. Dòng giảm giá theo quy
 * ước sẵn có của hợp đồng: đơn giá ÂM, tên có "🏷️ " — để mọi chỗ cộng
 * qty × unit_price (tổng hợp đồng, công nợ, kế toán) tự trừ đúng mà không cần cột riêng.
 */
export function quoteToContractLines(
  quote: QuoteDiscountInput,
  items: QuoteLineInput[],
): { lines: ContractLine[]; total: number; deposit: number; depositPct: number } {
  const chosen = items.filter((it) => !it.is_optional || it.selected);
  const lines: ContractLine[] = chosen.map((it) => ({
    name: it.is_discount ? `🏷️ ${it.name}` : it.name,
    // Mô tả hạng mục đi theo sang hợp đồng.
    description: it.description ?? null,
    qty: it.qty,
    unit_price: it.is_discount ? -Math.abs(it.unit_price || 0) : it.unit_price,
  }));
  const bulk = chosen.length > 0 ? activeBulkDiscount(quote, items) : 0;
  if (bulk > 0) {
    lines.push({
      name: `🏷️ Ưu đãi gói ${quote.discount_package_group}`,
      description: null,
      qty: 1,
      unit_price: -Math.abs(bulk),
    });
  }
  const total = lines.reduce((s, l) => s + (l.qty || 0) * (l.unit_price || 0), 0);
  const deposit = safeDeposit(total);
  return { lines, total, deposit, depositPct: depositPercent(total, deposit) };
}
