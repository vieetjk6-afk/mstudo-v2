import {
  PenLine, MessageSquare, UserCheck, UserX, Star, Wallet, Bell, FileCheck, Megaphone,
  UserPlus, ArrowUpCircle, Mail, ImageDown, AlarmClock, CalendarCog, UserPlus2,
  FilePlus2, Crown, WalletCards, ClipboardList,
  type LucideIcon,
} from "lucide-react";
import type { NotificationKind, StudioNotification } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   THÔNG BÁO — icon, màu, nhãn cho MỌI loại thông báo, khai báo MỘT chỗ.

   Trước đây bảng icon + bảng màu nằm ngay trong NotificationsList.tsx của khu
   quản lý. Cổng nhân viên (/staff) hiện đúng những thông báo đó nên phải dùng
   cùng bộ icon/màu — nếu mỗi màn tự khai một bảng thì thêm một loại thông báo
   là phải sửa hai nơi, và sớm muộn hai nơi lệch nhau.
   ═══════════════════════════════════════════════════════════════════════════ */

export type NotificationMeta = {
  Icon: LucideIcon;
  /** Màu chữ/icon. */
  fg: string;
  /** Nền nhạt của ô icon. */
  soft: string;
  /** Nhãn nhóm ngắn — cổng nhân viên hiện kèm tiêu đề. */
  label: string;
};

export const NOTIFICATION_KIND_META: Record<NotificationKind, NotificationMeta> = {
  signed: { Icon: PenLine, fg: "var(--gn)", soft: "var(--gnS)", label: "Khách đã ký" },
  edit_request: { Icon: MessageSquare, fg: "var(--am)", soft: "var(--amS)", label: "Yêu cầu sửa" },
  crew_accepted: { Icon: UserCheck, fg: "var(--gn)", soft: "var(--gnS)", label: "Thợ nhận việc" },
  crew_declined: { Icon: UserX, fg: "var(--rd)", soft: "var(--rdS)", label: "Thợ từ chối" },
  review: { Icon: Star, fg: "var(--am)", soft: "var(--amS)", label: "Đánh giá" },
  payment: { Icon: Wallet, fg: "var(--bl)", soft: "var(--blS)", label: "Thanh toán" },
  quote_accepted: { Icon: FileCheck, fg: "var(--gn)", soft: "var(--gnS)", label: "Chốt báo giá" },
  announcement: { Icon: Megaphone, fg: "var(--tl)", soft: "var(--tlS)", label: "Thông báo chung" },
  new_user: { Icon: UserPlus, fg: "var(--bl)", soft: "var(--blS)", label: "Người dùng mới" },
  upgrade_request: { Icon: ArrowUpCircle, fg: "var(--am)", soft: "var(--amS)", label: "Yêu cầu nâng cấp" },
  contact: { Icon: Mail, fg: "var(--gn)", soft: "var(--gnS)", label: "Liên hệ" },
  selection: { Icon: ImageDown, fg: "var(--bl)", soft: "var(--blS)", label: "Khách chọn ảnh" },
  // Ba loại của cổng nhân viên. Bản thiết kế: alarm (--ac), edit_calendar (--am),
  // person_add (--bl) — icon lucide tương đương.
  schedule_reminder: { Icon: AlarmClock, fg: "var(--ac)", soft: "var(--acS)", label: "Nhắc lịch" },
  contract_changed: { Icon: CalendarCog, fg: "var(--am)", soft: "var(--amS)", label: "Hợp đồng thay đổi" },
  contract_created: { Icon: FilePlus2, fg: "var(--gn)", soft: "var(--gnS)", label: "Hợp đồng mới" },
  assigned: { Icon: UserPlus2, fg: "var(--bl)", soft: "var(--blS)", label: "Phân công" },
  // Kết quả thanh toán gói dịch vụ MStudo — studio thấy ở chuông của họ.
  plan_activated: { Icon: Crown, fg: "var(--gn)", soft: "var(--gnS)", label: "Nâng cấp thành công" },
  payment_failed: { Icon: WalletCards, fg: "var(--rd)", soft: "var(--rdS)", label: "Thanh toán thất bại" },
  intake: { Icon: ClipboardList, fg: "var(--tl)", soft: "var(--tlS)", label: "Thông tin buổi chụp" },
  info: { Icon: Bell, fg: "var(--tx3)", soft: "var(--sf2)", label: "Thông tin" },
};

export function notificationMeta(kind: string): NotificationMeta {
  return NOTIFICATION_KIND_META[kind as NotificationKind] ?? NOTIFICATION_KIND_META.info;
}

/**
 * Nơi một thông báo trỏ tới trong KHU QUẢN LÝ. Tách khỏi component để cổng nhân
 * viên dùng lại được (nó cũng cho bấm vào thông báo để mở hợp đồng liên quan).
 */
/**
 * Chỗ admin DUYỆT yêu cầu nâng cấp.
 *
 * Khai một chỗ vì đường dẫn này từng nằm rải ba nơi (hàm dưới + hai route API
 * gửi push) và đã lệch nhau: mục "Yêu cầu nâng cấp" được dọn từ trang Cấu hình
 * sang khu Người dùng & studio, nhưng cả ba chuỗi `/dashboard/settings` thì
 * không ai sửa theo — admin bấm vào thông báo có tiền đang chờ lại rơi vào
 * trang cấu hình, không có nút duyệt nào.
 *
 * Neo `#yeu-cau-nang-cap` để rơi đúng khối, vì nó nằm dưới cả bảng tài khoản
 * dài — mở trang ra mà phải cuộn đi tìm thì cũng gần như lạc.
 */
export const UPGRADE_REVIEW_HREF = "/dashboard/admin#yeu-cau-nang-cap";

/** Màn "Thông tin buổi chụp" (form khách điền) của một hợp đồng. */
export function intakeViewHref(contractId: string): string {
  return `/dashboard/studio/contracts/${contractId}/buoi-chup`;
}

/**
 * Thông báo "khách đã điền thông tin buổi chụp". Bản cũ lưu kind "info" và
 * nhét cả khối chi tiết vào message — vẫn nhận ra qua câu mở đầu để những
 * thông báo đã có trong chuông cũng mở đúng màn và hiện gọn.
 */
function isIntake(n: Pick<StudioNotification, "kind" | "contract_id"> & { message?: string }): boolean {
  if (!n.contract_id) return false;
  return n.kind === "intake" || (n.kind === "info" && /đã điền thông tin buổi chụp/.test(n.message ?? ""));
}

/** Nội dung hiện trong danh sách. Thông báo form cũ chỉ giữ câu đầu (chi tiết xem ở màn riêng). */
export function notificationText(n: Pick<StudioNotification, "kind" | "contract_id" | "message">): string {
  if (isIntake(n)) return n.message.split("\n")[0];
  return n.message;
}

export function notificationHref(
  n: Pick<StudioNotification, "kind" | "contract_id" | "album_id"> & { message?: string }
): string | null {
  if (isIntake(n)) return intakeViewHref(n.contract_id!);
  if (n.album_id) return `/dashboard/albums/${n.album_id}`;
  if (n.contract_id) return `/dashboard/studio/contracts/${n.contract_id}`;
  if (n.kind === "quote_accepted") return "/dashboard/studio/quotes";
  if (n.kind === "review") return "/dashboard/studio/ranking";
  if (n.kind === "new_user") return "/dashboard/admin";
  if (n.kind === "upgrade_request") return UPGRADE_REVIEW_HREF;
  if (n.kind === "plan_activated" || n.kind === "payment_failed") return "/dashboard/upgrade";
  if (n.kind === "contract_created" && n.contract_id) return `/dashboard/studio/contracts/${n.contract_id}`;
  if (n.kind === "contact") return "/dashboard/settings";
  if (n.kind === "schedule_reminder" || n.kind === "assigned") return "/dashboard/studio/calendar?tab=studio";
  return null;
}
