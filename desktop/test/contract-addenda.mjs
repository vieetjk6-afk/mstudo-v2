/* Kiểm thử PHỤ LỤC HỢP ĐỒNG — làm sạch dòng nháp, tổng tiền, số thứ tự.
 *
 * Dòng nháp đến từ trình duyệt rồi được máy chủ chép thành hạng mục hợp đồng
 * khi khách ký — tức là thành TIỀN. Nạp thẳng src/lib/contract-addenda.ts.
 */
import {
  normalizeAddendumLines, addendumTotal, nextAddendumNo, addendumLabel, isSignedLockError, MAX_ADDENDUM_LINES,
} from "../../src/lib/contract-addenda.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

check("không phải mảng → rỗng", normalizeAddendumLines("x"), []);
check("bỏ dòng không tên, giữ dòng hợp lệ", normalizeAddendumLines([
  { name: "  ", qty: 1, unit_price: 100 },
  { name: "Thêm album 25x35", qty: 1, unit_price: 2_500_000 },
  null,
]), [{ name: "Thêm album 25x35", description: null, qty: 1, unit_price: 2_500_000 }]);
check("số lượng làm tròn và kẹp 1–999", normalizeAddendumLines([
  { name: "A", qty: 0, unit_price: 1 }, { name: "B", qty: 2.6, unit_price: 1 }, { name: "C", qty: 5000, unit_price: 1 },
]).map((l) => l.qty), [1, 3, 999]);
check("giảm giá giữ số âm, làm tròn về đồng", normalizeAddendumLines([{ name: "Giảm", qty: 1, unit_price: -500000.6 }])[0].unit_price, -500001);
check("đơn giá rác → 0", normalizeAddendumLines([{ name: "X", unit_price: "abc" }])[0].unit_price, 0);
check("mô tả được giữ và cắt khoảng trắng", normalizeAddendumLines([{ name: "X", description: "  in thêm  " }])[0].description, "in thêm");
check("tối đa số dòng", normalizeAddendumLines(Array.from({ length: 80 }, (_, i) => ({ name: `L${i}` }))).length, MAX_ADDENDUM_LINES);

check("tổng phụ lục", addendumTotal([
  { name: "A", description: null, qty: 2, unit_price: 1_000_000 },
  { name: "Giảm", description: null, qty: 1, unit_price: -300_000 },
]), 1_700_000);
check("tổng rỗng", addendumTotal([]), 0);

check("phụ lục đầu tiên là số 1", nextAddendumNo([]), 1);
check("số kế tiếp theo số lớn nhất", nextAddendumNo([{ no: 1 }, { no: 3 }]), 4);
check("nhãn có tiêu đề", addendumLabel({ no: 2, title: "Thêm buổi pre-wedding" }), "Phụ lục 2 · Thêm buổi pre-wedding");
check("nhãn không tiêu đề", addendumLabel({ no: 1, title: " " }), "Phụ lục 1");

check("nhận ra lỗi khoá", isSignedLockError({ message: "contract_signed_locked" }), true);
check("lỗi khác", isSignedLockError({ message: "duplicate key" }), false);
check("null", isSignedLockError(null), false);

if (fail) {
  console.log(`\n${fail} kiểm thử HỎNG`);
  process.exit(1);
}
console.log("\nPhụ lục hợp đồng: mọi kiểm thử đều qua.");
