import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCreateContractSelectionOnProduction, ensureManualContractAlbum } from "@/lib/studio-drive";
import { normalizeAlbumMode, shouldEnsureManualAlbum } from "@/lib/album-mode";
import { deliverContractIfReady } from "@/lib/contract-delivery";
import { syncContractCalendar } from "@/lib/gcal-sync";
import { logAction } from "@/lib/audit-log";
import { isBranchScopedRole, isOwnerLevel } from "@/lib/studio-roles";

export const dynamic = "force-dynamic";
// Tạo album giờ đồng bộ luôn ảnh từ Drive (createAlbumFromFolder) — cần thêm thời gian.
export const maxDuration = 60;

const VALID = new Set(["draft", "sent", "approved", "in_progress", "post_production", "completed", "cancelled"]);

/**
 * Đổi trạng thái hợp đồng — điểm TẬP TRUNG cho mọi nơi trên web (ContractEditor,
 * bảng công việc, danh sách hợp đồng). Đặt ở server để:
 *   1. Luôn đóng dấu completed_at nhất quán (trước đây board & list bỏ sót).
 *   2. Khi chuyển sang "completed" thì tạo album giao khách (phase delivery) —
 *      NHƯNG chỉ khi ảnh chỉnh sửa đã lên Drive. Hoàn thành mà hậu kỳ chưa xong
 *      thì khách vẫn ở giai đoạn chọn ảnh (xem @/lib/contract-delivery).
 *
 * Quyền: requireStudio() — chủ studio VÀ nhân viên (cùng luật màn hợp đồng /
 * contract-deliver: nhân viên thường chỉ đổi hợp đồng được giao cho mình, quản
 * lý chi nhánh chỉ hợp đồng chi nhánh mình). Trước đây route chỉ cho đúng chủ
 * hợp đồng nên nhân viên luôn nhận 404, còn autosave của màn hợp đồng lén ghi
 * `status` thẳng vào bảng — hoàn thành mà không có completed_at, không album,
 * không Google Lịch. Mọi helper Drive/lịch/giao khách nhận id CHỦ studio
 * (profile.id), không phải id nhân viên.
 *
 * Trả kèm { selectionAlbumId, galleryAlbumId } đọc LẠI từ DB để màn hợp đồng
 * cập nhật ô chọn album mà không ghi đè bằng state cũ.
 */
export async function POST(req: Request) {
  const profile = await requireStudio("plus");
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (profile.actingRole === "accountant") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const ownerId = profile.id as string;
  const actorId = profile.actingUserId as string;

  const { contractId, status } = (await req.json().catch(() => ({}))) as { contractId?: string; status?: string };
  if (!contractId || !status || !VALID.has(status)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  // Huỷ là việc của chủ studio (kèm quyết định hoàn / giữ cọc — xem
  // contracts/[id]/cancel). Route này ghi bằng service role nên trigger
  // guard_contract_cancel trong database không chặn hộ được.
  if (status === "cancelled" && !isOwnerLevel(profile.actingRole as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = createAdminClient();
  // Xác minh quyền sở hữu trước khi ghi bằng service role.
  const { data: contract } = await db
    .from("studio_contracts")
    // "*" thay vì liệt kê: branch_id chỉ có sau migrations/studio_branches.sql —
    // nêu tên cột chưa có là cả route 404.
    .select("*")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract || contract.owner_id !== ownerId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (profile.actingRole === "staff" && contract.assigned_to !== actorId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (isBranchScopedRole(profile.actingRole as string)) {
    const mine = (profile.actingBranchId as string | null) ?? null;
    if (!mine || contract.branch_id !== mine) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const patch: { status: string; completed_at?: string | null } = { status };
  // Đóng dấu thời điểm hoàn thành (phục vụ auto-cleanup proof 1 tháng); rời khỏi
  // "completed" thì xoá dấu.
  if (status === "completed") patch.completed_at = new Date().toISOString();
  else patch.completed_at = null;

  const { error } = await db.from("studio_contracts").update(patch).eq("id", contractId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (contract.status !== status) {
    await logAction(db, {
      ownerId, actorId, action: "contract.status", entity: "contract", entityId: contractId,
      summary: `Đổi trạng thái ${contract.status} → ${status}`, before: { status: contract.status }, after: { status },
    });
  }

  // Trạng thái là thứ QUYẾT ĐỊNH hợp đồng có nằm trên Google Lịch hay không
  // (chỉ approved/in_progress/completed mới lên). Đồng bộ ngay sau khi ghi, cả
  // hai chiều: sang trạng thái đã chốt thì tạo/cập nhật sự kiện, lùi về nháp
  // hoặc huỷ thì `syncContractCalendar` tự gỡ sự kiện cũ xuống. Trước đây bảng
  // công việc kéo thẻ đổi trạng thái mà Google Lịch không hề đổi theo.
  let gcal: string | null = null;
  if (contract.status !== status) {
    const r = await syncContractCalendar(ownerId, contractId);
    gcal = r.contract.synced ? null : r.contract.reason ?? null;
  }

  // Chuyển SANG "đang thực hiện" / "hoàn thành" → giờ mới tạo album CHỌN ẢNH
  // (trước mốc này album được giữ chưa tạo để không hiện trong thư viện). Bao cả
  // completed để trường hợp bỏ qua bước in_progress vẫn có album chọn ảnh.
  if ((status === "in_progress" || status === "post_production" || status === "completed") && contract.status !== status) {
    try {
      await autoCreateContractSelectionOnProduction(ownerId, contractId);
    } catch {
      // Studio chưa nối Drive / lỗi tạm — desktop sẽ tạo bù khi đồng bộ.
    }
  }

  // Chế độ "Nhập link ảnh riêng": studio tự chuyển sang "Khách đã duyệt" cũng là
  // khách đã xác nhận → tạo sẵn MỘT album trống cho hợp đồng (idempotent). Các
  // trạng thái sau đó đã được autoCreateContractSelectionOnProduction lo ở trên.
  if (status === "approved" && contract.status !== status && shouldEnsureManualAlbum(normalizeAlbumMode(contract.album_mode), status)) {
    try {
      await ensureManualContractAlbum(ownerId, contractId);
    } catch {
      /* lỗi tạm — nút "Tạo album cho hợp đồng" ở tab Sản phẩm tạo bù */
    }
  }

  // Chuyển SANG "completed" (từ trạng thái khác) → CHỐT GIAO KHÁCH nếu ảnh đã
  // xử lý xong. Chưa xong thì hợp đồng vẫn hoàn thành (tiền đã thu đủ) mà album
  // ở nguyên giai đoạn chọn ảnh — cron ngày hôm sau tạo album giao khách khi ảnh
  // lên Drive, hoặc studio bấm "Giao khách ngay" ở tab Sản phẩm.
  let deliveryAlbum = false;
  let deliveryWaiting = false;
  let portalSent = false;
  let deliveryReason: string | null = null;
  if (status === "completed" && contract.status !== "completed") {
    // portalOnComplete: gửi khách link trang riêng /portal/<token> (một lần).
    const r = await deliverContractIfReady(ownerId, contractId, { notifyExisting: true, portalOnComplete: true });
    deliveryAlbum = r.album;
    deliveryWaiting = r.waiting;
    deliveryReason = r.album ? null : r.reason ?? null;
    portalSent = !!r.portalSent;
  }

  // Id album đọc lại SAU mọi bước trên (album chọn ảnh vừa tạo, album giao vừa
  // tạo) — màn hợp đồng áp thẳng vào state thay vì giữ giá trị cũ.
  const { data: fresh } = await db
    .from("studio_contracts")
    .select("selection_album_id, gallery_album_id")
    .eq("id", contractId)
    .maybeSingle();
  return NextResponse.json({
    ok: true,
    deliveryAlbum,
    deliveryWaiting,
    deliveryReason,
    portalSent,
    gcal,
    selectionAlbumId: (fresh?.selection_album_id as string | null) ?? null,
    galleryAlbumId: (fresh?.gallery_album_id as string | null) ?? null,
  });
}
