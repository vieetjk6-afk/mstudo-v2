/**
 * Đổi giá trị Facebook/Messenger khách dán vào thành link MỞ ĐƯỢC.
 *
 * Chỉ đổi sang khung chat Messenger (m.me/…) khi CHẮC CHẮN đó là trang cá nhân
 * / fanpage: profile.php?id=…, people/<tên>/<id>, facebook.com/<tên-đăng-nhập>,
 * hoặc chỉ gõ tên đăng nhập. Mọi link khác — bài viết, ảnh, reel, nhóm, link
 * chia sẻ (share/p/…), fb.me… — giữ NGUYÊN link Facebook: đổi sang m.me sẽ ra
 * link hỏng ("m.me/share/p/abc").
 */

/** Đoạn đầu đường dẫn facebook.com/<…> KHÔNG phải tên trang cá nhân. */
const NOT_PROFILE = new Set([
  "share", "sharer", "sharer.php", "permalink.php", "story.php", "photo", "photo.php", "photos",
  "watch", "reel", "reels", "videos", "video.php", "groups", "events", "pages", "page", "hashtag",
  "marketplace", "gaming", "stories", "login", "login.php", "home.php", "search", "notes",
  "media", "posts", "l.php", "dialog", "help", "privacy", "policies", "settings", "messages",
  "profile.php", "people", "fundraisers", "live", "ads", "business", "plugins", "tr", "p",
]);

export function messengerUrl(link: string | null | undefined): string {
  const raw = (link ?? "").trim();
  if (!raw) return "";
  let v = raw.replace(/^https?:\/\//i, "").replace(/^(www|m|mbasic|web|business)\./i, "");
  const original = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  // Đã là link Messenger.
  if (/^(m\.me|messenger\.com)\//i.test(v)) return `https://${v}`;

  const fb = v.match(/^(?:facebook\.com|fb\.com)\/(.*)$/i);
  if (fb) {
    const rest = fb[1];
    const byId = rest.match(/^profile\.php\?(?:.*&)?id=(\d+)/i);
    if (byId) return `https://m.me/${byId[1]}`;
    const people = rest.match(/^people\/[^/?#]+\/(\d+)\/?(?:[?#].*)?$/i);
    if (people) return `https://m.me/${people[1]}`;
    // facebook.com/<tên> (có thể kèm ?… hoặc / cuối) — đúng MỘT đoạn đường dẫn.
    const path = rest.split(/[?#]/)[0].replace(/\/+$/, "");
    if (/^[\w.-]+$/.test(path) && !NOT_PROFILE.has(path.toLowerCase())) return `https://m.me/${path}`;
    return original; // bài viết / ảnh / nhóm / link chia sẻ… → mở đúng link Facebook
  }

  // Chỉ gõ tên đăng nhập.
  if (/^[\w.]+$/.test(v) && !v.includes("..") && /[a-z]/i.test(v)) return `https://m.me/${v}`;
  if (/^\d{5,}$/.test(v)) return `https://m.me/${v}`;
  return original;
}
