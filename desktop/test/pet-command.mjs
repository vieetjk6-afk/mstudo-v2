/* Kiểm thử bộ hiểu câu lệnh của Bé Máy Ảnh (src/lib/pet-command.ts).
 *
 * Vì sao đáng test: câu lệnh gõ tay muôn kiểu (có dấu / không dấu, thêm "bé
 * ơi", "giúp mình", danh xưng "chị", "anh"…). Hiểu nhầm "mở" thành "tạo" là
 * mở nhầm màn tạo mới; lấy nhầm từ đệm vào phần tên là tìm không ra khách.
 */
import { fold, matchScore, parseCommand, queryTerms } from "../../src/lib/pet-command.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
const go = (s) => { const c = parseCommand(s); return c.kind === "go" ? c.href : c; };
const find = (s) => { const c = parseCommand(s); return c.kind === "search" ? [c.entity, c.query] : c; };

check("bỏ dấu", fold("  Đặng   Thị Ánh "), "dang thi anh");

// ── Tạo mới ──
check("tạo hợp đồng", go("Tạo hợp đồng"), "/dashboard/studio/contracts/new");
check("không dấu", go("tao hop dong"), "/dashboard/studio/contracts/new");
check("viết tắt hd", go("tạo hd"), "/dashboard/studio/contracts/new");
check("thêm từ đệm", go("bé ơi tạo giúp mình một báo giá nha"), "/dashboard/studio/quotes/new");
check("tạo album", go("tạo album mới"), "/dashboard/albums/new");
check("tạo hợp đồng cho khách vẫn là tạo", go("tạo hợp đồng cho chị Lan"), "/dashboard/studio/contracts/new");

// ── Mở theo tên ──
check("mở hợp đồng chị Lan", find("Mở hợp đồng chị Lan"), ["contract", "chị Lan"]);
check("xem báo giá theo mã", find("xem báo giá BG-2026-003"), ["quote", "BG-2026-003"]);
check("mở album, bỏ 'của'", find("mở album của Minh Thư"), ["album", "Minh Thư"]);
check("tìm hợp đồng tên ...", find("tìm hợp đồng tên Nguyễn Văn A"), ["contract", "Nguyễn Văn A"]);
check("gõ thẳng tên → tìm mọi thứ", find("chị Lan"), ["all", "chị Lan"]);
check("mở + tên, không nêu loại", find("mở Minh Thư"), ["all", "Minh Thư"]);

// ── Mở danh sách / màn ──
check("mở hợp đồng (không tên) → danh sách", go("mở hợp đồng"), "/dashboard/studio/contracts");
check("lịch", go("lịch"), "/dashboard/studio/calendar");
check("lịch studio thắng lịch", go("mở lịch studio"), "/dashboard/studio/calendar?tab=studio");
check("đặt lịch không bị hiểu thành lịch", go("xem đặt lịch"), "/dashboard/studio/bookings");
check("thu chi", go("mở thu chi"), "/dashboard/studio/reports");
check("hộp thư", go("tin nhắn"), "/dashboard/studio/inbox");

// ── Khác ──
check("cho ăn", parseCommand("cho bé ăn").kind, "feed");
check("rỗng", parseCommand("   ").kind, "unknown");
check("chỉ có động từ", parseCommand("tạo").kind, "unknown");

// ── So khớp ──
check("bỏ danh xưng", queryTerms("chị Lan"), ["lan"]);
check("chỉ có danh xưng thì giữ", queryTerms("anh"), ["anh"]);
check("khớp không dấu", matchScore(["lan"], ["Hợp đồng cưới", "Chị Lan"]) > 0, true);
check("thiếu một từ → không khớp", matchScore(["minh", "thu"], ["Minh Anh"]), 0);
check(
  "trùng nguyên tên điểm cao hơn khớp một phần",
  matchScore(["minh", "thu"], ["Minh Thư"]) > matchScore(["minh", "thu"], ["Album Minh Anh - Thu Hà"]),
  true,
);
check("khớp mã hợp đồng", matchScore(queryTerms("HD-2026-014"), ["HD-2026-014", "Cưới"]) > 0, true);

if (fail) {
  console.error(`\n${fail} kiểm thử hỏng`);
  process.exit(1);
}
console.log("\nTất cả đạt.");
