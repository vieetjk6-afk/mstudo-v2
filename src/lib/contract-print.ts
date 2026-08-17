/**
 * Bản in hợp đồng (A4 → PDF) dùng CHUNG cho mọi nơi xuất hợp đồng:
 *   - Màn hợp đồng của studio  → nút "Xuất PDF" (mở cửa sổ in)
 *   - Cổng khách /c/[token]    → nút "Tải PDF / In"
 *   - MStudo Desktop           → GET /api/desktop/contracts/[id]?format=html
 *
 * Trước đây mỗi nơi tự dựng HTML riêng nên ba bản in khác nhau cả bố cục lẫn
 * nội dung, và không bản nào có logo studio. Gom về một chỗ để: sửa một lần là
 * cả ba đổi theo, và khách nhận bản PDF giống hệt bản studio giữ.
 *
 * Bố cục theo hướng GỌN mà ĐỦ: đầu trang một dải thương hiệu (logo + tên +
 * liên hệ) đối trọng với khối số hợp đồng/ngày lập/QR, thân bài xếp theo
 * bảng — hai bên ký, thông số buổi chụp, hạng mục, thanh toán, lịch trình,
 * điều khoản — rồi tới ô ký. Toàn bộ dựng bằng <table>: trình in của Safari
 * (khách hay in từ điện thoại) ngắt trang bằng flex/grid rất tuỳ hứng.
 *
 * File này KHÔNG import gì (kể cả alias "@/...") để chạy được ở cả server,
 * trình duyệt và `node --experimental-strip-types` trong desktop/test.
 */

export type PrintStudio = {
  name: string;
  /** URL hoặc data: URI của logo. Không có thì in ô chữ cái đầu. */
  logo?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  bankHolder?: string | null;
  bankAccount?: string | null;
  bankName?: string | null;
};

export type PrintClient = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

/** Ô thông số buổi chụp. `wide` chiếm trọn một dòng (địa điểm, ghi chú dài). */
export type PrintFact = { label: string; value?: string | null; wide?: boolean };

/** Dòng hạng mục. `amount` âm = dòng giảm giá (in dấu trừ). */
export type PrintItem = { name: string; qty?: number | null; unitPrice?: number | null; amount: number };

/**
 * Dòng tổng tiền bên phải bảng hạng mục.
 *   strong — dòng tổng chính (kẻ khung trên dưới, chữ to)
 *   bold   — in đậm nhưng không kẻ khung (ví dụ "Còn lại")
 *   minus  — in dấu trừ trước số tiền
 */
export type PrintTotal = { label: string; amount: number; strong?: boolean; bold?: boolean; minus?: boolean };

export type PrintPlanRow = { label: string; due?: string | null; paid?: boolean; amount: number };
export type PrintScheduleRow = { title: string; when?: string | null };
export type PrintPaymentRow = { date?: string | null; kind?: string | null; amount: number; note?: string | null };
export type PrintSign = { label: string; name?: string | null; image?: string | null; signedAt?: string | null };

export type ContractPrintData = {
  /** Tiêu đề cửa sổ / tab (không in ra giấy). */
  docTitle?: string;
  /** Dòng chữ lớn giữa đầu trang. Mặc định "HỢP ĐỒNG DỊCH VỤ". */
  heading?: string;
  /** In quốc hiệu – tiêu ngữ phía trên tên hợp đồng (bản MStudo Desktop giữ nếp cũ). */
  nationalHeading?: boolean;
  /** Tên hợp đồng (in dưới dòng chữ lớn). */
  title?: string | null;
  code?: string | null;
  /** Ngày lập, đã định dạng sẵn (dd/mm/yyyy). */
  issuedAt?: string | null;
  statusLabel?: string | null;
  studio: PrintStudio;
  client: PrintClient;
  facts?: PrintFact[];
  items?: PrintItem[];
  /** Sản phẩm in ấn / hiện vật bàn giao — bảng riêng dưới hạng mục dịch vụ. */
  products?: PrintItem[];
  totals?: PrintTotal[];
  /** Số tiền đọc thành chữ dưới bảng tổng. Bỏ trống thì không in dòng "Bằng chữ". */
  amountInWords?: number | null;
  plan?: PrintPlanRow[];
  schedule?: PrintScheduleRow[];
  payments?: PrintPaymentRow[];
  /** Điều khoản / ghi chú — giữ nguyên xuống dòng. */
  terms?: string | null;
  signs?: PrintSign[];
  /** QR mở trang hợp đồng (data: URI). */
  qr?: string | null;
  /** Dòng chân trang nhỏ. */
  footer?: string | null;
};

/* ── Tiện ích ──────────────────────────────────────────────────────────── */

export function escHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Tiền VND đầy đủ: 1500000 → "1.500.000đ". */
export function printVnd(n: number | null | undefined): string {
  return (Math.round(Number(n) || 0)).toLocaleString("vi-VN") + "đ";
}

/**
 * Chỉ cho phép ảnh dạng data: URI hoặc http(s) — chặn `javascript:` chui vào
 * thuộc tính src qua logo/chữ ký lưu trong DB.
 */
function safeSrc(u?: string | null): string {
  const s = String(u ?? "").trim();
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return "";
}

const DIGIT = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

/** Đọc một nhóm 3 chữ số. `pad` = nhóm đứng sau nên phải đọc cả "không trăm". */
function readTriple(n: number, pad: boolean): string {
  const tram = Math.floor(n / 100);
  const chuc = Math.floor((n % 100) / 10);
  const dv = n % 10;
  const out: string[] = [];
  if (tram > 0 || pad) out.push(DIGIT[tram], "trăm");
  if (chuc === 0) {
    if (dv > 0) {
      if (tram > 0 || pad) out.push("lẻ");
      out.push(DIGIT[dv]);
    }
  } else if (chuc === 1) {
    out.push("mười");
    if (dv === 1) out.push("một");
    else if (dv === 5) out.push("lăm");
    else if (dv > 0) out.push(DIGIT[dv]);
  } else {
    out.push(DIGIT[chuc], "mươi");
    if (dv === 1) out.push("mốt");
    else if (dv === 4) out.push("tư");
    else if (dv === 5) out.push("lăm");
    else if (dv > 0) out.push(DIGIT[dv]);
  }
  return out.join(" ");
}

/**
 * Số tiền đọc thành chữ — dòng "Bằng chữ" bắt buộc có trên hợp đồng giấy ở
 * Việt Nam (chống sửa số sau khi ký).
 *   1500000 → "Một triệu năm trăm nghìn đồng"
 */
export function vndInWords(n: number | null | undefined): string {
  const raw = Math.round(Number(n) || 0);
  const neg = raw < 0;
  let x = Math.abs(raw);
  if (x === 0) return "Không đồng";

  const groups: number[] = [];
  while (x > 0) {
    groups.push(x % 1000);
    x = Math.floor(x / 1000);
  }
  const base = ["", "nghìn", "triệu"];
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    const unit = [base[i % 3], "tỷ ".repeat(Math.floor(i / 3)).trim()].filter(Boolean).join(" ");
    parts.push([readTriple(groups[i], i !== groups.length - 1), unit].filter(Boolean).join(" "));
  }
  const s = (neg ? "âm " : "") + parts.join(" ") + " đồng";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ── CSS ───────────────────────────────────────────────────────────────── */

/**
 * CSS của bản in. `scope` là tiền tố selector: để rỗng khi in trong cửa sổ
 * riêng, truyền ".print-doc " khi nhúng vào trang đang có CSS của app (cổng
 * khách) để không giẫm lên giao diện.
 */
export function contractPrintCss(scope = ""): string {
  const s = scope ? `${scope.trim()} ` : "";
  return `
@page { size: A4; margin: 12mm 13mm; }
${s}.cpd { font-family: "Times New Roman", Times, "DejaVu Serif", serif; font-size: 10.5pt; line-height: 1.42; color: #111; }
${s}.cpd * { box-sizing: border-box; }
${s}.cpd table { width: 100%; border-collapse: collapse; }
${s}.cpd td, ${s}.cpd th { vertical-align: top; }
${s}.cpd thead { display: table-header-group; }
${s}.cpd tr, ${s}.cpd .keep { break-inside: avoid; page-break-inside: avoid; }
${s}.cpd b, ${s}.cpd strong { font-weight: 700; }

/* Đầu trang: logo + thương hiệu bên trái, số hợp đồng + QR bên phải. */
${s}.cpd-hd { border-bottom: 1.6pt solid #111; padding-bottom: 6px; }
${s}.cpd-hd td { vertical-align: middle; }
${s}.cpd-logo { height: 46px; max-width: 150px; object-fit: contain; display: block; }
${s}.cpd-mono { width: 40px; height: 40px; border: 1.4pt solid #111; text-align: center;
  font-size: 19pt; font-weight: 700; line-height: 36px; }
${s}.cpd-name { font-size: 13pt; font-weight: 700; letter-spacing: .2px; }
${s}.cpd-contact { font-size: 8.6pt; color: #444; }
${s}.cpd-hd-r { text-align: right; white-space: nowrap; }
${s}.cpd-kind { font-size: 8.4pt; letter-spacing: 1.1px; text-transform: uppercase; color: #444; }
${s}.cpd-code { font-size: 11pt; font-weight: 700; }
${s}.cpd-qr { width: 62px; height: 62px; display: block; margin-left: auto; }

/* Quốc hiệu – tiêu ngữ (tuỳ chọn) */
${s}.cpd-nat { text-align: center; font-weight: 700; font-size: 10pt; margin-top: 10px; }
${s}.cpd-nat span { display: inline-block; border-bottom: .8pt solid #111; padding: 0 6px 2px; }

/* Tên hợp đồng */
${s}.cpd-h1 { text-align: center; font-size: 16pt; font-weight: 700; text-transform: uppercase;
  letter-spacing: .6px; margin: 12px 0 2px; }
${s}.cpd-sub { text-align: center; font-size: 10.5pt; margin: 0 0 10px; }
${s}.cpd-sub .st { font-size: 8.6pt; text-transform: uppercase; letter-spacing: .7px;
  border: .8pt solid #999; padding: 0 5px; margin-left: 6px; white-space: nowrap; }

/* Nhãn nhỏ in hoa dùng chung */
${s}.cpd-lbl { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: .7px; color: #555; }

/* Hai bên ký kết */
${s}.cpd-party td { width: 50%; border: .8pt solid #999; padding: 6px 8px; }
${s}.cpd-party td + td { border-left: none; }
${s}.cpd-party .nm { font-size: 11pt; font-weight: 700; }
${s}.cpd-party .ln { font-size: 9.4pt; color: #333; }

/* Thông số buổi chụp */
${s}.cpd-facts { margin-top: -0.8pt; }
${s}.cpd-facts td { border: .8pt solid #999; padding: 5px 8px; }
${s}.cpd-facts td + td { border-left: none; }
${s}.cpd-facts tr + tr td { border-top: none; }
${s}.cpd-facts .v { font-size: 10pt; font-weight: 700; }

/* Mục lớn */
${s}.cpd-h2 { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .5px;
  margin: 13px 0 4px; padding-bottom: 2px; border-bottom: .8pt solid #111; }
/* Tiêu đề mục không được đứng một mình ở cuối trang. */
${s}.cpd-h2, ${s}.cpd-h3 { break-after: avoid; page-break-after: avoid; }

${s}.cpd-h3 { font-size: 9.4pt; font-weight: 700; text-transform: uppercase; letter-spacing: .5px;
  color: #444; margin: 9px 0 3px; }

/* Bảng dữ liệu */
${s}.cpd-tb th { background: #f2f2f2; border: .8pt solid #999; padding: 4px 6px;
  font-size: 8.6pt; text-transform: uppercase; letter-spacing: .4px; text-align: left; }
${s}.cpd-tb td { border: .8pt solid #bbb; padding: 4px 6px; }
${s}.cpd-tb .c { text-align: center; }
${s}.cpd-tb .r { text-align: right; white-space: nowrap; }
${s}.cpd-tb .sub { font-size: 8.8pt; color: #555; }

/* Khối tổng tiền — nằm sát mép phải cho gọn chiều dọc */
${s}.cpd-sum { margin-top: 6px; }
${s}.cpd-sum > tbody > tr > td { padding: 0; border: none; }
${s}.cpd-words { font-size: 9.4pt; font-style: italic; padding-right: 10px; }
${s}.cpd-tot { width: 74mm; margin-left: auto; }
${s}.cpd-tot td { padding: 2px 6px; font-size: 10pt; }
${s}.cpd-tot .k { text-align: right; }
${s}.cpd-tot .v { text-align: right; white-space: nowrap; width: 34mm; }
${s}.cpd-tot .big td { border-top: .9pt solid #111; border-bottom: .9pt solid #111;
  font-weight: 700; font-size: 11pt; padding: 3px 6px; }
${s}.cpd-tot .bold td { font-weight: 700; }

/* Điều khoản */
${s}.cpd-terms { font-size: 9.8pt; white-space: pre-wrap; margin: 0; text-align: justify;
  orphans: 2; widows: 2; }

/* Chuyển khoản */
${s}.cpd-bank { border: .8pt solid #999; padding: 5px 8px; margin-top: 6px; font-size: 9.6pt; }

/* Ký tên */
${s}.cpd-signs { margin-top: 16px; text-align: center; }
${s}.cpd-signs td { width: 50%; padding: 0 6px; }
${s}.cpd-signs .lb { font-size: 9.6pt; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
${s}.cpd-signs .hint { font-size: 8.6pt; font-style: italic; color: #666; }
${s}.cpd-signs .box { height: 62px; }
${s}.cpd-signs .box img { max-height: 60px; max-width: 82%; }
${s}.cpd-signs .nm { font-weight: 700; }
${s}.cpd-signs .at { font-size: 8.6pt; color: #555; }
${s}.cpd-ft { margin-top: 12px; padding-top: 4px; border-top: .6pt solid #ccc;
  font-size: 8.4pt; color: #777; text-align: center; }
`.trim();
}

/* ── Thân bài ──────────────────────────────────────────────────────────── */

const cell = (v?: string | null) => (v && String(v).trim() ? escHtml(String(v).trim()) : "");

function headerBlock(d: ContractPrintData): string {
  const st = d.studio;
  const logo = safeSrc(st.logo);
  const brandMark = logo
    ? `<img class="cpd-logo" src="${escHtml(logo)}" alt="${cell(st.name)}" />`
    : `<div class="cpd-mono">${cell((st.name || "S").trim().charAt(0).toUpperCase())}</div>`;
  const contact = [st.phone && `ĐT: ${st.phone}`, st.email, st.website].filter(Boolean).map((x) => cell(String(x)));
  const qr = safeSrc(d.qr);
  const right = [
    `<div class="cpd-kind">Số hợp đồng</div>`,
    `<div class="cpd-code">${cell(d.code) || "—"}</div>`,
    d.issuedAt ? `<div class="cpd-contact">Ngày lập: ${cell(d.issuedAt)}</div>` : "",
    qr ? `<img class="cpd-qr" src="${escHtml(qr)}" alt="Mã QR mở hợp đồng" />` : "",
  ].join("");

  return `<table class="cpd-hd keep"><tbody><tr>
<td style="width:1%;white-space:nowrap">${brandMark}</td>
<td style="padding-left:10px">
  <div class="cpd-name">${cell(st.name) || "Studio"}</div>
  ${contact.length ? `<div class="cpd-contact">${contact.join(" · ")}</div>` : ""}
</td>
<td class="cpd-hd-r">${right}</td>
</tr></tbody></table>`;
}

function partyBlock(d: ContractPrintData): string {
  const st = d.studio;
  const c = d.client;
  const lines = (xs: (string | null | undefined)[]) =>
    xs
      .filter((x) => x && String(x).trim())
      .map((x) => `<div class="ln">${cell(String(x))}</div>`)
      .join("");
  return `<table class="cpd-party keep"><tbody><tr>
<td>
  <div class="cpd-lbl">Bên A · Bên cung cấp dịch vụ</div>
  <div class="nm">${cell(st.name) || "—"}</div>
  ${lines([st.phone && `Điện thoại: ${st.phone}`, st.email && `Email: ${st.email}`])}
</td>
<td>
  <div class="cpd-lbl">Bên B · Khách hàng</div>
  <div class="nm">${cell(c.name) || "—"}</div>
  ${lines([
    c.phone && `Điện thoại: ${c.phone}`,
    c.email && `Email: ${c.email}`,
    c.address && `Địa chỉ: ${c.address}`,
  ])}
</td>
</tr></tbody></table>`;
}

/** Lưới thông số: 3 ô mỗi dòng, ô `wide` chiếm trọn dòng. */
function factsBlock(facts: PrintFact[]): string {
  const live = facts.filter((f) => f.value && String(f.value).trim());
  if (!live.length) return "";
  const rows: string[] = [];
  let buf: PrintFact[] = [];
  const flush = () => {
    if (!buf.length) return;
    const tds = buf.map((f) => `<td>${factCell(f)}</td>`);
    // Ô cuối dòng chưa đủ 3 thì kéo dài ra cho hết chiều ngang.
    if (buf.length < 3) tds[tds.length - 1] = `<td colspan="${3 - buf.length + 1}">${factCell(buf[buf.length - 1])}</td>`;
    rows.push(`<tr>${tds.join("")}</tr>`);
    buf = [];
  };
  for (const f of live) {
    if (f.wide) {
      flush();
      rows.push(`<tr><td colspan="3">${factCell(f)}</td></tr>`);
      continue;
    }
    buf.push(f);
    if (buf.length === 3) flush();
  }
  flush();
  return `<table class="cpd-facts keep"><tbody>${rows.join("")}</tbody></table>`;
}

function factCell(f: PrintFact): string {
  return `<div class="cpd-lbl">${cell(f.label)}</div><div class="v">${cell(f.value) || "—"}</div>`;
}

/** Bảng STT · tên · SL · đơn giá · thành tiền — dùng cho hạng mục và sản phẩm. */
function itemTable(rows: PrintItem[], head: string, empty?: string): string {
  if (!rows.length && !empty) return "";
  const body = rows.length
    ? rows
        .map((it, i) => {
          const neg = it.amount < 0;
          return `<tr>
<td class="c">${i + 1}</td>
<td>${cell(it.name)}</td>
<td class="c">${it.qty == null ? "" : escHtml(String(it.qty))}</td>
<td class="r">${it.unitPrice == null ? "" : printVnd(Math.abs(it.unitPrice))}</td>
<td class="r">${neg ? "− " : ""}${printVnd(Math.abs(it.amount))}</td>
</tr>`;
        })
        .join("")
    : `<tr><td class="c" colspan="5">${escHtml(empty || "")}</td></tr>`;
  return `<table class="cpd-tb"><thead><tr>
<th class="c" style="width:9mm">STT</th><th>${escHtml(head)}</th>
<th class="c" style="width:12mm">SL</th><th class="r" style="width:26mm">Đơn giá</th><th class="r" style="width:30mm">Thành tiền</th>
</tr></thead><tbody>${body}</tbody></table>`;
}

function itemsBlock(d: ContractPrintData): string {
  const totals = (d.totals ?? [])
    .map(
      (t) => `<tr${t.strong ? ' class="big"' : t.bold ? ' class="bold"' : ""}><td class="k">${cell(t.label)}</td>
<td class="v">${t.minus ? "− " : ""}${printVnd(Math.abs(t.amount))}</td></tr>`
    )
    .join("");

  const words =
    d.amountInWords == null
      ? ""
      : `<div class="cpd-words">Bằng chữ: <b>${escHtml(vndInWords(d.amountInWords))}</b></div>`;

  const products = d.products ?? [];
  return `${itemTable(d.items ?? [], "Hạng mục", "Chưa có hạng mục.")}
${products.length ? `<div class="cpd-h3">Sản phẩm &amp; chi phí in ấn</div>${itemTable(products, "Sản phẩm")}` : ""}
${
  totals
    ? `<table class="cpd-sum"><tbody><tr>
<td>${words}</td>
<td style="width:74mm"><table class="cpd-tot"><tbody>${totals}</tbody></table></td>
</tr></tbody></table>`
    : words
}`;
}

function planBlock(d: ContractPrintData): string {
  const rows = (d.plan ?? [])
    .map(
      (p) => `<tr><td>${cell(p.label)}</td><td class="c">${cell(p.due) || "—"}</td>
<td class="c">${p.paid ? "Đã thu" : "Chưa thu"}</td><td class="r">${printVnd(p.amount)}</td></tr>`
    )
    .join("");
  if (!rows) return "";
  return `<table class="cpd-tb"><thead><tr>
<th>Đợt thanh toán</th><th class="c" style="width:26mm">Hạn</th>
<th class="c" style="width:24mm">Tình trạng</th><th class="r" style="width:30mm">Số tiền</th>
</tr></thead><tbody>${rows}</tbody></table>${bankBlock(d)}`;
}

function bankBlock(d: ContractPrintData): string {
  const st = d.studio;
  if (!st.bankAccount) return "";
  const parts = [st.bankName, st.bankAccount, st.bankHolder].filter(Boolean).map((x) => cell(String(x)));
  return `<div class="cpd-bank keep"><span class="cpd-lbl">Chuyển khoản</span> ${parts.join(" · ")}${
    d.code ? ` · Nội dung: ${cell(d.code)}` : ""
  }</div>`;
}

function scheduleBlock(d: ContractPrintData): string {
  const rows = (d.schedule ?? [])
    .map((m) => `<tr><td>${cell(m.title)}</td><td class="r" style="width:52mm">${cell(m.when) || "—"}</td></tr>`)
    .join("");
  return rows ? `<table class="cpd-tb"><tbody>${rows}</tbody></table>` : "";
}

function paymentsBlock(d: ContractPrintData): string {
  const rows = (d.payments ?? [])
    .map(
      (p) => `<tr><td class="c">${cell(p.date) || "—"}</td><td>${cell(p.kind)}</td>
<td class="r">${printVnd(p.amount)}</td><td class="sub">${cell(p.note)}</td></tr>`
    )
    .join("");
  if (!rows) return "";
  return `<table class="cpd-tb"><thead><tr>
<th class="c" style="width:26mm">Ngày</th><th style="width:34mm">Nội dung</th>
<th class="r" style="width:30mm">Số tiền</th><th>Ghi chú</th>
</tr></thead><tbody>${rows}</tbody></table>`;
}

function signsBlock(d: ContractPrintData): string {
  const signs = d.signs ?? [];
  if (!signs.length) return "";
  const tds = signs
    .map((s) => {
      const img = safeSrc(s.image);
      return `<td>
  <div class="lb">${cell(s.label)}</div>
  <div class="hint">${s.signedAt ? "Đã ký điện tử" : "(Ký, ghi rõ họ tên)"}</div>
  <div class="box">${img ? `<img src="${escHtml(img)}" alt="Chữ ký" />` : ""}</div>
  <div class="nm">${cell(s.name)}</div>
  ${s.signedAt ? `<div class="at">Ngày ${cell(s.signedAt)}</div>` : ""}
</td>`;
    })
    .join("");
  return `<table class="cpd-signs keep"><tbody><tr>${tds}</tr></tbody></table>`;
}

/**
 * Thân bản in (không kèm <style>). Các mục được ĐÁNH SỐ TỰ ĐỘNG theo thứ tự
 * mục nào thật sự có dữ liệu — hợp đồng không có kế hoạch thanh toán thì mục
 * kế tiếp vẫn là "2.", không bị hụt số.
 */
export function contractPrintBody(d: ContractPrintData): string {
  const sections: { title: string; html: string }[] = [];
  const push = (title: string, html: string) => {
    if (html && html.trim()) sections.push({ title, html });
  };

  push("Hạng mục dịch vụ & giá trị hợp đồng", itemsBlock(d));
  push("Kế hoạch thanh toán", planBlock(d));
  push("Lịch trình thực hiện", scheduleBlock(d));
  push("Các khoản đã thanh toán", paymentsBlock(d));
  push(
    "Điều khoản & ghi chú",
    d.terms && d.terms.trim() ? `<p class="cpd-terms">${escHtml(d.terms.trim())}</p>` : ""
  );

  const body = sections
    .map((s, i) => `<h2 class="cpd-h2">${i + 1}. ${escHtml(s.title)}</h2>${s.html}`)
    .join("\n");

  return `<div class="cpd">
${headerBlock(d)}
${
  d.nationalHeading
    ? `<div class="cpd-nat keep">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM<br /><span>Độc lập – Tự do – Hạnh phúc</span></div>`
    : ""
}
<h1 class="cpd-h1">${escHtml(d.heading || "Hợp đồng dịch vụ")}</h1>
<p class="cpd-sub">${cell(d.title)}${
    d.statusLabel ? `<span class="st">${cell(d.statusLabel)}</span>` : ""
  }</p>
${partyBlock(d)}
${factsBlock(d.facts ?? [])}
${body}
${signsBlock(d)}
${d.footer ? `<div class="cpd-ft">${cell(d.footer)}</div>` : ""}
</div>`;
}

/**
 * Trang HTML hoàn chỉnh để mở trong cửa sổ mới rồi in (hộp in của trình duyệt
 * có sẵn "Lưu thành PDF"). `autoPrint` gọi window.print() ngay khi tải xong —
 * chờ ảnh (logo, chữ ký, QR) tải xong mới in, nếu không bản PDF mất ảnh.
 */
export function contractPrintDocument(d: ContractPrintData, opts: { autoPrint?: boolean } = {}): string {
  const auto = opts.autoPrint !== false;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escHtml(d.docTitle || d.title || "Hợp đồng")}</title>
<style>
html, body { margin: 0; padding: 0; background: #fff; }
body { padding: 4px 0; }
${contractPrintCss()}
</style></head>
<body>
${contractPrintBody(d)}
${
  auto
    ? `<script>
(function () {
  function go() { try { window.focus(); window.print(); } catch (e) {} }
  // Ảnh chưa tải xong mà in thì PDF trắng chỗ logo/chữ ký.
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go);
})();
</script>`
    : ""
}
</body></html>`;
}
