/* Kiểm thử file xuất Excel/CSV của studio (src/lib/xlsx.ts, src/lib/studio-export.ts).
 *
 * Vì sao đáng test: file xuất ra là thứ studio gửi cho kế toán/chủ đầu tư, mà
 * lỗi ở đây không nổ ra màn hình — chỉ ra một file sai:
 *   • Biểu đồ trỏ nhầm hàng → cột "Tiền vào" vẽ bằng số của "Tiền ra".
 *   • Cộng thiếu một nhóm → dòng TỔNG CỘNG lệch với các dòng phía trên.
 *   • Ký tự XML không thoát (tên khách có "&", "<") → Excel báo file hỏng, mở
 *     không lên, và người dùng chỉ biết là "xuất ra bị lỗi".
 *   • Tên sheet quá 31 ký tự hoặc chứa []:*?/\\ → Excel từ chối cả workbook.
 */
import { xlsxZip, colName, cellRef } from "../../src/lib/xlsx.ts";
import {
  contractsWorkbook,
  financeWorkbook,
  contractsCsvRows,
  financeCsvRows,
  toCsv,
  dmy,
} from "../../src/lib/studio-export.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
const checkTrue = (name, got) => check(name, got, true);

const studio = { name: "Ánh Studio & Co", phone: "0906123456", email: "a@b.vn" };

// ── Tiện ích ô Excel ─────────────────────────────────────────────────────
check("cột 0 → A", colName(0), "A");
check("cột 25 → Z", colName(25), "Z");
check("cột 26 → AA", colName(26), "AA");
check("cột 27 → AB", colName(27), "AB");
check("ô (0,0) → A1", cellRef(0, 0), "A1");
check("ô (11,19) → L20", cellRef(11, 19), "L20");
check("ngày ISO → dd/mm/yyyy", dmy("2026-09-12"), "12/09/2026");
check("ngày rỗng → chuỗi rỗng", dmy(null), "");

// ── Hợp đồng ─────────────────────────────────────────────────────────────
const contracts = [
  { code: "HD-1", title: "Cưới A & B", client: "Trần <Lan>", phone: "091", service: "Chụp ảnh",
    eventDate: "2026-09-01", eventTime: "05:30", status: "Hoàn thành", crew: "Ánh", total: 10_000_000, collected: 6_000_000, balance: 4_000_000 },
  { code: "HD-2", title: "Kỷ yếu", client: "Nam", phone: "092", service: "Chụp ảnh",
    eventDate: "2026-09-05", eventTime: "", status: "Đã duyệt", crew: "Bình", total: 5_000_000, collected: 0, balance: 5_000_000 },
  { code: "HD-3", title: "Ngày cưới", client: "Hà", phone: "093", service: "Trọn gói ngày cưới",
    eventDate: null, eventTime: null, status: "Đã duyệt", crew: "", total: 20_000_000, collected: 20_000_000, balance: 0 },
];
const cw = contractsWorkbook(studio, contracts, ["Danh sách: Tất cả · 3 hợp đồng"]);
check("workbook hợp đồng có 2 sheet", cw.length, 2);
check("sheet chi tiết tên đúng", cw[0].name, "Hợp đồng");
checkTrue("có khối đầu file mang tên studio", JSON.stringify(cw[0].rows[0]).includes("Ánh Studio & Co"));
checkTrue("khoá dòng tiêu đề khi cuộn", (cw[0].freezeRows ?? 0) > 0);

const totalRow = cw[0].rows[cw[0].rows.length - 1];
check("tổng giá trị HĐ", totalRow[9].v, 35_000_000);
check("tổng đã thu", totalRow[10].v, 26_000_000);
check("tổng còn lại", totalRow[11].v, 9_000_000);
check("dòng tổng đếm đúng số HĐ", totalRow[1].v, "3 hợp đồng");
// Dòng tổng phải đúng cột với hàng dữ liệu, nếu không tiền rơi sang cột khác.
check("dòng tổng cùng số cột với hàng dữ liệu", totalRow.length, 12);

const summaryFlat = JSON.stringify(cw[1].rows);
checkTrue("sheet tổng hợp có nhóm theo trạng thái", summaryFlat.includes("Theo trạng thái"));
checkTrue("sheet tổng hợp có nhóm theo dịch vụ", summaryFlat.includes("Theo dịch vụ"));

// ── Thu chi ──────────────────────────────────────────────────────────────
const series = Array.from({ length: 12 }, (_, i) => ({ label: `T${i + 1}`, income: (i + 1) * 1e6, expense: i * 1e6 }));
const fin = {
  periodLabel: "Năm 2026",
  income: [{ date: "2026-08-02", kind: "Đặt cọc", title: "Đặt cọc", ref: "Cưới A & B", amount: 10_000_000 }],
  outflow: [
    { date: "2026-08-03", kind: "Tiền công", title: "Nguyễn B", ref: "Cưới A & B", amount: 3_000_000 },
    { date: "2026-08-09", kind: "Chi phí khác", title: "Thuê lens", ref: "Thiết bị", amount: 1_200_000 },
  ],
  salaryTotal: 3_000_000,
  expenseTotal: 1_200_000,
  series,
  seriesTitle: "Thu · chi 12 tháng năm 2026",
  sources: [{ label: "Facebook", count: 2, value: 30_000_000, collected: 10_000_000 }],
  target: 20_000_000,
};
const fw = financeWorkbook(studio, fin);
check("workbook thu chi có 4 sheet", fw.length, 4);
check("thứ tự sheet", fw.map((s) => s.name).join("|"), "Tổng quan|Tiền vào|Tiền ra|Nguồn khách");

const kpi = Object.fromEntries(
  fw[0].rows.filter((r) => r.length === 2 && typeof r[0]?.v === "string").map((r) => [r[0].v, r[1].v])
);
check("KPI doanh thu", kpi["Doanh thu (đã thu)"], 10_000_000);
check("KPI tổng chi = lương + chi khác", kpi["Tổng chi"], 4_200_000);
check("KPI lợi nhuận", kpi["Lợi nhuận"], 5_800_000);
check("KPI biên lợi nhuận", Math.round(kpi["Biên lợi nhuận"] * 100), 58);
check("KPI tỷ lệ đạt mục tiêu", Math.round(kpi["Tỷ lệ đạt mục tiêu"] * 100), 50);

// Biểu đồ phải trỏ ĐÚNG hàng tiêu đề và ĐÚNG 12 hàng dữ liệu của bảng tháng.
const ch = fw[0].chart;
const headIdx = fw[0].rows.findIndex((r) => r[0]?.v === "Tháng");
check("biểu đồ lấy tên series từ hàng tiêu đề bảng", ch.ref.nameRow, headIdx);
check("biểu đồ bắt đầu ở hàng dữ liệu đầu tiên", ch.ref.catRow, headIdx + 1);
check("biểu đồ có đúng 12 cột", ch.categories.length, 12);
check("series tiền vào lấy cột B", ch.ref.valCols[0], 1);
check("series tiền ra lấy cột C", ch.ref.valCols[1], 2);
check("giá trị series khớp bảng", fw[0].rows[headIdx + 1][1].v, ch.series[0].values[0]);
check("nhãn tháng khớp bảng", fw[0].rows[headIdx + 12][0].v, ch.categories[11]);

const outTotalRow = fw[2].rows[fw[2].rows.length - 1];
check("tổng tiền ra", outTotalRow[outTotalRow.length - 1].v, 4_200_000);

// ── Đóng gói .xlsx ───────────────────────────────────────────────────────
const zip = xlsxZip(fw);
const files = Object.keys(zip.files).filter((f) => !f.endsWith("/"));
for (const need of [
  "[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels",
  "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/charts/chart1.xml",
  "xl/drawings/drawing1.xml", "xl/drawings/_rels/drawing1.xml.rels", "xl/worksheets/_rels/sheet1.xml.rels",
]) {
  checkTrue(`gói có ${need}`, files.includes(need));
}
const sheet1 = await zip.file("xl/worksheets/sheet1.xml").async("string");
const chart1 = await zip.file("xl/charts/chart1.xml").async("string");
const types = await zip.file("[Content_Types].xml").async("string");
checkTrue("sheet nối tới drawing của biểu đồ", sheet1.includes('<drawing r:id="rId1"/>'));
checkTrue("khai báo content-type cho biểu đồ", types.includes("drawingml.chart+xml"));
checkTrue("biểu đồ trỏ vào đúng sheet", chart1.includes("'Tổng quan'!$B$"));
checkTrue("XML thoát dấu & trong dữ liệu", sheet1.includes("&amp;") && !/&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(sheet1));
checkTrue("tên khách có dấu ngoặc nhọn bị thoát", (await zip.file("xl/worksheets/sheet1.xml").async("string")).indexOf("<Lan>") === -1);

// Tên sheet dài/ký tự cấm phải được cắt gọt, nếu không Excel từ chối workbook.
const longName = xlsxZip([{ name: "Báo cáo thu chi năm 2026 của studio [bản nháp]", rows: [["x"]] }]);
const wbXml = await longName.file("xl/workbook.xml").async("string");
const sheetName = /name="([^"]+)"/.exec(wbXml)[1];
checkTrue("tên sheet ≤ 31 ký tự", sheetName.length <= 31);
checkTrue("tên sheet không còn ký tự cấm", !/[[\]:*?/\\]/.test(sheetName));

// ── CSV ──────────────────────────────────────────────────────────────────
const csv = toCsv(contractsCsvRows(studio, contracts, ["Danh sách: Tất cả"]));
checkTrue("CSV mở đầu bằng BOM (Excel Windows đọc đúng tiếng Việt)", csv.charCodeAt(0) === 0xfeff);
checkTrue("CSV có tên studio ở đầu file", csv.includes("Ánh Studio & Co"));
checkTrue("CSV có hàng tiêu đề cột", csv.includes("STT,Mã HĐ,Tên hợp đồng"));
checkTrue("CSV có dòng tổng cộng", csv.includes("TỔNG CỘNG"));
checkTrue("CSV bọc ngoặc kép ô có dấu phẩy", toCsv([["a,b"]]).includes('"a,b"'));
checkTrue("CSV nhân đôi dấu ngoặc kép bên trong ô", toCsv([['nói "xin chào"']]).includes('""xin chào""'));

const fcsv = toCsv(financeCsvRows(studio, fin));
checkTrue("CSV thu chi có kỳ báo cáo", fcsv.includes("Kỳ báo cáo: Năm 2026"));
checkTrue("CSV thu chi có bảng 12 tháng", fcsv.includes("Thu · chi 12 tháng năm 2026"));
checkTrue("CSV thu chi có dòng lợi nhuận", fcsv.includes("LỢI NHUẬN,,,,,5800000"));

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
