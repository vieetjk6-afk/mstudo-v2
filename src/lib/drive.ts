/**
 * Helpers for turning Google Drive links into file IDs and image URLs.
 */
import { mediaImgSrc } from "./media-origin.ts";

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
 * URL ảnh ở MÁY CHỦ GOOGLE CÒN LẠI (không phải cái /api/img vừa 302 sang).
 * /api/img chuyển w ≤ 1024 sang drive.google.com/thumbnail, lớn hơn sang
 * lh3.googleusercontent.com — nên thử lại bằng host kia: vẫn là CDN Google,
 * Vercel không chở byte nào. null nếu src không phải /api/img?id=…&w=….
 */
function altGoogleUrl(src: string): string | null {
  try {
    const u = new URL(src, typeof location !== "undefined" ? location.href : "http://x");
    if (u.pathname !== "/api/img" || u.searchParams.get("orig") === "1") return null;
    const id = u.searchParams.get("id");
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) return null;
    const w = Math.min(Math.max(Number(u.searchParams.get("w")) || 500, 16), 4096);
    return w <= 1024
      ? `https://lh3.googleusercontent.com/d/${id}=w${w}`
      : `https://drive.google.com/thumbnail?id=${id}&sz=w${w}`;
  } catch {
    return null;
  }
}

/**
 * Ảnh trong LƯỚI hỏng → thử một lần host Google còn lại, KHÔNG bao giờ rơi
 * xuống proxy đọc byte: lưới có hàng trăm ô, mỗi ô hỏng mà kéo byte qua Vercel
 * là đốt Fast Origin Transfer. Hỏng nữa thì để ô trống.
 */
export function retryAltHost(e: { currentTarget: HTMLImageElement }) {
  const im = e.currentTarget;
  if (im.dataset.retried) return;
  im.dataset.retried = "alt";
  const alt = altGoogleUrl(im.src);
  if (alt) im.src = alt;
}

/**
 * Ảnh LỚN trong khung xem hỏng (CDN Google đôi khi từ chối, nhất là webview
 * trong app): thử host Google còn lại trước (0 byte qua Vercel), chỉ khi vẫn
 * hỏng mới tới proxy đọc byte (`raw=1`) — proxy tự dò nhiều nguồn. Trước đây
 * ảnh lớn hỏng là khách chỉ còn thấy ảnh nền nhỏ, mờ. Chỉ dùng cho khung xem
 * một ảnh; lưới ảnh dùng retryAltHost.
 *
 * Có máy media ở nhà (NEXT_PUBLIC_MEDIA_ORIGIN) thì bậc đọc byte chia đôi: máy
 * media trước ("media"), hỏng nữa mới tới proxy cùng miền ("raw"). Không có
 * máy media thì chuỗi bậc y hệt trước.
 */
export function retryViaProxy(e: { currentTarget: HTMLImageElement }) {
  const im = e.currentTarget;
  const stage = im.dataset.retried;
  if (stage === "raw") return;
  // Ảnh vốn đã là lượt đọc byte cùng miền (không do hàm này đổi) → hết đường lùi.
  if (stage !== "media" && im.src.includes("raw=1")) return;
  if (!stage) {
    const alt = altGoogleUrl(im.src);
    if (alt) {
      im.dataset.orig = im.src;
      im.dataset.retried = "alt";
      im.src = alt;
      return;
    }
  }
  const base = im.dataset.orig || im.src;
  if (!base.includes("/api/img")) return;
  const raw = `${base}&raw=1`;
  if (stage !== "media") {
    const media = mediaImgSrc(raw);
    if (media) {
      im.dataset.orig = base;
      im.dataset.retried = "media";
      im.src = media;
      return;
    }
  }
  im.dataset.retried = "raw";
  im.src = raw;
}

/** Direct download URL for an original file. */
export function downloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/** Strip a file extension from a name (for "copy list without extension"). */
export function stripExtension(name: string): string {
  return name.replace(/\.[^./\\]+$/, "");
}
