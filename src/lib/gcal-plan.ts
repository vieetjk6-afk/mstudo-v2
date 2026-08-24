/* ═══════════════════════════════════════════════════════════════════════════
   LUẬT "hợp đồng này có được lên Google Lịch không" — thuần logic, KHÔNG phụ
   thuộc googleapis hay Supabase, để kiểm thử được bằng `node` (xem
   desktop/test/gcal-sync.mjs) và để MỌI luồng đồng bộ cùng đọc một luật.

   Tách khỏi lib/gcal.ts vì file đó nhập `googleapis`: nhập nó vào một test chạy
   thẳng bằng node là kéo theo cả cây phụ thuộc chỉ để hỏi một câu so sánh chuỗi.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Hợp đồng ở trạng thái nào thì được lên lịch Google. */
export const GCAL_CONTRACT_STATUSES = ["approved", "in_progress", "completed"] as const;

export type GCalPlan =
  /** Tạo mới hoặc cập nhật sự kiện. */
  | { action: "upsert" }
  /** Gỡ sự kiện cũ (nếu có) và xoá id đã lưu — kèm lý do đọc được cho người dùng. */
  | { action: "drop"; reason: string };

/**
 * Quyết định phải làm gì với sự kiện Google Lịch của một hợp đồng.
 *
 * Hai nhánh "drop" quan trọng ngang nhánh "upsert": hợp đồng bị lùi về nháp, bị
 * huỷ, hay bị xoá ngày chụp mà vẫn còn trên lịch Google là kiểu sai nguy hiểm
 * hơn cả không đồng bộ — thợ vẫn thấy buổi chụp và vẫn tới.
 */
export function gcalPlan(ct: { status?: string | null; event_date?: string | null }): GCalPlan {
  if (!ct.event_date) return { action: "drop", reason: "hợp đồng chưa có ngày chụp" };
  if (!(GCAL_CONTRACT_STATUSES as readonly string[]).includes(ct.status ?? "")) {
    return { action: "drop", reason: "hợp đồng chưa xác nhận/ký — chỉ lịch đã chốt mới lên Google" };
  }
  return { action: "upsert" };
}
