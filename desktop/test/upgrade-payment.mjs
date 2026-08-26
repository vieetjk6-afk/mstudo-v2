/* Kiểm thử thanh toán gói dịch vụ MStudo: số tiền chốt phía máy chủ, mã nội
 * dung chuyển khoản, và bộ trạng thái giao dịch.
 *
 * Vì sao đáng test:
 *
 *  • Số tiền là con số IN LÊN MÃ QR. Tính sai theo hướng thấp là bán gói Studio
 *    giá vài nghìn; sai theo hướng cao là studio chuyển thừa rồi đòi lại. Trước
 *    đây con số này do TRÌNH DUYỆT gửi lên — sửa một dòng JSON là mua rẻ.
 *
 *  • Mã nội dung là thứ DUY NHẤT admin dùng để dò sao kê. Trùng mã giữa hai đơn
 *    hoặc chứa ký tự đọc nhầm (0/O, 1/I/L) là xác nhận nhầm người — nâng gói cho
 *    studio chưa trả tiền và bỏ rơi studio đã trả.
 *
 *  • Bộ trạng thái phải PHỦ KÍN: thiếu một nhãn là màn admin hiện chuỗi thô
 *    ("awaiting_confirm") ngay chỗ quyết định có nhận tiền hay không.
 *
 * Nạp thẳng code thật ở src/lib/.
 */
import {
  upgradeAmount,
  newUpgradePaymentCode,
  isUpgradePaymentStatus,
  UPGRADE_PAYMENT_LABEL,
  UPGRADE_PAYMENT_TONE,
} from "../../src/lib/upgrade-payment.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

// ── Số tiền phải trả ───────────────────────────────────────────────────────
check("không giảm giá → nguyên giá", upgradeAmount(300_000, 0), 300_000);
check("giảm 50%", upgradeAmount(3_000_000, 50), 1_500_000);
check("giảm 100% → 0đ (kích hoạt luôn, không phải chuyển khoản)", upgradeAmount(999_000, 100), 0);
check("làm tròn tới đồng", upgradeAmount(999_000, 33), 669_330);
// Mọi đầu vào rác đều phải quy về số hợp lệ — đây là số in lên mã QR.
check("giảm quá 100% vẫn kẹp về 0đ", upgradeAmount(500_000, 130), 0);
check("giảm âm coi như không giảm", upgradeAmount(500_000, -20), 500_000);
check("giá âm → 0đ", upgradeAmount(-500_000, 0), 0);
check("giá không phải số → 0đ", upgradeAmount(Number("abc"), 10), 0);
check("giảm không phải số → không giảm", upgradeAmount(100_000, Number("abc")), 100_000);

// ── Mã nội dung chuyển khoản ───────────────────────────────────────────────
const codes = Array.from({ length: 500 }, () => newUpgradePaymentCode());
check("mã có tiền tố MS- và đủ 4 ký tự", codes.every((c) => /^MS-[A-Z0-9]{4}$/.test(c)), true);
// Admin dò sao kê BẰNG MẮT: 0/O và 1/I/L nhìn giống nhau trên bản in.
check("mã không chứa ký tự dễ đọc nhầm (0 O 1 I L)", codes.every((c) => !/[01OIL]/.test(c.slice(3))), true);
check("hai mã liên tiếp khác nhau", newUpgradePaymentCode() !== newUpgradePaymentCode(), true);

// ── Bộ trạng thái ──────────────────────────────────────────────────────────
const STATES = ["none", "awaiting_confirm", "paid", "failed"];
check("mọi trạng thái đều có nhãn tiếng Việt", STATES.every((s) => !!UPGRADE_PAYMENT_LABEL[s]), true);
check("mọi trạng thái đều có màu", STATES.every((s) => !!UPGRADE_PAYMENT_TONE[s]), true);
check("không có nhãn thừa cho trạng thái không tồn tại", Object.keys(UPGRADE_PAYMENT_LABEL).sort(), [...STATES].sort());
check("nhận trạng thái hợp lệ", STATES.every(isUpgradePaymentStatus), true);
check("chặn trạng thái lạ", isUpgradePaymentStatus("refunded"), false);
check("chặn null", isUpgradePaymentStatus(null), false);
// "Đã nhận tiền" và "chờ xác nhận" KHÔNG được lẫn nhau — đó là ranh giới giữa
// đã nâng gói và chưa.
check("chờ xác nhận khác đã nhận tiền", UPGRADE_PAYMENT_LABEL.awaiting_confirm !== UPGRADE_PAYMENT_LABEL.paid, true);

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
