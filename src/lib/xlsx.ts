/**
 * Bộ ghi file Excel (.xlsx) tối giản — dựng OOXML bằng JSZip, không thêm thư
 * viện ngoài.
 *
 * Vì sao cần: các nút "Xuất CSV" trước đây đổ ra một khối text thô — mở lên là
 * một cột chữ dính liền, không tiêu đề, không định dạng tiền, không tổng cộng.
 * File Excel thật cho phép: khối thông tin studio ở đầu file, hàng tiêu đề có
 * nền, cột rộng đúng nội dung, tiền hiện "1.500.000 đ" và VẪN cộng được bằng
 * SUM, khoá dòng tiêu đề khi cuộn, nhiều sheet, và biểu đồ cột thật của Excel.
 *
 * Phạm vi cố ý hẹp (chuỗi/số/công thức, một bộ style dựng sẵn, một biểu đồ cột
 * mỗi sheet) — vừa đủ cho báo cáo của studio, không nhận thêm phần phức tạp
 * của đặc tả OOXML.
 */
import JSZip from "jszip";

/** Style dựng sẵn — xem bảng cellXfs trong styles.xml bên dưới. */
export type XlsxStyle =
  | "default"
  | "title"       // tên báo cáo, chữ to đậm
  | "brand"       // tên studio
  | "muted"       // dòng phụ màu xám
  | "label"       // nhãn "Kỳ báo cáo:", "Ngày xuất:"
  | "section"     // tiêu đề khối
  | "head"        // hàng tiêu đề bảng (nền đậm, chữ trắng)
  | "cell"        // ô chữ trong bảng
  | "cellMuted"   // ô chữ phụ trong bảng
  | "num"         // số nguyên
  | "money"       // tiền
  | "moneyIn"     // tiền vào (xanh)
  | "moneyOut"    // tiền ra (đỏ)
  | "totalLabel"  // nhãn dòng tổng
  | "totalMoney"  // tiền ở dòng tổng
  | "pct";        // phần trăm

const STYLE_INDEX: Record<XlsxStyle, number> = {
  default: 0, title: 1, brand: 2, muted: 3, label: 4, section: 5, head: 6,
  cell: 7, cellMuted: 8, num: 9, money: 10, moneyIn: 11, moneyOut: 12,
  totalLabel: 13, totalMoney: 14, pct: 15,
};

export type XlsxCell =
  | string
  | number
  | null
  | undefined
  | { v?: string | number | null; s?: XlsxStyle; f?: string };

export type XlsxRow = XlsxCell[];

/** Biểu đồ cột: mỗi series là một cột số trong chính sheet đó. */
export type XlsxChart = {
  title: string;
  /** Nhãn trục ngang (tên tháng…). */
  categories: string[];
  series: { name: string; values: number[]; color: string }[];
  /** Ô neo góc trên–trái (0-based) và kích thước theo số ô. */
  anchor: { col: number; row: number; cols: number; rows: number };
  /** Cột/hàng chứa dữ liệu nguồn để biểu đồ liên kết ngược lại bảng. */
  ref: { sheetName: string; catCol: number; catRow: number; valCols: number[]; nameRow: number };
};

export type XlsxSheet = {
  name: string;
  /** Bề rộng cột (đơn vị ký tự Excel). */
  cols?: number[];
  rows: XlsxRow[];
  /** Số dòng đầu giữ cố định khi cuộn. */
  freezeRows?: number;
  /** Vùng gộp ô, ví dụ "A1:F1". */
  merges?: string[];
  chart?: XlsxChart;
};

/* ── Tiện ích ──────────────────────────────────────────────────────────── */

const escXml = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Thuộc tính trong bộ ghi này luôn dùng nháy kép nên chỉ cần thoát `"`;
    // để nguyên nháy đơn cho vùng tham chiếu 'Tên sheet'!$B$20 đọc được.
    .replace(/"/g, "&quot;")
    // Ký tự điều khiển không hợp lệ trong XML 1.0 → Excel báo file hỏng.
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");

/** 0 → "A", 25 → "Z", 26 → "AA". */
export function colName(i: number): string {
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/** Ô Excel từ chỉ số 0-based: (0,0) → "A1". */
export const cellRef = (col: number, row: number) => `${colName(col)}${row + 1}`;

/** Tên sheet hợp lệ: bỏ ký tự Excel cấm, tối đa 31 ký tự. */
function safeSheetName(s: string, fallback: string): string {
  const out = String(s || "").replace(/[\\/*?:[\]]/g, " ").trim().slice(0, 31);
  return out || fallback;
}

/* ── styles.xml ────────────────────────────────────────────────────────── */

/**
 * Font của mọi file xuất ra. Times New Roman theo chuẩn văn bản hành chính
 * Việt Nam và khớp với bản in hợp đồng, nên bộ hồ sơ studio gửi đi trông cùng
 * một nhà. Có sẵn trên mọi máy Windows/Mac nên không lo máy nhận thay font.
 */
const FONT = "Times New Roman";

// numFmtId 164: tiền VND — vẫn là SỐ nên Excel cộng/lọc/vẽ biểu đồ được.
const MONEY_FMT = '#,##0" đ";[Red]-#,##0" đ"';

function stylesXml(): string {
  const fonts = [
    `<font><sz val="11"/><name val="${FONT}"/></font>`,                                        // 0 default
    `<font><b/><sz val="16"/><color rgb="FF111111"/><name val="${FONT}"/></font>`,             // 1 title
    `<font><b/><sz val="12"/><color rgb="FF111111"/><name val="${FONT}"/></font>`,             // 2 brand
    `<font><sz val="10"/><color rgb="FF6B7280"/><name val="${FONT}"/></font>`,                 // 3 muted
    `<font><b/><sz val="10"/><color rgb="FF6B7280"/><name val="${FONT}"/></font>`,             // 4 label
    `<font><b/><sz val="12"/><color rgb="FF111111"/><name val="${FONT}"/></font>`,             // 5 section
    `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="${FONT}"/></font>`,             // 6 head
    `<font><b/><sz val="11"/><color rgb="FF111111"/><name val="${FONT}"/></font>`,             // 7 bold
    `<font><sz val="11"/><color rgb="FF15803D"/><name val="${FONT}"/></font>`,                 // 8 green
    `<font><sz val="11"/><color rgb="FFB91C1C"/><name val="${FONT}"/></font>`,                 // 9 red
  ].join("");

  const fills = [
    `<fill><patternFill patternType="none"/></fill>`,
    `<fill><patternFill patternType="gray125"/></fill>`,
    `<fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/><bgColor indexed="64"/></patternFill></fill>`, // 2 head
    `<fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/><bgColor indexed="64"/></patternFill></fill>`, // 3 total
  ].join("");

  const thin = `<left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom>`;
  const borders = [
    `<border><left/><right/><top/><bottom/><diagonal/></border>`,
    `<border>${thin}<diagonal/></border>`,
    `<border><left/><right/><top style="medium"><color rgb="FF1F2937"/></top><bottom/><diagonal/></border>`, // 2 dòng tổng
  ].join("");

  // Thứ tự phải khớp STYLE_INDEX.
  const xf = (o: { font?: number; fill?: number; border?: number; fmt?: number; align?: string; wrap?: boolean }) =>
    `<xf numFmtId="${o.fmt ?? 0}" fontId="${o.font ?? 0}" fillId="${o.fill ?? 0}" borderId="${o.border ?? 0}" xfId="0"` +
    `${o.fmt ? ' applyNumberFormat="1"' : ""}${o.font ? ' applyFont="1"' : ""}${o.fill ? ' applyFill="1"' : ""}` +
    `${o.border ? ' applyBorder="1"' : ""}${o.align || o.wrap ? ' applyAlignment="1"' : ""}>` +
    `${o.align || o.wrap ? `<alignment${o.align ? ` horizontal="${o.align}"` : ""} vertical="center"${o.wrap ? ' wrapText="1"' : ""}/>` : ""}</xf>`;

  const cellXfs = [
    xf({}),                                                            // default
    xf({ font: 1 }),                                                   // title
    xf({ font: 2 }),                                                   // brand
    xf({ font: 3 }),                                                   // muted
    xf({ font: 4 }),                                                   // label
    xf({ font: 5 }),                                                   // section
    xf({ font: 6, fill: 2, border: 1, align: "center", wrap: true }),  // head
    xf({ border: 1, wrap: true }),                                     // cell
    xf({ font: 3, border: 1 }),                                        // cellMuted
    xf({ border: 1, align: "center" }),                                // num
    xf({ border: 1, fmt: 164 }),                                       // money
    xf({ font: 8, border: 1, fmt: 164 }),                              // moneyIn
    xf({ font: 9, border: 1, fmt: 164 }),                              // moneyOut
    xf({ font: 7, fill: 3, border: 2 }),                               // totalLabel
    xf({ font: 7, fill: 3, border: 2, fmt: 164 }),                     // totalMoney
    xf({ border: 1, fmt: 9, align: "center" }),                        // pct (0%)
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="${escXml(MONEY_FMT)}"/></numFmts>
<fonts count="10">${fonts}</fonts>
<fills count="4">${fills}</fills>
<borders count="3">${borders}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="16">${cellXfs}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

/* ── sheet.xml ─────────────────────────────────────────────────────────── */

function sheetXml(sheet: XlsxSheet, hasDrawing: boolean): string {
  const rows = sheet.rows
    .map((cells, r) => {
      const inner = cells
        .map((raw, c) => {
          const cell = raw && typeof raw === "object" ? raw : { v: raw as string | number | null, s: undefined, f: undefined };
          const style = cell.s ? STYLE_INDEX[cell.s] : 0;
          const ref = cellRef(c, r);
          const sAttr = style ? ` s="${style}"` : "";
          if (cell.f) return `<c r="${ref}"${sAttr}><f>${escXml(cell.f)}</f></c>`;
          if (cell.v === null || cell.v === undefined || cell.v === "") {
            return style ? `<c r="${ref}"${sAttr}/>` : "";
          }
          if (typeof cell.v === "number" && Number.isFinite(cell.v)) {
            return `<c r="${ref}"${sAttr}><v>${cell.v}</v></c>`;
          }
          return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${escXml(String(cell.v))}</t></is></c>`;
        })
        .join("");
      return inner ? `<row r="${r + 1}">${inner}</row>` : "";
    })
    .join("");

  const lastCol = Math.max(1, ...sheet.rows.map((r) => r.length));
  const dim = `A1:${cellRef(lastCol - 1, Math.max(0, sheet.rows.length - 1))}`;
  const cols = sheet.cols?.length
    ? `<cols>${sheet.cols
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join("")}</cols>`
    : "";
  const freeze = sheet.freezeRows
    ? `<pane ySplit="${sheet.freezeRows}" topLeftCell="A${sheet.freezeRows + 1}" activePane="bottomLeft" state="frozen"/>`
    : "";
  const merges = sheet.merges?.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="${dim}"/>
<sheetViews><sheetView workbookViewId="0" showGridLines="0">${freeze}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
${cols}
<sheetData>${rows}</sheetData>
${merges}
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
${hasDrawing ? `<drawing r:id="rId1"/>` : ""}
</worksheet>`;
}

/* ── Biểu đồ ───────────────────────────────────────────────────────────── */

function chartXml(ch: XlsxChart): string {
  const sheetRef = `'${ch.ref.sheetName.replace(/'/g, "''")}'`;
  const n = ch.categories.length;
  const catFrom = cellRef(ch.ref.catCol, ch.ref.catRow);
  const catTo = cellRef(ch.ref.catCol, ch.ref.catRow + n - 1);
  const catCache = ch.categories
    .map((c, i) => `<c:pt idx="${i}"><c:v>${escXml(c)}</c:v></c:pt>`)
    .join("");

  const series = ch.series
    .map((s, si) => {
      const col = ch.ref.valCols[si];
      const nameRef = `${sheetRef}!$${colName(col)}$${ch.ref.nameRow + 1}`;
      const valRef = `${sheetRef}!$${colName(col)}$${ch.ref.catRow + 1}:$${colName(col)}$${ch.ref.catRow + n}`;
      const pts = s.values
        .map((v, i) => `<c:pt idx="${i}"><c:v>${Number.isFinite(v) ? v : 0}</c:v></c:pt>`)
        .join("");
      return `<c:ser><c:idx val="${si}"/><c:order val="${si}"/>
<c:tx><c:strRef><c:f>${escXml(nameRef)}</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escXml(s.name)}</c:v></c:pt></c:strCache></c:strRef></c:tx>
<c:spPr><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill></c:spPr>
<c:cat><c:strRef><c:f>${escXml(`${sheetRef}!$${colName(ch.ref.catCol)}$${ch.ref.catRow + 1}:$${colName(ch.ref.catCol)}$${ch.ref.catRow + n}`)}</c:f><c:strCache><c:ptCount val="${n}"/>${catCache}</c:strCache></c:strRef></c:cat>
<c:val><c:numRef><c:f>${escXml(valRef)}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${s.values.length}"/>${pts}</c:numCache></c:numRef></c:val>
</c:ser>`;
    })
    .join("");

  // Ghi chú: thứ tự phần tử trong lược đồ chart là BẮT BUỘC — đảo chỗ là Excel
  // báo "file cần sửa chữa" và bỏ luôn biểu đồ. Giữ nguyên trật tự dưới đây.
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<c:chart>
<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"><a:latin typeface="${FONT}"/></a:defRPr></a:pPr><a:r><a:rPr lang="vi-VN" sz="1200" b="1"><a:latin typeface="${FONT}"/></a:rPr><a:t>${escXml(ch.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>
<c:autoTitleDeleted val="0"/>
<c:plotArea><c:layout/>
<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>
${series}
<c:gapWidth val="60"/><c:overlap val="-10"/>
<c:axId val="111111111"/><c:axId val="222222222"/></c:barChart>
<c:catAx><c:axId val="111111111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="222222222"/></c:catAx>
<c:valAx><c:axId val="222222222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:numFmt formatCode="#,##0" sourceLinked="0"/><c:majorGridlines/><c:crossAx val="111111111"/></c:valAx>
</c:plotArea>
<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>
<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>
</c:chart>
<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"><a:latin typeface="${FONT}"/></a:defRPr></a:pPr><a:endParaRPr lang="vi-VN"/></a:p></c:txPr>
</c:chartSpace>`;
}

function drawingXml(ch: XlsxChart): string {
  const a = ch.anchor;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<xdr:twoCellAnchor>
<xdr:from><xdr:col>${a.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>${a.col + a.cols}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.row + a.rows}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Bieu do"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic>
</xdr:graphicFrame><xdr:clientData/>
</xdr:twoCellAnchor>
</xdr:wsDr>`;
}

/* ── Đóng gói ──────────────────────────────────────────────────────────── */

/**
 * Dựng cây file OOXML trong một JSZip. Tách khỏi buildXlsx() để kiểm thử ghi
 * được ra buffer của Node (JSZip chỉ xuất Blob khi chạy trong trình duyệt).
 */
export function xlsxZip(sheets: XlsxSheet[]): JSZip {
  const zip = new JSZip();
  const named = sheets.map((s, i) => ({ ...s, name: safeSheetName(s.name, `Sheet${i + 1}`) }));

  const overrides: string[] = [
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`,
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`,
  ];

  named.forEach((sheet, i) => {
    const n = i + 1;
    zip.file(`xl/worksheets/sheet${n}.xml`, sheetXml(sheet, !!sheet.chart));
    overrides.push(
      `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    );
    if (sheet.chart) {
      zip.file(`xl/charts/chart${n}.xml`, chartXml(sheet.chart));
      zip.file(`xl/drawings/drawing${n}.xml`, drawingXml(sheet.chart));
      zip.file(
        `xl/drawings/_rels/drawing${n}.xml.rels`,
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${n}.xml"/></Relationships>`
      );
      zip.file(
        `xl/worksheets/_rels/sheet${n}.xml.rels`,
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${n}.xml"/></Relationships>`
      );
      overrides.push(
        `<Override PartName="/xl/charts/chart${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
        `<Override PartName="/xl/drawings/drawing${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`
      );
    }
  });

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
${overrides.join("")}
</Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  );
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${named.map((s, i) => `<sheet name="${escXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
</workbook>`
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${named.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}
<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );
  zip.file("xl/styles.xml", stylesXml());
  return zip;
}

/** Dựng file .xlsx và trả về Blob để tải xuống. */
export async function buildXlsx(sheets: XlsxSheet[]): Promise<Blob> {
  return xlsxZip(sheets).generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    compression: "DEFLATE",
  });
}

/** Dựng workbook rồi tải về (dùng trong trình duyệt). */
export async function downloadXlsx(sheets: XlsxSheet[], fileName: string): Promise<void> {
  const blob = await buildXlsx(sheets);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
