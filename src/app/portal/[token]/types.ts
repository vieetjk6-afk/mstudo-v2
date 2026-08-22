import type {
  AppointmentKind, AppointmentStatus, ContractStatus, PaymentKind, ProductStatus, ShootType,
} from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Hình dữ liệu của cổng khách hàng — đúng phần payload mà `/api/c/[token]` trả
   về. Khai ở đây (không phải trong types.ts chung) vì đây là hình dạng của MỘT
   endpoint, hẹp hơn bảng DB: không có owner_id, không có tiền công ê-kíp, không
   có ghi chú nội bộ.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PortalContract = {
  code: string | null;
  title: string;
  client_name: string | null;
  client_phone: string | null;
  shoot_type: ShootType;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  status: ContractStatus;
  note: string | null;
  client_signed_at: string | null;
  client_signed_name: string | null;
  brief_submitted_at: string | null;
  updated_at: string;
};

export type PortalItem = { id: string; name: string; qty: number; unit_price: number };
export type PortalPayment = { id: string; amount: number; kind: PaymentKind; paid_at: string };
export type PortalPlanRow = { id: string; label: string; amount: number; due_date: string | null; paid: boolean; paid_at: string | null };
export type PortalProduct = { id: string; name: string; qty: number; cost: number; status: ProductStatus };
export type PortalMilestone = { id: string; title: string; event_date: string; event_time: string | null; note: string | null };
export type PortalTask = { id: string; label: string; done: boolean };

export type PortalAppointment = {
  id: string;
  kind: AppointmentKind;
  title: string;
  appt_date: string;
  start_time: string | null;
  end_time: string | null;
  duration_min: number | null;
  location: string | null;
  room: string | null;
  crew_name: string | null;
  status: AppointmentStatus;
  note: string | null;
};

export type PortalAlbum = {
  slug: string;
  title: string;
  cover_url: string | null;
  download_enabled: boolean;
  photos: { id: string; drive_file_id: string; name: string; is_video: boolean }[];
};

export type PortalBank = { bin: string | null; account: string | null; holder: string | null; name: string | null };

export type PortalPayload = {
  contract: PortalContract;
  studio_name: string;
  studio_logo: string | null;
  studio_phone: string | null;
  bank: PortalBank;
  items: PortalItem[];
  payments: PortalPayment[];
  plan: PortalPlanRow[];
  products: PortalProduct[];
  milestones: PortalMilestone[];
  tasks: PortalTask[];
  appointments: PortalAppointment[];
  album: PortalAlbum | null;
  gallery: { slug: string; title: string } | null;
  selection: { slug: string; title: string; phase?: string } | null;
  wedding: { slug: string; edit_token: string; published: boolean } | null;
  story: { slug: string; edit_token: string; published: boolean } | null;
  plan_locked?: boolean;
};

/* ── Vòng đời hợp đồng theo cách KHÁCH hiểu ─────────────────────────────────
   Stepper 6 bước của bản thiết kế. Mỗi bước suy ra từ dữ liệu thật (giống
   ContractStepper của khu quản lý) chứ không phải một cột trạng thái riêng — nên
   khách và studio không bao giờ nhìn thấy hai tiến độ khác nhau. */

export const PORTAL_STEPS = [
  "Ký hợp đồng",
  "Thử đồ",
  "Trang điểm & chụp",
  "Chọn ảnh",
  "Hậu kỳ",
  "Giao sản phẩm",
] as const;

/** `true` = đã xong. Bước đang làm = bước chưa xong đầu tiên. */
export function portalSteps(p: PortalPayload): boolean[] {
  const done = (kind: AppointmentKind) =>
    p.appointments.some((a) => a.kind === kind && (a.status === "done" || a.appt_date < todayStr()));
  const signed = !!p.contract.client_signed_at;
  const fitting = done("fitting");
  const shot = done("pre") || done("makeup") || done("shoot") || (!!p.contract.event_date && p.contract.event_date < todayStr());
  // Khách đã chọn ảnh: album chọn ảnh đã chuyển sang giai đoạn giao khách, hoặc
  // studio đã có album giao khách.
  const picked = !!p.gallery || p.selection?.phase === "delivery";
  const post = p.products.length > 0 && p.products.every((x) => x.status !== "ordered");
  const delivered = p.contract.status === "completed" || (p.products.length > 0 && p.products.every((x) => x.status === "done"));
  return [signed, fitting, shot, picked, post, delivered];
}

function todayStr(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
