/* Đặt ảnh vào khung — DÙNG CHUNG cho màn sửa (CSS) và bộ xuất (canvas) để ảnh
   tải về khớp đúng thứ khách thấy. Chép từ Albumi core/crop.ts, thêm cắt theo
   khuôn mặt: máy chủ đã quét khung mặt từng ảnh (album_faces), nên ảnh đặt vào
   khung hẹp không bị cụt đầu. */
import type { Crop } from "./types";

export interface Placement {
  /** Vị trí và kích thước ảnh (đã phóng) so với góc trên trái của khung. */
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const DEFAULT_CROP: Crop = { zoom: 1, cx: 0.5, cy: 0.45 };

/**
 * Ảnh phủ kín khung ("cover"), phóng thêm theo zoom, rồi dịch sao cho điểm
 * (cx, cy) của ảnh nằm giữa khung nếu được — không bao giờ để lộ nền trong khung.
 */
export function placePhoto(frameW: number, frameH: number, photoW: number, photoH: number, crop: Crop): Placement {
  const pw = photoW > 0 ? photoW : 1;
  const ph = photoH > 0 ? photoH : 1;
  const scale = Math.max(frameW / pw, frameH / ph) * Math.max(1, crop.zoom);
  const width = pw * scale;
  const height = ph * scale;
  const left = clamp(frameW / 2 - crop.cx * width, frameW - width, 0);
  const top = clamp(frameH / 2 - crop.cy * height, frameH - height, 0);
  return { left, top, width, height };
}

/**
 * Điểm đặt giữa khung theo khuôn mặt: tâm khối các khuôn mặt, kéo nhẹ xuống
 * để mặt nằm ở khoảng 40% chiều cao khung (chừa khoảng trên đầu như ảnh chân
 * dung) thay vì đúng giữa. Không có mặt nào → điểm mặc định.
 */
export function focusCrop(faces: readonly (readonly number[])[] | undefined, frameAspect: number, photoAspect: number): Crop {
  const ok = (faces ?? []).filter((b) => b.length === 4 && b.every((n) => Number.isFinite(n)) && b[2] > 0 && b[3] > 0);
  if (!ok.length) return { ...DEFAULT_CROP };
  const x0 = Math.min(...ok.map((b) => b[0]));
  const y0 = Math.min(...ok.map((b) => b[1]));
  const x1 = Math.max(...ok.map((b) => b[0] + b[2]));
  const y1 = Math.max(...ok.map((b) => b[1] + b[3]));
  const fx = (x0 + x1) / 2;
  const fy = (y0 + y1) / 2;
  // Phần chiều cao ảnh lọt vào khung (1 = thấy trọn chiều cao).
  const visibleH = frameAspect >= photoAspect ? photoAspect / frameAspect : 1;
  return { zoom: 1, cx: clamp(fx, 0, 1), cy: clamp(fy + 0.1 * visibleH, 0, 1) };
}

/** Dịch điểm giữa khi khách kéo ảnh một đoạn (dx, dy) theo đơn vị khung. */
export function panCrop(frameW: number, frameH: number, photoW: number, photoH: number, crop: Crop, dx: number, dy: number): Crop {
  const p = placePhoto(frameW, frameH, photoW, photoH, crop);
  const curCx = (frameW / 2 - p.left) / p.width;
  const curCy = (frameH / 2 - p.top) / p.height;
  const halfW = frameW / 2 / p.width;
  const halfH = frameH / 2 / p.height;
  return {
    ...crop,
    cx: clamp(curCx - dx / p.width, halfW, 1 - halfW),
    cy: clamp(curCy - dy / p.height, halfH, 1 - halfH),
  };
}
