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

/** Script nội tuyến cho <head> — đặt nền sáng/tối TRƯỚC lần vẽ đầu tiên. */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');document.documentElement.dataset.theme=(t==='dark'?'dark':'light');}catch(e){document.documentElement.dataset.theme='light';}})();`;
