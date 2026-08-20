import type { CSSProperties } from "react";

/**
 * Kiểu chữ TÊN ALBUM in trên ảnh bìa (album chọn ảnh và album giao khách).
 *
 * Chữ không chân, hình học, đậm — đơn giản và hiện đại, đọc tốt ở cỡ lớn đè
 * trên ảnh. (Bản trước dùng Dancing Script nét viết tay; chữ viết tay ở cỡ lớn
 * trên nền ảnh nhiều chi tiết thì khó đọc và trông cũ.) Manrope đã khai báo sẵn
 * ở layout gốc (biến `--font-manrope`, có bộ chữ tiếng Việt) nên không phải tải
 * thêm gì; vẫn để phông dự phòng ngay trong var() phòng khi file woff2 hỏng.
 */
export const ALBUM_TITLE_FONT: CSSProperties = {
  fontFamily: 'var(--font-manrope, Manrope), var(--font-hanken, "Hanken Grotesk"), system-ui, sans-serif',
  fontWeight: 700,
  letterSpacing: "-0.022em",
};

/** Thêm vào khi tên album nằm ĐÈ TRÊN ẢNH: chữ trắng + bóng cho dễ đọc. */
export const ALBUM_TITLE_ON_COVER: CSSProperties = {
  ...ALBUM_TITLE_FONT,
  color: "#fff",
  textShadow: "0 2px 28px rgba(0,0,0,.6), 0 1px 6px rgba(0,0,0,.5)",
};
