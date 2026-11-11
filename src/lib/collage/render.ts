/* ═══════════════════════════════════════════════════════════════════════════
   XUẤT ẢNH GHÉP — vẽ một trang ra canvas đúng kích thước mạng xã hội, dùng CÙNG
   phép đặt ảnh (crop.ts) và cách ngắt chữ (text-layout.ts) với màn sửa.

   Ảnh nguồn lấy qua /api/img?…&raw=1 (byte cùng miền) — canvas cần đọc được
   điểm ảnh, mà Drive không gửi header CORS. Chỉ lượt XUẤT mới tốn đường này;
   màn sửa hiển thị ảnh qua đường thường (302 sang CDN Google, 0 byte máy chủ).
   Bề rộng xin đúng mức cần (làm tròn lên các mốc cố định để CDN dùng lại).
   ═══════════════════════════════════════════════════════════════════════════ */
import type { CollageDoc, CollagePage, PhotoFrame, TextFrame } from "./types";
import { formatById } from "./formats";
import { placePhoto } from "./crop";
import { canvasFont, displayText, layoutText, lineWidth } from "./text-layout";

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

let blurProbe: boolean | undefined;
/** ctx.filter có làm mờ thật không (Safari cũ không có). */
function canvasBlurWorks(): boolean {
  if (blurProbe !== undefined) return blurProbe;
  blurProbe = false;
  try {
    const c = makeCanvas(16, 16);
    const x = c.getContext("2d", { willReadFrequently: true });
    if (x && typeof x.filter === "string") {
      x.filter = "blur(2px)";
      x.fillStyle = "#000";
      x.fillRect(6, 6, 4, 4);
      blurProbe = x.getImageData(3, 8, 1, 1).data[3] > 0;
    }
  } catch {
    blurProbe = false;
  }
  return blurProbe;
}

function hexToRgba(hex: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Ảnh nền mờ phủ cả trang. */
async function drawBgPhoto(ctx: CanvasRenderingContext2D, page: CollagePage, W: number, H: number, scale: number, getImage: ImageGetter) {
  const bg = page.bgPhoto;
  if (!bg) return;
  let img: HTMLImageElement;
  try {
    img = await getImage(bg.photoId, 800);
  } catch {
    return;
  }
  const radius = (Math.max(0, Math.min(60, bg.blur)) / 1000) * Math.min(W, H);
  const m = radius * 3;
  const p = placePhoto(W + 2 * m, H + 2 * m, img.naturalWidth, img.naturalHeight, { zoom: 1, cx: 0.5, cy: 0.5 });
  if (radius > 0 && canvasBlurWorks()) {
    ctx.save();
    ctx.filter = `blur(${radius}px)`;
    ctx.drawImage(img, -m + p.left, -m + p.top, p.width, p.height);
    ctx.restore();
  } else if (radius > 0) {
    // Không có ctx.filter: thu nhỏ thật mạnh rồi phóng lại (mịn như làm mờ).
    const k = Math.max(0.02, Math.min(0.25, 6 / Math.max(1, radius * scale)));
    const small = makeCanvas((W + 2 * m) * scale * k, (H + 2 * m) * scale * k);
    const sx = small.getContext("2d")!;
    sx.imageSmoothingQuality = "high";
    sx.drawImage(img, p.left * scale * k, p.top * scale * k, p.width * scale * k, p.height * scale * k);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(small, -m, -m, W + 2 * m, H + 2 * m);
  } else {
    ctx.drawImage(img, -m + p.left, -m + p.top, p.width, p.height);
  }
  if (bg.dim > 0) {
    ctx.fillStyle = hexToRgba(page.background, Math.min(1, bg.dim));
    ctx.fillRect(0, 0, W, H);
  }
}

async function drawPhoto(ctx: CanvasRenderingContext2D, f: PhotoFrame, aspect: number, scale: number, getImage: ImageGetter) {
  // Bề rộng ảnh nguồn cần: bề rộng ảnh SAU khi phóng trong khung, theo điểm ảnh xuất.
  const guess = placePhoto(f.rect.w, f.rect.h, aspect * 1000, 1000, f.crop);
  let img: HTMLImageElement;
  try {
    img = await getImage(f.photoId, sourceWidth(guess.width * scale));
  } catch {
    ctx.fillStyle = "rgba(127,127,127,.25)";
    ctx.fillRect(f.rect.x, f.rect.y, f.rect.w, f.rect.h);
    return;
  }
  const p = placePhoto(f.rect.w, f.rect.h, img.naturalWidth, img.naturalHeight, f.crop);
  ctx.save();
  ctx.beginPath();
  ctx.rect(f.rect.x, f.rect.y, f.rect.w, f.rect.h);
  ctx.clip();
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, f.rect.x + p.left, f.rect.y + p.top, p.width, p.height);
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
  ctx.font = canvasFont(st, lay.size);
  ctx.fillStyle = st.color;
  ctx.textBaseline = "middle";
  if (st.shadow) {
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = lay.size * 0.3;
    ctx.shadowOffsetY = lay.size * 0.04;
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
  for (const fr of page.frames) {
    if (fr.kind === "photo") await drawPhoto(ctx, fr, doc.aspects[fr.photoId] ?? 1.5, o.scale, o.getImage);
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
