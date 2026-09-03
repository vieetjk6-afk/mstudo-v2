import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";

export const dynamic = "force-dynamic";

/**
 * Số đếm cho badge trên sidebar (bản thiết kế: Báo giá(2) · Đặt lịch khách(3) ·
 * Yêu cầu mới(3) · Xử lý hình ảnh(4) · Thông báo(5)).
 *
 * Gọi từ client sau khi shell đã vẽ xong, KHÔNG chặn TTFB của trang: nếu đếm
 * trong layout thì mọi trang dashboard phải chờ thêm 5 query mới trả HTML.
 * Chỉ đếm việc CHƯA XỬ LÝ — badge phải tự mất khi làm xong, nếu không nó thành
 * con số trang trí và người dùng ngưng nhìn.
 */
export async function GET() {
  const profile = await requireStudio("booking");
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ownerId = profile.id; // requireStudio đã đổi sang hồ sơ CHỦ studio cho nhân viên
  const supabase = createClient();
  const head = { count: "exact" as const, head: true };

  const [quotes, bookings, leads, production, notifications, inbox, reviews] = await Promise.all([
    // Báo giá đang chờ khách phản hồi (đã gửi / khách đã xem / khách xin chỉnh).
    supabase.from("studio_quotes").select("id", head).eq("owner_id", ownerId)
      .in("status", ["sent", "viewed", "adjust_requested"]),
    supabase.from("studio_bookings").select("id", head).eq("owner_id", ownerId).eq("status", "new"),
    supabase.from("website_leads").select("id", head).eq("owner_id", ownerId).eq("status", "new"),
    // Hạng mục sản xuất chưa giao xong; nhân sự chỉ đếm phần được phân công.
    (() => {
      let q = supabase
        .from("contract_products")
        .select("id, contract:studio_contracts!inner(owner_id, assigned_to)", head)
        .eq("contract.owner_id", ownerId)
        .neq("status", "done");
      if (profile.actingRole === "staff") q = q.eq("contract.assigned_to", profile.actingUserId);
      return q;
    })(),
    // Thông báo của CHÍNH người đang đăng nhập (không phải của cả studio).
    supabase.from("studio_notifications").select("id", head)
      .eq("owner_id", profile.actingUserId).eq("read", false),
    // Hộp thư: đếm HỘI THOẠI còn tin chưa đọc, không phải tổng số tin. Khách
    // nhắn liên tiếp 8 tin vẫn chỉ là MỘT việc phải xử lý; đếm theo tin thì
    // badge phồng lên vô nghĩa và người ta thôi nhìn nó.
    supabase.from("inbox_conversations").select("id", head)
      .eq("owner_id", ownerId).eq("status", "open").gt("unread", 0),
    // Đánh giá khách CHƯA QUYẾT cho hiện hay ẩn. `approved=false` một mình
    // không đủ: bản studio đã chủ động ẩn cũng là false, mà việc đó xử lý rồi —
    // đếm nó nữa thì badge không bao giờ về 0. Chủ studio xác định qua ALBUM,
    // đúng đường RLS đang dùng.
    supabase.from("feedback")
      .select("id, album:albums!inner(owner_id)", head)
      .eq("album.owner_id", ownerId)
      .eq("approved", false)
      .is("moderated_at", null),
  ]);

  return NextResponse.json({
    quotes: quotes.count ?? 0,
    bookings: bookings.count ?? 0,
    leads: leads.count ?? 0,
    production: production.count ?? 0,
    notifications: notifications.count ?? 0,
    inbox: inbox.count ?? 0,
    reviews: reviews.count ?? 0,
  });
}
