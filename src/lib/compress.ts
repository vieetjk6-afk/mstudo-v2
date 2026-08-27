"use client";

/**
 * Client-side image compression + watermarking. Everything runs in the browser
 * on a <canvas>; originals never leave the machine (local files) and Drive
 * images are fetched through our own /api/img proxy (same-origin, so the canvas
 * is never tainted and can be exported).
 */

export type OutputFormat = "image/jpeg" | "image/webp" | "image/png";

export type WmPosition =
  | "tile"
  | "center"
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left"
  | "bottom-center";

export interface WatermarkOptions {
  type: "text" | "image";
  position: WmPosition;
  opacity: number; // 0..1
  // text
  text?: string;
  color?: "white" | "black";
  textScale?: number; // font size as a fraction of the image width (e.g. 0.04)
  // image
  image?: HTMLImageElement | null;
  imageScale?: number; // watermark width as a fraction of the image width (e.g. 0.22)
}

/** Cách đưa ảnh vào một khung kích thước cố định (khổ chuẩn mạng xã hội). */
export type FitMode =
  | "contain" // co ảnh vừa trong khung, giữ nguyên tỉ lệ, KHÔNG cắt (ảnh ra có thể nhỏ hơn khung)
  | "cover" // cắt giữa cho đúng tỉ lệ khung, ảnh ra đúng bằng khung
  | "pad"; // co vừa khung rồi thêm viền cho đủ đúng kích thước khung

export interface FrameOptions {
  width: number;
  height: number;
  fit: FitMode;
  /** Màu viền khi fit = "pad". */
  padColor?: string;
}

export interface CompressOptions {
  quality: number; // 0..1 (JPEG / WebP)
  maxDim: number; // longest side cap in px; 0 = keep original size
  format: OutputFormat;
  watermark?: WatermarkOptions | null;
  /** Khung đích cố định (khổ chuẩn MXH). Có frame thì bỏ qua maxDim. */
  frame?: FrameOptions | null;
  /** Cho phép phóng to ảnh nhỏ hơn khung. Mặc định KHÔNG (phóng to là mờ). */
  allowUpscale?: boolean;
  /** Làm nét sau khi thu nhỏ, 0..1 (0 = tắt). Chỉ áp dụng khi ảnh bị thu nhỏ. */
  sharpen?: number;
  /** Trần dung lượng (byte) — tự hạ chất lượng cho vừa. 0 = không đặt trần. */
  maxBytes?: number;
}

export interface CompressResult {
  blob: Blob;
  width: number;
  height: number;
  /** Chất lượng thực tế đã dùng sau khi dò cho vừa trần dung lượng. */
  quality: number;
  /** Vẫn vượt trần dung lượng dù đã hạ chất lượng hết mức cho phép. */
  overBudget: boolean;
  /** Ảnh gốc nhỏ hơn khung nên đã phải phóng to (sẽ mềm nét). */
  upscaled: boolean;
}

export interface DrawPlan {
  /** Kích thước canvas xuất ra. */
  canvas: { w: number; h: number };
  /** Vùng lấy từ ảnh gốc (cắt giữa khi fit = "cover"). */
  src: { x: number; y: number; w: number; h: number };
  /** Vùng vẽ trên canvas. */
  dest: { x: number; y: number; w: number; h: number };
  /** Có viền quanh ảnh (fit = "pad"). */
  padded: boolean;
}

/** Load an <img> from a URL (or object URL). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_load_failed"));
    img.src = src;
  });
}

/** Load an <img> from a File / Blob (revokes the object URL afterwards). */
export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return loadImage(url).finally(() => URL.revokeObjectURL(url)) as Promise<HTMLImageElement>;
}

function paddingFor(w: number, h: number): number {
  return Math.round(Math.min(w, h) * 0.03);
}

/** Draw the watermark onto an already-rendered canvas context. */
function drawWatermark(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  wm: WatermarkOptions
) {
  ctx.save();
  ctx.globalAlpha = wm.opacity;

  if (wm.type === "text") {
    const text = (wm.text ?? "").trim();
    if (!text) {
      ctx.restore();
      return;
    }
    const fontSize = Math.max(14, Math.round(cw * (wm.textScale ?? 0.04)));
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.fillStyle = wm.color === "black" ? "rgba(0,0,0,1)" : "rgba(255,255,255,1)";
    // Soft shadow so light text stays readable on bright photos.
    ctx.shadowColor = wm.color === "black" ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.45)";
    ctx.shadowBlur = Math.max(2, Math.round(fontSize * 0.12));

    if (wm.position === "tile") {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const stepX = fontSize * 12;
      const stepY = fontSize * 6;
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate((-30 * Math.PI) / 180);
      ctx.translate(-cw / 2, -ch / 2);
      for (let y = -ch; y < ch * 2; y += stepY) {
        for (let x = -cw; x < cw * 2; x += stepX) {
          ctx.fillText(text, x, y);
        }
      }
    } else {
      const pad = paddingFor(cw, ch);
      const { x, align } = horizontal(wm.position, cw, pad);
      const { y, baseline } = vertical(wm.position, ch, pad);
      ctx.textAlign = align;
      ctx.textBaseline = baseline;
      ctx.fillText(text, x, y);
    }
  } else if (wm.type === "image" && wm.image) {
    const img = wm.image;
    const targetW = cw * (wm.imageScale ?? 0.22);
    const ratio = img.naturalHeight / img.naturalWidth || 1;
    const w = targetW;
    const h = targetW * ratio;
    const pad = paddingFor(cw, ch);

    let x = pad;
    let y = pad;
    if (wm.position === "center") {
      x = (cw - w) / 2;
      y = (ch - h) / 2;
    } else {
      if (wm.position.includes("right")) x = cw - w - pad;
      if (wm.position.startsWith("bottom")) y = ch - h - pad;
      if (wm.position === "bottom-center") x = (cw - w) / 2;
    }
    if (wm.position === "tile") {
      // Tile the logo across the image.
      const stepX = w * 1.8;
      const stepY = h * 2.4;
      for (let yy = 0; yy < ch; yy += stepY) {
        for (let xx = 0; xx < cw; xx += stepX) {
          ctx.drawImage(img, xx, yy, w, h);
        }
      }
    } else {
      ctx.drawImage(img, x, y, w, h);
    }
  }

  ctx.restore();
}

function horizontal(pos: WmPosition, cw: number, pad: number): { x: number; align: CanvasTextAlign } {
  if (pos === "center" || pos === "bottom-center") return { x: cw / 2, align: "center" };
  if (pos.includes("right")) return { x: cw - pad, align: "right" };
  return { x: pad, align: "left" };
}

function vertical(pos: WmPosition, ch: number, pad: number): { y: number; baseline: CanvasTextBaseline } {
  if (pos === "center") return { y: ch / 2, baseline: "middle" };
  if (pos.startsWith("top")) return { y: pad, baseline: "top" };
  return { y: ch - pad, baseline: "bottom" };
}

/**
 * Tính trước kích thước xuất ra khi CHỈ giới hạn cạnh dài (chế độ nén thường).
 */
export function planMaxDim(ow: number, oh: number, maxDim: number): DrawPlan {
  let w = ow;
  let h = oh;
  if (maxDim > 0) {
    const longest = Math.max(ow, oh);
    if (longest > maxDim) {
      const k = maxDim / longest;
      w = Math.max(1, Math.round(ow * k));
      h = Math.max(1, Math.round(oh * k));
    }
  }
  return {
    canvas: { w, h },
    src: { x: 0, y: 0, w: ow, h: oh },
    dest: { x: 0, y: 0, w, h },
    padded: false,
  };
}

/**
 * Tính trước kích thước xuất ra khi ép vào một KHUNG cố định.
 *
 * Hàm này thuần tính toán (không cần DOM) nên giao diện gọi được để báo trước
 * "ảnh gốc nhỏ hơn khung" hay "sẽ cắt mất bao nhiêu" trước khi bấm xử lý.
 */
export function planFrame(
  ow: number,
  oh: number,
  frame: FrameOptions,
  allowUpscale = false
): DrawPlan {
  const fw = Math.max(1, Math.round(frame.width));
  const fh = Math.max(1, Math.round(frame.height));

  if (frame.fit === "cover") {
    // Cắt giữa ảnh gốc theo tỉ lệ khung…
    const ratio = fw / fh;
    let sw = ow;
    let sh = oh;
    if (ow / oh > ratio) sw = Math.max(1, Math.round(oh * ratio));
    else sh = Math.max(1, Math.round(ow / ratio));
    const sx = Math.round((ow - sw) / 2);
    const sy = Math.round((oh - sh) / 2);

    // …rồi xuất đúng bằng khung. Nếu ảnh gốc không đủ pixel, GIỮ NGUYÊN TỈ LỆ
    // khung nhưng thu nhỏ khung lại thay vì phóng to ảnh (phóng to = mờ).
    let cw = fw;
    let ch = fh;
    if (!allowUpscale && sw < fw) {
      cw = sw;
      ch = Math.max(1, Math.round(sw / ratio));
    }
    return {
      canvas: { w: cw, h: ch },
      src: { x: sx, y: sy, w: sw, h: sh },
      dest: { x: 0, y: 0, w: cw, h: ch },
      padded: false,
    };
  }

  // contain / pad: co toàn bộ ảnh vừa trong khung, giữ nguyên tỉ lệ gốc.
  let k = Math.min(fw / ow, fh / oh);
  if (!allowUpscale && k > 1) k = 1;
  const iw = Math.max(1, Math.round(ow * k));
  const ih = Math.max(1, Math.round(oh * k));

  if (frame.fit === "pad") {
    return {
      canvas: { w: fw, h: fh },
      src: { x: 0, y: 0, w: ow, h: oh },
      dest: { x: Math.round((fw - iw) / 2), y: Math.round((fh - ih) / 2), w: iw, h: ih },
      padded: iw < fw || ih < fh,
    };
  }
  return {
    canvas: { w: iw, h: ih },
    src: { x: 0, y: 0, w: ow, h: oh },
    dest: { x: 0, y: 0, w: iw, h: ih },
    padded: false,
  };
}

/**
 * Vẽ ảnh theo kế hoạch, thu nhỏ NHIỀU BƯỚC (mỗi bước một nửa) khi phải giảm
 * hơn 2 lần. Thu nhỏ một nhát từ 6000px xuống 1080px làm ảnh răng cưa, rỗ ở
 * viền tóc và chữ — đây chính là kiểu "vỡ ảnh" hay thấy sau khi đăng.
 */
function drawStepDown(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  plan: DrawPlan
) {
  let cur: CanvasImageSource = img;
  let { x: cx, y: cy, w: cw, h: ch } = plan.src;

  while (cw >= plan.dest.w * 2 && ch >= plan.dest.h * 2 && cw > 2 && ch > 2) {
    const nw = Math.max(1, Math.round(cw / 2));
    const nh = Math.max(1, Math.round(ch / 2));
    const step = document.createElement("canvas");
    step.width = nw;
    step.height = nh;
    const sctx = step.getContext("2d")!;
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(cur, cx, cy, cw, ch, 0, 0, nw, nh);
    cur = step;
    cx = 0;
    cy = 0;
    cw = nw;
    ch = nh;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cur, cx, cy, cw, ch, plan.dest.x, plan.dest.y, plan.dest.w, plan.dest.h);
}

/**
 * Làm nét (unsharp mask nhẹ): lấy lại độ nét đã mất khi thu nhỏ, bù luôn phần
 * mềm nét do mạng xã hội nén lại. `amount` 0..1 — trên 0.6 là bắt đầu thấy viền.
 */
function sharpenRegion(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  amount: number
) {
  const w = rect.w;
  const h = rect.h;
  if (amount <= 0 || w < 3 || h < 3) return;
  if (w * h > 40_000_000) return; // quá lớn: bỏ qua cho an toàn bộ nhớ

  let data: ImageData;
  try {
    data = ctx.getImageData(rect.x, rect.y, w, h);
  } catch {
    return; // canvas bị "tainted" (ảnh khác miền) — bỏ qua, không làm hỏng luồng
  }
  const px = data.data;
  const n = w * h;
  const tmp = new Float32Array(n * 3);
  const blur = new Float32Array(n * 3);

  // Box blur 3×3 tách trục: ngang…
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const c = (row + x) * 4;
      const l = (row + (x > 0 ? x - 1 : 0)) * 4;
      const r = (row + (x < w - 1 ? x + 1 : w - 1)) * 4;
      const o = (row + x) * 3;
      tmp[o] = (px[l] + px[c] + px[r]) / 3;
      tmp[o + 1] = (px[l + 1] + px[c + 1] + px[r + 1]) / 3;
      tmp[o + 2] = (px[l + 2] + px[c + 2] + px[r + 2]) / 3;
    }
  }
  // …rồi dọc.
  for (let y = 0; y < h; y++) {
    const up = (y > 0 ? y - 1 : 0) * w;
    const dn = (y < h - 1 ? y + 1 : h - 1) * w;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const o = (row + x) * 3;
      const u = (up + x) * 3;
      const d = (dn + x) * 3;
      blur[o] = (tmp[u] + tmp[o] + tmp[d]) / 3;
      blur[o + 1] = (tmp[u + 1] + tmp[o + 1] + tmp[d + 1]) / 3;
      blur[o + 2] = (tmp[u + 2] + tmp[o + 2] + tmp[d + 2]) / 3;
    }
  }
  // Ảnh nét = ảnh gốc + amount × (ảnh gốc − ảnh mờ). Uint8ClampedArray tự chặn 0..255.
  for (let i = 0, q = 0; i < px.length; i += 4, q += 3) {
    px[i] = px[i] + amount * (px[i] - blur[q]);
    px[i + 1] = px[i + 1] + amount * (px[i + 1] - blur[q + 1]);
    px[i + 2] = px[i + 2] + amount * (px[i + 2] - blur[q + 2]);
  }
  ctx.putImageData(data, rect.x, rect.y);
}

function encode(canvas: HTMLCanvasElement, format: OutputFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("encode_failed"))),
      format,
      quality
    )
  );
}

/** Chất lượng thấp nhất được phép hạ xuống khi dò trần dung lượng. */
const MIN_QUALITY = 0.5;

/**
 * Mã hoá sao cho vừa trần dung lượng: thử ở chất lượng mong muốn trước, nếu
 * nặng quá thì dò nhị phân xuống (tối đa 6 lần) — luôn lấy mức chất lượng CAO
 * NHẤT còn vừa trần.
 */
async function encodeUnder(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number,
  maxBytes: number
): Promise<{ blob: Blob; quality: number; overBudget: boolean }> {
  const first = await encode(canvas, format, quality);
  if (maxBytes <= 0 || first.size <= maxBytes) {
    return { blob: first, quality, overBudget: maxBytes > 0 && first.size > maxBytes };
  }
  // PNG không có tham số chất lượng — không dò được, báo vượt trần.
  if (format === "image/png") return { blob: first, quality, overBudget: true };

  // Thử ngay mức thấp nhất: nếu ảnh nhiều chi tiết đến mức mức này vẫn vượt
  // trần thì dò tiếp cũng vô ích — trả luôn bản nhẹ nhất.
  const floor = await encode(canvas, format, MIN_QUALITY);
  if (floor.size > maxBytes) return { blob: floor, quality: MIN_QUALITY, overBudget: true };

  let lo = MIN_QUALITY;
  let hi = quality;
  let fit: { blob: Blob; quality: number } | null = { blob: floor, quality: MIN_QUALITY };
  let smallest = { blob: floor, quality: MIN_QUALITY };

  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    const b = await encode(canvas, format, mid);
    if (b.size < smallest.blob.size) smallest = { blob: b, quality: mid };
    if (b.size <= maxBytes) {
      fit = { blob: b, quality: mid };
      lo = mid; // còn dư dung lượng: thử nét hơn
    } else {
      hi = mid;
    }
  }
  if (fit) return { ...fit, overBudget: false };
  return { ...smallest, overBudget: true };
}

/**
 * Compress (and optionally watermark) a loaded image. Hỗ trợ hai chế độ:
 * giới hạn cạnh dài (`maxDim`) như trước, hoặc ép vào khung chuẩn (`frame`).
 */
export async function compressImage(
  img: HTMLImageElement,
  opts: CompressOptions
): Promise<CompressResult> {
  const ow = img.naturalWidth;
  const oh = img.naturalHeight;
  const plan = opts.frame
    ? planFrame(ow, oh, opts.frame, !!opts.allowUpscale)
    : planMaxDim(ow, oh, opts.maxDim);

  const canvas = document.createElement("canvas");
  canvas.width = plan.canvas.w;
  canvas.height = plan.canvas.h;
  const ctx = canvas.getContext("2d")!;

  if (plan.padded) {
    ctx.fillStyle = opts.frame?.padColor || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawStepDown(ctx, img, plan);

  // Chỉ làm nét khi ảnh THU NHỎ; ảnh giữ nguyên cỡ hay phóng to thì làm nét
  // chỉ tạo hạt và viền giả.
  const shrunk = plan.dest.w < plan.src.w;
  const sharpen = opts.sharpen ?? 0;
  if (sharpen > 0 && shrunk) sharpenRegion(ctx, plan.dest, sharpen);

  // Watermark vẽ SAU khi làm nét để chữ/logo không bị viền kép.
  if (opts.watermark) drawWatermark(ctx, canvas.width, canvas.height, opts.watermark);

  const enc = await encodeUnder(canvas, opts.format, opts.quality, opts.maxBytes ?? 0);

  return {
    blob: enc.blob,
    width: canvas.width,
    height: canvas.height,
    quality: enc.quality,
    overBudget: enc.overBudget,
    upscaled: plan.dest.w > plan.src.w,
  };
}

/** File extension for an output format. */
export function formatExt(format: OutputFormat): string {
  if (format === "image/webp") return "webp";
  if (format === "image/png") return "png";
  return "jpg";
}

/** Swap a filename's extension to match the output format. */
export function outName(name: string, format: OutputFormat): string {
  const base = name.replace(/\.[^./\\]+$/, "");
  return `${base}.${formatExt(format)}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
