import { PLAN_LABEL, PLAN_FEATURES, type Plan } from "@/lib/plans";

// ── Editable content of the upgrade page ────────────────────────────────────
// Stored in site_settings.upgrade_content (jsonb), edited by admins. Anything
// left empty falls back to the defaults below.

/** One comparison-table row: a section header, or a feature with one cell per
 * plan. Cell convention: "✓" = included, "✗" or "" = not included, anything else
 * = text.
 *
 * `photographer_plus` được THÊM SAU — bản cũ chỉ có 4 cột nên gói Photographer
 * Plus tuy vẫn bán (129k/tháng) lại không xuất hiện trong bảng so sánh. Dòng đã
 * lưu trong DB không có khoá này; xem `mergeUpgradeContent` để biết cách bù. */
export type CompareRow =
  | { section: string }
  | { label: string; free: string; basic: string; photographer: string; photographer_plus: string; studio: string };

export type PlanContent = { label: string; features: string[]; promo?: string };

export type UpgradeContent = {
  headline: string;
  subheadline: string;
  plans: Record<Plan, PlanContent>;
  compare: CompareRow[];
  comingSoon: string[];
};

const Y = "✓";
const N = "✗";

export const UPGRADE_DEFAULTS: UpgradeContent = {
  headline: "Nâng cấp gói",
  subheadline:
    "Mở khoá thêm album, cho khách tải ảnh & ghi chú, watermark logo, nén/lọc ảnh không giới hạn.",
  plans: {
    free: { label: PLAN_LABEL.free, features: PLAN_FEATURES.free },
    basic: { label: PLAN_LABEL.basic, features: PLAN_FEATURES.basic },
    photographer: { label: PLAN_LABEL.photographer, features: PLAN_FEATURES.photographer },
    photographer_plus: {
      label: PLAN_LABEL.photographer_plus,
      features: PLAN_FEATURES.photographer_plus,
      promo: "Có tên miền riêng + quản lý hợp đồng — chỉ 129k/tháng.",
    },
    studio: {
      label: PLAN_LABEL.studio,
      features: PLAN_FEATURES.studio,
      promo: "Đăng ký trong thời gian này: ưu đãi 50%/năm vĩnh viễn + nhận mọi tính năng nâng cấp sau này.",
    },
  },
  // Mỗi dòng đối chiếu trực tiếp với quyền trong src/lib/plans.ts (PLAN_LIMITS,
  // planAllows*) và `minTier` của các mục trong src/lib/studio-nav.ts. Sửa quyền
  // ở đó thì phải sửa dòng tương ứng ở đây.
  compare: [
    { section: "Album & ảnh" },
    { label: "Album / tháng", free: "5", basic: "15", photographer: "50", photographer_plus: "100", studio: "∞" },
    { label: "Khách chọn ảnh (QR + link)", free: Y, basic: Y, photographer: Y, photographer_plus: Y, studio: Y },
    { label: "Album giao khách", free: N, basic: Y, photographer: Y, photographer_plus: Y, studio: Y },
    { label: "Cho khách tải ảnh bản gốc", free: N, basic: Y, photographer: Y, photographer_plus: Y, studio: Y },
    { label: "Cho khách ghi chú trên ảnh", free: N, basic: Y, photographer: Y, photographer_plus: Y, studio: Y },
    { label: "Gallery công khai trên trang chủ", free: N, basic: N, photographer: Y, photographer_plus: Y, studio: Y },
    { label: "Watermark bảo vệ ảnh trong album", free: N, basic: N, photographer: N, photographer_plus: Y, studio: Y },

    { section: "Công cụ ảnh" },
    { label: "Lọc ảnh khách chọn", free: "10 / tháng", basic: "∞", photographer: "∞", photographer_plus: "∞", studio: "∞" },
    { label: "Nén ảnh (máy + link Drive)", free: "5 / tháng", basic: "∞", photographer: "∞", photographer_plus: "∞", studio: "∞" },
    { label: "Nén qua Google Drive (Picker)", free: "1 lần", basic: "5 / tháng", photographer: "15 / tháng", photographer_plus: "30 / tháng", studio: "∞" },
    { label: "Watermark chữ khi nén", free: Y, basic: Y, photographer: Y, photographer_plus: Y, studio: Y },
    { label: "Watermark logo + nén kèm", free: N, basic: Y, photographer: Y, photographer_plus: Y, studio: Y },

    { section: "Website" },
    { label: "Trình tạo website portfolio", free: "Xem trước", basic: "Xem trước", photographer: Y, photographer_plus: Y, studio: Y },
    { label: "Xuất bản website", free: N, basic: N, photographer: Y, photographer_plus: Y, studio: Y },
    { label: "Chatbox trả lời khách", free: N, basic: N, photographer: Y, photographer_plus: Y, studio: Y },
    { label: "Tên miền riêng (vd studio.com)", free: N, basic: N, photographer: N, photographer_plus: Y, studio: Y },

    { section: "Bán hàng & hợp đồng" },
    { label: "Nhận đặt lịch online (link + QR)", free: N, basic: N, photographer: Y, photographer_plus: Y, studio: Y },
    { label: "Yêu cầu mới từ website & chatbox", free: N, basic: N, photographer: Y, photographer_plus: Y, studio: Y },
    { label: "Danh bạ khách hàng", free: N, basic: N, photographer: Y, photographer_plus: Y, studio: Y },
    { label: "Gói & bảng giá dịch vụ", free: N, basic: N, photographer: Y, photographer_plus: Y, studio: Y },
    { label: "Dịch vụ & điều khoản", free: N, basic: N, photographer: Y, photographer_plus: Y, studio: Y },
    { label: "Báo giá hạng mục gửi khách", free: N, basic: N, photographer: N, photographer_plus: Y, studio: Y },
    { label: "Hợp đồng — khách ký online", free: N, basic: N, photographer: N, photographer_plus: Y, studio: Y },
    { label: "Form thông tin buổi chụp", free: N, basic: N, photographer: N, photographer_plus: Y, studio: Y },
    { label: "Phòng váy (kho trang phục & cho thuê)", free: N, basic: N, photographer: N, photographer_plus: N, studio: Y },

    { section: "Vận hành studio" },
    { label: "Lịch làm việc + nhắc lịch Zalo", free: N, basic: N, photographer: Y, photographer_plus: Y, studio: Y },
    { label: "Đồng bộ Google Calendar", free: N, basic: N, photographer: Y, photographer_plus: Y, studio: Y },
    { label: "Ứng dụng máy tính MStudo Desktop", free: N, basic: N, photographer: N, photographer_plus: Y, studio: Y },
    { label: "Bảng công việc (kanban)", free: N, basic: N, photographer: N, photographer_plus: N, studio: Y },
    { label: "Xử lý ảnh / video / in ấn theo tiến độ", free: N, basic: N, photographer: N, photographer_plus: N, studio: Y },
    { label: "Thiết bị & lịch mượn", free: N, basic: N, photographer: N, photographer_plus: N, studio: Y },
    { label: "Mẫu tin nhắn gửi khách", free: N, basic: N, photographer: N, photographer_plus: N, studio: Y },

    { section: "Tài chính & đội ngũ" },
    { label: "Thu chi · công nợ · báo cáo doanh thu", free: N, basic: N, photographer: N, photographer_plus: N, studio: Y },
    { label: "Đối soát tiền công", free: N, basic: N, photographer: N, photographer_plus: N, studio: Y },
    { label: "Quản lý đội ngũ & xếp hạng", free: N, basic: N, photographer: N, photographer_plus: N, studio: Y },

    { section: "Quà tặng khách" },
    { label: "Thiệp cưới online", free: N, basic: N, photographer: N, photographer_plus: N, studio: Y },
    { label: "Love Story · Slide chiếu tiệc", free: N, basic: N, photographer: N, photographer_plus: N, studio: Y },
    { label: "Thiết kế album (dàn trang in)", free: N, basic: N, photographer: N, photographer_plus: N, studio: Y },

    { section: "Hỗ trợ & nâng cấp" },
    // Số ngày lấy từ trialDaysFor(): basic/photographer/photographer_plus 30
    // ngày, studio 7 ngày. Free không có (đây LÀ gói free).
    { label: "Dùng thử miễn phí", free: "—", basic: "30 ngày", photographer: "30 ngày", photographer_plus: "30 ngày", studio: "7 ngày" },
    { label: "Hỗ trợ riêng qua Zalo / email", free: N, basic: N, photographer: N, photographer_plus: N, studio: Y },
    { label: "Nhận miễn phí tính năng nâng cấp", free: N, basic: N, photographer: N, photographer_plus: N, studio: Y },
  ],
  comingSoon: [
    "Cổng thanh toán & hoá đơn tự động",
    "Upload ảnh trực tiếp lên website portfolio",
    "App di động cho studio (iOS & Android)",
    "Đồng bộ Google Drive tự động cho ảnh/video hợp đồng",
  ],
};

const PLAN_KEYS: Plan[] = ["free", "basic", "photographer", "photographer_plus", "studio"];

/**
 * Chuẩn hoá một dòng so sánh đã lưu trong DB. Bản cũ chỉ có 4 cột, nên dòng cũ
 * KHÔNG có `photographer_plus` — mà trang nâng cấp gọi `.trim()` trên từng ô, để
 * `undefined` là trang vỡ. Bù bằng giá trị cột Photographer: Plus là gói bao trùm
 * Photographer, nên đó là phỏng đoán đúng hơn "không có", và admin sửa lại được
 * trong Cấu hình mstudo.
 */
function normalizeRow(row: unknown): CompareRow | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.section === "string") return { section: r.section };
  if (typeof r.label !== "string") return null;
  const cell = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
  const photographer = cell(r.photographer);
  return {
    label: r.label,
    free: cell(r.free),
    basic: cell(r.basic),
    photographer,
    photographer_plus: cell(r.photographer_plus, photographer),
    studio: cell(r.studio),
  };
}

/** Merge stored (partial) content over the defaults so the page always renders. */
export function mergeUpgradeContent(raw: unknown): UpgradeContent {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<UpgradeContent>;
  const plans = {} as Record<Plan, PlanContent>;
  for (const k of PLAN_KEYS) {
    const p = r.plans?.[k];
    plans[k] = {
      label: p?.label?.trim() || UPGRADE_DEFAULTS.plans[k].label,
      features: Array.isArray(p?.features) && p!.features.length ? p!.features.filter((f) => typeof f === "string") : UPGRADE_DEFAULTS.plans[k].features,
      // Respect an explicitly-saved promo (incl. cleared = ""); else fall back.
      promo: p && typeof p.promo === "string" ? (p.promo.trim() || undefined) : UPGRADE_DEFAULTS.plans[k].promo,
    };
  }
  const compare = Array.isArray(r.compare)
    ? r.compare.map(normalizeRow).filter((x): x is CompareRow => x !== null)
    : [];
  return {
    headline: r.headline?.trim() || UPGRADE_DEFAULTS.headline,
    subheadline: r.subheadline?.trim() || UPGRADE_DEFAULTS.subheadline,
    plans,
    compare: compare.length ? compare : UPGRADE_DEFAULTS.compare,
    comingSoon: Array.isArray(r.comingSoon) ? r.comingSoon.filter((s) => typeof s === "string") : UPGRADE_DEFAULTS.comingSoon,
  };
}
