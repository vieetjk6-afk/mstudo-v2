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
import type { XlsxRow, XlsxSheet } from "./xlsx.ts";

/**
 * Nạp bộ ghi .xlsx CHỈ khi người dùng thật sự bấm nút xuất file.
 *
 * ./xlsx.ts kéo theo JSZip (~95 KB đã nén) để dựng OOXML. Nhập tĩnh thì JSZip
 * nằm trong bundle của MỌI màn có nút "Xuất Excel" — hợp đồng, khách hàng,
 * lương, báo cáo, thiệp — và tải về ngay lúc mở trang, dù phần lớn lượt xem
 * không bấm xuất lần nào. Chỉ mấy hàm export* dưới đây cần tới nó, nên để nó
 * đi cùng cú bấm chuột thay vì đi cùng trang.
 *
 * Các hàm *Workbook / *CsvRows ở trên KHÔNG đụng tới JSZip (chúng chỉ dựng dữ
 * liệu thuần), nên phần nặng thật sự tách được sạch sẽ ra khỏi đường tải trang.
 */
const loadDownloadXlsx = async () => (await import("./xlsx.ts")).downloadXlsx;

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

/* ── Đối soát tiền công ────────────────────────────────────────────────── */

export type PayrollExportRow = {
  name: string;
  phone: string;
  role: string;
  contract: string;
  code: string;
  date: string | null;
  salary: number;
  paid: boolean;
};

const PAYROLL_HEAD = ["STT", "Nhân sự", "SĐT", "Vai trò", "Hợp đồng", "Mã HĐ", "Ngày chụp", "Tiền công", "Tình trạng"];
const PAYROLL_COLS = [6, 24, 15, 16, 34, 14, 16, 16, 14];

/** Workbook đối soát tiền công: chi tiết từng lượt job + tổng theo nhân sự. */
export function payrollWorkbook(studio: ExportStudio, list: PayrollExportRow[], meta: string[]): XlsxSheet[] {
  const { rows: hdr, merges } = headerRows(studio, "ĐỐI SOÁT TIỀN CÔNG", meta, PAYROLL_COLS.length);
  const total = list.reduce((s, r) => s + r.salary, 0);
  const paid = list.filter((r) => r.paid).reduce((s, r) => s + r.salary, 0);

  const detail: XlsxRow[] = [
    ...hdr,
    head(PAYROLL_HEAD),
    ...list.map((r, i) => [
      { v: i + 1, s: "num" as const },
      { v: r.name, s: "cell" as const },
      { v: r.phone, s: "cell" as const },
      { v: r.role, s: "cell" as const },
      { v: r.contract, s: "cell" as const },
      { v: r.code, s: "cellMuted" as const },
      { v: dmy(r.date), s: "cell" as const },
      { v: r.salary, s: "money" as const },
      { v: r.paid ? "Đã trả" : "Chưa trả", s: r.paid ? ("cellMuted" as const) : ("cell" as const) },
    ]),
    [
      { v: "TỔNG CỘNG", s: "totalLabel" },
      { v: `${list.length} lượt job`, s: "totalLabel" },
      ...Array(5).fill({ v: "", s: "totalLabel" as const }),
      { v: total, s: "totalMoney" as const },
      { v: `Đã trả ${Math.round(total ? (paid / total) * 100 : 0)}%`, s: "totalLabel" as const },
    ],
  ];

  // Tổng theo người — bảng studio thực sự dùng khi chuyển khoản cuối kỳ.
  const byPerson = new Map<string, { name: string; phone: string; jobs: number; total: number; paid: number }>();
  for (const r of list) {
    const key = r.phone.replace(/\D/g, "") || r.name;
    const cur = byPerson.get(key) || { name: r.name, phone: r.phone, jobs: 0, total: 0, paid: 0 };
    cur.jobs += 1;
    cur.total += r.salary;
    if (r.paid) cur.paid += r.salary;
    byPerson.set(key, cur);
  }
  const people = [...byPerson.values()].sort((a, b) => b.total - a.total);
  const ph = headerRows(studio, "TỔNG THEO NHÂN SỰ", meta, 6);

  return [
    { name: "Chi tiết", cols: PAYROLL_COLS, rows: detail, merges, freezeRows: hdr.length + 1 },
    {
      name: "Theo nhân sự",
      cols: [24, 15, 10, 18, 18, 18],
      merges: ph.merges,
      rows: [
        ...ph.rows,
        head(["Nhân sự", "SĐT", "Số job", "Tổng tiền công", "Đã trả", "Còn phải trả"]),
        ...people.map((p) => [
          { v: p.name, s: "cell" as const },
          { v: p.phone, s: "cell" as const },
          { v: p.jobs, s: "num" as const },
          { v: p.total, s: "money" as const },
          { v: p.paid, s: "moneyIn" as const },
          { v: p.total - p.paid, s: "moneyOut" as const },
        ]),
        [
          { v: "TỔNG CỘNG", s: "totalLabel" },
          { v: "", s: "totalLabel" },
          { v: list.length, s: "totalLabel" },
          { v: total, s: "totalMoney" },
          { v: paid, s: "totalMoney" },
          { v: total - paid, s: "totalMoney" },
        ],
      ],
    },
  ];
}

export function payrollCsvRows(studio: ExportStudio, list: PayrollExportRow[], meta: string[]): string[][] {
  const total = list.reduce((s, r) => s + r.salary, 0);
  const paid = list.filter((r) => r.paid).reduce((s, r) => s + r.salary, 0);
  return [
    ...csvHeader(studio, "ĐỐI SOÁT TIỀN CÔNG", meta),
    PAYROLL_HEAD,
    ...list.map((r, i) => [
      String(i + 1), r.name, r.phone, r.role, r.contract, r.code, dmy(r.date), String(r.salary), r.paid ? "Đã trả" : "Chưa trả",
    ]),
    [],
    ["TỔNG CỘNG", `${list.length} lượt job`, "", "", "", "", "", String(total), `Đã trả ${paid}`],
  ];
}

/* ── Danh bạ khách hàng ────────────────────────────────────────────────── */

export type ClientExportRow = {
  name: string;
  phone: string;
  jobs: number;
  value: number;
  collected: number;
  last: string | null;
  source: string;
};

const CLIENT_HEAD = ["STT", "Khách hàng", "SĐT", "Số job", "Tổng giá trị", "Đã thu", "Còn nợ", "Lần chụp gần nhất", "Nguồn khách"];
const CLIENT_COLS = [6, 26, 15, 10, 18, 18, 18, 20, 18];

export function clientsWorkbook(studio: ExportStudio, list: ClientExportRow[], meta: string[]): XlsxSheet[] {
  const { rows: hdr, merges } = headerRows(studio, "DANH BẠ KHÁCH HÀNG", meta, CLIENT_COLS.length);
  const value = list.reduce((s, c) => s + c.value, 0);
  const collected = list.reduce((s, c) => s + c.collected, 0);
  const debt = list.reduce((s, c) => s + Math.max(0, c.value - c.collected), 0);
  const returning = list.filter((c) => c.jobs > 1).length;

  const rows: XlsxRow[] = [
    ...hdr,
    head(CLIENT_HEAD),
    ...list.map((c, i) => [
      { v: i + 1, s: "num" as const },
      { v: c.name, s: "cell" as const },
      { v: c.phone, s: "cell" as const },
      { v: c.jobs, s: "num" as const },
      { v: c.value, s: "money" as const },
      { v: c.collected, s: "moneyIn" as const },
      { v: Math.max(0, c.value - c.collected), s: "moneyOut" as const },
      { v: dmy(c.last), s: "cell" as const },
      { v: c.source, s: "cellMuted" as const },
    ]),
    [
      { v: "TỔNG CỘNG", s: "totalLabel" },
      { v: `${list.length} khách`, s: "totalLabel" },
      ...Array(2).fill({ v: "", s: "totalLabel" as const }),
      { v: value, s: "totalMoney" as const },
      { v: collected, s: "totalMoney" as const },
      { v: debt, s: "totalMoney" as const },
      ...Array(2).fill({ v: "", s: "totalLabel" as const }),
    ],
  ];

  const sh = headerRows(studio, "TỔNG HỢP KHÁCH HÀNG", meta, 5);
  const bySource = new Map<string, { n: number; value: number; collected: number }>();
  for (const c of list) {
    const k = c.source || "Không rõ";
    const cur = bySource.get(k) || { n: 0, value: 0, collected: 0 };
    cur.n += 1;
    cur.value += c.value;
    cur.collected += c.collected;
    bySource.set(k, cur);
  }

  return [
    { name: "Khách hàng", cols: CLIENT_COLS, rows, merges, freezeRows: hdr.length + 1 },
    {
      name: "Tổng hợp",
      cols: [30, 12, 18, 18, 18],
      merges: sh.merges,
      rows: [
        ...sh.rows,
        [{ v: "Chỉ số chung", s: "section" }],
        [{ v: "Số khách", s: "cell" }, { v: list.length, s: "num" }],
        [{ v: "Khách quay lại (≥2 job)", s: "cell" }, { v: returning, s: "num" }],
        [{ v: "Tỷ lệ quay lại", s: "cell" }, { v: list.length ? returning / list.length : 0, s: "pct" }],
        [{ v: "Tổng giá trị", s: "cell" }, { v: value, s: "money" }],
        [{ v: "Đã thu", s: "cell" }, { v: collected, s: "money" }],
        [{ v: "Đang còn nợ", s: "cell" }, { v: debt, s: "money" }],
        [{ v: "Giá trị trung bình / khách", s: "cell" }, { v: list.length ? Math.round(value / list.length) : 0, s: "money" }],
        [],
        [{ v: "Theo nguồn khách", s: "section" }],
        head(["Nguồn khách", "Số khách", "Giá trị", "Đã thu", "Còn nợ"]),
        ...[...bySource.entries()]
          .sort((a, b) => b[1].value - a[1].value)
          .map(([k, v]) => [
            { v: k, s: "cell" as const },
            { v: v.n, s: "num" as const },
            { v: v.value, s: "money" as const },
            { v: v.collected, s: "moneyIn" as const },
            { v: Math.max(0, v.value - v.collected), s: "moneyOut" as const },
          ]),
      ],
    },
  ];
}

export function clientsCsvRows(studio: ExportStudio, list: ClientExportRow[], meta: string[]): string[][] {
  const value = list.reduce((s, c) => s + c.value, 0);
  const collected = list.reduce((s, c) => s + c.collected, 0);
  return [
    ...csvHeader(studio, "DANH BẠ KHÁCH HÀNG", meta),
    CLIENT_HEAD,
    ...list.map((c, i) => [
      String(i + 1), c.name, c.phone, String(c.jobs), String(c.value), String(c.collected),
      String(Math.max(0, c.value - c.collected)), dmy(c.last), c.source,
    ]),
    [],
    ["TỔNG CỘNG", `${list.length} khách`, "", "", String(value), String(collected), String(value - collected), "", ""],
  ];
}

/* ── Khách mời thiệp cưới (RSVP) ───────────────────────────────────────── */

export type RsvpExportRow = {
  name: string;
  side: string;
  attending: boolean;
  guests: number;
  wish: string;
  at: string;
};

const RSVP_HEAD = ["STT", "Tên khách", "Bên", "Tham dự", "Số người", "Lời chúc", "Thời gian phản hồi"];
const RSVP_COLS = [6, 26, 12, 12, 12, 52, 20];

export function rsvpWorkbook(studio: ExportStudio, list: RsvpExportRow[], title: string, meta: string[]): XlsxSheet[] {
  const { rows: hdr, merges } = headerRows(studio, title, meta, RSVP_COLS.length);
  const going = list.filter((r) => r.attending);
  const heads = going.reduce((s, r) => s + (r.guests || 1), 0);
  return [
    {
      name: "Khách mời",
      cols: RSVP_COLS,
      merges,
      freezeRows: hdr.length + 1,
      rows: [
        ...hdr,
        head(RSVP_HEAD),
        ...list.map((r, i) => [
          { v: i + 1, s: "num" as const },
          { v: r.name, s: "cell" as const },
          { v: r.side, s: "cell" as const },
          { v: r.attending ? "Có" : "Không", s: "cell" as const },
          { v: r.guests, s: "num" as const },
          { v: r.wish, s: "cellMuted" as const },
          { v: r.at, s: "cell" as const },
        ]),
        [
          { v: "TỔNG CỘNG", s: "totalLabel" },
          { v: `${list.length} phản hồi`, s: "totalLabel" },
          { v: "", s: "totalLabel" },
          { v: `${going.length} nhận lời`, s: "totalLabel" },
          { v: heads, s: "totalLabel" },
          { v: "", s: "totalLabel" },
          { v: "", s: "totalLabel" },
        ],
      ],
    },
  ];
}

export function rsvpCsvRows(studio: ExportStudio, list: RsvpExportRow[], title: string, meta: string[]): string[][] {
  const going = list.filter((r) => r.attending);
  return [
    ...csvHeader(studio, title, meta),
    RSVP_HEAD,
    ...list.map((r, i) => [
      String(i + 1), r.name, r.side, r.attending ? "Có" : "Không", String(r.guests), r.wish, r.at,
    ]),
    [],
    ["TỔNG CỘNG", `${list.length} phản hồi`, "", `${going.length} nhận lời`, String(going.reduce((s, r) => s + (r.guests || 1), 0)), "", ""],
  ];
}

/* ── Tải xuống ─────────────────────────────────────────────────────────── */

export async function exportContracts(
  studio: ExportStudio,
  list: ContractExportRow[],
  meta: string[],
  fileName: string
): Promise<void> {
  const downloadXlsx = await loadDownloadXlsx();
  await downloadXlsx(contractsWorkbook(studio, list, meta), fileName);
}

export async function exportFinance(studio: ExportStudio, d: FinanceExport, fileName: string): Promise<void> {
  const downloadXlsx = await loadDownloadXlsx();
  await downloadXlsx(financeWorkbook(studio, d), fileName);
}

export async function exportPayroll(
  studio: ExportStudio,
  list: PayrollExportRow[],
  meta: string[],
  fileName: string
): Promise<void> {
  const downloadXlsx = await loadDownloadXlsx();
  await downloadXlsx(payrollWorkbook(studio, list, meta), fileName);
}

export async function exportClients(
  studio: ExportStudio,
  list: ClientExportRow[],
  meta: string[],
  fileName: string
): Promise<void> {
  const downloadXlsx = await loadDownloadXlsx();
  await downloadXlsx(clientsWorkbook(studio, list, meta), fileName);
}

export async function exportRsvps(
  studio: ExportStudio,
  list: RsvpExportRow[],
  title: string,
  meta: string[],
  fileName: string
): Promise<void> {
  const downloadXlsx = await loadDownloadXlsx();
  await downloadXlsx(rsvpWorkbook(studio, list, title, meta), fileName);
}
