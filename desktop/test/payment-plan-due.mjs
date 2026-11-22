/* Hạn cọc mặc định (src/lib/payment-plan-due.ts) — đợt cọc không có hạn thì
 * nhắc thu hằng ngày không bao giờ chạy. */
import { defaultDepositDue } from "../../src/lib/payment-plan-due.ts";
let fail = 0;
const check = (n, g, w) => { const ok = g === w; if (!ok) fail++; console.log(`${ok ? "✓" : "✗"} ${n}${ok ? "" : ` — nhận ${g}, cần ${w}`}`); };
check("không có ngày chụp → +3 ngày", defaultDepositDue("2026-11-22"), "2026-11-25");
check("chụp xa → +3 ngày", defaultDepositDue("2026-11-22", "2026-12-20"), "2026-11-25");
check("chụp sát → ngày trước buổi chụp", defaultDepositDue("2026-11-22", "2026-11-24"), "2026-11-23");
check("chụp ngày mai → hạn hôm nay", defaultDepositDue("2026-11-22", "2026-11-23"), "2026-11-22");
check("ngày chụp đã qua → không lùi trước hôm nay", defaultDepositDue("2026-11-22", "2026-11-01"), "2026-11-22");
check("qua tháng", defaultDepositDue("2026-11-29"), "2026-12-02");
if (fail) process.exit(1);
console.log("\nTất cả đạt.");
