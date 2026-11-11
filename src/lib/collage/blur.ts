/* ═══════════════════════════════════════════════════════════════════════════
   LÀM MỜ ẢNH NỀN KHI XUẤT — Gauss xấp xỉ bằng 3 lượt box blur trên mảng RGBA.

   Vì sao không dùng ctx.filter = "blur(…)": Safari trên iPhone bỏ qua bộ lọc
   canvas khi vẽ ảnh, nên ảnh tải về ra nền NÉT trong khi màn sửa (CSS blur)
   vẫn mờ — lỗi khách gặp thật (11/2026). Tự làm mờ trên điểm ảnh thì mọi trình
   duyệt ra cùng một kết quả.

   Thuần, không đụng DOM — kiểm thử bằng node.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Bề rộng (lẻ) của `n` hộp mà làm mờ liên tiếp ≈ Gauss độ lệch chuẩn `sigma`. */
export function boxSizes(sigma: number, n = 3): number[] {
  if (!(sigma > 0)) return Array.from({ length: n }, () => 1);
  const ideal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(ideal);
  if (wl % 2 === 0) wl--;
  wl = Math.max(1, wl);
  const wu = wl + 2;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  return Array.from({ length: n }, (_, i) => (i < m ? wl : wu));
}

/** Một lượt hộp theo hàng ngang (3 kênh màu; mép lặp lại điểm biên). */
function passH(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, r: number) {
  const div = 2 * r + 1;
  const last = (w - 1) * 4;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let c = 0; c < 3; c++) {
      const at = (x: number) => src[row + Math.min(Math.max(x, 0) * 4, last) + c];
      let sum = (r + 1) * at(0);
      for (let k = 1; k <= r; k++) sum += at(k);
      for (let x = 0; x < w; x++) {
        dst[row + x * 4 + c] = sum / div;
        sum += at(x + r + 1) - at(x - r);
      }
    }
  }
}

/** Một lượt hộp theo cột dọc. */
function passV(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, r: number) {
  const div = 2 * r + 1;
  const stride = w * 4;
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      const base = x * 4 + c;
      const at = (y: number) => src[base + Math.min(Math.max(y, 0), h - 1) * stride];
      let sum = (r + 1) * at(0);
      for (let k = 1; k <= r; k++) sum += at(k);
      for (let y = 0; y < h; y++) {
        dst[base + y * stride] = sum / div;
        sum += at(y + r + 1) - at(y - r);
      }
    }
  }
}

/** Làm mờ tại chỗ mảng RGBA `w`×`h` (kênh alpha giữ nguyên). */
export function blurRGBA(data: Uint8ClampedArray, w: number, h: number, sigma: number): void {
  if (!(sigma > 0) || w < 2 || h < 2 || data.length < w * h * 4) return;
  const tmp = new Uint8ClampedArray(data.length);
  for (const b of boxSizes(sigma)) {
    const r = (b - 1) >> 1;
    if (r < 1) continue;
    passH(data, tmp, w, h, r);
    passV(tmp, data, w, h, r);
  }
}

/**
 * Tỉ lệ thu nhỏ để làm mờ: làm mờ ở ảnh nhỏ rồi phóng lại cho nhanh (ảnh đã mờ
 * thì phóng lên vẫn mịn). Ảnh nhỏ chỉ cần độ mờ ~6 điểm ảnh; không quá nửa
 * kích thước gốc, không nhỏ hơn 4%.
 */
export function workScale(sigmaPx: number): number {
  if (!(sigmaPx > 0)) return 0.5;
  return Math.min(0.5, Math.max(0.04, 6 / sigmaPx));
}
