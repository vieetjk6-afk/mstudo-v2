/* ═══════════════════════════════════════════════════════════════════════════
   CHỮ TRÊN ẢNH GHÉP — ngắt dòng + co cỡ cho vừa khung, đo bằng canvas.

   Màn sửa (DOM) và bộ xuất ảnh (canvas) gọi CÙNG một hàm `layoutText` nên ảnh
   tải về ngắt dòng y hệt thứ khách thấy: màn sửa vẽ từng dòng đã tính sẵn chứ
   không để trình duyệt tự ngắt (hai bên ngắt khác nhau là chữ nhảy dòng).

   Chỉ chạy trong trình duyệt. Không có `document` (máy chủ, kiểm thử) thì trả
   về cách ngắt thô theo \n.
   ═══════════════════════════════════════════════════════════════════════════ */
import type { TextFrame, TextStyle } from "./types";
import { COLLAGE_FONTS, fontByKey, nearestWeight } from "./fonts";
import { lockupById, type LockLine } from "./lockups";
import type { DividerKind } from "./ornaments";

const familyCache = new Map<string, string>();

/** Tên phông thật cho canvas: giá trị biến CSS của next/font trên <html>, kèm dự phòng. */
export function canvasFontFamily(key: string): string {
  const f = fontByKey(key);
  if (typeof document === "undefined") return f.fallback;
  let v = familyCache.get(f.key);
  if (!v) {
    v = getComputedStyle(document.documentElement).getPropertyValue(f.cssVar).trim();
    if (v) familyCache.set(f.key, v);
  }
  return v ? `${v}, ${f.fallback}` : f.fallback;
}

export function canvasFont(st: Pick<TextStyle, "italic" | "weight" | "font">, size: number): string {
  return `${st.italic ? "italic " : ""}${st.weight} ${Math.max(1, size).toFixed(2)}px ${canvasFontFamily(st.font)}`;
}

/** Chữ hiển thị: chuẩn hoá NFC (dấu tiếng Việt dựng sẵn) + viết hoa nếu kiểu chữ yêu cầu. */
export function displayText(t: Pick<TextFrame, "text" | "style">): string {
  const s = t.text.normalize("NFC");
  return t.style.uppercase ? s.toLocaleUpperCase("vi") : s;
}

let measurer: CanvasRenderingContext2D | null = null;
function ctx2d(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!measurer) measurer = document.createElement("canvas").getContext("2d");
  return measurer;
}

/** Bề rộng một dòng, tính cả giãn chữ (letterSpacing theo em). */
export function lineWidth(ctx: CanvasRenderingContext2D, line: string, size: number, spacingEm: number): number {
  const chars = Array.from(line).length;
  return ctx.measureText(line).width + spacingEm * size * Math.max(0, chars - 1);
}

/** Ngắt một đoạn thành các dòng không rộng quá `maxW` (theo từ; từ dài hơn khung để nguyên — bước co cỡ lo). */
function wrapParagraph(ctx: CanvasRenderingContext2D, para: string, size: number, spacingEm: number, maxW: number): string[] {
  const words = para.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const out: string[] = [];
  let cur = words[0];
  for (let i = 1; i < words.length; i++) {
    const next = `${cur} ${words[i]}`;
    if (lineWidth(ctx, next, size, spacingEm) <= maxW) cur = next;
    else {
      out.push(cur);
      cur = words[i];
    }
  }
  out.push(cur);
  return out;
}

/**
 * Ngắt CÂN DÒNG (như text-wrap: balance): giữ đúng số dòng của cách ngắt tham
 * lam nhưng thu bề ngang tới mức hẹp nhất còn giữ được số dòng đó — tránh một
 * chữ mồ côi ở dòng cuối ("CHÚNG MÌNH CƯỚI / RỒI" → "CHÚNG MÌNH / CƯỚI RỒI").
 */
function wrapBalanced(ctx: CanvasRenderingContext2D, para: string, size: number, spacingEm: number, maxW: number): string[] {
  const base = wrapParagraph(ctx, para, size, spacingEm, maxW);
  if (base.length < 2 || base.length > 8) return base;
  let lo = maxW * 0.3;
  let hi = maxW;
  let best = base;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const t = wrapParagraph(ctx, para, size, spacingEm, mid);
    const widest = Math.max(0, ...t.map((l) => lineWidth(ctx, l, size, spacingEm)));
    if (t.length === base.length && widest <= mid + 0.5) {
      best = t;
      hi = mid;
    } else lo = mid;
  }
  return best;
}

export interface TextLayout {
  lines: string[];
  /** Cỡ chữ sau khi co cho vừa khung. */
  size: number;
  /** Chiều cao một dòng. */
  lineH: number;
  /** Bề rộng dòng dài nhất. */
  width: number;
}

const cache = new Map<string, TextLayout>();

/** Khoá bộ nhớ đệm: mọi thứ ảnh hưởng tới cách ngắt dòng. */
function key(t: TextFrame, fontsReady: number): string {
  const s = t.style;
  return [t.text, t.rect.w.toFixed(1), t.rect.h.toFixed(1), s.font, s.size.toFixed(2), s.weight, s.italic, s.uppercase, s.letterSpacing, s.lineHeight, fontsReady].join("|");
}

/**
 * Ngắt dòng theo bề ngang khung, rồi co cỡ chữ (không bao giờ phóng to) tới khi
 * khối chữ lọt khung cả chiều ngang lẫn chiều cao. `fontsReady` là bộ đếm tăng
 * mỗi lần phông nạp xong — để bộ nhớ đệm không giữ số đo của phông dự phòng.
 */
export function layoutText(t: TextFrame, fontsReady = 0): TextLayout {
  const st = t.style;
  const text = displayText(t);
  const ctx = ctx2d();
  if (!ctx) {
    const lines = text.split("\n");
    return { lines, size: st.size, lineH: st.size * st.lineHeight, width: t.rect.w };
  }
  const k = key(t, fontsReady);
  const hit = cache.get(k);
  if (hit) return hit;
  let size = st.size;
  let best: TextLayout | null = null;
  for (let iter = 0; iter < 14; iter++) {
    ctx.font = canvasFont(st, size);
    const lines = text.split("\n").flatMap((p) => wrapBalanced(ctx, p.trim(), size, st.letterSpacing, t.rect.w));
    const width = Math.max(0, ...lines.map((l) => lineWidth(ctx, l, size, st.letterSpacing)));
    const lineH = size * st.lineHeight;
    best = { lines, size, lineH, width };
    const fitsW = width <= t.rect.w * 1.002;
    const fitsH = lines.length * lineH <= t.rect.h * 1.04;
    if ((fitsW && fitsH) || size <= Math.max(6, st.size * 0.25)) break;
    const kw = fitsW ? 1 : t.rect.w / width;
    const kh = fitsH ? 1 : Math.sqrt((t.rect.h * 1.04) / (lines.length * lineH));
    size = Math.max(6, size * Math.max(0.6, Math.min(0.96, Math.min(kw, kh))));
  }
  if (cache.size > 400) cache.clear();
  cache.set(k, best!);
  return best!;
}

/* ── Khối chữ có mẫu (dòng trên + nội dung + hoa văn + dòng dưới) ───────── */

export type LockBlock =
  | {
      kind: "text";
      lines: string[];
      size: number;
      lineH: number;
      font: string;
      weight: number;
      italic: boolean;
      letterSpacing: number;
    }
  | { kind: "div"; type: DividerKind; w: number; h: number };

export interface LockLayout {
  blocks: LockBlock[];
  /** Khoảng cách giữa các khối. */
  gap: number;
  /** Tổng chiều cao khối chữ. */
  height: number;
}

const lockCache = new Map<string, LockLayout>();

/** Chữ của một dòng phụ: chuẩn hoá NFC + viết hoa nếu mẫu yêu cầu. */
function lineText(text: string, line: Pick<LockLine, "uppercase">): string {
  const s = text.normalize("NFC");
  return line.uppercase ? s.toLocaleUpperCase("vi") : s;
}

/**
 * Dàn khối chữ có mẫu: các khối xếp dọc, cỡ dòng phụ tính theo cỡ nội dung chính,
 * cả khối co lại cùng tỉ lệ tới khi lọt khung. null = khung không dùng mẫu chữ.
 * Màn sửa (DOM) và bộ xuất (canvas) cùng gọi hàm này nên ra y hệt nhau.
 */
export function layoutLockup(t: TextFrame, fontsReady = 0): LockLayout | null {
  const spec = lockupById(t.lockup?.id);
  if (!spec || spec.id === "plain") return null;
  const st = t.style;
  const ctx = ctx2d();
  const main = displayText(t);
  const kicker = t.lockup?.kicker && spec.kicker ? { text: lineText(t.lockup.kicker, spec.kicker), line: spec.kicker } : null;
  const sub = t.lockup?.sub && spec.sub ? { text: lineText(t.lockup.sub, spec.sub), line: spec.sub } : null;
  const divTop = !!spec.divider && (spec.dividerAt === "top" || spec.dividerAt === "both");
  const divBottom = !!spec.divider && (spec.dividerAt === "bottom" || spec.dividerAt === "both" || !spec.dividerAt);
  const key = [t.text, t.lockup?.id, t.lockup?.kicker, t.lockup?.sub, t.rect.w.toFixed(1), t.rect.h.toFixed(1), st.font, st.size.toFixed(2), st.weight, st.italic, st.uppercase, st.letterSpacing, st.lineHeight, fontsReady].join("|");
  const hit = lockCache.get(key);
  if (hit) return hit;

  const build = (k: number): LockLayout => {
    const ms = st.size * k;
    const gap = ms * 0.16;
    const blocks: LockBlock[] = [];
    const textBlock = (text: string, font: string, weight: number, italic: boolean, spacing: number, lh: number, size: number): LockBlock => {
      let lines = text.split("\n");
      if (ctx) {
        ctx.font = canvasFont({ font, weight, italic }, size);
        lines = lines.flatMap((p) => wrapBalanced(ctx, p.trim(), size, spacing, t.rect.w));
      }
      return { kind: "text", lines, size, lineH: size * lh, font, weight, italic, letterSpacing: spacing };
    };
    const lineBlock = (x: { text: string; line: LockLine }) =>
      textBlock(x.text, x.line.font, nearestWeight(x.line.font, x.line.weight), !!x.line.italic, x.line.letterSpacing, x.line.lineHeight, ms * x.line.size);
    const div = (): LockBlock => ({ kind: "div", type: spec.divider!, w: Math.min(t.rect.w, ms * 3.4), h: ms * 0.42 });
    if (kicker) blocks.push(lineBlock(kicker));
    if (divTop) blocks.push(div());
    blocks.push(textBlock(main, st.font, st.weight, st.italic, st.letterSpacing, st.lineHeight, ms));
    if (divBottom) blocks.push(div());
    if (sub) blocks.push(lineBlock(sub));
    const height = blocks.reduce((h, b) => h + (b.kind === "text" ? b.lines.length * b.lineH : b.h), 0) + gap * (blocks.length - 1);
    return { blocks, gap, height };
  };
  const widest = (l: LockLayout) =>
    Math.max(
      0,
      ...l.blocks.map((b) => {
        if (b.kind !== "text" || !ctx) return 0;
        ctx.font = canvasFont({ font: b.font, weight: b.weight, italic: b.italic }, b.size);
        return Math.max(0, ...b.lines.map((x) => lineWidth(ctx, x, b.size, b.letterSpacing)));
      }),
    );
  let k = 1;
  let out = build(k);
  for (let i = 0; i < 14; i++) {
    const w = widest(out);
    const fitsW = w <= t.rect.w * 1.002;
    const fitsH = out.height <= t.rect.h * 1.04;
    if ((fitsW && fitsH) || k <= 0.25) break;
    const kw = fitsW ? 1 : t.rect.w / w;
    const kh = fitsH ? 1 : (t.rect.h * 1.04) / out.height;
    k *= Math.max(0.6, Math.min(0.96, Math.min(kw, kh)));
    out = build(k);
  }
  if (lockCache.size > 300) lockCache.clear();
  lockCache.set(key, out);
  return out;
}

const loadedFonts = new Set<string>();

/**
 * Nạp phông chữ của ảnh ghép (next/font để preload:false nên phông chỉ tải khi
 * có chữ dùng tới). Đo chữ trước khi phông về là ngắt dòng theo phông dự phòng
 * — nên màn ghép nạp đúng các phông bộ layout đang dùng rồi mới đo lại.
 * `keys` bỏ trống = nạp tất cả. Trả true nếu vừa nạp thêm phông mới.
 */
export async function loadCollageFonts(keys?: readonly string[]): Promise<boolean> {
  if (typeof document === "undefined" || !document.fonts) return false;
  const list = COLLAGE_FONTS.filter((f) => (!keys || keys.includes(f.key)) && !loadedFonts.has(f.key));
  if (!list.length) return false;
  const loads: Promise<unknown>[] = [];
  for (const f of list) {
    for (const w of f.weights) {
      loads.push(document.fonts.load(`${w} 32px ${canvasFontFamily(f.key)}`, "Aă Ơ ẫ").catch(() => null));
      if (f.italic) loads.push(document.fonts.load(`italic ${w} 32px ${canvasFontFamily(f.key)}`, "Aă Ơ ẫ").catch(() => null));
    }
  }
  await Promise.all(loads);
  for (const f of list) loadedFonts.add(f.key);
  cache.clear();
  lockCache.clear();
  return true;
}
