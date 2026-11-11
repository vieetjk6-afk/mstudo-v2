/* ═══════════════════════════════════════════════════════════════════════════
   MÀU LẤY TỪ ẢNH — phong cách "Màu theo ảnh" và dải "Màu từ ảnh" ở tab Nền.

   Trình duyệt đọc điểm ảnh của ảnh nhỏ (bản cùng miền /api/img?…&raw=1), gom
   màu theo ô 4 bit mỗi kênh, ưu tiên màu có sắc (bỏ bớt trắng / đen / xám),
   rồi chọn vài màu khác hẳn nhau. Từ một màu chủ đạo dựng nền nhạt + chữ đậm
   cùng tông. Thuần, không đụng DOM — kiểm thử bằng node.
   ═══════════════════════════════════════════════════════════════════════════ */

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
export const toHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

export function fromHex(h: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  const n = m ? parseInt(m[1], 16) : 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Trộn hai màu: t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const x = fromHex(a);
  const y = fromHex(b);
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

/** Độ sáng tương đối 0..1 (WCAG). */
export function luminance(h: string): number {
  const [r, g, b] = fromHex(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Độ bão hoà 0..1 của một màu RGB. */
function saturation(r: number, g: number, b: number): number {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}

/**
 * Màu chủ đạo của ảnh từ mảng RGBA: tối đa `n` màu, khác nhau rõ (khoảng cách
 * RGB > 48), màu có sắc được ưu tiên hơn trắng / đen / xám.
 */
export function quantize(data: Uint8ClampedArray, n = 5): string[] {
  const buckets = new Map<number, { w: number; r: number; g: number; b: number; c: number }>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const s = saturation(r, g, b);
    const v = Math.max(r, g, b) / 255;
    // Trắng cháy / đen sâu / xám: vẫn tính nhưng nhẹ ký.
    const w = 0.25 + s * 1.5 + (v > 0.12 && v < 0.96 ? 0.3 : 0);
    const e = buckets.get(key) ?? { w: 0, r: 0, g: 0, b: 0, c: 0 };
    e.w += w;
    e.r += r;
    e.g += g;
    e.b += b;
    e.c += 1;
    buckets.set(key, e);
  }
  const ranked = [...buckets.values()].sort((a, b) => b.w - a.w).map((e) => [e.r / e.c, e.g / e.c, e.b / e.c] as const);
  const out: (readonly [number, number, number])[] = [];
  for (const c of ranked) {
    if (out.length >= n) break;
    if (out.every((o) => Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]) > 48)) out.push(c);
  }
  return out.map((c) => toHex(c[0], c[1], c[2]));
}

/** Màu chủ đạo có sắc nhất (bỏ gần trắng / gần đen) — gốc để dựng nền. */
export function keyColor(pal: readonly string[]): string | null {
  const ok = pal.filter((h) => {
    const [r, g, b] = fromHex(h);
    const v = Math.max(r, g, b) / 255;
    return v > 0.15 && v < 0.97;
  });
  if (!ok.length) return pal[0] ?? null;
  return [...ok].sort((a, b) => saturation(...fromHex(b)) - saturation(...fromHex(a)))[0];
}

/** Nền nhạt + chữ đậm cùng tông, chữ luôn đọc rõ (tương phản ≥ 4,5). */
export function paletteStyle(pal: readonly string[]): { bg: string; ink: string } | null {
  const k = keyColor(pal);
  if (!k) return null;
  // Nền: pha nhiều trắng, giữ chút sắc để hợp ảnh; chữ: cùng tông, tối hẳn.
  const bg = mix(mix(k, "#8a8580", 0.25), "#ffffff", 0.8);
  let ink = mix(k, "#000000", 0.68);
  if (contrast(bg, ink) < 4.5) ink = mix(k, "#000000", 0.82);
  if (contrast(bg, ink) < 4.5) ink = "#2b2622";
  return { bg, ink };
}

/** Dải màu nền gợi ý từ các màu của ảnh (tab Nền): nhạt, pha kem, trầm tối. */
export function paletteSwatches(pals: readonly (readonly string[])[], max = 8): string[] {
  const out: string[] = [];
  const add = (h: string) => {
    if (out.length < max && !out.some((o) => o === h)) out.push(h);
  };
  for (const pal of pals) {
    const k = keyColor(pal);
    if (!k) continue;
    add(mix(mix(k, "#8a8580", 0.25), "#ffffff", 0.8));
    add(mix(k, "#f5efe6", 0.62));
    add(mix(k, "#1c1714", 0.62));
  }
  return out;
}
