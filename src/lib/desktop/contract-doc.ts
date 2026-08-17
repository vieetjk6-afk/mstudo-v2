import JSZip from "jszip";
import { contractPrintDocument, type ContractPrintData } from "@/lib/contract-print";

/**
 * Sinh file hợp đồng cho MStudo Desktop:
 *  - HTML tự chứa (kiểu văn bản in A4) — client Windows chuyển thành PDF, bản
 *    PDF giữ nguyên ẢNH CHỮ KÝ của hai bên;
 *  - DOCX (Word) tối giản qua jszip — bản soạn thảo lại được, chữ ký thể hiện
 *    bằng dòng "Đã ký điện tử".
 */

export type ContractDocData = {
  studio: {
    name: string;
    /** Logo studio in trên đầu bản HTML/PDF. */
    logo?: string | null;
    phone?: string | null;
    email?: string | null;
    bankHolder?: string | null;
    bankAccount?: string | null;
    bankName?: string | null;
  };
  contract: {
    code?: string | null;
    title?: string | null;
    client_name?: string | null;
    client_phone?: string | null;
    client_email?: string | null;
    shoot_type?: string | null;
    event_date?: string | null;
    event_time?: string | null;
    location?: string | null;
    deposit?: number | null;
    note?: string | null;
    client_signed_name?: string | null;
    client_signature?: string | null;
    client_signed_at?: string | null;
    studio_signed_name?: string | null;
    studio_signature?: string | null;
    studio_signed_at?: string | null;
    created_at?: string | null;
  };
  items: { name: string; qty: number; unit_price: number }[];
  payments: { amount: number; kind?: string | null; paid_at?: string | null; note?: string | null }[];
};

const SHOOT_TYPES: Record<string, string> = {
  photo: "Chụp ảnh", video: "Quay phim", both: "Chụp ảnh & quay phim", psc: "Phóng sự cưới",
  makeup: "Trang điểm", rental: "Thuê trang phục", prewedding: "Chụp ảnh cưới (pre-wedding)",
  wedding: "Ngày cưới", other: "Dịch vụ khác",
};
const PAY_KINDS: Record<string, string> = { deposit: "Đặt cọc", installment: "Thanh toán đợt", final: "Tất toán", other: "Khác" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const vnd = (n: number | null | undefined) => (Number(n) || 0).toLocaleString("vi-VN") + " đ";
const dmy = (s?: string | null) => {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

/** Tên file/thư mục hợp lệ Windows (giữ tiếng Việt, bỏ ký tự cấm). */
export function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 150);
}

/**
 * Bản ASCII của tên file — dùng cho phần `filename=` trong HTTP header
 * Content-Disposition (header chỉ nhận Latin-1; ký tự tiếng Việt >255 sẽ ném
 * lỗi ByteString). Tên có dấu vẫn được giữ ở `filename*=UTF-8''`.
 */
export function asciiName(s: string): string {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/"/g, "");
}

// Đúng định dạng đã chốt: "Hợp đồng {mã HĐ} - {Tên khách} - {SĐT}".
export function contractBaseName(c: ContractDocData["contract"]): string {
  const head = "Hop dong" + (c.code ? ` ${c.code}` : "");
  const parts = [head, c.client_name || "", c.client_phone || ""].filter(Boolean);
  return safeFileName(parts.join(" - "));
}

function computeTotals(d: ContractDocData) {
  const total = d.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
  const paid = d.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return { total, paid, remain: Math.max(0, total - paid) };
}

// ─── HTML (client in ra PDF) ──────────────────────────────────────────────────

/**
 * Bản in A4 dùng CHUNG với nút "Xuất PDF" của studio và cổng khách — xem
 * src/lib/contract-print.ts. Desktop chỉ việc mở file HTML này rồi in ra PDF.
 */
export function buildContractHtml(d: ContractDocData): string {
  const c = d.contract;
  const { total, paid, remain } = computeTotals(d);
  const data: ContractPrintData = {
    docTitle: contractBaseName(c),
    // Bản desktop giữ quốc hiệu – tiêu ngữ như nếp cũ (studio hay in ra ký tay
    // rồi lưu hồ sơ giấy); bản in trên web để gọn nên không có.
    nationalHeading: true,
    title: c.title,
    code: c.code,
    issuedAt: dmy(c.created_at),
    studio: {
      name: d.studio.name,
      logo: d.studio.logo,
      phone: d.studio.phone,
      email: d.studio.email,
      bankHolder: d.studio.bankHolder,
      bankAccount: d.studio.bankAccount,
      bankName: d.studio.bankName,
    },
    client: { name: c.client_name, phone: c.client_phone, email: c.client_email },
    facts: [
      { label: "Dịch vụ", value: SHOOT_TYPES[c.shoot_type || ""] || c.shoot_type },
      { label: "Thời gian", value: [dmy(c.event_date), c.event_time].filter(Boolean).join(" · ") },
      { label: "Địa điểm", value: c.location, wide: true },
    ],
    items: d.items.map((it) => ({
      name: it.name,
      qty: it.qty,
      unitPrice: it.unit_price,
      amount: (Number(it.qty) || 0) * (Number(it.unit_price) || 0),
    })),
    totals: [
      { label: "Tổng giá trị hợp đồng", amount: total, strong: true },
      ...(c.deposit ? [{ label: "Tiền cọc", amount: Number(c.deposit) || 0 }] : []),
      { label: "Đã thanh toán", amount: paid, minus: true },
      { label: "Còn lại", amount: remain, bold: true },
    ],
    amountInWords: total,
    payments: d.payments.map((p) => ({
      date: dmy(p.paid_at),
      kind: PAY_KINDS[p.kind || ""] || p.kind,
      amount: p.amount,
      note: p.note,
    })),
    terms: c.note,
    signs: [
      {
        label: "Đại diện bên A",
        name: c.studio_signed_name || d.studio.name,
        image: c.studio_signature,
        signedAt: dmy(c.studio_signed_at),
      },
      {
        label: "Đại diện bên B",
        name: c.client_signed_name || c.client_name,
        image: c.client_signature,
        signedAt: dmy(c.client_signed_at),
      },
    ],
    footer: `Xuất từ mstudo ngày ${dmy(new Date().toISOString())}`,
  };
  // Không tự gọi in: desktop tải file về lưu vào thư mục hợp đồng, người dùng
  // mở lúc nào thì in lúc đó.
  return contractPrintDocument(data, { autoPrint: false });
}

// ─── DOCX (Word — bản soạn thảo) ─────────────────────────────────────────────

type ParaOpts = { bold?: boolean; italic?: boolean; size?: number; align?: "center" | "right" | "both"; caps?: boolean };

function wPara(text: string, o: ParaOpts = {}): string {
  const sz = (o.size ?? 13) * 2; // half-points
  const rPr = `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>${o.bold ? "<w:b/>" : ""}${o.italic ? "<w:i/>" : ""}${o.caps ? "<w:caps/>" : ""}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`;
  const pPr = `<w:pPr>${o.align ? `<w:jc w:val="${o.align}"/>` : ""}</w:pPr>`;
  const lines = String(text ?? "").split("\n");
  const runs = lines
    .map((l, i) => `<w:r>${rPr}${i > 0 ? "<w:br/>" : ""}<w:t xml:space="preserve">${esc(l)}</w:t></w:r>`)
    .join("");
  return `<w:p>${pPr}${runs}</w:p>`;
}

function wCell(text: string, o: ParaOpts & { width?: number } = {}): string {
  return `<w:tc><w:tcPr>${o.width ? `<w:tcW w:w="${o.width}" w:type="dxa"/>` : ""}</w:tcPr>${wPara(text, { size: 12, ...o })}</w:tc>`;
}

function wTable(rows: string[]): string {
  const borders = ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="666666"/>`)
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr>${rows.join("")}</w:tbl>`;
}

export async function buildContractDocx(d: ContractDocData): Promise<Uint8Array> {
  const c = d.contract;
  const { total, paid, remain } = computeTotals(d);
  const body: string[] = [];
  body.push(wPara("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { bold: true, align: "center" }));
  body.push(wPara("Độc lập – Tự do – Hạnh phúc", { bold: true, align: "center" }));
  body.push(wPara("――――――――――", { align: "center" }));
  body.push(wPara(c.title || "Hợp đồng dịch vụ", { bold: true, size: 16, align: "center", caps: true }));
  body.push(wPara(`Số: ${c.code || ""}${c.created_at ? ` · Ngày lập: ${dmy(c.created_at)}` : ""}`, { italic: true, align: "center" }));
  body.push(wPara(""));
  body.push(wPara("BÊN A (BÊN CUNG CẤP DỊCH VỤ)", { bold: true }));
  body.push(wPara(d.studio.name, { bold: true }));
  if (d.studio.phone) body.push(wPara(`Điện thoại: ${d.studio.phone}`));
  if (d.studio.email) body.push(wPara(`Email: ${d.studio.email}`));
  if (d.studio.bankAccount) body.push(wPara(`Tài khoản: ${d.studio.bankAccount}${d.studio.bankName ? ` · ${d.studio.bankName}` : ""}${d.studio.bankHolder ? ` · ${d.studio.bankHolder}` : ""}`));
  body.push(wPara(""));
  body.push(wPara("BÊN B (KHÁCH HÀNG)", { bold: true }));
  body.push(wPara(c.client_name || "", { bold: true }));
  if (c.client_phone) body.push(wPara(`Điện thoại: ${c.client_phone}`));
  if (c.client_email) body.push(wPara(`Email: ${c.client_email}`));
  body.push(wPara(""));
  body.push(wPara("NỘI DUNG DỊCH VỤ", { bold: true }));
  body.push(wPara(`Loại dịch vụ: ${SHOOT_TYPES[c.shoot_type || ""] || c.shoot_type || ""}`));
  if (c.event_date) body.push(wPara(`Thời gian: ${dmy(c.event_date)}${c.event_time ? ` · ${c.event_time}` : ""}`));
  if (c.location) body.push(wPara(`Địa điểm: ${c.location}`));
  if (d.items.length) {
    body.push(wPara(""));
    body.push(wPara("HẠNG MỤC & CHI PHÍ", { bold: true }));
    const header = `<w:tr>${wCell("STT", { bold: true, align: "center", width: 700 })}${wCell("Hạng mục", { bold: true, align: "center", width: 4200 })}${wCell("SL", { bold: true, align: "center", width: 700 })}${wCell("Đơn giá", { bold: true, align: "center", width: 1700 })}${wCell("Thành tiền", { bold: true, align: "center", width: 1800 })}</w:tr>`;
    const rows = d.items.map((it, i) =>
      `<w:tr>${wCell(String(i + 1), { align: "center" })}${wCell(it.name || "")}${wCell(String(it.qty), { align: "center" })}${wCell(vnd(it.unit_price), { align: "right" })}${wCell(vnd((it.qty || 0) * (it.unit_price || 0)), { align: "right" })}</w:tr>`
    );
    body.push(wTable([header, ...rows]));
  }
  body.push(wPara(""));
  body.push(wPara(`Tổng giá trị hợp đồng: ${vnd(total)}`, { bold: true, align: "right" }));
  if (c.deposit) body.push(wPara(`Tiền cọc: ${vnd(c.deposit)}`, { align: "right" }));
  body.push(wPara(`Đã thanh toán: ${vnd(paid)} · Còn lại: ${vnd(remain)}`, { align: "right" }));
  if (d.payments.length) {
    body.push(wPara(""));
    body.push(wPara("CÁC KHOẢN ĐÃ THANH TOÁN", { bold: true }));
    const header = `<w:tr>${wCell("Ngày", { bold: true, align: "center", width: 1500 })}${wCell("Loại", { bold: true, align: "center", width: 2000 })}${wCell("Số tiền", { bold: true, align: "center", width: 1800 })}${wCell("Ghi chú", { bold: true, align: "center", width: 3800 })}</w:tr>`;
    const rows = d.payments.map((p) =>
      `<w:tr>${wCell(dmy(p.paid_at))}${wCell(PAY_KINDS[p.kind || ""] || p.kind || "")}${wCell(vnd(p.amount), { align: "right" })}${wCell(p.note || "")}</w:tr>`
    );
    body.push(wTable([header, ...rows]));
  }
  if (c.note) {
    body.push(wPara(""));
    body.push(wPara("GHI CHÚ", { bold: true }));
    body.push(wPara(c.note));
  }
  body.push(wPara(""));
  body.push(wPara(""));
  const signTable = `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tr>` +
    `<w:tc><w:tcPr><w:tcW w:w="4600" w:type="dxa"/></w:tcPr>` +
    wPara("ĐẠI DIỆN BÊN A", { bold: true, align: "center" }) +
    wPara(c.studio_signed_name || d.studio.name, { bold: true, align: "center" }) +
    wPara(c.studio_signed_at ? `Đã ký điện tử ngày ${dmy(c.studio_signed_at)}` : "(Ký, ghi rõ họ tên)", { italic: true, size: 11, align: "center" }) +
    `</w:tc>` +
    `<w:tc><w:tcPr><w:tcW w:w="4600" w:type="dxa"/></w:tcPr>` +
    wPara("ĐẠI DIỆN BÊN B", { bold: true, align: "center" }) +
    wPara(c.client_signed_name || c.client_name || "", { bold: true, align: "center" }) +
    wPara(c.client_signed_at ? `Đã ký điện tử ngày ${dmy(c.client_signed_at)}` : "(Ký, ghi rõ họ tên)", { italic: true, size: 11, align: "center" }) +
    `</w:tc></w:tr></w:tbl>`;
  body.push(signTable);

  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
    body.join("") +
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>` +
    `</w:body></w:document>`;

  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
      `</Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
      `</Relationships>`
  );
  zip.file("word/document.xml", documentXml);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
