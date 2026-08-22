import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushConfigured, sendPushToSubscriptions } from "@/lib/push";

export const dynamic = "force-dynamic";

/* ═══════════════════════════════════════════════════════════════════════════
   GỬI THỬ THÔNG BÁO ĐẨY — /api/push/test

   Vì sao cần: khi studio bảo "điện thoại không còn nhận thông báo", cả ba
   nguyên nhân thường gặp đều KHÔNG để lại dấu vết nào:

     • Máy chủ thiếu khoá VAPID     → mọi lệnh gửi lặng lẽ không làm gì.
     • Đăng ký của máy đã hết hạn   → dịch vụ push trả 410, hàng bị xoá, xong.
     • Dịch vụ push từ chối (403…)  → lỗi bị nuốt trong try/catch của nơi gọi.

   Route này gửi một thông báo thật tới ĐÚNG những thiết bị mà CHÍNH người đang
   đăng nhập đã đăng ký, rồi trả về kết quả từng thiết bị — biến ba trường hợp
   trên thành ba câu trả lời khác nhau, đọc được ngay trên điện thoại.

   Lọc theo `user_id` chứ không phải `owner_id`: nhân viên bấm thử thì rung máy
   của chính họ, không phải rung máy chủ studio.
   ═══════════════════════════════════════════════════════════════════════════ */

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!pushConfigured()) {
    return NextResponse.json({
      ok: false,
      reason: "vapid_missing",
      hint: "Máy chủ chưa có khoá VAPID (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY). Mọi thông báo đẩy đều không được gửi đi.",
      devices: 0,
      results: [],
    });
  }

  const { data: subs } = await createAdminClient()
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user.id);

  const list = (subs ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[];
  if (list.length === 0) {
    return NextResponse.json({
      ok: false,
      reason: "no_subscription",
      hint: "Thiết bị này chưa đăng ký (hoặc đăng ký cũ đã hết hạn và bị gỡ). Bấm Tắt rồi Bật lại thông báo.",
      devices: 0,
      results: [],
    });
  }

  const results = await sendPushToSubscriptions(list, {
    title: "mstudo — thử thông báo",
    body: "Nếu bạn đọc được dòng này thì thông báo đẩy đang hoạt động bình thường.",
    url: "/dashboard/studio/notifications",
    tag: "push-test",
  });

  const sent = results.filter((r) => r.ok).length;
  const pruned = results.filter((r) => r.pruned).length;

  return NextResponse.json({
    ok: sent > 0,
    reason: sent > 0 ? "sent" : pruned === results.length ? "expired" : "rejected",
    hint:
      sent > 0
        ? "Đã gửi. Chưa thấy thông báo hiện lên thì kiểm tra quyền thông báo của mstudo trong Cài đặt điện thoại."
        : pruned === results.length
          ? "Đăng ký của thiết bị đã hết hạn và vừa được gỡ. Bấm Tắt rồi Bật lại thông báo."
          : "Dịch vụ push từ chối. Xem mã lỗi từng thiết bị bên dưới.",
    devices: results.length,
    sent,
    results,
  });
}
