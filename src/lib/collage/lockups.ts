/* ═══════════════════════════════════════════════════════════════════════════
   MẪU CHỮ (typo) — một nội dung khách nhập được trình bày thành một "khối chữ":
   dòng nhỏ phía trên (SAVE THE DATE, LỄ VU QUY…), nội dung chính, hoa văn chia
   dòng, dòng nhỏ phía dưới (ngày cưới, tên cô dâu chú rể).

   Luật "mỗi layout tối đa MỘT nội dung" giữ nguyên: dòng trên / dưới là phần
   trang trí của khối chữ (máy tự điền ngày cưới, tên lấy từ tên album; khách
   sửa / xoá được), không phải nội dung thứ hai.

   Thuần, không đụng DOM.
   ═══════════════════════════════════════════════════════════════════════════ */
import type { CollageDoc, TextFrame } from "./types";
import type { DividerKind } from "./ornaments";
import { TEXT_PRESETS } from "./typography";

/** Một dòng phụ của khối chữ. */
export interface LockLine {
  /** Mẫu chữ: {date} = ngày cưới, {names} = tên cô dâu chú rể (lấy từ tên album). */
  text: string;
  font: string;
  weight: number;
  italic?: boolean;
  uppercase?: boolean;
  /** Giãn chữ, theo em. */
  letterSpacing: number;
  lineHeight: number;
  /** Cỡ chữ so với cỡ nội dung chính. */
  size: number;
}

export interface Lockup {
  id: string;
  name: string;
  /** Mẫu theo dịp (Save the date, Lễ vu quy…). */
  occasion?: boolean;
  /** Kiểu chữ của nội dung chính (id TEXT_PRESETS); rỗng = theo phong cách trang. */
  main: string;
  kicker?: LockLine;
  sub?: LockLine;
  divider?: DividerKind;
  /** Hoa văn nằm trên (trước nội dung) / dưới (sau nội dung) / cả hai. */
  dividerAt?: "top" | "bottom" | "both";
  /** Nội dung mẫu để xem trước khi chọn. */
  sample?: string;
}

const caps = (text: string, font: string, size: number, letterSpacing = 0.3, weight = 500): LockLine => ({ text, font, weight, uppercase: true, letterSpacing, lineHeight: 1.35, size });
const plainLine = (text: string, font: string, size: number, italic = false, weight = 400): LockLine => ({ text, font, weight, italic, letterSpacing: 0.02, lineHeight: 1.25, size });

export const LOCKUPS: Lockup[] = [
  { id: "plain", name: "Chữ đơn", main: "" },
  { id: "script-date", name: "Thư pháp + ngày", main: "script", sub: caps("{date}", "josefin", 0.24, 0.32, 400), divider: "line", dividerAt: "bottom", sample: "Mãi bên nhau" },
  { id: "magazine", name: "Tạp chí", main: "didone", kicker: caps("The Wedding", "josefin", 0.22, 0.42, 600), sub: caps("{date}", "josefin", 0.2, 0.34, 400), divider: "line", dividerAt: "top", sample: "Ngày của chúng mình" },
  { id: "signature", name: "Chữ ký", main: "signature", sub: plainLine("with love", "garamond", 0.3, true), sample: "Lan & Minh" },
  { id: "minimal", name: "Tối giản", main: "geo", divider: "line", dividerAt: "both", sample: "Forever" },
  { id: "classic-dots", name: "Cổ điển", main: "classic", sub: plainLine("{date}", "cormorant", 0.34, true, 500), divider: "dots", dividerAt: "bottom", sample: "Trăm năm hạnh phúc" },
  { id: "brush-heart", name: "Bút lông + tim", main: "brush", sub: caps("{names}", "josefin", 0.22, 0.3, 400), divider: "heart", dividerAt: "bottom", sample: "Love you" },
  { id: "garamond-leaf", name: "Garamond + lá", main: "garamond", sub: caps("{date}", "josefin", 0.2, 0.3, 400), divider: "leaf", dividerAt: "top", sample: "Hạnh phúc là được ở bên nhau" },
  // ── Theo dịp ──
  { id: "save-date", name: "Save the date", occasion: true, main: "formal", kicker: caps("Save the date", "josefin", 0.24, 0.36, 600), sub: plainLine("{date}", "prata", 0.32), divider: "diamond", dividerAt: "bottom", sample: "{names}" },
  { id: "thank-you", name: "Thank you", occasion: true, main: "garamond", kicker: { text: "Thank you", font: "alexbrush", weight: 400, letterSpacing: 0, lineHeight: 1.1, size: 1.55 }, sub: caps("{names}", "josefin", 0.22, 0.3, 400), divider: "heart", dividerAt: "bottom", sample: "Cảm ơn mọi người đã đến chung vui" },
  { id: "just-married", name: "Just married", occasion: true, main: "bold", sub: caps("{date}", "manrope", 0.22, 0.34, 500), divider: "heart", dividerAt: "bottom", sample: "Just married" },
  { id: "our-day", name: "Our wedding day", occasion: true, main: "geo", kicker: { text: "Our wedding day", font: "pinyon", weight: 400, letterSpacing: 0, lineHeight: 1.15, size: 1.3 }, sub: plainLine("{date}", "garamond", 0.34, true), sample: "{names}" },
  { id: "vu-quy", name: "Lễ Vu Quy", occasion: true, main: "formal", kicker: caps("Lễ Vu Quy", "cormorant", 0.3, 0.3, 600), sub: plainLine("{date}", "cormorant", 0.34, true, 500), divider: "flourish", dividerAt: "top", sample: "{names}" },
  { id: "thanh-hon", name: "Lễ Thành Hôn", occasion: true, main: "formal", kicker: caps("Lễ Thành Hôn", "cormorant", 0.3, 0.3, 600), sub: plainLine("{date}", "cormorant", 0.34, true, 500), divider: "flourish", dividerAt: "top", sample: "{names}" },
  { id: "tiec-cuoi", name: "Tiệc cưới", occasion: true, main: "didone", kicker: caps("Tiệc cưới", "josefin", 0.24, 0.36, 600), sub: caps("{date}", "josefin", 0.2, 0.3, 400), divider: "dots", dividerAt: "bottom", sample: "{names}" },
  { id: "chung-doi", name: "Ngày chung đôi", occasion: true, main: "classic", kicker: { text: "Ngày chung đôi", font: "pinyon", weight: 400, letterSpacing: 0, lineHeight: 1.15, size: 1.05 }, sub: plainLine("{date}", "cormorant", 0.34, true, 500), divider: "leaf", dividerAt: "bottom", sample: "{names}" },
];

export const LOCKUP_IDS = new Set(LOCKUPS.map((l) => l.id));
/** Mẫu máy được tự chọn khi khách để "Đa dạng" (không gồm mẫu theo dịp). */
export const AUTO_LOCKUPS = LOCKUPS.filter((l) => !l.occasion).map((l) => l.id);

export function lockupById(id: string | null | undefined): Lockup | null {
  return LOCKUPS.find((l) => l.id === id) ?? null;
}

/** Ngữ cảnh để điền dòng phụ. */
export interface LockCtx {
  /** Ngày cưới đã định dạng, vd. "12 · 10 · 2026". */
  date?: string | null;
  /** Tên cô dâu chú rể, vd. "Lan & Minh". */
  names?: string | null;
}

/** Điền mẫu dòng phụ; thiếu dữ liệu ({date} khi album không có ngày) → bỏ dòng đó. */
export function fillLine(tpl: string | undefined, ctx: LockCtx): string | undefined {
  if (!tpl) return undefined;
  let missing = false;
  const out = tpl.replace(/\{(date|names)\}/g, (_, k: "date" | "names") => {
    const v = (ctx[k] ?? "").trim();
    if (!v) missing = true;
    return v;
  });
  return missing || !out.trim() ? undefined : out.trim().slice(0, 80);
}

/** Phần mẫu chữ gắn vào khung chữ (đã điền sẵn dòng phụ). */
export function lockupFor(id: string, ctx: LockCtx): TextFrame["lockup"] | undefined {
  const l = lockupById(id);
  if (!l || l.id === "plain") return undefined;
  const kicker = fillLine(l.kicker?.text, ctx);
  const sub = fillLine(l.sub?.text, ctx);
  return { id: l.id, ...(kicker ? { kicker } : {}), ...(sub ? { sub } : {}) };
}

/** Ngày cưới "2026-10-12" → "12 · 10 · 2026". */
export function lockDate(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]} · ${m[2]} · ${m[1]}` : null;
}

/** Tên cô dâu chú rể từ tên album: "Lan & Minh · Tiệc cưới Riverside" → "Lan & Minh". */
export function lockNames(title: string | null | undefined): string | null {
  const head = (title ?? "").split(/\s[·|•–—-]\s|\s\|\s/)[0]?.trim() ?? "";
  if (!head || head.length > 40) return null;
  return head;
}

/** Chiều cao THÊM của khối chữ so với chỉ nội dung chính (để bộ dàn trang chừa đủ chỗ). */
export function lockupExtraHeight(lock: TextFrame["lockup"] | undefined, mainSize: number): number {
  const l = lockupById(lock?.id);
  if (!l) return 0;
  const gap = mainSize * 0.16;
  let h = 0;
  if (lock?.kicker && l.kicker) h += mainSize * l.kicker.size * l.kicker.lineHeight + gap;
  if (lock?.sub && l.sub) h += mainSize * l.sub.size * l.sub.lineHeight + gap;
  if (l.divider) h += (mainSize * 0.42 + gap) * (l.dividerAt === "both" ? 2 : 1);
  return h;
}

/** Mọi phông một bộ layout dùng (nội dung chính + dòng phụ) — để nạp đúng phông cần. */
export function docFontKeys(doc: Pick<CollageDoc, "pages">): string[] {
  const out = new Set<string>();
  for (const p of doc.pages) {
    for (const f of p.frames) {
      if (f.kind !== "text") continue;
      out.add(f.style.font);
      const l = lockupById(f.lockup?.id);
      if (l?.kicker && f.lockup?.kicker) out.add(l.kicker.font);
      if (l?.sub && f.lockup?.sub) out.add(l.sub.font);
    }
  }
  return [...out];
}

/** Kiểu chữ chính của mẫu (id TEXT_PRESETS hợp lệ) hoặc undefined = theo phong cách. */
export function lockupPreset(id: string | null | undefined): string | undefined {
  const l = lockupById(id);
  return l?.main && TEXT_PRESETS.some((p) => p.id === l.main) ? l.main : undefined;
}
