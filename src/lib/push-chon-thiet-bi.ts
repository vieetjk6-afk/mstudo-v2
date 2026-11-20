/** Một dòng đăng ký nhận thông báo đẩy — chỉ những cột cần cho việc chọn lọc. */
export interface DangKyPush {
  id: string;
  /** Tài khoản đã bật thông báo trên thiết bị đó (chủ studio hoặc nhân viên). */
  user_id: string;
  /** Lúc đăng ký. Mới nhất = thiết bị người đó đang dùng. */
  created_at?: string | null;
  /** URL dịch vụ push của thiết bị — chỉ dùng để biết LOẠI thiết bị (iPhone/Safari,
   *  Chrome, Firefox, Windows). Thiếu thì gộp chung một nhóm. */
  endpoint?: string | null;
}

/**
 * Nhóm thiết bị theo dịch vụ push. iPhone (cả tab Safari lẫn app đã thêm vào
 * màn hình chính) đều qua máy chủ Apple; Chrome/Android qua Google; v.v.
 */
export function loaiThietBi(endpoint: string | null | undefined): string {
  if (!endpoint) return "?";
  let h = "";
  try {
    h = new URL(endpoint).hostname.toLowerCase();
  } catch {
    return "?";
  }
  if (h.endsWith("push.apple.com")) return "apple";
  if (h.endsWith("googleapis.com")) return "google";
  if (h.endsWith("mozilla.com")) return "mozilla";
  if (h.endsWith("windows.com")) return "windows";
  return h;
}

/**
 * MỖI NGƯỜI MỘT TIN TRÊN MỖI LOẠI THIẾT BỊ: giữ đăng ký mới nhất của từng
 * (tài khoản × dịch vụ push).
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
 * Nhưng KHÔNG được gộp hết về một thiết bị duy nhất: bản trước chỉ giữ đúng
 * một đăng ký mới nhất mỗi người, nên ai bật thông báo trên máy tính SAU iPhone
 * là iPhone im luôn (trong khi nút "Gửi thử" — gửi tới mọi đăng ký — vẫn chạy,
 * càng khó hiểu). Giờ gộp theo dịch vụ push: Safari tab + app màn hình chính +
 * cài lại trên cùng iPhone vẫn chung nhóm Apple → một tin; còn iPhone và
 * Chrome trên máy tính là hai nhóm → mỗi máy một tin.
 *
 * Đăng ký cũ không bị xoá ở đây — chúng chỉ thôi được dùng. Cái nào thật sự
 * chết thì lượt gửi sau nhận 404/410 và tự bị dọn.
 */
export function motThietBiMoiNguoi<T extends DangKyPush>(subs: readonly T[]): T[] {
  const moiNhat = new Map<string, T>();
  for (const s of subs) {
    const k = `${s.user_id}|${loaiThietBi(s.endpoint)}`;
    const cu = moiNhat.get(k);
    if (!cu || moi(s.created_at) > moi(cu.created_at)) moiNhat.set(k, s);
  }
  return [...moiNhat.values()];
}

/** Mốc thời gian để so "mới hơn". Thiếu/hỏng thì coi như cũ nhất. */
function moi(t: string | null | undefined): number {
  if (!t) return 0;
  const n = Date.parse(t);
  return Number.isNaN(n) ? 0 : n;
}
