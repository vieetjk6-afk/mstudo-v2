import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCreateContractDeliveryOnComplete, type DeliveryAlbumResult } from "@/lib/studio-drive";
import { autoNotify } from "@/lib/zalo/notify";
import { deliveryReadyMessage } from "@/lib/zalo/messages";
import { studioUrl } from "@/lib/hosts";
import { getStudioHost } from "@/lib/studio-site";

/**
 * Chốt giai đoạn GIAO KHÁCH của hợp đồng — điểm gọi CHUNG cho web (đổi trạng
 * thái), app desktop, cron và nút "Giao khách ngay".
 *
 * Quy tắc: hợp đồng "hoàn thành" mới chỉ là chuyện tiền. Chỉ khi thư mục ảnh
 * chỉnh sửa đã CÓ ẢNH mới tạo album giao khách và báo khách; chưa có thì hợp
 * đồng vẫn hoàn thành nhưng khách ở nguyên giai đoạn chọn ảnh.
 *
 * `opts.force` = studio tự quyết định giao ngay (không đợi ảnh trên Drive).
 * `opts.notifyExisting` = báo khách cả khi album giao khách đã có sẵn từ trước
 * (đúng lúc studio bấm hoàn thành / bấm giao khách). Các lối chạy nền thì chỉ
 * báo khi VỪA tạo album, để một lần đồng bộ lại không dựng dậy tin cũ.
 */
export async function deliverContractIfReady(
  ownerId: string,
  contractId: string,
  opts?: { force?: boolean; notifyExisting?: boolean }
): Promise<DeliveryAlbumResult> {
  let res: DeliveryAlbumResult = { album: false, created: false, waiting: false };
  try {
    res = await autoCreateContractDeliveryOnComplete(ownerId, contractId, { force: opts?.force });
  } catch {
    // Studio chưa nối Drive / lỗi tạm — cron hoặc lần đồng bộ sau tạo bù.
    return res;
  }
  if (res.created || (res.album && opts?.notifyExisting)) {
    try {
      await notifyDeliveryReady(ownerId, contractId);
    } catch {
      /* Zalo lỗi không được chặn việc giao khách */
    }
  }
  return res;
}

/**
 * Báo khách "ảnh đã sẵn sàng" kèm link album — đúng MỘT lần cho mỗi hợp đồng
 * (chống trùng bằng chính lịch sử tin đã gửi, vì hàm này được gọi từ nhiều lối:
 * đổi trạng thái trên web, app desktop, cron hằng ngày).
 */
async function notifyDeliveryReady(ownerId: string, contractId: string): Promise<void> {
  const db = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: sent } = await db
    .from("zalo_messages")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("contract_id", contractId)
    .eq("kind", "delivery_ready")
    .eq("status", "sent")
    .gte("created_at", since)
    .limit(1);
  if (sent?.length) return;

  const { data: c } = await db
    .from("studio_contracts")
    .select("client_name, client_phone, gallery_album_id")
    .eq("id", contractId)
    .maybeSingle();
  if (!c?.client_phone || !c.gallery_album_id) return;
  const { data: al } = await db.from("albums").select("slug").eq("id", c.gallery_album_id).maybeSingle();
  if (!al?.slug) return;

  const { data: owner } = await db.from("profiles").select("full_name").eq("id", ownerId).maybeSingle();
  // Domain riêng của studio cho link album gửi khách.
  const link = studioUrl(await getStudioHost(db, ownerId), `/album/${al.slug}`);
  await autoNotify({
    ownerId,
    event: "delivery_ready",
    audience: "client",
    toPhone: c.client_phone,
    toName: c.client_name,
    body: deliveryReadyMessage({ name: c.client_name, link, studio: owner?.full_name }),
    contractId,
  });
}
