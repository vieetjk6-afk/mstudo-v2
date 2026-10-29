import type { ContractStatus } from "@/lib/types";
import type { BankInfo } from "@/lib/vietqr";

/* Kiểu dữ liệu THUẦN dùng chung giữa page.tsx (tải dữ liệu, vẽ bản cũ) và
   OverviewV2.tsx (vẽ giao diện mới) — để bản V2 nhận đúng dữ liệu đã tính ở
   page.tsx, và màn xem trước bơm được dữ liệu giả. Không có JSX ở đây. */

export type OvTone = "red" | "amber" | "blue" | "green" | "brand" | "gray" | "teal";

/** Thao tác tại chỗ của một việc (thu tiền, mã QR, nhắn nhắc). */
export type OvAct =
  | { kind: "collect"; planId: string; contractId: string; amountLabel: string }
  | { kind: "qr"; amount: number; addInfo: string; planId: string; contractId: string | null; amountLabel: string }
  | { kind: "messenger"; link?: string | null; label: string; message: string };

/** Loại việc — bản V2 dùng để chọn icon và gom nhóm. */
export type OvTaskKind =
  | "crew" | "proof" | "bank" | "plan" | "plan-soon" | "late" | "album" | "sign" | "quote" | "edit" | "pcrew" | "reviews";

export type OvTask = {
  key: string;
  kind: OvTaskKind;
  tone: OvTone;
  title: string;
  sub: string;
  tag: string;
  cta: string;
  href: string;
  act?: OvAct;
};

export type OvScheduleRow = {
  id: string;
  title: string;
  client_name: string | null;
  event_date: string | null;
  event_time: string | null;
  status: ContractStatus;
  location: string | null;
  shootLabel: string;
  crewCount: number;
};

export type OvWarn = { key: string; kind: "day" | "person"; tone: OvTone; title: string; sub: string };

export type OvSla = { id: string; title: string; client_name: string | null; shootLabel: string; delivery_due: string | null; left: number };

export type OvStall = { id: string; title: string; client_name: string | null; reason: string; days: number; tone: OvTone };

export type OvMilestone = {
  key: string;
  contractId: string;
  name: string;
  label: string;
  date: string;
  inDays: number;
  message: string;
};

export type OverviewV2Data = {
  greeting: string;
  firstName: string;
  today: string;
  vnMonth: number;
  todayJobs: number;
  jobsDelta: number;
  revenueMonth: number;
  revDeltaPct: number | null;
  contractsCount: number;
  totalDue: number;
  debtsCount: number;
  overdueDebtsCount: number;
  /** Mọi việc đang treo, đã sắp theo mức gấp (đỏ → vàng → xanh). */
  tasks: OvTask[];
  /** Đợt thu chưa tới hạn nhưng tới hạn trong 7 ngày. */
  dueSoon: OvTask[];
  schedule: OvScheduleRow[];
  warns: OvWarn[];
  sla: OvSla[];
  slaLate: number;
  stalled: OvStall[];
  stallDays: number;
  milestones: OvMilestone[];
  milestonesTotal: number;
  revBars: { label: string; value: number }[];
  bank: BankInfo;
  /** null = nhân sự (không có quyền bật tắt). */
  autoEmail: { ownerId: string; initial: boolean } | null;
};

export type OvBooking = {
  id: string;
  name: string;
  phone: string;
  service: string | null;
  preferred_date: string | null;
  package_name: string | null;
  package_price: number | null;
  status: "new" | "handled" | "archived";
  created_at: string;
};

export type OverviewBookingV2Data = {
  today: string;
  newCount: number;
  selectingAlbums: number;
  totalBookings: number;
  /** Tổng số lịch sắp tới (danh sách `upcoming` chỉ mang 8 dòng đầu). */
  upcomingCount?: number;
  upcoming: OvBooking[];
  /** Yêu cầu mới nhất chưa xử lý (để hiện ở "Việc cần làm"). */
  newBookings: OvBooking[];
  trialUsed: boolean;
};
