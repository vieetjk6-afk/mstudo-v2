import "server-only";
import { signOAuthState, verifyOAuthState } from "@/lib/oauth-state";
import { mainUrl } from "@/lib/hosts";

/**
 * Link xác nhận email cho tài khoản NHÂN VIÊN do chủ studio tạo.
 *
 * Vì sao cần: trước đây chủ studio tạo tài khoản ĐÃ XÁC NHẬN cho một email bất
 * kỳ (kèm mật khẩu do chính họ đặt). Chủ thật của email đó sau này đăng nhập
 * bằng Google thì Supabase gộp vào đúng tài khoản ấy — tức rơi vào tài khoản mà
 * studio kia đang nắm mật khẩu. Giờ tài khoản tạo ra ở trạng thái CHƯA xác nhận;
 * chỉ người mở được hộp thư mới xác nhận được, sau đó mới đăng nhập được.
 *
 * Chuỗi ký HMAC (cùng khoá với state OAuth), gắn id + email, hạn 7 ngày.
 */
const TTL_MS = 7 * 24 * 3600 * 1000;

export function staffConfirmUrl(userId: string, email: string): string {
  const t = signOAuthState(`staff-confirm:${userId}:${email.toLowerCase()}`, TTL_MS);
  return mainUrl(`/auth/xac-nhan-nhan-vien?t=${encodeURIComponent(t)}`);
}

/** Trả về { userId, email } nếu link còn hạn và đúng chữ ký. */
export function readStaffConfirm(t: string | null | undefined): { userId: string; email: string } | null {
  const p = verifyOAuthState(t);
  const m = p?.match(/^staff-confirm:([0-9a-f-]{36}):(.+)$/i);
  return m ? { userId: m[1], email: m[2] } : null;
}
