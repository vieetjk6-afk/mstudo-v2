/* ═══════════════════════════════════════════════════════════════════════════
   XUẤT ẢNH GHÉP — vẽ một trang ra canvas đúng kích thước mạng xã hội, dùng CÙNG
   phép đặt ảnh (crop.ts) và cách ngắt chữ (text-layout.ts) với màn sửa.

   Ảnh nguồn lấy qua /api/img?…&raw=1 (byte cùng miền) — canvas cần đọc được
   điểm ảnh, mà Drive không gửi header CORS. Chỉ lượt XUẤT mới tốn đường này;
   màn sửa hiển thị ảnh qua đường thường (302 sang CDN Google, 0 byte máy chủ).
   Bề rộng xin đúng mức cần (làm tròn lên các mốc cố định để CDN dùng lại).
   ═══════════════════════════════════════════════════════════════════════════ */
import type { CollageDoc, CollagePage, FrameDeco, PhotoFrame, Rect, TextFrame } from "./types";
import { formatById } from "./formats";
import { placePhoto } from "./crop";
import { canvasFont, displayText, layoutText, lineWidth } from "./text-layout";
import { blurRGBA, workScale } from "./blur";
import { frameRotation, photoArea, shapeRadii } from "./frame-geom";

/** Mốc bề rộng ảnh nguồn (khớp cache CDN của /api/img). */
const WIDTHS = [480, 800, 1200, 1600, 2048, 2560];
export function sourceWidth(px: number): number {
  return WIDTHS.find((w) => w >= px) ?? WIDTHS[WIDTHS.length - 1];
}

export type ImageGetter = (photoId: string, width: number) => Promise<HTMLImageElement>;

export interface RenderOptions {
  /** Hệ số điểm ảnh (1 = 1080 px bề ngang; 2 = nét cao cho Facebook). */
  scale: number;
  getImage: ImageGetter;
  /** Chữ watermark của studio (album bật watermark giao khách) — đóng giống ảnh tải lẻ. */
  watermark?: string | null;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function hexToRgba(hex: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * Ảnh nền mờ phủ cả trang. Làm mờ BẰNG TAY trên điểm ảnh (blur.ts) chứ không
 * dùng ctx.filter: Safari trên iPhone bỏ qua bộ lọc canvas khi vẽ ảnh, ảnh tải
 * về ra nền nét dù màn sửa vẫn mờ (lỗi thật, 11/2026). Độ mờ khớp CSS
 * blur(radius) của màn sửa: radius là độ lệch chuẩn Gauss theo điểm ảnh trang.
 */
async function drawBgPhoto(ctx: CanvasRenderingContext2D, page: CollagePage, W: number, H: number, scale: number, getImage: ImageGetter) {
  const bg = page.bgPhoto;
  if (!bg) return;
  let img: HTMLImageElement;
  try {
    // Nền sẽ mờ hẳn — ảnh nhỏ là đủ, đỡ tải.
    img = await getImage(bg.photoId, 480);
  } catch {
    return;
  }
  const radius = (Math.max(0, Math.min(60, bg.blur)) / 1000) * Math.min(W, H);
  // Ảnh tràn ra ngoài trang một đoạn để mép trang không bị nhạt khi làm mờ.
  const m = radius * 3;
  const p = placePhoto(W + 2 * m, H + 2 * m, img.naturalWidth, img.naturalHeight, { zoom: 1, cx: 0.5, cy: 0.5 });
  if (radius <= 0.5) {
    ctx.drawImage(img, -m + p.left, -m + p.top, p.width, p.height);
  } else {
    // Làm mờ ở ảnh nhỏ (k điểm ảnh làm việc cho mỗi điểm ảnh trang) rồi phóng lại.
    const k = workScale(radius * scale) * scale;
    const ww = Math.max(2, Math.round((W + 2 * m) * k));
    const wh = Math.max(2, Math.round((H + 2 * m) * k));
    const work = makeCanvas(ww, wh);
    const wx = work.getContext("2d", { willReadFrequently: true });
    if (!wx) return;
    wx.imageSmoothingQuality = "high";
    wx.drawImage(img, p.left * k, p.top * k, p.width * k, p.height * k);
    try {
      const data = wx.getImageData(0, 0, ww, wh);
      blurRGBA(data.data, ww, wh, radius * k);
      wx.putImageData(data, 0, 0);
    } catch {
      /* canvas bị khoá (ảnh khác miền): còn lại độ mờ do thu nhỏ — vẫn hơn nền nét */
    }
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(work, -m, -m, W + 2 * m, H + 2 * m);
    ctx.restore();
  }
  if (bg.dim > 0) {
    ctx.fillStyle = hexToRgba(page.background, Math.min(1, bg.dim));
    ctx.fillRect(0, 0, W, H);
  }
}

/** Đường viền hình của hộp (chữ nhật, bo góc, vòm, bầu dục). */
function shapePath(ctx: CanvasRenderingContext2D, r: Rect, shape: FrameDeco["shape"]) {
  ctx.beginPath();
  if (shape === "oval") {
    ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
    return;
  }
  const [tl, tr, br, bl] = shapeRadii(shape, r.w, r.h);
  if (!tl && !tr && !br && !bl) {
    ctx.rect(r.x, r.y, r.w, r.h);
    return;
  }
  ctx.moveTo(r.x + tl, r.y);
  ctx.lineTo(r.x + r.w - tr, r.y);
  if (tr) ctx.arc(r.x + r.w - tr, r.y + tr, tr, -Math.PI / 2, 0);
  ctx.lineTo(r.x + r.w, r.y + r.h - br);
  if (br) ctx.arc(r.x + r.w - br, r.y + r.h - br, br, 0, Math.PI / 2);
  ctx.lineTo(r.x + bl, r.y + r.h);
  if (bl) ctx.arc(r.x + bl, r.y + r.h - bl, bl, Math.PI / 2, Math.PI);
  ctx.lineTo(r.x, r.y + tl);
  if (tl) ctx.arc(r.x + tl, r.y + tl, tl, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

async function drawPhoto(ctx: CanvasRenderingContext2D, f: PhotoFrame, aspect: number, scale: number, short: number, getImage: ImageGetter) {
  const area = photoArea(f);
  const d = f.deco;
  // Bề rộng ảnh nguồn cần: bề rộng ảnh SAU khi phóng trong khung, theo điểm ảnh xuất.
  const guess = placePhoto(area.w, area.h, aspect * 1000, 1000, f.crop);
  let img: HTMLImageElement | null = null;
  try {
    img = await getImage(f.photoId, sourceWidth(guess.width * scale));
  } catch {
    img = null;
  }
  ctx.save();
  const rot = frameRotation(d);
  if (rot) {
    const cx = f.rect.x + f.rect.w / 2;
    const cy = f.rect.y + f.rect.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }
  const padded = !!d && ((d.pad ?? 0) > 0 || (d.padBottom ?? 0) > 0);
  // Viền + bóng: tô hộp ngoài (theo hình) một lần, bóng đổ theo đúng hình đó.
  if (padded || d?.shadow) {
    ctx.save();
    if (d?.shadow) {
      ctx.shadowColor = "rgba(0,0,0,.3)";
      ctx.shadowBlur = short * 0.03 * scale;
      ctx.shadowOffsetY = short * 0.01 * scale;
    }
    ctx.fillStyle = padded ? (d?.padColor ?? "#ffffff") : "#808080";
    shapePath(ctx, f.rect, d?.shape);
    ctx.fill();
    ctx.restore();
  }
  shapePath(ctx, area, d?.shape);
  ctx.clip();
  if (img) {
    const p = placePhoto(area.w, area.h, img.naturalWidth, img.naturalHeight, f.crop);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, area.x + p.left, area.y + p.top, p.width, p.height);
  } else {
    ctx.fillStyle = "rgba(127,127,127,.25)";
    ctx.fillRect(area.x, area.y, area.w, area.h);
  }
  ctx.restore();
}

/** Vẽ một dòng có giãn chữ — canvas.letterSpacing chưa có ở mọi trình duyệt nên tự rải từng ký tự. */
function fillSpaced(ctx: CanvasRenderingContext2D, line: string, x: number, y: number, size: number, spacingEm: number, align: CanvasTextAlign) {
  if (!spacingEm) {
    ctx.textAlign = align;
    ctx.fillText(line, x, y);
    return;
  }
  const w = lineWidth(ctx, line, size, spacingEm);
  let cx = align === "left" ? x : align === "right" ? x - w : x - w / 2;
  ctx.textAlign = "left";
  for (const ch of Array.from(line)) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacingEm * size;
  }
}

function drawText(ctx: CanvasRenderingContext2D, t: TextFrame, fontsReady: number) {
  if (!displayText(t).trim()) return;
  const lay = layoutText(t, fontsReady);
  const st = t.style;
  ctx.save();
  const rot = frameRotation(t);
  if (rot) {
    const cx = t.rect.x + t.rect.w / 2;
    const cy = t.rect.y + t.rect.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }
  ctx.font = canvasFont(st, lay.size);
  ctx.fillStyle = st.color;
  ctx.textBaseline = "middle";
  if (st.shadow) {
    // shadowBlur / shadowOffset không theo phép co giãn của canvas — tự nhân hệ số.
    const m = ctx.getTransform();
    const k = Math.hypot(m.a, m.b) || 1;
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = lay.size * 0.3 * k;
    ctx.shadowOffsetY = lay.size * 0.04 * k;
  }
  const total = lay.lines.length * lay.lineH;
  const top = t.rect.y + (t.rect.h - total) / 2;
  const x = st.align === "left" ? t.rect.x : st.align === "right" ? t.rect.x + t.rect.w : t.rect.x + t.rect.w / 2;
  lay.lines.forEach((line, i) => fillSpaced(ctx, line, x, top + (i + 0.5) * lay.lineH, lay.size, st.letterSpacing, st.align));
  ctx.restore();
}

/** Watermark chéo lặp lại — cùng kiểu với ảnh khách tải lẻ (lib/download.ts). */
function drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number, text: string) {
  const size = Math.max(18, Math.round(W / 28));
  ctx.save();
  ctx.font = `600 ${size}px sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(W / 2, H / 2);
  ctx.rotate((-30 * Math.PI) / 180);
  ctx.translate(-W / 2, -H / 2);
  for (let y = -H; y < H * 2; y += size * 6) for (let x = -W; x < W * 2; x += size * 12) ctx.fillText(text, x, y);
  ctx.restore();
}

/** Vẽ một trang ra canvas. */
export async function renderPage(doc: CollageDoc, page: CollagePage, o: RenderOptions, fontsReady = 0): Promise<HTMLCanvasElement> {
  const f = formatById(doc.formatId);
  const W = f.w;
  const H = f.h;
  const canvas = makeCanvas(W * o.scale, H * o.scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(o.scale, o.scale);
  ctx.fillStyle = page.background;
  ctx.fillRect(0, 0, W, H);
  await drawBgPhoto(ctx, page, W, H, o.scale, o.getImage);
  const short = Math.min(W, H);
  for (const fr of page.frames) {
    if (fr.kind === "photo") await drawPhoto(ctx, fr, doc.aspects[fr.photoId] ?? 1.5, o.scale, short, o.getImage);
  }
  for (const fr of page.frames) if (fr.kind === "text") drawText(ctx, fr, fontsReady);
  if (o.watermark) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawWatermark(ctx, canvas.width, canvas.height, o.watermark);
  }
  return canvas;
}

export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", quality));
}

/** Tải ảnh cùng miền để vẽ canvas (crossOrigin để canvas không bị "tainted"). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`img ${src}`));
    img.src = src;
  });
}
