/* ═══════════════════════════════════════════════════════════════════════════
   HÌNH HỌC KHUNG ẢNH CÓ TRANG TRÍ — dùng chung cho màn sửa (DOM), bộ xuất
   (canvas) và bộ dàn trang, để ba nơi tính cùng một phần ảnh, cùng một góc bo.
   Thuần, không đụng DOM.
   ═══════════════════════════════════════════════════════════════════════════ */
import type { FrameDeco, PhotoFrame, Rect } from "./types";

/** Phần ẢNH của khung (rect trừ viền) — nơi đặt ảnh, cắt ảnh, kéo ảnh. */
export function photoArea(f: Pick<PhotoFrame, "rect" | "deco">): Rect {
  const pad = Math.max(0, f.deco?.pad ?? 0);
  const pb = Math.max(pad, f.deco?.padBottom ?? pad);
  return { x: f.rect.x + pad, y: f.rect.y + pad, w: Math.max(1, f.rect.w - 2 * pad), h: Math.max(1, f.rect.h - pad - pb) };
}

/** Bán kính bốn góc [trên trái, trên phải, dưới phải, dưới trái] của hộp w×h theo hình. */
export function shapeRadii(shape: FrameDeco["shape"], w: number, h: number): [number, number, number, number] {
  if (shape === "round") {
    const r = Math.min(w, h) * 0.08;
    return [r, r, r, r];
  }
  if (shape === "arch") {
    const r = Math.min(w / 2, h);
    return [r, r, 0, 0];
  }
  return [0, 0, 0, 0];
}

/** Góc xoay (độ) đã kẹp trong khoảng cho phép. */
export function frameRotation(d: { rotate?: number } | undefined): number {
  const r = d?.rotate ?? 0;
  return Number.isFinite(r) ? Math.max(-15, Math.min(15, r)) : 0;
}

/** Xoay điểm (x, y) quanh (cx, cy) một góc `deg` độ. */
export function rotatePoint(x: number, y: number, cx: number, cy: number, deg: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) };
}
