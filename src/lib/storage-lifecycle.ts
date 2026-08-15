/**
 * Vòng đời lưu trữ ảnh gốc trên Google Drive.
 *
 * Studio giao ảnh xong nhưng ảnh GỐC vẫn nằm trên Drive mãi mãi, và Drive đầy là
 * tiền thật. Ở đây mỗi album giao khách mang một `storage_until` — ngày studio
 * dự định dọn. Hệ thống KHÔNG tự xoá gì cả: nó chỉ nhắc trước, còn xoá hay gia
 * hạn là quyết định của studio. Tự xoá ảnh cưới của khách là loại lỗi không sửa
 * lại được.
 */

/** Số ngày trước hạn thì bắt đầu nhắc studio. */
export const STORAGE_WARN_DAYS = 30;

/** Các mốc gia hạn nhanh hiện trên nút bấm (tháng). */
export const STORAGE_EXTEND_CHOICES = [3, 6, 12] as const;

/**
 * Hạn lưu trữ tính từ mốc giao khách + chính sách của studio.
 * `months <= 0` nghĩa là studio giữ vô hạn → trả null (không đặt hạn).
 */
export function storageUntil(deliveredAt: string | Date, months: number): string | null {
  if (!months || months <= 0) return null;
  const d = new Date(deliveredAt);
  if (Number.isNaN(d.getTime())) return null;
  // Cộng tháng theo lịch, kẹp về ngày cuối tháng khi ngày gốc không tồn tại ở
  // tháng đích (31/8 + 6 tháng → 28/2), tránh nhảy sang tháng sau.
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

/** Số ngày còn lại tới hạn (âm = đã quá hạn). null khi không đặt hạn. */
export function daysLeft(storageUntilDate: string | null, today = new Date()): number | null {
  if (!storageUntilDate) return null;
  const end = new Date(`${storageUntilDate}T00:00:00Z`).getTime();
  // So sánh theo NGÀY ở giờ VN: cron chạy lúc 7h sáng VN, nếu so bằng mốc UTC
  // thì album hết hạn "hôm nay" lại bị tính là còn 1 ngày.
  const nowVN = new Date(today.getTime() + 7 * 3600 * 1000);
  const startOfToday = Date.UTC(nowVN.getUTCFullYear(), nowVN.getUTCMonth(), nowVN.getUTCDate());
  return Math.round((end - startOfToday) / (24 * 3600 * 1000));
}

export type StorageState = "none" | "ok" | "warn" | "expired";

/** Trạng thái để tô màu nhãn: chưa đặt hạn · còn dài · sắp hết · đã quá hạn. */
export function storageState(storageUntilDate: string | null, today = new Date()): StorageState {
  const n = daysLeft(storageUntilDate, today);
  if (n === null) return "none";
  if (n < 0) return "expired";
  return n <= STORAGE_WARN_DAYS ? "warn" : "ok";
}

/** Nhãn tiếng Việt gọn cho thẻ/hàng danh sách. */
export function storageLabel(storageUntilDate: string | null, today = new Date()): string {
  const n = daysLeft(storageUntilDate, today);
  if (n === null) return "Giữ ảnh gốc vô hạn";
  if (n < 0) return `Quá hạn lưu trữ ${Math.abs(n)} ngày`;
  if (n === 0) return "Hết hạn lưu trữ hôm nay";
  return `Còn ${n} ngày lưu trữ ảnh gốc`;
}
