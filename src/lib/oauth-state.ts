import "server-only";
import crypto from "crypto";

/**
 * Ký & xác minh tham số `state` cho các luồng OAuth (Google Calendar…).
 *
 * Vì sao cần: nếu `state` chỉ là userId trần (không ký), kẻ tấn công có thể tự
 * lấy `code` từ Google rồi gọi callback với `state=<userId nạn nhân>` để GẮN tài
 * khoản Google của MÌNH vào hồ sơ NẠN NHÂN (account-linking CSRF). Hậu quả: toàn
 * bộ sự kiện lịch (thông tin khách, booking) của nạn nhân bị đẩy sang lịch của
 * kẻ tấn công. Ký HMAC + hạn dùng ngắn khiến state không thể giả mạo.
 */
// Bí mật ký state. Ở production PHẢI có secret thật; không được rơi về mặc định
// công khai (kẻ tấn công đoán được → giả mạo state → account-linking CSRF).
// Đọc lazy lúc gọi hàm (không phải lúc import) để `next build` — vốn chạy với
// NODE_ENV=production nhưng không có env runtime — không bị chết khi collect page data.
function getSecret(): string {
  const secret =
    process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("OAUTH_STATE_SECRET (hoặc SUPABASE_SERVICE_ROLE_KEY) là bắt buộc ở production");
  }
  return "dev-insecure-oauth-state-secret";
}
const TTL_MS = 10 * 60 * 1000; // state chỉ hợp lệ trong 10 phút

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
function hmac(data: string): string {
  return b64url(crypto.createHmac("sha256", getSecret()).update(data).digest());
}

/** Trả về chuỗi state đã ký: `<payload>.<exp>.<sig>`. */
export function signOAuthState(payload: string, ttlMs: number = TTL_MS): string {
  const exp = Date.now() + ttlMs;
  const data = `${b64url(Buffer.from(payload, "utf8"))}.${exp}`;
  return `${data}.${hmac(data)}`;
}

/** Xác minh chữ ký + hạn dùng; trả payload gốc nếu hợp lệ, ngược lại null. */
export function verifyOAuthState(state: string | null | undefined): string | null {
  if (!state) return null;
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [p, exp, sig] = parts;
  const expected = hmac(`${p}.${exp}`);
  // So sánh theo thời gian hằng số để tránh timing attack.
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || Date.now() > expMs) return null;
  try {
    return fromB64url(p).toString("utf8");
  } catch {
    return null;
  }
}
