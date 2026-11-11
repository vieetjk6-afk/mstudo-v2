/* Kiểu chữ cho NỘI DUNG khách nhập. Khác bộ TYPO_PRESETS của Albumi (nhiều dòng
   điền {title} {date}…): ở đây mỗi trang chỉ có MỘT nội dung, nên mỗi kiểu chỉ
   là cách trình bày một khối chữ. Cỡ chữ tính theo cạnh ngắn của trang, rồi co
   lại theo độ dài nội dung — chữ không bao giờ tràn khung (xem text-layout.ts). */
import type { Rect, TextAlign, TextFrame, TextStyle } from "./types";
import { nearestWeight } from "./fonts";
import { uid } from "./rng";

export interface TextPreset {
  id: string;
  name: string;
  font: string;
  weight: number;
  italic: boolean;
  uppercase: boolean;
  letterSpacing: number;
  lineHeight: number;
  /** Cỡ chữ theo tỉ lệ cạnh ngắn của trang (cho nội dung ngắn). */
  size: number;
}

export const TEXT_PRESETS: TextPreset[] = [
  { id: "script", name: "Thư pháp", font: "vibes", weight: 400, italic: false, uppercase: false, letterSpacing: 0, lineHeight: 1.12, size: 0.1 },
  { id: "serif-italic", name: "Serif nghiêng", font: "playfair", weight: 500, italic: true, uppercase: false, letterSpacing: 0, lineHeight: 1.18, size: 0.07 },
  { id: "classic", name: "Cổ điển", font: "cormorant", weight: 500, italic: false, uppercase: false, letterSpacing: 0.02, lineHeight: 1.15, size: 0.074 },
  { id: "caps", name: "Chữ hoa thưa", font: "manrope", weight: 500, italic: false, uppercase: true, letterSpacing: 0.26, lineHeight: 1.45, size: 0.04 },
  { id: "bold", name: "Hiện đại đậm", font: "bevietnam", weight: 700, italic: false, uppercase: true, letterSpacing: 0.03, lineHeight: 1.08, size: 0.062 },
  { id: "handwritten", name: "Viết tay", font: "dancing", weight: 600, italic: false, uppercase: false, letterSpacing: 0, lineHeight: 1.15, size: 0.082 },
  { id: "soft", name: "Mềm mại", font: "lora", weight: 400, italic: true, uppercase: false, letterSpacing: 0, lineHeight: 1.3, size: 0.054 },
  { id: "pen", name: "Nét bút", font: "playpen", weight: 500, italic: false, uppercase: false, letterSpacing: 0, lineHeight: 1.3, size: 0.052 },
];

export function presetById(id: string | null | undefined): TextPreset {
  return TEXT_PRESETS.find((p) => p.id === id) ?? TEXT_PRESETS[1];
}

/**
 * Cỡ chữ cho một nội dung: kiểu chữ cho cỡ gốc, nội dung càng dài càng nhỏ lại
 * (căn bậc hai — 4 lần dài thì nhỏ còn một nửa), không nhỏ quá 55% cỡ gốc: ảnh
 * đăng mạng xã hội được xem trên điện thoại, chữ nhỏ hơn nữa là không đọc nổi.
 */
export function sizeFor(p: TextPreset, text: string, short: number): number {
  const len = Math.max(1, text.replace(/\s+/g, " ").trim().length);
  const k = Math.max(0.55, Math.min(1, Math.sqrt(32 / len)));
  return p.size * short * k;
}

/**
 * Chiều cao ước lượng của khối chữ trong bề ngang `w` — để bộ dàn trang chừa
 * đủ chỗ. Ước lượng thô (nửa cỡ chữ mỗi ký tự); khi vẽ, chữ được ngắt dòng và
 * co lại cho vừa khung thật (text-layout.ts), nên ước lượng chỉ cần gần đúng.
 */
export function estimateTextHeight(p: TextPreset, text: string, w: number, short: number): number {
  const size = sizeFor(p, text, short);
  const charW = size * (p.uppercase ? 0.68 : 0.5) * (1 + p.letterSpacing);
  const perLine = Math.max(4, Math.floor(w / charW));
  const lines = text
    .split("\n")
    .reduce((n, para) => n + Math.max(1, Math.ceil(para.trim().length / perLine)), 0);
  return lines * size * p.lineHeight;
}

/** Dựng khung chữ cho một nội dung trong hộp `box`. */
export function buildText(p: TextPreset, text: string, box: Rect, short: number, color: string, align: TextAlign = "center", shadow = false): TextFrame {
  const style: TextStyle = {
    font: p.font,
    size: sizeFor(p, text, short),
    weight: nearestWeight(p.font, p.weight),
    italic: p.italic,
    color,
    align,
    letterSpacing: p.letterSpacing,
    lineHeight: p.lineHeight,
    uppercase: p.uppercase,
    ...(shadow ? { shadow: true } : {}),
  };
  return { kind: "text", id: uid("t"), rect: { ...box }, text, style };
}
