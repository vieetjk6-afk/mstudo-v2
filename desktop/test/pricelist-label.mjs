/* Kiểm thử việc đổi `list_key` thành tên đọc được cho tiêu đề nhóm gói.
 *
 * Vì sao đáng test: `list_key` là khoá kỹ thuật, và trước đây nó được IN THẲNG
 * làm tiêu đề nhóm ở màn tạo báo giá và tạo hợp đồng — studio nhìn thấy
 * "ae9cc354-1d97-4b74-b227-8e16e31390c7" và "dinh-hon" nằm giữa danh sách gói.
 *
 * Bốn nấc phải giữ đúng thứ tự ưu tiên, vì nấc sau luôn có kết quả nên nấc
 * trước sai là không bao giờ lộ ra:
 *   nhãn studio tự đặt → bảng giá dựng sẵn → tên dịch vụ trùng id → slug đọc tạm
 */
import { makeListLabel } from "../../src/lib/pricelist-label.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const UUID = "ae9cc354-1d97-4b74-b227-8e16e31390c7";
const services = [{ id: UUID, name: "Chụp phóng sự cưới" }, { id: "svc-2", name: "Quay phim" }];

// Nấc 4 — slug lạ, không có nhãn nào cả.
const bare = makeListLabel({}, []);
check("slug dựng sẵn 'cuoi' → Cưới", bare("cuoi"), "Cưới");
check("slug dựng sẵn 'dinh-hon' → Đính hôn", bare("dinh-hon"), "Đính hôn");
check("slug lạ → bỏ gạch nối, viết hoa", bare("ky-yeu-nhom"), "Ky yeu nhom");
check("khoá rỗng → không trả chuỗi rỗng", bare(""), "Bảng giá");

// Nấc 3 — UUID khớp id dịch vụ. Đây chính là chuỗi hiện trong ảnh chụp lỗi.
const withSvc = makeListLabel({}, services);
check("UUID khớp id dịch vụ → tên dịch vụ", withSvc(UUID), "Chụp phóng sự cưới");
check("UUID KHÔNG khớp dịch vụ nào → vẫn không in UUID thô",
  withSvc("11111111-2222-3333-4444-555555555555"),
  "11111111 2222 3333 4444 555555555555");

// Nấc 1 — nhãn studio tự đặt thắng tất cả.
const withCustom = makeListLabel({ cuoi: "Bảng giá cưới 2026", [UUID]: "Gói phóng sự" }, services);
check("nhãn tự đặt thắng bảng giá dựng sẵn", withCustom("cuoi"), "Bảng giá cưới 2026");
check("nhãn tự đặt thắng tên dịch vụ", withCustom(UUID), "Gói phóng sự");

// Nhãn rỗng/chỉ khoảng trắng phải bị bỏ qua, không được ra tiêu đề trống.
const blank = makeListLabel({ cuoi: "   " }, services);
check("nhãn tự đặt chỉ có khoảng trắng → lùi về bảng giá dựng sẵn", blank("cuoi"), "Cưới");

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
