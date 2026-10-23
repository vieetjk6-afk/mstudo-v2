/* Kiểm thử luật của KẾ HOẠCH CƯỚI trên cổng khách (/portal/<token>/ke-hoach).
 *
 * Vì sao đáng test: mọi thao tác đi thẳng từ trình duyệt khách lên máy chủ, và
 * trang khách dùng CHÍNH `applyPlanOp` để hiện trước kết quả. Luật lệch một chút
 * là khách thấy "đã lưu" một thứ máy chủ không lưu, một ô tiền gõ chữ làm hỏng
 * cả tổng ngân sách, hoặc bàn tiệc báo đủ chỗ trong khi đã vượt. Còn luật "hợp
 * đồng nào có kế hoạch cưới" mà sai thì khách chụp kỷ yếu "cuối cấp" nhận một
 * trang lên kế hoạch cưới.
 *
 * Nạp thẳng code thật ở src/lib/wedding-plan.ts.
 */
import {
  applyPlanOp, autoLinks, budgetSummary, cleanDate, cleanTime, currentWhen, daysUntil, defaultTasks,
  groupTasks, guestSummary, isWeddingPackage, lineCost, mergeDay, newPlan, normalizePlan, opNeedsExtra,
  payerBreakdown, planProgress, planToRow, plannerEnabled, shootsWeddingDay, tableSummary, tablesNeeded,
  taskDone, taskStats, upcoming, whenDue, PLAN_LIMITS,
} from "../../src/lib/wedding-plan.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
let n = 0;
const ids = () => `x${++n}`;
const apply = (plan, op) => applyPlanOp(plan, op, ids);
const must = (r) => {
  if (!r.ok) throw new Error(`thao tác hỏng: ${r.error}`);
  return r.plan;
};
const blank = () => normalizePlan(null);
const add = (plan, list, item) => must(apply(plan, { op: "add", list, item }));

/* ── Hợp đồng nào có kế hoạch cưới ───────────────────────────────────────── */
check("prewedding → có", isWeddingPackage({ shootType: "prewedding" }), true);
check("trọn gói ngày cưới → có", isWeddingPackage({ shootType: "wedding" }), true);
check("PSC → có", isWeddingPackage({ shootType: "psc" }), true);
check("dịch vụ tự đặt 'Phóng sự cưới' (loại = other) → có", isWeddingPackage({ shootType: "other", serviceName: "Phóng sự cưới" }), true);
check("makeup cô dâu → có", isWeddingPackage({ shootType: "makeup", title: "Makeup cô dâu ngày cưới" }), true);
check("hạng mục 'Chụp ăn hỏi' → có", isWeddingPackage({ shootType: "photo", itemNames: ["Chụp ăn hỏi nhà gái"] }), true);
check("chụp gia đình → không", isWeddingPackage({ shootType: "photo", title: "Chụp ảnh gia đình" }), false);
check("kỷ yếu 'cuối cấp' (bỏ dấu cũng ra 'cuoi') → không", isWeddingPackage({ shootType: "photo", title: "Kỷ yếu cuối cấp 12A1" }), false);
check("tiệc cuối năm công ty → không", isWeddingPackage({ shootType: "video", title: "Quay tiệc cuối năm công ty" }), false);
check("chữ tổ hợp (bàn phím iPhone) vẫn nhận", isWeddingPackage({ shootType: "photo", title: "Ảnh cưới Đà Lạt".normalize("NFD") }), true);

check("studio bật riêng → có, kể cả gói không phải cưới", plannerEnabled({ shootType: "photo", toggle: true }), true);
check("studio tắt riêng → không, kể cả gói cưới", plannerEnabled({ shootType: "wedding", toggle: false }), false);
check("theo gói: gói cưới → có", plannerEnabled({ shootType: "prewedding", toggle: null }), true);
check("theo gói: đã có kế hoạch thì giữ, dù studio đổi tên gói", plannerEnabled({ shootType: "photo", hasPlan: true }), true);

check("prewedding: ngày hợp đồng là ngày CHỤP, không phải ngày cưới", shootsWeddingDay({ shootType: "prewedding", title: "Prewedding phóng sự" }), false);
check("phóng sự cưới: ngày hợp đồng là ngày cưới", shootsWeddingDay({ shootType: "psc" }), true);

/* ── Kế hoạch mới ────────────────────────────────────────────────────────── */
{
  const p = newPlan({ weddingDate: "2027-01-16" });
  check("điền sẵn ngày cưới", p.wedding_date, "2027-01-16");
  check("có việc mẫu; lịch trình, đồ cần mang, ảnh cần chụp để TRỐNG", [p.tasks.length > 20, p.day.length, p.packing.length, p.shots.length], [true, 0, 0, 0]);
  check("mã việc không trùng", new Set(p.tasks.map((t) => t.id)).size, p.tasks.length);
  check("ngân sách mẫu tiền = 0", p.budget.every((b) => b.estimate === 0 && b.actual === 0 && b.paid === 0), true);
  check("vài việc quan trọng gắn ưu tiên cao", p.tasks.filter((t) => t.priority === "high").length >= 3, true);
  const row = planToRow(p);
  check("ghi xuống DB rồi đọc lại: y nguyên (không rơi dòng nào)", normalizePlan(row), p);
  check("DB chưa có cột extra: không ghi cột đó", "extra" in planToRow(p, false), false);
  check("mặc định 10 người / bàn", p.settings.table_size, 10);
}
{
  const pre = defaultTasks().find((t) => t.link === "shoot");
  const psc = defaultTasks({ shootOnWeddingDay: true }).find((t) => t.link === "shoot");
  check("prewedding: việc chụp ở mốc 3–6 tháng", pre.when, "m6");
  check("phóng sự: việc chụp nằm ở ngày cưới", psc.when, "d0");
}
check("ngày không có thật → không điền", newPlan({ weddingDate: "2027-02-31" }).wedding_date, null);

/* ── Mốc thời gian ───────────────────────────────────────────────────────── */
check("hạn mốc 3–6 tháng = trước 90 ngày", whenDue("2027-01-16", "m6"), "2026-10-18");
check("hạn 'tuần cuối' = hôm trước", whenDue("2027-01-01", "w1"), "2026-12-31");
check("sau cưới = 2 tuần sau", whenDue("2026-12-25", "after"), "2027-01-08");
check("chưa có ngày cưới → không có hạn", whenDue(null, "m3"), null);
check("đếm ngược qua năm nhuận", daysUntil("2028-03-01", "2028-02-27"), 3);
check("100 ngày nữa → đang ở mốc 3–6 tháng", currentWhen("2027-01-31", "2026-10-23"), "m6");
check("20 ngày nữa → mốc 2–4 tuần", currentWhen("2026-11-12", "2026-10-23"), "w4");
check("đúng ngày cưới", currentWhen("2026-10-23", "2026-10-23"), "d0");
check("đã cưới lâu rồi → sau cưới", currentWhen("2026-01-01", "2026-10-23"), "after");

/* ── Thao tác chung: việc cần làm ────────────────────────────────────────── */
{
  let p = add(blank(), "tasks", { id: "abc123", title: "  Đặt   bánh cưới  ", when: "w4", owner: "bride", priority: "high", due: "2026-12-01" });
  check("dùng đúng mã trình duyệt gửi (để bản hiện trước khớp bản lưu)", p.tasks[0].id, "abc123");
  check("gọn khoảng trắng, giữ người lo / ưu tiên / hạn riêng", [p.tasks[0].title, p.tasks[0].owner, p.tasks[0].priority, p.tasks[0].due], ["Đặt bánh cưới", "bride", "high", "2026-12-01"]);
  p = add(p, "tasks", { id: "abc123", title: "Trùng mã", when: "w4" });
  check("mã trùng → máy chủ cấp mã khác, không đè dòng cũ", [p.tasks.length, p.tasks[1].id !== "abc123"], [2, true]);
  check("mốc lạ → về mốc mặc định", add(blank(), "tasks", { title: "x", when: "hôm qua" }).tasks[0].when, "m3");
  check("người lo lạ → bỏ", "owner" in add(blank(), "tasks", { title: "x", owner: "hàng xóm" }).tasks[0], false);
  check("khách tự thêm không gắn được link dữ liệu studio", "link" in add(blank(), "tasks", { title: "x", link: "pay" }).tasks[0], false);
  check("tiêu đề trống → từ chối", apply(blank(), { op: "add", list: "tasks", item: { title: "   " } }), { ok: false, error: "empty" });
  p = must(apply(p, { op: "set", list: "tasks", id: "abc123", patch: { done: true, note: "Tiệm Hạnh Phúc\n0909 000 000" } }));
  check("tick xong + ghi chú giữ xuống dòng", [p.tasks[0].done, p.tasks[0].note], [true, "Tiệm Hạnh Phúc\n0909 000 000"]);
  p = must(apply(p, { op: "set", list: "tasks", id: "abc123", patch: { note: "", due: "", owner: "" } }));
  check("xoá ghi chú / hạn riêng / người lo", ["note", "due", "owner"].map((k) => k in p.tasks[0]), [false, false, false]);
  check("sửa không đổi được mã", must(apply(p, { op: "set", list: "tasks", id: "abc123", patch: { id: "zzz" } })).tasks[0].id, "abc123");
  check("sửa để trống tiêu đề → từ chối", apply(p, { op: "set", list: "tasks", id: "abc123", patch: { title: "" } }), { ok: false, error: "empty" });
  check("sửa dòng máy khác vừa xoá → báo 'gone'", apply(p, { op: "set", list: "tasks", id: "khong-co", patch: { done: true } }), { ok: false, error: "gone" });
  const before = JSON.stringify(p);
  apply(p, { op: "remove", list: "tasks", id: "abc123" });
  check("không sửa bản cũ (trang khách giữ bản máy chủ để áp lại)", JSON.stringify(p), before);
  check("tiêu đề quá dài bị cắt", add(blank(), "tasks", { title: "a".repeat(999) }).tasks[0].title.length, PLAN_LIMITS.title);
}
{
  const linked = { ...blank(), tasks: defaultTasks() };
  const pay = linked.tasks.find((t) => t.link === "pay");
  const p = must(apply(linked, { op: "set", list: "tasks", id: pay.id, patch: { title: "Trả nốt studio", link: null } }));
  check("sửa việc gắn link: link dữ liệu studio vẫn giữ", p.tasks.find((t) => t.id === pay.id).link, "pay");
}
{
  const many = { ...blank(), tasks: Array.from({ length: PLAN_LIMITS.tasks }, (_, i) => ({ id: `t${i}`, title: "x", when: "m3", done: false })) };
  check("chặn số việc", apply(many, { op: "add", list: "tasks", item: { title: "thêm" } }), { ok: false, error: "too_many" });
}
check("danh sách lạ → từ chối", apply(blank(), { op: "add", list: "profiles", item: { title: "x" } }), { ok: false, error: "bad_op" });
check("thao tác lạ → từ chối", apply(blank(), { op: "drop_table" }), { ok: false, error: "bad_op" });
check("không phải object → từ chối", apply(blank(), "add"), { ok: false, error: "bad_op" });

{
  const p = { ...blank(), wedding_date: "2026-12-20", tasks: [
    { id: "a", title: "Đã xong", when: "m12", done: true },
    { id: "b", title: "Quá hạn theo mốc", when: "m12", done: false },
    { id: "c", title: "Hạn riêng còn xa", when: "m12", done: false, due: "2026-12-15" },
    { id: "d", title: "Studio tự xong", when: "m3", done: false, link: "studio" },
  ] };
  const s = taskStats(p.tasks, { studio: { done: true } }, p.wedding_date, "2026-10-23");
  check("thống kê: tổng · xong (kể cả tự xong) · quá hạn (hạn riêng thắng hạn mốc)", [s.total, s.done, s.overdue, s.pct], [4, 2, 1, 50]);
}

/* ── Ngày cưới, ngân sách ────────────────────────────────────────────────── */
check("đặt ngày cưới", must(apply(blank(), { op: "set_date", date: "2027-05-20" })).wedding_date, "2027-05-20");
check("ngày sai → từ chối", apply(blank(), { op: "set_date", date: "20/05/2027" }), { ok: false, error: "bad_date" });
check("bỏ ngày cưới", must(apply({ ...blank(), wedding_date: "2027-05-20" }, { op: "set_date", date: "" })).wedding_date, null);
check("ngân sách tổng: chữ lẫn số → lấy số", must(apply(blank(), { op: "set_budget_total", amount: "300.000.000đ" })).budget_total, 300000000);
check("ngân sách âm → 0", must(apply(blank(), { op: "set_budget_total", amount: -5 })).budget_total, 0);
check("tiền lẻ → làm tròn", must(apply(blank(), { op: "set_budget_total", amount: 1500.6 })).budget_total, 1501);
{
  let p = add(blank(), "budget", { id: "bb1", cat: "party", name: "", estimate: 120000000, payer: "groom_family" });
  check("khoản không tên → lấy tên nhóm", p.budget[0].name, "Tiệc cưới");
  check("nhóm lạ → Khác, nhưng phải có tên", apply(blank(), { op: "add", list: "budget", item: { cat: "zzz", name: "" } }), { ok: false, error: "empty" });
  p = must(apply(p, { op: "set", list: "budget", id: "bb1", patch: { actual: 135000000, paid: 30000000, due: "2026-12-01" } }));
  check("giá chốt thắng dự kiến", lineCost(p.budget[0]), 135000000);
  p = add(p, "budget", { id: "bb2", cat: "ring", name: "Nhẫn", estimate: 20000000, paid: 25000000, payer: "groom" });
  const s = budgetSummary(p.budget, { name: "Gói chụp", estimate: 25000000, paid: 10000000 }, 170000000);
  check("tổng: dự kiến · chi phí · đã trả · còn nợ · còn lại", [s.estimate, s.cost, s.paid, s.owed, s.left, s.over], [165000000, 180000000, 65000000, 120000000, -10000000, true]);
  check("khoản trả dư không bù khoản khác khi tính còn nợ", s.owed, (135000000 - 30000000) + 0 + (25000000 - 10000000));
  check("thanh tiến độ kẹp 100%", s.pct, 100);
  check("chưa đặt ngân sách tổng → không có 'còn lại'", budgetSummary(p.budget, null, 0).left, null);
  check("ai chi bao nhiêu (theo chi phí)", payerBreakdown(p.budget).map((x) => [x.payer, x.amount, x.pct]), [["groom_family", 135000000, 87], ["groom", 20000000, 13]]);
  check("người chi lạ → bỏ", "payer" in must(apply(p, { op: "set", list: "budget", id: "bb1", patch: { payer: "ngân hàng" } })).budget[0], false);
}

/* ── Khách mời & xếp bàn ─────────────────────────────────────────────────── */
{
  let p = must(apply(blank(), { op: "add_many", list: "guests", items: [
    { name: "Gia đình chú Ba", group: "groom_family", count: 4, table: "1" },
    { name: "Bạn Minh", group: "groom_friends", table: "1", rsvp: "yes" },
    { name: "Cô Lan", group: "bride_family", count: 2, table: "2", rsvp: "no" },
    { name: "   " },
    { name: "Anh Tú", phone: "0909 123 456", gift: "1.000.000", thanked: true, invited: true },
  ] }));
  check("thêm hàng loạt: bỏ dòng trống", p.guests.map((g) => g.name), ["Gia đình chú Ba", "Bạn Minh", "Cô Lan", "Anh Tú"]);
  check("nhóm lạ → Khác, số người mặc định 1, SĐT chỉ giữ số", [p.guests[3].group, p.guests[3].count, p.guests[3].phone], ["other", 1, "0909123456"]);
  check("số người kẹp 1–50", add(blank(), "guests", { name: "x", count: 999 }).guests[0].count, 50);
  const replies = { [p.guests[0].id]: { attending: true, num_guests: 5 } };
  const s = guestSummary(p.guests, replies);
  check("khách: người sẽ đến (bỏ người báo không dự) · đã xác nhận · chưa phản hồi", [s.people, s.yes, s.no, s.pending], [7, 6, 2, 1]);
  check("phản hồi qua thiệp thắng ghi tay, và lấy số người trong phản hồi", s.yes, 5 + 1);
  check("đã xếp / chưa xếp bàn", [s.seated, s.unseated], [6, 1]);
  check("tiền mừng · đã cảm ơn · đã gửi thiệp", [s.gifts, s.thanked, s.invited], [1000000, 1, 1]);
  const t = tableSummary(p.guests, replies, 5);
  check("bàn: khách không dự không chiếm chỗ; vượt sức chứa thì báo", t.map((x) => [x.table, x.people, x.over]), [["1", 6, true]]);
  check("bàn sắp theo số: 2 trước 10", tableSummary([
    { id: "a", name: "a", group: "other", count: 1, invited: false, rsvp: "pending", table: "10", gift: 0, thanked: false },
    { id: "b", name: "b", group: "other", count: 1, invited: false, rsvp: "pending", table: "2", gift: 0, thanked: false },
  ], {}, 10).map((x) => x.table), ["2", "10"]);
  check("ước số bàn", tablesNeeded(41, 10), 5);
  p = must(apply(p, { op: "set_settings", table_size: 100, guests_expected: "300" }));
  check("cài đặt: kẹp số người / bàn, số khách dự kiến", [p.settings.table_size, p.settings.guests_expected], [30, 300]);
  const full = { ...blank(), guests: Array.from({ length: PLAN_LIMITS.guests - 1 }, (_, i) => ({ id: `g${i}`, name: "x", group: "other", count: 1, invited: false, rsvp: "pending", gift: 0, thanked: false })) };
  check("thêm hàng loạt dừng ở trần danh sách", must(apply(full, { op: "add_many", list: "guests", items: [{ name: "a" }, { name: "b" }] })).guests.length, PLAN_LIMITS.guests);
}

/* ── Nhà cung cấp, đội hỗ trợ, đồ cần mang, ảnh cần chụp, phong cách ───── */
{
  const v = add(blank(), "vendors", { name: "Riverside Palace", cat: "venue", quote: "150.000.000", link: "riverside.vn", status: "booked" }).vendors[0];
  check("nhà cung cấp: báo giá, link tự thêm https, đã chốt", [v.quote, v.link, v.status], [150000000, "https://riverside.vn/", "booked"]);
  {
    // `link` của nhà cung cấp là đường dẫn web — khác `link` dữ liệu studio của việc cần làm.
    const p0 = add(blank(), "vendors", { id: "v1", name: "Hoa Ngọc Lan", link: "hoa.vn" });
    check("sửa được link nhà cung cấp", must(apply(p0, { op: "set", list: "vendors", id: "v1", patch: { link: "https://hoangoclan.vn" } })).vendors[0].link, "https://hoangoclan.vn/");
  }
  check("link javascript: → bỏ", "link" in add(blank(), "vendors", { name: "x", link: "javascript:alert(1)" }).vendors[0], false);
  check("trạng thái lạ → đang cân nhắc", add(blank(), "vendors", { name: "x", status: "zzz" }).vendors[0].status, "consider");
  const person = add(blank(), "people", { name: "Hà", role: "Phù dâu", side: "bride", phone: "abc" }).people[0];
  check("đội hỗ trợ: SĐT rác bị bỏ", [person.role, person.side, "phone" in person], ["Phù dâu", "bride", false]);
  let p = must(apply(blank(), { op: "template", list: "packing" }));
  check("đồ cần mang mẫu", [p.packing.length > 10, p.packing.every((x) => !x.packed && x.qty >= 1)], [true, true]);
  check("mẫu chỉ khi danh sách còn trống", apply(p, { op: "template", list: "packing" }), { ok: false, error: "not_empty" });
  p = must(apply(p, { op: "set", list: "packing", id: p.packing[0].id, patch: { packed: true, qty: 0 } }));
  check("đã xếp; số lượng kẹp ≥ 1", [p.packing[0].packed, p.packing[0].qty], [true, 1]);
  const shots = must(apply(blank(), { op: "template", list: "shots" })).shots;
  check("ảnh cần chụp mẫu: có tấm bắt buộc và tấm nếu kịp", [shots.some((s) => s.must), shots.some((s) => !s.must)], [true, true]);
  check("ảnh khách tự thêm mặc định là bắt buộc", add(blank(), "shots", { title: "Ảnh với cô giáo chủ nhiệm" }).shots[0].must, true);
  check("template danh sách không có mẫu → từ chối", apply(blank(), { op: "template", list: "guests" }), { ok: false, error: "bad_op" });
  const st = must(apply(blank(), { op: "set_style", colors: ["#862828", "e8c6c2", "#862828", "đỏ", "#FFF"], concept: "Vintage đỏ rượu", links: ["pinterest.com/abc", "ftp://x"] })).style;
  check("bảng màu: chuẩn hoá, bỏ trùng, bỏ màu lạ", st.colors, ["#862828", "#e8c6c2", "#ffffff"]);
  check("link cảm hứng: chỉ http(s)", st.links, ["https://pinterest.com/abc"]);
  check("phong cách giữ concept khi chỉ đổi màu", must(apply({ ...blank(), style: st }, { op: "set_style", colors: [] })).style.concept, "Vintage đỏ rượu");
}
check("thao tác danh sách mới cần cột extra", [opNeedsExtra({ op: "add", list: "guests" }), opNeedsExtra({ op: "set_style" }), opNeedsExtra({ op: "add", list: "tasks" })], [true, true, false]);

/* ── Lịch trình ngày cưới ────────────────────────────────────────────────── */
{
  let p = add(blank(), "day", { id: "d1", time: "8:5", title: "Lễ gia tiên nhà gái", place: "Nhà gái", who: "", side: "bride" });
  check("chuẩn hoá giờ 8:5 → 08:05, bỏ ô trống, giữ bên", p.day[0], { id: "d1", time: "08:05", title: "Lễ gia tiên nhà gái", place: "Nhà gái", side: "bride" });
  p = add(p, "day", { id: "d2", time: "", title: "Chờ chốt giờ" });
  p = add(p, "day", { id: "d3", time: "05:00", title: "Trang điểm" });
  check("giờ sai → để trống", cleanTime("25:00"), "");
  const rows = mergeDay(p.day, [{ id: "s1", time: "07:30", title: "Ê-kíp chụp có mặt" }]);
  check("gộp lịch hẹn studio, sắp theo giờ, chưa có giờ xuống cuối", rows.map((r) => [r.time, !!r.studio]), [["05:00", false], ["07:30", true], ["08:05", false], ["", false]]);
  p = must(apply(p, { op: "set", list: "day", id: "d1", patch: { place: "", side: "" } }));
  check("xoá địa điểm, về 'chung'", ["place", "side"].map((k) => k in p.day.find((d) => d.id === "d1")), [false, false]);
  const t = must(apply(blank(), { op: "template", list: "day" }));
  check("lịch mẫu có giờ, tách việc cô dâu / chú rể, mã không trùng", [t.day.length > 5, t.day.every((d) => d.time), t.day.some((d) => d.side === "bride") && t.day.some((d) => d.side === "groom"), new Set(t.day.map((d) => d.id)).size === t.day.length], [true, true, true, true]);
}

/* ── Sắp tới ─────────────────────────────────────────────────────────────── */
{
  const p = { ...blank(), wedding_date: "2027-01-16",
    tasks: [
      { id: "a", title: "Quá hạn", when: "m12", done: false },
      { id: "b", title: "Sắp tới", when: "m3", done: false, due: "2026-11-01", owner: "groom" },
      { id: "c", title: "Còn xa", when: "w1", done: false },
      { id: "d", title: "Đã xong", when: "m3", done: true, due: "2026-10-25" },
    ],
    budget: [
      { id: "x", cat: "party", name: "nhà hàng", estimate: 100, actual: 0, paid: 0, due: "2026-10-30" },
      { id: "y", cat: "ring", name: "nhẫn", estimate: 100, actual: 0, paid: 100, due: "2026-10-30" },
    ],
  };
  const a = upcoming(p, {}, {
    today: "2026-10-23",
    studioAppts: [{ id: "1", date: "2026-11-05", time: "09:00", title: "Thử váy", place: "Phòng váy" }, { id: "2", date: "2026-10-01", time: "", title: "Đã qua" }],
    studioLine: { name: "Mây Studio", estimate: 50, paid: 10, due: "2026-10-28" },
  });
  check("sắp tới: quá hạn đứng đầu, rồi theo ngày; bỏ việc xong, khoản đã trả đủ, lịch hẹn đã qua, việc còn xa",
    a.map((x) => [x.kind, x.title, x.overdue]),
    [["task", "Quá hạn", true], ["pay", "Thanh toán Mây Studio", false], ["pay", "Thanh toán nhà hàng", false], ["task", "Sắp tới", false], ["appt", "Thử váy", false]]);
}

/* ── Đọc jsonb từ DB ─────────────────────────────────────────────────────── */
{
  const p = normalizePlan({
    wedding_date: "2027-01-16",
    budget_total: "abc",
    tasks: [{ id: "a1", title: "OK", when: "m3", done: true }, { id: "a1", title: "trùng mã", when: "m3" }, { title: "không mã" }, null, "rác"],
    budget: [{ id: "b1", cat: "zzz", name: "x", estimate: -1, paid: "2000" }],
    day_plan: { not: "array" },
    extra: { guests: "rác", style: { colors: "đỏ" }, settings: { table_size: "abc" } },
  });
  check("bỏ dòng hỏng / trùng mã", p.tasks.map((t) => t.title), ["OK"]);
  check("tiền hỏng → 0, nhóm lạ → Khác, thiếu giá chốt → 0", [p.budget_total, p.budget[0].cat, p.budget[0].estimate, p.budget[0].actual, p.budget[0].paid], [0, "other", 0, 0, 2000]);
  check("lịch trình không phải mảng → rỗng", p.day, []);
  check("extra hỏng → danh sách rỗng, cài đặt mặc định", [p.guests, p.style.colors, p.settings.table_size], [[], [], 10]);
  check("dòng null → kế hoạch rỗng", normalizePlan(null).tasks, []);
  check("dòng cũ chưa có cột extra vẫn đọc được", normalizePlan({ tasks: [], budget: [], day_plan: [] }).guests, []);
}
check("cleanDate: chặn năm vô lý", cleanDate("1900-01-01"), null);

/* ── Việc gắn với dữ liệu studio ─────────────────────────────────────────── */
{
  const auto = autoLinks({
    studioName: "Mây Studio",
    signed: true,
    shot: false,
    invitation: { published: true, href: "/thiep/sua/tok" },
    album: null,
    total: 25000000,
    paid: 10000000,
  });
  check("đã ký → 'Chọn studio' tự xong", auto.studio.done, true);
  check("còn nợ → hiện số còn lại", [auto.pay.done, auto.pay.sub], [false, "Còn 15.000.000đ"]);
  check("thiệp đã xuất bản → xong, có link sửa", [auto.invite.done, auto.invite.href], [true, "/thiep/sua/tok"]);
  const tasks = defaultTasks();
  check("đếm cả việc tự xong", planProgress(tasks, auto).done, 2);
  const shoot = tasks.find((t) => t.link === "shoot");
  check("khách tick tay vẫn tính xong dù studio chưa ghi nhận", taskDone({ ...shoot, done: true }, auto), true);
  check("hợp đồng 0đ → việc thanh toán không tự xong", autoLinks({ studioName: "x", signed: false, shot: false, invitation: null, album: null, total: 0, paid: 0 }).pay.done, false);
  check("nhóm theo đúng thứ tự mốc", groupTasks(tasks).map((g) => g.when.key), ["m12", "m6", "m3", "w4", "w1", "d0", "after"]);
}

console.log(fail ? `\n${fail} kiểm thử HỎNG` : "\nTất cả kiểm thử đều qua.");
process.exit(fail ? 1 : 0);
