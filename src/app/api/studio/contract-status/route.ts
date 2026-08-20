import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCreateContractDeliveryOnComplete, autoCreateContractSelectionOnProduction } from "@/lib/studio-drive";
import { autoNotify } from "@/lib/zalo/notify";
import { deliveryReadyMessage } from "@/lib/zalo/messages";
import { studioUrl } from "@/lib/hosts";
import { getStudioHost } from "@/lib/studio-site";

export const dynamic = "force-dynamic";

const VALID = new Set(["draft", "sent", "approved", "in_progress", "completed", "cancelled"]);

/**
 * Đổi trạng thái hợp đồng — điểm TẬP TRUNG cho mọi nơi trên web (ContractEditor,
 * bảng công việc, danh sách hợp đồng). Đặt ở server để:
 *   1. Luôn đóng dấu completed_at nhất quán (trước đây board & list bỏ sót).
 *   2. Khi chuyển sang "completed" thì TỰ TẠO album giao khách (phase delivery)
 *      — album chọn ảnh đã được tạo lúc khách ký.
 * Yêu cầu chủ hợp đồng (RLS-scoped: chỉ owner mới đổi được).
 */
export async function POST(req: Request) {
  const supabase = createClient();
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

  // Chuyển SANG "completed" (từ trạng thái khác) → tạo album giao khách.
  let deliveryAlbum = false;
  if (status === "completed" && contract.status !== "completed") {
    try {
      deliveryAlbum = await autoCreateContractDeliveryOnComplete(user.id, contractId);
    } catch {
      // Studio chưa nối Drive / lỗi tạm — desktop sẽ tạo bù khi đồng bộ.
    }
    // Zalo: tự báo "đã giao ảnh" cho khách (nếu studio đã bật mốc + kết nối).
    // Không chặn response nếu lỗi.
    try {
      const { data: c2 } = await db
        .from("studio_contracts")
        .select("title, client_name, client_phone, gallery_album_id")
        .eq("id", contractId)
        .maybeSingle();
      if (c2?.client_phone && c2.gallery_album_id) {
        const { data: al } = await db.from("albums").select("slug").eq("id", c2.gallery_album_id).maybeSingle();
        if (al?.slug) {
          const { data: owner } = await db.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
          // Domain riêng của studio cho link album gửi khách.
          const link = studioUrl(await getStudioHost(db, user.id), `/album/${al.slug}`);
          await autoNotify({
            ownerId: user.id,
            event: "delivery_ready",
            audience: "client",
            toPhone: c2.client_phone,
            toName: c2.client_name,
            body: deliveryReadyMessage({ name: c2.client_name, link, studio: owner?.full_name }),
            contractId,
          });
        }
      }
    } catch {
      /* bỏ qua — không chặn đổi trạng thái */
    }
  }

  return NextResponse.json({ ok: true, deliveryAlbum });
}
