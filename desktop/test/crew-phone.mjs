/* Kiểm thử chuẩn hoá SĐT thợ khi studio đổi số ở sổ thợ (src/lib/crew-phone.ts).
 *
 * Vì sao đáng test: SĐT là danh tính của thợ ở cổng /crew. Lưu sai dạng (84…
 * thay vì 0…) là thợ gõ đúng số của mình mà vẫn "không có trong sổ"; so trùng
 * theo chữ thô là cùng một người thành hai dòng trong sổ, lịch tách làm đôi.
 */
import { crewPhoneError, findPhoneOwner, normalizeCrewPhone, phoneDigits } from "../../src/lib/crew-phone.ts";

let fail = 0;
const check = (name, got, want) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    fail++;
    console.log(`✗ ${name}\n    got:  ${g}\n    want: ${w}`);
  } else console.log(`✓ ${name}`);
};

check("bỏ dấu cách / chấm / gạch", normalizeCrewPhone(" 0912.345-678 "), "0912345678");
check("+84 đổi về 0", normalizeCrewPhone("+84 912 345 678"), "0912345678");
check("84 không dấu đổi về 0", normalizeCrewPhone("84912345678"), "0912345678");
check("số bàn 11 chữ số giữ nguyên", normalizeCrewPhone("02838123456"), "02838123456");
check("rỗng", normalizeCrewPhone(null), "");
check("phoneDigits giữ nguyên 84 (khớp cách cổng /crew lưu)", phoneDigits("+84 912"), "84912");

check("thiếu số", crewPhoneError(""), "Cần nhập số điện thoại.");
check("quá ngắn", crewPhoneError("12345"), "Số điện thoại phải có 9–11 chữ số.");
check("quá dài", crewPhoneError("091234567890"), "Số điện thoại phải có 9–11 chữ số.");
check("số di động hợp lệ", crewPhoneError("0912345678"), null);

const roster = [
  { id: "a", phone: "0912 345 678", name: "Quân" },
  { id: "b", phone: "0987654321", name: "Nhung" },
];
check("trùng số khác cách viết", findPhoneOwner(roster, "0912345678", "b")?.id, "a");
check("không tính chính thợ đang sửa", findPhoneOwner(roster, "0912345678", "a"), null);
check("số mới chưa ai dùng", findPhoneOwner(roster, "0900000000", "a"), null);

if (fail) {
  console.log(`\n${fail} kiểm thử lỗi`);
  process.exit(1);
}
console.log("\nTất cả kiểm thử đều qua.");
