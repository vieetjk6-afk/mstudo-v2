import "server-only";
import crypto from "crypto";

/**
 * Vé chứng minh khách đã nhập ĐÚNG mật khẩu của một album có khoá.
 *
 * Vì sao cần: cổng mở khoá /api/a/[slug]/access kiểm mật khẩu bằng bcrypt, nhưng
 * đường GHI (/select) và đường ĐỌC-đồng-bộ (/select GET) trước đây không kiểm gì
 * — ai biết slug đều xoá/sửa được lựa chọn của khách và đọc được ghi chú, kể cả
 * với album ĐẶT MẬT KHẨU. Bắt hai đường đó cũng nhập mật khẩu thì mỗi lần lưu /
 * mỗi nhịp polling lại phải chạy bcrypt (chậm) và biến endpoint thành máy dò mật
 * khẩu. Thay vào đó: /access phát một vé HMAC sau khi bcrypt qua; client đính vé
 * đó vào /select. Vé là HMAC-SHA256 nên KHÔNG thể giả mạo, kiểm cực nhanh, và
 * không lộ thông tin để dò.
 *
 * Vé gắn với (id album + hash mật khẩu): studio ĐỔI mật khẩu là mọi vé cũ hết
 * hiệu lực. Không đặt hạn dùng vì một buổi khách chọn ảnh có thể kéo dài nhiều
 * ngày — giữ vé tương đương "vẫn biết mật khẩu".
 */
function getSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("OAUTH_STATE_SECRET (hoặc SUPABASE_SERVICE_ROLE_KEY) là bắt buộc ở production");
  }
  return "dev-insecure-album-access-secret";
}

/** Phát vé cho một album có mật khẩu. */
export function mintAlbumAccess(albumId: string, passwordHash: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(`album-access:${albumId}:${passwordHash}`)
    .digest("hex");
}

/** Vé có khớp album + hash mật khẩu hiện tại không (so sánh theo thời gian hằng số). */
export function verifyAlbumAccess(
  albumId: string,
  passwordHash: string,
  token: string | null | undefined
): boolean {
  if (!token) return false;
  const expected = mintAlbumAccess(albumId, passwordHash);
  if (token.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}
