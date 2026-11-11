/* ═══════════════════════════════════════════════════════════════════════════
   SLIDE CUỐI "XEM CẢ ALBUM" — trang kết thúc bộ ảnh ghép do studio bật (cài
   đặt ghép ảnh): ảnh bìa trong khung vòm, tên cô dâu chú rể, tên studio, mã
   QR về trang studio (hoặc album này). Khách xoá được như mọi layout khác.

   Mã QR là một hình trang trí "qr" (các ô vẽ bằng đường SVG) — không phải ảnh
   ngoài album, nên luật "chỉ dùng ảnh studio đã giao" vẫn giữ nguyên.
   ═══════════════════════════════════════════════════════════════════════════ */
import QRCode from "qrcode";
import type { CollagePage, LayoutInput, PhotoFrame, Rect } from "./types";
import { formatById, safeArea } from "./formats";
import type { CollageStyle } from "./styles";
import { isDarkColor } from "./styles";
import { buildText, presetById } from "./typography";
import { focusCrop } from "./crop";
import { photoArea } from "./frame-geom";
import { prettyUrl } from "./brand";
import { uid } from "./rng";
import type { LockCtx } from "./lockups";
import type { Ornament } from "./ornaments";

export const END_RECIPE = "end-card";
export const isEndPage = (p: Pick<CollagePage, "recipe">) => p.recipe === END_RECIPE;

const f1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Các ô tối của mã QR thành MỘT đường SVG trong ô vuông `size` (đã gồm viền
 * trắng 2 ô). Gộp các ô liền nhau trên một hàng thành một đoạn; mỗi đoạn cao
 * hơn một chút để hai hàng chạm nhau không lộ vệt mảnh khi khử răng cưa.
 */
export function qrPath(text: string, size: number): string {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const data = qr.modules.data;
  const q = 2;
  const cell = size / (n + 2 * q);
  let d = "";
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!data[y * n + x]) {
        x++;
        continue;
      }
      const x0 = x;
      while (x < n && data[y * n + x]) x++;
      const len = (x - x0) * cell;
      d += `M${f1((x0 + q) * cell)} ${f1((y + q) * cell)}h${f1(len)}v${f1(cell + 0.4)}h${f1(-len)}z`;
    }
  }
  return d;
}

export interface EndPageInput {
  formatId: string;
  style: CollageStyle;
  /** Ảnh bìa (ảnh chính của bộ). */
  cover: LayoutInput;
  url: string;
  studioName: string;
  ctx: LockCtx;
}

/** Dựng slide cuối cho khổ của bộ. */
export function makeEndPage(o: EndPageInput): CollagePage {
  const f = formatById(o.formatId);
  const W = f.w;
  const H = f.h;
  const safe = safeArea(f);
  const short = Math.min(W, H);
  const landscape = W / H > 1.15;
  const dark = isDarkColor(o.style.background) && !o.style.bgPhoto;
  const cardColor = dark ? "#1b1816" : "#ffffff";
  const ink = dark ? "#f2ece4" : "#2b2622";
  const m = short * 0.08;
  const card: Rect = { x: m, y: safe.y + m, w: W - 2 * m, h: safe.h - 2 * m };
  const qrSize = short * (landscape ? 0.3 : 0.27);
  let photoRect: Rect;
  let textBox: Rect;
  let qrRect: Rect;
  if (landscape) {
    photoRect = { x: card.x + card.w * 0.06, y: card.y + card.h * 0.1, w: card.w * 0.36, h: card.h * 0.8 };
    const right = photoRect.x + photoRect.w + card.w * 0.06;
    const rw = card.x + card.w - right - card.w * 0.05;
    textBox = { x: right, y: card.y + card.h * 0.08, w: rw, h: card.h * 0.44 };
    qrRect = { x: right + (rw - qrSize) / 2, y: card.y + card.h * 0.56, w: qrSize, h: qrSize };
  } else {
    const ph = card.h * 0.34;
    const pw = Math.min(card.w * 0.5, ph * 0.78);
    photoRect = { x: W / 2 - pw / 2, y: card.y + card.h * 0.06, w: pw, h: ph };
    textBox = { x: card.x + card.w * 0.08, y: photoRect.y + ph + card.h * 0.03, w: card.w * 0.84, h: card.h * 0.27 };
    qrRect = { x: W / 2 - qrSize / 2, y: Math.min(textBox.y + textBox.h + card.h * 0.02, card.y + card.h - qrSize - card.h * 0.04), w: qrSize, h: qrSize };
  }
  const photo: PhotoFrame = { kind: "photo", id: uid("f"), rect: photoRect, photoId: o.cover.id, crop: { zoom: 1, cx: 0.5, cy: 0.45 }, deco: { shape: "arch" } };
  const a = photoArea(photo);
  photo.crop = focusCrop(o.cover.faces, a.w / a.h, o.cover.aspect > 0 ? o.cover.aspect : 1.5);
  const main = (o.ctx.names ?? "").trim() || "Cảm ơn bạn đã xem";
  const text = {
    ...buildText(presetById("formal"), main, textBox, short, ink, "center"),
    lockup: { id: "end-card", kicker: o.studioName.slice(0, 60), sub: `Quét mã · ${prettyUrl(o.url)}`.slice(0, 80) },
  };
  const ornaments: Ornament[] = [
    { id: uid("o"), kind: "card", rect: card, color: cardColor, opacity: 0.94 },
    { id: uid("o"), kind: "qr", rect: qrRect, color: ink, d: qrPath(o.url, qrSize) },
  ];
  return {
    id: uid("p"),
    frames: [photo, text],
    background: o.style.background,
    bgPhoto: { photoId: o.cover.id, blur: 34, dim: dark ? 0.55 : 0.42 },
    ornaments,
    recipe: END_RECIPE,
    styleId: o.style.id,
  };
}
