import { redirect } from "next/navigation";

/**
 * Lịch đội ngũ đã GỘP thành tab của màn "Lịch làm việc".
 *
 * Giữ route và chuyển hướng chứ không xoá: thông báo đẩy gửi cho chủ studio khi
 * thợ phản hồi (src/app/api/crew/route.ts) trỏ vào đây, và màn sổ thợ còn liên
 * kết tới.
 */
export default function TeamRedirectPage() {
  redirect("/dashboard/studio/calendar?tab=team");
}
