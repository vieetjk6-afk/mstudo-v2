import { redirect } from "next/navigation";

/**
 * Xếp hạng thợ đã GỘP thành tab 3 của màn Nhân sự — nó trả lời cùng câu hỏi
 * "ai làm cho studio này" với hai tab kia mà chỉ mở vài lần một tháng, không
 * đáng một dòng sidebar riêng (đúng tiền lệ của Sổ thợ trước đây).
 *
 * Giữ route cũ và chuyển hướng: studio đã bookmark, và ⌘K vẫn còn từ khoá cũ.
 */
export default function RankingRedirect() {
  redirect("/dashboard/studio/staff?tab=ranking");
}
