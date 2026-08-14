/**
 * So khoá VAPID của một đăng ký thông báo đẩy với khoá hiện tại của máy chủ.
 *
 * Vì sao cần: một đăng ký (PushSubscription) bị **trói vào khoá VAPID lúc nó
 * được tạo**. Máy chủ đổi cặp khoá thì dịch vụ đẩy từ chối mọi lần gửi tới đăng
 * ký cũ — và lỗi trả về là **403**, không phải 404/410, nên vòng dọn tự động ở
 * `src/lib/push.ts` không đụng tới nó. Không so khoá thì nút hiện "đang bật"
 * trong khi máy đó chẳng bao giờ nhận được gì nữa.
 *
 * Tách khỏi component để kiểm thử được — xem `desktop/test/vapid-key.mjs`.
 */

/** Đổi khoá VAPID dạng base64url sang mảng byte mà Push API đòi hỏi. */
export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Đăng ký có đang dùng đúng khoá `currentKey` không?
 *
 * - `true`  — khớp, để nguyên.
 * - `false` — lệch, phải huỷ rồi đăng ký lại.
 * - `null`  — **không kết luận được**: trình duyệt không cho đọc
 *   `applicationServerKey`, hoặc máy chủ chưa khai khoá nào. Thà giữ một đăng ký
 *   còn hơn huỷ nhầm một đăng ký đang chạy tốt.
 */
export function matchesVapidKey(
  subscriptionKey: ArrayBuffer | null | undefined,
  currentKey: string
): boolean | null {
  if (!subscriptionKey || !currentKey) return null;
  const got = new Uint8Array(subscriptionKey);
  let want: Uint8Array;
  try {
    want = urlBase64ToUint8Array(currentKey);
  } catch {
    return null; // khoá cấu hình hỏng — không lấy đó làm căn cứ để huỷ đăng ký
  }
  if (got.length === 0 || want.length === 0) return null;
  if (got.length !== want.length) return false;
  for (let i = 0; i < got.length; i++) if (got[i] !== want[i]) return false;
  return true;
}
