/**
 * MÁY CHỦ MEDIA Ở NHÀ (media.<tên-miền>) — host nào là nó, và nó được phục vụ gì.
 *
 * Bối cảnh: app chính vẫn chạy trên Vercel. Một máy nhỏ ở nhà chạy ĐÚNG app
 * này trong Docker, ra Internet qua Cloudflare Tunnel ở một tên miền phụ riêng,
 * và chỉ gánh việc nặng: đọc byte ảnh (/api/img?raw=1), quét khuôn mặt, worker
 * Zalo. Xem deploy/home-server/HUONG-DAN.md.
 *
 * Hai nguy cơ mà file này chặn:
 *
 *   1. PROXY TƯỞNG NÓ LÀ STUDIO. `media.mstudo.com` là một *.MAIN_HOST, nên
 *      nhánh "tên miền phụ của studio" trong src/proxy.ts sẽ rewrite nó thành
 *      /site/media — tệ hơn, nếu MEDIA_HOST là tên miền khác hẳn thì nhánh
 *      "tên miền riêng" nhận nó. Phải nhận ra nó TRƯỚC hai nhánh đó.
 *   2. MÁY Ở NHÀ PHỤC VỤ CẢ BẢNG ĐIỀU KHIỂN RA INTERNET. Nó chỉ được trả đúng
 *      vài đường dẫn; mọi thứ khác là 404.
 *
 * Hàm THUẦN (không đọc process.env, không import gì) để desktop/test/
 * media-origin.mjs nạp thẳng bằng Node mà kiểm.
 */

/**
 * Đường dẫn máy media ĐƯỢC phục vụ. Giữ KHỚP với `MEDIA_API_ALLOW` trong
 * next.config.mjs (lớp chặn /api/* — proxy không chạy trên /api/ vì matcher
 * bỏ qua) — bài test so hai bên với nhau.
 *
 *   /api/img, /api/file  : byte ảnh / chuyển hướng file Drive (công khai theo id)
 *   /api/version         : healthcheck của Docker + kiểm tra từ xa
 *   /api/cron/*          : bộ hẹn giờ trong container `cron` (có CRON_SECRET)
 *   /api/inbox/ingest    : worker Zalo đẩy tin về (có INBOX_INGEST_SECRET)
 */
export const MEDIA_EXACT_PATHS = ["/api/img", "/api/file", "/api/version", "/api/inbox/ingest"] as const;
export const MEDIA_PREFIX_PATHS = ["/api/cron/"] as const;

/** Đường dẫn này có được phục vụ trên máy media không? */
export function mediaHostAllows(pathname: string): boolean {
  if ((MEDIA_EXACT_PATHS as readonly string[]).includes(pathname)) return true;
  return MEDIA_PREFIX_PATHS.some((p) => pathname.startsWith(p) && pathname.length > p.length);
}

/**
 * Host (không cổng, chữ thường) của máy media, lấy từ MEDIA_HOST hoặc suy ra từ
 * NEXT_PUBLIC_MEDIA_ORIGIN. Rỗng = không cấu hình (Vercel trước khi bật, máy dev).
 */
export function mediaHostFrom(mediaHostEnv?: string | null, mediaOriginEnv?: string | null): string {
  const direct = (mediaHostEnv ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[/:].*$/, "");
  if (direct) return direct;
  const origin = (mediaOriginEnv ?? "").trim();
  if (!origin) return "";
  try {
    const u = new URL(origin);
    return u.protocol === "https:" || u.protocol === "http:" ? u.hostname.toLowerCase() : "";
  } catch {
    return "";
  }
}

export type MediaGate = "pass" | "allow" | "block";

/**
 * Quyết định của proxy cho một request:
 *   "pass"  — không phải máy media → proxy chạy tiếp như cũ (Vercel không đổi gì)
 *   "allow" — máy media, đường dẫn được phép → cho đi thẳng, KHÔNG rẽ tenant
 *   "block" — máy media, đường dẫn khác → 404
 *
 * `mediaOnly` (biến MEDIA_ONLY=1 trong docker-compose): coi MỌI host là máy
 * media. Máy ở nhà chỉ có một cửa ra Internet là tunnel, nhưng lỡ ai thêm một
 * hostname thứ hai vào tunnel thì cũng không lộ bảng điều khiển.
 */
export function mediaGate(opts: { host: string; pathname: string; mediaHost: string; mediaOnly: boolean }): MediaGate {
  const host = opts.host.split(":")[0].toLowerCase();
  const isMedia = opts.mediaOnly || (!!opts.mediaHost && host === opts.mediaHost);
  if (!isMedia) return "pass";
  return mediaHostAllows(opts.pathname) ? "allow" : "block";
}
