/* Phông chữ cho chữ trên ảnh ghép — CHỈ các phông đã nạp sẵn ở src/app/layout.tsx
   (next/font, tự lưu trên máy chủ mình, có bộ dấu tiếng Việt). Mỗi phông là một
   biến CSS trên <html>; màn sửa dùng thẳng biến đó, bộ xuất ảnh (canvas) đọc giá
   trị biến ra tên phông thật (xem text-layout.ts).

   Không thêm phông nào ở đây mà chưa có trong layout.tsx: thiếu là chữ trên ảnh
   rơi về phông hệ thống và vỡ dấu. */

export interface CollageFont {
  key: string;
  label: string;
  /** Biến CSS do next/font đặt trên <html>. */
  cssVar: string;
  /** Phông dự phòng nếu biến chưa có (trang xem trước, kiểm thử). */
  fallback: string;
  weights: number[];
  italic: boolean;
  kind: "script" | "serif" | "sans" | "hand";
}

export const COLLAGE_FONTS: CollageFont[] = [
  { key: "vibes", label: "Thư pháp", cssVar: "--font-hand", fallback: "cursive", weights: [400], italic: false, kind: "script" },
  { key: "dancing", label: "Viết tay", cssVar: "--font-script", fallback: "cursive", weights: [500, 600, 700], italic: false, kind: "script" },
  { key: "playfair", label: "Playfair", cssVar: "--font-playfair", fallback: "Georgia, serif", weights: [400, 500, 600, 700], italic: true, kind: "serif" },
  { key: "cormorant", label: "Cormorant", cssVar: "--font-cormorant", fallback: "Georgia, serif", weights: [400, 500, 600], italic: true, kind: "serif" },
  { key: "lora", label: "Lora", cssVar: "--font-lora", fallback: "Georgia, serif", weights: [400, 500, 600], italic: true, kind: "serif" },
  { key: "bevietnam", label: "Be Vietnam", cssVar: "--font-be-vietnam", fallback: "system-ui, sans-serif", weights: [400, 500, 600, 700, 800], italic: false, kind: "sans" },
  { key: "manrope", label: "Manrope", cssVar: "--font-manrope", fallback: "system-ui, sans-serif", weights: [400, 500, 600, 700, 800], italic: false, kind: "sans" },
  { key: "playpen", label: "Nét bút", cssVar: "--font-caveat", fallback: "cursive", weights: [400, 500, 600], italic: false, kind: "hand" },
];

export const DEFAULT_FONT_KEY = "playfair";

export function fontByKey(key: string | null | undefined): CollageFont {
  return COLLAGE_FONTS.find((f) => f.key === key) ?? COLLAGE_FONTS.find((f) => f.key === DEFAULT_FONT_KEY)!;
}

/** Độ đậm gần nhất mà phông có (đỡ trình duyệt tự "làm đậm giả"). */
export function nearestWeight(key: string, want: number): number {
  const ws = fontByKey(key).weights;
  return ws.reduce((best, w) => (Math.abs(w - want) < Math.abs(best - want) ? w : best), ws[0]);
}

/** font-family cho CSS (màn sửa): biến của next/font, kèm dự phòng. */
export function cssFontFamily(key: string): string {
  const f = fontByKey(key);
  return `var(${f.cssVar}), ${f.fallback}`;
}
