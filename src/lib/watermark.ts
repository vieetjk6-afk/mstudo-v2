import "server-only";
import sharp from "sharp";

/**
 * Đóng dấu chìm lên ảnh Ở PHÍA MÁY CHỦ.
 *
 * Trước đây việc này làm bằng canvas trong trình duyệt (`lib/download.ts`).
 * Cách đó buộc ảnh 2560px phải đi qua proxy `/api/img`: canvas cần đọc được
 * pixel, mà Google Drive không gửi header CORS nên không chuyển hướng thẳng
 * sang Google được — ảnh bị "tainted" và `toBlob()` sẽ ném lỗi.
 *
 * Chuyển sang máy chủ được ba thứ:
 *   1. Nén bằng mozjpeg thay vì bộ mã hoá của trình duyệt → nhỏ hơn ~20–30% ở
 *      cùng mức chất lượng nhìn thấy được.
 *   2. Máy yếu (điện thoại) không còn phải dựng canvas 2560px — trước đây tải
 *      album lớn hay bị hết bộ nhớ và im lặng thất bại.
 *   3. Tên file tải về đặt được đúng, kể cả tên tiếng Việt.
 *
 * ⚠️ Việc này KHÔNG cắt được Fast Origin Transfer của Vercel: byte vẫn phải rời
 *    khỏi máy chủ. Chỉ nhỏ đi nhờ nén tốt hơn. Muốn cắt hẳn thì byte phải được
 *    phục vụ từ nơi khác (Google CDN hoặc R2) — xem docs/supabase-usage.md.
 */

/** Thoát ký tự để nhúng an toàn vào XML/SVG. */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Dựng lớp SVG chứa chữ lặp, nghiêng -30°.
 *
 * Các con số ở đây sao chép NGUYÊN VẸN bản canvas cũ trong lib/download.ts để
 * ảnh tải về trông y hệt trước:
 *   cỡ chữ = max(18, rộng/28) · màu trắng alpha .28 · đậm 600
 *   bước ngang = cỡ chữ × 12 · bước dọc = cỡ chữ × 6 · xoay -30°
 */
function watermarkSvg(width: number, height: number, text: string): Buffer {
  const fontSize = Math.max(18, Math.round(width / 28));
  const stepX = fontSize * 12;
  const stepY = fontSize * 6;
  const safe = xmlEscape(text);

  const nodes: string[] = [];
  for (let y = -height; y < height * 2; y += stepY) {
    for (let x = -width; x < width * 2; x += stepX) {
      nodes.push(`<text x="${x}" y="${y}">${safe}</text>`);
    }
  }

  // dominant-baseline="central" ứng với textBaseline="middle" của canvas;
  // text-anchor="middle" ứng với textAlign="center".
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<g transform="rotate(-30 ${width / 2} ${height / 2})" ` +
      `font-family="sans-serif" font-size="${fontSize}" font-weight="600" ` +
      `fill="#ffffff" fill-opacity="0.28" ` +
      `text-anchor="middle" dominant-baseline="central">` +
      nodes.join("") +
      `</g></svg>`,
  );
}

export interface WatermarkResult {
  /**
   * Uint8Array chứ không phải Buffer: `Buffer<ArrayBufferLike>` của sharp không
   * gán được cho BodyInit của Response (ArrayBufferLike gồm cả SharedArrayBuffer).
   * Ta trả về một khung nhìn (view) trên đúng vùng nhớ đó — không sao chép, nên
   * ảnh vài MB không bị nhân đôi bộ nhớ.
   */
  body: Uint8Array<ArrayBuffer>;
  contentType: "image/jpeg";
}

/**
 * Đóng dấu lên `input` và trả về JPEG.
 *
 * Ném lỗi nếu thất bại — CỐ Ý không trả về ảnh gốc khi hỏng. Watermark là lớp
 * bảo vệ; im lặng trả ảnh sạch cho khách là hỏng đúng cái mà tính năng này sinh
 * ra để làm.
 */
/**
 * Đánh đổi CPU ↔ băng thông, đo trên ảnh 2560px chi tiết cao:
 *
 *   mozjpeg BẬT  (mặc định)  ~510–1100 ms/ảnh   file nhỏ hơn nguồn ~17%
 *   mozjpeg TẮT              ~180 ms/ảnh        file xấp xỉ bằng nguồn
 *
 * Mặc định bật vì trên Vercel thứ khan hiếm là Fast Origin Transfer, còn CPU
 * thì dư. Nếu CPU trở thành nút thắt (Fluid Active CPU chạm trần) thì đặt
 * WATERMARK_MOZJPEG=0 — đổi lại mất phần tiết kiệm băng thông.
 * Trên VPS thì cứ để bật: CPU ở đó không tính tiền.
 */
const USE_MOZJPEG = process.env.WATERMARK_MOZJPEG !== "0";
const QUALITY = Math.min(Math.max(Number(process.env.WATERMARK_QUALITY) || 90, 60), 100);

export async function watermarkJpeg(
  input: Buffer,
  text: string,
  opts: { quality?: number } = {},
): Promise<WatermarkResult> {
  // failOn: "none" — ảnh từ Drive đôi khi có metadata méo mó nhưng pixel vẫn
  // đọc tốt; mặc định của sharp sẽ từ chối cả file.
  const base = sharp(input, { failOn: "none" }).rotate(); // .rotate() = tôn trọng EXIF Orientation

  const meta = await base.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new Error("khong doc duoc kich thuoc anh");

  const out = await base
    .composite([{ input: watermarkSvg(width, height, text), top: 0, left: 0 }])
    // mozjpeg: nhỏ hơn ~25% so với bộ mã hoá của trình duyệt ở cùng mức chất
    // lượng (đo được: 76KB so với 102KB trên cùng một ảnh).
    //
    // Giữ chroma subsampling mặc định (4:2:0). Đã thử 4:4:4 để "cho chữ nét
    // hơn" nhưng đo ra file to thêm 35% mà không đáng: 4:2:0 chỉ giảm độ phân
    // giải THÔNG TIN MÀU, còn chữ watermark là trắng mờ — gần như thuần độ
    // sáng, nên không mất nét.
    .jpeg({ quality: opts.quality ?? QUALITY, mozjpeg: USE_MOZJPEG })
    .toBuffer();

  return {
    body: new Uint8Array(out.buffer as ArrayBuffer, out.byteOffset, out.byteLength),
    contentType: "image/jpeg",
  };
}
