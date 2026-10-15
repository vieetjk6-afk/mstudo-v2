// ════════════════════════════════════════════════════════════════════════════
// BẢNG MÀU THIỆP TỪ MỘT MÀU
//
// Cặp đôi chỉ chọn MỘT màu (ô "Màu chủ đạo" trong trình chỉnh sửa); các mẫu
// thiệp mới tự suy ra cả bảng màu từ đó: nền nhạt, thẻ, chữ đậm, đường kẻ, màu
// chữ đặt trên khối màu… Nhờ vậy một bố cục dùng được cho mọi tông màu, không
// phải nhân bản mẫu cho từng màu (trước đây "Khung vòm" có năm bản y hệt nhau,
// chỉ khác màu).
//
// Màu chữ luôn được kiểm độ tương phản (WCAG) — chọn màu nhạt như hồng phấn
// thì chữ trên khối màu tự chuyển sang màu đậm thay vì chữ trắng không đọc nổi.
// ════════════════════════════════════════════════════════════════════════════

type RGB = [number, number, number];

/** "#abc" / "#aabbcc" → [r,g,b]; chuỗi lạ → null. */
export function parseHex(hex?: string | null): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const toHex = ([r, g, b]: RGB) =>
  "#" + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");

/** Màu hợp lệ (chuẩn hoá "#rrggbb" chữ thường), không thì dùng màu dự phòng. */
export function safeHex(hex: string | undefined | null, fallback: string): string {
  const c = parseHex(hex) ?? parseHex(fallback) ?? [0, 0, 0];
  return toHex(c);
}

/** Trộn hai màu: t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a) ?? [0, 0, 0];
  const y = parseHex(b) ?? [0, 0, 0];
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as RGB);
}

/** "#rrggbb" + độ trong → "rgba(r,g,b,a)". */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex) ?? [0, 0, 0];
  return `rgba(${r},${g},${b},${+a.toFixed(3)})`;
}

/** Độ sáng tương đối theo WCAG (0 = đen, 1 = trắng). */
export function luminance(hex: string): number {
  const c = parseHex(hex) ?? [0, 0, 0];
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Tỉ lệ tương phản WCAG giữa hai màu (1 → 21). */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/**
 * Đẩy màu chữ `fg` về phía `toward` (đen hoặc trắng) từng chút một tới khi đủ
 * tương phản với nền `bg`. Giữ được sắc màu gốc lâu nhất có thể.
 */
export function ensureContrast(fg: string, bg: string, min: number, toward = luminance(bg) > 0.4 ? "#000000" : "#ffffff"): string {
  let c = fg;
  for (let i = 1; i <= 20 && contrast(c, bg) < min; i++) c = mix(fg, toward, i / 20);
  return c;
}

/**
 * Bảng màu SÁNG suy từ một màu chủ đạo — cho mẫu nền nhạt, chữ đậm.
 *
 *   main  · màu chủ đạo như cặp đôi chọn (khối màu lớn, nút bấm)
 *   deep  · đậm hơn một bậc (bóng đổ, viền nổi, chữ nhấn trên nền nhạt)
 *   text  · màu chủ đạo đã chỉnh cho ĐỌC ĐƯỢC trên nền `soft`
 *   ink   · chữ chính (gần đen, ngả theo màu chủ đạo)
 *   soft  · nền thiệp nhạt
 *   page  · nền trang ngoài thiệp (trên máy tính)
 *   card  · thẻ gần trắng
 *   line  · đường kẻ mảnh
 *   onMain· chữ đặt trên khối `main` (trắng, hoặc chữ đậm nếu màu chủ đạo quá nhạt)
 */
export type LightPalette = {
  main: string; deep: string; text: string; ink: string; muted: string;
  soft: string; page: string; card: string; line: string; onMain: string;
};

export function lightPalette(color: string | undefined, fallback: string): LightPalette {
  const main = safeHex(color, fallback);
  const soft = mix(main, "#ffffff", 0.9);
  const ink = ensureContrast(mix(main, "#141414", 0.78), "#ffffff", 10);
  return {
    main,
    deep: mix(main, "#000000", 0.3),
    text: ensureContrast(main, soft, 3.4),
    ink,
    muted: alpha(ink, 0.68),
    soft,
    page: mix(main, "#ffffff", 0.7),
    card: mix(main, "#ffffff", 0.975),
    line: alpha(mix(main, "#000000", 0.3), 0.26),
    onMain: contrast("#ffffff", main) >= 2.2 ? "#ffffff" : ink,
  };
}

/** [h 0–360, s 0–1, l 0–1] */
export function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = (parseHex(hex) ?? [0, 0, 0]).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function fromHsl(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

/**
 * Bảng màu TỐI suy từ một màu — cho mẫu nền đêm (Đêm sao). Màu chọn sáng mấy
 * cũng bị ép về một nền đủ tối để chữ sáng trên đó luôn đọc được. Chữ, ánh bạc
 * và quầng sáng lấy CÙNG SẮC với bầu trời (trời tím → ánh tím, trời đỏ rượu →
 * ánh hồng); trời gần như đen thì chúng về bạc trung tính.
 */
export type NightPalette = {
  sky: string; sky2: string; ink: string; muted: string; silver: string;
  glass1: string; glass2: string; line: string; glow: (a: number) => string;
  /** Tim ngày cưới trên lịch, thân hộp quà. */ heart: string; box: string;
};

export function nightPalette(color: string | undefined, fallback: string): NightPalette {
  const base = safeHex(color, fallback);
  let sky = base;
  for (let i = 1; i <= 20 && luminance(sky) > 0.022; i++) sky = mix(base, "#000000", i / 20);
  const [h, sat] = toHsl(sky);
  const k = Math.min(1, sat / 0.5);           // trời càng xám thì ánh càng trung tính
  const glowHex = fromHsl(h, 1 * k, 0.83);
  return {
    sky,
    sky2: mix(sky, fromHsl(h, 0.55 * k, 0.32), 0.25),
    ink: fromHsl(h, 1 * k, 0.97),
    muted: fromHsl(h, 0.38 * k, 0.74),
    silver: fromHsl(h, 1 * k, 0.89),
    glass1: alpha(fromHsl(h, 0.46 * k, 0.35), 0.55),
    glass2: alpha(fromHsl(h, 0.53 * k, 0.17), 0.72),
    line: alpha(fromHsl(h, 1 * k, 0.89), 0.28),
    glow: (a: number) => alpha(glowHex, a),
    heart: fromHsl(h, 1 * k, 0.81),
    box: fromHsl(h, 0.54 * k, 0.36),
  };
}
