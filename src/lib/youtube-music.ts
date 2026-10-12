/**
 * Nhạc nền thiệp từ link YouTube.
 *
 * Thẻ <audio> chỉ phát được FILE nhạc (mp3/m4a…) — dán link YouTube vào là im
 * lặng, không báo lỗi gì. Hàm dưới nhận diện mọi kiểu link YouTube khách hay dán
 * (watch, youtu.be, m., music., shorts, embed, live) để MusicPlayer chuyển sang
 * phát bằng trình phát YouTube ẩn. Giữ luôn mốc `t=` / `start=` để cặp đôi bỏ
 * được đoạn dạo đầu.
 */

export type YoutubeMusic = { id: string; start: number };

/** Mã video YouTube luôn đúng 11 ký tự — chặn luôn mọi thứ lạ chen vào URL nhúng. */
const VIDEO_ID = /^[\w-]{11}$/;

export function parseYoutubeMusic(raw: string | null | undefined): YoutubeMusic | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^(?:www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = u.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = u.pathname === "/watch"
      ? u.searchParams.get("v")
      : u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/)?.[1] ?? null;
  }
  if (!id || !VIDEO_ID.test(id)) return null;
  return { id, start: parseStart(u.searchParams.get("t") ?? u.searchParams.get("start")) };
}

/** "90" · "90s" · "1m30s" · "1h2m3s" → số giây; dạng lạ → 0 (phát từ đầu). */
function parseStart(t: string | null): number {
  if (!t) return 0;
  if (/^\d+s?$/.test(t)) return parseInt(t, 10);
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
}

/**
 * Link trang nghe nhạc (Zing, Spotify, Drive…) — là trang web chứ không phải file
 * nhạc, nên không phát được. Trình chỉnh sửa dùng để nhắc ngay khi dán.
 */
export function isMusicPageLink(raw: string | null | undefined): boolean {
  return /^(?:https?:\/\/)?(?:[\w-]+\.)*(?:zingmp3\.vn|nhaccuatui\.com|spotify\.com|soundcloud\.com|tiktok\.com|facebook\.com|fb\.watch|music\.apple\.com|drive\.google\.com)(?:[/?#]|$)/i.test((raw ?? "").trim());
}
