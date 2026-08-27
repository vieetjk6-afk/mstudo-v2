import type { OutputFormat } from "@/lib/compress";

/**
 * Khung ảnh chuẩn của từng mạng xã hội.
 *
 * Vì sao cần: Facebook / Instagram / Zalo LUÔN nén lại ảnh sau khi nhận. Nếu ảnh
 * gửi lên không trùng một trong các bề rộng mà nền tảng dùng (Facebook: 2048,
 * 1080, 960, 720), nó phải vừa thu nhỏ vừa nén — ảnh bị "vỡ", răng cưa ở viền
 * tóc, chữ và da. Xuất sẵn đúng khung + đúng bề rộng chuẩn, dung lượng vừa trần
 * thì nền tảng gần như chỉ chép lại, ảnh giữ nét.
 *
 * `quality` / `maxBytes` là mức khuyến nghị: đủ nhẹ để nền tảng không nén sâu
 * thêm, nhưng vẫn cao hơn hẳn mức tự nén của app điện thoại.
 */

export type PlatformId = "facebook" | "instagram" | "tiktok" | "zalo" | "youtube" | "threads";

export interface SocialPreset {
  id: string;
  platform: PlatformId;
  label: string;
  /** Khung đích, px. */
  w: number;
  h: number;
  /** Cách vừa khung gợi ý mặc định cho khổ này. */
  fit: "contain" | "cover" | "pad";
  format: OutputFormat;
  /** Chất lượng khởi điểm (0..1). */
  quality: number;
  /** Trần dung lượng khuyến nghị, byte. 0 = không đặt trần. */
  maxBytes: number;
  note: string;
}

export const PLATFORMS: { id: PlatformId; label: string }[] = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "zalo", label: "Zalo" },
  { id: "youtube", label: "YouTube" },
  { id: "threads", label: "Threads" },
];

const MB = 1024 * 1024;

export const SOCIAL_PRESETS: SocialPreset[] = [
  /* ── Facebook ─────────────────────────────────────────────────────────── */
  {
    id: "fb-anh-le",
    platform: "facebook",
    label: "Ảnh/album thường — giữ nguyên tỉ lệ, cạnh dài 2048",
    w: 2048,
    h: 2048,
    fit: "contain",
    format: "image/jpeg",
    quality: 0.88,
    maxBytes: Math.round(1.1 * MB),
    note: "Khổ nét nhất cho ảnh chụp: Facebook lưu ảnh chất lượng cao ở bề rộng tối đa 2048px, gửi đúng cỡ này thì không bị thu nhỏ lần nữa. Không cắt ảnh.",
  },
  {
    id: "fb-feed-vuong",
    platform: "facebook",
    label: "Bài feed vuông 1:1 — 2048×2048",
    w: 2048,
    h: 2048,
    fit: "cover",
    format: "image/jpeg",
    quality: 0.88,
    maxBytes: Math.round(1.1 * MB),
    note: "Khổ vuông chiếm nhiều diện tích trên điện thoại. Ảnh sẽ được cắt giữa cho đúng tỉ lệ 1:1.",
  },
  {
    id: "fb-feed-doc",
    platform: "facebook",
    label: "Bài feed dọc 4:5 — 1638×2048",
    w: 1638,
    h: 2048,
    fit: "cover",
    format: "image/jpeg",
    quality: 0.88,
    maxBytes: MB,
    note: "Khổ dọc cao nhất Facebook còn hiển thị đủ, không bị cắt cụt khi cuộn feed.",
  },
  {
    id: "fb-feed-ngang",
    platform: "facebook",
    label: "Bài feed ngang 1.91:1 — 2048×1072",
    w: 2048,
    h: 1072,
    fit: "cover",
    format: "image/jpeg",
    quality: 0.88,
    maxBytes: MB,
    note: "Khổ ngang chuẩn của Facebook, cũng là khổ ảnh xem trước khi chia sẻ link.",
  },
  {
    id: "fb-story",
    platform: "facebook",
    label: "Story / Reels 9:16 — 1080×1920",
    w: 1080,
    h: 1920,
    fit: "cover",
    format: "image/jpeg",
    quality: 0.86,
    maxBytes: Math.round(0.8 * MB),
    note: "Đầy màn hình điện thoại. Chừa khoảng 250px trên và 350px dưới cho nút và chú thích của Facebook.",
  },
  {
    id: "fb-cover",
    platform: "facebook",
    label: "Ảnh bìa trang / cá nhân — 1640×624",
    w: 1640,
    h: 624,
    fit: "cover",
    format: "image/jpeg",
    quality: 0.9,
    maxBytes: Math.round(0.9 * MB),
    note: "Gấp đôi cỡ hiển thị (820×312) để không rỗ trên màn hình retina. Điện thoại chỉ thấy phần giữa, đừng để chữ sát mép.",
  },
  {
    id: "fb-avatar",
    platform: "facebook",
    label: "Ảnh đại diện — 1080×1080",
    w: 1080,
    h: 1080,
    fit: "cover",
    format: "image/jpeg",
    quality: 0.9,
    maxBytes: Math.round(0.6 * MB),
    note: "Facebook cắt tròn phần giữa, để mặt người vào chính giữa khung.",
  },
  {
    id: "fb-link",
    platform: "facebook",
    label: "Ảnh xem trước khi chia sẻ link — 1200×630",
    w: 1200,
    h: 630,
    fit: "cover",
    format: "image/jpeg",
    quality: 0.88,
    maxBytes: Math.round(0.6 * MB),
    note: "Khổ ảnh Facebook lấy từ website (thẻ og:image) khi có người dán link.",
  },

  /* ── Instagram ────────────────────────────────────────────────────────── */
  {
    id: "ig-doc",
    platform: "instagram",
    label: "Bài đăng dọc 4:5 — 1080×1350",
    w: 1080,
    h: 1350,
    fit: "cover",
    format: "image/jpeg",
    quality: 0.88,
    maxBytes: Math.round(0.9 * MB),
    note: "Khổ Instagram hiển thị lớn nhất trong feed. Instagram luôn hạ về bề rộng 1080px, gửi đúng 1080 là hết bị nén hai lần.",
  },
  {
    id: "ig-vuong",
    platform: "instagram",
    label: "Bài đăng vuông 1:1 — 1080×1080",
    w: 1080,
    h: 1080,
    fit: "cover",
    format: "image/jpeg",
    quality: 0.88,
    maxBytes: Math.round(0.8 * MB),
    note: "Khổ vuông kinh điển, an toàn cho ảnh ghép nhiều tấm.",
  },
  {
    id: "ig-ngang",
    platform: "instagram",
    label: "Bài đăng ngang 1.91:1 — 1080×566",
    w: 1080,
    h: 566,
    fit: "cover",
    format: "image/jpeg",
    quality: 0.88,
    maxBytes: Math.round(0.6 * MB),
    note: "Khổ ngang tối đa Instagram nhận, ảnh ngang hơn nữa sẽ bị cắt.",
  },
  {
    id: "ig-story",
    platform: "instagram",
    label: "Story / Reels 9:16 — 1080×1920",
    w: 1080,
    h: 1920,
    fit: "cover",
    format: "image/jpeg",
    quality: 0.86,
    maxBytes: Math.round(0.8 * MB),
    note: "Chừa vùng an toàn 250px trên / 350px dưới cho tên tài khoản và ô trả lời.",
  },

  /* ── TikTok ───────────────────────────────────────────────────────────── */
  {
    id: "tt-doc",
    platform: "tiktok",
    label: "Bài ảnh / ảnh bìa video 9:16 — 1080×1920",
    w: 1080,
    h: 1920,
    fit: "cover",
    format: "image/jpeg",
    quality: 0.86,
    maxBytes: Math.round(0.9 * MB),
    note: "Khổ dọc đầy màn hình của TikTok. Chừa mép phải và mép dưới cho các nút của app.",
  },
  {
    id: "tt-vuong",
    platform: "tiktok",
    label: "Bài ảnh vuông 1:1 — 1080×1080",
    w: 1080,
    h: 1080,
    fit: "cover",
    format: "image/jpeg",
    quality: 0.86,
    maxBytes: Math.round(0.8 * MB),
    note: "Dùng cho bài đăng nhiều ảnh khi muốn khung vuông đều nhau.",
  },

  /* ── Zalo ─────────────────────────────────────────────────────────────── */
  {
    id: "zalo-nhat-ky",
    platform: "zalo",
    label: "Nhật ký Zalo — giữ tỉ lệ, cạnh dài 1080",
    w: 1080,
    h: 1080,
    fit: "contain",
    format: "image/jpeg",
    quality: 0.86,
    maxBytes: Math.round(0.7 * MB),
    note: "Zalo nén khá mạnh; hạ sẵn về 1080px và dưới ~700KB thì Zalo gần như không nén thêm.",
  },
  {
    id: "zalo-tin-nhan",
    platform: "zalo",
    label: "Gửi qua tin nhắn — giữ tỉ lệ, cạnh dài 1600",
    w: 1600,
    h: 1600,
    fit: "contain",
    format: "image/jpeg",
    quality: 0.88,
    maxBytes: Math.round(0.9 * MB),
    note: "Gửi ảnh xem trước cho khách: nét hơn ảnh nhật ký, vẫn nhẹ để khách tải nhanh trên 4G.",
  },
  {
    id: "zalo-oa",
    platform: "zalo",
    label: "Ảnh bìa bài viết Zalo OA — 1200×630",
    w: 1200,
    h: 630,
    fit: "cover",
    format: "image/jpeg",
    quality: 0.88,
    maxBytes: Math.round(0.6 * MB),
    note: "Khổ ảnh đại diện bài viết / tin nhắn dạng thẻ của Zalo OA.",
  },

  /* ── YouTube ──────────────────────────────────────────────────────────── */
  {
    id: "yt-thumb",
    platform: "youtube",
    label: "Ảnh đại diện video (thumbnail) — 1280×720",
    w: 1280,
    h: 720,
    fit: "cover",
    format: "image/jpeg",
    quality: 0.9,
    maxBytes: 2 * MB,
    note: "YouTube yêu cầu 16:9, tối thiểu 1280×720 và không quá 2MB.",
  },
  {
    id: "yt-banner",
    platform: "youtube",
    label: "Ảnh bìa kênh — 2048×1152",
    w: 2048,
    h: 1152,
    fit: "cover",
    format: "image/jpeg",
    quality: 0.9,
    maxBytes: 4 * MB,
    note: "Chỉ vùng giữa 1235×338 luôn hiển thị trên mọi thiết bị — để logo và chữ trong vùng đó.",
  },

  /* ── Threads ──────────────────────────────────────────────────────────── */
  {
    id: "th-doc",
    platform: "threads",
    label: "Bài đăng dọc 4:5 — 1080×1350",
    w: 1080,
    h: 1350,
    fit: "cover",
    format: "image/jpeg",
    quality: 0.88,
    maxBytes: Math.round(0.9 * MB),
    note: "Threads dùng chung hạ tầng ảnh với Instagram: bề rộng 1080px là chuẩn.",
  },
];

export function presetsFor(platform: PlatformId): SocialPreset[] {
  return SOCIAL_PRESETS.filter((p) => p.platform === platform);
}

export function findPreset(id: string): SocialPreset {
  return SOCIAL_PRESETS.find((p) => p.id === id) ?? SOCIAL_PRESETS[0];
}

/** Các tỉ lệ khung quen mặt — dùng để in nhãn dễ đọc thay vì số thập phân. */
const COMMON_RATIOS: { r: number; label: string }[] = [
  { r: 1, label: "1:1" },
  { r: 4 / 5, label: "4:5" },
  { r: 5 / 4, label: "5:4" },
  { r: 2 / 3, label: "2:3" },
  { r: 3 / 2, label: "3:2" },
  { r: 3 / 4, label: "3:4" },
  { r: 4 / 3, label: "4:3" },
  { r: 9 / 16, label: "9:16" },
  { r: 16 / 9, label: "16:9" },
  { r: 1.91, label: "1.91:1" },
  { r: 1 / 1.91, label: "1:1.91" },
  { r: 2, label: "2:1" },
  { r: 0.5, label: "1:2" },
];

/** Nhãn tỉ lệ khung đọc được: "4:5", "9:16", "1.91:1", "2.63:1"… */
export function ratioLabel(w: number, h: number): string {
  const r = w / h;
  for (const c of COMMON_RATIOS) {
    if (Math.abs(r - c.r) / c.r < 0.015) return c.label;
  }
  return r >= 1 ? `${r.toFixed(2)}:1` : `1:${(1 / r).toFixed(2)}`;
}
