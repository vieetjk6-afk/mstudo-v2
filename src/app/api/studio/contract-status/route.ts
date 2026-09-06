import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCreateContractSelectionOnProduction } from "@/lib/studio-drive";
import { deliverContractIfReady } from "@/lib/contract-delivery";
import { syncContractCalendar } from "@/lib/gcal-sync";

export const dynamic = "force-dynamic";

const VALID = new Set(["draft", "sent", "approved", "in_progress", "completed", "cancelled"]);

/**
 * Đổi trạng thái hợp đồng — điểm TẬP TRUNG cho mọi nơi trên web (ContractEditor,
 * bảng công việc, danh sách hợp đồng). Đặt ở server để:
 *   1. Luôn đóng dấu completed_at nhất quán (trước đây board & list bỏ sót).
 *   2. Khi chuyển sang "completed" thì tạo album giao khách (phase delivery) —
 *      NHƯNG chỉ khi ảnh chỉnh sửa đã lên Drive. Hoàn thành mà hậu kỳ chưa xong
 *      thì khách vẫn ở giai đoạn chọn ảnh (xem @/lib/contract-delivery).
 * Yêu cầu chủ hợp đồng (RLS-scoped: chỉ owner mới đổi được).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { contractId, status } = (await req.json().catch(() => ({}))) as { contractId?: string; status?: string };
  if (!contractId || !status || !VALID.has(status)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const db = createAdminClient();
  // Xác minh quyền sở hữu trước khi ghi bằng service role.
  const { data: contract } = await db
    .from("studio_contracts")
    .select("id, owner_id, status")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract || contract.owner_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const patch: { status: string; completed_at?: string | null } = { status };
  // Đóng dấu thời điểm hoàn thành (phục vụ auto-cleanup proof 1 tháng); rời khỏi
  // "completed" thì xoá dấu.
  if (status === "completed") patch.completed_at = new Date().toISOString();
  else patch.completed_at = null;

  const { error } = await db.from("studio_contracts").update(patch).eq("id", contractId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Trạng thái là thứ QUYẾT ĐỊNH hợp đồng có nằm trên Google Lịch hay không
  // (chỉ approved/in_progress/completed mới lên). Đồng bộ ngay sau khi ghi, cả
  // hai chiều: sang trạng thái đã chốt thì tạo/cập nhật sự kiện, lùi về nháp
  // hoặc huỷ thì `syncContractCalendar` tự gỡ sự kiện cũ xuống. Trước đây bảng
  // công việc kéo thẻ đổi trạng thái mà Google Lịch không hề đổi theo.
  let gcal: string | null = null;
  if (contract.status !== status) {
    const r = await syncContractCalendar(user.id, contractId);
    gcal = r.contract.synced ? null : r.contract.reason ?? null;
  }

  // Chuyển SANG "đang thực hiện" / "hoàn thành" → giờ mới tạo album CHỌN ẢNH
  // (trước mốc này album được giữ chưa tạo để không hiện trong thư viện). Bao cả
  // completed để trường hợp bỏ qua bước in_progress vẫn có album chọn ảnh.
  if ((status === "in_progress" || status === "completed") && contract.status !== status) {
    try {
      await autoCreateContractSelectionOnProduction(user.id, contractId);
    } catch {
      // Studio chưa nối Drive / lỗi tạm — desktop sẽ tạo bù khi đồng bộ.
    }
  }

  // Chuyển SANG "completed" (từ trạng thái khác) → CHỐT GIAO KHÁCH nếu ảnh đã
  // xử lý xong. Chưa xong thì hợp đồng vẫn hoàn thành (tiền đã thu đủ) mà album
  // ở nguyên giai đoạn chọn ảnh — cron ngày hôm sau tạo album giao khách khi ảnh
  // lên Drive, hoặc studio bấm "Giao khách ngay" ở tab Sản phẩm.
  let deliveryAlbum = false;
  let deliveryWaiting = false;
  if (status === "completed" && contract.status !== "completed") {
    const r = await deliverContractIfReady(user.id, contractId, { notifyExisting: true });
    deliveryAlbum = r.album;
    deliveryWaiting = r.waiting;
  }

  return NextResponse.json({ ok: true, deliveryAlbum, deliveryWaiting, gcal });
}
