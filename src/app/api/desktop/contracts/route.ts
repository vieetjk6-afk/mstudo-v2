import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDesktopOwner } from "@/lib/desktop/auth";

export const dynamic = "force-dynamic";

const STATUSES = new Set(["draft", "sent", "approved", "in_progress", "post_production", "completed", "cancelled"]);

/**
 * Danh sách hợp đồng cho MStudo Desktop.
 *   GET /api/desktop/contracts?since=ISO      → hợp đồng ĐÃ KÝ thay đổi sau `since`
 *   GET /api/desktop/contracts?signed=0       → gồm cả hợp đồng chưa ký
 *   GET /api/desktop/contracts?drive=1        → hợp đồng ĐÃ SẴN SÀNG tạo thư mục:
 *       khách đã ký HOẶC studio đã duyệt/đang thực hiện/hoàn thành (khớp điều kiện
 *       tạo cây thư mục ở /api/desktop/drive/prepare — nếu chỉ lọc "đã ký" thì hợp
 *       đồng studio tự duyệt (không cần khách e-ký) sẽ không được tạo thư mục).
 *   GET /api/desktop/contracts?status=in_progress → lọc theo trạng thái (vòng theo
 *       dõi nhanh của desktop chỉ quét hợp đồng "đang thực hiện" để đồng bộ ảnh
 *       gần như tức thì mà không phải quét toàn bộ)
 * Trả kèm `now` để client lưu làm mốc lần-đồng-bộ-cuối (tải bù khi mở app).
 */
export async function GET(req: Request) {
  const auth = await requireDesktopOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const driveReady = url.searchParams.get("drive") === "1";
  const signedOnly = url.searchParams.get("signed") !== "0";
  const status = url.searchParams.get("status");

  let q = createAdminClient()
    .from("studio_contracts")
    .select("id, code, title, client_name, client_phone, status, event_date, client_signed_at, studio_signed_at, created_at, updated_at")
    .eq("owner_id", auth.ownerId)
    .order("updated_at", { ascending: false })
    .range(0, 9999);
  if (driveReady) {
    // Sẵn sàng tạo thư mục: khách đã ký HOẶC đã duyệt/đang thực hiện/hoàn thành.
    q = q.or("client_signed_at.not.is.null,status.in.(approved,in_progress,completed)");
  } else if (signedOnly) {
    q = q.not("client_signed_at", "is", null);
  }
  if (status && STATUSES.has(status)) q = q.eq("status", status);
  if (since) q = q.gt("updated_at", since);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contracts: data ?? [], now: new Date().toISOString() });
}
