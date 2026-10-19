/**
 * Tên studio ở đầu trang được phép xuống dòng (tên dài trên điện thoại). Dấu
 * ngăn " - " / " | " / " · " thì dính vào chữ ĐỨNG TRƯỚC bằng khoảng trắng
 * không ngắt, để dòng mới không mở đầu bằng "- PHÓNG SỰ CƯỚI…".
 */
export function brandNameText(name: string): string {
  return name.replace(/\s+([-–—|·])\s+/g, " $1 ");
}
