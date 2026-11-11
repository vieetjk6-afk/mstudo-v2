/* Khổ ảnh đăng mạng xã hội — bề rộng chuẩn 1080 px (Instagram thu mọi ảnh về
   1080; Facebook giữ tới 2048 nên khi xuất "nét cao" nhân đôi). Story chừa vùng
   trên/dưới bị giao diện ứng dụng che để chữ không nằm dưới nút. */

export interface CollageFormat {
  id: string;
  label: string;
  /** Dòng phụ: dùng cho đâu. */
  hint: string;
  w: number;
  h: number;
  /** Vùng bị giao diện nền tảng che (Story / Reels). */
  safeTop?: number;
  safeBottom?: number;
}

export const COLLAGE_FORMATS: CollageFormat[] = [
  { id: "4x5", label: "Dọc 4:5", hint: "Facebook, Instagram", w: 1080, h: 1350 },
  { id: "1x1", label: "Vuông 1:1", hint: "Facebook, Instagram, Zalo", w: 1080, h: 1080 },
  { id: "3x4", label: "Dọc 3:4", hint: "Instagram, Threads", w: 1080, h: 1440 },
  { id: "9x16", label: "Story 9:16", hint: "Story, Reels, TikTok", w: 1080, h: 1920, safeTop: 220, safeBottom: 300 },
  { id: "16x9", label: "Ngang 16:9", hint: "Facebook, YouTube, Zalo", w: 1600, h: 900 },
];

export const DEFAULT_FORMAT_ID = "4x5";

export function formatById(id: string | null | undefined): CollageFormat {
  return COLLAGE_FORMATS.find((f) => f.id === id) ?? COLLAGE_FORMATS[0];
}

/** Vùng an toàn để đặt chữ (trừ phần bị giao diện Story che). */
export function safeArea(f: CollageFormat): { x: number; y: number; w: number; h: number } {
  const top = f.safeTop ?? 0;
  const bottom = f.safeBottom ?? 0;
  return { x: 0, y: top, w: f.w, h: f.h - top - bottom };
}
