/**
 * Bảo trì khu QUẢN TRỊ (/dashboard).
 *
 * Phạm vi: chỉ chặn phần quản trị (webapp studio). Trang chủ mstudo.com,
 * website/portfolio của studio, album khách, thiệp, form, báo giá… và toàn bộ
 * API vẫn chạy bình thường — khách của studio không bị ảnh hưởng.
 *
 * Hết mốc `MAINTENANCE_UNTIL` là quản trị tự mở lại, KHÔNG cần deploy lại.
 * Muốn dừng bảo trì sớm: đặt `MAINTENANCE_UNTIL = null` rồi deploy.
 *
 * Tài khoản `role = "admin"` luôn vào được để còn xử lý trong lúc bảo trì.
 */

/**
 * Mốc kết thúc bảo trì, giờ UTC.
 * 2026-08-12 06:00 giờ Việt Nam (UTC+7) = 2026-08-11T23:00:00Z.
 * Đặt `null` để tắt hẳn chế độ bảo trì.
 */
export const MAINTENANCE_UNTIL: string | null = "2026-08-11T23:00:00.000Z";

/** Nhãn hiển thị cho người dùng (giờ Việt Nam). */
export const MAINTENANCE_UNTIL_LABEL = "6h00 sáng 12/08/2026";

/** Lý do bảo trì — hiện trên trang chặn. */
export const MAINTENANCE_REASON =
  "Hệ thống đang được nâng cấp và bảo trì định kỳ để chạy ổn định hơn.";

const untilMs = MAINTENANCE_UNTIL ? Date.parse(MAINTENANCE_UNTIL) : NaN;

/** Đang trong thời gian bảo trì? */
export function maintenanceActive(now: number = Date.now()): boolean {
  return Number.isFinite(untilMs) && now < untilMs;
}
