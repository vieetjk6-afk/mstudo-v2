import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCreateContractDeliveryOnComplete, type DeliveryAlbumResult } from "@/lib/studio-drive";
import { autoNotify } from "@/lib/zalo/notify";
import { deliveryReadyMessage, portalLinkMessage } from "@/lib/zalo/messages";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/html-escape";
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
 * `opts.portalOnComplete` = hợp đồng VỪA chuyển sang Hoàn thành: gửi khách link
 * trang riêng (xem `notifyPortalOnComplete`). Tin đó đã dẫn tới album nên khi
 * gửi được thì không gửi thêm tin "ảnh đã sẵn sàng" — khách nhận MỘT tin.
 */
export async function deliverContractIfReady(
  ownerId: string,
  contractId: string,
  opts?: { force?: boolean; notifyExisting?: boolean; portalOnComplete?: boolean }
): Promise<DeliveryAlbumResult & { portalSent?: boolean }> {
  let res: DeliveryAlbumResult = { album: false, created: false, waiting: false };
  let driveOk = true;
  try {
    res = await autoCreateContractDeliveryOnComplete(ownerId, contractId, { force: opts?.force });
  } catch {
    // Studio chưa nối Drive / lỗi tạm — cron hoặc lần đồng bộ sau tạo bù.
    driveOk = false;
  }
  // Link trang riêng KHÔNG phụ thuộc Drive: studio giao bằng link dán tay vẫn
  // phải tới được khách.
  let portalSent = false;
  if (opts?.portalOnComplete) {
    try {
      portalSent = await notifyPortalOnComplete(ownerId, contractId);
    } catch {
      /* Zalo / email lỗi không được chặn việc hoàn thành hợp đồng */
    }
  }
  if (!driveOk || portalSent) return { ...res, portalSent };
  if (res.created || (res.album && opts?.notifyExisting)) {
    try {
      await notifyDeliveryReady(ownerId, contractId);
    } catch {
      /* Zalo lỗi không được chặn việc giao khách */
    }
  }
  return { ...res, portalSent };
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

/**
 * Hợp đồng HOÀN THÀNH → gửi khách link TRANG RIÊNG `/portal/<client_token>`
 * (album, video, file gốc, hợp đồng) qua Zalo — và email nếu khách có email.
 *
 * Gửi đúng MỘT lần cho mỗi hợp đồng: dấu `portal_link_sent_at`
 * (migrations/contract_final_originals.sql) chặn việc studio đổi trạng thái
 * qua lại rồi khách nhận tin lặp. Chưa chạy migration thì chống trùng bằng lịch
 * sử tin Zalo, và KHÔNG gửi email (không có chỗ ghi dấu cho email).
 *
 * Trả `true` khi khách đã có link (vừa gửi được, hoặc đã gửi từ trước).
 */
export async function notifyPortalOnComplete(ownerId: string, contractId: string): Promise<boolean> {
  const db = createAdminClient();
  const { data: c } = await db
    .from("studio_contracts")
    .select("client_name, client_phone, client_email, client_token")
    .eq("id", contractId)
    .maybeSingle();
  if (!c?.client_token) return false;

  const mark = await db.from("studio_contracts").select("portal_link_sent_at").eq("id", contractId).maybeSingle();
  const canMark = !mark.error;
  if (mark.data?.portal_link_sent_at) return true;

  const { data: owner } = await db.from("profiles").select("full_name").eq("id", ownerId).maybeSingle();
  // Domain riêng của studio cho link gửi khách — cùng cách với link album.
  const link = studioUrl(await getStudioHost(db, ownerId), `/portal/${c.client_token}`);
  const body = portalLinkMessage({ name: c.client_name, link, studio: owner?.full_name });

  let sent = false;
  if (c.client_phone) {
    const { data: prev } = await db
      .from("zalo_messages")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("contract_id", contractId)
      .eq("kind", "portal_link")
      .eq("status", "sent")
      .limit(1);
    if (prev?.length) return true;
    const z = await autoNotify({
      ownerId,
      event: "portal_link",
      audience: "client",
      toPhone: c.client_phone,
      toName: c.client_name,
      body,
      contractId,
    });
    sent = z.ok;
  }

  if (canMark && c.client_email) {
    const studio = owner?.full_name || "Studio";
    const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#222">
<p style="white-space:pre-wrap">${escapeHtml(body)}</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#141215;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Mở trang của bạn →</a></p>
<p style="color:#888;font-size:12px">Email tự động từ ${escapeHtml(studio)}.</p></div>`;
    const r = await sendEmail({ to: c.client_email, subject: `${studio}: album & file của bạn đã sẵn sàng`, html });
    sent = sent || r.ok;
  }

  if (sent && canMark) {
    await db.from("studio_contracts").update({ portal_link_sent_at: new Date().toISOString() }).eq("id", contractId);
  }
  return sent;
}
