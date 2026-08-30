/**
 * Album đang ở giai đoạn GIAO KHÁCH hay còn ở giai đoạn CHỌN ẢNH.
 *
 * Hai cột cùng nói về một chuyện vì lý do lịch sử:
 *   • `is_gallery` — cờ CŨ, bật cho mọi album giao khách (album do hợp đồng tự
 *     tạo luôn bật lúc tạo và KHÔNG bao giờ tắt).
 *   • `phase`      — cột MỚI, chính là thứ nút "Giao khách ⟷ Chọn ảnh" trong
 *     dashboard ghi vào.
 *
 * Nên `phase` phải THẮNG. Trước đây mọi nơi tính `is_gallery || phase ===
 * 'delivery'`: studio bấm "Về giai đoạn Chọn ảnh" thì cột phase đổi thật, nhưng
 * khách vẫn bị đưa sang trang giao khách vì `is_gallery` còn bật — nút coi như
 * vô tác dụng. Album cũ chưa có `phase` (null) mới rơi về cờ `is_gallery`.
 */
export function isDeliveryPhase(
  a: { phase?: string | null; is_gallery?: boolean | null } | null | undefined
): boolean {
  if (!a) return false;
  if (a.phase === "delivery") return true;
  if (a.phase === "selection") return false;
  return !!a.is_gallery;
}
