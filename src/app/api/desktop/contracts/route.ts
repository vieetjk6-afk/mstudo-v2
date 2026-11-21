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
 *   GET /api/desktop/contracts?status=in_progress,post_production → lọc theo
 *       trạng thái (vòng theo dõi nhanh của desktop chỉ quét hợp đồng đang làm để
 *       đồng bộ ảnh gần như tức thì mà không phải quét toàn bộ)
 * Trả kèm `now` để client lưu làm mốc lần-đồng-bộ-cuối (tải bù khi mở app).
 */

// Supabase trả tối đa 1000 dòng mỗi lượt (`range(0, 9999)` KHÔNG nâng được trần
// đó) — studio nhiều hợp đồng mà chỉ lấy một lượt là lần đồng bộ đầu bỏ sót hợp
// đồng cũ vĩnh viễn. Lật từng trang.
const PAGE = 1000;
export async function GET(req: Request) {
  const auth = await requireDesktopOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const driveReady = url.searchParams.get("drive") === "1";
  const signedOnly = url.searchParams.get("signed") !== "0";
  const statuses = (url.searchParams.get("status") || "").split(",").filter((s) => STATUSES.has(s));
  const status = statuses.length > 0;
  // Mốc trả về cho client lấy TRƯỚC khi truy vấn (lùi 5 giây cho lệch đồng hồ):
  // lấy sau thì hợp đồng ghi vào giữa lúc truy vấn chạy có updated_at < now mà
  // không nằm trong kết quả → client lưu mốc rồi không bao giờ tải nó nữa.
  const now = new Date(Date.now() - 5000).toISOString();

  const page = (from: number) => {
    let q = createAdminClient()
      .from("studio_contracts")
      .select("id, code, title, client_name, client_phone, status, event_date, client_signed_at, studio_signed_at, created_at, updated_at")
      .eq("owner_id", auth.ownerId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (driveReady) {
      // Sẵn sàng tạo thư mục: khách đã ký HOẶC đã duyệt/đang thực hiện/hậu kỳ/hoàn
      // thành — khớp điều kiện ở /api/desktop/drive/prepare. Hợp đồng đã huỷ thì
      // thôi, dù khách từng ký.
      q = q
        .or("client_signed_at.not.is.null,status.in.(approved,in_progress,post_production,completed)")
        .neq("status", "cancelled");
    } else if (signedOnly) {
      q = q.not("client_signed_at", "is", null);
    }
    if (status) q = q.in("status", statuses);
    if (since) q = q.gt("updated_at", since);
    return q;
  };

  let contracts: { id: string; [k: string]: unknown }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    contracts.push(...((data ?? []) as typeof contracts));
    if (!data || data.length < PAGE) break;
  }
  // Danh sách để ĐỒNG BỘ DRIVE (?drive=1, vòng theo dõi ?status=…): bỏ hợp đồng
  // "Nhập link ảnh riêng" — chúng cố ý không có thư mục, gọi prepare chỉ nhận 409.
  // Truy vấn riêng cột album_mode: chưa chạy migration thì bỏ qua bước lọc.
  if ((driveReady || status) && contracts.length) {
    const { data: manual, error: mErr } = await createAdminClient()
      .from("studio_contracts")
      .select("id")
      .eq("owner_id", auth.ownerId)
      .eq("album_mode", "manual");
    if (!mErr && manual?.length) {
      const skip = new Set(manual.map((r) => r.id as string));
      contracts = contracts.filter((c) => !skip.has(c.id));
    }
  }
  return NextResponse.json({ contracts, now });
}
