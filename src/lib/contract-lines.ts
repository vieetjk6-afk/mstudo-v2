/**
 * Dựng mảng hạng mục của hợp đồng từ những gì studio chọn ở bước "Gói dịch vụ".
 *
 * Vì sao tách khỏi form: tổng hợp đồng — và mọi số ăn theo nó (cọc, các đợt thu,
 * lợi nhuận dự kiến, cảnh báo lãi mỏng) — đều cộng từ mảng này. Nó là "nguồn số
 * liệu duy nhất" nói trong README, nên phải test được mà không cần dựng cả form
 * 5 bước.
 *
 * Ba nguồn hạng mục, cộng đúng thứ tự studio đọc trên báo giá:
 *   1. mẫu hợp đồng (nếu dùng mẫu)
 *   2. gói chính + hạng mục thêm lấy từ bảng giá — GIÁ CÓ THỂ ĐÃ SỬA
 *   3. gói riêng studio gõ tay cho đúng hợp đồng này
 *
 * Điểm cốt lõi: bảng giá là giá NIÊM YẾT, hợp đồng là giá đã thương lượng. Nên
 * `pkgPrice` (giá sửa theo id gói) luôn thắng `price` của bảng giá — và chỉ ghi
 * id nào thực sự đã sửa, gói không sửa vẫn ăn theo bảng giá.
 */

/** `description` = ô "Mô tả" của gói trong bảng giá — đi theo sang hạng mục. */
export type LinePackage = { id: string; name: string; price: number; description?: string | null };
export type LineTemplateItem = { name: string; qty: number; unit_price: number; position: number };
/** Gói studio gõ tay — chưa chắc đã điền đủ, nên chuẩn hoá ở đây. */
export type LineCustom = { name: string; qty: number; unit_price: number };
/** `description` chỉ có khi nguồn có mô tả — khách đọc nó ở cổng hợp đồng và trên bản in. */
export type ContractLine = { name: string; qty: number; unit_price: number; description?: string };

/** Mô tả gói từ bảng giá; trống thì bỏ hẳn khoá, khỏi lưu chuỗi rỗng. */
function pkgLine(p: LinePackage, unit_price: number): ContractLine {
  const description = p.description?.trim();
  return { name: p.name, qty: 1, unit_price, ...(description ? { description } : {}) };
}

/** Tên mặc định cho gói riêng chưa đặt tên — không để hạng mục trống tên. */
export const CUSTOM_LINE_FALLBACK_NAME = "Gói riêng";

/**
 * Dòng gõ tay còn trống HOÀN TOÀN (không tên, không giá) thì coi như chưa nhập.
 * Bấm "Thêm gói riêng" rồi đổi ý là chuyện thường; nếu vẫn tính thì hợp đồng
 * gửi khách có một hạng mục "Gói riêng · 0đ" không ai hiểu từ đâu ra.
 */
export function isCustomLineFilled(l: LineCustom): boolean {
  return !!l.name.trim() || l.unit_price > 0;
}

/** Giá dùng cho hợp đồng: giá đã sửa nếu có, còn lại là giá bảng giá. */
export function effectivePrice(p: LinePackage, pkgPrice: Record<string, number>): number {
  const edited = pkgPrice[p.id];
  return edited === undefined ? p.price : edited;
}

/** Giá của gói này có bị sửa lệch khỏi bảng giá hay không (để hiện nút hoàn giá). */
export function isPriceEdited(p: LinePackage, pkgPrice: Record<string, number>): boolean {
  const edited = pkgPrice[p.id];
  return edited !== undefined && edited !== p.price;
}

export function buildContractLines({
  templateItems = [],
  mainPkg = null,
  extras = [],
  pkgPrice = {},
  customLines = [],
  discount = 0,
}: {
  templateItems?: LineTemplateItem[];
  mainPkg?: LinePackage | null;
  extras?: LinePackage[];
  pkgPrice?: Record<string, number>;
  customLines?: LineCustom[];
  /** Số tiền giảm (đồng, số dương) — thành dòng "Giảm giá" giá âm ở cuối. */
  discount?: number;
}): ContractLine[] {
  const out: ContractLine[] = [];

  [...templateItems]
    .sort((a, b) => a.position - b.position)
    .forEach((i) => out.push({ name: i.name, qty: i.qty, unit_price: i.unit_price }));

  if (mainPkg) out.push(pkgLine(mainPkg, effectivePrice(mainPkg, pkgPrice)));
  for (const x of extras) out.push(pkgLine(x, effectivePrice(x, pkgPrice)));

  for (const c of customLines) {
    if (!isCustomLineFilled(c)) continue;
    out.push({
      name: c.name.trim() || CUSTOM_LINE_FALLBACK_NAME,
      // Số lượng tối thiểu 1: ô số lượng để trống trả về 0, mà hạng mục ×0 thì
      // giá bao nhiêu cũng thành 0đ — im lặng làm hụt tổng hợp đồng.
      qty: Math.max(1, Math.round(c.qty) || 1),
      unit_price: Math.max(0, Math.round(c.unit_price) || 0),
    });
  }

  // Giảm giá: CÙNG cách màn chi tiết hợp đồng lưu (dòng qty 1, unit_price âm),
  // nên mở hợp đồng ra vẫn thấy đúng dòng "Giảm giá" và tổng không lệch. Không
  // cho giảm quá tổng — hợp đồng âm tiền là lỗi gõ, không phải ý định.
  const sub = linesTotal(out);
  const off = Math.min(sub, Math.max(0, Math.round(discount) || 0));
  if (off > 0) out.push({ name: DISCOUNT_LINE_NAME, qty: 1, unit_price: -off });

  return out;
}

export const DISCOUNT_LINE_NAME = "Giảm giá";

/** Số tiền giảm từ ô nhập: theo % của tạm tính hoặc số tiền, làm tròn đồng, không quá tạm tính. */
export function discountAmount(subtotal: number, value: number, mode: "vnd" | "pct"): number {
  const v = Math.max(0, Number(value) || 0);
  const raw = mode === "pct" ? (subtotal * Math.min(100, v)) / 100 : v;
  return Math.min(Math.max(0, subtotal), Math.round(raw));
}

export type PlanRow = { label: string; amount: number; due: string };

/**
 * Kế hoạch thu khi TỔNG hợp đồng đổi sau khi studio đã nhập đợt thu.
 *
 * Lỗi thật studio gặp: khách cọc 7 triệu, tới bước cuối quay lại sửa gói thì
 * số cọc tự nhảy / số còn lại lệch hẳn. Luật: GIỮ NGUYÊN mọi đợt studio đã gõ
 * (nhất là cọc), chỉ đợt CUỐI gánh phần chênh. Chỉ có một đợt thì thêm đợt
 * "Thanh toán khi giao sản phẩm" cho phần còn lại. Tổng giảm dưới số đã chia
 * thì đợt cuối về 0 (không âm) — studio thấy ngay dòng cảnh báo lệch tổng.
 */
export function rebalancePlan(rows: PlanRow[], total: number): PlanRow[] {
  if (!rows.length || total <= 0) return rows;
  if (rows.length === 1) {
    const rest = total - rows[0].amount;
    return rest > 0 ? [rows[0], { label: "Thanh toán khi giao sản phẩm", amount: rest, due: "" }] : rows;
  }
  const last = rows.length - 1;
  const others = rows.reduce((s, x, i) => (i === last ? s : s + (x.amount || 0)), 0);
  return rows.map((x, i) => (i === last ? { ...x, amount: Math.max(0, total - others) } : x));
}

/** Tổng giá trị hợp đồng — luôn cộng từ mảng hạng mục, không có biến tổng riêng. */
export function linesTotal(lines: ContractLine[]): number {
  return lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
}
