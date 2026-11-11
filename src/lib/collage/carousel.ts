/* ═══════════════════════════════════════════════════════════════════════════
   CAROUSEL LIỀN MẠCH — một dải ảnh dài gấp `slides` lần khổ, xuất ra `slides`
   ảnh nối nhau: đăng nhiều ảnh trên Instagram / Facebook, vuốt sang là ảnh
   chạy tiếp qua slide sau. Khung ảnh CỐ Ý vắt qua ranh giới slide; máy tránh
   để đường cắt đi qua khuôn mặt (dùng khung mặt máy chủ đã quét).

   Bốn kiểu: dòng chảy (lưới thích nghi trải cả dải), ảnh in treo trên dây,
   ảnh lớn vắt slide 1–2 + ảnh nhỏ, hàng vòm. Có nội dung chữ thì chữ nằm ở
   slide đầu (bìa). Thuần, không đụng DOM.
   ═══════════════════════════════════════════════════════════════════════════ */
import type { BgPhoto, Frame, FrameDeco, LayoutInput, PhotoFrame, Rect, TextAlign, TextFrame } from "./types";
import type { CollageFormat } from "./formats";
import { safeArea } from "./formats";
import type { CollageStyle } from "./styles";
import { adaptiveCandidates, type Cell, type LayoutPhoto } from "./adaptive";
import { buildText, estimateTextHeight, sizeFor } from "./typography";
import { lockupExtraHeight, lockupPreset } from "./lockups";
import { paletteStyle } from "./palette";
import { DEFAULT_CROP, focusCrop, placePhoto } from "./crop";
import { photoArea } from "./frame-geom";
import { pickPreset, heroPhoto, type ComposeResult } from "./compose";
import { decorateGrid, floraFor, paperFor } from "./decor";
import type { Ornament } from "./ornaments";
import { rng, uid } from "./rng";

export interface PanoramaInput {
  photos: LayoutInput[];
  format: CollageFormat;
  style: CollageStyle;
  /** Số slide (2–10). */
  slides: number;
  text?: string | null;
  presetId?: string;
  lockup?: TextFrame["lockup"] | null;
  seed?: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Ảnh tối đa một carousel: 3 ảnh mỗi slide. */
export const panoramaMax = (slides: number) => Math.max(2, Math.round(slides)) * 3;

function mk(p: LayoutInput, rect: Rect, deco?: FrameDeco): PhotoFrame {
  const fr: PhotoFrame = { kind: "photo", id: uid("f"), rect, photoId: p.id, crop: { ...DEFAULT_CROP }, ...(deco ? { deco } : {}) };
  const a = photoArea(fr);
  fr.crop = focusCrop(p.faces, a.w / a.h, p.aspect > 0 ? p.aspect : 1.5);
  return fr;
}

/**
 * Phạt khung ảnh bị đường cắt slide chạy qua: cắt qua khuôn mặt là nặng (mặt bị
 * xẻ đôi giữa hai ảnh), cắt qua giữa ảnh không có mặt là nhẹ.
 */
export function cutPenalty(frames: Frame[], byId: Map<string, LayoutInput>, W: number, slides: number): number {
  let pen = 0;
  for (const fr of frames) {
    if (fr.kind !== "photo") continue;
    const a = photoArea(fr);
    const p = byId.get(fr.photoId);
    const pl = placePhoto(a.w, a.h, (p?.aspect ?? 1.5) * 1000, 1000, fr.crop);
    for (let k = 1; k < slides; k++) {
      const x = k * W;
      if (x <= a.x + 2 || x >= a.x + a.w - 2) continue;
      // Cắt sát mép ảnh (≤ 18%) là đẹp — phần lẻ sang slide bên cạnh như ảnh "tràn".
      const rel = (x - a.x) / a.w;
      if (rel > 0.18 && rel < 0.82) pen += 0.08;
      for (const b of p?.faces ?? []) {
        if (b.length !== 4) continue;
        const fx0 = a.x + pl.left + b[0] * pl.width;
        const fx1 = fx0 + b[2] * pl.width;
        if (x > fx0 - 4 && x < fx1 + 4) pen += 0.6;
      }
    }
  }
  return pen;
}

const ranked = (photos: LayoutInput[]) => [...photos].sort((a, b) => b.score + (b.hero ? 2 : 0) - (a.score + (a.hero ? 2 : 0)));

/** Các phương án carousel cho đúng các ảnh (đã giới hạn 3 ảnh mỗi slide). */
export function composePanorama(inp: PanoramaInput): ComposeResult[] {
  const f = inp.format;
  const S = clamp(Math.round(inp.slides), 2, 10);
  const W = f.w;
  const PW = W * S;
  const safe = safeArea(f);
  const short = Math.min(W, f.h);
  const photos = inp.photos.slice(0, panoramaMax(S));
  const n = photos.length;
  if (!n) return [];
  const byId = new Map(photos.map((p) => [p.id, p]));
  const r = rng((inp.seed ?? 1) * 7349 + n * 17 + S);
  // "Màu theo ảnh": nền / chữ từ ảnh chính.
  let st = inp.style;
  let pageBg: string | undefined;
  if (st.fromPhoto) {
    const pal = ranked(photos).find((p) => p.palette?.length)?.palette;
    const c = pal ? paletteStyle(pal) : null;
    if (c) {
      st = { ...st, background: c.bg, ink: c.ink };
      pageBg = c.bg;
    }
  }
  const text = (inp.text ?? "").trim();
  const lock = inp.lockup && inp.lockup.id !== "plain" ? inp.lockup : null;
  const preset = text ? pickPreset(st, inp.presetId ?? lockupPreset(lock?.id), r) : null;
  const ink = st.bgPhoto ? "#ffffff" : st.ink;
  const inkShadow = !!st.bgPhoto;
  const textFrame = (box: Rect, align: TextAlign = "center"): TextFrame[] =>
    preset ? [{ ...buildText(preset, text, box, short, ink, align, inkShadow), ...(lock ? { lockup: { ...lock } } : {}) }] : [];
  const textNeed = (w: number) => (preset ? estimateTextHeight(preset, text, w, short) + lockupExtraHeight(lock ?? undefined, sizeFor(preset, text, short)) : 0);
  const m = Math.max(st.margin, 0.05) * short;
  const gap = Math.max(st.gap * short, 4);
  const paper = paperFor(st);
  const fl = floraFor(st);
  // Bìa: chữ chiếm phần trái slide 1, ảnh bắt đầu từ ~3/4 slide 1 (vắt sang slide 2).
  const cover = !!preset;
  const coverBox: Rect = { x: m + W * 0.03, y: safe.y + m, w: W * 0.62 - m, h: safe.h - 2 * m };
  const startX = cover ? W * 0.74 : m;
  const area: Rect = { x: startX, y: safe.y + m, w: PW - startX - m, h: safe.h - 2 * m };
  const results: ComposeResult[] = [];
  const bgFor = (frames: Frame[]): BgPhoto | undefined => {
    if (!st.bgPhoto) return undefined;
    const hero = heroPhoto(frames);
    return hero ? { photoId: hero, blur: st.bgPhoto.blur, dim: st.bgPhoto.dim } : undefined;
  };
  const push = (recipe: string, frames: Frame[], cost: number, ornaments?: Ornament[]) => {
    const photosOnly = frames.filter((x): x is PhotoFrame => x.kind === "photo");
    const bg = bgFor(photosOnly);
    results.push({
      recipe,
      frames,
      cost: cost + cutPenalty(photosOnly, byId, W, S) + r() * 0.08,
      ...(bg ? { bgPhoto: bg } : {}),
      ...(pageBg ? { background: pageBg } : {}),
      ...(ornaments?.length ? { ornaments } : {}),
    });
  };
  // Chữ bìa: căn giữa theo chiều dọc vùng bìa, vừa đủ cao.
  const coverText = () => {
    if (!cover) return [];
    const h = clamp(textNeed(coverBox.w) + short * 0.06, short * 0.16, coverBox.h);
    return textFrame({ x: coverBox.x, y: coverBox.y + (coverBox.h - h) / 2, w: coverBox.w, h }, "left");
  };

  /* 1) Dòng chảy: lưới thích nghi trải cả dải (cột ảnh nối nhau qua các slide). */
  {
    const lp: LayoutPhoto[] = photos.map((p) => ({ id: p.id, aspect: p.aspect > 0 ? p.aspect : 1.5, score: p.score + (p.hero ? 2 : 0) }));
    const cands = adaptiveCandidates(lp, area, gap, { limit: 30, seed: inp.seed })
      .map((c) => {
        const frames = c.cells.map((cell: Cell) => mk(byId.get(cell.photoId)!, cell.rect));
        return { c, frames, cost: c.cost + cutPenalty(frames, byId, W, S) };
      })
      .sort((a, b) => a.cost - b.cost)
      .slice(0, 3);
    cands.forEach(({ c, frames }, i) => {
      push(`pano-flow:${c.key}`, [...frames, ...coverText()], c.cost + 0.05 * i);
      if (i === 0 && (st.decoBias ?? 0.4) > 0) {
        const kind = st.bgPhoto || (st.decoBias ?? 0) >= 0.6 ? "print" : "round";
        push(`pano-flow-${kind}:${c.key}`, [...decorateGrid(frames, kind, short, paper, byId), ...coverText()], c.cost + 0.04);
      }
    });
  }

  /* 2) Ảnh in treo trên dây: so le cao thấp, xoay nhẹ, kẹp băng dính. */
  {
    const pad = short * 0.022;
    const pb = pad * 2.6;
    const slot = area.w / n;
    const ph = area.h * (n <= S ? 0.7 : n <= 2 * S ? 0.58 : 0.48);
    const frames: PhotoFrame[] = [];
    const ornaments: Ornament[] = [];
    const tops: { x: number; y: number }[] = [];
    photos.forEach((p, i) => {
      const a = clamp(p.aspect > 0 ? p.aspect : 1.5, 0.7, 1.45);
      const ih = ph - pad - pb;
      let w = ih * a + 2 * pad;
      let h = ph;
      if (w > slot * 1.18) {
        w = slot * 1.18;
        h = (w - 2 * pad) / a + pad + pb;
      }
      const cx = area.x + slot * (i + 0.5);
      const cy = area.y + area.h * (i % 2 ? 0.58 : 0.44) + (r() - 0.5) * area.h * 0.06;
      const y = clamp(cy - h / 2, area.y, area.y + area.h - h);
      const rot = Math.round(((r() < 0.5 ? -1 : 1) * (1.5 + r() * 4)) * 10) / 10;
      frames.push(mk(p, { x: cx - w / 2, y, w, h }, { pad, padBottom: pb, padColor: paper, rotate: rot, shadow: true }));
      tops.push({ x: cx, y: y + pad * 0.4 });
      const tw = Math.min(w * 0.38, short * 0.16);
      const th = tw * 0.32;
      ornaments.push({ id: uid("o"), kind: "tape", rect: { x: cx - tw / 2, y: y - th * 0.45, w: tw, h: th }, color: fl.tape, rotate: rot + (r() - 0.5) * 10, opacity: 0.88, over: true });
    });
    // Dây treo: đường cong mềm đi qua đỉnh từng ảnh, chạy suốt dải.
    const pts = [{ x: 0, y: tops[0].y - area.h * 0.04 }, ...tops, { x: PW, y: tops[tops.length - 1].y - area.h * 0.04 }];
    const minY = Math.min(...pts.map((q) => q.y)) - short * 0.05;
    const maxY = Math.max(...pts.map((q) => q.y)) + short * 0.05;
    let d = `M${pts[0].x.toFixed(1)} ${(pts[0].y - minY).toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const sag = Math.min(short * 0.05, (b.x - a.x) * 0.12);
      d += `Q${((a.x + b.x) / 2).toFixed(1)} ${(Math.max(a.y, b.y) - minY + sag).toFixed(1)} ${b.x.toFixed(1)} ${(b.y - minY).toFixed(1)}`;
    }
    const line: Ornament = { id: uid("o"), kind: "path", rect: { x: 0, y: minY, w: PW, h: maxY - minY }, color: st.bgPhoto ? "#f4efe6" : st.ink, d, width: Math.max(1.5, short * 0.0035), opacity: 0.7 };
    push("pano-prints", [...frames, ...coverText()], 0.08 - (st.decoBias ?? 0.4) * 0.5, [line, ...ornaments]);
  }

  /* 3) Ảnh lớn vắt slide 1–2 + ảnh nhỏ có viền chạy tiếp các slide sau. */
  if (n >= 2) {
    const [hero, ...rest] = ranked(photos);
    const hh = area.h;
    const hw = clamp(hero.aspect > 0 ? hero.aspect : 1.5, 0.66, 1.4) * hh;
    // Có bìa: ảnh lớn bắt đầu ngay sau chữ; không bìa: giữa ảnh lớn rơi đúng nửa sau slide 1.
    const hx = cover ? startX : Math.max(m, W - hw * 0.62);
    const frames: Frame[] = [mk(hero, { x: hx, y: area.y, w: hw, h: hh }, st.margin > 0.05 ? { shape: "round" } : undefined)];
    const from = hx + hw + gap * 2;
    const span = PW - m - from;
    const pad = short * 0.018;
    if (rest.length && span > short * 0.3) {
      const slot = span / rest.length;
      rest.forEach((p, i) => {
        const a = clamp(p.aspect > 0 ? p.aspect : 1.5, 0.7, 1.45);
        const maxH = area.h * 0.6;
        let w = Math.min(slot * 1.05, (maxH - 2 * pad) * a + 2 * pad);
        const h = (w - 2 * pad) / a + 2 * pad;
        w = Math.max(1, w);
        const cx = from + slot * (i + 0.5);
        const y = i % 2 ? area.y + area.h - h : area.y;
        frames.push(mk(p, { x: cx - w / 2, y, w, h }, { pad, padColor: paper, shadow: true }));
      });
      push("pano-hero", [...frames, ...coverText()], 0.06);
    }
  }

  /* 4) Hàng vòm trải dọc dải. */
  if (n <= 2 * S) {
    const g = gap * 2;
    const w = Math.min((area.w - g * (n - 1)) / n, area.h * 0.62);
    const h = Math.min(w / 0.62, area.h);
    const total = n * w + (n - 1) * g;
    const x0 = area.x + (area.w - total) / 2;
    const y0 = area.y + (area.h - h) / 2;
    const frames: Frame[] = photos.map((p, i) => mk(p, { x: x0 + i * (w + g), y: y0, w, h }, { shape: "arch" }));
    push("pano-arches", [...frames, ...coverText()], 0.1 - (st.decoBias ?? 0.4) * 0.3);
  }

  results.sort((a, b) => a.cost - b.cost);
  return results;
}
