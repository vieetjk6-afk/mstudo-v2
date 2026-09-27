import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { autoCreateContractDriveOnSign } from "@/lib/studio-drive";
import { syncContractCalendar } from "@/lib/gcal-sync";

/**
 * Nhận cọc = hợp đồng đã chốt, KHÔNG cần khách ký.
 *
 * Ở VN rất nhiều khách chốt bằng cách chuyển cọc qua Zalo chứ không mở link để
 * ký. Trước đây những hợp đồng đó cứ nằm "Chờ khách duyệt" dù tiền đã về, nên
 * không lên Google Lịch, không tạo thư mục Drive, và lệch khỏi mọi danh sách
 * "đã chốt". Giờ khoản thu đầu tiên (đợt cọc hoặc bất kỳ đợt nào) đưa hợp đồng
 * nháp / đang chờ duyệt sang "đã duyệt", với ĐÚNG những việc đi kèm như lúc
 * khách ký: tạo thư mục Drive + album, đẩy lịch lên Google, báo studio.
 *
 * Chữ ký vẫn là của khách: không đóng dấu client_signed_at, khách vẫn ký được
 * sau nếu studio muốn có chữ ký.
 *
 * Gọi từ: webhook SePay / gán tay giao dịch (bank-apply), nút "Đã nhận" ở Tổng
 * quan (payment-plan/collect), màn hợp đồng (/api/studio/contracts/[id]/approve-on-deposit).
 * Không bao giờ ném lỗi: nơi gọi là đường ghi TIỀN, không được hỏng vì Drive / Google.
 */

type Db = ReturnType<typeof createAdminClient>;

export async function approveOnDeposit(db: Db, ownerId: string, contractId: string): Promise<boolean> {
  try {
    // Đổi có điều kiện: chỉ nháp / chờ duyệt. Hợp đồng đang làm, đã xong hay
    // đã huỷ thì giữ nguyên — tiền về muộn không được kéo lùi trạng thái.
    const { data: moved } = await db
      .from("studio_contracts")
      .update({ status: "approved" })
      .eq("id", contractId)
      .eq("owner_id", ownerId)
      .in("status", ["draft", "sent"])
      .select("id, title");
    const row = moved?.[0] as { id: string; title: string } | undefined;
    if (!row) return false;

    await db
      .from("studio_notifications")
      .insert({
        owner_id: ownerId,
        contract_id: contractId,
        kind: "info",
        message: `Hợp đồng “${row.title}” tự chuyển sang Khách đã duyệt vì đã nhận cọc`,
      })
      .then(undefined, () => undefined);

    try {
      await autoCreateContractDriveOnSign(ownerId, contractId);
    } catch {
      /* chưa nối Drive / lỗi tạm — app desktop tạo bù khi chạy */
    }
    await syncContractCalendar(ownerId, contractId);
    return true;
  } catch {
    return false;
  }
}
