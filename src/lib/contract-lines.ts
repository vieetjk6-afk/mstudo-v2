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

export type LinePackage = { id: string; name: string; price: number };
export type LineTemplateItem = { name: string; qty: number; unit_price: number; position: number };
/** Gói studio gõ tay — chưa chắc đã điền đủ, nên chuẩn hoá ở đây. */
export type LineCustom = { name: string; qty: number; unit_price: number };
export type ContractLine = { name: string; qty: number; unit_price: number };

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
}: {
  templateItems?: LineTemplateItem[];
  mainPkg?: LinePackage | null;
  extras?: LinePackage[];
  pkgPrice?: Record<string, number>;
  customLines?: LineCustom[];
}): ContractLine[] {
  const out: ContractLine[] = [];

  [...templateItems]
    .sort((a, b) => a.position - b.position)
    .forEach((i) => out.push({ name: i.name, qty: i.qty, unit_price: i.unit_price }));

  if (mainPkg) out.push({ name: mainPkg.name, qty: 1, unit_price: effectivePrice(mainPkg, pkgPrice) });
  for (const x of extras) out.push({ name: x.name, qty: 1, unit_price: effectivePrice(x, pkgPrice) });

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

  return out;
}

/** Tổng giá trị hợp đồng — luôn cộng từ mảng hạng mục, không có biến tổng riêng. */
export function linesTotal(lines: ContractLine[]): number {
  return lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
}
