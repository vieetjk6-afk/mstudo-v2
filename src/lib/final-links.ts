/**
 * Link SẢN PHẨM HOÀN THIỆN dán tay trên hợp đồng — album, video và file gốc.
 *
 * Không phải studio nào cũng giao qua album mstudo: nhiều nơi gửi video cưới
 * bằng YouTube, album bằng Google Photos / Drive / Pixieset. Các cột
 * `final_album_url`, `final_video_urls` (migrations/contract_final_links.sql)
 * và `final_originals_url` — thư mục TOÀN BỘ file gốc cho khách tải về
 * (migrations/contract_final_originals.sql) — cho studio dán thẳng link trên
 * màn hợp đồng, và cổng khách /portal hiện ra ngay — không phụ thuộc album có ở
 * đúng giai đoạn giao khách hay không.
 *
 * `final_video_urls` là văn bản nhiều dòng: mỗi dòng một link, có thể kèm tên
 * phía trước dấu "|" ("Phóng sự cưới | https://youtu.be/…").
 */

export type VideoKind = "youtube" | "vimeo" | "drive" | "other";

export type FinalVideo = {
  title: string | null;
  url: string;
  /** Link nhúng được vào <iframe>, null = chỉ mở được ở tab mới. */
  embed: string | null;
  kind: VideoKind;
  /** Ảnh bìa dựng sẵn (YouTube / Drive) — Vimeo cần API nên để null. */
  poster: string | null;
  /** id file Drive — để tải về qua /api/img?dl=1 khi studio cho tải. */
  drive_id: string | null;
};

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

/**
 * Nhận diện nguồn video từ link dán tay: link nhúng (YouTube / Vimeo / Drive),
 * ảnh bìa và id file Drive. Link lạ vẫn giữ — chỉ là mở ở tab mới.
 */
export function videoSource(url: string): Pick<FinalVideo, "embed" | "kind" | "poster" | "drive_id"> {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) {
    return {
      kind: "youtube",
      embed: `https://www.youtube.com/embed/${yt[1]}`,
      poster: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`,
      drive_id: null,
    };
  }
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) return { kind: "vimeo", embed: `https://player.vimeo.com/video/${vm[1]}`, poster: null, drive_id: null };
  const dr = url.match(/drive\.google\.com\/(?:file\/d\/|open\?(?:.*&)?id=|uc\?(?:.*&)?id=)([\w-]{10,})/i);
  if (dr) {
    return {
      kind: "drive",
      embed: `https://drive.google.com/file/d/${dr[1]}/preview`,
      poster: `/api/img?id=${dr[1]}&w=1024`,
      drive_id: dr[1],
    };
  }
  return { kind: "other", embed: null, poster: null, drive_id: null };
}

/**
 * Link phát kèm tự chạy — chỉ dùng SAU khi khách đã bấm nút phát (trình duyệt
 * cho phép tự chạy khi có thao tác của người xem). Drive không có tham số này.
 */
export function autoplayUrl(embed: string, kind: VideoKind): string {
  if (kind === "youtube") return `${embed}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  if (kind === "vimeo") return `${embed}?autoplay=1&title=0&byline=0&portrait=0`;
  return embed;
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
      return url ? { title, url, ...videoSource(url) } : null;
    })
    .filter((v): v is FinalVideo => !!v)
    .slice(0, 20);
}
