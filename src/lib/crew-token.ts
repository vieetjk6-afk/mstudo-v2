import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/* ═══════════════════════════════════════════════════════════════════════════
   Mã link đăng ký của SỔ THỢ — /crew/<crew_token>.

   Tách khỏi trang vì sổ thợ đã gộp thành một tab của màn "Nhân viên & phân
   quyền": logic này giờ chạy từ một trang khác trang cũ, và route /crew cũ chỉ
   còn chuyển hướng.
   ═══════════════════════════════════════════════════════════════════════════ */

// Mã NGẮN vì thợ hay phải gõ tay hoặc đọc qua điện thoại — 8 ký tự là ~2,8
// nghìn tỷ tổ hợp, thừa an toàn cho một link chỉ dẫn tới form đăng ký (không lộ
// dữ liệu gì). Bỏ chữ dễ đọc nhầm: 0/O, 1/l/I.
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

const shortCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((n) => ALPHABET[n % ALPHABET.length])
    .join("");

/**
 * Bảo đảm studio có mã link đăng ký thợ, rút gọn luôn mã dài kiểu UUID cấp ở
 * bản trước. Nhân viên thường KHÔNG cấp mã (chỉ đọc mã đã có).
 *
 * Ghi bằng service-role chứ KHÔNG phải client của user:
 * c1_profiles_column_grants.sql đã thu hồi UPDATE toàn bảng profiles và chỉ cấp
 * lại một số cột an toàn — `crew_token` không nằm trong đó, nên ghi bằng client
 * user sẽ bị chặn ở mức quyền CỘT. Giữ nguyên như vậy (chặt hơn) và ghi ở server.
 */
export async function ensureCrewToken(
  ownerId: string,
  current: string | null,
  canWrite: boolean
): Promise<{ token: string | null; error: string | null }> {
  const token = current;
  let error: string | null = null;
  if (!canWrite || (token && token.length <= 12)) return { token, error: null };

  for (let i = 0; i < 5; i++) {
    const candidate = shortCode();
    // Cột là unique — đụng mã thì thử lại, gần như không bao giờ xảy ra.
    const { error: e } = await createAdminClient()
      .from("profiles")
      .update({ crew_token: candidate })
      .eq("id", ownerId);
    if (!e) return { token: candidate, error: null };
    error = e.message;
  }
  return { token, error };
}
