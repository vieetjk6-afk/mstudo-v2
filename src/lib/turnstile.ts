/**
 * Xác minh mã Turnstile phía MÁY CHỦ.
 * Tài liệu: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * VÌ SAO KHÔNG CÒN HÀM `verifyTurnstile(): boolean`
 * -------------------------------------------------
 * Bản cũ trả về `true` cho ba trường hợp KHÁC HẲN nhau:
 *   1. Cloudflare xác nhận mã hợp lệ.
 *   2. Máy chủ chưa khai TURNSTILE_SECRET_KEY.
 *   3. Client gửi đúng chuỗi "turnstile-unavailable".
 *
 * Trường hợp 3 biến captcha thành đồ trang trí: chuỗi đó do CLIENT gửi, không
 * ký, không hạn dùng — bất kỳ script nào cũng chỉ cần
 * `{"captcha":"turnstile-unavailable"}` là qua cửa, ở mọi form công khai
 * (liên hệ, góp ý, đặt lịch, tra cứu SĐT thợ). Chính trang góp ý của vieetjk
 * cũng gửi cứng chuỗi này.
 *
 * Nhưng bỏ hẳn đường lùi cũng sai: Turnstile thật sự có lúc không chạy được
 * (webview nhúng của MStudo Desktop, mạng chặn challenges.cloudflare.com,
 * Cloudflare gián đoạn) và khoá luôn khách thật thì tệ hơn là để lọt spam.
 *
 * Nên kết quả bây giờ có BA mức, và "không xác minh được" KHÔNG đồng nghĩa với
 * "cho qua thoải mái": nó được cho qua nhưng bị siết hạn mức chặt theo IP
 * (xem `guardCaptcha` ở @/lib/captcha-guard).
 *
 * GIỮ FILE NÀY THUẦN: không import next/server, không import rate-limit. Nhờ
 * vậy desktop/test/captcha.mjs nạp thẳng được bằng node, và component client
 * dùng chung được hằng số TURNSTILE_UNAVAILABLE mà không kéo theo mã máy chủ.
 */

/**
 * Mã client gửi khi widget Turnstile KHÔNG chạy được (trình chặn quảng cáo,
 * mạng chặn challenges.cloudflare.com, webview nhúng). Một nguồn duy nhất —
 * cả component dựng widget lẫn máy chủ đều đọc từ đây.
 *
 * Không chứng minh điều gì cả: ai cũng gửi được chuỗi này.
 */
export const TURNSTILE_UNAVAILABLE = "turnstile-unavailable";

export type CaptchaVerdict =
  /** Cloudflare đã xác nhận mã này. */
  | "verified"
  /** Không xác minh được (chưa cấu hình / client báo không dùng được / Cloudflare lỗi). */
  | "unverified"
  /** Có mã nhưng Cloudflare BÁC — gần như chắc chắn là giả hoặc dùng lại. */
  | "failed";

export async function checkTurnstile(token: string | null | undefined): Promise<CaptchaVerdict> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Chưa khai bí mật thì không có gì để xác minh. Đừng chặn khách (một biến môi
  // trường thiếu không được phép làm sập mọi form), nhưng cũng đừng coi là đã
  // xác minh — người gọi sẽ siết hạn mức thay.
  if (!secret) return "unverified";

  // Client báo widget không chạy được. Chuỗi này KHÔNG chứng minh điều gì cả
  // (ai cũng gửi được) nên chỉ đủ để xếp vào mức "chưa xác minh".
  if (!token || token === TURNSTILE_UNAVAILABLE) return "unverified";

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      cache: "no-store",
    });
    if (!res.ok) return "unverified"; // Cloudflare trục trặc, không phải lỗi của khách
    const data = (await res.json()) as { success?: boolean };
    return data.success === true ? "verified" : "failed";
  } catch {
    // Không gọi được Cloudflare (mạng/timeout). Bản cũ chặn thẳng, tức là
    // Cloudflare hắt hơi thì mọi form của mstudo chết theo.
    return "unverified";
  }
}
