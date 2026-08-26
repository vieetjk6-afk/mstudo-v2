// Kiểm tra URL ảnh đính kèm tin Zalo — THUẦN (không server-only) để test chạy
// thẳng trên node.

/**
 * Ảnh đính kèm do TRÌNH DUYỆT truyền lên, mà MÁY CHỦ mới là bên đi tải — nhận
 * URL tuỳ ý là mở sẵn một cửa SSRF (dò dịch vụ nội bộ, endpoint metadata của
 * máy chủ). Nên chỉ nhận đúng máy chủ ảnh QR đang dùng; URL khác coi như không
 * có ảnh và tin vẫn gửi dạng văn bản (link QR đã nằm trong nội dung).
 */
const IMAGE_HOSTS = new Set(["img.vietqr.io", "api.vietqr.io"]);

export function safeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && IMAGE_HOSTS.has(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}
