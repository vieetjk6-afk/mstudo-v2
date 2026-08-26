// Ảnh đính kèm tin Zalo — THUẦN (không server-only) để test chạy thẳng trên node.

/**
 * Ảnh đính kèm do TRÌNH DUYỆT truyền lên, mà MÁY CHỦ mới là bên đi tải — nhận
 * URL tuỳ ý là mở sẵn một cửa SSRF (dò dịch vụ nội bộ, endpoint metadata của
 * máy chủ). Nên chỉ nhận đúng máy chủ ảnh QR đang dùng; URL khác coi như không
 * có ảnh và tin vẫn gửi dạng văn bản (link QR đã nằm trong nội dung).
 */
const IMAGE_HOSTS = new Set(["img.vietqr.io", "api.vietqr.io"]);

export function safeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && IMAGE_HOSTS.has(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

export type ImageDims = { width: number; height: number; ext: "png" | "jpg" | "webp" };

/**
 * Đọc kích thước ảnh THẲNG TỪ BYTE ĐẦU TỆP.
 *
 * Vì sao phải tự đọc: zca-js bắt buộc có `width`/`height` mới tải ảnh lên Zalo
 * được. Nếu đưa đường dẫn tệp, nó đòi `imageMetadataGetter` — một thư viện đo
 * ảnh do người dùng tự cắm — không có là NÉM LỖI, và tin rơi về dạng chỉ có
 * link. Đưa thẳng buffer kèm kích thước thì không cần thư viện nào.
 *
 * Chỉ cần 3 định dạng Zalo nhận cho ảnh (png/jpg/webp); QR của VietQR là PNG.
 */
export function imageDims(buf: Uint8Array): ImageDims | null {
  const u32 = (i: number) => (buf[i] << 24) | (buf[i + 1] << 16) | (buf[i + 2] << 8) | buf[i + 3];
  const u16 = (i: number) => (buf[i] << 8) | buf[i + 1];
  const ascii = (i: number, n: number) => String.fromCharCode(...buf.slice(i, i + n));

  // PNG: chữ ký 8 byte, rồi khối IHDR có rộng/cao ở byte 16..23.
  if (buf.length > 24 && ascii(1, 3) === "PNG" && ascii(12, 4) === "IHDR") {
    return { width: u32(16) >>> 0, height: u32(20) >>> 0, ext: "png" };
  }

  // WebP: "RIFF"…"WEBP" + khối VP8/VP8L/VP8X, mỗi loại giấu kích thước một chỗ.
  if (buf.length > 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    const le16 = (i: number) => buf[i] | (buf[i + 1] << 8);
    if (chunk === "VP8X") return { width: (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1, height: (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1, ext: "webp" };
    if (chunk === "VP8 ") return { width: le16(26) & 0x3fff, height: le16(28) & 0x3fff, ext: "webp" };
    if (chunk === "VP8L") {
      const b = buf[21] | (buf[22] << 8) | (buf[23] << 16) | (buf[24] << 24);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1, ext: "webp" };
    }
    return null;
  }

  // JPEG: duyệt các đoạn tới khi gặp SOF (trừ SOF4/8/12 vốn không mang kích thước).
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      if (marker === 0xda || marker === 0xd9) break; // vào phần dữ liệu ảnh
      const len = u16(i + 2);
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) return { width: u16(i + 7), height: u16(i + 5), ext: "jpg" };
      if (len < 2) break;
      i += 2 + len;
    }
  }

  return null;
}
