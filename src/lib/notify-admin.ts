import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToOwners } from "@/lib/push";
import type { NotificationKind } from "@/lib/types";

/**
 * Gửi thông báo hệ thống tới TẤT CẢ quản trị viên (mỗi admin 1 dòng trong
 * studio_notifications, hiển thị ở chuông + trang Thông báo của họ). Dùng cho
 * sự kiện cấp nền tảng: tài khoản mới, yêu cầu nâng cấp, liên hệ/góp ý.
 *
 * No-op an toàn nếu không có admin. Không ném lỗi để không làm hỏng luồng gốc.
 */
export async function notifyAdmins(
  kind: NotificationKind,
  message: string,
  opts: { push?: boolean; url?: string } = {},
): Promise<void> {
  try {
    const db = createAdminClient();
    const { data: admins } = await db
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("is_active", true);

    const ids = (admins ?? []).map((a) => a.id);
    if (ids.length === 0) return;

    await db.from("studio_notifications").insert(
      ids.map((owner_id) => ({ owner_id, contract_id: null, kind, message })),
    );

    if (opts.push) {
      await sendPushToOwners(ids, {
        title: "MStudo",
        body: message,
        // Mặc định về trang thông báo; việc nào có nút bấm ngay (duyệt chuyển
        // khoản chẳng hạn) thì truyền thẳng trang xử lý — chạm vào thông báo
        // trên điện thoại mà rơi vào màn chỉ để đọc là phải mò tiếp.
        url: opts.url ?? "/dashboard/studio/notifications",
        tag: `admin-${kind}`,
      });
    }
  } catch {
    // Bỏ qua: thông báo cho admin không được phép làm hỏng hành động chính.
  }
}
