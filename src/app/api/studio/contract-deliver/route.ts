import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverContractIfReady } from "@/lib/contract-delivery";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * "Giao khách ngay" — tạo album giao khách cho hợp đồng KHÔNG đợi ảnh trên Drive.
 *
 * Bình thường album giao khách chỉ sinh ra khi thư mục ảnh chỉnh sửa đã có ảnh
 * (hợp đồng hoàn thành = thu đủ tiền, chưa chắc hậu kỳ xong). Nút này là lối
 * thoát cho studio tự biết mình đã xong: gửi ảnh nơi khác, ảnh vừa lên chưa kịp
 * chờ cron, hoặc thư mục Drive không phải nguồn thật.
 *
 * POST { contractId } → { ok, album, created, waiting }
 */
export async function POST(req: Request) {
  const profile = await requireStudio();
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { contractId } = (await req.json().catch(() => ({}))) as { contractId?: string };
  if (!contractId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const db = createAdminClient();
  const { data: c } = await db
    .from("studio_contracts")
    .select("id, owner_id, assigned_to, gallery_album_id")
    .eq("id", contractId)
    .maybeSingle();
  if (!c || c.owner_id !== profile.id) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Nhân viên thường chỉ giao khách hợp đồng ĐƯỢC GIAO cho mình (giống contract-crew).
  if (profile.actingRole === "staff" && c.assigned_to !== profile.actingUserId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const r = await deliverContractIfReady(profile.id, contractId, { force: true, notifyExisting: true });
  if (!r.album) {
    return NextResponse.json({ error: deliveryReasonMessage(r.reason), reason: r.reason ?? null }, { status: 400 });
  }

  const { data: fresh } = await db
    .from("studio_contracts")
    .select("gallery_album_id, selection_album_id")
    .eq("id", contractId)
    .maybeSingle();
  return NextResponse.json({
    ok: true,
    ...r,
    galleryAlbumId: fresh?.gallery_album_id ?? null,
    selectionAlbumId: fresh?.selection_album_id ?? null,
  });
}

/**
 * Câu báo lỗi đúng với lý do thật. Trước đây mọi thất bại đều ra "chưa có thư
 * mục Drive" — kể cả khi Drive ổn mà database từ chối tạo album (trigger
 * enforce_album_quota chặn gallery vì tài khoản chưa bật quyền gallery).
 */
function deliveryReasonMessage(reason: string | undefined): string {
  if (reason === "no_delivery_folder") {
    return "Chưa giao được: cây thư mục Drive của hợp đồng không có thư mục giao khách (File ChinhSua). Kiểm tra mẫu thư mục ở Đồng bộ Drive.";
  }
  if (reason === "manual_no_link") {
    return "Chưa giao được: hợp đồng dùng link ảnh riêng — dán link ảnh hoàn thiện (Google Drive) vào album của hợp đồng ở tab Sản phẩm trước.";
  }
  if (reason === "waiting") {
    return "Chưa giao được: thư mục ảnh chỉnh sửa trên Drive còn trống.";
  }
  if (reason?.startsWith("insert_failed:")) {
    return `Chưa tạo được album giao khách: ${reason.slice("insert_failed:".length)}`;
  }
  if (reason?.startsWith("update_failed:")) {
    return `Chưa chuyển được album sang giai đoạn Giao khách: ${reason.slice("update_failed:".length)}`;
  }
  return "Chưa tạo được album giao khách — hợp đồng chưa có thư mục Drive (vào Đồng bộ Drive để kết nối/tạo).";
}
