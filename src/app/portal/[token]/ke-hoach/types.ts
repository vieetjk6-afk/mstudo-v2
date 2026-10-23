import type { ContractStatus } from "@/lib/types";
import type { AutoLinks, DayRow, StudioBudgetLine, WeddingPlanData } from "@/lib/wedding-plan";

/* ═══════════════════════════════════════════════════════════════════════════
   Hình dữ liệu của trang kế hoạch cưới — đúng phần payload mà
   `POST /api/c/[token]/ke-hoach` trả về. Hẹp hơn cổng khách chính: trang này
   không cần tiền công, hạng mục hay ảnh — chỉ những gì một kế hoạch cưới đọc.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PlannerGuests = {
  /** Số khách mời trong danh sách của thiệp. */
  total: number;
  /** Khách mời (trong danh sách) đã báo sẽ dự. */
  attending: number;
  /** Tổng số người sẽ đến, gồm cả khách ngoài danh sách. */
  people: number;
  /** Số phản hồi đã nhận. */
  replies: number;
  /** Trình sửa thiệp — nơi khách quản lý danh sách khách mời. */
  href: string;
};

export type PlannerPayload = {
  /** false = studio chưa bật kế hoạch cưới cho hợp đồng này. */
  enabled: boolean;
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
  guests: PlannerGuests | null;
  plan_locked: boolean;
};

/** Phản hồi của một thao tác ghi: chỉ phần kế hoạch, phần còn lại không đổi. */
export type PlannerOpResponse = {
  plan: WeddingPlanData;
  updated_at: string | null;
  error?: string;
};
