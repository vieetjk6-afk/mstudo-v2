/* Kiểm thử luật ngày tháng của hạn lưu trữ ảnh gốc và hạn hiệu lực báo giá.
 *
 * Vì sao đáng test: cả hai đều là phép cộng ngày/tháng rồi SO SÁNH, mà loại
 * code này sai âm thầm — không nổ, không đỏ, chỉ ra sai một ngày. Hậu quả
 * không đối xứng:
 *   • Hạn lưu trữ tính ngắn đi → studio bị giục dọn ảnh gốc sớm hơn thoả thuận
 *     với khách, xoá xong là mất hẳn.
 *   • Hạn báo giá tính dài ra → khách chốt được giá của mùa trước.
 *
 * Hai cái bẫy chính:
 *   • Cộng tháng vào ngày 31: 31/8 + 6 tháng KHÔNG được nhảy sang 3/3.
 *   • Lệch múi giờ: cron chạy 7h sáng VN, nếu so bằng mốc UTC thì album hết hạn
 *     "hôm nay" lại bị tính là còn 1 ngày.
 *
 * Nạp thẳng code thật ở src/lib/.
 */
import { storageUntil, daysLeft, storageState } from "../../src/lib/storage-lifecycle.ts";
import { quoteExpiryFrom, isQuoteExpired, quoteDaysLeft } from "../../src/lib/quote-expiry.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

// ── Hạn lưu trữ: cộng tháng theo lịch ──────────────────────────────────────
check("giao 15/01 + 6 tháng → 15/07", storageUntil("2026-01-15T10:00:00Z", 6), "2026-07-15");
check("giao 31/08 + 6 tháng → 28/02 (kẹp cuối tháng, KHÔNG nhảy sang 3/3)",
  storageUntil("2026-08-31T10:00:00Z", 6), "2027-02-28");
check("giao 31/01 + 1 tháng → 28/02", storageUntil("2026-01-31T10:00:00Z", 1), "2026-02-28");
check("giao 29/02 năm nhuận + 12 tháng → 28/02", storageUntil("2028-02-29T10:00:00Z", 12), "2029-02-28");
check("chính sách 0 tháng → không đặt hạn", storageUntil("2026-01-15T10:00:00Z", 0), null);
check("chính sách âm → không đặt hạn", storageUntil("2026-01-15T10:00:00Z", -3), null);
check("ngày giao rác → không đặt hạn", storageUntil("khong-phai-ngay", 6), null);

// ── Hạn lưu trữ: đếm ngày còn lại theo giờ VN ──────────────────────────────
// 10/06 lúc 00:30 UTC = 07:30 sáng giờ VN cùng ngày — đúng lúc cron chạy.
const cronVN = new Date("2026-06-10T00:30:00Z");
check("hết hạn đúng hôm nay → 0 ngày (không phải 1)", daysLeft("2026-06-10", cronVN), 0);
check("hết hạn ngày mai → 1 ngày", daysLeft("2026-06-11", cronVN), 1);
check("quá hạn hôm qua → -1 ngày", daysLeft("2026-06-09", cronVN), -1);
check("không đặt hạn → null", daysLeft(null, cronVN), null);

// 09/06 lúc 18:00 UTC = 01:00 sáng NGÀY 10/06 giờ VN. Nếu so bằng UTC thì vẫn
// tưởng là ngày 9 và trả 1 ngày — đây chính là chỗ dễ sai nhất.
const afterMidnightVN = new Date("2026-06-09T18:00:00Z");
check("qua nửa đêm giờ VN → tính theo ngày VN, không theo UTC",
  daysLeft("2026-06-10", afterMidnightVN), 0);

check("còn 40 ngày → ok", storageState("2026-07-20", cronVN), "ok");
check("còn 30 ngày → cảnh báo", storageState("2026-07-10", cronVN), "warn");
check("còn 1 ngày → cảnh báo", storageState("2026-06-11", cronVN), "warn");
check("quá hạn → expired", storageState("2026-06-01", cronVN), "expired");
check("không đặt hạn → none", storageState(null, cronVN), "none");

// ── Hạn hiệu lực báo giá ───────────────────────────────────────────────────
const sentAt = new Date("2026-03-01T16:00:00Z"); // 23:00 giờ VN ngày 01/03
const exp15 = quoteExpiryFrom(15, sentAt);
// Gửi lúc 23h mà hạn 15 ngày thì ngày thứ 15 phải còn NGUYÊN, không cụt lúc 23h.
check("gửi 23h + 15 ngày → hết vào cuối ngày 16/03 giờ VN",
  exp15, "2026-03-16T16:59:59.999Z");
check("0 ngày → không đặt hạn", quoteExpiryFrom(0, sentAt), null);
check("âm → không đặt hạn", quoteExpiryFrom(-5, sentAt), null);

check("trước hạn → chưa hết hiệu lực", isQuoteExpired(exp15, new Date("2026-03-16T10:00:00Z")), false);
check("ngay trước nửa đêm VN của ngày cuối → vẫn còn hiệu lực",
  isQuoteExpired(exp15, new Date("2026-03-16T16:59:00Z")), false);
check("qua nửa đêm VN → hết hiệu lực", isQuoteExpired(exp15, new Date("2026-03-16T17:30:00Z")), true);
check("không đặt hạn → không bao giờ hết", isQuoteExpired(null, new Date("2030-01-01T00:00:00Z")), false);
check("giá trị rác → không chặn khách oan", isQuoteExpired("khong-phai-ngay", sentAt), false);

check("còn 15 ngày ngay lúc gửi", quoteDaysLeft(exp15, sentAt), 15);
check("không đặt hạn → null ngày", quoteDaysLeft(null, sentAt), null);

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
