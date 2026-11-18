/*
 * PHÔNG CHỮ TỰ PHỤC VỤ — file font nằm trong gói @fontsource/* (cùng file của
 * Google Fonts), được đóng gói cùng app lúc build.
 *
 * Vì sao không dùng next/font/google: nó TẢI font từ Google ngay lúc build, và
 * Google nhiều lần chặn máy build của GitHub ("Can't resolve
 * '@vercel/turbopack-next/internal/font/google/font'") → cả lượt deploy hỏng dù
 * code không đổi gì. Tự phục vụ thì build không gọi mạng nào cho font.
 *
 * Mỗi file theo độ đậm khai @font-face cho TỪNG bộ chữ kèm unicode-range, nên
 * trình duyệt chỉ tải phần (latin / latin-ext / vietnamese…) mà trang thật sự
 * dùng, và chỉ khi trang dùng tới phông đó — như next/font trước đây.
 * Biến CSS (--font-hanken, --font-lora…) khai ở ./font-vars.css, giữ nguyên tên
 * cũ nên mọi chỗ dùng (globals.css, ảnh ghép @/lib/collage/fonts…) không đổi.
 *
 * Thêm / bớt độ đậm: sửa danh sách dưới đây (đúng tên file trong gói).
 */
import "@fontsource/hanken-grotesk/300.css";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/600-italic.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/be-vietnam-pro/800.css";
import "@fontsource/dancing-script/500.css";
import "@fontsource/dancing-script/600.css";
import "@fontsource/dancing-script/700.css";
import "@fontsource/great-vibes/400.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/400-italic.css";
import "@fontsource/playfair-display/500.css";
import "@fontsource/playfair-display/500-italic.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/600-italic.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/playfair-display/700-italic.css";
import "@fontsource/playpen-sans/400.css";
import "@fontsource/playpen-sans/500.css";
import "@fontsource/playpen-sans/600.css";
import "@fontsource/lora/400.css";
import "@fontsource/lora/400-italic.css";
import "@fontsource/lora/500.css";
import "@fontsource/lora/500-italic.css";
import "@fontsource/lora/600.css";
import "@fontsource/lora/600-italic.css";
import "@fontsource/pinyon-script/400.css";
import "@fontsource/alex-brush/400.css";
import "@fontsource/corinthia/400.css";
import "@fontsource/prata/400.css";
import "@fontsource/eb-garamond/400.css";
import "@fontsource/eb-garamond/400-italic.css";
import "@fontsource/eb-garamond/500.css";
import "@fontsource/eb-garamond/500-italic.css";
