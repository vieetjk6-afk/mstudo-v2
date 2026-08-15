/**
 * Khách giới thiệu khách.
 *
 * Nhận diện người giới thiệu bằng SỐ ĐIỆN THOẠI, không phát mã riêng: khách cũ
 * nào cũng dùng được ngay từ hôm nay, studio không phải sinh và phát mã cho từng
 * người, và khách chỉ cần nhớ số của người quen — thứ họ vốn đã có trong danh bạ.
 *
 * Link chia sẻ chỉ là cách điền sẵn ô đó: /book/<token>?ref=<sđt>.
 */

/** Chỉ giữ chữ số — mọi phép so SĐT trong module này đều đi qua đây. */
export function digitsOnly(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

/**
 * SĐT Việt Nam hợp lệ để dùng làm mã giới thiệu: 9–11 chữ số.
 * Lỏng có chủ đích — số cũ 11 số và số nhập kèm mã vùng vẫn phải nhận.
 */
export function isUsablePhone(s: string | null | undefined): boolean {
  const d = digitsOnly(s);
  return d.length >= 9 && d.length <= 11;
}

/**
 * Hai SĐT có phải cùng một người không. So theo 9 chữ số CUỐI để "0901234567",
 * "+84901234567" và "84901234567" cùng khớp nhau.
 */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = digitsOnly(a);
  const y = digitsOnly(b);
  if (!x || !y) return false;
  return x.slice(-9) === y.slice(-9);
}

/** Link đặt lịch có sẵn mã giới thiệu, để khách cũ gửi thẳng cho bạn bè. */
export function referralBookingUrl(baseBookingUrl: string, referrerPhone: string): string {
  const d = digitsOnly(referrerPhone);
  if (!d) return baseBookingUrl;
  const sep = baseBookingUrl.includes("?") ? "&" : "?";
  return `${baseBookingUrl}${sep}ref=${encodeURIComponent(d)}`;
}

export type ReferralStatus = "pending" | "earned" | "granted" | "cancelled";

export const REFERRAL_STATUS_LABEL: Record<ReferralStatus, string> = {
  pending: "Chờ khách chốt",
  earned: "Đã chốt — nên tặng thưởng",
  granted: "Đã tặng thưởng",
  cancelled: "Không thành",
};

export const REFERRAL_STATUS_TONE: Record<ReferralStatus, "amber" | "green" | "neutral" | "red"> = {
  pending: "amber",
  earned: "green",
  granted: "neutral",
  cancelled: "red",
};
