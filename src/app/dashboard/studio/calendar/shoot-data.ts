import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { applyBranch, getBranchScope } from "@/lib/branches";
import type { requireStudio } from "@/lib/auth-guards";
export { shiftMonths, WINDOW_MONTHS } from "./range-window";

type Profile = NonNullable<Awaited<ReturnType<typeof requireStudio>>>;

const CONTRACT_COLS =
  "id, code, title, client_name, client_phone, location, event_date, event_time, status, shoot_type, calendar_color, branch_id, contract_items(name, qty, unit_price), contract_crew(id, name, role, status), contract_payments(amount)";

/**
 * Buổi chụp (hợp đồng) + mốc ghi chú trong KHOẢNG NGÀY [from, to].
 *
 * Trước đây màn Lịch đọc TOÀN BỘ lịch sử mỗi lần mở — nặng dần theo tuổi
 * studio, dù người dùng hầu như chỉ xem vài tháng quanh hôm nay. Giờ trang tải
 * ±6 tháng; lật ra ngoài thì trình duyệt gọi /api/studio/calendar-range lấy thêm
 * (cùng hàm này, cùng phạm vi chi nhánh / nhân viên).
 */
export async function loadShootRange(profile: Profile, from: string, to: string) {
  const supabase = await createClient();
  // Chi nhánh đang chọn. Chỉ lọc HỢP ĐỒNG: `studio_events` là mốc ghi chú, phần
  // lớn gắn với một hợp đồng và không có cột chi nhánh riêng — lọc chúng theo
  // chi nhánh sẽ làm mất các mốc studio ghi chung (nghỉ lễ, bảo trì thiết bị).
  const scope = await getBranchScope(profile.id, profile.actingBranchId as string | null, profile.actingRole as string);
  // LẬT TRANG: đọc trơn thì PostgREST cắt ở hàng 1000.
  const [events, contracts] = await Promise.all([
    // Kèm tên & ngày của HỢP ĐỒNG CHÍNH để lịch ghi rõ mốc thuộc hợp đồng nào.
    fetchAllRows<unknown>((a, b) =>
      supabase
        .from("studio_events")
        .select("*, contract:studio_contracts(title, event_date)")
        .eq("owner_id", profile.id)
        .gte("event_date", from)
        .lte("event_date", to)
        .order("event_date")
        .order("id")
        .range(a, b)
    ),
    fetchAllRows<unknown>((a, b) =>
      applyBranch(
        (profile.actingRole === "staff"
          ? supabase.from("studio_contracts").select(CONTRACT_COLS).eq("owner_id", profile.id).eq("assigned_to", profile.actingUserId)
          : supabase.from("studio_contracts").select(CONTRACT_COLS).eq("owner_id", profile.id)
        )
          .gte("event_date", from)
          .lte("event_date", to)
          // Chỉ hiện hợp đồng đã xác nhận/khách đã ký — bỏ nháp & mới gửi.
          .in("status", ["approved", "in_progress", "post_production", "completed"]),
        scope.selected
      )
        .order("id")
        .range(a, b)
    ),
  ]);
  return { events, contracts };
}
