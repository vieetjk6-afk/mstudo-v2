import type { CSSProperties } from "react";

/**
 * Kiểu chữ TÊN ALBUM in trên ảnh bìa (album chọn ảnh và album giao khách).
 *
 * Trước đây dùng Cormorant (class `font-serif`) — cùng một phông với mọi tiêu
 * đề khác trong app nên tên album không nổi lên được. Đổi sang Dancing Script:
 * nét viết tay, hợp bìa album ảnh, và tách hẳn khỏi chữ giao diện. Phông này
 * đã khai báo sẵn ở layout gốc (biến `--font-script`) nên không phải tải thêm
 * cấu hình nào; vẫn có phông dự phòng ngay trong var() phòng khi file woff2
 * không tải được.
 */
export const ALBUM_TITLE_FONT: CSSProperties = {
  fontFamily: 'var(--font-script, "Dancing Script"), Georgia, cursive',
  fontWeight: 600,
};

/** Thêm vào khi tên album nằm ĐÈ TRÊN ẢNH: chữ trắng + bóng cho dễ đọc. */
export const ALBUM_TITLE_ON_COVER: CSSProperties = {
  ...ALBUM_TITLE_FONT,
  color: "#fff",
  textShadow: "0 2px 20px rgba(0,0,0,.6), 0 1px 4px rgba(0,0,0,.5)",
};
