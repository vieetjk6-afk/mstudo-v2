/**
 * Viền sáng tối quanh biểu tượng nằm ĐÈ TRÊN ẢNH (trái tim chọn, trái tim gạch
 * chéo, mũi tên chuyển ảnh).
 *
 * Studio ảnh cưới chụp rất nhiều nền trắng — váy trắng, tường trắng, hoa trắng.
 * Biểu tượng màu trắng kèm một bóng đổ mảnh sẽ chìm hẳn vào những tấm đó. Đây
 * là hai lớp bóng đổ tối: một lớp sát nét cho rõ đường, một lớp toả rộng làm
 * quầng tối mờ quanh biểu tượng. Dùng bóng đổ chứ KHÔNG dùng nền/viền tròn —
 * yêu cầu là "chỉ để trái tim, không để viền tròn".
 */
export const ICON_HALO =
  "drop-shadow(0 1px 2px rgba(0,0,0,.85)) drop-shadow(0 0 5px rgba(0,0,0,.6))";
