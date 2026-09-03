/* Hằng của chế độ nền sáng/tối — module THƯỜNG, cố ý KHÔNG "use client".
 *
 * `theme.tsx` phải có "use client" (nó dùng hook), mà mọi export của một file
 * "use client" đều bị Next biến thành "client reference": server component nhập
 * về sẽ nhận một object rỗng chứ không phải chuỗi thật. Riêng chỗ layout.tsx
 * dùng nó thì React còn giải đúng được vì giá trị đi thẳng vào prop JSX, nhưng
 * đó là may chứ không phải luật — chỉ cần ai đó nối chuỗi hay cắt nó ở server
 * là ra "[object Object]" mà không báo lỗi gì.
 *
 * Nên phần dữ liệu thuần nằm ở đây; theme.tsx xuất lại THEME_KEY để phía client
 * vẫn nhập từ "@/lib/theme" như cũ.
 */

/** Một khoá localStorage dùng chung cho mọi trang, để lựa chọn là toàn cục. */
export const THEME_KEY = "mstudo_theme";

/** Script nội tuyến cho <head> — đặt nền sáng/tối TRƯỚC lần vẽ đầu tiên.
 *
 *  Khoá lưu LỰA CHỌN của người dùng, ba giá trị: "light" | "dark" | "system".
 *  `data-theme` trên <html> luôn là kết quả ĐÃ GIẢI ("light" hoặc "dark") để
 *  mọi selector CSS sẵn có (`:root[data-theme="dark"]`,
 *  `.studio-shell[data-theme="dark"]`) chạy nguyên như trước. Cố ý CHỈ ghi
 *  đúng một thuộc tính: <html> ở layout.tsx đã render `data-theme` sẵn, nên
 *  ghi thêm thuộc tính thứ hai là React báo "Extra attributes from the server"
 *  lúc hydrate. Lựa chọn gốc đọc lại từ localStorage trong provider.
 *
 *  Mặc định vẫn là NỀN SÁNG khi chưa từng chọn, đúng như trước — "theo máy" là
 *  lựa chọn người dùng bấm vào, không phải mặc định mới, để studio nào đang
 *  quen nền sáng thì không tự nhiên bị đổi. */
export const THEME_BOOT_SCRIPT = `(function(){var r=document.documentElement;try{var p=localStorage.getItem('${THEME_KEY}');var t=p==='dark'?'dark':p==='system'?(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):'light';r.dataset.theme=t;}catch(e){r.dataset.theme='light';}})();`;
