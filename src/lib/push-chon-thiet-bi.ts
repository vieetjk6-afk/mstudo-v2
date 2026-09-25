/** Một dòng đăng ký nhận thông báo đẩy — chỉ những cột cần cho việc chọn lọc. */
export interface DangKyPush {
  id: string;
  /** Tài khoản đã bật thông báo trên thiết bị đó (chủ studio hoặc nhân viên). */
  user_id: string;
  /** Lúc đăng ký. Mới nhất = thiết bị người đó đang dùng. */
  created_at?: string | null;
}

/**
 * MỖI NGƯỜI MỘT TIN: giữ lại đúng đăng ký mới nhất của từng tài khoản.
 *
 * Vì sao cần: một người bật thông báo trên nhiều chỗ (Safari, app đã thêm vào
 * màn hình chính, máy tính, hay chỉ là cài lại app) là mỗi chỗ một đăng ký
 * riêng. Trình duyệt chỉ gộp được các tin CÙNG một đăng ký (theo `tag`), nên
 * ba đăng ký là ba tin nổi lên liên tiếp cho cùng một việc — đúng cái studio
 * kêu khi khách bấm "đã chọn xong".
 *
 * Lọc theo TÀI KHOẢN chứ không theo studio: nhân viên đăng ký dưới cùng
 * owner_id với chủ studio, gom theo studio thì cả nhóm chỉ một người nhận được.
 *
 * Đăng ký cũ không bị xoá ở đây — chúng chỉ thôi được dùng. Cái nào thật sự
 * chết thì lượt gửi sau nhận 404/410 và tự bị dọn.
 */
export function motThietBiMoiNguoi<T extends DangKyPush>(subs: readonly T[]): T[] {
  const moiNhat = new Map<string, T>();
  for (const s of subs) {
    const cu = moiNhat.get(s.user_id);
    if (!cu || moi(s.created_at) > moi(cu.created_at)) moiNhat.set(s.user_id, s);
  }
  return [...moiNhat.values()];
}

/** Mốc thời gian để so "mới hơn". Thiếu/hỏng thì coi như cũ nhất. */
function moi(t: string | null | undefined): number {
  if (!t) return 0;
  const n = Date.parse(t);
  return Number.isNaN(n) ? 0 : n;
}
