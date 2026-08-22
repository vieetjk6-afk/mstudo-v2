import { redirect } from "next/navigation";

/**
 * Lịch studio đã GỘP thành tab của màn "Lịch làm việc".
 *
 * Route này giữ lại và chuyển hướng chứ không xoá: nó từng là mục sidebar nên
 * studio đã bookmark, và nhiều chỗ trong app còn liên kết tới nó — cổng nhân
 * viên (/staff), khối lịch hẹn trong chi tiết hợp đồng, và link thông báo
 * `schedule_reminder` trong src/lib/notifications.ts.
 */
export default function StudioScheduleRedirectPage() {
  redirect("/dashboard/studio/calendar?tab=studio");
}
