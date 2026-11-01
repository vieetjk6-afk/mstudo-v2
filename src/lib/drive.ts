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
 * Image URLs are served through our own /api/img proxy. The proxy fetches the
 * bytes from Google server-side (trying lh3 / thumbnail / download in turn), so
 * images embed reliably regardless of Google's hotlink/referrer behaviour.
 */
export function thumbnailUrl(fileId: string, width = 400): string {
  return `/api/img?id=${fileId}&w=${width}`;
}

/** Larger preview / full image URL (also proxied). */
export function fullImageUrl(fileId: string, width = 1600): string {
  return `/api/img?id=${fileId}&w=${width}`;
}

/** Ảnh GỐC đúng độ phân giải chụp, để hiển thị (proxy 302 thẳng sang Google). */
export function originalImageUrl(fileId: string): string {
  return `/api/img?id=${fileId}&orig=1`;
}

/**
 * Các URL ảnh DỰ PHÒNG thẳng ở CDN Google (Vercel không chở byte nào), thử lần
 * lượt khi ảnh /api/img hỏng. [] nếu src không phải /api/img?id=…&w=….
 *
 * /api/img 302 sang lh3.googleusercontent.com cho MỌI cỡ (xem route). Với cỡ
 * nhỏ vẫn thử lại lh3 TRỰC TIẾP trước: trình duyệt có thể còn giữ (max-age 1
 * ngày) bản 302 cũ trỏ sang drive.google.com/thumbnail — host đó bị Google giới
 * hạn/chặn với studio có album lớn, ảnh hỏng hàng loạt. Sau cùng mới tới
 * drive.google.com/thumbnail (vẫn cần cho poster video một số file).
 */
function altGoogleUrls(src: string): string[] {
  try {
    const u = new URL(src, typeof location !== "undefined" ? location.href : "http://x");
    if (u.pathname !== "/api/img" || u.searchParams.get("orig") === "1") return [];
    const id = u.searchParams.get("id");
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) return [];
    const w = Math.min(Math.max(Number(u.searchParams.get("w")) || 500, 16), 4096);
    const thumb = `https://drive.google.com/thumbnail?id=${id}&sz=w${w}`;
    return w <= 1024 ? [`https://lh3.googleusercontent.com/d/${id}=w${w}`, thumb] : [thumb];
  } catch {
    return [];
  }
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
  const base = im.dataset.orig || im.src;
  if (!base.includes("/api/img")) return;
  im.dataset.retried = "raw";
  im.src = `${base}&raw=1`;
}

/** Direct download URL for an original file. */
export function downloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/** Strip a file extension from a name (for "copy list without extension"). */
export function stripExtension(name: string): string {
  return name.replace(/\.[^./\\]+$/, "");
}
