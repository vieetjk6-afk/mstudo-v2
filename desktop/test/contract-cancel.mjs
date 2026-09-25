/* Kiểm thử phần thuần của huỷ hợp đồng & dời lịch (src/lib/contract-cancel.ts).
 *
 * Vì sao đáng test: đây là con số TIỀN trả lại khách. Gợi ý sai theo hướng hoàn
 * nhiều là studio mất tiền nếu bấm xác nhận vội; sai theo hướng hoàn ít là cãi
 * nhau với khách. Mốc "đúng N ngày" là chỗ dễ lệch một ngày nhất.
 */
import {
  cancelQuote, cancelPolicyOf, cancelPolicyText, daysBetween, shiftDate,
  DEFAULT_CANCEL_POLICY, cancelClientMessage, rescheduleClientMessage,
} from "../../src/lib/contract-cancel.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const P = { earlyDays: 30, earlyPct: 50, latePct: 0 };

// ── Ngày ───────────────────────────────────────────────────────────────────
check("30 ngày", daysBetween("2026-09-01", "2026-10-01"), 30);
check("qua năm", daysBetween("2026-12-31", "2027-01-01"), 1);
check("ngày đã qua → âm", daysBetween("2026-09-10", "2026-09-01"), -9);
check("sai dạng → null", daysBetween("hôm nay", "2026-09-01"), null);
check("dời +7 ngày qua tháng", shiftDate("2026-09-28", 7), "2026-10-05");
check("dời lùi", shiftDate("2026-03-01", -1), "2026-02-28");

// ── Gợi ý tiền hoàn ────────────────────────────────────────────────────────
check("huỷ sớm hoàn 50%", cancelQuote({ collected: 10_000_000, eventDate: "2026-12-01", today: "2026-09-01", policy: P }),
  { daysBefore: 91, rule: "early", pct: 50, refund: 5_000_000, kept: 5_000_000 });
check("đúng 30 ngày vẫn là huỷ sớm", cancelQuote({ collected: 10_000_000, eventDate: "2026-10-01", today: "2026-09-01", policy: P }).rule, "early");
check("29 ngày là huỷ muộn", cancelQuote({ collected: 10_000_000, eventDate: "2026-09-30", today: "2026-09-01", policy: P }),
  { daysBefore: 29, rule: "late", pct: 0, refund: 0, kept: 10_000_000 });
check("ngày chụp đã qua → huỷ muộn", cancelQuote({ collected: 5_000_000, eventDate: "2026-08-01", today: "2026-09-01", policy: P }).rule, "late");
check("chưa có ngày → coi như huỷ sớm", cancelQuote({ collected: 4_000_000, eventDate: null, today: "2026-09-01", policy: P }),
  { daysBefore: null, rule: "early", pct: 50, refund: 2_000_000, kept: 2_000_000 });
check("làm tròn xuống nghìn", cancelQuote({ collected: 3_333_333, eventDate: null, today: "2026-09-01", policy: P }).refund, 1_666_000);
check("chưa thu đồng nào → hoàn 0", cancelQuote({ collected: 0, eventDate: null, today: "2026-09-01", policy: P }).refund, 0);
check("số đã thu âm (hoàn quá tay) → 0", cancelQuote({ collected: -500_000, eventDate: null, today: "2026-09-01", policy: P }).refund, 0);
check("hoàn 100% không vượt số đã thu",
  cancelQuote({ collected: 7_500_000, eventDate: null, today: "2026-09-01", policy: { earlyDays: 0, earlyPct: 100, latePct: 100 } }),
  { daysBefore: null, rule: "early", pct: 100, refund: 7_500_000, kept: 0 });

// ── Chính sách đọc từ DB ───────────────────────────────────────────────────
check("chưa chạy migration → mặc định", cancelPolicyOf(null), DEFAULT_CANCEL_POLICY);
check("giá trị lạ bị kẹp", cancelPolicyOf({ cancel_early_days: 999, cancel_early_refund_pct: 150, cancel_late_refund_pct: -5 }),
  { earlyDays: 365, earlyPct: 100, latePct: 0 });
check("câu chính sách", cancelPolicyText(P),
  "Huỷ trước ngày chụp từ 30 ngày trở lên: hoàn 50% số tiền đã thanh toán. Huỷ muộn hơn: studio giữ toàn bộ số tiền đã thanh toán.");

// ── Tin nhắn ───────────────────────────────────────────────────────────────
check("tin huỷ có số hoàn", cancelClientMessage({ name: "Lan", title: "Cưới", refund: "5.000.000đ", studio: "ABC" }).includes("hoàn lại cho anh/chị: 5.000.000đ"), true);
check("tin huỷ không hoàn", cancelClientMessage({ refund: null }).includes("không được hoàn lại"), true);
check("tin dời lịch", rescheduleClientMessage({ name: "Lan", title: "Cưới", oldDate: "01/10/2026", newDate: "15/11/2026", newTime: "07:00", fee: null }),
  "Chào Lan,\nStudio xác nhận đã dời lịch \"Cưới\" từ 01/10/2026 sang 15/11/2026 lúc 07:00.");

if (fail) {
  console.error(`\n${fail} kiểm tra hỏng.`);
  process.exit(1);
}
console.log("\nTất cả kiểm tra đều qua.");
