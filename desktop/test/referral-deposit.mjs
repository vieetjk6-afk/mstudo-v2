/* Kiểm thử luật so số điện thoại của chương trình giới thiệu và luật tính cọc.
 *
 * Vì sao đáng test:
 *
 *  • So SĐT sai theo hướng KHỚP OAN là tự tạo lỗ hổng: ai gõ một số bất kỳ cũng
 *    được ghi nhận là "được khách cũ giới thiệu" và lấy ưu đãi. Sai theo hướng
 *    KHÔNG KHỚP là khách thật bị mất thưởng — cũng mất khách.
 *    Người Việt nhập số theo đủ kiểu: 0901…, +84901…, 84901…, có dấu cách và
 *    dấu chấm. Tất cả phải quy về CÙNG MỘT người.
 *
 *  • Cọc lớn hơn giá gói là con số vô lý hiện thẳng vào mặt khách ngay bước
 *    chốt — phải kẹp lại.
 *
 * Nạp thẳng code thật ở src/lib/.
 */
import { digitsOnly, isUsablePhone, samePhone, referralBookingUrl } from "../../src/lib/referral.ts";
import { depositFor, newDepositCode, newDepositToken } from "../../src/lib/booking-deposit.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

// ── Chuẩn hoá số ───────────────────────────────────────────────────────────
check("bỏ dấu cách và dấu chấm", digitsOnly("090 123 45.67"), "0901234567");
check("bỏ dấu cộng", digitsOnly("+84901234567"), "84901234567");
check("null → rỗng", digitsOnly(null), "");

check("10 số → dùng được", isUsablePhone("0901234567"), true);
check("9 số → dùng được (số cũ)", isUsablePhone("901234567"), true);
check("11 số → dùng được", isUsablePhone("84901234567"), true);
check("8 số → quá ngắn", isUsablePhone("09012345"), false);
check("12 số → quá dài", isUsablePhone("849012345678"), false);
check("rỗng → không dùng được", isUsablePhone(""), false);

// ── So hai số có phải cùng một người ───────────────────────────────────────
check("0901234567 = +84901234567", samePhone("0901234567", "+84901234567"), true);
check("0901234567 = 84901234567", samePhone("0901234567", "84901234567"), true);
check("có dấu cách vẫn khớp", samePhone("090 123 4567", "0901234567"), true);
check("hai số khác nhau → KHÔNG khớp", samePhone("0901234567", "0909999999"), false);
// Đây là chỗ nguy hiểm nhất: khớp oan = ai cũng lấy được ưu đãi.
check("lệch đúng một chữ số cuối → KHÔNG khớp", samePhone("0901234567", "0901234568"), false);
check("rỗng KHÔNG khớp với rỗng (tránh nhận bừa)", samePhone("", ""), false);
check("null không khớp gì cả", samePhone(null, "0901234567"), false);

// ── Link giới thiệu ────────────────────────────────────────────────────────
check("thêm ref vào link chưa có tham số",
  referralBookingUrl("https://s.mstudo.com/book/abc", "0901234567"),
  "https://s.mstudo.com/book/abc?ref=0901234567");
check("nối bằng & khi link đã có tham số",
  referralBookingUrl("https://s.mstudo.com/book/abc?pkg=Cuoi", "0901234567"),
  "https://s.mstudo.com/book/abc?pkg=Cuoi&ref=0901234567");
check("SĐT rỗng → giữ nguyên link",
  referralBookingUrl("https://s.mstudo.com/book/abc", ""),
  "https://s.mstudo.com/book/abc");

// ── Tính cọc ───────────────────────────────────────────────────────────────
check("chính sách 500k, gói 5tr → cọc 500k", depositFor(500_000, 5_000_000), 500_000);
check("chính sách 500k, khách chưa chọn gói → vẫn 500k", depositFor(500_000, null), 500_000);
check("cọc lớn hơn giá gói → kẹp về giá gói", depositFor(500_000, 300_000), 300_000);
check("chính sách 0 → tắt cọc", depositFor(0, 5_000_000), 0);
check("chính sách âm → tắt cọc", depositFor(-100, 5_000_000), 0);
check("gói giá 0 (chưa báo giá) → dùng mức chính sách", depositFor(500_000, 0), 500_000);

// ── Mã và token cọc ────────────────────────────────────────────────────────
const codes = Array.from({ length: 300 }, () => newDepositCode());
check("mã có tiền tố COC- và đủ 8 ký tự", codes.every((c) => /^COC-[A-Z0-9]{4}$/.test(c)), true);
// Studio đối chiếu sao kê BẰNG MẮT: 0/O và 1/I/L nhìn giống nhau trên bản in.
check("mã không chứa ký tự dễ đọc nhầm (0 O 1 I L)",
  codes.every((c) => !/[01OIL]/.test(c.slice(4))), true);
check("token đủ dài để không đoán được", newDepositToken().length >= 32, true);
check("hai token liên tiếp khác nhau", newDepositToken() !== newDepositToken(), true);

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
