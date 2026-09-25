import type { ShootType } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   TẠO HỢP ĐỒNG NHANH — biến một đoạn chữ tự do thành bản nháp hợp đồng.

   Studio thường đã có sẵn thông tin trong tin nhắn Zalo/Messenger với khách:
   "Chị Lan 0901234567, gói cưới Vip 15tr, chụp 12/10 từ 7h tại nhà hàng
   Riverside, cọc 5tr". Gõ lại từng ô qua 6 bước là việc thừa. Màn tạo hợp đồng
   nhận nguyên đoạn đó, phân tích ra từng trường rồi điền sẵn vào form — studio
   chỉ còn soát lại và bấm tạo.

   Hai tầng phân tích, và tầng dưới LUÔN chạy:
     1. AI (bộ provider CHAT_PROVIDERS dùng chung với chatbox) hiểu câu chữ tự
        nhiên, "thứ 7 tuần sau", tên gói viết tắt…
     2. Bộ đọc quy tắc (regex) ở file này: SĐT, ngày, giờ, tiền, gói khớp tên.
        Studio chưa cấu hình AI vẫn dùng được, và AI lỡ bỏ sót một trường thì
        tầng này vá lại.

   Mọi thứ AI trả về đều bị KIỂM LẠI ở `normalizeDraft`: id gói/dịch vụ/thợ phải
   có thật trong danh sách của studio, SĐT phải là số, ngày phải đúng định dạng.
   AI bịa ra một id là chuyện bình thường — để lọt vào form thì hợp đồng có một
   hạng mục trỏ vào gói không tồn tại.

   File này THUẦN (không React, không server) để test được bằng node.
   ═══════════════════════════════════════════════════════════════════════════ */

export type QuickPackage = { id: string; name: string; price: number; list_key?: string | null };
export type QuickService = { id: string; name: string };
export type QuickCrew = { id: string; name: string; role?: string };

export type QuickContext = {
  packages: QuickPackage[];
  services: QuickService[];
  crew: QuickCrew[];
  /** Ngày hôm nay YYYY-MM-DD — để hiểu "12/10" (năm nào) và "tuần sau". */
  today: string;
};

/** Bản nháp đã chuẩn hoá — mọi trường đều có thể thiếu. */
export type QuickDraft = {
  clientName?: string;
  clientPhone?: string;
  shootType?: ShootType;
  serviceId?: string;
  mainPkgId?: string;
  /** Giá đã thương lượng của gói chính, nếu khác bảng giá. */
  mainPrice?: number;
  extraIds?: string[];
  /** Hạng mục không có trong bảng giá. */
  customLines?: { name: string; qty: number; unit_price: number }[];
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  crewIds?: string[];
  deposit?: number;
  depositDue?: string;
  title?: string;
  /** Yêu cầu của KHÁCH — lưu vào Brief, khách đọc được ở cổng hợp đồng. */
  note?: string;
  /** Ghi chú NỘI BỘ của studio — khách không bao giờ thấy. */
  internalNote?: string;
};

/** Gợi ý các thông tin nên có — hiện thành chip bấm để chèn vào ô nhập. */
export const QUICK_HINTS: { key: keyof QuickDraft | "price"; label: string; insert: string; required?: boolean }[] = [
  { key: "clientName", label: "Tên khách", insert: "Tên khách: ", required: true },
  { key: "clientPhone", label: "SĐT khách", insert: "SĐT: ", required: true },
  { key: "mainPkgId", label: "Gói dịch vụ", insert: "Gói: ", required: true },
  { key: "price", label: "Giá", insert: "Giá: " },
  { key: "eventDate", label: "Ngày chụp", insert: "Ngày: " },
  { key: "startTime", label: "Giờ", insert: "Giờ: " },
  { key: "location", label: "Địa điểm", insert: "Địa điểm: " },
  { key: "deposit", label: "Tiền cọc", insert: "Cọc: " },
  { key: "extraIds", label: "Hạng mục thêm", insert: "Thêm: " },
  { key: "crewIds", label: "Người đi chụp", insert: "Thợ: " },
  { key: "note", label: "Yêu cầu của khách", insert: "Yêu cầu: " },
  { key: "internalNote", label: "Ghi chú nội bộ", insert: "Nội bộ: " },
];

export const QUICK_EXAMPLE =
  "Chị Nguyễn Thu Lan, SĐT 0901 234 567\n" +
  "Gói cưới trọn gói, giá chốt 15tr, thêm album 30x30\n" +
  "Chụp ngày 12/10 từ 7h đến 17h tại nhà hàng Riverside Q7\n" +
  "Cọc 5tr trước 30/9";

/* ── Tiện ích chữ ───────────────────────────────────────────────────────── */

export function noAccent(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
}

const pad = (n: number) => String(n).padStart(2, "0");

function isValidDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** "YYYY-MM-DD" hợp lệ hay không. */
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  return isValidDate(y, m, d);
}

/** Chuẩn hoá giờ về "HH:MM"; không hiểu thì undefined. */
export function normalizeTime(s: unknown): string | undefined {
  if (typeof s !== "string") return undefined;
  const m = s.trim().toLowerCase().match(/^(\d{1,2})\s*(?:[:hg]|giờ)\s*(\d{1,2})?\s*(?:p|phút)?$/) || s.trim().match(/^(\d{1,2})$/);
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return undefined;
  return `${pad(h)}:${pad(min)}`;
}

/** Chỉ giữ chữ số; SĐT Việt Nam 10 số (đổi +84/84 đầu về 0). */
export function normalizePhone(s: unknown): string | undefined {
  if (typeof s !== "string" && typeof s !== "number") return undefined;
  let d = String(s).replace(/\D/g, "");
  if (d.startsWith("84") && d.length === 11) d = "0" + d.slice(2);
  return /^0\d{9}$/.test(d) ? d : undefined;
}

/**
 * Đọc số tiền kiểu Việt: "15tr", "15 triệu", "1tr5", "2,5tr", "500k", "15.000.000",
 * "15000000đ". Trả số đồng, hoặc undefined.
 */
export function parseMoney(raw: string): number | undefined {
  const s = noAccent(raw).replace(/\s+/g, "").replace(/vnd|dong|d$/g, "");
  let m = s.match(/^(\d+)(?:tr|trieu|m)(\d{1,3})?$/);
  if (m) {
    const tail = m[2] ? Number(m[2].padEnd(3, "0")) * 1000 : 0;
    return Number(m[1]) * 1_000_000 + tail;
  }
  m = s.match(/^(\d+)[.,](\d+)(tr|trieu|m|k|nghin|ngan)$/);
  if (m) {
    const unit = m[3].startsWith("k") || m[3].startsWith("ng") ? 1000 : 1_000_000;
    return Math.round(Number(`${m[1]}.${m[2]}`) * unit);
  }
  m = s.match(/^(\d+)(k|nghin|ngan)$/);
  if (m) return Number(m[1]) * 1000;
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
  if (/^\d{4,}$/.test(s)) return Number(s);
  return undefined;
}

/** Mẫu regex bắt một cụm tiền trong câu (dùng chung cho giá & cọc). */
const MONEY_RE =
  /(\d+(?:[.,]\d+)?\s*(?:tr(?:iệu|ieu)?|m|k|nghìn|nghin|ngàn|ngan)\d{0,3}|\d{1,3}(?:[.,]\d{3}){1,3}|\d{5,})(?:\s*(?:đ|vnd|vnđ|đồng))?/i;

/** Ngày "d/m", "d/m/yy", "d-m-yyyy", "ngày d tháng m" → ISO. Thiếu năm thì lấy lần tới gần nhất. */
export function parseDateText(raw: string, today: string): string | undefined {
  const s = noAccent(raw);
  const [ty, tm, td] = today.split("-").map(Number);
  // Duyệt MỌI cụm giống ngày, lấy cụm hợp lệ đầu tiên: số tiền "2.5tr",
  // "15.000.000" hay SĐT "0901.234.567" cũng có dạng d.m nhưng không phải ngày.
  // Cụm dính chữ số ở hai đầu (một phần của số dài hơn) hoặc theo sau là đơn vị
  // tiền thì bỏ qua.
  const hits = [
    ...s.matchAll(/(?<![\d.,])(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{2,4}))?(?![\d.,]*\d)(?!\s*(?:tr|trieu|k|m\b|nghin|ngan))/g),
    ...s.matchAll(/ngay\s*(\d{1,2})\s*thang\s*(\d{1,2})(?:\s*nam\s*(\d{2,4}))?/g),
  ];
  for (const hit of hits) {
    const d = Number(hit[1]);
    const m = Number(hit[2]);
    let y: number | undefined;
    if (hit[3]) {
      y = Number(hit[3]);
      if (y < 100) y += 2000;
    }
    if (y === undefined) {
      y = ty;
      // Ngày đã qua trong năm nay → hiểu là năm sau (studio không lập hợp đồng cho quá khứ).
      if (m < tm || (m === tm && d < td)) y += 1;
    }
    if (isValidDate(y, m, d)) return `${y}-${pad(m)}-${pad(d)}`;
  }
  return undefined;
}

/* ── Khớp tên với danh sách của studio ──────────────────────────────────── */

const tokens = (s: string) => noAccent(s).split(/[^a-z0-9]+/).filter((t) => t.length > 0);
const STOP = new Set(["goi", "dich", "vu", "chup", "anh", "va", "the", "cho", "combo", "package"]);

/** Điểm khớp 0..1 giữa tên trong danh sách và đoạn chữ. */
function matchScore(name: string, text: string): number {
  const n = noAccent(name).trim();
  const t = noAccent(text);
  if (!n) return 0;
  if (t.includes(n)) return 1;
  const nt = tokens(name).filter((x) => !STOP.has(x));
  if (!nt.length) return 0;
  const tt = new Set(tokens(text));
  const hit = nt.filter((x) => tt.has(x)).length;
  return hit / nt.length;
}

/** Mục khớp nhất (≥ ngưỡng) — tên dài hơn thắng khi hoà để "Cưới VIP" thắng "Cưới". */
export function bestMatch<T extends { name: string }>(list: T[], text: string, min = 0.99): T | undefined {
  let best: T | undefined;
  let bestScore = 0;
  for (const it of list) {
    const sc = matchScore(it.name, text);
    if (sc < min) continue;
    if (sc > bestScore || (sc === bestScore && best && it.name.length > best.name.length)) {
      best = it;
      bestScore = sc;
    }
  }
  return best;
}

/** Từ khoá → loại dịch vụ (khi studio không nói rõ tên dịch vụ). */
const SHOOT_KEYWORDS: [ShootType, RegExp][] = [
  ["prewedding", /pre-?wedding|anh cuoi ngoai canh|chup cuoi ngoai canh/],
  ["wedding", /ngay cuoi|tron goi cuoi|phong su cuoi|le cuoi|dam cuoi|tiec cuoi|an hoi|dam hoi/],
  ["psc", /\bpsc\b|quay chup/],
  ["makeup", /trang diem|make ?up|makeup/],
  ["rental", /thue do|thue vay|cho thue|thue ao/],
  ["video", /quay phim|\bvideo\b|flycam/],
  ["photo", /chup|anh|photo/],
];

export function guessShootType(text: string): ShootType | undefined {
  const s = noAccent(text);
  for (const [t, re] of SHOOT_KEYWORDS) if (re.test(s)) return t;
  return undefined;
}

/* ── Bộ đọc quy tắc ─────────────────────────────────────────────────────── */

/** Tách dòng "Nhãn: giá trị" (nhãn không dấu) thành map. */
function labelled(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split(/\n|;/)) {
    const m = line.match(/^\s*([^:：]{2,24})[:：]\s*(.+)$/);
    if (m) out.set(noAccent(m[1]).trim(), m[2].trim());
  }
  return out;
}

function pick(map: Map<string, string>, keys: RegExp): string | undefined {
  for (const [k, v] of map) if (keys.test(k)) return v;
  return undefined;
}

/**
 * Phân tích bằng quy tắc — không cần mạng. Bắt những thứ có hình dạng rõ (SĐT,
 * ngày, giờ, tiền) và những tên có sẵn trong danh sách của studio.
 */
export function heuristicParse(text: string, ctx: QuickContext): QuickDraft {
  const out: QuickDraft = {};
  const src = text.trim();
  if (!src) return out;
  const flat = noAccent(src);
  const lab = labelled(src);

  // SĐT: chuỗi 10 số (cho phép cách/chấm/gạch), hoặc +84.
  // Đoạn chat từ Hộp thư: số trong tin [Studio] là hotline của studio, không
  // phải SĐT khách — bỏ những dòng đó khi dò.
  const phoneSrc = src.split("\n").filter((l) => !l.startsWith("[Studio]")).join("\n");
  const phoneHit = phoneSrc.match(/(?:\+?84|0)(?:[\s.-]?\d){9}/);
  const phone = phoneHit ? normalizePhone(phoneHit[0]) : undefined;
  if (phone) out.clientPhone = phone;

  // Tên: dòng có nhãn, hoặc "anh/chị/cô/chú/bạn/khách <Tên Viết Hoa>".
  const nameLab = pick(lab, /^(ten( khach( hang)?)?|khach( hang)?|ho ten|co dau|chu re)$/);
  if (nameLab) {
    out.clientName = nameLab.replace(/(?:\+?84|0)(?:[\s.-]?\d){9}.*/, "").replace(/[,-]\s*$/, "").trim();
  } else {
    // Tên riêng = các từ Viết Hoa liền nhau (không bắt "SĐT" viết hoa toàn bộ).
    const m = src.match(/(?:^|[\s,])(?:[Aa]nh|[Cc]hị|[Cc]hi|[Cc]ô|[Cc]hú|[Bb]ạn|[Ee]m|[Kk]hách|[Kk]hach)\s+((?:\p{Lu}\p{Ll}+[ \t]?){1,5})/u);
    if (m) out.clientName = m[1].trim();
  }
  if (out.clientName === "") delete out.clientName;

  // Dịch vụ (điều khoản) theo tên có trong danh sách.
  const svc = bestMatch(ctx.services, src, 0.99);
  if (svc) out.serviceId = svc.id;
  const st = guessShootType(src);
  if (st) out.shootType = st;

  // Gói: ưu tiên dòng "Gói: …", không có thì dò cả đoạn.
  const pkgText = pick(lab, /^(goi( dich vu| chup)?|dich vu|package)$/) || src;
  const main = bestMatch(ctx.packages, pkgText, 0.99) || bestMatch(ctx.packages, pkgText, 0.66);
  if (main) out.mainPkgId = main.id;

  // Hạng mục thêm: dòng "Thêm: a, b" hoặc "thêm a"; khớp gói khác gói chính.
  const extraText = pick(lab, /^(them|hang muc them|phat sinh|kem theo)$/) || (flat.match(/them\s+([^\n.]+)/)?.[1] ?? "");
  if (extraText) {
    const ids: string[] = [];
    for (const part of extraText.split(/,|\+|\bva\b|\bvà\b/)) {
      const hit = bestMatch(ctx.packages.filter((p) => p.id !== out.mainPkgId), part, 0.66);
      if (hit && !ids.includes(hit.id)) ids.push(hit.id);
    }
    if (ids.length) out.extraIds = ids;
  }

  // Tiền cọc: "cọc 5tr", "Cọc: 5.000.000", "đặt cọc 30%".
  const depLine = pick(lab, /^(dat )?coc$/) ?? src.match(/(?:đặt\s*)?c[ọo]c\s*[:\-]?\s*([^\n,;]+)/i)?.[1];
  let depositPct: number | undefined;
  if (depLine) {
    const pct = depLine.match(/(\d{1,2})\s*%/);
    if (pct) depositPct = Number(pct[1]);
    else {
      const mm = depLine.match(MONEY_RE);
      const v = mm ? parseMoney(mm[1]) : undefined;
      if (v) out.deposit = v;
    }
    const due = depLine.match(/(?:trước|truoc|hạn|han)\s+(.+)$/i);
    const dd = due ? parseDateText(due[1], ctx.today) : undefined;
    if (dd) out.depositDue = dd;
  }

  // Giá: dòng "Giá: …" hoặc "giá/chốt/tổng <tiền>"; bỏ qua cụm tiền của cọc.
  const priceLine =
    pick(lab, /^(gia( chot| goi)?|tong( tien)?|thanh tien|chot)$/) ??
    src.match(/(?:giá(?:\s*chốt)?|gia(?:\s*chot)?|chốt|chot|tổng|tong)\s*[:\-]?\s*(\d[^\n,;]*)/i)?.[1];
  // Không có chữ "giá" thì lấy cụm tiền CÓ ĐƠN VỊ (tr/k/dấu chấm nghìn) đầu tiên
  // ở dòng không nói về cọc — "Trọn gói cưới 11,5tr". Bỏ số trần để khỏi nhặt
  // nhầm SĐT hay mã số.
  const looseMoney = priceLine
    ? undefined
    : (phoneHit ? src.replace(phoneHit[0], " ") : src)
        .split("\n")
        // Bỏ dòng cọc và dòng ghi chú ("Nội bộ: đã bớt 1tr" không phải giá gói).
        .filter((l) => !/c[ọo]c/i.test(l) && !/^\s*(nội bộ|noi bo|ghi chú|ghi chu|yêu cầu|yeu cau|lưu ý|luu y)/i.test(l))
        .map((l) => l.match(/\d+(?:[.,]\d+)?\s*(?:tr(?:iệu|ieu)?|k|nghìn|ngàn)\d{0,3}(?![\p{L}])|\d{1,3}(?:[.,]\d{3}){2,3}/iu)?.[0])
        .find(Boolean);
  if (priceLine || looseMoney) {
    const mm = (priceLine ?? looseMoney!).match(MONEY_RE);
    const v = mm ? parseMoney(mm[1]) : undefined;
    if (v) {
      if (main) {
        if (v !== main.price) out.mainPrice = v;
      } else {
        // Tên gói: dòng "Gói: …", không thì cụm "gói …" trong câu (cắt ở dấu
        // phẩy, bỏ phần giá) — "Gói cưới trọn gói, giá chốt 15tr" → "Gói cưới trọn gói".
        const raw =
          pick(lab, /^(goi( dich vu| chup)?|dich vu|package)$/) ??
          src.match(/(g[óo]i\s[^,\n;]+)/i)?.[1]?.split(/\s(?:giá|gia|chốt|chot)(?:\s*ch[ốo]t)?\s*[:\-]?\s*\d/i)[0] ??
          "";
        const name = raw.replace(MONEY_RE, "").replace(/\s{2,}/g, " ").trim();
        out.customLines = [{ name: name || "Gói dịch vụ", qty: 1, unit_price: v }];
      }
    }
  }
  if (depositPct && depositPct > 0 && depositPct < 100) {
    const base = out.mainPrice ?? main?.price ?? out.customLines?.[0]?.unit_price;
    if (base) out.deposit = Math.round((base * depositPct) / 100 / 1000) * 1000;
  }

  // Ngày chụp: dòng "Ngày: …" hoặc ngày đầu tiên KHÔNG nằm trong câu cọc.
  const dateLine = pick(lab, /^(ngay( chup| cuoi| su kien)?|thoi gian|lich)$/);
  const dateSrc = dateLine ?? src.replace(/c[ọo]c[^\n]*/gi, "");
  const ev = parseDateText(dateSrc, ctx.today);
  if (ev) out.eventDate = ev;

  // Giờ: "từ 7h đến 17h", "7h-17h", "7:30", "lúc 8h".
  const timeSrc = pick(lab, /^(gio|khung gio|thoi gian)$/) ?? src;
  const range = timeSrc.match(/(\d{1,2}\s*(?:[:h]|giờ)\s*\d{0,2})\s*(?:-|–|đến|den|tới|toi|~)\s*(\d{1,2}\s*(?:[:h]|giờ)\s*\d{0,2})/i);
  if (range) {
    out.startTime = normalizeTime(range[1].replace(/\s/g, ""));
    out.endTime = normalizeTime(range[2].replace(/\s/g, ""));
  } else {
    const one = timeSrc.match(/(?:lúc|luc|từ|tu|giờ|gio)?\s*(\d{1,2}\s*(?:h|giờ|:)\s*\d{0,2})(?![\d/])/i);
    if (one) out.startTime = normalizeTime(one[1].replace(/\s/g, ""));
  }
  if (!out.startTime) delete out.startTime;
  if (!out.endTime) delete out.endTime;

  // Địa điểm: dòng có nhãn, hoặc "tại …" tới hết câu.
  // Không có nhãn thì lấy cụm "tại …" CUỐI CÙNG, bỏ qua dòng Gói/Thêm: tên gói
  // hay chứa chữ "tại" ("Makeup cô dâu tại nhà") mà đó không phải nơi chụp.
  const locSrc = src
    .split("\n")
    .filter((l) => !/^\s*(g[óo]i|th[êe]m|h[ạa]ng m[ụu]c|d[ịi]ch v[ụu])\s*[:：]/i.test(l))
    .join("\n");
  const locHits = [...locSrc.matchAll(/(?:^|[\s,(])(?:tại|tai)\s+([^\n,;]+)/gi)];
  const loc = pick(lab, /^(dia diem|noi chup|tai|o|dia chi)$/) ?? locHits[locHits.length - 1]?.[1];
  if (loc) out.location = loc.trim().replace(/[.]$/, "");

  // Thợ: dòng "Thợ: A, B" hoặc tên trong sổ thợ xuất hiện nguyên văn.
  const crewLine = pick(lab, /^(tho|nhan su|ekip|photo|photographer|nguoi chup|nguoi di)$/);
  const crewIds = ctx.crew
    .filter((c) => c.name.trim().length > 1 && (crewLine ? matchScore(c.name, crewLine) >= 0.99 : new RegExp(`(^|[^a-z])${noAccent(c.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(flat)))
    .map((c) => c.id);
  if (crewIds.length) out.crewIds = crewIds;

  const note = pick(lab, /^(ghi chu|luu y|note|yeu cau( khach| rieng)?)$/);
  if (note) out.note = note;
  const internal = pick(lab, /^(noi bo|ghi chu noi bo|ghi chu studio|note noi bo)$/);
  if (internal) out.internalNote = internal;

  return out;
}

/* ── Chuẩn hoá bản nháp (dùng cho kết quả AI) ───────────────────────────── */

const SHOOT_TYPE_SET = new Set<ShootType>(["photo", "video", "psc", "makeup", "rental", "prewedding", "wedding", "other"]);

const str = (v: unknown, max = 200): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t ? t : undefined;
};
const money = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.round(v);
  if (typeof v === "string") return parseMoney(v);
  return undefined;
};

/**
 * Kiểm lại một bản nháp bất kỳ (thường là JSON AI trả về) theo danh sách thật
 * của studio. Trường nào không hợp lệ thì BỎ, không đoán hộ.
 */
export function normalizeDraft(raw: unknown, ctx: QuickContext): QuickDraft {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: QuickDraft = {};
  const pkgIds = new Set(ctx.packages.map((p) => p.id));
  const svcIds = new Set(ctx.services.map((s) => s.id));
  const crewIds = new Set(ctx.crew.map((c) => c.id));

  const name = str(r.clientName, 120);
  if (name) out.clientName = name;
  const phone = normalizePhone(r.clientPhone);
  if (phone) out.clientPhone = phone;
  if (typeof r.shootType === "string" && SHOOT_TYPE_SET.has(r.shootType as ShootType)) out.shootType = r.shootType as ShootType;
  if (typeof r.serviceId === "string" && svcIds.has(r.serviceId)) out.serviceId = r.serviceId;
  if (typeof r.mainPkgId === "string" && pkgIds.has(r.mainPkgId)) out.mainPkgId = r.mainPkgId;
  const mp = money(r.mainPrice);
  if (mp && out.mainPkgId) {
    const listed = ctx.packages.find((p) => p.id === out.mainPkgId)!.price;
    if (mp !== listed) out.mainPrice = mp;
  }
  if (Array.isArray(r.extraIds)) {
    const ids = r.extraIds.filter((x): x is string => typeof x === "string" && pkgIds.has(x) && x !== out.mainPkgId);
    if (ids.length) out.extraIds = Array.from(new Set(ids));
  }
  if (Array.isArray(r.customLines)) {
    const lines = r.customLines
      .map((l) => {
        const o = (l ?? {}) as Record<string, unknown>;
        const n = str(o.name, 120);
        const price = money(o.unit_price) ?? 0;
        const qty = typeof o.qty === "number" && o.qty >= 1 ? Math.round(o.qty) : 1;
        return n || price ? { name: n || "Gói dịch vụ", qty, unit_price: price } : null;
      })
      .filter((x): x is { name: string; qty: number; unit_price: number } => !!x)
      .slice(0, 10);
    if (lines.length) out.customLines = lines;
  }
  if (isIsoDate(r.eventDate)) out.eventDate = r.eventDate;
  const st = normalizeTime(r.startTime);
  if (st) out.startTime = st;
  const et = normalizeTime(r.endTime);
  if (et) out.endTime = et;
  const loc = str(r.location, 200);
  if (loc) out.location = loc;
  if (Array.isArray(r.crewIds)) {
    const ids = r.crewIds.filter((x): x is string => typeof x === "string" && crewIds.has(x));
    if (ids.length) out.crewIds = Array.from(new Set(ids));
  }
  const dep = money(r.deposit);
  if (dep) out.deposit = dep;
  if (isIsoDate(r.depositDue)) out.depositDue = r.depositDue;
  const title = str(r.title, 160);
  if (title) out.title = title;
  const note = str(r.note, 1000);
  if (note) out.note = note;
  const internal = str(r.internalNote, 1000);
  if (internal) out.internalNote = internal;
  return out;
}

/** Gộp hai bản nháp: `primary` thắng, `fallback` chỉ vá trường còn trống. */
export function mergeDrafts(primary: QuickDraft, fallback: QuickDraft): QuickDraft {
  const out: QuickDraft = { ...fallback, ...primary };
  // Đã có gói chính từ bảng giá thì bỏ "gói riêng" đoán từ giá của tầng quy tắc —
  // nếu không, cùng một khoản tiền bị tính hai lần.
  if (primary.mainPkgId && !primary.customLines && fallback.customLines && !fallback.mainPkgId) delete out.customLines;
  // Ngược lại: AI coi là gói riêng (customLines, không có gói chính) còn tầng quy
  // tắc lại khớp mờ ra một gói trong bảng giá → bỏ gói đoán của tầng quy tắc.
  if (!primary.mainPkgId && primary.customLines?.length && fallback.mainPkgId) {
    delete out.mainPkgId;
    if (primary.mainPrice === undefined) delete out.mainPrice;
  }
  if (primary.mainPkgId !== undefined && primary.mainPkgId !== fallback.mainPkgId && primary.mainPrice === undefined) {
    delete out.mainPrice;
  }
  for (const k of Object.keys(out) as (keyof QuickDraft)[]) if (out[k] === undefined) delete out[k];
  return out;
}

/** Tổng dự kiến của bản nháp (theo bảng giá + giá sửa + gói riêng). */
export function draftTotal(d: QuickDraft, ctx: QuickContext): number {
  const byId = new Map(ctx.packages.map((p) => [p.id, p]));
  let t = 0;
  if (d.mainPkgId && byId.has(d.mainPkgId)) t += d.mainPrice ?? byId.get(d.mainPkgId)!.price;
  for (const id of d.extraIds ?? []) t += byId.get(id)?.price ?? 0;
  for (const l of d.customLines ?? []) t += l.qty * l.unit_price;
  return t;
}

/** Trường bắt buộc còn thiếu — hiện cảnh báo trước khi áp dụng. */
export function missingFields(d: QuickDraft): string[] {
  const miss: string[] = [];
  if (!d.clientName) miss.push("Tên khách");
  if (!d.clientPhone) miss.push("SĐT khách (10 số)");
  if (!d.mainPkgId && !d.customLines?.length) miss.push("Gói dịch vụ / giá");
  if (!d.eventDate) miss.push("Ngày chụp");
  return miss;
}

/* ── Prompt cho AI ──────────────────────────────────────────────────────── */

/** Lời dặn hệ thống: danh sách của studio + khuôn JSON bắt buộc. */
export function buildQuickPrompt(ctx: QuickContext): string {
  const pk = ctx.packages
    .slice(0, 150)
    .map((p) => `- id=${p.id} | ${p.name} | ${p.price}đ`)
    .join("\n");
  const sv = ctx.services.slice(0, 40).map((s) => `- id=${s.id} | ${s.name}`).join("\n");
  const cr = ctx.crew.slice(0, 80).map((c) => `- id=${c.id} | ${c.name}${c.role ? ` (${c.role})` : ""}`).join("\n");
  return [
    "Bạn là trợ lý nhập liệu hợp đồng cho một studio chụp ảnh ở Việt Nam.",
    "Nhiệm vụ: đọc đoạn thông tin studio dán vào (thường chép từ tin nhắn với khách) và trích ra các trường của hợp đồng.",
    `Hôm nay là ${ctx.today}. Ngày không ghi năm thì lấy lần gần nhất SẮP TỚI. Hiểu cả "thứ 7 tuần sau", "cuối tháng"…`,
    "",
    "CHỈ TRẢ VỀ MỘT OBJECT JSON, không markdown, không giải thích. Trường nào không có thông tin thì BỎ HẲN, tuyệt đối không bịa.",
    "Khuôn:",
    "{",
    '  "clientName": string,            // họ tên khách, bỏ "anh/chị"',
    '  "clientPhone": string,           // 10 số, chỉ chữ số',
    '  "shootType": "photo"|"video"|"psc"|"makeup"|"rental"|"prewedding"|"wedding"|"other",',
    '  "serviceId": string,             // id trong DANH SÁCH DỊCH VỤ',
    '  "mainPkgId": string,             // id gói chính trong BẢNG GIÁ',
    '  "mainPrice": number,             // giá chốt của gói chính (đồng) nếu khách nói giá khác bảng giá',
    '  "extraIds": string[],            // id các hạng mục thêm trong BẢNG GIÁ',
    '  "customLines": [{"name": string, "qty": number, "unit_price": number}], // chỉ cho thứ KHÔNG có trong bảng giá',
    '  "eventDate": "YYYY-MM-DD",',
    '  "startTime": "HH:MM", "endTime": "HH:MM",',
    '  "location": string,',
    '  "crewIds": string[],             // id người trong SỔ THỢ',
    '  "deposit": number,               // tiền cọc (đồng); "cọc 30%" thì tự tính theo tổng',
    '  "depositDue": "YYYY-MM-DD",',
    '  "note": string,                  // yêu cầu riêng của KHÁCH về buổi chụp (khách sẽ đọc được) — không ghi nhận xét nội bộ',
    '  "internalNote": string           // ghi chú NỘI BỘ cho studio (khách không thấy): lưu ý về khách, việc cần nhớ',
    "}",
    "",
    'Tiền: "15tr" = 15000000, "1tr5" = 1500000, "500k" = 500000.',
    "Nếu đầu vào là ĐOẠN CHAT (các dòng bắt đầu bằng [Khách] / [Studio]): thông tin của khách lấy từ dòng [Khách] và phần đầu đoạn; giá/ngày/gói lấy theo thoả thuận SAU CÙNG hai bên đã chốt, bỏ qua các phương án đã bị đổi. SĐT của studio trong dòng [Studio] KHÔNG phải SĐT khách.",
    "Chỉ dùng id có trong danh sách dưới đây. Gói khách nhắc không có trong bảng giá → đưa vào customLines kèm giá nếu có.",
    "",
    "DANH SÁCH DỊCH VỤ:",
    sv || "(trống)",
    "",
    "BẢNG GIÁ:",
    pk || "(trống)",
    "",
    "SỔ THỢ:",
    cr || "(trống)",
  ].join("\n");
}

/** Rút object JSON đầu tiên từ câu trả lời của AI (có thể bọc ```json). */
export function extractJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/gi, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

/* ── Đoạn chat hộp thư → đầu vào cho Tạo nhanh ─────────────────────────── */

export type TranscriptMessage = { direction: "in" | "out"; body: string };

/**
 * Dựng đoạn chữ từ một hội thoại hộp thư để đưa vào ô Tạo nhanh: tên/SĐT của
 * người nhắn đặt lên ĐẦU (bộ đọc quy tắc lấy SĐT đầu tiên gặp được — đó phải là
 * SĐT khách, không phải hotline studio nằm trong tin trả lời), rồi các tin theo
 * thứ tự thời gian. Quá dài thì bỏ tin CŨ: thoả thuận chốt luôn nằm ở cuối.
 */
export function buildTranscript(
  contact: { name?: string | null; phone?: string | null },
  messages: TranscriptMessage[],
  max = 3500
): string {
  const head: string[] = [];
  const name = (contact.name || "").trim();
  if (name) head.push(`Tên khách: ${name}`);
  const phone = normalizePhone(contact.phone ?? "");
  if (phone) head.push(`SĐT: ${phone}`);
  const headText = head.join("\n");

  const lines = messages
    .map((m) => ({ ...m, body: (m.body || "").replace(/\s+/g, " ").trim() }))
    .filter((m) => m.body)
    .map((m) => `${m.direction === "in" ? "[Khách]" : "[Studio]"} ${m.body}`);

  const budget = Math.max(0, max - headText.length - 2);
  const kept: string[] = [];
  let used = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].length > 600 ? `${lines[i].slice(0, 600)}…` : lines[i];
    if (used + l.length + 1 > budget) break;
    kept.unshift(l);
    used += l.length + 1;
  }
  return [headText, kept.join("\n")].filter(Boolean).join("\n\n");
}
