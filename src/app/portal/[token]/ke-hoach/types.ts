import type { ContractStatus } from "@/lib/types";
import type { AutoLinks, DayRow, StudioAppt, StudioBudgetLine, WeddingPlanData } from "@/lib/wedding-plan";

/* ═══════════════════════════════════════════════════════════════════════════
   Hình dữ liệu của trang kế hoạch cưới — đúng phần payload mà
   `POST /api/c/[token]/ke-hoach` trả về. Hẹp hơn cổng khách chính: trang này
   không cần tiền công, hạng mục hay ảnh — chỉ những gì một kế hoạch cưới đọc.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Thiệp cưới online studio tặng — nguồn phản hồi tham dự của khách mời. */
export type PlannerInvite = {
  /** Trình sửa thiệp. */
  href: string;
  published: boolean;
  /** Danh sách khách trong thiệp (link mời riêng) — để nhập sang danh sách khách mời. */
  names: string[];
  /** Phản hồi khách gửi qua thiệp; trang khớp với danh sách khách mời theo tên. */
  replies: { guest_name: string; attending: boolean; num_guests: number; created_at: string }[];
};

export type PlannerPayload = {
  enabled: boolean;
  /**
   * Database đã có cột `extra` (migrations/ke_hoach_cuoi_mo_rong.sql). false = chỉ
   * lưu được việc cần làm, ngân sách, lịch trình; các mục mới tạm ẩn.
   */
  ext: boolean;
  contract: {
    title: string;
    client_name: string | null;
    event_date: string | null;
    status: ContractStatus;
  };
  studio_name: string;
  studio_phone: string | null;
  plan: WeddingPlanData;
  /** Lần lưu cuối; null = kế hoạch chưa được lưu lần nào. */
  updated_at: string | null;
  /** Việc tự tick từ dữ liệu studio (đã ký, đã chụp, thiệp, album, thanh toán). */
  auto: AutoLinks;
  /** Gói của studio — một dòng ngân sách đọc từ hợp đồng, khách không sửa. */
  studio_line: StudioBudgetLine | null;
  /** Lịch hẹn studio xếp trong đúng ngày cưới (chỉ đọc). */
  studio_day: DayRow[];
  /** Lịch hẹn studio từ hôm nay trở đi (thử đồ, chụp, trang điểm…). */
  studio_appts: StudioAppt[];
  invite: PlannerInvite | null;
  plan_locked: boolean;
};

/** Phản hồi của một thao tác ghi: chỉ phần kế hoạch, phần còn lại không đổi. */
export type PlannerOpResponse = {
  plan: WeddingPlanData;
  updated_at: string | null;
  error?: string;
};
