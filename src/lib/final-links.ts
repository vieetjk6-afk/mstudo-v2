/**
 * Link SẢN PHẨM HOÀN THIỆN dán tay trên hợp đồng — album và video giao khách.
 *
 * Không phải studio nào cũng giao qua album mstudo: nhiều nơi gửi video cưới
 * bằng YouTube, album bằng Google Photos / Drive / Pixieset. Hai cột
 * `final_album_url` và `final_video_urls` (migrations/contract_final_links.sql)
 * cho studio dán thẳng link đó trên màn hợp đồng, và cổng khách /portal hiện
 * ra ngay — không phụ thuộc album có ở đúng giai đoạn giao khách hay không.
 *
 * `final_video_urls` là văn bản nhiều dòng: mỗi dòng một link, có thể kèm tên
 * phía trước dấu "|" ("Phóng sự cưới | https://youtu.be/…").
 */

export type FinalVideo = { title: string | null; url: string; embed: string | null };

/** Chỉ nhận http(s) — chặn `javascript:` và mọi thứ không phải đường dẫn web. */
export function safeUrl(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const withProto = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withProto);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Link xem được nhúng thẳng trong trang (YouTube / Vimeo / Google Drive). */
export function videoEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  const dr = url.match(/drive\.google\.com\/(?:file\/d\/|open\?(?:.*&)?id=|uc\?(?:.*&)?id=)([\w-]{10,})/i);
  if (dr) return `https://drive.google.com/file/d/${dr[1]}/preview`;
  return null;
}

export function parseFinalVideos(raw: string | null | undefined): FinalVideo[] {
  return (raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const bar = line.lastIndexOf("|");
      const title = bar > 0 ? line.slice(0, bar).trim() || null : null;
      const url = safeUrl(bar > 0 ? line.slice(bar + 1) : line);
      return url ? { title, url, embed: videoEmbedUrl(url) } : null;
    })
    .filter((v): v is FinalVideo => !!v)
    .slice(0, 20);
}
