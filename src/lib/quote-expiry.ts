/**
 * Hạn hiệu lực của báo giá.
 *
 * Cột `studio_quotes.expires_at` đã có trong schema từ đầu nhưng chưa từng được
 * ghi hay đọc ở đâu — báo giá gửi đi là có hiệu lực vĩnh viễn. Bảng giá studio
 * đổi theo mùa cưới, nên khách hoàn toàn có thể quay lại sau nửa năm và đòi
 * đúng giá cũ. Ở đây là toàn bộ luật về hạn đó.
 *
 * Nguyên tắc: hạn CHỈ chặn khách bấm đồng ý trên cổng khách. Studio vẫn xem,
 * sửa và gia hạn được báo giá quá hạn — hết hạn là cái cớ để gọi lại khách,
 * không phải cái khoá vứt bỏ dữ liệu.
 */

/** Trạng thái báo giá còn "sống" — chỉ những trạng thái này mới xét hạn. */
export const OPEN_QUOTE_STATUSES = ["sent", "viewed", "adjust_requested"] as const;

/** Nhắc khách trước khi hết hạn bao nhiêu ngày. */
export const QUOTE_NUDGE_DAYS = 3;

/** Mốc hết hạn = bây giờ + N ngày. `days <= 0` → null (không đặt hạn). */
export function quoteExpiryFrom(days: number, from: Date = new Date()): string | null {
  if (!days || days <= 0) return null;
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + days);
  // Hết hạn vào CUỐI ngày đó theo giờ VN, không phải đúng giờ phút đã gửi:
  // khách nhận báo giá lúc 23h mà hạn 15 ngày thì ngày thứ 15 vẫn còn nguyên.
  d.setUTCHours(16, 59, 59, 999); // 23:59:59 giờ VN (UTC+7)
  return d.toISOString();
}

/** Đã quá hạn chưa? Không đặt hạn → luôn false. */
export function isQuoteExpired(expiresAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  return Number.isFinite(t) && t < now.getTime();
}

/**
 * Số ngày còn lại (âm = đã quá hạn). null khi không đặt hạn.
 *
 * Đếm theo NGÀY LỊCH giờ VN, không lấy hiệu hai mốc thời gian rồi làm tròn:
 * hạn luôn rơi vào cuối ngày, nên trừ thẳng sẽ ra 15,04 ngày → làm tròn lên
 * thành 16 và báo giá "15 ngày" hiện thành "còn 16 ngày" ngay lúc vừa gửi.
 */
export function quoteDaysLeft(expiresAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  const t = new Date(expiresAt).getTime();
  if (!Number.isFinite(t)) return null;
  const vnDay = (ms: number) => {
    const d = new Date(ms + 7 * 3600 * 1000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  };
  return Math.round((vnDay(t) - vnDay(now.getTime())) / (24 * 3600 * 1000));
}

/** Nhãn tiếng Việt gọn cho thẻ báo giá và cổng khách. */
export function quoteExpiryLabel(expiresAt: string | null | undefined, now: Date = new Date()): string {
  const n = quoteDaysLeft(expiresAt, now);
  if (n === null) return "Không đặt hạn hiệu lực";
  if (n < 0) return `Đã hết hiệu lực ${Math.abs(n)} ngày`;
  if (n === 0) return "Hết hiệu lực hôm nay";
  return `Còn hiệu lực ${n} ngày`;
}
