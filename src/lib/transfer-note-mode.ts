import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TransferNoteMode } from "@/lib/vietqr";

/**
 * Cách ghi nội dung chuyển khoản của một studio — đọc ở máy chủ cho mọi nơi
 * dựng mã QR hợp đồng (Tổng quan, màn chi tiết hợp đồng, cổng khách).
 *
 *  - withDate: profiles.qr_note_date (studio chọn ở Bảng giá → Liên hệ & chuyển khoản).
 *  - template: profiles.qr_note_template — nội dung studio tự nhập (có thì dùng thay).
 *  - sepay:    studio đã bật "Tự xác nhận chuyển khoản" (studio_bank_hooks.enabled).
 *
 * Đọc bằng service-role vì studio_bank_hooks chỉ cho CHỦ studio đọc, còn nhân
 * viên và cổng khách cũng cần biết có thêm mã đợt hay không. Bảng chưa có
 * (chưa chạy migration đối soát) → coi như chưa bật SePay.
 */
export async function loadTransferNoteMode(
  ownerId: string,
  profile?: { qr_note_date?: unknown; qr_note_template?: unknown } | null
): Promise<TransferNoteMode> {
  const db = createAdminClient();
  const [hook, prof] = await Promise.all([
    db.from("studio_bank_hooks").select("enabled").eq("owner_id", ownerId).maybeSingle(),
    // select("*"): cột qr_note_date / qr_note_template có hay chưa tuỳ migration
    // đã chạy — chọn đích danh một cột chưa có thì cả câu hỏng.
    profile ? Promise.resolve(null) : db.from("profiles").select("*").eq("id", ownerId).maybeSingle(),
  ]);
  const p = (profile ?? (prof && !prof.error ? prof.data : null) ?? {}) as { qr_note_date?: unknown; qr_note_template?: unknown };
  const sepay = !hook.error && (hook.data as { enabled?: boolean } | null)?.enabled === true;
  const template = typeof p.qr_note_template === "string" && p.qr_note_template.trim() ? p.qr_note_template.trim() : null;
  return { withDate: p.qr_note_date === true, sepay, template };
}
