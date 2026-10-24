/**
 * Bản ghi DNS studio cần thêm để tên miền riêng chạy trên mstudo (Vercel).
 * Dùng chung cho API /api/site/domain và ô "Tên miền riêng" trong trình tạo
 * website — ô đó tự tính bản ghi ngay khi mở trang, không phải chờ bấm "Kiểm tra".
 *
 * Bản ghi phụ thuộc ĐÚNG tên miền studio nhập: site chỉ được tra theo đúng host
 * đó, nên studio.com cần bản ghi A ở "@", còn www.studio.com cần CNAME ở "www".
 * Trước đây luôn hiện cả hai → studio trỏ www rồi mở www.studio.com thì không
 * chạy (host đó chưa hề được thêm vào project).
 */

export type DnsRow = { type: string; name: string; value: string };

/** Giá trị mặc định của Vercel — dùng khi API không gợi ý giá trị riêng. */
export const DEFAULT_A = "76.76.21.21";
export const DEFAULT_CNAME = "cname.vercel-dns.com";

/**
 * Đuôi tên miền hai cấp hay gặp (studio.com.vn là tên miền gốc, không phải tên
 * miền phụ của com.vn). Không cần đủ danh sách Public Suffix — chỉ cần đúng cho
 * các đuôi studio ở VN thực sự mua.
 */
const TWO_LEVEL_SUFFIXES = new Set([
  "com.vn", "net.vn", "org.vn", "edu.vn", "gov.vn", "biz.vn", "info.vn", "name.vn",
  "pro.vn", "health.vn", "ac.vn", "int.vn", "id.vn", "io.vn", "ai.vn",
  "co.uk", "org.uk", "com.au", "net.au", "co.jp", "com.sg", "co.kr", "com.cn",
]);

/** Phần gốc của tên miền: www.studio.com.vn → studio.com.vn. */
export function apexOf(domain: string): string {
  const parts = domain.toLowerCase().split(".");
  const last2 = parts.slice(-2).join(".");
  const keep = TWO_LEVEL_SUFFIXES.has(last2) ? 3 : 2;
  return parts.slice(-keep).join(".");
}

/** Phần trước tên miền gốc ("" nếu chính là tên miền gốc): www.studio.com → "www". */
export function hostLabel(domain: string): string {
  const apex = apexOf(domain);
  return domain.length > apex.length ? domain.slice(0, -(apex.length + 1)) : "";
}

/** Bản ghi trỏ tên miền về mstudo. `rec` = giá trị Vercel gợi ý riêng (nếu có). */
export function pointingRecords(domain: string, rec?: { a?: string; cname?: string }): DnsRow[] {
  const label = hostLabel(domain);
  return label
    ? [{ type: "CNAME", name: label, value: rec?.cname || DEFAULT_CNAME }]
    : [{ type: "A", name: "@", value: rec?.a || DEFAULT_A }];
}

/**
 * Bản ghi xác minh quyền sở hữu Vercel trả về (thường TXT `_vercel.studio.com`)
 * — chỉ có khi tên miền từng gắn với tài khoản Vercel khác. Đổi tên đầy đủ thành
 * tên tương đối với tên miền gốc, vì ô "Host/Tên" ở nhà cung cấp tự nối đuôi.
 */
export function verificationRecords(domain: string, verification: unknown): DnsRow[] {
  if (!Array.isArray(verification)) return [];
  const apex = apexOf(domain);
  return verification.flatMap((v) => {
    const r = v as { type?: string; domain?: string; value?: string };
    if (!r?.type || !r.value) return [];
    let name = (r.domain || "").toLowerCase();
    if (name === apex) name = "@";
    else if (name.endsWith(`.${apex}`)) name = name.slice(0, -(apex.length + 1));
    return [{ type: r.type, name, value: r.value }];
  });
}
