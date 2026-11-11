/* ═══════════════════════════════════════════════════════════════════════════
   BỐ CỤC TRANG TRÍ — để bộ ảnh ghép không chỉ là lưới chữ nhật:
     • ảnh in viền trắng kiểu polaroid, xoay nhẹ, đổ bóng (chữ viết trên viền);
     • hai ảnh in chồng chéo góc; nhiều ảnh in rải như trên bàn (scrapbook);
     • ảnh lớn + ảnh nhỏ có viền đè lên góc (inset);
     • khung vòm (arch), hàng vòm; khung tròn / bầu dục, cụm ảnh tròn;
     • hàng ảnh bo góc so le kiểu bậc thang.
   Kích thước khung tính theo ĐÚNG tỉ lệ từng ảnh (ảnh ít bị cắt), mọi thứ nằm
   trong vùng an toàn (Story). Thuần, không đụng DOM — compose.ts gọi vào đây.
   ═══════════════════════════════════════════════════════════════════════════ */
import type { BgPhoto, Frame, FrameDeco, LayoutInput, PhotoFrame, Rect, TextAlign, TextFrame } from "./types";
import type { CollageFormat } from "./formats";
import type { CollageStyle } from "./styles";
import { isDarkColor } from "./styles";
import type { TextPreset } from "./typography";
import type { Ornament } from "./ornaments";
import { DEFAULT_CROP, focusCrop } from "./crop";
import { photoArea, rotatePoint } from "./frame-geom";
import { uid } from "./rng";

export interface DecorCtx {
  photos: LayoutInput[];
  f: CollageFormat;
  st: CollageStyle;
  short: number;
  /** Vùng an toàn (Story trừ phần bị giao diện che). */
  safe: Rect;
  text: string;
  preset: TextPreset | null;
  /** Màu chữ đặt trên nền trang (trắng nếu nền là ảnh mờ). */
  ink: string;
  /** Chữ đặt trên nền ảnh mờ thì có bóng. */
  inkShadow: boolean;
  r: () => number;
  textFrame: (box: Rect, color: string, align?: TextAlign, shadow?: boolean) => TextFrame[];
  /** Chiều cao khối chữ cần trong bề ngang w (gồm dòng phụ của mẫu chữ). */
  textNeed: (w: number) => number;
  bgFor: (frames: Frame[]) => BgPhoto | undefined;
}

export interface DecorResult {
  recipe: string;
  frames: Frame[];
  cost: number;
  bgPhoto?: BgPhoto;
  ornaments?: Ornament[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Khung ảnh có trang trí, điểm giữa cắt theo khuôn mặt của PHẦN ẢNH (trừ viền). */
function mk(p: LayoutInput, rect: Rect, deco?: FrameDeco): PhotoFrame {
  const fr: PhotoFrame = { kind: "photo", id: uid("f"), rect, photoId: p.id, crop: { ...DEFAULT_CROP }, ...(deco ? { deco } : {}) };
  const a = photoArea(fr);
  fr.crop = focusCrop(p.faces, a.w / a.h, p.aspect > 0 ? p.aspect : 1.5);
  return fr;
}

/** Ảnh bị cắt bao nhiêu (0 = vừa khít), lấy trung bình theo diện tích phần ảnh. */
function cropCost(frames: PhotoFrame[], byId: Map<string, LayoutInput>): number {
  let sum = 0;
  let total = 0;
  for (const fr of frames) {
    const a = photoArea(fr);
    const p = byId.get(fr.photoId);
    const ratio = a.w / a.h / (p && p.aspect > 0 ? p.aspect : 1.5);
    const area = a.w * a.h;
    sum += area * (1 - Math.min(ratio, 1 / ratio));
    total += area;
  }
  return total ? sum / total : 0;
}

/** Hộp ngoài của một ảnh in (phần ảnh tỉ lệ `a`, viền pad, viền dưới pb) vừa trong maxW × maxH. */
function printSize(a: number, maxW: number, maxH: number, pad: number, pb: number): { w: number; h: number } {
  let w = maxW;
  let ih = (w - 2 * pad) / a;
  let h = ih + pad + pb;
  if (h > maxH) {
    h = maxH;
    ih = Math.max(1, h - pad - pb);
    w = ih * a + 2 * pad;
  }
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

/** Xếp ảnh theo điểm (ảnh chính trước). */
const ranked = (photos: LayoutInput[]) => [...photos].sort((a, b) => b.score + (b.hero ? 2 : 0) - (a.score + (a.hero ? 2 : 0)));

/** Chữ nằm trên một khung đang xoay: dời tâm hộp chữ theo phép xoay quanh tâm khung, xoay chữ cùng góc. */
function rotateWith(t: TextFrame, cx: number, cy: number, deg: number): TextFrame {
  if (!deg) return t;
  const c = rotatePoint(t.rect.x + t.rect.w / 2, t.rect.y + t.rect.h / 2, cx, cy, deg);
  return { ...t, rect: { ...t.rect, x: c.x - t.rect.w / 2, y: c.y - t.rect.h / 2 }, rotate: round1(deg) };
}

/** Góc xoay ngẫu nhiên (độ) trong [lo, hi], dấu ngẫu nhiên. */
const tilt = (r: () => number, lo: number, hi: number) => round1((r() < 0.5 ? -1 : 1) * (lo + r() * (hi - lo)));

/** Màu hoa lá / băng dính hợp nền trang (nền tối / ảnh mờ thì dùng tông sáng). */
export function floraFor(st: CollageStyle): { leaf: string; flower: string; center: string; tape: string } {
  if (st.bgPhoto || isDarkColor(st.background)) return { leaf: "#d3dcc6", flower: "#f6dcd8", center: "#f7e7c9", tape: "#efe4d2" };
  switch (st.id) {
    case "kraft":
      return { leaf: "#5f6f4f", flower: "#f4ece0", center: "#d9b77a", tape: "#f1e7d6" };
    case "blush":
      return { leaf: "#879779", flower: "#df9fa3", center: "#f6e3c3", tape: "#e9c9c4" };
    case "sage":
      return { leaf: "#5c6e55", flower: "#f6f1e8", center: "#e2c48f", tape: "#d9dfcf" };
    case "tradition":
      return { leaf: "#d9b56c", flower: "#f0d49a", center: "#7b1e22", tape: "#e8c98f" };
    default:
      return { leaf: "#879779", flower: "#e8b9b5", center: "#f6e3c3", tape: "#e6d6c4" };
  }
}

/** Một hình trang trí. */
function orn(kind: Ornament["kind"], rect: Rect, color: string, extra: Partial<Ornament> = {}): Ornament {
  return { id: uid("o"), kind, rect, color, ...extra };
}

/** Màu viền ảnh in hợp nền trang: giấy ảnh trắng, nền kem thì trắng ngà. */
function paperFor(st: CollageStyle): string {
  if (st.id === "ivory" || st.id === "kraft") return "#fbf8f2";
  return "#ffffff";
}

/**
 * Các bố cục trang trí cho 1–6 ảnh. Phong cách có decoBias = 0 (ghép sát) không
 * dùng nhóm này.
 */
export function decorOptions(c: DecorCtx): DecorResult[] {
  const { f, st, short, safe, r } = c;
  const bias = st.decoBias ?? 0.4;
  if (bias <= 0) return [];
  const n = c.photos.length;
  if (!n || n > 6) return [];
  const W = f.w;
  const byId = new Map(c.photos.map((p) => [p.id, p]));
  const out: DecorResult[] = [];
  const hasText = !!c.preset && !!c.text;
  const portrait = f.h / f.w > 1.05;
  const landscape = f.w / f.h > 1.15;
  const paper = paperFor(st);
  const paperInk = isDarkColor(paper) ? "#ffffff" : "#2b2622";
  const shadowFor = (box: Rect) => c.textFrame(box, c.ink, "center", c.inkShadow);
  // Khoảng lề quanh cả bố cục.
  const mx = W * (landscape ? 0.06 : 0.075);
  const my = safe.h * 0.06;
  const area: Rect = { x: mx, y: safe.y + my, w: W - 2 * mx, h: safe.h - 2 * my };
  const need = (w: number) => (hasText ? c.textNeed(w) + short * 0.05 : 0);
  const push = (recipe: string, frames: Frame[], extra = 0, ornaments?: Ornament[]) => {
    const photosOnly = frames.filter((x): x is PhotoFrame => x.kind === "photo");
    const cost = cropCost(photosOnly, byId) * 2.5 + 0.1 - bias * 0.7 + extra + r() * 0.08;
    out.push({ recipe, frames, cost, ...(c.bgFor(photosOnly) ? { bgPhoto: c.bgFor(photosOnly) } : {}), ...(ornaments?.length ? { ornaments } : {}) });
  };
  const fl = floraFor(st);
  const ord = ranked(c.photos);
  const aspectOf = (p: LayoutInput, lo: number, hi: number) => clamp(p.aspect > 0 ? p.aspect : 1.5, lo, hi);

  /* ── 1 ảnh: polaroid · vòm · bầu dục ─────────────────────────────────────── */
  if (n === 1) {
    const p = ord[0];
    // Polaroid: viền trắng, viền dưới dày (chữ viết tay nằm ở đó), xoay nhẹ.
    {
      const pad = short * 0.035;
      const a = aspectOf(p, 0.72, 1.35);
      const maxW = W * (portrait ? 0.76 : landscape ? 0.5 : 0.68);
      let pb = short * 0.12;
      if (hasText) pb = clamp(need(maxW * 0.86), short * 0.13, short * 0.3);
      const sz = printSize(a, maxW, area.h * 0.94, pad, pb);
      const rect: Rect = { x: (W - sz.w) / 2, y: safe.y + (safe.h - sz.h) / 2, w: sz.w, h: sz.h };
      const rot = tilt(r, 1.5, 3.5);
      const fr = mk(p, rect, { pad, padBottom: pb, padColor: paper, rotate: rot, shadow: true });
      const frames: Frame[] = [fr];
      if (hasText) {
        const inner = photoArea(fr);
        const box: Rect = { x: rect.x + pad * 1.2, y: inner.y + inner.h + short * 0.01, w: rect.w - pad * 2.4, h: pb - short * 0.02 };
        frames.push(...c.textFrame(box, paperInk).map((t) => rotateWith(t, rect.x + rect.w / 2, rect.y + rect.h / 2, rot)));
      }
      push("deco-polaroid", frames);
      // Bản có hoa lá: cành lá chồm qua góc trên, cụm hoa ở góc dưới đối diện.
      const s = Math.min(rect.w, rect.h);
      const left = rot < 0;
      push("deco-polaroid:floral", frames.map((x) => ({ ...x, id: uid(x.kind === "photo" ? "f" : "t") })), 0.03, [
        orn("sprig", { x: left ? rect.x - s * 0.16 : rect.x + rect.w - s * 0.5, y: rect.y - s * 0.2, w: s * 0.66, h: s * 0.5 }, fl.leaf, { rotate: left ? -12 : 100, flip: !left, over: true }),
        // Có chữ trên viền dưới: cụm hoa đẩy ra ngoài góc, không đè lên chữ.
        orn(
          "bloom",
          hasText
            ? { x: left ? rect.x + rect.w - s * 0.12 : rect.x - s * 0.3, y: rect.y + rect.h - s * 0.16, w: s * 0.42, h: s * 0.38 }
            : { x: left ? rect.x + rect.w - s * 0.34 : rect.x - s * 0.1, y: rect.y + rect.h - s * 0.3, w: s * 0.44, h: s * 0.4 },
          fl.flower,
          { color2: fl.leaf, over: true },
        ),
      ]);
    }
    // Vòm: ảnh trên tròn như cửa vòm, chữ bên dưới.
    {
      const a = 0.74;
      const textH = hasText ? clamp(need(area.w * 0.86), short * 0.12, area.h * 0.34) : 0;
      const maxH = area.h - textH - (hasText ? short * 0.03 : 0);
      const sz = printSize(a, W * (portrait ? 0.68 : 0.5), maxH, 0, 0);
      const top = safe.y + (safe.h - (sz.h + textH + (hasText ? short * 0.03 : 0))) / 2;
      const rect: Rect = { x: (W - sz.w) / 2, y: top, w: sz.w, h: sz.h };
      const frames: Frame[] = [mk(p, rect, { shape: "arch" })];
      if (hasText) frames.push(...shadowFor({ x: area.x + area.w * 0.07, y: rect.y + rect.h + short * 0.03, w: area.w * 0.86, h: textH }));
      push("deco-arch", frames, 0.02);
      // Bản có hoa: hai cụm hoa ôm chân vòm, cành lá vắt qua đỉnh vòm.
      const s = rect.w;
      push("deco-arch:floral", frames.map((x) => ({ ...x, id: uid(x.kind === "photo" ? "f" : "t") })), 0.05, [
        orn("sprig", { x: rect.x + rect.w * 0.52, y: rect.y - s * 0.12, w: s * 0.6, h: s * 0.36 }, fl.leaf, { rotate: 8, over: true }),
        orn("bloom", { x: rect.x - s * 0.16, y: rect.y + rect.h - s * 0.36, w: s * 0.46, h: s * 0.4 }, fl.flower, { color2: fl.leaf, over: true }),
        orn("bloom", { x: rect.x + rect.w - s * 0.3, y: rect.y + rect.h - s * 0.32, w: s * 0.4, h: s * 0.34 }, fl.flower, { color2: fl.leaf, flip: true, over: true }),
      ]);
    }
    // Bầu dục có viền mảnh — kiểu thiệp cưới cổ điển.
    {
      const a = 0.8;
      const textH = hasText ? clamp(need(area.w * 0.86), short * 0.12, area.h * 0.32) : 0;
      const pad = short * 0.014;
      const maxH = area.h - textH - (hasText ? short * 0.03 : 0);
      const sz = printSize(a, W * (portrait ? 0.62 : 0.46), maxH, pad, pad);
      const top = safe.y + (safe.h - (sz.h + textH + (hasText ? short * 0.03 : 0))) / 2;
      const rect: Rect = { x: (W - sz.w) / 2, y: top, w: sz.w, h: sz.h };
      const frames: Frame[] = [mk(p, rect, { shape: "oval", pad, padColor: paper, shadow: true })];
      if (hasText) frames.push(...shadowFor({ x: area.x + area.w * 0.07, y: rect.y + rect.h + short * 0.03, w: area.w * 0.86, h: textH }));
      push("deco-oval", frames, 0.08);
      // Vòng lá: hai cành ôm hai bên khung bầu dục (nằm sau khung), lấp lánh nhỏ.
      const s = rect.w;
      push("deco-oval:wreath", frames.map((x) => ({ ...x, id: uid(x.kind === "photo" ? "f" : "t") })), 0.08, [
        orn("sprig", { x: rect.x - s * 0.22, y: rect.y + rect.h * 0.38, w: s * 0.62, h: rect.h * 0.62 }, fl.leaf, { rotate: -8 }),
        orn("sprig", { x: rect.x + rect.w - s * 0.4, y: rect.y + rect.h * 0.38, w: s * 0.62, h: rect.h * 0.62 }, fl.leaf, { rotate: 8, flip: true }),
        orn("bloom", { x: rect.x + rect.w / 2 - s * 0.17, y: rect.y + rect.h - s * 0.2, w: s * 0.34, h: s * 0.3 }, fl.flower, { color2: fl.leaf, over: true }),
      ]);
    }
    // Tem thư: viền răng cưa, xoay nhẹ, chữ bên dưới.
    {
      const pad = short * 0.042;
      const a = aspectOf(p, 0.72, 1.35);
      const textH = hasText ? clamp(need(area.w * 0.86), short * 0.12, area.h * 0.3) : 0;
      const maxH = area.h - textH - (hasText ? short * 0.04 : 0);
      const sz = printSize(a, W * (portrait ? 0.7 : 0.5), maxH, pad, pad);
      const top = safe.y + (safe.h - (sz.h + textH + (hasText ? short * 0.04 : 0))) / 2;
      const rect: Rect = { x: (W - sz.w) / 2, y: top, w: sz.w, h: sz.h };
      const frames: Frame[] = [mk(p, rect, { shape: "stamp", pad, padColor: paper, rotate: tilt(r, 1.5, 3), shadow: true })];
      if (hasText) frames.push(...shadowFor({ x: area.x + area.w * 0.07, y: rect.y + rect.h + short * 0.04, w: area.w * 0.86, h: textH }));
      push("deco-stamp", frames, 0.04, [orn("sparkle", { x: rect.x + rect.w - short * 0.06, y: rect.y - short * 0.08, w: short * 0.14, h: short * 0.14 }, fl.center === "#7b1e22" ? "#f0d49a" : "#d9b77a", { over: true })]);
    }
  }

  /* ── 2 ảnh: hai ảnh in chồng chéo · ảnh lớn + ảnh nhỏ đè góc ──────────────── */
  if (n === 2) {
    const [a0, a1] = ord;
    // Hai ảnh in chéo góc, ảnh sau đè lên ảnh trước.
    {
      const pad = short * 0.024;
      const pb = short * 0.07;
      const A = printSize(aspectOf(a0, 0.68, 1.5), area.w * 0.64, area.h * 0.62, pad, pb);
      const B = printSize(aspectOf(a1, 0.68, 1.5), area.w * 0.56, area.h * 0.56, pad, pb);
      const ra: Rect = { x: area.x, y: area.y, w: A.w, h: A.h };
      const rb: Rect = { x: area.x + area.w - B.w, y: area.y + area.h - B.h, w: B.w, h: B.h };
      const frames: Frame[] = [
        mk(a0, ra, { pad, padBottom: pb, padColor: paper, rotate: tilt(r, 2, 4.5), shadow: true }),
        mk(a1, rb, { pad, padBottom: pb, padColor: paper, rotate: tilt(r, 2, 4.5), shadow: true }),
      ];
      let extra = 0;
      if (hasText) {
        // Chữ vào góc trống lớn hơn: dưới ảnh A (bên trái ảnh B) hoặc trên ảnh B (bên phải ảnh A).
        const g = short * 0.03;
        const left: Rect = { x: area.x, y: ra.y + ra.h + g, w: rb.x - area.x - g, h: area.y + area.h - (ra.y + ra.h + g) };
        const right: Rect = { x: ra.x + ra.w + g, y: area.y, w: area.x + area.w - (ra.x + ra.w + g), h: rb.y - area.y - g };
        const box = left.w * left.h >= right.w * right.h ? left : right;
        if (box.w < short * 0.22 || box.h < need(box.w) * 0.7) extra += 0.35;
        frames.push(...shadowFor(box));
      }
      // Ảnh in vừa khít tỉ lệ nên gần như không cắt — cộng chút để không lấn át các họ khác.
      push("deco-prints", frames, extra + 0.12);
    }
    // Ảnh lớn tràn trang + ảnh nhỏ viền trắng đè góc dưới.
    {
      const pad = short * 0.018;
      const big: Rect = { x: 0, y: 0, w: W, h: f.h };
      const I = printSize(aspectOf(a1, 0.7, 1.45), W * (portrait ? 0.4 : 0.32), safe.h * 0.42, pad, pad);
      const inset: Rect = { x: W - mx - I.w, y: safe.y + safe.h - my - I.h, w: I.w, h: I.h };
      const frames: Frame[] = [mk(a0, big), mk(a1, inset, { pad, padColor: paper, shadow: true, ...(r() < 0.5 ? { rotate: tilt(r, 1.5, 3) } : {}) })];
      if (hasText) {
        const h = clamp(need(W * 0.8), short * 0.12, safe.h * 0.3);
        frames.push(...c.textFrame({ x: W * 0.1, y: safe.y + my, w: W * 0.8, h }, "#ffffff", "center", true));
      }
      // Ảnh nền tràn trang: chỉ đẹp khi phong cách thích tràn khung.
      push("deco-inset:bleed", frames, 0.12 - st.bleedBias * 0.25);
    }
    // Ảnh lớn có lề + ảnh nhỏ đè lên mép dưới bên phải, chữ bên trái.
    if (portrait || !landscape) {
      const pad = short * 0.018;
      const heroH = area.h * (hasText ? 0.7 : 0.78);
      const hero: Rect = { x: area.x, y: area.y, w: area.w, h: heroH };
      const I = printSize(aspectOf(a1, 0.7, 1.45), area.w * 0.42, area.h * 0.42, pad, pad);
      const inset: Rect = { x: area.x + area.w - I.w + mx * 0.4, y: Math.min(hero.y + hero.h - I.h * 0.45, area.y + area.h - I.h), w: I.w, h: I.h };
      const frames: Frame[] = [mk(a0, hero, st.margin > 0.05 ? { shape: "round" } : undefined), mk(a1, inset, { pad, padColor: paper, shadow: true })];
      let extra = 0;
      if (hasText) {
        const box: Rect = { x: area.x, y: hero.y + hero.h + short * 0.03, w: inset.x - area.x - short * 0.03, h: area.y + area.h - (hero.y + hero.h + short * 0.03) };
        if (box.w < short * 0.3 || box.h < need(box.w) * 0.7) extra += 0.3;
        frames.push(...c.textFrame(box, c.ink, "left", c.inkShadow));
      }
      push("deco-inset:frame", frames, extra);
    }
    // Hai vòm cạnh nhau.
    {
      const textH = hasText ? clamp(need(area.w * 0.86), short * 0.12, area.h * 0.3) : 0;
      const g = short * 0.03;
      const w = (area.w - g) / 2;
      const h = Math.min(w / 0.66, area.h - textH - (hasText ? g : 0));
      const top = safe.y + (safe.h - (h + textH + (hasText ? g : 0))) / 2;
      const frames: Frame[] = [a0, a1].map((p, i) => mk(p, { x: area.x + i * (w + g), y: top, w, h }, { shape: "arch" }));
      if (hasText) frames.push(...shadowFor({ x: area.x + area.w * 0.07, y: top + h + g, w: area.w * 0.86, h: textH }));
      push("deco-arches", frames, 0.04);
    }
    // Ảnh tròn lớn + ảnh tròn nhỏ đè cạnh.
    {
      const pad = short * 0.012;
      const D = Math.min(area.w * 0.74, area.h * (hasText ? 0.6 : 0.7));
      const d = D * 0.5;
      const big: Rect = { x: area.x + (area.w - D) * 0.25, y: area.y + (hasText ? 0 : area.h * 0.05), w: D, h: D };
      const small: Rect = { x: Math.min(area.x + area.w - d, big.x + D * 0.82), y: big.y + D * 0.62, w: d, h: d };
      const frames: Frame[] = [mk(a0, big, { shape: "oval", pad, padColor: paper, shadow: true }), mk(a1, small, { shape: "oval", pad, padColor: paper, shadow: true })];
      let extra = 0.06;
      if (hasText) {
        const y = Math.max(big.y + D, small.y + d) + short * 0.03;
        const box: Rect = { x: area.x + area.w * 0.06, y, w: area.w * 0.88, h: area.y + area.h - y };
        if (box.h < need(box.w) * 0.7) extra += 0.35;
        frames.push(...shadowFor(box));
      }
      push("deco-circles", frames, extra);
    }
  }

  /* ── 2 ảnh: hai tem thư chồng chéo ─────────────────────────────────────── */
  if (n === 2) {
    const [a0, a1] = ord;
    const pad = short * 0.032;
    const A = printSize(aspectOf(a0, 0.7, 1.45), area.w * 0.6, area.h * 0.58, pad, pad);
    const B = printSize(aspectOf(a1, 0.7, 1.45), area.w * 0.52, area.h * 0.52, pad, pad);
    const ra: Rect = { x: area.x + area.w * 0.02, y: area.y + area.h * 0.02, w: A.w, h: A.h };
    const rb: Rect = { x: area.x + area.w - B.w, y: area.y + area.h - B.h, w: B.w, h: B.h };
    const frames: Frame[] = [
      mk(a0, ra, { shape: "stamp", pad, padColor: paper, rotate: tilt(r, 2, 4), shadow: true }),
      mk(a1, rb, { shape: "stamp", pad, padColor: paper, rotate: tilt(r, 2, 4), shadow: true }),
    ];
    let extra = 0.1;
    if (hasText) {
      const g = short * 0.03;
      const left: Rect = { x: area.x, y: ra.y + ra.h + g, w: rb.x - area.x - g, h: area.y + area.h - (ra.y + ra.h + g) };
      const right: Rect = { x: ra.x + ra.w + g, y: area.y, w: area.x + area.w - (ra.x + ra.w + g), h: rb.y - area.y - g };
      const box = left.w * left.h >= right.w * right.h ? left : right;
      if (box.w < short * 0.22 || box.h < need(box.w) * 0.7) extra += 0.35;
      frames.push(...shadowFor(box));
    }
    push("deco-stamps", frames, extra);
  }

  /* ── 2–4 ảnh: dải phim (lỗ răng cưa hai mép), xoay nhẹ ─────────────────── */
  if (n >= 2 && n <= 4) {
    const vertical = !landscape;
    const textSpace = hasText ? (vertical ? area.w * 0.36 : area.h * 0.28) : 0;
    const T = vertical ? Math.min(area.w * (hasText ? 0.58 : 0.66), area.w - textSpace) : Math.min(area.h * 0.62, area.h - textSpace);
    const win = T * 0.74;
    const g = T * 0.07;
    const sizes = c.photos.map((p) => {
      const a = aspectOf(p, vertical ? 0.95 : 0.75, vertical ? 1.5 : 1.25);
      return vertical ? { w: win, h: win / a } : { w: win * a, h: win };
    });
    const along = sizes.reduce((sum, x) => sum + (vertical ? x.h : x.w), 0) + g * (n - 1) + T * 0.24;
    const maxAlong = vertical ? area.h : area.w;
    const k = Math.min(1, maxAlong / along);
    const TT = T * k;
    const strip: Rect = vertical
      ? { x: hasText ? area.x : area.x + (area.w - TT) / 2, y: area.y + (area.h - along * k) / 2, w: TT, h: along * k }
      : { x: area.x + (area.w - along * k) / 2, y: hasText ? area.y : area.y + (area.h - TT) / 2, w: along * k, h: TT };
    const rot = tilt(r, 1.2, 2.6);
    const cx = strip.x + strip.w / 2;
    const cy = strip.y + strip.h / 2;
    let at = (vertical ? strip.y : strip.x) + T * 0.12 * k;
    const frames: Frame[] = c.photos.map((p, i) => {
      const w = sizes[i].w * k;
      const h = sizes[i].h * k;
      const x0 = vertical ? strip.x + (TT - w) / 2 : at;
      const y0 = vertical ? at : strip.y + (TT - h) / 2;
      at += (vertical ? h : w) + g * k;
      const c0 = rotatePoint(x0 + w / 2, y0 + h / 2, cx, cy, rot);
      return mk(p, { x: c0.x - w / 2, y: c0.y - h / 2, w, h }, { rotate: rot });
    });
    let extra = 0.06;
    if (hasText) {
      const box: Rect = vertical
        ? { x: strip.x + strip.w + short * 0.05, y: area.y + area.h * 0.2, w: area.x + area.w - (strip.x + strip.w + short * 0.05), h: area.h * 0.6 }
        : { x: area.x + area.w * 0.07, y: strip.y + strip.h + short * 0.04, w: area.w * 0.86, h: area.y + area.h - (strip.y + strip.h + short * 0.04) };
      if (box.w < short * 0.24 || box.h < need(box.w) * 0.7) extra += 0.3;
      frames.push(...c.textFrame(box, c.ink, vertical ? "left" : "center", c.inkShadow));
    }
    push("deco-film", frames, extra, [orn("film", strip, "#161514", { rotate: rot })]);
  }

  /* ── 3 ảnh: hàng vòm · bậc thang · cụm tròn · ảnh rải ─────────────────────── */
  if (n === 3) {
    // Hàng ba vòm.
    {
      const textH = hasText ? clamp(need(area.w * 0.86), short * 0.12, area.h * 0.3) : 0;
      const g = short * 0.025;
      const w = (area.w - 2 * g) / 3;
      const h = Math.min(w / 0.6, area.h - textH - (hasText ? g * 1.4 : 0));
      const top = safe.y + (safe.h - (h + textH + (hasText ? g * 1.4 : 0))) / 2;
      // Ảnh chính ở giữa.
      const order = [ord[1], ord[0], ord[2]];
      const frames: Frame[] = order.map((p, i) => mk(p, { x: area.x + i * (w + g), y: top, w, h }, { shape: "arch" }));
      if (hasText) frames.push(...shadowFor({ x: area.x + area.w * 0.07, y: top + h + g * 1.4, w: area.w * 0.86, h: textH }));
      push("deco-arches", frames, 0.04);
    }
    // Bậc thang: ba ảnh bo góc so le, chữ ở góc trống phía trên bên phải.
    {
      const g = short * 0.025;
      const w = (area.w - 2 * g) / 3;
      const h = Math.min(w / 0.68, area.h * 0.76);
      const step = (area.h - h) / 2;
      const down = r() < 0.5;
      const frames: Frame[] = [ord[0], ord[1], ord[2]].map((p, i) =>
        mk(p, { x: area.x + i * (w + g), y: area.y + (down ? i : 2 - i) * step, w, h }, { shape: "round", shadow: st.bgPhoto ? true : undefined }),
      );
      let extra = 0.03;
      if (hasText) {
        // Bậc đi xuống → khoảng trống phía TRÊN hai ảnh sau; đi lên → phía DƯỚI hai ảnh sau.
        const box: Rect = down
          ? { x: area.x + w + g, y: area.y, w: 2 * w + g, h: Math.max(1, step - g) }
          : { x: area.x + w + g, y: area.y + step + h + g, w: 2 * w + g, h: Math.max(1, step - g) };
        if (box.h < need(box.w) * 0.7) extra += 0.3;
        frames.push(...c.textFrame(box, c.ink, "center", c.inkShadow));
      }
      push("deco-stagger", frames, extra);
    }
    // Cụm tròn: một tròn lớn, hai tròn nhỏ.
    {
      const pad = short * 0.011;
      const textH = hasText ? clamp(need(area.w * 0.86), short * 0.12, area.h * 0.26) : 0;
      const avail = area.h - textH - (hasText ? short * 0.03 : 0);
      const D = Math.min(area.w * 0.66, avail * 0.78);
      const d = D * 0.54;
      const big: Rect = { x: area.x + area.w * 0.04, y: area.y, w: D, h: D };
      const s1: Rect = { x: area.x + area.w - d, y: area.y + D * 0.06, w: d, h: d };
      const s2: Rect = { x: area.x + area.w - d * 1.12, y: Math.min(area.y + avail - d, big.y + D * 0.62), w: d, h: d };
      const frames: Frame[] = [
        mk(ord[0], big, { shape: "oval", pad, padColor: paper, shadow: true }),
        mk(ord[1], s1, { shape: "oval", pad, padColor: paper, shadow: true }),
        mk(ord[2], s2, { shape: "oval", pad, padColor: paper, shadow: true }),
      ];
      if (hasText) {
        const y = Math.max(big.y + D, s2.y + d) + short * 0.03;
        frames.push(...shadowFor({ x: area.x + area.w * 0.07, y, w: area.w * 0.86, h: Math.max(short * 0.1, area.y + area.h - y) }));
      }
      push("deco-circles", frames, 0.08);
    }
    // Ảnh lớn tràn trang + hai ảnh in nhỏ đè góc dưới.
    {
      const pad = short * 0.016;
      const I1 = printSize(aspectOf(ord[1], 0.7, 1.45), W * (portrait ? 0.34 : 0.27), safe.h * 0.36, pad, pad);
      const I2 = printSize(aspectOf(ord[2], 0.7, 1.45), W * (portrait ? 0.34 : 0.27), safe.h * 0.36, pad, pad);
      const yb = safe.y + safe.h - my;
      const frames: Frame[] = [
        mk(ord[0], { x: 0, y: 0, w: W, h: f.h }),
        mk(ord[1], { x: mx, y: yb - I1.h, w: I1.w, h: I1.h }, { pad, padColor: paper, shadow: true, rotate: tilt(r, 2, 4) }),
        mk(ord[2], { x: W - mx - I2.w, y: yb - I2.h - short * 0.04, w: I2.w, h: I2.h }, { pad, padColor: paper, shadow: true, rotate: tilt(r, 2, 4) }),
      ];
      if (hasText) {
        const h = clamp(need(W * 0.8), short * 0.12, safe.h * 0.28);
        frames.push(...c.textFrame({ x: W * 0.1, y: safe.y + my, w: W * 0.8, h }, "#ffffff", "center", true));
      }
      push("deco-inset:bleed", frames, 0.14 - st.bleedBias * 0.25);
    }
  }

  /* ── 3–6 ảnh: ảnh in rải như trên bàn ───────────────────────────────────── */
  if (n >= 3) {
    const cols = n <= 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const textH = hasText ? clamp(need(area.w * 0.86), short * 0.11, area.h * 0.24) : 0;
    const top = area.y + (hasText ? textH + short * 0.02 : 0);
    const avail: Rect = { x: area.x, y: top, w: area.w, h: area.y + area.h - top };
    const cw = avail.w / cols;
    const ch = avail.h / rows;
    const pad = short * (n <= 4 ? 0.022 : 0.018);
    const pb = pad * 2.6;
    // Ảnh chính nằm giữa / trên cùng — giữ thứ tự khách chọn cho phần còn lại.
    const frames: Frame[] = [];
    const list = [...c.photos];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, n - row * cols);
      const col = i % cols;
      const offset = ((cols - inRow) * cw) / 2;
      const p = list[i];
      const sz = printSize(aspectOf(p, 0.7, 1.45), cw * 1.04, ch * 1.02, pad, pb);
      const cx = avail.x + offset + col * cw + cw / 2 + (r() - 0.5) * cw * 0.1;
      const cy = avail.y + row * ch + ch / 2 + (r() - 0.5) * ch * 0.08;
      frames.push(mk(p, { x: cx - sz.w / 2, y: cy - sz.h / 2, w: sz.w, h: sz.h }, { pad, padBottom: pb, padColor: paper, rotate: tilt(r, 2, 6.5), shadow: true }));
    }
    // Thứ tự đè ngẫu nhiên (ảnh nằm trên được thấy trọn).
    const shuffled = frames.map((x) => ({ x, k: r() })).sort((a, b) => a.k - b.k).map((x) => x.x);
    if (hasText) shuffled.push(...shadowFor({ x: area.x + area.w * 0.07, y: area.y, w: area.w * 0.86, h: textH }));
    push("deco-scatter", shuffled, n >= 5 ? 0.12 : 0.05);
    // Bản dán băng dính washi ở mép trên mỗi ảnh in.
    const tapes = shuffled
      .filter((x): x is PhotoFrame => x.kind === "photo")
      .map((x) => {
        const tw = Math.min(x.rect.w * 0.42, short * 0.2);
        const th = tw * 0.32;
        const rot = (x.deco?.rotate ?? 0) + (r() - 0.5) * 16;
        const top = rotatePoint(x.rect.x + x.rect.w / 2, x.rect.y + th * 0.15, x.rect.x + x.rect.w / 2, x.rect.y + x.rect.h / 2, x.deco?.rotate ?? 0);
        return orn("tape", { x: top.x - tw / 2, y: top.y - th / 2, w: tw, h: th }, fl.tape, { rotate: rot, opacity: 0.85, over: true });
      });
    push("deco-scatter:tape", shuffled.map((x) => ({ ...x, id: uid(x.kind === "photo" ? "f" : "t") })), n >= 5 ? 0.14 : 0.07, tapes);
  }

  /* ── 4 ảnh: lưới vòm 2×2 ─────────────────────────────────────────────────── */
  if (n === 4) {
    const textH = hasText ? clamp(need(area.w * 0.86), short * 0.11, area.h * 0.24) : 0;
    const g = short * 0.025;
    const w = (area.w - g) / 2;
    const h = Math.min(w / 0.78, (area.h - textH - (hasText ? g : 0) - g) / 2);
    const total = 2 * h + g + textH + (hasText ? g : 0);
    const top = safe.y + (safe.h - total) / 2;
    const frames: Frame[] = c.photos.map((p, i) => mk(p, { x: area.x + (i % 2) * (w + g), y: top + Math.floor(i / 2) * (h + g), w, h }, { shape: "arch" }));
    if (hasText) frames.push(...shadowFor({ x: area.x + area.w * 0.07, y: top + 2 * h + 2 * g, w: area.w * 0.86, h: textH }));
    push("deco-arches", frames, 0.08);
  }

  return out;
}

/** Khung ảnh của một bố cục lưới, thêm trang trí (bo góc / viền ảnh in) — cùng hình học, khác cảm giác. */
export function decorateGrid(frames: Frame[], kind: "round" | "print", short: number, paper: string, byId: Map<string, LayoutInput>): Frame[] {
  return frames.map((fr) => {
    if (fr.kind !== "photo") return fr;
    const deco: FrameDeco = kind === "round" ? { shape: "round" } : { pad: short * 0.012, padColor: paper, shadow: true };
    const p = byId.get(fr.photoId);
    const next: PhotoFrame = { ...fr, deco };
    const a = photoArea(next);
    return { ...next, crop: focusCrop(p?.faces, a.w / a.h, p && p.aspect > 0 ? p.aspect : 1.5) };
  });
}

export { paperFor };
