/**
 * Subscription plans (temporary, manual upgrade — no payment gateway yet).
 * The `plan` column on profiles is the source of truth for the new monthly
 * quotas (compress, picker, filter). When an admin assigns a plan, the legacy
 * columns (monthly_album_limit, can_zip, can_notes, can_galleries,
 * can_watermark_pro) are synced from here so existing enforcement keeps working.
 */

export type Plan = "free" | "basic" | "photographer" | "photographer_plus" | "studio";

export interface PlanLimits {
  albumsPerMonth: number | null; // null = unlimited
  canZip: boolean;
  canNotes: boolean;
  canGalleries: boolean;
  watermarkPro: boolean; // image/logo watermark + compression in the watermark tab
  filterPerMonth: number | null; // null = unlimited
  compressPerMonth: number | null; // basic compress (local + Drive link)
  pickerLimit: number | null; // null = unlimited
  pickerWindow: "lifetime" | "month";
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    albumsPerMonth: 5,
    canZip: false,
    canNotes: false,
    canGalleries: false,
    watermarkPro: false,
    filterPerMonth: 10,
    compressPerMonth: 5,
    pickerLimit: 1,
    pickerWindow: "lifetime",
  },
  basic: {
    albumsPerMonth: 15,
    canZip: true,
    canNotes: true,
    canGalleries: false,
    watermarkPro: true,
    filterPerMonth: null,
    compressPerMonth: null,
    pickerLimit: 5,
    pickerWindow: "month",
  },
  photographer: {
    albumsPerMonth: 50,
    canZip: true,
    canNotes: true,
    canGalleries: true,
    watermarkPro: true,
    filterPerMonth: null,
    compressPerMonth: null,
    pickerLimit: 15,
    pickerWindow: "month",
  },
  photographer_plus: {
    albumsPerMonth: 100,
    canZip: true,
    canNotes: true,
    canGalleries: true,
    watermarkPro: true,
    filterPerMonth: null,
    compressPerMonth: null,
    pickerLimit: 30,
    pickerWindow: "month",
  },
  studio: {
    albumsPerMonth: null,
    canZip: true,
    canNotes: true,
    canGalleries: true,
    watermarkPro: true,
    filterPerMonth: null,
    compressPerMonth: null,
    pickerLimit: null,
    pickerWindow: "month",
  },
};

/** Admins are unlimited regardless of their stored plan. */
export const ADMIN_LIMITS: PlanLimits = PLAN_LIMITS.studio;

/**
 * Studio-module access level a plan unlocks:
 *   none    — no access to studio.mstudo.com
 *   booking — đặt lịch, bảng giá, lịch chụp, khách hàng (gói Photographer)
 *   full    — booking + hợp đồng, tài chính, đội ngũ (gói Studio / admin)
 */
// none    — no studio access
// booking — đặt lịch, bảng giá, khách hàng (Photographer)
// plus    — booking + báo giá & hợp đồng (Photographer Plus)
// full    — plus + tài chính, đội ngũ, sản xuất... (Studio / admin)
export type StudioTier = "none" | "booking" | "plus" | "full";

export const STUDIO_TIER_RANK: Record<StudioTier, number> = { none: 0, booking: 1, plus: 2, full: 3 };

export function studioTier(plan: Plan, isAdmin = false): StudioTier {
  if (isAdmin || plan === "studio") return "full";
  if (plan === "photographer_plus") return "plus";
  if (plan === "photographer") return "booking";
  return "none";
}

/** Tên miền riêng (custom domain): Photographer Plus & Studio (không có ở Photographer). */
export function planAllowsCustomDomain(plan: Plan, isAdmin = false): boolean {
  return isAdmin || plan === "photographer_plus" || plan === "studio";
}

/**
 * Watermark trên album của khách (chữ đè lên ảnh khi xem, và đóng vào ảnh khi
 * khách tải): CHỈ gói Studio.
 *
 * Đây là ràng buộc HẠ TẦNG chứ không chỉ là phân gói. Ảnh CÓ watermark bắt buộc
 * phải đi qua proxy của mình — canvas cần đọc pixel, mà Drive không gửi header
 * CORS — nên mỗi lượt tải ngốn băng thông Vercel. Ảnh KHÔNG watermark tải thẳng
 * từ Drive, tốn 0 byte.
 *
 * Sau khi bỏ ZIP kéo ảnh Drive, đây là đường CUỐI CÙNG còn ép ảnh đi vòng qua
 * máy chủ, nên nó thu về đúng một gói cao nhất — nơi chi phí đó có chỗ bù.
 *
 * KHÁC với `watermarkPro` ở PlanLimits — cái đó là watermark logo trong công cụ
 * NÉN ảnh, chạy hoàn toàn trên máy người dùng nên không tốn băng thông, và vẫn
 * mở từ gói Basic.
 */
export function planAllowsWatermark(plan: Plan, isAdmin = false): boolean {
  return isAdmin || plan === "studio";
}

export function limitsFor(plan: Plan, isAdmin: boolean): PlanLimits {
  return isAdmin ? ADMIN_LIMITS : PLAN_LIMITS[plan];
}

/**
 * TÌM ẢNH THEO KHUÔN MẶT — chỉ Photographer Plus và Studio.
 *
 * Đây là tính năng ĐẮT NHẤT của hệ thống, và đắt theo nghĩa tiền thật: mỗi ảnh
 * phải tải thumbnail từ Drive rồi chạy nhận diện trên CPU máy chủ (~0,75 giây
 * một tấm). Một album 800 ảnh ngốn khoảng 11 phút CPU, một lần cho mỗi ảnh.
 * Mở cho gói thấp thì chi phí đó không có chỗ bù — cùng lý do đã giới hạn
 * `planAllowsWatermark`.
 *
 * Chốt này phải kiểm ở CẢ HAI phía và không nơi nào được tin nơi nào:
 *   • Bộ quét (cron) — đừng tiêu CPU cho album của gói không được dùng.
 *   • Trang khách — đừng hiện ô tìm mặt của album không đủ gói.
 */
export function planAllowsFaceSearch(plan: Plan, isAdmin = false): boolean {
  return isAdmin || plan === "studio" || plan === "photographer_plus";
}

/** Album delivery phase (giao khách): every paid plan except free. */
export function planAllowsDelivery(plan: Plan, isAdmin = false): boolean {
  return isAdmin || plan !== "free";
}

/** Publishing a delivery album to the public homepage (no-password gallery):
 * Photographer & Studio only (reuses the canGalleries capability). */
export function planAllowsPublicGallery(plan: Plan, isAdmin = false): boolean {
  return isAdmin || PLAN_LIMITS[plan].canGalleries;
}

/** A paid plan whose expiry has passed is treated as 'free'. */
export function effectivePlan(plan: Plan | null | undefined, expiresAt: string | null | undefined): Plan {
  const p = (plan ?? "free") as Plan;
  if (p !== "free" && expiresAt && new Date(expiresAt).getTime() < Date.now()) return "free";
  return p;
}

/**
 * Số ngày TẶNG THÊM khi mua theo NĂM — khuyến mãi "mua gói 1 năm tặng 30 ngày",
 * áp dụng cho MỌI gói trả phí (basic → studio).
 */
export const ANNUAL_BONUS_DAYS = 30;

/**
 * Mốc hết hạn khi kích hoạt một gói trả phí theo chu kỳ, tính từ `from` (mặc
 * định là hiện tại):
 *   - "year"  → +1 năm và TẶNG THÊM 30 ngày (mọi gói).
 *   - "month" → +1 tháng, kẹp về ngày cuối tháng kế khi ngày gốc không tồn tại
 *     ở tháng đó (31/1 → 28/2), tránh "nhảy" qua tháng ngắn.
 * Điểm TẬP TRUNG cho mọi nơi đặt `plan_expires_at` (admin cấp gói, tự kích hoạt
 * bằng mã, panel quản trị) để luật khuyến mãi luôn nhất quán.
 */
export function planExpiry(cycle: "month" | "year", from: Date = new Date()): string {
  const d = new Date(from.getTime());
  if (cycle === "year") {
    d.setFullYear(d.getFullYear() + 1);
    d.setDate(d.getDate() + ANNUAL_BONUS_DAYS);
  } else {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  }
  return d.toISOString();
}

/**
 * Số ngày dùng thử miễn phí theo gói: Basic & Photographer 30 ngày (1 tháng),
 * Studio 7 ngày. Free không có dùng thử.
 */
export function trialDaysFor(plan: Plan): number {
  if (plan === "studio") return 7;
  if (plan === "basic" || plan === "photographer" || plan === "photographer_plus") return 30;
  return 0;
}

/** Columns synced onto profiles when a plan is assigned (legacy enforcement). */
export function planProfilePatch(plan: Plan) {
  const l = PLAN_LIMITS[plan];
  return {
    plan,
    monthly_album_limit: l.albumsPerMonth,
    can_zip: l.canZip,
    can_notes: l.canNotes,
    can_galleries: l.canGalleries,
    can_watermark_pro: l.watermarkPro,
  };
}

export interface PlanPricing {
  month: number; // VND
  year: number; // VND
}

export const PLAN_PRICING: Record<"basic" | "photographer" | "photographer_plus" | "studio", PlanPricing> = {
  basic: { month: 50_000, year: 500_000 },
  photographer: { month: 100_000, year: 999_000 },
  photographer_plus: { month: 129_000, year: 1_249_000 },
  studio: { month: 300_000, year: 3_000_000 },
};

export const PLAN_LABEL: Record<Plan, string> = {
  free: "Miễn phí",
  basic: "Basic",
  photographer: "Photographer",
  photographer_plus: "Photographer Plus",
  studio: "Studio",
};

export function formatVnd(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}tr`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${n}đ`;
}

/**
 * Gạch đầu dòng tính năng của từng gói (trang nâng cấp).
 *
 * MỌI dòng ở đây phải khớp với quyền THẬT trong file này và với `minTier` của
 * các mục trong `src/lib/studio-nav.ts` — người mua đọc đúng những dòng này rồi
 * trả tiền, nên sai một dòng là bán sai hàng. Bảng đối chiếu:
 *   photographer → tier "booking" · photographer_plus → "plus" · studio → "full"
 *
 * KHÔNG nhắc "dùng thử N ngày" ở đây: mỗi thẻ gói đã có sẵn nút dùng thử tự
 * điền số ngày từ `trialDaysFor()`, viết tay lần nữa là hai chỗ lệch nhau.
 */
export const PLAN_FEATURES: Record<Plan, string[]> = {
  free: [
    "5 album / tháng",
    "Khách chọn ảnh & gửi lại studio (QR + link)",
    "Album giao khách: chưa có",
    "Cho khách tải ảnh: chưa có",
    "Ghi chú trên ảnh: chưa có",
    "Watermark khi nén: chỉ chữ (không logo, không nén kèm)",
    "Lọc ảnh khách chọn: 10 lần / tháng",
    "Nén ảnh (máy + link Drive): 5 lần / tháng",
    "Nén qua Google Drive (Picker): 1 lần dùng thử",
    "Xem trước trình tạo website (không xuất bản)",
    "Chưa vào được khu quản lý studio",
  ],
  basic: [
    "15 album / tháng",
    "Album giao khách",
    "Cho khách tải ảnh — tải thẳng từ Google Drive (bản gốc, không giới hạn)",
    "Cho khách ghi chú trên ảnh",
    "Watermark khi nén đầy đủ (logo + nén kèm)",
    "Lọc ảnh khách chọn: không giới hạn",
    "Nén ảnh (máy + link Drive): không giới hạn",
    "Nén qua Google Drive (Picker): 5 lần / tháng",
    "Xem trước trình tạo website (không xuất bản)",
    "Chưa vào được khu quản lý studio",
  ],
  photographer: [
    "50 album / tháng · Picker Drive 15 lần / tháng",
    "Tất cả tính năng gói Basic",
    "Khu quản lý studio (studio.mstudo.com)",
    "Nhận đặt lịch online — link + QR chia sẻ cho khách",
    "Yêu cầu mới từ website & chatbox",
    "Lịch làm việc + nhắc lịch qua Zalo",
    "Danh bạ khách hàng · gói & bảng giá · dịch vụ và điều khoản",
    "Gallery công khai trên trang chủ mstudo",
    "Website portfolio xuất bản được (tên miền mstudo)",
    "Đồng bộ Google Calendar",
  ],
  photographer_plus: [
    "100 album / tháng · Picker Drive 30 lần / tháng",
    "Tất cả tính năng gói Photographer",
    "Báo giá hạng mục chi tiết — khách tự chọn hạng mục tuỳ chọn",
    "Hợp đồng: tạo, gửi khách ký online, nhận yêu cầu chỉnh sửa",
    "Form thông tin buổi chụp gửi khách tự điền",
    "Website riêng dùng TÊN MIỀN RIÊNG (vd studio.com)",
    "Ứng dụng máy tính MStudo Desktop",
  ],
  studio: [
    "Album không giới hạn · Picker Drive không giới hạn",
    "Tất cả tính năng gói Photographer Plus",
    "Watermark bảo vệ ảnh trong album — chỉ gói Studio",
    "Tài chính — thu chi, công nợ, báo cáo doanh thu",
    "Đối soát tiền công · quản lý đội ngũ & xếp hạng",
    "Bảng công việc và tiến độ xử lý ảnh / video / in ấn",
    "Phòng váy — kho trang phục và đơn cho thuê",
    "Thiết bị & lịch mượn",
    "Thiệp cưới online · Love Story · Slide chiếu tiệc",
    "Thiết kế album — dàn trang album in",
    "Mẫu tin nhắn gửi khách soạn sẵn",
    "Hỗ trợ riêng · nhận miễn phí mọi tính năng nâng cấp sau này",
  ],
};
