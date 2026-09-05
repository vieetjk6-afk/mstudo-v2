/**
 * MÃ PROJECT SUPABASE MÀ APP NÀY ĐANG THẬT SỰ NÓI CHUYỆN.
 *
 * Vì sao đáng có một file riêng cho ba dòng code: sau lần chuyển sang project
 * mới, trên máy chủ studio thường còn MỞ SẴN cả project cũ. Chạy SQL trong tab
 * project cũ thì Supabase báo "Success" đàng hoàng — mà app vẫn không thấy bảng
 * nào, vì app đang trỏ vào project khác. Không có lỗi, không có manh mối, và
 * người dùng thì hoàn toàn có lý khi nói "tôi đã chạy SQL rồi".
 *
 * Nên chỗ nào bảo studio đi chạy SQL thì phải kèm ĐƯỜNG DẪN TỚI ĐÚNG PROJECT,
 * dựng từ chính biến mà app đang dùng để kết nối. Bấm vào đó thì không chạy nhầm
 * project được nữa.
 */

/** `https://abcdefgh.supabase.co` → `abcdefgh`. `null` nếu là domain riêng. */
export function maDuAn(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    if (!host.endsWith(".supabase.co") && !host.endsWith(".supabase.in")) return null;
    const ref = host.split(".")[0];
    // Mã project của Supabase là 20 ký tự chữ thường. Kiểm để không dựng ra một
    // link trông có vẻ đúng mà dẫn tới trang 404.
    return /^[a-z]{20}$/.test(ref) ? ref : null;
  } catch {
    return null;
  }
}

/** Link mở thẳng SQL Editor (query mới) của ĐÚNG project app đang dùng. */
export function linkSqlEditor(url: string | undefined): string | null {
  const ref = maDuAn(url);
  return ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : null;
}
