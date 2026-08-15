/**
 * Thoát ký tự HTML trước khi nội suy dữ liệu vào chuỗi HTML dựng bằng tay
 * (`document.write`, `srcDoc`, template in ấn…).
 *
 * Vì sao cần: cửa sổ in mở bằng `window.open("")` kế thừa ORIGIN của trang mở
 * nó. Nếu tên khách / tên cô dâu chú rể được ghi thẳng vào `document.write`,
 * một giá trị kiểu `<img src=x onerror=...>` — vốn do KHÁCH tự nhập qua link
 * token (không cần đăng nhập) — sẽ chạy script trong chính phiên của studio khi
 * chủ studio bấm In. Đây là XSS lưu trữ dẫn tới chiếm phiên.
 *
 * Thoát cả `"` và `'` để dùng được trong ngữ cảnh thuộc tính (vd `src="..."`).
 */
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}
