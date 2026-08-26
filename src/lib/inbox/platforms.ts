/* ═══════════════════════════════════════════════════════════════════════════
   CÁC KÊNH CỦA HỘP THƯ HỢP NHẤT — nguồn duy nhất cho nhãn, màu, và luật gửi.

   File này KHÔNG import gì (kể cả server-only) để chạy được cả ở trình duyệt,
   ở máy chủ và trực tiếp trong Node khi kiểm thử: `npm run test:inbox`.

   Mỗi kênh có một "cửa sổ trả lời" khác nhau — đây là thứ hay làm studio ngã
   ngửa: soạn xong câu tư vấn, bấm gửi, nền tảng từ chối vì khách nhắn từ hôm
   kia. Nên luật đó phải nằm ở đây và giao diện phải nói trước, chứ không để
   người dùng biết qua một thông báo lỗi đỏ sau khi đã gõ xong.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Platform = "website" | "zalo_oa" | "zalo_personal" | "facebook" | "instagram";

export const PLATFORMS: readonly Platform[] = [
  "website",
  "zalo_oa",
  "zalo_personal",
  "facebook",
  "instagram",
];

export interface PlatformInfo {
  key: Platform;
  label: string;
  /** Câu một dòng cho màn kết nối — nói studio phải làm gì để có kênh này. */
  hint: string;
  /** Màu nhận diện của nền tảng (chấm tròn trên danh sách hội thoại). */
  color: string;
  /**
   * Cửa sổ được phép nhắn lại tính từ tin CUỐI CÙNG của khách, tính bằng giờ.
   * `null` = không giới hạn (kênh của chính mình: website, Zalo cá nhân).
   *
   *   • Facebook / Instagram: 24 giờ theo chính sách Messenger Platform.
   *   • Zalo OA: tin CS gửi trong 48 giờ kể từ tương tác cuối của người dùng.
   */
  replyWindowHours: number | null;
  /** Kênh này nhận tin về bằng cách nào (hiển thị ở màn kết nối). */
  ingest: "webhook" | "worker" | "internal";
}

export const PLATFORM_INFO: Record<Platform, PlatformInfo> = {
  website: {
    key: "website",
    label: "Chatbox website",
    hint: "Widget chat sẵn có trên website studio — không cần nối gì thêm.",
    color: "#6366f1",
    replyWindowHours: null,
    ingest: "internal",
  },
  zalo_oa: {
    key: "zalo_oa",
    label: "Zalo OA",
    hint: "Official Account đã duyệt. Khai webhook trong Zalo App rồi bấm nối ở đây.",
    color: "#0068ff",
    replyWindowHours: 48,
    ingest: "webhook",
  },
  zalo_personal: {
    key: "zalo_personal",
    label: "Zalo cá nhân",
    hint: "Tài khoản Zalo cá nhân đã đăng nhập QR. Cần chạy thêm tiến trình lắng nghe.",
    color: "#0068ff",
    replyWindowHours: null,
    ingest: "worker",
  },
  facebook: {
    key: "facebook",
    label: "Facebook Messenger",
    hint: "Trang Facebook của studio. Cần Page Access Token và webhook Meta.",
    color: "#0084ff",
    replyWindowHours: 24,
    ingest: "webhook",
  },
  instagram: {
    key: "instagram",
    label: "Instagram DM",
    hint: "Tài khoản Instagram doanh nghiệp đã liên kết trang Facebook.",
    color: "#e1306c",
    replyWindowHours: 24,
    ingest: "webhook",
  },
};

export function isPlatform(v: unknown): v is Platform {
  return typeof v === "string" && (PLATFORMS as readonly string[]).includes(v);
}

export function platformLabel(p: string | null | undefined): string {
  return isPlatform(p) ? PLATFORM_INFO[p].label : "Kênh khác";
}

export function platformColor(p: string | null | undefined): string {
  return isPlatform(p) ? PLATFORM_INFO[p].color : "#94a3b8";
}

/**
 * Còn được phép nhắn cho khách không?
 *
 * `lastInboundAt` = thời điểm tin CUỐI CÙNG của khách (ISO hoặc ms). Thiếu mốc
 * đó thì với kênh có cửa sổ ta trả về `false` — fail-closed: thà báo trước là
 * "hết hạn trả lời" còn hơn để nhân viên gõ xong mới biết nền tảng chặn.
 */
export function canReply(
  platform: string | null | undefined,
  lastInboundAt: string | number | null | undefined,
  now: number = Date.now()
): boolean {
  if (!isPlatform(platform)) return false;
  const hours = PLATFORM_INFO[platform].replyWindowHours;
  if (hours === null) return true;
  if (lastInboundAt === null || lastInboundAt === undefined || lastInboundAt === "") return false;
  const ts = typeof lastInboundAt === "number" ? lastInboundAt : Date.parse(lastInboundAt);
  if (!Number.isFinite(ts)) return false;
  return now - ts < hours * 3_600_000;
}

/** Câu giải thích khi hết cửa sổ — hiện ngay trên ô soạn tin, không phải toast. */
export function replyBlockedReason(platform: string | null | undefined): string {
  if (!isPlatform(platform)) return "Kênh này chưa hỗ trợ gửi tin.";
  const hours = PLATFORM_INFO[platform].replyWindowHours;
  if (hours === null) return "";
  return `${PLATFORM_INFO[platform].label} chỉ cho nhắn lại trong ${hours} giờ kể từ tin cuối của khách. Quá hạn thì gọi điện hoặc nhắn Zalo theo số của khách.`;
}

/**
 * Rút gọn nội dung tin cho dòng xem trước ở danh sách bên trái.
 * Tin chỉ có ảnh (body rỗng) vẫn phải hiện ra cái gì đó, nếu không danh sách
 * trông như hội thoại rỗng.
 */
export function previewText(body: string, attachmentCount = 0): string {
  const t = (body || "").replace(/\s+/g, " ").trim();
  if (t) return t.length > 120 ? `${t.slice(0, 119)}…` : t;
  if (attachmentCount > 0) return attachmentCount > 1 ? `📎 ${attachmentCount} tệp đính kèm` : "📎 Tệp đính kèm";
  return "(tin trống)";
}
