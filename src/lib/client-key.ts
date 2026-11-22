/**
 * Khoá nhận diện MỘT khách hàng trong danh bạ (danh bạ suy ra từ hợp đồng,
 * không có bảng khách riêng).
 *
 * Trước đây khoá là "mọi chữ số của SĐT", nên 0901 234 567, +84 901 234 567 và
 * 84901234567 thành BA khách khác nhau — tách lịch sử, tách công nợ. Giờ chuẩn
 * về dạng nội địa "0" + 9 số cuối (giống phoneKey ở album-print-rules), để URL
 * hồ sơ khách vẫn đọc được: /dashboard/studio/clients/0901234567.
 *
 * Không có SĐT hợp lệ → dùng tên viết thường (giữ hành vi cũ).
 */
export function phoneKey(phone: string | null | undefined): string {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length >= 9 && d.length <= 12) return "0" + d.slice(-9);
  return d;
}

export function clientKey(phone: string | null | undefined, name: string | null | undefined): string {
  return phoneKey(phone) || (name ?? "").trim().toLowerCase();
}
