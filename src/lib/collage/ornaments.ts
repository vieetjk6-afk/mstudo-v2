/* ═══════════════════════════════════════════════════════════════════════════
   HÌNH TRANG TRÍ — hoa, cành lá, tim, lấp lánh, băng dính washi, dải phim, viền
   tem thư, hoa văn chia dòng của mẫu chữ.

   Mọi hình là ĐƯỜNG SVG (chuỗi "d") theo toạ độ cục bộ của hộp đặt hình: màn
   sửa vẽ bằng <svg><path d/>, bộ xuất canvas vẽ bằng new Path2D(d) — một nguồn,
   hai nơi vẽ ra y hệt nhau. Thuần, không đụng DOM.
   ═══════════════════════════════════════════════════════════════════════════ */
import type { Rect } from "./types";

/** Một nét vẽ: tô (fill) và / hoặc viền (stroke). */
export interface OrnPrim {
  d: string;
  fill?: string;
  stroke?: string;
  /** Độ dày viền, theo đơn vị của hộp. */
  sw?: number;
  opacity?: number;
  /** Tô kiểu even-odd (đục lỗ: lỗ dải phim). */
  evenodd?: boolean;
}

/** Hình trang trí đặt trên trang. */
export type OrnKind = "sprig" | "flower" | "bloom" | "heart" | "sparkle" | "tape" | "film" | "path" | "qr" | "card";
export const ORN_KINDS: OrnKind[] = ["sprig", "flower", "bloom", "heart", "sparkle", "tape", "film", "path", "qr", "card"];

export interface Ornament {
  id: string;
  kind: OrnKind;
  /** Hộp đặt hình, theo toạ độ trang. */
  rect: Rect;
  /** Xoay quanh tâm hộp, độ. */
  rotate?: number;
  /** Màu chính #rrggbb. */
  color: string;
  /** Màu phụ (nhị hoa, nụ). */
  color2?: string;
  opacity?: number;
  /** Lật ngang. */
  flip?: boolean;
  /** "path": đường tự do (viền); "qr": các ô của mã QR (tô) — theo toạ độ CỤC BỘ của hộp. */
  d?: string;
  /** Độ dày nét cho "path". */
  width?: number;
  /** Vẽ đè lên ảnh (băng dính, cành lá chồm lên ảnh in); mặc định nằm dưới ảnh. */
  over?: boolean;
}

const f1 = (v: number) => Math.round(v * 10) / 10;

/** Đường tròn. */
export function circlePath(cx: number, cy: number, r: number): string {
  return `M${f1(cx - r)} ${f1(cy)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0Z`;
}

/** Chiếc lá (hình thấu kính) mọc từ (x, y) theo góc `deg`, dài `len`, rộng `wid`. */
export function leafPath(x: number, y: number, deg: number, len: number, wid: number): string {
  const a = (deg * Math.PI) / 180;
  const tx = x + Math.cos(a) * len;
  const ty = y + Math.sin(a) * len;
  const mx = x + Math.cos(a) * len * 0.5;
  const my = y + Math.sin(a) * len * 0.5;
  const nx = -Math.sin(a) * wid;
  const ny = Math.cos(a) * wid;
  return `M${f1(x)} ${f1(y)}Q${f1(mx + nx)} ${f1(my + ny)} ${f1(tx)} ${f1(ty)}Q${f1(mx - nx)} ${f1(my - ny)} ${f1(x)} ${f1(y)}Z`;
}

/** Trái tim vừa hộp w×h. */
export function heartPath(x: number, y: number, w: number, h: number): string {
  const X = (v: number) => f1(x + (v / 100) * w);
  const Y = (v: number) => f1(y + (v / 100) * h);
  return `M${X(50)} ${Y(90)}C${X(20)} ${Y(68)} ${X(3)} ${Y(50)} ${X(3)} ${Y(30)}C${X(3)} ${Y(14)} ${X(15)} ${Y(4)} ${X(28)} ${Y(4)}C${X(38)} ${Y(4)} ${X(46)} ${Y(10)} ${X(50)} ${Y(20)}C${X(54)} ${Y(10)} ${X(62)} ${Y(4)} ${X(72)} ${Y(4)}C${X(85)} ${Y(4)} ${X(97)} ${Y(14)} ${X(97)} ${Y(30)}C${X(97)} ${Y(50)} ${X(80)} ${Y(68)} ${X(50)} ${Y(90)}Z`;
}

/** Ngôi sao lấp lánh 4 cánh. */
export function sparklePath(cx: number, cy: number, r: number): string {
  return `M${f1(cx)} ${f1(cy - r)}Q${f1(cx)} ${f1(cy)} ${f1(cx + r)} ${f1(cy)}Q${f1(cx)} ${f1(cy)} ${f1(cx)} ${f1(cy + r)}Q${f1(cx)} ${f1(cy)} ${f1(cx - r)} ${f1(cy)}Q${f1(cx)} ${f1(cy)} ${f1(cx)} ${f1(cy - r)}Z`;
}

/** Hình chữ nhật bo góc. */
export function roundRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${f1(x + q)} ${f1(y)}H${f1(x + w - q)}A${f1(q)} ${f1(q)} 0 0 1 ${f1(x + w)} ${f1(y + q)}V${f1(y + h - q)}A${f1(q)} ${f1(q)} 0 0 1 ${f1(x + w - q)} ${f1(y + h)}H${f1(x + q)}A${f1(q)} ${f1(q)} 0 0 1 ${f1(x)} ${f1(y + h - q)}V${f1(y + q)}A${f1(q)} ${f1(q)} 0 0 1 ${f1(x + q)} ${f1(y)}Z`;
}

/** Bông hoa 5 cánh. */
function flowerPrims(cx: number, cy: number, r: number, color: string, center: string): OrnPrim[] {
  const petals: string[] = [];
  for (let i = 0; i < 5; i++) petals.push(leafPath(cx, cy, -90 + i * 72, r, r * 0.42));
  return [
    { d: petals.join(""), fill: color },
    { d: circlePath(cx, cy, r * 0.24), fill: center },
  ];
}

/** Cành lá: thân cong từ góc dưới trái lên góc trên phải, lá mọc so le hai bên. */
function sprigPrims(w: number, h: number, color: string): OrnPrim[] {
  const m = Math.min(w, h);
  const p0 = { x: w * 0.06, y: h * 0.94 };
  const c = { x: w * 0.22, y: h * 0.3 };
  const p1 = { x: w * 0.94, y: h * 0.08 };
  const at = (t: number) => ({
    x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * c.x + t * t * p1.x,
    y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * c.y + t * t * p1.y,
  });
  const tan = (t: number) => {
    const dx = 2 * (1 - t) * (c.x - p0.x) + 2 * t * (p1.x - c.x);
    const dy = 2 * (1 - t) * (c.y - p0.y) + 2 * t * (p1.y - c.y);
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };
  const leaves: string[] = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const t = 0.14 + (i / (n - 1)) * 0.8;
    const p = at(t);
    const side = i % 2 ? 1 : -1;
    const size = m * (0.2 - 0.07 * t);
    leaves.push(leafPath(p.x, p.y, tan(t) + side * 48, size, size * 0.34));
  }
  // Lá ở ngọn.
  leaves.push(leafPath(p1.x, p1.y, tan(1), m * 0.12, m * 0.04));
  return [
    { d: `M${f1(p0.x)} ${f1(p0.y)}Q${f1(c.x)} ${f1(c.y)} ${f1(p1.x)} ${f1(p1.y)}`, stroke: color, sw: Math.max(0.6, m * 0.018) },
    { d: leaves.join(""), fill: color },
  ];
}

/** Băng dính washi: dải chéo hai đầu răng cưa. */
function tapePath(w: number, h: number): string {
  const teeth = 4;
  const step = h / teeth;
  const amp = Math.min(w * 0.04, step * 0.5);
  let d = `M0 0H${f1(w)}`;
  for (let i = 0; i < teeth; i++) d += `L${f1(w - (i % 2 ? 0 : amp))} ${f1((i + 0.5) * step)}L${f1(w)} ${f1((i + 1) * step)}`;
  d += `H0`;
  for (let i = teeth - 1; i >= 0; i--) d += `L${f1(i % 2 ? 0 : amp)} ${f1((i + 0.5) * step)}L0 ${f1(i * step)}`;
  return `${d}Z`;
}

/** Dải phim: nền tối, lỗ răng cưa hai mép dài (đục bằng even-odd). */
function filmPath(w: number, h: number): string {
  const vertical = h >= w;
  const L = vertical ? h : w;
  const T = vertical ? w : h;
  const hole = T * 0.07;
  const holeL = hole * 1.4;
  const pitch = holeL * 2.1;
  const n = Math.max(2, Math.floor(L / pitch));
  const off = (L - n * pitch) / 2 + (pitch - holeL) / 2;
  let d = roundRectPath(0, 0, w, h, T * 0.03);
  for (let i = 0; i < n; i++) {
    const a = off + i * pitch;
    for (const edge of [T * 0.045, T - T * 0.045 - hole]) {
      d += vertical ? roundRectPath(edge, a, hole, holeL, hole * 0.25) : roundRectPath(a, edge, holeL, hole, hole * 0.25);
    }
  }
  return d;
}

/** Các nét của một hình trang trí, theo toạ độ cục bộ (0..w × 0..h). */
export function ornamentPrims(o: Pick<Ornament, "kind" | "rect" | "color" | "color2" | "d" | "width">): OrnPrim[] {
  const w = Math.max(1, o.rect.w);
  const h = Math.max(1, o.rect.h);
  const m = Math.min(w, h);
  const c2 = o.color2 ?? "#f6e7c8";
  switch (o.kind) {
    case "sprig":
      return sprigPrims(w, h, o.color);
    case "flower":
      return flowerPrims(w / 2, h / 2, m * 0.48, o.color, c2);
    case "bloom": {
      // Cụm hoa: một bông lớn, một bông nhỏ, hai lá, vài nụ.
      const leafCol = o.color2 && o.color2 !== o.color ? o.color2 : "#86977a";
      return [
        { d: leafPath(w * 0.5, h * 0.55, 200, m * 0.48, m * 0.15) + leafPath(w * 0.5, h * 0.55, -20, m * 0.46, m * 0.14), fill: leafCol },
        ...flowerPrims(w * 0.42, h * 0.5, m * 0.3, o.color, "#f6e7c8"),
        ...flowerPrims(w * 0.72, h * 0.36, m * 0.17, o.color, "#f6e7c8"),
        { d: circlePath(w * 0.24, h * 0.3, m * 0.05) + circlePath(w * 0.8, h * 0.68, m * 0.045) + circlePath(w * 0.66, h * 0.82, m * 0.035), fill: o.color },
      ];
    }
    case "heart":
      return [{ d: heartPath(0, 0, w, h), fill: o.color }];
    case "sparkle":
      return [
        { d: sparklePath(w * 0.42, h * 0.42, m * 0.4), fill: o.color },
        { d: sparklePath(w * 0.82, h * 0.18, m * 0.14) + sparklePath(w * 0.78, h * 0.82, m * 0.1), fill: o.color },
      ];
    case "tape":
      return [{ d: tapePath(w, h), fill: o.color }];
    case "film":
      return [{ d: filmPath(w, h), fill: o.color, evenodd: true }];
    case "path":
      return o.d ? [{ d: o.d, stroke: o.color, sw: o.width ?? 2 }] : [];
    case "qr":
      return o.d ? [{ d: o.d, fill: o.color }] : [];
    case "card":
      return [{ d: roundRectPath(0, 0, w, h, m * 0.08), fill: o.color }];
  }
  return [];
}

/* ── Viền tem thư (khung ảnh shape "stamp") ─────────────────────────────── */

/** Bán kính răng tem theo cỡ khung. */
export const stampTooth = (w: number, h: number) => Math.max(2, Math.min(w, h) * 0.03);

/** Đường viền tem: chữ nhật, mép khoét răng cưa nửa tròn hướng vào trong. */
export function stampPath(w: number, h: number): string {
  const r = stampTooth(w, h);
  const along = (len: number) => {
    const n = Math.max(2, Math.floor(len / (r * 2.7)));
    const sp = len / n;
    return Array.from({ length: n }, (_, i) => sp * (i + 0.5));
  };
  const xs = along(w);
  const ys = along(h);
  const R = f1(r);
  let d = "M0 0";
  for (const x of xs) d += `L${f1(x - r)} 0A${R} ${R} 0 0 0 ${f1(x + r)} 0`;
  d += `L${f1(w)} 0`;
  for (const y of ys) d += `L${f1(w)} ${f1(y - r)}A${R} ${R} 0 0 0 ${f1(w)} ${f1(y + r)}`;
  d += `L${f1(w)} ${f1(h)}`;
  for (const x of [...xs].reverse()) d += `L${f1(x + r)} ${f1(h)}A${R} ${R} 0 0 0 ${f1(x - r)} ${f1(h)}`;
  d += `L0 ${f1(h)}`;
  for (const y of [...ys].reverse()) d += `L0 ${f1(y + r)}A${R} ${R} 0 0 0 0 ${f1(y - r)}`;
  return `${d}Z`;
}

/* ── Hoa văn chia dòng của mẫu chữ ─────────────────────────────────────── */

export type DividerKind = "line" | "diamond" | "dots" | "heart" | "flourish" | "leaf";

/** Hoa văn nằm giữa hộp w×h (vẽ cùng màu chữ). */
export function dividerPrims(kind: DividerKind, w: number, h: number, color: string): OrnPrim[] {
  const cx = w / 2;
  const cy = h / 2;
  const t = Math.max(0.6, h * 0.07);
  const line = (x0: number, x1: number) => `M${f1(x0)} ${f1(cy - t / 2)}H${f1(x1)}V${f1(cy + t / 2)}H${f1(x0)}Z`;
  switch (kind) {
    case "line":
      return [{ d: line(cx - w * 0.22, cx + w * 0.22), fill: color }];
    case "diamond": {
      const s = h * 0.32;
      return [{ d: line(cx - w * 0.3, cx - s * 1.8) + line(cx + s * 1.8, cx + w * 0.3) + `M${f1(cx)} ${f1(cy - s)}L${f1(cx + s)} ${f1(cy)}L${f1(cx)} ${f1(cy + s)}L${f1(cx - s)} ${f1(cy)}Z`, fill: color }];
    }
    case "dots": {
      const r = h * 0.11;
      return [{ d: circlePath(cx - r * 4.5, cy, r) + circlePath(cx, cy, r * 1.25) + circlePath(cx + r * 4.5, cy, r), fill: color }];
    }
    case "heart": {
      const s = h * 0.62;
      return [{ d: line(cx - w * 0.26, cx - s * 1.1) + line(cx + s * 1.1, cx + w * 0.26) + heartPath(cx - s / 2, cy - s / 2, s, s * 0.92), fill: color }];
    }
    case "flourish": {
      // Hai dải xoắn đối xứng ôm một hình thoi nhỏ ở giữa.
      const a = w * 0.3;
      const k = h * 0.36;
      const right = `M${f1(cx + h * 0.4)} ${f1(cy)}C${f1(cx + a * 0.35)} ${f1(cy - k)} ${f1(cx + a * 0.6)} ${f1(cy + k)} ${f1(cx + a)} ${f1(cy)}`;
      const left = `M${f1(cx - h * 0.4)} ${f1(cy)}C${f1(cx - a * 0.35)} ${f1(cy - k)} ${f1(cx - a * 0.6)} ${f1(cy + k)} ${f1(cx - a)} ${f1(cy)}`;
      const s = h * 0.22;
      return [
        { d: right + left, stroke: color, sw: Math.max(0.6, h * 0.06) },
        { d: `M${f1(cx)} ${f1(cy - s)}L${f1(cx + s)} ${f1(cy)}L${f1(cx)} ${f1(cy + s)}L${f1(cx - s)} ${f1(cy)}Z`, fill: color },
      ];
    }
    case "leaf": {
      const L = h * 0.9;
      return [
        { d: line(cx - w * 0.24, cx - L * 1.15) + line(cx + L * 1.15, cx + w * 0.24), fill: color },
        { d: leafPath(cx - h * 0.08, cy, 180, L, L * 0.3) + leafPath(cx + h * 0.08, cy, 0, L, L * 0.3) + circlePath(cx, cy, h * 0.09), fill: color },
      ];
    }
  }
  return [];
}

/** Đường SVG hợp lệ (chỉ lệnh vẽ + số) — để máy chủ nhận "path" tự do an toàn. */
export const PATH_RE = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]{1,4000}$/;
/** Ô của mã QR: chỉ M / h / v / z và số — dài hơn (mỗi hàng nhiều đoạn). */
export const QR_PATH_RE = /^[MhvzZ0-9.\s-]{1,40000}$/;
