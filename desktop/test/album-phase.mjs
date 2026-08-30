/* Kiểm thử luật GIAI ĐOẠN album: `phase` thắng cờ cũ `is_gallery`.
 *
 * Vì sao đáng có test riêng: album giao khách do hợp đồng tự tạo luôn bật
 * `is_gallery` và KHÔNG bao giờ tắt. Trước đây mọi nơi tính
 * `is_gallery || phase === 'delivery'`, nên studio bấm "Về giai đoạn Chọn ảnh"
 * thì cột `phase` đổi thật mà khách vẫn bị đưa sang trang giao khách — nút coi
 * như hỏng. Ba điều phải giữ:
 *   1. phase = 'selection' → CHỌN ẢNH, kể cả khi is_gallery còn bật.
 *   2. phase = 'delivery'  → GIAO KHÁCH, kể cả khi is_gallery tắt.
 *   3. Album cũ chưa có phase (null/thiếu) → rơi về cờ is_gallery như trước.
 *
 * Nạp thẳng code thật ở src/lib/album-phase.ts.
 */
import { isDeliveryPhase } from "../../src/lib/album-phase.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${got}\n    cần : ${want}`}`);
};

check("album chọn ảnh thuần", isDeliveryPhase({ phase: "selection", is_gallery: false }), false);
check("album giao khách thuần", isDeliveryPhase({ phase: "delivery", is_gallery: true }), true);

// Đây chính là ca lỗi: album do hợp đồng tạo (is_gallery = true) được studio đưa
// về giai đoạn chọn ảnh.
check("đưa album giao khách VỀ chọn ảnh", isDeliveryPhase({ phase: "selection", is_gallery: true }), false);
check("album chọn ảnh chuyển LÊN giao khách", isDeliveryPhase({ phase: "delivery", is_gallery: false }), true);

// Album cũ (trước khi có cột phase) vẫn phải hoạt động y như trước.
check("album cũ, phase null + is_gallery bật", isDeliveryPhase({ phase: null, is_gallery: true }), true);
check("album cũ, phase null + is_gallery tắt", isDeliveryPhase({ phase: null, is_gallery: false }), false);
check("thiếu hẳn hai cột", isDeliveryPhase({}), false);
check("không có album", isDeliveryPhase(null), false);
check("phase lạ → rơi về is_gallery", isDeliveryPhase({ phase: "abc", is_gallery: true }), true);

console.log(fail === 0 ? "\nTất cả đều đạt." : `\n${fail} ca KHÔNG đạt.`);
process.exit(fail === 0 ? 0 : 1);
