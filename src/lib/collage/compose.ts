/* ═══════════════════════════════════════════════════════════════════════════
   GHÉP MỘT TRANG từ 1–9 ảnh (+ tối đa một nội dung chữ).

   Chép ý từ Albumi (core/compose.ts): thử nhiều "công thức" — lưới thích nghi có
   lề, ghép sát tràn khung, bố cục biên tập nhiều khoảng trắng, ảnh chính làm nền
   mờ — chấm điểm, trả danh sách phương án từ tốt đến kém. Khác bản gốc: một
   trang = một ảnh đăng mạng xã hội, và chữ là NỘI DUNG KHÁCH NHẬP (dài ngắn tuỳ
   ý), nên chỗ cho chữ được tính theo độ dài nội dung, đặt dưới / trên / cạnh
   ảnh hoặc đè lên ảnh.
   ═══════════════════════════════════════════════════════════════════════════ */
import type { BgPhoto, Frame, LayoutInput, PhotoFrame, Rect, TextAlign, TextFrame } from "./types";
import type { CollageFormat } from "./formats";
import { safeArea } from "./formats";
import type { CollageStyle } from "./styles";
import { isDarkColor } from "./styles";
import { adaptiveCandidates, scoreCells, type Cell, type LayoutPhoto } from "./adaptive";
import { buildText, estimateTextHeight, presetById, type TextPreset } from "./typography";
import { focusCrop } from "./crop";
import { rng, uid } from "./rng";

type Quad = [number, number, number, number];

export interface EditorialTemplate {
  id: string;
  slots: Quad[];
  text?: Quad;
  /** Vẫn đẹp khi không có chữ (ô chữ thành khoảng thở). */
  textOptional?: boolean;
}

/** Bố cục biên tập: toạ độ theo tỉ lệ trang (0..1), tự co giãn theo mọi khổ. */
export const EDITORIAL: EditorialTemplate[] = [
  { id: "e1-frame", slots: [[0.12, 0.1, 0.76, 0.62]], text: [0.12, 0.76, 0.76, 0.16], textOptional: true },
  { id: "e1-small", slots: [[0.22, 0.18, 0.56, 0.5]], text: [0.14, 0.74, 0.72, 0.16], textOptional: true },
  { id: "e1-offset", slots: [[0.07, 0.07, 0.6, 0.86]], text: [0.7, 0.55, 0.26, 0.34] },
  { id: "e1-top", slots: [[0, 0, 1, 0.66]], text: [0.08, 0.71, 0.84, 0.22] },
  { id: "e1-side", slots: [[0, 0, 0.6, 1]], text: [0.64, 0.28, 0.32, 0.44] },
  { id: "e2-stagger", slots: [[0.07, 0.07, 0.52, 0.56], [0.62, 0.38, 0.31, 0.54]], text: [0.07, 0.68, 0.48, 0.22] },
  { id: "e2-pair", slots: [[0.07, 0.15, 0.41, 0.66], [0.52, 0.15, 0.41, 0.66]], text: [0.1, 0.84, 0.8, 0.12], textOptional: true },
  { id: "e2-steps", slots: [[0.07, 0.07, 0.56, 0.42], [0.37, 0.53, 0.56, 0.4]] },
  { id: "e3-asym", slots: [[0.06, 0.06, 0.57, 0.88], [0.66, 0.06, 0.28, 0.42], [0.66, 0.52, 0.28, 0.42]] },
  { id: "e3-band", slots: [[0.06, 0.26, 0.28, 0.42], [0.36, 0.26, 0.28, 0.42], [0.66, 0.26, 0.28, 0.42]], text: [0.08, 0.74, 0.84, 0.16], textOptional: true },
  { id: "e3-top", slots: [[0.06, 0.06, 0.88, 0.5], [0.06, 0.59, 0.43, 0.35], [0.51, 0.59, 0.43, 0.35]] },
  { id: "e3-hero-text", slots: [[0.06, 0.06, 0.88, 0.48], [0.06, 0.57, 0.42, 0.37], [0.52, 0.57, 0.42, 0.18]], text: [0.52, 0.78, 0.42, 0.16] },
  { id: "e4-strip", slots: [[0.07, 0.08, 0.86, 0.46], [0.07, 0.58, 0.28, 0.3], [0.36, 0.58, 0.28, 0.3], [0.65, 0.58, 0.28, 0.3]] },
  { id: "e4-col", slots: [[0.07, 0.07, 0.52, 0.86], [0.62, 0.07, 0.31, 0.27], [0.62, 0.365, 0.31, 0.27], [0.62, 0.66, 0.31, 0.27]] },
];

export interface ComposeInput {
  photos: LayoutInput[];
  format: CollageFormat;
  style: CollageStyle;
  /** Nội dung chữ của trang (rỗng = trang chỉ có ảnh). */
  text?: string | null;
  /** Kiểu chữ (id trong TEXT_PRESETS); không có thì máy chọn theo phong cách. */
  presetId?: string;
  seed?: number;
}

export interface ComposeResult {
  recipe: string;
  frames: Frame[];
  cost: number;
  bgPhoto?: BgPhoto;
}

/* ── Tiện ích hình học ────────────────────────────────────────────────────── */
const inset = (r: Rect, m: number): Rect => ({ x: r.x + m, y: r.y + m, w: Math.max(1, r.w - 2 * m), h: Math.max(1, r.h - 2 * m) });
const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const toLayout = (p: LayoutInput): LayoutPhoto => ({ id: p.id, aspect: p.aspect > 0 ? p.aspect : 1.5, score: p.score + (p.hero ? 2 : 0) });

/** Ảnh vào khung: cắt theo khuôn mặt nếu có. */
function cellsToFrames(cells: Cell[], byId: Map<string, LayoutInput>): PhotoFrame[] {
  return cells.map((c) => {
    const p = byId.get(c.photoId);
    const crop = focusCrop(p?.faces, c.rect.w / c.rect.h, p?.aspect ?? 1.5);
    return { kind: "photo", id: uid("f"), rect: c.rect, photoId: c.photoId, crop };
  });
}

/** Xếp ảnh vào các ô cho sẵn: ô lớn nhất nhận ảnh điểm cao nhất, ưu tiên đúng chiều (ngang / dọc). */
export function assignToSlots(slots: Rect[], photos: LayoutInput[]): Cell[] {
  const order = slots.map((r, i) => ({ i, area: r.w * r.h, a: r.w / r.h })).sort((x, y) => y.area - x.area);
  const pool = [...photos].sort((a, b) => b.score + (b.hero ? 2 : 0) - (a.score + (a.hero ? 2 : 0)));
  const out: Cell[] = new Array(slots.length);
  for (const s of order) {
    const want = s.a > 1.1 ? "L" : s.a < 0.9 ? "P" : "S";
    let k = pool.findIndex((p) => want === "S" || (p.aspect >= 1 ? "L" : "P") === want);
    if (k < 0) k = 0;
    out[s.i] = { rect: slots[s.i], photoId: pool.splice(k, 1)[0].id };
  }
  return out;
}

/** Ảnh chính (khung lớn nhất) — hợp làm nền mờ nhất. */
export function heroPhoto(frames: Frame[]): string | null {
  let best: string | null = null;
  let area = -1;
  for (const f of frames) if (f.kind === "photo" && f.rect.w * f.rect.h > area) { area = f.rect.w * f.rect.h; best = f.photoId; }
  return best;
}

/** Họ công thức — để trộn gợi ý cho đa dạng và tránh lặp giữa các trang. */
export function family(recipe: string): string {
  const head = recipe.startsWith("bgphoto|") ? `bg-${recipe.slice(8)}` : recipe;
  return head.split(":")[0];
}

function sameLayout(a: Frame[], b: Frame[]): boolean {
  const pa = a.filter((f) => f.kind === "photo");
  const pb = b.filter((f) => f.kind === "photo");
  if (pa.length !== pb.length) return false;
  const iou = (r: Rect, s: Rect) => {
    const x = Math.max(0, Math.min(r.x + r.w, s.x + s.w) - Math.max(r.x, s.x));
    const y = Math.max(0, Math.min(r.y + r.h, s.y + s.h) - Math.max(r.y, s.y));
    return (x * y) / (r.w * r.h + s.w * s.h - x * y || 1);
  };
  const avg = pa.reduce((sum, f) => sum + Math.max(...pb.map((g) => iou(f.rect, g.rect))), 0) / Math.max(1, pa.length);
  const ta = a.find((f) => f.kind === "text");
  const tb = b.find((f) => f.kind === "text");
  const textSame = !ta || !tb || iou(ta.rect, tb.rect) > 0.6;
  return avg > 0.82 && textSame;
}

/**
 * Chọn n phương án THẬT SỰ khác nhau: lần lượt lấy từ từng họ công thức (tốt
 * nhất trước), bỏ phương án gần trùng hình học (khác nền ảnh vẫn tính là khác).
 */
export function diverse(results: ComposeResult[], n: number): ComposeResult[] {
  const byFamily = new Map<string, ComposeResult[]>();
  for (const r of results) {
    const k = family(r.recipe);
    byFamily.set(k, [...(byFamily.get(k) ?? []), r]);
  }
  const queues = [...byFamily.values()];
  const out: ComposeResult[] = [];
  while (out.length < n && queues.some((q) => q.length)) {
    for (const q of queues) {
      while (q.length) {
        const r = q.shift()!;
        if (out.some((o) => !!o.bgPhoto === !!r.bgPhoto && sameLayout(o.frames, r.frames))) continue;
        out.push(r);
        break;
      }
      if (out.length >= n) break;
    }
  }
  return out;
}

/* ── Ghép trang ───────────────────────────────────────────────────────────── */

/** Kiểu chữ cho trang: khách chỉ định, hoặc máy chọn trong các kiểu hợp phong cách. */
export function pickPreset(style: CollageStyle, presetId: string | undefined, r: () => number): TextPreset {
  if (presetId) return presetById(presetId);
  const pool = style.presets.length ? style.presets : ["serif-italic"];
  return presetById(pool[Math.floor(r() * pool.length)]);
}

export function composeOptions(inp: ComposeInput): ComposeResult[] {
  const f = inp.format;
  const st = inp.style;
  const photos = inp.photos.slice(0, 9);
  const n = photos.length;
  if (!n) return [];
  const byId = new Map(photos.map((p) => [p.id, p]));
  const lp = photos.map(toLayout);
  const page: Rect = { x: 0, y: 0, w: f.w, h: f.h };
  const safe = safeArea(f);
  const short = Math.min(f.w, f.h);
  const landscape = f.w / f.h > 1.15;
  const margin = st.margin * short;
  const gap = Math.max(st.gap * short, 4);
  const r = rng((inp.seed ?? 1) * 104729 + n * 31 + (inp.text ? 7 : 0));
  const text = (inp.text ?? "").trim();
  const preset = text ? pickPreset(st, inp.presetId, r) : null;
  const ink = st.ink;
  const onPhotoInk = "#ffffff";
  const results: ComposeResult[] = [];
  const push = (recipe: string, frames: Frame[], cost: number, bgPhoto?: BgPhoto) => {
    results.push({ recipe, frames, cost: cost + r() * 0.08, ...(bgPhoto ? { bgPhoto } : {}) });
  };
  const textFrame = (box: Rect, color: string, align: TextAlign = "center", shadow = false): TextFrame[] =>
    preset ? [buildText(preset, text, box, short, color, align, shadow)] : [];

  // Bề cao dải chữ theo đúng độ dài nội dung (ước lượng), kẹp trong 14–38% trang.
  const bandFor = (w: number) => {
    if (!preset) return 0;
    const need = estimateTextHeight(preset, text, w, short) + short * 0.06;
    return Math.min(f.h * (landscape ? 0.42 : 0.38), Math.max(short * 0.14, need));
  };

  // Phong cách nền ảnh mờ: các phương án có lề được thêm bản "ảnh chính làm nền".
  const bgFor = (frames: Frame[]): BgPhoto | undefined => {
    if (!st.bgPhoto) return undefined;
    const hero = heroPhoto(frames);
    return hero ? { photoId: hero, blur: st.bgPhoto.blur, dim: st.bgPhoto.dim } : undefined;
  };
  // Chữ trên nền ảnh mờ / nền tối đè trên ảnh: chữ trắng có bóng cho dễ đọc.
  const bandInk = st.bgPhoto ? onPhotoInk : ink;
  const bandShadow = !!st.bgPhoto;

  /* 1) Một ảnh tràn khung (không chữ) — hoặc chữ đè lên ảnh. */
  if (n === 1) {
    const cells = [{ rect: page, photoId: photos[0].id }];
    const base = scoreCells(cells, lp);
    if (!preset) {
      push("bleed", cellsToFrames(cells, byId), base - st.bleedBias * 0.8 + (1 - st.bleedBias) * 0.1);
    } else {
      const bandH = bandFor(f.w * 0.84);
      const atTop = r() < 0.3;
      const box: Rect = atTop
        ? { x: short * 0.08, y: safe.y + short * 0.06, w: f.w - short * 0.16, h: bandH }
        : { x: short * 0.08, y: safe.y + safe.h - bandH - short * 0.06, w: f.w - short * 0.16, h: bandH };
      push(atTop ? "overlay-top" : "overlay", [...cellsToFrames(cells, byId), ...textFrame(box, onPhotoInk, "center", true)], base + 0.02 - st.bleedBias * 0.3);
    }
  }

  /* 2) Lưới thích nghi có lề — có chữ thì chừa dải dưới / trên (ngang: cột cạnh). */
  {
    const area = inset(page, margin);
    if (!preset) {
      for (const c of adaptiveCandidates(lp, area, gap, { limit: 4, seed: inp.seed })) {
        const frames = cellsToFrames(c.cells, byId);
        push(`grid:${c.key}`, frames, c.cost + st.bleedBias * 0.3, bgFor(frames));
      }
    } else {
      const bandH = bandFor(area.w * 0.9);
      // Trang không lề (phong cách ghép sát / điện ảnh): chữ vẫn phải cách mép một chút.
      const edge = margin < short * 0.02 ? short * 0.035 : 0;
      // Dải chữ DƯỚI ảnh — đáy dải không lọt xuống vùng Story bị che.
      const bandEnd = Math.min(area.y + area.h, safe.y + safe.h) - edge;
      const textBottom: Rect = { x: area.x + area.w * 0.05, y: bandEnd - bandH, w: area.w * 0.9, h: bandH };
      const photosBottom: Rect = { x: area.x, y: area.y, w: area.w, h: Math.max(1, textBottom.y - gap - area.y) };
      for (const c of adaptiveCandidates(lp, photosBottom, gap, { limit: 3, seed: inp.seed })) {
        const photoFrames = cellsToFrames(c.cells, byId);
        push(`grid+tb:${c.key}`, [...photoFrames, ...textFrame(textBottom, bandInk, "center", bandShadow)], c.cost + st.bleedBias * 0.3 + 0.02, bgFor(photoFrames));
      }
      // Dải chữ TRÊN ảnh — đỉnh dải nằm dưới vùng Story bị che.
      const topY = Math.max(area.y, safe.y) + edge;
      const textTop: Rect = { x: area.x + area.w * 0.05, y: topY, w: area.w * 0.9, h: bandH };
      const photosTop: Rect = { x: area.x, y: topY + bandH + gap, w: area.w, h: Math.max(1, area.y + area.h - (topY + bandH + gap)) };
      for (const c of adaptiveCandidates(lp, photosTop, gap, { limit: 2, seed: (inp.seed ?? 1) + 3 })) {
        const photoFrames = cellsToFrames(c.cells, byId);
        push(`grid+tt:${c.key}`, [...textFrame(textTop, bandInk, "center", bandShadow), ...photoFrames], c.cost + st.bleedBias * 0.3 + 0.06, bgFor(photoFrames));
      }
      // Khổ ngang / vuông: cột chữ bên phải.
      if (f.w / f.h >= 0.99 && n <= 4) {
        const colW = area.w * (landscape ? 0.34 : 0.38);
        const photosLeft: Rect = { x: area.x, y: area.y, w: area.w - colW - gap, h: area.h };
        const textSide: Rect = { x: area.x + area.w - colW + gap * 0.5, y: area.y + area.h * 0.2, w: colW - gap * 0.5, h: area.h * 0.6 };
        for (const c of adaptiveCandidates(lp, photosLeft, gap, { limit: 2, seed: (inp.seed ?? 1) + 5 })) {
          const photoFrames = cellsToFrames(c.cells, byId);
          push(`grid+ts:${c.key}`, [...photoFrames, ...textFrame(textSide, bandInk, "left", bandShadow)], c.cost + st.bleedBias * 0.3 + 0.1, bgFor(photoFrames));
        }
      }
    }
  }

  /* 3) Ghép sát tràn khung (khe mảnh, không lề) — có chữ thì chữ đè lên khung lớn nhất. */
  if (n >= 2) {
    for (const c of adaptiveCandidates(lp, page, gap * 0.6, { limit: preset ? 2 : 3, seed: (inp.seed ?? 1) + 11 })) {
      const frames: Frame[] = cellsToFrames(c.cells, byId);
      let cost = c.cost - st.bleedBias * 0.6 + (1 - st.bleedBias) * 0.15;
      if (preset) {
        // Chữ nằm trong khung ảnh lớn nhất, phía dưới, chữ trắng có bóng.
        const big = c.cells.reduce((a, b) => (b.rect.w * b.rect.h > a.rect.w * a.rect.h ? b : a));
        const bandH = Math.min(big.rect.h * 0.45, bandFor(big.rect.w * 0.84));
        const yMax = Math.min(big.rect.y + big.rect.h, safe.y + safe.h);
        const box: Rect = { x: big.rect.x + big.rect.w * 0.08, y: yMax - bandH - short * 0.04, w: big.rect.w * 0.84, h: bandH };
        frames.push(...textFrame(box, onPhotoInk, "center", true));
        cost += 0.12 + (big.rect.w < f.w * 0.45 ? 0.3 : 0);
      }
      push(`tight:${c.key}`, frames, cost);
    }
  }

  /* 4) Bố cục biên tập nhiều khoảng trắng. */
  for (const t of EDITORIAL.filter((x) => x.slots.length === n)) {
    if (preset && !t.text) continue;
    if (!preset && t.text && !t.textOptional) continue;
    const toRect = (q: Quad): Rect => ({ x: q[0] * f.w, y: q[1] * f.h, w: q[2] * f.w, h: q[3] * f.h });
    const cells = assignToSlots(t.slots.map(toRect), photos);
    const frames: Frame[] = cellsToFrames(cells, byId);
    let overlapPenalty = 0;
    if (preset && t.text) {
      let box = toRect(t.text);
      // Story: kéo ô chữ vào vùng an toàn.
      if (box.y < safe.y) box = { ...box, y: safe.y };
      if (box.y + box.h > safe.y + safe.h) box = { ...box, y: Math.max(safe.y, safe.y + safe.h - box.h) };
      // Bị kéo đè lên ảnh thì phương án này kém hẳn đi (chữ màu nền đè lên ảnh khó đọc).
      if (cells.some((c) => overlapArea(c.rect, box) > 0.15 * box.w * box.h)) overlapPenalty = 0.45;
      // Ô chữ cố định nhỏ hơn nhiều so với nội dung (lời cảm ơn dài) → chữ phải co
      // nhỏ khó đọc: nhường cho phương án dải chữ tính theo đúng độ dài nội dung.
      const need = estimateTextHeight(preset, text, box.w, short);
      if (need > box.h * 1.2) overlapPenalty += 0.2 * Math.min(3, need / box.h);
      const align: TextAlign = box.x > f.w * 0.5 ? "left" : "center";
      frames.push(...textFrame(box, bandInk, align, bandShadow));
    }
    // Ô biên tập có tỉ lệ cố định: ảnh lệch chiều nhiều thì cắt nhiều → điểm kém đi.
    const cost = scoreCells(cells, lp) + 0.12 - st.editorialBias * 0.8 + st.bleedBias * 0.15 + (landscape && t.id.startsWith("e1-side") ? -0.05 : 0) + overlapPenalty;
    push(`edit:${t.id}`, frames, cost, bgFor(frames));
  }

  results.sort((a, b) => a.cost - b.cost);
  const seen = new Set<string>();
  return results.filter((x) => (seen.has(x.recipe) ? false : (seen.add(x.recipe), true)));
}

/** Nền tối hay sáng của trang (để chọn màu viền / chữ gợi ý). */
export function pageIsDark(background: string, bgPhoto?: BgPhoto): boolean {
  return bgPhoto ? true : isDarkColor(background);
}
