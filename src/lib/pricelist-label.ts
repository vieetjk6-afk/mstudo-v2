// Import tương đối + ghi rõ đuôi .ts là có chủ đích: file này được
// desktop/test/pricelist-label.mjs nạp thẳng bằng `node --experimental-strip-types`,
// mà node không hiểu alias @/ của tsconfig và ESM thì bắt buộc có đuôi file.
// Cờ allowImportingTsExtensions trong tsconfig cho phép cách viết này.
import { PRICE_LISTS } from "./pricelist-seeds.ts";

/**
 * Đổi `studio_pricelist.list_key` thành tên đọc được.
 *
 * `list_key` là khoá KỸ THUẬT, không phải nhãn: nó có thể là slug của bảng giá
 * dựng sẵn ("cuoi", "dinh-hon") hoặc id của một dịch vụ (UUID) khi studio tạo
 * bảng giá riêng cho dịch vụ đó. In thẳng ra là hiện nguyên chuỗi
 * "ae9cc354-1d97-4b74-b227-8e16e31390c7" làm tiêu đề nhóm giữa màn chọn gói.
 *
 * Lần theo bốn nấc, dừng ở nấc đầu tiên có kết quả:
 *   1. nhãn studio tự đặt (profiles.pl_list_labels)
 *   2. bảng giá dựng sẵn (PRICE_LISTS)
 *   3. tên dịch vụ trùng id — bắt đúng trường hợp UUID
 *   4. slug đọc tạm (bỏ gạch nối, viết hoa chữ đầu) — vẫn hơn slug thô
 */
export function makeListLabel(
  listLabels: Record<string, string> = {},
  services: { id: string; name: string }[] = [],
): (key: string) => string {
  return (key: string) => {
    const custom = listLabels[key];
    if (custom?.trim()) return custom.trim();

    const builtIn = PRICE_LISTS.find((l) => l.key === key);
    if (builtIn) return builtIn.label;

    const svc = services.find((s) => s.id === key);
    if (svc?.name?.trim()) return svc.name.trim();

    const pretty = key.replace(/[-_]+/g, " ").trim();
    return pretty ? pretty.charAt(0).toUpperCase() + pretty.slice(1) : "Bảng giá";
  };
}
