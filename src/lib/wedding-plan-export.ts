/**
 * XUẤT KẾ HOẠCH CƯỚI RA EXCEL — nút "Xuất Excel" ở trang kế hoạch cưới của
 * khách (/portal/<token>/ke-hoach). Khách giữ một bản trên máy, in ra, hoặc gửi
 * bố mẹ / người lo tiệc mà không phải chia sẻ link có SĐT của mình.
 *
 * Mỗi phần của kế hoạch một sheet (tổng quan, việc cần làm, ngân sách, khách
 * mời, sơ đồ bàn, nhà cung cấp, ngày cưới, phong cách & ảnh cần chụp), cùng bố
 * cục với các file xuất của studio (@/lib/studio-export): khối tên studio ở đầu,
 * hàng tiêu đề có nền, tiền là SỐ (cộng / lọc được), dòng tổng cộng. Dòng tổng
 * ghi sẵn giá trị chứ không dùng công thức: khách hay mở file ngay trong Zalo
 * hoặc trình xem của điện thoại — những chỗ đó không tính công thức, ô tổng sẽ
 * trống.
 *
 * Phần dựng dữ liệu (`planWorkbook`) là hàm thuần — kiểm thử ở
 * desktop/test/wedding-plan-export.mjs. JSZip chỉ nạp lúc bấm nút
 * (`downloadPlanXlsx`), không nằm trong bundle của trang.
 */
// Import tương đối kèm đuôi .ts như @/lib/studio-export — chạy được cả trong
// kiểm thử `node --experimental-strip-types`.
import type { XlsxRow, XlsxSheet, XlsxStyle } from "./xlsx.ts";
import { dmy, headerRows, stamp } from "./studio-export.ts";
import { lunarText } from "./lunar.ts";
import {
  BUDGET_CATS, GUEST_GROUP_LABEL, OWNER_LABEL, PAYER_LABEL, PRIORITY_LABEL, RSVP_LABEL, SIDE_LABEL, VENDOR_STATUS_LABEL,
  budgetCatLabel, budgetSummary, daysUntil, groupTasks, guestCount, guestRsvp, guestSummary, lineCost, mergeDay,
  tableSummary, tablesNeeded, taskDone, taskDue, taskStats,
  type AutoLinks, type DayRow, type GuestReply, type StudioBudgetLine, type WeddingPlanData,
} from "./wedding-plan.ts";

export type PlanExportInput = {
  plan: WeddingPlanData;
  /** Tên hiển thị của đôi (tên khách trên hợp đồng). */
  couple: string;
  studio: { name: string; phone?: string | null };
  auto: AutoLinks;
  /** Gói của studio — một dòng ngân sách đọc từ hợp đồng. */
  studioLine: StudioBudgetLine | null;
  /** Lịch hẹn studio trong ngày cưới — xếp chung vào lịch trình. */
  studioDay: DayRow[];
  /** Chế độ cũ: phản hồi qua thiệp khớp theo tên, phủ lên lúc hiển thị (như trên trang). */
  replies?: Record<string, GuestReply>;
  today: string;
  /** Database đã có cột `extra` — false thì chỉ có việc cần làm, ngân sách, lịch trình. */
  ext: boolean;
  /** Thời điểm xuất in trên file — để trống là bây giờ (kiểm thử truyền cố định). */
  exportedAt?: string;
};

type Cell = { v?: string | number | null; s?: XlsxStyle };
const c = (v: string | number | null | undefined, s: XlsxStyle = "cell"): Cell => ({ v: v ?? "", s });
const head = (labels: string[]): XlsxRow => labels.map((v) => ({ v, s: "head" as const }));
const total = (cells: (string | number | null)[], money: boolean[] = []): XlsxRow =>
  cells.map((v, i) => ({ v: v ?? "", s: (money[i] ? "totalMoney" : "totalLabel") as XlsxStyle }));
const yes = (b: boolean) => (b ? "✓" : "");

/**
 * Một sheet: khối đầu file + bảng. Dòng tiêu đề bảng (dòng đầu của `body`) giữ
 * cố định khi cuộn; `freeze = false` cho sheet không mở đầu bằng một bảng.
 */
function sheet(input: PlanExportInput, name: string, title: string, cols: number[], body: XlsxRow[], freeze = true): XlsxSheet {
  const { rows, merges } = headerRows(
    { name: input.studio.name, phone: input.studio.phone },
    title,
    metaLines(input),
    cols.length,
  );
  return { name, cols, merges, fitWidth: true, ...(freeze ? { freezeRows: rows.length + 1 } : {}), rows: [...rows, ...body] };
}

function metaLines(input: PlanExportInput): string[] {
  const d = input.plan.wedding_date;
  const left = daysUntil(d, input.today);
  const when = d
    ? [`Ngày cưới: ${dmy(d)}`, lunarText(d, "âm lịch"), left !== null && left > 0 ? `còn ${left} ngày` : ""].filter(Boolean).join(" · ")
    : "Chưa chọn ngày cưới";
  return [input.couple, when, `Xuất lúc ${input.exportedAt ?? stamp()}`];
}

/* ── Từng sheet ──────────────────────────────────────────────────────────── */

function overviewSheet(input: PlanExportInput): XlsxSheet {
  const { plan, auto, studioLine, today, replies = {} } = input;
  const t = taskStats(plan.tasks, auto, plan.wedding_date, today);
  const m = budgetSummary(plan.budget, studioLine, plan.budget_total);
  const rows: XlsxRow[] = [
    head(["Mục", "Số liệu", "Ghi chú"]),
    [c("Việc cần làm"), c(`${t.done}/${t.total} việc đã xong`), c(t.overdue ? `${t.overdue} việc quá hạn` : "Không có việc quá hạn", "cellMuted")],
    ...(plan.budget_total > 0 ? [[c("Ngân sách"), c(plan.budget_total, "money"), c("Tổng ngân sách hai bạn đặt", "cellMuted")]] : []),
    [c("Dự kiến chi"), c(m.cost, "money"), c("Theo giá chốt, chưa chốt thì theo dự kiến", "cellMuted")],
    [c("Đã trả"), c(m.paid, "moneyIn"), c("")],
    [c("Còn phải trả"), c(m.owed, m.owed > 0 ? "moneyOut" : "money"), c("")],
    ...(m.left !== null ? [[c(m.over ? "Vượt ngân sách" : "Còn lại trong ngân sách"), c(Math.abs(m.left), m.over ? "moneyOut" : "money"), c("")]] : []),
  ];
  if (input.ext) {
    const g = guestSummary(plan.guests, replies);
    const people = plan.guests.length ? g.people : plan.settings.guests_expected;
    const cats = new Set<string>(plan.vendors.map((v) => v.cat));
    const booked = new Set<string>(plan.vendors.filter((v) => v.status === "booked").map((v) => v.cat));
    rows.push(
      [c("Khách sẽ đến"), c(people, "num"), c(plan.guests.length ? `${g.yes} đã xác nhận · ${g.pending} chưa phản hồi · ${g.no} không dự` : "Số dự kiến — chưa lập danh sách", "cellMuted")],
      [c("Bàn cần đặt"), c(tablesNeeded(people, plan.settings.table_size), "num"), c(`${plan.settings.table_size} người / bàn`, "cellMuted")],
      ...(g.gifts > 0 ? [[c("Tiền mừng"), c(g.gifts, "moneyIn"), c(`${g.thanked}/${g.entries} đã gửi lời cảm ơn`, "cellMuted")]] : []),
      ...(cats.size ? [[c("Nhà cung cấp"), c(`${booked.size}/${cats.size} hạng mục đã chốt`), c("")]] : []),
    );
  }
  return sheet(input, "Tổng quan", "KẾ HOẠCH CƯỚI", [26, 26, 52], rows);
}

function tasksSheet(input: PlanExportInput): XlsxSheet {
  const { plan, auto } = input;
  const rows: XlsxRow[] = [head(["STT", "Mốc", "Hạn", "Việc", "Người lo", "Ưu tiên", "Xong", "Ghi chú"])];
  let n = 0;
  for (const grp of groupTasks(plan.tasks)) {
    for (const t of grp.tasks) {
      rows.push([
        c(++n, "num"),
        c(grp.when.label),
        c(dmy(taskDue(t, plan.wedding_date))),
        c(t.title),
        c(t.owner ? OWNER_LABEL[t.owner] : ""),
        c(t.priority && t.priority !== "mid" ? PRIORITY_LABEL[t.priority] : ""),
        c(yes(taskDone(t, auto)), "num"),
        c(t.note ?? "", "cellMuted"),
      ]);
    }
  }
  const done = plan.tasks.filter((t) => taskDone(t, auto)).length;
  // Nhãn tổng ở cột thứ hai: cột STT hẹp, chữ tràn sang sẽ đè lên ô bên cạnh.
  rows.push(total(["", "TỔNG CỘNG", "", `${plan.tasks.length} việc`, "", "", `${done} xong`, ""]));
  return sheet(input, "Việc cần làm", "VIỆC CẦN LÀM", [6, 22, 12, 46, 12, 12, 9, 36], rows);
}

function budgetSheet(input: PlanExportInput): XlsxSheet {
  const { plan, studioLine } = input;
  const rows: XlsxRow[] = [head(["STT", "Hạng mục", "Khoản chi", "Dự kiến", "Giá chốt", "Đã trả", "Còn phải trả", "Người chi", "Hạn trả", "Ghi chú"])];
  let n = 0;
  if (studioLine) {
    const owed = Math.max(0, studioLine.estimate - studioLine.paid);
    rows.push([
      c(++n, "num"), c(budgetCatLabel("photo")), c(studioLine.name), c(studioLine.estimate, "money"), c(studioLine.estimate, "money"),
      c(studioLine.paid, "moneyIn"), c(owed, owed > 0 ? "moneyOut" : "money"), c(""), c(dmy(studioLine.due ?? null)), c("Theo hợp đồng với studio", "cellMuted"),
    ]);
  }
  // Theo thứ tự hạng mục như trên trang.
  const order = new Map<string, number>(BUDGET_CATS.map((x, i) => [x.key, i]));
  const lines = [...plan.budget].sort((a, b) => (order.get(a.cat) ?? 99) - (order.get(b.cat) ?? 99));
  for (const l of lines) {
    const owed = Math.max(0, lineCost(l) - l.paid);
    // Ô 0đ để trống: khoản mẫu chưa điền khỏi thành một cột số 0 khó đọc.
    rows.push([
      c(++n, "num"), c(budgetCatLabel(l.cat)), c(l.name), c(l.estimate || null, "money"), c(l.actual || null, "money"),
      c(l.paid || null, "moneyIn"), c(owed || null, "moneyOut"), c(l.payer ? PAYER_LABEL[l.payer] : ""), c(dmy(l.due ?? null)), c(l.note ?? "", "cellMuted"),
    ]);
  }
  const m = budgetSummary(plan.budget, studioLine, plan.budget_total);
  rows.push(total(["", "TỔNG CỘNG", `${n} khoản`, m.estimate, m.actual, m.paid, m.owed, "", "", ""], [false, false, false, true, true, true, true]));
  if (plan.budget_total > 0) {
    rows.push(
      [],
      [c(""), c("Ngân sách", "label"), c(""), c(plan.budget_total, "money")],
      [c(""), c(m.over ? "Vượt ngân sách" : "Còn lại", "label"), c(""), c(Math.abs(m.left ?? 0), m.over ? "moneyOut" : "money")],
    );
  }
  return sheet(input, "Ngân sách", "NGÂN SÁCH CƯỚI", [6, 22, 40, 15, 15, 15, 15, 16, 12, 30], rows);
}

function guestsSheet(input: PlanExportInput): XlsxSheet {
  const { plan, replies = {} } = input;
  const rows: XlsxRow[] = [head(["STT", "Tên khách", "Nhóm", "Số người", "SĐT", "Đã gửi thiệp", "Xác nhận", "Bàn", "Tiền mừng", "Đã cảm ơn", "Ghi chú"])];
  plan.guests.forEach((g, i) => {
    const r = replies[g.id];
    rows.push([
      c(i + 1, "num"), c(g.name), c(GUEST_GROUP_LABEL[g.group]), c(guestCount(g, r), "num"), c(g.phone ?? ""), c(yes(g.invited), "num"),
      c(RSVP_LABEL[guestRsvp(g, r)] + (r || g.replied ? " (qua thiệp)" : "")), c(g.table ?? "", "num"), c(g.gift || null, "money"),
      c(yes(g.thanked), "num"), c(g.note ?? "", "cellMuted"),
    ]);
  });
  const s = guestSummary(plan.guests, replies);
  rows.push(total(
    ["", `TỔNG CỘNG · ${s.entries} lời mời`, "", s.people, "", `${s.invited} đã gửi`, `${s.yes} người sẽ dự`, "", s.gifts, `${s.thanked} đã cảm ơn`, ""],
    [false, false, false, false, false, false, false, false, true],
  ));
  rows.push([c("Số người tính những ai chưa báo không dự.", "muted")]);
  return sheet(input, "Khách mời", "DANH SÁCH KHÁCH MỜI", [6, 34, 18, 10, 14, 12, 22, 9, 15, 11, 30], rows);
}

function tablesSheet(input: PlanExportInput): XlsxSheet | null {
  const { plan, replies = {} } = input;
  const size = plan.settings.table_size;
  const tables = tableSummary(plan.guests, replies, size);
  if (!tables.length) return null;
  const rows: XlsxRow[] = [head(["Bàn", "Số người", "Sức chứa", "Khách"])];
  for (const t of tables) {
    rows.push([
      c(t.table, "num"), c(t.people, "num"), c(t.over ? `${size} — vượt ${t.people - size}` : size, t.over ? "moneyOut" : "num"),
      c(t.guests.map((g) => `${g.name} (${guestCount(g, replies[g.id])})`).join(", ")),
    ]);
  }
  const unseated = plan.guests.filter((g) => !g.table && guestRsvp(g, replies[g.id]) !== "no");
  rows.push(total([`${tables.length} bàn`, tables.reduce((n, t) => n + t.people, 0), "", unseated.length ? `Chưa xếp bàn: ${unseated.map((g) => g.name).join(", ")}` : ""]));
  return sheet(input, "Sơ đồ bàn", "SƠ ĐỒ BÀN", [12, 10, 16, 80], rows);
}

function vendorsSheet(input: PlanExportInput): XlsxSheet | null {
  const { plan } = input;
  if (!plan.vendors.length) return null;
  const order = new Map<string, number>(BUDGET_CATS.map((x, i) => [x.key, i]));
  const list = [...plan.vendors].sort((a, b) => (order.get(a.cat) ?? 99) - (order.get(b.cat) ?? 99));
  const rows: XlsxRow[] = [head(["STT", "Hạng mục", "Nhà cung cấp", "SĐT", "Link", "Báo giá", "Trạng thái", "Ghi chú"])];
  list.forEach((v, i) => {
    rows.push([
      c(i + 1, "num"), c(budgetCatLabel(v.cat)), c(v.name), c(v.phone ?? ""), c(v.link ?? "", "cellMuted"), c(v.quote || null, "money"),
      c(VENDOR_STATUS_LABEL[v.status]), c(v.note ?? "", "cellMuted"),
    ]);
  });
  return sheet(input, "Nhà cung cấp", "NHÀ CUNG CẤP", [6, 20, 30, 14, 34, 15, 15, 30], rows);
}

/** Ngày cưới: lịch trình (gồm lịch hẹn studio), đội hỗ trợ, đồ cần mang — ba bảng nối nhau. */
function daySheet(input: PlanExportInput): XlsxSheet | null {
  const { plan, studioDay } = input;
  const day = mergeDay(plan.day, studioDay);
  if (!day.length && !(input.ext && (plan.people.length || plan.packing.length))) return null;
  const rows: XlsxRow[] = [head(["Giờ", "Việc", "Địa điểm", "Phụ trách", "Bên"])];
  for (const r of day) {
    rows.push([
      c(r.time || "--:--", "num"), c(r.studio ? `${r.title} (studio)` : r.title), c(r.place ?? ""), c(r.who ?? ""), c(r.side ? SIDE_LABEL[r.side] : ""),
    ]);
  }
  if (!day.length) rows.push([c("Chưa lập lịch trình", "cellMuted")]);
  if (input.ext && plan.people.length) {
    rows.push([], [c("Đội hỗ trợ", "section")], head(["Tên", "Vai trò", "SĐT", "Bên", ""]));
    for (const p of plan.people) rows.push([c(p.name), c(p.role), c(p.phone ?? ""), c(p.side ? SIDE_LABEL[p.side] : ""), c("")]);
  }
  if (input.ext && plan.packing.length) {
    rows.push([], [c("Đồ cần mang", "section")], head(["Món", "Số lượng", "Đã xếp", "", ""]));
    for (const p of plan.packing) rows.push([c(p.name), c(p.qty, "num"), c(yes(p.packed), "num"), c(""), c("")]);
  }
  return sheet(input, "Ngày cưới", "LỊCH TRÌNH NGÀY CƯỚI", [10, 44, 32, 22, 12], rows);
}

function styleSheet(input: PlanExportInput): XlsxSheet | null {
  const { plan } = input;
  const st = plan.style;
  if (!plan.shots.length && !st.colors.length && !st.concept && !st.links.length) return null;
  const rows: XlsxRow[] = [];
  if (st.concept || st.colors.length || st.links.length) {
    rows.push(head(["Phong cách", ""]));
    if (st.concept) rows.push([c("Concept"), c(st.concept)]);
    if (st.colors.length) rows.push([c("Bảng màu"), c(st.colors.join("  "))]);
    for (const l of st.links) rows.push([c("Link cảm hứng"), c(l, "cellMuted")]);
    rows.push([]);
  }
  if (plan.shots.length) {
    rows.push([c("Ảnh cần chụp", "section")], head(["STT", "Tấm ảnh"]));
    plan.shots.forEach((s, i) => rows.push([c(i + 1, "num"), c(s.must ? `${s.title} — nhất định phải có` : s.title)]));
  }
  return sheet(input, "Phong cách & ảnh", "PHONG CÁCH & ẢNH CẦN CHỤP", [16, 70], rows, false);
}

/* ── Workbook ────────────────────────────────────────────────────────────── */

/** Kế hoạch → các sheet Excel. Phần nào trống (chưa có nhà cung cấp, chưa xếp bàn…) thì không có sheet. */
export function planWorkbook(input: PlanExportInput): XlsxSheet[] {
  const sheets: (XlsxSheet | null)[] = [
    overviewSheet(input),
    tasksSheet(input),
    budgetSheet(input),
    ...(input.ext && input.plan.guests.length ? [guestsSheet(input), tablesSheet(input)] : []),
    input.ext ? vendorsSheet(input) : null,
    daySheet(input),
    input.ext ? styleSheet(input) : null,
  ];
  return sheets.filter((s): s is XlsxSheet => !!s);
}

/** "Nguyễn Bảo Ngọc & Trần Minh Khôi" → "ke-hoach-cuoi-nguyen-bao-ngoc-tran-minh-khoi.xlsx". */
export function planFileName(couple: string): string {
  const slug = couple
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
  return `ke-hoach-cuoi${slug ? `-${slug}` : ""}.xlsx`;
}

/** Dựng file rồi tải về (trình duyệt). JSZip nạp tại đây, lúc khách bấm nút. */
export async function downloadPlanXlsx(input: PlanExportInput): Promise<void> {
  const { downloadXlsx } = await import("./xlsx.ts");
  await downloadXlsx(planWorkbook(input), planFileName(input.couple));
}
