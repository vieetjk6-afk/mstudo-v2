/* ═══════════════════════════════════════════════════════════════════════════
   ALBUM CÓ GHÉP LAYOUT KHÔNG — luật thuần (máy chủ đọc DB rồi hỏi hàm này).

   • Album thuộc hợp đồng (album chọn ảnh hoặc album giao riêng của hợp đồng)
     → theo công tắc trên hợp đồng (studio_contracts.collage_enabled).
   • Album lẻ (không thuộc hợp đồng nào) → theo công tắc của chính album
     (albums.collage_enabled). Cả hai MẶC ĐỊNH BẬT.
   • Không đọc được (chưa chạy migrations/ghep_layout.sql) → TẮT: tính năng
     đơn giản không hiện, không làm hỏng trang.

   Gói của studio (Photographer Plus / Studio) kiểm riêng — xem planAllowsCollage.
   File này cố ý không nhập gì để kiểm thử Node chạy thẳng được.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @param contracts hợp đồng dùng album này; `null` = đọc lỗi.
 * @param albumFlag albums.collage_enabled; `undefined` = không đọc được cột.
 */
export function collageEnabledFor(contracts: readonly { collage_enabled?: unknown }[] | null, albumFlag: unknown): boolean {
  if (contracts === null) return false;
  if (contracts.length > 0) return contracts.some((c) => c.collage_enabled === true);
  if (albumFlag === undefined) return false;
  return albumFlag !== false;
}
