/* Kiểm thử luật của KẾ HOẠCH CƯỚI trên cổng khách (/portal/<token>/ke-hoach).
 *
 * Vì sao đáng test: mọi thao tác đi thẳng từ trình duyệt khách lên máy chủ, và
 * trang khách dùng CHÍNH `applyPlanOp` để hiện trước kết quả. Luật lệch một chút
 * là khách thấy "đã lưu" một thứ máy chủ không lưu, hoặc một ô tiền gõ chữ làm
 * hỏng cả tổng ngân sách. Còn luật "hợp đồng nào có kế hoạch cưới" mà sai thì
 * khách chụp kỷ yếu "cuối cấp" nhận một trang lên kế hoạch cưới.
 *
 * Nạp thẳng code thật ở src/lib/wedding-plan.ts.
 */
import {
  applyPlanOp, autoLinks, budgetSummary, cleanDate, cleanTime, currentWhen, daysUntil, defaultTasks,
  groupTasks, isWeddingPackage, mergeDay, newPlan, normalizePlan, planProgress, plannerEnabled,
  shootsWeddingDay, taskDone, whenDue, PLAN_LIMITS,
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
const blank = () => ({ wedding_date: null, budget_total: 0, tasks: [], budget: [], day: [] });

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
  check("có việc mẫu, lịch trình ngày cưới để TRỐNG", [p.tasks.length > 20, p.day.length], [true, 0]);
  check("mã việc không trùng", new Set(p.tasks.map((t) => t.id)).size, p.tasks.length);
  check("ngân sách mẫu tiền = 0", p.budget.every((b) => b.estimate === 0 && b.paid === 0), true);
  check("mẫu đã sạch theo luật đọc DB (không rơi dòng nào)", normalizePlan({ ...p, day_plan: p.day }), p);
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

/* ── Thao tác: việc cần làm ──────────────────────────────────────────────── */
{
  let p = must(apply(blank(), { op: "task_add", id: "abc123", title: "  Đặt   bánh cưới  ", when: "w4" }));
  check("dùng đúng mã trình duyệt gửi (để bản hiện trước khớp bản lưu)", p.tasks[0].id, "abc123");
  check("gọn khoảng trắng", p.tasks[0].title, "Đặt bánh cưới");
  p = must(apply(p, { op: "task_add", id: "abc123", title: "Trùng mã", when: "w4" }));
  check("mã trùng → máy chủ cấp mã khác, không đè dòng cũ", [p.tasks.length, p.tasks[1].id !== "abc123"], [2, true]);
  check("mốc lạ → về mốc mặc định", must(apply(blank(), { op: "task_add", title: "x", when: "hôm qua" })).tasks[0].when, "m3");
  check("tiêu đề trống → từ chối", apply(blank(), { op: "task_add", title: "   ", when: "m3" }), { ok: false, error: "empty" });
  p = must(apply(p, { op: "task_set", id: "abc123", done: true, note: "Tiệm Hạnh Phúc\n0909 000 000" }));
  check("tick xong + ghi chú giữ xuống dòng", [p.tasks[0].done, p.tasks[0].note], [true, "Tiệm Hạnh Phúc\n0909 000 000"]);
  p = must(apply(p, { op: "task_set", id: "abc123", note: "" }));
  check("xoá ghi chú", "note" in p.tasks[0], false);
  check("đổi sang mốc không có → từ chối", apply(p, { op: "task_set", id: "abc123", when: "x" }), { ok: false, error: "bad_when" });
  check("sửa dòng máy khác vừa xoá → báo 'gone'", apply(p, { op: "task_set", id: "khong-co", done: true }), { ok: false, error: "gone" });
  const before = JSON.stringify(p);
  apply(p, { op: "task_remove", id: "abc123" });
  check("không sửa bản cũ (trang khách giữ bản máy chủ để áp lại)", JSON.stringify(p), before);
  check("tiêu đề quá dài bị cắt", must(apply(blank(), { op: "task_add", title: "a".repeat(999), when: "m3" })).tasks[0].title.length, PLAN_LIMITS.title);
}
{
  const many = { ...blank(), tasks: Array.from({ length: PLAN_LIMITS.tasks }, (_, i) => ({ id: `t${i}`, title: "x", when: "m3", done: false })) };
  check("chặn số việc", apply(many, { op: "task_add", title: "thêm", when: "m3" }), { ok: false, error: "too_many" });
}

/* ── Thao tác: ngày cưới, ngân sách ──────────────────────────────────────── */
check("đặt ngày cưới", must(apply(blank(), { op: "set_date", date: "2027-05-20" })).wedding_date, "2027-05-20");
check("ngày sai → từ chối", apply(blank(), { op: "set_date", date: "20/05/2027" }), { ok: false, error: "bad_date" });
check("bỏ ngày cưới", must(apply({ ...blank(), wedding_date: "2027-05-20" }, { op: "set_date", date: "" })).wedding_date, null);
check("ngân sách tổng: chữ lẫn số → lấy số", must(apply(blank(), { op: "set_budget_total", amount: "300.000.000đ" })).budget_total, 300000000);
check("ngân sách âm → 0", must(apply(blank(), { op: "set_budget_total", amount: -5 })).budget_total, 0);
check("tiền lẻ → làm tròn", must(apply(blank(), { op: "set_budget_total", amount: 1500.6 })).budget_total, 1501);
{
  let p = must(apply(blank(), { op: "budget_add", id: "bb1", cat: "party", name: "", estimate: 120000000 }));
  check("khoản không tên → lấy tên nhóm", p.budget[0].name, "Tiệc cưới");
  check("nhóm lạ → Khác, nhưng phải có tên", apply(blank(), { op: "budget_add", cat: "zzz", name: "" }), { ok: false, error: "empty" });
  p = must(apply(p, { op: "budget_set", id: "bb1", paid: 30000000 }));
  check("ghi đã trả", [p.budget[0].estimate, p.budget[0].paid], [120000000, 30000000]);
  check("đổi sang nhóm lạ → từ chối", apply(p, { op: "budget_set", id: "bb1", cat: "zzz" }), { ok: false, error: "bad_cat" });
  const s = budgetSummary(p.budget, { name: "Gói chụp", estimate: 25000000, paid: 10000000 }, 140000000);
  check("tổng = các khoản + gói studio", [s.estimate, s.paid, s.left, s.over], [145000000, 40000000, -5000000, true]);
  check("thanh tiến độ kẹp 100%", s.pct, 100);
  check("chưa đặt ngân sách tổng → không có 'còn lại'", budgetSummary(p.budget, null, 0).left, null);
}

/* ── Thao tác: lịch trình ngày cưới ──────────────────────────────────────── */
{
  let p = must(apply(blank(), { op: "day_add", id: "d1", time: "8:5", title: "Lễ gia tiên nhà gái", place: "Nhà gái", who: "" }));
  check("chuẩn hoá giờ 8:5 → 08:05, bỏ ô trống", p.day[0], { id: "d1", time: "08:05", title: "Lễ gia tiên nhà gái", place: "Nhà gái" });
  p = must(apply(p, { op: "day_add", id: "d2", time: "", title: "Chờ chốt giờ" }));
  p = must(apply(p, { op: "day_add", id: "d3", time: "05:00", title: "Trang điểm" }));
  check("giờ sai → để trống", cleanTime("25:00"), "");
  const rows = mergeDay(p.day, [{ id: "s1", time: "07:30", title: "Ê-kíp chụp có mặt" }]);
  check("gộp lịch hẹn studio, sắp theo giờ, chưa có giờ xuống cuối", rows.map((r) => [r.time, !!r.studio]), [["05:00", false], ["07:30", true], ["08:05", false], ["", false]]);
  p = must(apply(p, { op: "day_set", id: "d1", place: "" }));
  check("xoá địa điểm", "place" in p.day.find((d) => d.id === "d1"), false);
  check("lịch mẫu chỉ khi còn trống", apply(p, { op: "day_template" }), { ok: false, error: "not_empty" });
  const t = must(apply(blank(), { op: "day_template" }));
  check("lịch mẫu có giờ, mã không trùng", [t.day.length > 5, t.day.every((d) => d.time), new Set(t.day.map((d) => d.id)).size === t.day.length], [true, true, true]);
}
check("thao tác lạ → từ chối", apply(blank(), { op: "drop_table" }), { ok: false, error: "bad_op" });
check("không phải object → từ chối", apply(blank(), "task_add"), { ok: false, error: "bad_op" });

/* ── Đọc jsonb từ DB ─────────────────────────────────────────────────────── */
{
  const p = normalizePlan({
    wedding_date: "2027-01-16",
    budget_total: "abc",
    tasks: [{ id: "a1", title: "OK", when: "m3", done: true }, { id: "a1", title: "trùng mã", when: "m3" }, { title: "không mã" }, null, "rác"],
    budget: [{ id: "b1", cat: "zzz", name: "x", estimate: -1, paid: "2000" }],
    day_plan: { not: "array" },
  });
  check("bỏ dòng hỏng / trùng mã", p.tasks.map((t) => t.title), ["OK"]);
  check("tiền hỏng → 0, nhóm lạ → Khác", [p.budget_total, p.budget[0].cat, p.budget[0].estimate, p.budget[0].paid], [0, "other", 0, 2000]);
  check("lịch trình không phải mảng → rỗng", p.day, []);
  check("dòng null → kế hoạch rỗng", normalizePlan(null), blank());
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
  const pr = planProgress(tasks, auto);
  check("đếm cả việc tự xong", pr.done, 2);
  const shoot = tasks.find((t) => t.link === "shoot");
  check("khách tick tay vẫn tính xong dù studio chưa ghi nhận", taskDone({ ...shoot, done: true }, auto), true);
  check("hợp đồng 0đ → việc thanh toán không tự xong", autoLinks({ studioName: "x", signed: false, shot: false, invitation: null, album: null, total: 0, paid: 0 }).pay.done, false);
  check("nhóm theo đúng thứ tự mốc", groupTasks(tasks).map((g) => g.when.key), ["m12", "m6", "m3", "w4", "w1", "d0", "after"]);
}

console.log(fail ? `\n${fail} kiểm thử HỎNG` : "\nTất cả kiểm thử đều qua.");
process.exit(fail ? 1 : 0);
