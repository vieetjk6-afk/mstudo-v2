/**
 * Làm sạch tham số `?next=` trước khi chuyển hướng.
 *
 * VÌ SAO KHÔNG ĐỦ nếu chỉ kiểm tra `startsWith("/") && !startsWith("//")`:
 * trình duyệt (và WHATWG URL) coi DẤU GẠCH NGƯỢC là dấu gạch chéo với các
 * scheme đặc biệt (http/https). Nên `/\evil.com` lọt qua điều kiện đó — nó
 * bắt đầu bằng "/" và không bắt đầu bằng "//" — nhưng khi đem đi phân giải:
 *
 *   new URL("/\\evil.com", "https://mstudo.com")  →  https://evil.com/
 *   window.location.assign("/\\evil.com")          →  https://evil.com/
 *
 * Tức là kẻ tấn công gửi link `https://mstudo.com/login?next=/\evil.com`,
 * người dùng đăng nhập THẬT trên mstudo.com rồi bị ném sang trang giả — đúng
 * kịch bản lừa đảo mà chốt chặn open-redirect sinh ra để chặn.
 *
 * Ở đây chặn cả ba biến thể: `\` (và bản đã mã hoá `%5C`), ký tự điều khiển /
 * khoảng trắng mà trình duyệt tự lược bỏ trước khi phân giải (tab, xuống dòng,
 * NUL), và mọi thứ không mở đầu bằng đúng MỘT dấu "/".
 */
export const DEFAULT_NEXT = "/dashboard/studio";

/** Ký tự điều khiển C0 + khoảng trắng + DEL — trình duyệt lược bỏ trước khi phân giải URL. */
const STRIPPED_BY_BROWSER = /[\u0000-\u0020\u007f]/;

export function safeNextPath(raw: string | null | undefined, fallback: string = DEFAULT_NEXT): string {
  const value = raw ?? "";
  if (!value) return fallback;

  // Trình duyệt LƯỢC BỎ tab/xuống dòng/NUL trước khi phân giải URL, nên
  // "/<tab>/evil.com" thành đường dẫn khác hẳn thứ ta nhìn thấy ở đây.
  // Từ chối thẳng thay vì cố đoán ý.
  if (STRIPPED_BY_BROWSER.test(value)) return fallback;

  // `\` và bản mã hoá của nó — nguồn gốc của bypass mô tả ở trên.
  if (value.includes("\\") || /%5c/i.test(value)) return fallback;

  // Chỉ nhận đường dẫn nội bộ: đúng một "/" mở đầu, không phải "//host".
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;

  return value;
}
