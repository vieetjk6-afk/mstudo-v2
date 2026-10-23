/* Kiểm thử file Excel của KẾ HOẠCH CƯỚI (src/lib/wedding-plan-export.ts).
 *
 * Vì sao đáng test: khách tải file này về để in, gửi bố mẹ, gửi người lo tiệc —
 * lỗi không nổ ra màn hình mà nằm im trong file:
 *   • Dòng TỔNG CỘNG của ngân sách lệch với trang (quên gói studio, cộng giá
 *     dự kiến thay vì giá chốt) → hai bên cầm hai con số khác nhau.
 *   • Số người sẽ đến trong file khác trang (bỏ qua phản hồi qua thiệp).
 *   • Tên khách có "&", "<" không thoát XML → Excel báo file hỏng.
 *   • Sheet trống (chưa có nhà cung cấp) vẫn xuất ra, hoặc DB cũ chưa có cột
 *     `extra` mà vẫn xuất sheet khách mời rỗng.
 */
import { xlsxZip } from "../../src/lib/xlsx.ts";
import { planFileName, planWorkbook } from "../../src/lib/wedding-plan-export.ts";
import { applyPlanOp, autoLinks, budgetSummary, guestSummary, newPlan } from "../../src/lib/wedding-plan.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
let n = 0;
const ids = () => `x${++n}`;
const op = (plan, o) => {
  const r = applyPlanOp(plan, o, ids);
  if (!r.ok) throw new Error(r.error);
  return r.plan;
};
const val = (cell) => (cell && typeof cell === "object" ? cell.v : cell);
const rowsOf = (sheet) => sheet.rows.map((r) => r.map(val));
/** Dòng đầu tiên có ô ở cột `col` bằng (hoặc bắt đầu bằng) `text`. */
const rowWith = (sheet, text, col = 1) => rowsOf(sheet).find((r) => typeof r[col] === "string" && r[col].startsWith(text));

let plan = newPlan({ weddingDate: "2027-01-16" });
plan = op(plan, { op: "set_budget_total", amount: 200_000_000 });
const party = plan.budget.find((b) => b.cat === "party");
plan = op(plan, { op: "set", list: "budget", id: party.id, patch: { estimate: 150_000_000, actual: 180_000_000, paid: 50_000_000, payer: "groom_family" } });
plan = op(plan, { op: "add", list: "guests", item: { name: "Gia đình chú Ba & cô Tư", group: "groom_family", count: 4, table: "1", gift: 2_000_000 } });
plan = op(plan, { op: "add", list: "guests", item: { name: "Bạn <Minh>", group: "groom_friends", table: "1" } });
plan = op(plan, { op: "add", list: "guests", item: { name: "Bác Hai", group: "bride_family", count: 2, rsvp: "no" } });
plan = op(plan, { op: "add", list: "day", item: { time: "08:30", title: "Lễ gia tiên nhà gái", place: "Nhà gái" } });
const auto = autoLinks({ studioName: "Mây", signed: true, shot: false, invitation: null, album: null, total: 30_000_000, paid: 10_000_000 });
const studioLine = { name: "Gói của Mây Studio", estimate: 30_000_000, paid: 10_000_000, due: "2026-12-01" };
const input = {
  plan, couple: "Nguyễn Bảo Ngọc & Trần Minh Khôi", studio: { name: "Mây Studio", phone: "0909000000" },
  auto, studioLine, studioDay: [{ id: "s1", time: "07:30", title: "Ê-kíp chụp có mặt", studio: true }],
  today: "2026-10-23", ext: true, exportedAt: "23/10/2026 10:00",
};

const wb = planWorkbook(input);
check("sheet theo phần có dữ liệu (chưa có nhà cung cấp, phong cách → không có sheet)",
  wb.map((s) => s.name), ["Tổng quan", "Việc cần làm", "Ngân sách", "Khách mời", "Sơ đồ bàn", "Ngày cưới"]);
check("tên sheet hợp lệ với Excel (≤31 ký tự, không []:*?/\\)", wb.every((s) => s.name.length <= 31 && !/[[\]:*?/\\]/.test(s.name)), true);
check("mọi sheet in ngang, vừa bề ngang trang", wb.every((s) => s.fitWidth), true);
check("khối đầu file: studio, SĐT, tiêu đề, tên đôi, ngày cưới (kèm âm lịch, còn bao ngày), thời điểm xuất",
  rowsOf(wb[0]).slice(0, 6).map((r) => r[0]),
  ["Mây Studio", "ĐT: 0909000000", "KẾ HOẠCH CƯỚI", "Nguyễn Bảo Ngọc & Trần Minh Khôi", "Ngày cưới: 16/01/2027 · âm lịch 09 tháng 12 năm Bính Ngọ · còn 85 ngày", "Xuất lúc 23/10/2026 10:00"]);

// Ngân sách: tổng khớp đúng con số trên trang (gói studio + giá chốt).
const budget = wb.find((s) => s.name === "Ngân sách");
const m = budgetSummary(plan.budget, studioLine, plan.budget_total);
const tot = rowWith(budget, "TỔNG CỘNG");
check("tổng ngân sách = trên trang: dự kiến, giá chốt, đã trả, còn phải trả", [tot[3], tot[4], tot[5], tot[6]], [m.estimate, m.actual, m.paid, m.owed]);
check("gói studio là dòng đầu, đọc từ hợp đồng", rowsOf(budget).find((r) => r[0] === 1)?.[2], "Gói của Mây Studio");
check("khoản có giá chốt: còn phải trả theo giá chốt", rowsOf(budget).find((r) => r[2] === party.name)?.[6], 130_000_000);
check("tiền là SỐ, không phải chữ", typeof tot[3], "number");
check("vượt ngân sách → ghi rõ 'Vượt', số dương", [m.over, rowWith(budget, "Vượt ngân sách")?.[3]], [true, m.cost - 200_000_000]);
check("chưa vượt → 'Còn lại'", rowWith(planWorkbook({ ...input, plan: { ...plan, budget_total: 500_000_000 } }).find((s) => s.name === "Ngân sách"), "Còn lại")?.[3], 500_000_000 - m.cost);

// Khách mời: số người khớp trang, kể cả phản hồi qua thiệp (chế độ cũ).
const guests = wb.find((s) => s.name === "Khách mời");
const gt = rowWith(guests, "TỔNG CỘNG");
check("khách: tổng người sẽ đến, tiền mừng", [gt[3], gt[8]], [guestSummary(plan.guests).people, 2_000_000]);
const minh = plan.guests.find((g) => g.name === "Bạn <Minh>");
const withReply = planWorkbook({ ...input, replies: { [minh.id]: { attending: true, num_guests: 3 } } });
const gRows = rowsOf(withReply.find((s) => s.name === "Khách mời"));
check("phản hồi qua thiệp (chế độ cũ) phủ lên: số người & trạng thái", gRows.find((r) => r[1] === "Bạn <Minh>").slice(3, 7), [3, "", "", "Sẽ dự (qua thiệp)"]);
check("bàn 1: 4 + 1 người, khách báo không dự không chiếm chỗ", rowsOf(wb.find((s) => s.name === "Sơ đồ bàn")).find((r) => r[0] === "1")?.[1], 5);

// Lịch trình gộp lịch hẹn studio, xếp theo giờ.
check("lịch trình: lịch hẹn studio xếp đúng giờ, có ghi (studio)",
  rowsOf(wb.find((s) => s.name === "Ngày cưới")).filter((r) => /^\d\d:\d\d$/.test(r[0])).map((r) => `${r[0]} ${r[1]}`),
  ["07:30 Ê-kíp chụp có mặt (studio)", "08:30 Lễ gia tiên nhà gái"]);

// Việc cần làm: đủ việc, việc tự xong theo dữ liệu studio tính là xong.
const tasks = wb.find((s) => s.name === "Việc cần làm");
check("đủ mọi việc", rowsOf(tasks).filter((r) => typeof r[0] === "number").length, plan.tasks.length);
check("'Chọn studio' tự xong khi đã ký hợp đồng", rowsOf(tasks).find((r) => r[4] === "" && r[6] === "✓" && /studio/i.test(r[3])) !== undefined, true);

// DB cũ chưa có cột extra: chỉ ba danh sách gốc.
check("DB chưa có cột extra → không có sheet khách mời / nhà cung cấp",
  planWorkbook({ ...input, ext: false }).map((s) => s.name), ["Tổng quan", "Việc cần làm", "Ngân sách", "Ngày cưới"]);

// Đủ phần: nhà cung cấp, phong cách & ảnh cần chụp.
let full = op(plan, { op: "add", list: "vendors", item: { cat: "venue", name: "Riverside Palace", quote: 150_000_000, status: "booked" } });
full = op(full, { op: "set_style", colors: ["#862828"], concept: "Đỏ rượu vang" });
full = op(full, { op: "template", list: "shots" });
check("đủ phần → thêm sheet nhà cung cấp, phong cách & ảnh",
  planWorkbook({ ...input, plan: full }).map((s) => s.name).slice(5), ["Nhà cung cấp", "Ngày cưới", "Phong cách & ảnh"]);

// File thật: dựng được, ký tự đặc biệt đã thoát.
const zip = xlsxZip(wb);
const xml = await zip.file("xl/worksheets/sheet4.xml").async("string");
check("XML in: sheetPr đứng đầu worksheet, pageSetup sau pageMargins (đúng thứ tự lược đồ)",
  [/<worksheet[^>]*>\s*<sheetPr><pageSetUpPr fitToPage="1"\/><\/sheetPr>\s*<dimension/.test(xml), /<pageMargins[^>]*\/>\s*<pageSetup [^>]*orientation="landscape" fitToWidth="1" fitToHeight="0"\/>/.test(xml)], [true, true]);
check("tên khách có & và < được thoát XML", [xml.includes("Gia đình chú Ba &amp; cô Tư"), xml.includes("Bạn &lt;Minh&gt;"), xml.includes("<Minh>")], [true, true, false]);
const buf = await zip.generateAsync({ type: "nodebuffer" });
check("dựng được file .xlsx", buf.length > 2000 && buf[0] === 0x50 && buf[1] === 0x4b, true);

check("tên file không dấu", planFileName("Nguyễn Bảo Ngọc & Trần Đình Minh Khôi"), "ke-hoach-cuoi-nguyen-bao-ngoc-tran-dinh-minh-khoi.xlsx");
check("tên trống → tên mặc định", planFileName("  "), "ke-hoach-cuoi.xlsx");

if (process.env.XUAT) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.env.XUAT, await xlsxZip(planWorkbook({ ...input, plan: full })).generateAsync({ type: "nodebuffer" }));
  console.log(`Đã ghi ${process.env.XUAT}`);
}

console.log(fail ? `\n${fail} kiểm thử HỎNG` : "\nTất cả kiểm thử đều qua.");
process.exit(fail ? 1 : 0);
