/**
 * Hồ sơ xuất dữ liệu của studio — Excel (.xlsx) và CSV — dùng chung một bố cục:
 * khối thông tin studio ở đầu file, bảng có tiêu đề rõ ràng, dòng tổng cộng, và
 * (với file thu chi) một sheet tổng quan kèm BIỂU ĐỒ CỘT thật của Excel.
 *
 * Trước đây mỗi màn tự nối chuỗi CSV: mở file lên chỉ thấy một khối text, không
 * biết của studio nào, kỳ nào, tổng bao nhiêu. Gom về đây để hai màn (danh sách
 * hợp đồng, thu chi & công nợ) xuất ra cùng một kiểu trình bày.
 */
// Import tương đối (không qua alias "@/") để chạy được cả trong kiểm thử
// `node --experimental-strip-types` ở desktop/test.
import { downloadXlsx, type XlsxRow, type XlsxSheet } from "./xlsx.ts";

export type ExportStudio = {
  name: string;
  phone?: string | null;
  email?: string | null;
  /** Tên miền trang studio, nếu có. */
  site?: string | null;
};

const dd = (n: number) => String(n).padStart(2, "0");

/** "17/08/2026 14:05" theo giờ máy người dùng. */
export function stamp(d = new Date()): string {
  return `${dd(d.getDate())}/${dd(d.getMonth() + 1)}/${d.getFullYear()} ${dd(d.getHours())}:${dd(d.getMinutes())}`;
}

/** "2026-08-17" → "17/08/2026" (giữ nguyên nếu không phải dạng ngày ISO). */
export function dmy(s?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s ?? "");
}

/**
 * Khối đầu file: tên studio, liên hệ, tên báo cáo, kỳ báo cáo, thời điểm xuất.
 * `width` là số cột của bảng bên dưới để gộp ô cho cân.
 */
export function headerRows(
  studio: ExportStudio,
  title: string,
  meta: string[],
  width: number
): { rows: XlsxRow[]; merges: string[] } {
  const contact = [studio.phone && `ĐT: ${studio.phone}`, studio.email, studio.site].filter(Boolean).join("  ·  ");
  const rows: XlsxRow[] = [
    [{ v: studio.name || "Studio", s: "brand" }],
    contact ? [{ v: contact, s: "muted" }] : [],
    [{ v: title, s: "title" }],
    ...meta.map((m) => [{ v: m, s: "muted" }] as XlsxRow),
    [],
  ];
  const last = String.fromCharCode(65 + Math.max(0, Math.min(25, width - 1)));
  const merges = rows
    .map((r, i) => (r.length ? `A${i + 1}:${last}${i + 1}` : ""))
    .filter(Boolean);
  return { rows, merges };
}

/** Hàng tiêu đề bảng. */
const head = (labels: string[]): XlsxRow => labels.map((v) => ({ v, s: "head" as const }));

/* ── CSV ───────────────────────────────────────────────────────────────── */

/**
 * CSV giữ lại cho ai cần nạp vào công cụ khác. Vẫn có khối đầu file + dòng tổng
 * để mở bằng Excel/Google Sheets là đọc được ngay, không phải đoán cột.
 * BOM ở đầu để Excel bản Windows không hiển thị tiếng Việt thành ký tự lạ.
 */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

export function downloadCsv(rows: (string | number | null | undefined)[][], fileName: string): void {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Khối đầu file cho bản CSV (cùng nội dung với bản Excel). */
export function csvHeader(studio: ExportStudio, title: string, meta: string[]): string[][] {
  const contact = [studio.phone && `ĐT: ${studio.phone}`, studio.email, studio.site].filter(Boolean).join(" · ");
  return [[studio.name || "Studio"], ...(contact ? [[contact]] : []), [title], ...meta.map((m) => [m]), []];
}

/* ── Hợp đồng ──────────────────────────────────────────────────────────── */

export type ContractExportRow = {
  code: string;
  title: string;
  client: string;
  phone: string;
  service: string;
  eventDate: string | null;
  eventTime: string | null;
  status: string;
  crew: string;
  total: number;
  collected: number;
  balance: number;
};

const CONTRACT_COLS = [6, 14, 34, 22, 15, 20, 16, 15, 22, 16, 16, 16];
const CONTRACT_HEAD = [
  "STT", "Mã HĐ", "Tên hợp đồng", "Khách hàng", "SĐT", "Dịch vụ",
  "Ngày chụp", "Trạng thái", "Nhân sự", "Giá trị HĐ", "Đã thu", "Còn lại",
];

function contractDataRows(list: ContractExportRow[]): XlsxRow[] {
  return list.map((c, i) => [
    { v: i + 1, s: "num" as const },
    { v: c.code, s: "cell" as const },
    { v: c.title, s: "cell" as const },
    { v: c.client, s: "cell" as const },
    { v: c.phone, s: "cell" as const },
    { v: c.service, s: "cell" as const },
    { v: [dmy(c.eventDate), c.eventTime].filter(Boolean).join(" · "), s: "cell" as const },
    { v: c.status, s: "cell" as const },
    { v: c.crew, s: "cellMuted" as const },
    { v: c.total, s: "money" as const },
    { v: c.collected, s: "moneyIn" as const },
    { v: c.balance, s: c.balance > 0 ? ("moneyOut" as const) : ("money" as const) },
  ]);
}

/** Bảng tổng hợp theo một tiêu chí (trạng thái / dịch vụ). */
function groupRows(list: ContractExportRow[], key: (c: ContractExportRow) => string, label: string): XlsxRow[] {
  const map = new Map<string, { n: number; total: number; collected: number }>();
  for (const c of list) {
    const k = key(c) || "—";
    const cur = map.get(k) || { n: 0, total: 0, collected: 0 };
    cur.n += 1;
    cur.total += c.total;
    cur.collected += c.collected;
    map.set(k, cur);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  return [
    [{ v: label, s: "section" }],
    head([label, "Số HĐ", "Giá trị", "Đã thu", "Còn lại"]),
    ...sorted.map(([k, v]) => [
      { v: k, s: "cell" as const },
      { v: v.n, s: "num" as const },
      { v: v.total, s: "money" as const },
      { v: v.collected, s: "moneyIn" as const },
      { v: v.total - v.collected, s: "moneyOut" as const },
    ]),
    [],
  ];
}

/** Workbook danh sách hợp đồng: sheet chi tiết + sheet tổng hợp. */
export function contractsWorkbook(
  studio: ExportStudio,
  list: ContractExportRow[],
  meta: string[]
): XlsxSheet[] {
  const { rows: hdr, merges } = headerRows(studio, "DANH SÁCH HỢP ĐỒNG", meta, CONTRACT_COLS.length);
  const total = list.reduce((s, c) => s + c.total, 0);
  const collected = list.reduce((s, c) => s + c.collected, 0);

  const rows: XlsxRow[] = [
    ...hdr,
    head(CONTRACT_HEAD),
    ...contractDataRows(list),
    [
      { v: "TỔNG CỘNG", s: "totalLabel" },
      { v: `${list.length} hợp đồng`, s: "totalLabel" },
      ...Array(7).fill({ v: "", s: "totalLabel" as const }),
      { v: total, s: "totalMoney" as const },
      { v: collected, s: "totalMoney" as const },
      { v: total - collected, s: "totalMoney" as const },
    ],
  ];

  const summary: XlsxRow[] = [
    ...headerRows(studio, "TỔNG HỢP HỢP ĐỒNG", meta, 5).rows,
    [{ v: "Chỉ số chung", s: "section" }],
    ...([
      ["Số hợp đồng", list.length],
      ["Tổng giá trị", total],
      ["Đã thu", collected],
      ["Còn phải thu", total - collected],
      ["Tỷ lệ đã thu", total > 0 ? collected / total : 0],
    ] as [string, number][]).map(([k, v], i) => [
      { v: k, s: "cell" as const },
      { v, s: i === 0 ? ("num" as const) : i === 4 ? ("pct" as const) : ("money" as const) },
    ]),
    [],
    ...groupRows(list, (c) => c.status, "Theo trạng thái"),
    ...groupRows(list, (c) => c.service, "Theo dịch vụ"),
  ];

  return [
    {
      name: "Hợp đồng",
      cols: CONTRACT_COLS,
      rows,
      merges,
      freezeRows: hdr.length + 1,
    },
    { name: "Tổng hợp", cols: [30, 12, 18, 18, 18], rows: summary },
  ];
}

/** Bản CSV của danh sách hợp đồng (cùng cột với sheet Excel). */
export function contractsCsvRows(studio: ExportStudio, list: ContractExportRow[], meta: string[]): string[][] {
  const total = list.reduce((s, c) => s + c.total, 0);
  const collected = list.reduce((s, c) => s + c.collected, 0);
  return [
    ...csvHeader(studio, "DANH SÁCH HỢP ĐỒNG", meta),
    CONTRACT_HEAD,
    ...list.map((c, i) => [
      String(i + 1), c.code, c.title, c.client, c.phone, c.service,
      [dmy(c.eventDate), c.eventTime].filter(Boolean).join(" "), c.status, c.crew,
      String(c.total), String(c.collected), String(c.balance),
    ]),
    [],
    ["TỔNG CỘNG", `${list.length} hợp đồng`, "", "", "", "", "", "", "", String(total), String(collected), String(total - collected)],
  ];
}

/* ── Thu chi ───────────────────────────────────────────────────────────── */

export type MoneyRow = {
  date: string;
  /** "Đặt cọc", "Tiền công", "Chi phí khác"… */
  kind: string;
  title: string;
  /** Hợp đồng / danh mục liên quan. */
  ref: string;
  amount: number;
};

export type MonthPoint = { label: string; income: number; expense: number };

export type FinanceExport = {
  /** "Tháng 8/2026" hoặc "Năm 2026". */
  periodLabel: string;
  income: MoneyRow[];
  outflow: MoneyRow[];
  salaryTotal: number;
  expenseTotal: number;
  /** Chuỗi tháng để vẽ biểu đồ (12 tháng của năm, hoặc 12 tháng gần nhất). */
  series: MonthPoint[];
  seriesTitle: string;
  sources?: { label: string; count: number; value: number; collected: number }[];
  target?: number;
};

function moneySheet(
  studio: ExportStudio,
  title: string,
  meta: string[],
  rows: MoneyRow[],
  moneyStyle: "moneyIn" | "moneyOut"
): XlsxSheet {
  const cols = [6, 14, 20, 40, 34, 18];
  const { rows: hdr, merges } = headerRows(studio, title, meta, cols.length);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return {
    name: moneyStyle === "moneyIn" ? "Tiền vào" : "Tiền ra",
    cols,
    merges,
    freezeRows: hdr.length + 1,
    rows: [
      ...hdr,
      head(["STT", "Ngày", "Loại", "Nội dung", "Hợp đồng / danh mục", "Số tiền"]),
      ...(rows.length
        ? rows.map((r, i) => [
            { v: i + 1, s: "num" as const },
            { v: dmy(r.date), s: "cell" as const },
            { v: r.kind, s: "cell" as const },
            { v: r.title, s: "cell" as const },
            { v: r.ref, s: "cellMuted" as const },
            { v: r.amount, s: moneyStyle },
          ])
        : [[{ v: "Không có khoản nào trong kỳ.", s: "cellMuted" as const }]]),
      [
        { v: "TỔNG CỘNG", s: "totalLabel" },
        { v: `${rows.length} khoản`, s: "totalLabel" },
        ...Array(3).fill({ v: "", s: "totalLabel" as const }),
        { v: total, s: "totalMoney" as const },
      ],
    ],
  };
}

/**
 * Workbook thu chi: sheet "Tổng quan" (chỉ số + bảng 12 tháng + biểu đồ cột),
 * sheet "Tiền vào", sheet "Tiền ra", và sheet nguồn khách nếu có dữ liệu.
 */
export function financeWorkbook(studio: ExportStudio, d: FinanceExport): XlsxSheet[] {
  const meta = [`Kỳ báo cáo: ${d.periodLabel}`, `Ngày xuất: ${stamp()}`];
  const incomeTotal = d.income.reduce((s, r) => s + r.amount, 0);
  const outTotal = d.outflow.reduce((s, r) => s + r.amount, 0);
  const profit = incomeTotal - outTotal;

  const cols = [22, 20, 20, 20, 4, 12, 12, 12, 12, 12, 12];
  const { rows: hdr, merges } = headerRows(studio, "BÁO CÁO THU CHI", meta, 4);

  const kpi: [string, number, "money" | "pct" | "num"][] = [
    ["Doanh thu (đã thu)", incomeTotal, "money"],
    ["Chi tiền công", d.salaryTotal, "money"],
    ["Chi phí khác", d.expenseTotal, "money"],
    ["Tổng chi", outTotal, "money"],
    ["Lợi nhuận", profit, "money"],
    ["Biên lợi nhuận", incomeTotal > 0 ? profit / incomeTotal : 0, "pct"],
    ...(d.target ? ([["Mục tiêu doanh thu", d.target, "money"], ["Tỷ lệ đạt mục tiêu", d.target > 0 ? incomeTotal / d.target : 0, "pct"]] as [string, number, "money" | "pct"][]) : []),
    ["Số lần thu", d.income.length, "num"],
    ["Số khoản chi", d.outflow.length, "num"],
  ];

  const overview: XlsxRow[] = [
    ...hdr,
    [{ v: "Chỉ số kỳ báo cáo", s: "section" }],
    ...kpi.map(([k, v, s]) => [{ v: k, s: "cell" as const }, { v, s }]),
    [],
    [{ v: d.seriesTitle, s: "section" }],
    head(["Tháng", "Tiền vào", "Tiền ra", "Lợi nhuận"]),
    ...d.series.map((m) => [
      { v: m.label, s: "cell" as const },
      { v: m.income, s: "moneyIn" as const },
      { v: m.expense, s: "moneyOut" as const },
      { v: m.income - m.expense, s: "money" as const },
    ]),
    [
      { v: "Cộng", s: "totalLabel" },
      { v: d.series.reduce((s, m) => s + m.income, 0), s: "totalMoney" },
      { v: d.series.reduce((s, m) => s + m.expense, 0), s: "totalMoney" },
      { v: d.series.reduce((s, m) => s + m.income - m.expense, 0), s: "totalMoney" },
    ],
  ];

  // Hàng tiêu đề của bảng 12 tháng (0-based) — biểu đồ trỏ vào chính bảng này
  // nên sửa số trong bảng là biểu đồ đổi theo.
  const seriesHeadRow = overview.length - d.series.length - 2;

  const sheets: XlsxSheet[] = [
    {
      name: "Tổng quan",
      cols,
      rows: overview,
      merges,
      chart: {
        title: d.seriesTitle,
        categories: d.series.map((m) => m.label),
        series: [
          { name: "Tiền vào", values: d.series.map((m) => m.income), color: "2563EB" },
          { name: "Tiền ra", values: d.series.map((m) => m.expense), color: "DC2626" },
        ],
        anchor: { col: 5, row: Math.max(1, seriesHeadRow - 1), cols: 6, rows: d.series.length + 2 },
        ref: { sheetName: "Tổng quan", catCol: 0, catRow: seriesHeadRow + 1, valCols: [1, 2], nameRow: seriesHeadRow },
      },
    },
    moneySheet(studio, "TIỀN VÀO", meta, d.income, "moneyIn"),
    moneySheet(studio, "TIỀN RA", meta, d.outflow, "moneyOut"),
  ];

  if (d.sources?.length) {
    const scols = [26, 12, 20, 20, 20];
    const sh = headerRows(studio, "NGUỒN KHÁCH (TOÀN THỜI GIAN)", [`Ngày xuất: ${stamp()}`], scols.length);
    const totalValue = d.sources.reduce((s, x) => s + x.value, 0);
    sheets.push({
      name: "Nguồn khách",
      cols: scols,
      merges: sh.merges,
      rows: [
        ...sh.rows,
        head(["Nguồn khách", "Số HĐ", "Giá trị HĐ", "Đã thu", "Tỷ trọng"]),
        ...d.sources.map((s) => [
          { v: s.label, s: "cell" as const },
          { v: s.count, s: "num" as const },
          { v: s.value, s: "money" as const },
          { v: s.collected, s: "moneyIn" as const },
          { v: totalValue > 0 ? s.value / totalValue : 0, s: "pct" as const },
        ]),
      ],
    });
  }

  return sheets;
}

/** Bản CSV của báo cáo thu chi — cùng nội dung, một bảng phẳng. */
export function financeCsvRows(studio: ExportStudio, d: FinanceExport): string[][] {
  const incomeTotal = d.income.reduce((s, r) => s + r.amount, 0);
  const outTotal = d.outflow.reduce((s, r) => s + r.amount, 0);
  const line = (r: MoneyRow, group: string) => [group, dmy(r.date), r.kind, r.title, r.ref, String(r.amount)];
  return [
    ...csvHeader(studio, "BÁO CÁO THU CHI", [`Kỳ báo cáo: ${d.periodLabel}`, `Ngày xuất: ${stamp()}`]),
    ["Nhóm", "Ngày", "Loại", "Nội dung", "Hợp đồng / danh mục", "Số tiền (VND)"],
    ...d.income.map((r) => line(r, "Tiền vào")),
    ...d.outflow.map((r) => line(r, "Tiền ra")),
    [],
    ["TỔNG THU", "", "", "", "", String(incomeTotal)],
    ["TỔNG CHI", "", "", "", "", String(outTotal)],
    ["LỢI NHUẬN", "", "", "", "", String(incomeTotal - outTotal)],
    [],
    [d.seriesTitle],
    ["Tháng", "Tiền vào", "Tiền ra", "Lợi nhuận"],
    ...d.series.map((m) => [m.label, String(m.income), String(m.expense), String(m.income - m.expense)]),
  ];
}

/* ── Tải xuống ─────────────────────────────────────────────────────────── */

export async function exportContracts(
  studio: ExportStudio,
  list: ContractExportRow[],
  meta: string[],
  fileName: string
): Promise<void> {
  await downloadXlsx(contractsWorkbook(studio, list, meta), fileName);
}

export async function exportFinance(studio: ExportStudio, d: FinanceExport, fileName: string): Promise<void> {
  await downloadXlsx(financeWorkbook(studio, d), fileName);
}
