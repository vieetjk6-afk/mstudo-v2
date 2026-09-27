"use client";

import { useSyncExternalStore } from "react";

/**
 * Bề rộng ảnh cần xin Google cho lưới album và khung xem lớn, tính theo màn
 * hình THẬT của khách thay vì một con số cố định.
 *
 * Trước đây lưới luôn xin w=400: điện thoại 2 cột rộng ~190px CSS nhưng mật
 * độ điểm ảnh ×3 → cần ~570px thật, nên 400px bị phóng lên và trông mờ. Máy
 * tính retina 4 cột cũng vậy (~350px × 2). Giờ lấy bề rộng một cột × DPR rồi
 * làm tròn lên một mốc cố định — mốc cố định để cùng một ảnh luôn ra cùng một
 * URL (CDN của Google/Vercel và cache trình duyệt vẫn trúng).
 *
 * Mốc lưới dừng ở 1024: tới đó /api/img vẫn dùng endpoint thumbnail của Drive
 * và vẫn nằm trong ngưỡng cache bucket (DRIVE_IMG_CACHE_MAX_WIDTH).
 *
 * Server render (và lượt hydrate đầu) trả 400/1600 như cũ để không lệch HTML;
 * ngay sau hydrate React tự đổi sang số theo màn hình.
 */
const GRID_STEPS = [400, 640, 800, 1024];
const FULL_STEPS = [1600, 2048, 2560];

function roundUp(px: number, steps: number[]): number {
  for (const s of steps) if (px <= s) return s;
  return steps[steps.length - 1];
}

function subscribe(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}

function dpr() {
  return Math.min(window.devicePixelRatio || 1, 3);
}

/** Bề rộng thumbnail cho lưới `colsMobile`/`colsDesktop` cột (đổi cột ở 768px). */
export function useGridThumbWidth(colsMobile = 2, colsDesktop = 4, maxContent = 1800): number {
  return useSyncExternalStore(
    subscribe,
    () => {
      const vw = Math.min(window.innerWidth || 400, maxContent);
      const cols = vw >= 768 ? colsDesktop : colsMobile;
      return roundUp((vw / cols) * dpr(), GRID_STEPS);
    },
    () => 400,
  );
}

/**
 * Bề rộng ảnh cho khung xem lớn (lightbox). Tham số `w` là BỀ NGANG ảnh, và
 * ảnh không bao giờ rộng hơn khung nhìn — nên lấy bề ngang màn hình × DPR.
 * Điện thoại (390 × 3) vẫn là 1600 như cũ; máy tính retina lên 2048/2560.
 */
export function useFullImageWidth(): number {
  return useSyncExternalStore(
    subscribe,
    () => roundUp((window.innerWidth || 0) * dpr(), FULL_STEPS),
    () => 1600,
  );
}
