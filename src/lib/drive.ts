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
 * Nếu ảnh hiển thị hỏng (CDN Google đôi khi từ chối, nhất là webview trong app),
 * thử lại một lần qua proxy đọc byte (`raw=1`) — proxy tự dò nhiều nguồn. Trước
 * đây ảnh lớn trong khung xem hỏng là khách chỉ còn thấy ảnh nền nhỏ, mờ.
 */
export function retryViaProxy(e: { currentTarget: HTMLImageElement }) {
  const im = e.currentTarget;
  if (im.dataset.retried || im.src.includes("raw=1")) return;
  im.dataset.retried = "1";
  im.src = `${im.src}&raw=1`;
}

/** Direct download URL for an original file. */
export function downloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/** Strip a file extension from a name (for "copy list without extension"). */
export function stripExtension(name: string): string {
  return name.replace(/\.[^./\\]+$/, "");
}
