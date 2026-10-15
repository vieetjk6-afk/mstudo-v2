/* Kiểm thử đổi ngày dương → âm lịch (src/lib/lunar.ts).
 *
 * Phần đổi ngày có sẵn từ trước (lịch studio); bài này khoá thêm dòng chữ
 * "Tức ngày … năm …" in trên thiệp cưới.
 *
 * Vì sao đáng test: dòng "Tức ngày … năm …" in ngay dưới ngày cưới trên thiệp,
 * cả họ hàng đọc. Lệch một ngày (sai múi giờ, sai tháng nhuận) là nhà trai nhà
 * gái gọi hỏi lại — và không ai tin thiệp nữa. Các mốc dưới đây là ngày Tết,
 * Trung thu, tháng nhuận đã biết, cộng mấy ngày cưới in sẵn trên các mẫu thiệp
 * tham khảo.
 */
import { canChiYear, lunarText, solarToLunar } from "../../src/lib/lunar.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
const L = (day, month, year, leap = false) => ({ day, month, year, leap });

/* ── Mùng 1 Tết ─────────────────────────────────────────────────────────── */
check("Tết Giáp Thìn 10/02/2024", solarToLunar("2024-02-10"), L(1, 1, 2024));
check("Tết Ất Tỵ 29/01/2025", solarToLunar("2025-01-29"), L(1, 1, 2025));
check("Tết Bính Ngọ 17/02/2026", solarToLunar("2026-02-17"), L(1, 1, 2026));
check("Tết Đinh Mùi 06/02/2027", solarToLunar("2027-02-06"), L(1, 1, 2027));
check("giao thừa 16/02/2026 vẫn là năm cũ", solarToLunar("2026-02-16"), L(29, 12, 2025));

/* ── Trung thu, tháng nhuận ─────────────────────────────────────────────── */
check("Trung thu 2025 (06/10)", solarToLunar("2025-10-06"), L(15, 8, 2025));
check("Trung thu 2026 (25/09)", solarToLunar("2026-09-25"), L(15, 8, 2026));
check("2025 có tháng 6 nhuận (25/07)", solarToLunar("2025-07-25"), L(1, 6, 2025, true));
check("tháng 6 thường 2025 (25/06)", solarToLunar("2025-06-25"), L(1, 6, 2025));

/* ── Ngày cưới in trên các mẫu tham khảo ─────────────────────────────────── */
check("06/03/2026", lunarText("2026-03-06"), "Tức ngày 18 tháng 01 năm Bính Ngọ");
check("21/03/2026", lunarText("2026-03-21"), "Tức ngày 03 tháng 02 năm Bính Ngọ");
check("18/10/2026", lunarText("2026-10-18"), "Tức ngày 09 tháng 09 năm Bính Ngọ");
check("26/10/2025", lunarText("2025-10-26"), "Tức ngày 06 tháng 09 năm Ất Tỵ");
check("01/11/2025", lunarText("2025-11-01"), "Tức ngày 12 tháng 09 năm Ất Tỵ");
check("30/10/2025", lunarText("2025-10-30"), "Tức ngày 10 tháng 09 năm Ất Tỵ");
check("20/12/2026 (tháng 11 âm)", lunarText("2026-12-20"), "Tức ngày 12 tháng 11 năm Bính Ngọ");
check("tháng nhuận ghi rõ", lunarText("2025-07-25"), "Tức ngày 01 tháng 06 nhuận năm Ất Tỵ");

/* ── Can chi, chuỗi lạ ───────────────────────────────────────────────────── */
check("can chi 2024–2027", [2024, 2025, 2026, 2027].map(canChiYear), ["Giáp Thìn", "Ất Tỵ", "Bính Ngọ", "Đinh Mùi"]);
check("ISO kèm giờ vẫn đọc đúng ngày", lunarText("2026-03-06T17:00:00+07:00"), "Tức ngày 18 tháng 01 năm Bính Ngọ");
check("tiền tố tuỳ chọn", lunarText("2026-03-06", "Nhằm ngày"), "Nhằm ngày 18 tháng 01 năm Bính Ngọ");
check("trống → rỗng", lunarText(""), "");
check("rác → rỗng", lunarText("hôm nay"), "");

console.log(fail === 0 ? "\nTất cả OK" : `\n${fail} bài HỎNG`);
process.exit(fail === 0 ? 0 : 1);
