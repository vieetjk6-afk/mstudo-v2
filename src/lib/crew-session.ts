import "server-only";
import { signOAuthState, verifyOAuthState } from "@/lib/oauth-state";

/**
 * "Phiên" của cổng thợ /crew — chuỗi ký HMAC gắn với MỘT số điện thoại.
 *
 * Cổng thợ không có đăng nhập: thợ gõ SĐT + qua captcha là xem được lịch làm
 * việc. Nhưng mã Turnstile chỉ dùng được MỘT lần, nên mọi lượt nạp lại sau đó
 * (sau khi nhận buổi, thêm lịch bận, lưu hồ sơ…) trước đây hoặc bị Cloudflare
 * bác, hoặc phải mở cửa không captcha — và chính cửa không captcha đó cho người
 * lạ dò SĐT để lấy lịch, số tài khoản của thợ.
 *
 * Nên: lượt tra cứu ĐÃ QUA captcha nhận về một phiên ngắn hạn; các lượt sau
 * (danh sách việc, hồ sơ, lịch đồng bộ) trình phiên này thay cho captcha.
 */
const TTL_MS = 2 * 60 * 60 * 1000; // 2 giờ — đủ một buổi thao tác trên điện thoại.

export function signCrewSession(phone: string): string {
  return signOAuthState(`crew:${phone}`, TTL_MS);
}

export function verifyCrewSession(session: string | null | undefined, phone: string): boolean {
  return !!phone && verifyOAuthState(session) === `crew:${phone}`;
}
