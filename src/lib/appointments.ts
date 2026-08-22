import { Brush, Shirt, Camera, MessagesSquare, Package, CalendarClock, type LucideIcon } from "lucide-react";
import {
  APPOINTMENT_KIND_LABEL,
  APPOINTMENT_KIND_TONE,
  type AppointmentKind,
  type StudioAppointment,
} from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   LỊCH HẸN STUDIO — nhãn, màu, icon dùng chung của ba màn
     /dashboard/studio/schedule  lịch tuần cấp studio
     /staff                      lịch hôm nay của người được phân công
     /portal/<client_token>      lịch trình khách theo hợp đồng

   Phần TÍNH TOÁN (tuần, giờ, trùng lịch, công suất phòng) nằm ở
   `appointment-rules.ts` để chạy được trong Node mà không cần React — file này
   xuất lại toàn bộ, nên chỗ dùng chỉ cần import một đường dẫn.
   ═══════════════════════════════════════════════════════════════════════════ */

export {
  addDays, mondayOf, weekDays,
  toMinutes, fromMinutes, apptSpan, apptDuration, apptTimeRange, byStartTime,
  assigneeKey, assigneeName, findConflicts, roomLoads, countByKind,
} from "@/lib/appointment-rules";
export type { Conflict, RoomLoad, ApptRow, ApptTimes, RoomRow } from "@/lib/appointment-rules";

/** Icon theo loại lịch. Bản thiết kế vẽ bằng Material Symbols (brush, checkroom,
 *  photo_camera, forum); ở đây là icon tương đương của lucide-react — bộ icon
 *  duy nhất repo đang dùng. */
export const APPOINTMENT_KIND_ICON: Record<AppointmentKind, LucideIcon> = {
  makeup: Brush,
  fitting: Shirt,
  pre: Camera,
  consult: MessagesSquare,
  shoot: Camera,
  delivery: Package,
  other: CalendarClock,
};

/** Nhãn + cặp màu + icon của một loại lịch, tra một lần cho cả ba thứ. */
export function kindMeta(kind: AppointmentKind) {
  return {
    label: APPOINTMENT_KIND_LABEL[kind] ?? APPOINTMENT_KIND_LABEL.other,
    tone: APPOINTMENT_KIND_TONE[kind] ?? APPOINTMENT_KIND_TONE.other,
    Icon: APPOINTMENT_KIND_ICON[kind] ?? APPOINTMENT_KIND_ICON.other,
  };
}

/** Nhãn hiển thị của một lịch: tiêu đề studio đặt, hoặc suy ra từ loại + tên khách. */
export function apptTitle(a: Pick<StudioAppointment, "title" | "kind"> & { client_name?: string | null }): string {
  const t = a.title?.trim();
  if (t) return t;
  const label = APPOINTMENT_KIND_LABEL[a.kind] ?? APPOINTMENT_KIND_LABEL.other;
  return a.client_name?.trim() ? `${label} · ${a.client_name.trim()}` : label;
}
