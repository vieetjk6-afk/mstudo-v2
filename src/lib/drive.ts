/**
 * Helpers for turning Google Drive links into file IDs and image URLs.
 */

/** Extract a Drive file ID from common share-link formats. */
export function extractFileId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // https://drive.google.com/file/d/FILE_ID/view
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];

  // https://drive.google.com/open?id=FILE_ID  or  ...&id=FILE_ID
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];

  // https://drive.google.com/uc?export=view&id=FILE_ID handled above.
  // Bare ID
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;

  return null;
}

/** Extract a Drive folder ID from a folder share link. */
export function extractFolderId(url: string): string | null {
  const trimmed = url.trim();
  // https://drive.google.com/drive/folders/FOLDER_ID
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];

  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];

  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

/** Does this link look like a folder link? */
export function isFolderLink(url: string): boolean {
  return /\/folders\//.test(url) || /\/drive\/u\/\d+\/folders\//.test(url);
}

/**
 * ẢNH ĐỂ HIỂN THỊ trỏ THẲNG CDN Google (lh3.googleusercontent.com).
 *
 * Trước đây mọi <img> đi qua /api/img — route đó chỉ trả 302 sang đúng địa chỉ
 * lh3 này. Một lưới 300 ảnh là 300 lượt gọi Vercel (edge request + đôi khi một
 * lượt chạy hàm) chỉ để nhận lại lệnh chuyển hướng, cho MỖI người xem. Trỏ
 * thẳng thì Vercel tốn 0 lượt; ảnh hỏng vẫn có đường dự phòng (retryAltHost /
 * retryViaProxy bên dưới).
 *
 * Chỗ cần BYTE CÙNG MIỀN (canvas đóng watermark, quét AI bằng fetch, xuất ảnh
 * ghép) phải dùng rawImageUrl — Google không gửi header CORS. Ảnh bìa LƯU VÀO
 * DB dùng coverImageUrl (dạng /api/img) để địa chỉ đã lưu không phụ thuộc cách
 * Google phục vụ ảnh.
 *
 * Đường lui: đặt NEXT_PUBLIC_IMG_DIRECT=0 trên Vercel (rồi deploy lại) là mọi
 * ảnh hiển thị quay về /api/img như cũ.
 */
const IMG_DIRECT = process.env.NEXT_PUBLIC_IMG_DIRECT !== "0";

/** Ảnh qua proxy của app (302 sang Google) — giữ cho địa chỉ lưu DB / đường lui. */
export function proxyImageUrl(fileId: string, width: number): string {
  return `/api/img?id=${fileId}&w=${width}`;
}

/** Byte ảnh CÙNG MIỀN (canvas / fetch đọc được điểm ảnh). Tốn băng thông Vercel. */
export function rawImageUrl(fileId: string, width: number): string {
  return `/api/img?id=${encodeURIComponent(fileId)}&w=${width}&raw=1`;
}

/** Địa chỉ ảnh bìa để LƯU vào albums.cover_url (và so sánh "ảnh nào đang là bìa"). */
export function coverImageUrl(fileId: string): string {
  return proxyImageUrl(fileId, 800);
}

function googleImageUrl(fileId: string, width: number): string {
  return `https://lh3.googleusercontent.com/d/${fileId}=w${Math.round(Math.min(Math.max(width, 16), 4096))}`;
}

/** Ảnh lưới / thumbnail — hiển thị. */
export function thumbnailUrl(fileId: string, width = 400): string {
  return IMG_DIRECT ? googleImageUrl(fileId, width) : proxyImageUrl(fileId, width);
}

/** Ảnh lớn trong khung xem — hiển thị. */
export function fullImageUrl(fileId: string, width = 1600): string {
  return IMG_DIRECT ? googleImageUrl(fileId, width) : proxyImageUrl(fileId, width);
}

/** Ảnh GỐC đúng độ phân giải chụp, để hiển thị (proxy 302 thẳng sang Google). */
export function originalImageUrl(fileId: string): string {
  return `/api/img?id=${fileId}&orig=1`;
}

/**
 * Đọc id file + bề rộng từ một địa chỉ ảnh của app: dạng proxy
 * /api/img?id=…&w=… hoặc dạng trỏ thẳng lh3.googleusercontent.com/d/<id>=w<w>.
 * null nếu không phải (ảnh gốc ?orig=1, ảnh ngoài…).
 */
function parseImgSrc(src: string): { id: string; w: number; direct: boolean } | null {
  try {
    const u = new URL(src, typeof location !== "undefined" ? location.href : "http://x");
    if (u.hostname === "lh3.googleusercontent.com") {
      const m = u.pathname.match(/^\/d\/([a-zA-Z0-9_-]+)=w(\d+)$/);
      return m ? { id: m[1], w: Math.min(Math.max(Number(m[2]) || 500, 16), 4096), direct: true } : null;
    }
    if (u.pathname !== "/api/img" || u.searchParams.get("orig") === "1") return null;
    const id = u.searchParams.get("id");
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) return null;
    return { id, w: Math.min(Math.max(Number(u.searchParams.get("w")) || 500, 16), 4096), direct: false };
  } catch {
    return null;
  }
}

/**
 * Các URL ảnh DỰ PHÒNG thẳng ở CDN Google (Vercel không chở byte nào), thử lần
 * lượt khi ảnh hỏng. [] nếu src không phải ảnh Drive của app.
 *
 * Ảnh đang trỏ thẳng lh3 mà hỏng → thử drive.google.com/thumbnail. Ảnh dạng
 * /api/img (địa chỉ cũ đã lưu, ảnh bìa) → thử lh3 TRỰC TIẾP trước: trình duyệt
 * có thể còn giữ (max-age 1 ngày) bản 302 cũ trỏ sang drive.google.com/thumbnail
 * — host đó bị Google giới hạn/chặn với studio có album lớn, ảnh hỏng hàng loạt.
 * Sau cùng mới tới drive.google.com/thumbnail (vẫn cần cho poster video).
 */
function altGoogleUrls(src: string): string[] {
  const p = parseImgSrc(src);
  if (!p) return [];
  const thumb = `https://drive.google.com/thumbnail?id=${p.id}&sz=w${p.w}`;
  if (p.direct) return [thumb];
  return p.w <= 1024 ? [googleImageUrl(p.id, p.w), thumb] : [thumb];
}

/**
 * Thử URL dự phòng kế tiếp cho ảnh hỏng. true = đã đổi src (chờ lượt tải mới),
 * false = hết đường dự phòng. Thứ tự lưu ở data-alt-step, URL gốc ở data-orig.
 */
function nextAlt(im: HTMLImageElement): boolean {
  const base = im.dataset.orig || im.src;
  const alts = altGoogleUrls(base);
  const step = Number(im.dataset.altStep || "0");
  if (step >= alts.length) return false;
  im.dataset.orig = base;
  im.dataset.altStep = String(step + 1);
  im.dataset.retried = "alt";
  im.src = alts[step];
  return true;
}

/**
 * Ảnh trong LƯỚI / ảnh bìa hỏng → thử các host Google còn lại, KHÔNG bao giờ
 * rơi xuống proxy đọc byte: lưới có hàng trăm ô, mỗi ô hỏng mà kéo byte qua
 * Vercel là đốt Fast Origin Transfer. Hết đường thì đánh dấu data-retried="done"
 * để nơi gọi hiện ô trống. Trả về true nếu còn đang thử.
 */
export function retryAltHost(e: { currentTarget: HTMLImageElement }): boolean {
  const im = e.currentTarget;
  if (im.dataset.retried === "done") return false;
  if (nextAlt(im)) return true;
  im.dataset.retried = "done";
  return false;
}

/**
 * Ảnh LỚN trong khung xem hỏng (CDN Google đôi khi từ chối, nhất là webview
 * trong app): thử các host Google còn lại trước (0 byte qua Vercel), chỉ khi vẫn
 * hỏng mới tới proxy đọc byte (`raw=1`) — proxy tự dò nhiều nguồn. Trước đây
 * ảnh lớn hỏng là khách chỉ còn thấy ảnh nền nhỏ, mờ. Chỉ dùng cho khung xem
 * một ảnh; lưới ảnh dùng retryAltHost.
 */
export function retryViaProxy(e: { currentTarget: HTMLImageElement }) {
  const im = e.currentTarget;
  if (im.dataset.retried === "raw" || im.src.includes("raw=1")) return;
  if (nextAlt(im)) return;
  const p = parseImgSrc(im.dataset.orig || im.src);
  if (!p) return;
  im.dataset.retried = "raw";
  im.src = rawImageUrl(p.id, Math.min(p.w, 2560));
}

/** Direct download URL for an original file. */
export function downloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/** Strip a file extension from a name (for "copy list without extension"). */
export function stripExtension(name: string): string {
  return name.replace(/\.[^./\\]+$/, "");
}
