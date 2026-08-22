/* Kiểm thử luật chi nhánh studio.
 *
 * Vì sao đáng test: đây là code SAI ÂM THẦM và sai theo hướng tệ nhất — số tiền
 * của cơ sở này nhảy sang cơ sở khác. Bảng vẫn cộng đủ tổng, không có gì nổ,
 * chủ studio chỉ thấy "Quận 1 tháng này thu khá" và ra quyết định trên số sai.
 *
 * Bốn cái bẫy:
 *   • Cookie giữ id của một chi nhánh ĐÃ XOÁ → phải rơi về "xem gộp", chứ không
 *     được lọc theo id lạ và trả về màn hình trống mà không ai hiểu vì sao.
 *   • "Chưa gán" phải là `branch_id IS NULL`, KHÔNG phải `branch_id = "none"` —
 *     viết sai thì màn nào cũng trống.
 *   • Chi nhánh mới tạo, chưa có dữ liệu, vẫn phải có một hàng 0 trong bảng gộp;
 *     nếu không thì thẻ chi nhánh vừa thêm biến mất khỏi trang.
 *   • Dòng dữ liệu trỏ tới một chi nhánh không còn tồn tại phải dồn vào "chưa
 *     gán", không được đẻ ra một hàng mồ côi không nhãn.
 *
 * Nạp thẳng code thật ở src/lib/branch-rules.ts.
 */
import {
  BRANCH_ALL, BRANCH_NONE, normalizeBranch, isRealBranch, inBranch, branchFilter,
  branchLabel, branchName, sortBranches, statsByBranch, totalStats, UNASSIGNED_LABEL,
} from "../../src/lib/branch-rules.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const b = (id, name, code = null, active = true, position = 0) => ({ id, name, code, active, position });
const Q1 = b("b-q1", "Quận 1", "Q1", true, 0);
const GV = b("b-gv", "Gò Vấp", "GV", true, 1);
const OLD = b("b-old", "Cơ sở đã đóng", null, false, 2);
const LIST = [Q1, GV, OLD];

/* ── Chuẩn hoá lựa chọn ──────────────────────────────────────────────────── */
check("rỗng → xem gộp", normalizeBranch("", LIST), null);
check("null → xem gộp", normalizeBranch(null, LIST), null);
check('"all" → xem gộp', normalizeBranch(BRANCH_ALL, LIST), null);
check('"none" → chưa gán', normalizeBranch(BRANCH_NONE, LIST), BRANCH_NONE);
check("id có thật → chính nó", normalizeBranch("b-q1", LIST), "b-q1");
check("chi nhánh TẠM ẨN vẫn tra được (số liệu cũ)", normalizeBranch("b-old", LIST), "b-old");
// Bẫy số 1: cookie còn id của chi nhánh đã xoá / của studio khác.
check("id KHÔNG có trong danh sách → xem gộp (không lọc theo id lạ)", normalizeBranch("b-cua-studio-khac", LIST), null);
check("studio chưa khai chi nhánh nào → xem gộp", normalizeBranch("b-q1", []), null);
check("khoảng trắng hai đầu vẫn nhận", normalizeBranch("  b-gv  ", LIST), "b-gv");

check("xem gộp không phải một cơ sở thật", isRealBranch(null), false);
check("chưa gán không phải một cơ sở thật", isRealBranch(BRANCH_NONE), false);
check("id là một cơ sở thật", isRealBranch("b-q1"), true);

/* ── Điều kiện truy vấn ──────────────────────────────────────────────────── */
// Bẫy số 2: "none" phải thành IS NULL.
check("xem gộp → không thêm điều kiện", branchFilter(null), { kind: "all" });
check("chưa gán → IS NULL (KHÔNG phải eq 'none')", branchFilter(BRANCH_NONE), { kind: "null" });
check("một cơ sở → eq id", branchFilter("b-q1"), { kind: "eq", id: "b-q1" });

/* ── Lọc phía client ─────────────────────────────────────────────────────── */
check("xem gộp: nhận cả dòng chưa gán", inBranch({ branch_id: null }, null), true);
check("xem gộp: nhận cả dòng đã gán", inBranch({ branch_id: "b-q1" }, null), true);
check("chưa gán: chỉ nhận branch_id null", inBranch({ branch_id: null }, BRANCH_NONE), true);
check("chưa gán: KHÔNG nhận dòng đã gán", inBranch({ branch_id: "b-q1" }, BRANCH_NONE), false);
check("một cơ sở: nhận đúng cơ sở đó", inBranch({ branch_id: "b-q1" }, "b-q1"), true);
check("một cơ sở: không nhận cơ sở khác", inBranch({ branch_id: "b-gv" }, "b-q1"), false);
check("một cơ sở: KHÔNG nhận dòng chưa gán", inBranch({ branch_id: null }, "b-q1"), false);
check("thiếu hẳn cột branch_id → coi như chưa gán", inBranch({}, "b-q1"), false);
check("thiếu hẳn cột branch_id → vào nhóm chưa gán", inBranch({}, BRANCH_NONE), true);

/* ── Nhãn & thứ tự ───────────────────────────────────────────────────────── */
check("nhãn có mã", branchLabel(Q1), "Quận 1 · Q1");
check("nhãn không mã", branchLabel(OLD), "Cơ sở đã đóng");
check("tên rỗng không ra chuỗi trống", branchLabel({ name: "  ", code: null }), "Chi nhánh");
check("tra tên theo id", branchName("b-gv", LIST), "Gò Vấp");
check("id null → nhãn chưa gán", branchName(null, LIST), UNASSIGNED_LABEL);
check("id lạ → nhãn chưa gán (không in id thô)", branchName("b-la", LIST), UNASSIGNED_LABEL);
check("đang hoạt động lên trước, tạm ẩn xuống cuối",
  sortBranches([OLD, GV, Q1]).map((x) => x.id), ["b-q1", "b-gv", "b-old"]);
check("cùng position thì theo tên tiếng Việt",
  sortBranches([b("z", "Ánh Dương"), b("a", "An Phú")]).map((x) => x.name), ["An Phú", "Ánh Dương"]);

/* ── Gộp số liệu theo chi nhánh ──────────────────────────────────────────── */
const ct = (branch_id, itemTotal, paid) => ({
  branch_id,
  items: [{ qty: 1, unit_price: itemTotal }],
  payments: paid ? [{ amount: paid }] : [],
});

const m = statsByBranch(LIST, {
  contracts: [
    ct("b-q1", 30_000_000, 10_000_000),
    ct("b-q1", 20_000_000, 20_000_000),
    ct("b-gv", 15_000_000, 5_000_000),
    ct(null, 8_000_000, 0),
    // Bẫy số 4: hợp đồng trỏ tới chi nhánh không còn tồn tại.
    ct("b-da-xoa", 5_000_000, 5_000_000),
  ],
  expenses: [{ branch_id: "b-q1", amount: 3_000_000 }, { branch_id: null, amount: 1_000_000 }],
  staff: [{ studio_branch_id: "b-q1" }, { studio_branch_id: "b-q1" }, { studio_branch_id: null }],
  crew: [{ branch_id: "b-gv" }],
  appointments: [{ branch_id: "b-q1" }, { branch_id: "b-gv" }, { branch_id: "b-gv" }],
});

const at = (id) => {
  const s = m.get(id);
  return [s.contracts, s.revenue, s.contractValue, s.expenses, s.staff, s.crew, s.appointments];
};
check("Quận 1 gộp đúng", at("b-q1"), [2, 30_000_000, 50_000_000, 3_000_000, 2, 0, 1]);
check("Gò Vấp gộp đúng", at("b-gv"), [1, 5_000_000, 15_000_000, 0, 0, 1, 2]);
// Bẫy số 3: chi nhánh chưa có dữ liệu vẫn phải có hàng 0.
check("chi nhánh chưa có dữ liệu vẫn có hàng 0 (thẻ không biến mất)", at("b-old"), [0, 0, 0, 0, 0, 0, 0]);
// Chưa gán = 1 hợp đồng thật + 1 hợp đồng trỏ chi nhánh đã xoá.
check("dòng trỏ chi nhánh đã xoá dồn vào 'chưa gán'", at(null), [2, 5_000_000, 13_000_000, 1_000_000, 1, 0, 0]);
check("không đẻ hàng mồ côi cho id đã xoá", m.has("b-da-xoa"), false);
check("số hàng = số chi nhánh + 1 (chưa gán)", m.size, LIST.length + 1);

const t = totalStats(m);
check("tổng hợp đồng = mọi hợp đồng đã quét", t.contracts, 5);
check("tổng thực thu", t.revenue, 40_000_000);
check("tổng giá trị", t.contractValue, 78_000_000);
check("tổng chi", t.expenses, 4_000_000);
check("tổng nhân sự + thợ", [t.staff, t.crew], [3, 1]);
check("tổng lịch hẹn", t.appointments, 3);

check("không có dữ liệu nào → mọi chi nhánh vẫn có hàng 0",
  [...statsByBranch(LIST, {}).keys()].sort(), ["b-gv", "b-old", "b-q1", null].sort());

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
