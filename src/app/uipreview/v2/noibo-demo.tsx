"use client";

import { useState } from "react";
import StaffPortalV2, { StaffSignInV2, type StaffTab } from "@/app/staff/StaffPortalV2";
import type { ChecklistRow, TaskRow } from "@/app/staff/StaffPortal";
import { CrewPortalV2View, type CrewTab } from "@/app/crew/CrewPortalV2";
import { CREW_TR, type Assignment, type CrewPortalState } from "@/app/crew/useCrewPortal";
import type { OpenEntry } from "@/app/crew/CrewTimeClock";
import type { FreeSlot } from "@/app/crew/CrewFreeSlots";
import type { ScheduleEntry, ShiftPlan } from "@/app/crew/CrewSchedule";
import type { CrewProfile } from "@/app/crew/CrewExtras";
import type { TimesheetRow } from "@/lib/timesheet";
import type { ShiftLetter } from "@/lib/crew-shift";
import { addDays } from "@/lib/appointments";
import { todayVN } from "@/lib/date";
import type { ShootType, StudioAppointment, StudioNotification } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Dữ liệu giả cho màn xem trước giao diện mới của nhóm "noibo" — cổng nhân viên
   (/staff) và cổng thợ (/crew). Ngày tính theo HÔM NAY để nhãn "Hôm nay / Ngày
   mai / trễ hạn" luôn đúng. Cổng thợ dựng bằng một trạng thái giả cùng hình với
   useCrewPortal: bấm nút chỉ đổi dữ liệu trên máy, không gọi API.
   ═══════════════════════════════════════════════════════════════════════════ */

const BRAND = { name: "Mây Studio", logoUrl: null };

/* ── Cổng nhân viên ─────────────────────────────────────────────────────── */
function appt(p: Partial<StudioAppointment> & Pick<StudioAppointment, "id" | "kind" | "appt_date">): StudioAppointment {
  return {
    owner_id: "o1", contract_id: null, title: "", start_time: null, end_time: null, duration_min: null, location: null, room: null,
    crew_id: null, staff_id: null, crew_name: null, client_name: null, client_phone: null, status: "scheduled",
    checked_in_at: null, done_at: null, note: null, client_visible: true, branch_id: null, position: 0,
    created_at: "2026-10-01T00:00:00Z",
    ...p,
  } as StudioAppointment;
}

function staffData(empty: boolean) {
  const t = todayVN();
  const appointments: StudioAppointment[] = empty
    ? []
    : [
        appt({ id: "a1", kind: "makeup", appt_date: t, start_time: "06:30", end_time: "08:00", title: "Trang điểm cô dâu Bảo Ngọc", location: "Nhà cô dâu · 12 Nguyễn Thị Minh Khai, Q.1", client_phone: "0903 112 233", staff_id: "u2", crew_name: "Trần Hoài Nam", contract_id: "c1", status: "done" }),
        appt({ id: "a2", kind: "shoot", appt_date: t, start_time: "08:30", end_time: "12:00", title: "Phóng sự lễ gia tiên — Ngọc & Khôi", location: "Trung tâm tiệc cưới Riverside Palace, Q.4", client_phone: "0903 112 233", staff_id: "u2", crew_name: "Trần Hoài Nam", contract_id: "c1", status: "checked_in", note: "Mang thêm flash phụ và pin dự phòng — sảnh tầng 2 thiếu sáng." }),
        appt({ id: "a3", kind: "fitting", appt_date: t, start_time: "15:00", end_time: "16:00", title: "", client_name: "Lê Thu Trang", room: "Phòng thử đồ 2", staff_id: "u2", crew_name: "Trần Hoài Nam", contract_id: "c2" }),
        appt({ id: "a4", kind: "consult", appt_date: t, start_time: "18:30", end_time: "19:15", title: "Tư vấn gói album cho anh Duy", location: "Studio Q.3", staff_id: "u1", crew_name: "Phạm Thu Hà" }),
        appt({ id: "a5", kind: "pre", appt_date: addDays(t, 1), start_time: "05:30", end_time: "11:00", title: "Pre-wedding Đà Lạt — đồi chè Cầu Đất", location: "Đồi chè Cầu Đất, Đà Lạt", staff_id: "u2", crew_name: "Trần Hoài Nam", contract_id: "c3" }),
        appt({ id: "a6", kind: "delivery", appt_date: addDays(t, 2), start_time: "10:00", end_time: "10:30", title: "Giao album cưới Minh Anh", staff_id: "u2", crew_name: "Trần Hoài Nam" }),
        appt({ id: "a7", kind: "shoot", appt_date: addDays(t, 4), start_time: "14:00", end_time: "18:00", title: "Chụp kỷ yếu lớp 12A1", location: "THPT Lê Quý Đôn, Q.3", staff_id: "u2", crew_name: "Trần Hoài Nam" }),
      ];
  const c = (id: string, code: string, title: string, client: string, due: string | null) => ({ id, code, title, client_name: client, delivery_due: due, assigned_to: "u2" });
  const tasks: TaskRow[] = empty
    ? []
    : [
        { id: "p1", name: "Chỉnh màu 80 ảnh phóng sự", qty: 80, cost: 0, status: "in_progress", note: null, assigned_to: "u2", contract: c("c4", "HD-0874", "Cưới Minh Anh", "Đỗ Minh Anh", addDays(t, -2)) },
        { id: "p2", name: "Album cưới 30x30 (40 trang)", qty: 1, cost: 0, status: "ordered", note: null, assigned_to: "u2", contract: c("c4", "HD-0874", "Cưới Minh Anh", "Đỗ Minh Anh", t) },
        { id: "p3", name: "Dựng phim highlight 3 phút", qty: 1, cost: 0, status: "ordered", note: null, assigned_to: "u2", contract: c("c1", "HD-0921", "Phóng sự cưới", "Nguyễn Hoàng Bảo Ngọc", addDays(t, 5)) },
        { id: "p4", name: "Retouch 25 ảnh pre-wedding", qty: 25, cost: 0, status: "in_progress", note: null, assigned_to: "u2", contract: c("c3", "HD-0930", "Pre-wedding Đà Lạt", "Lê Thu Trang", addDays(t, 12)) },
        { id: "p5", name: "In ảnh để bàn 20x30", qty: 4, cost: 0, status: "ordered", note: null, assigned_to: "u2", contract: c("c2", "HD-0902", "Chụp gia đình", "Vũ Hải Đăng", null) },
        { id: "p6", name: "Chỉnh màu 120 ảnh kỷ yếu", qty: 120, cost: 0, status: "done", note: null, assigned_to: "u2", contract: c("c5", "HD-0855", "Kỷ yếu 12A1", "THPT Lê Quý Đôn", addDays(t, -6)) },
      ];
  const ago = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();
  const n = (id: string, kind: StudioNotification["kind"], message: string, h: number, read: boolean, contract_id: string | null = null): StudioNotification => ({
    id, owner_id: "o1", contract_id, kind, message, read, created_at: ago(h),
  });
  const notifications: StudioNotification[] = empty
    ? []
    : [
        n("n1", "schedule_reminder", "Nhắc lịch: 08:30 Phóng sự lễ gia tiên — Ngọc & Khôi tại Riverside Palace", 0.3, false),
        n("n2", "assigned", "Bạn được phân công Pre-wedding Đà Lạt ngày mai, 05:30", 2, false, "c3"),
        n("n3", "contract_changed", "Hợp đồng HD-0921 đổi giờ đón dâu sang 09:00", 5, true, "c1"),
        n("n4", "signed", "Khách Lê Thu Trang đã ký hợp đồng HD-0930", 30, true, "c3"),
        n("n5", "payment", "Đã nhận cọc 8.670.000đ cho HD-0921", 54, true, "c1"),
      ];
  const checklist: ChecklistRow[] = empty
    ? []
    : [
        { id: "k1", label: "Chép thẻ nhớ vào ổ lưu trữ studio", done: true, position: 0, contract_id: "c1", contract_code: "HD-0921", contract_title: "Phóng sự cưới Ngọc & Khôi" },
        { id: "k2", label: "Gửi khách 10 ảnh xem trước trong 48 giờ", done: false, position: 1, contract_id: "c1", contract_code: "HD-0921", contract_title: "Phóng sự cưới Ngọc & Khôi" },
        { id: "k3", label: "Xác nhận địa điểm và giờ đón ở Đà Lạt", done: false, position: 0, contract_id: "c3", contract_code: "HD-0930", contract_title: "Pre-wedding Đà Lạt" },
        { id: "k4", label: "Trả váy cưới cho bộ phận thuê đồ", done: false, position: 2, contract_id: "c1", contract_code: "HD-0921", contract_title: "Phóng sự cưới Ngọc & Khôi" },
      ];
  return { t, appointments, tasks, notifications, checklist };
}

export function StaffV2Demo({ tab, empty = false, role = "manager" }: { tab?: StaffTab; empty?: boolean; role?: string }) {
  const d = staffData(empty);
  return (
    <StaffPortalV2
      me="u2"
      meName="Trần Hoài Nam"
      actingRole={role}
      studioName="Mây Studio"
      today={d.t}
      appointments={d.appointments}
      monthApptCount={empty ? 0 : 46}
      myMonthApptCount={empty ? 0 : 18}
      tasks={d.tasks}
      notifications={d.notifications}
      checklist={d.checklist}
      contractCount={empty ? 0 : 7}
      brand={BRAND}
      accent="#0b5cc4"
      greeting="Chào buổi sáng"
      initialTab={tab}
    />
  );
}

export function StaffSignInV2Demo() {
  return <StaffSignInV2 />;
}

/* ── Cổng thợ ───────────────────────────────────────────────────────────── */
export type CrewVariant = "gate" | "register" | "full" | "working" | "new" | "empty";

function crewData(variant: CrewVariant) {
  const t = todayVN();
  const ct = (title: string, date: string | null, time: string | null, location: string | null, shoot: ShootType = "wedding") => ({
    title, client_name: null, shoot_type: shoot, event_date: date, event_time: time, location, status: "approved",
  });
  const list: Assignment[] =
    variant === "empty" || variant === "new"
      ? []
      : [
          { id: "j1", contract_id: "c1", name: "Nam", role: "photographer", salary: 1_800_000, status: "accepted", note: "Có mặt trước 30 phút để chụp chi tiết nhẫn và hoa cưới.", contract: ct("Phóng sự cưới Ngọc & Khôi", t, "08:30", "Trung tâm tiệc cưới Riverside Palace, 360D Bến Vân Đồn, Q.4") },
          { id: "j2", contract_id: "c3", name: "Nam", role: "cameraman", salary: 2_500_000, status: "pending", note: null, contract: ct("Pre-wedding Đà Lạt — đồi chè Cầu Đất", addDays(t, 3), "05:30", "Đồi chè Cầu Đất, Đà Lạt", "prewedding") },
          { id: "j3", contract_id: "c6", name: "Nam", role: "photographer", salary: 900_000, status: "pending", note: "Chụp sự kiện ra mắt sản phẩm, mặc áo sơ mi trắng.", contract: ct("Sự kiện ra mắt Aurora Coffee", addDays(t, 6), "18:00", "Aurora Coffee, 25 Lê Lợi, Q.1", "photo") },
          { id: "j4", contract_id: "c7", name: "Nam", role: "photographer", salary: 1_200_000, status: "accepted", note: null, contract: ct("Chụp kỷ yếu lớp 12A1", addDays(t, 9), "07:00", "THPT Lê Quý Đôn, Q.3", "photo") },
          { id: "j5", contract_id: "c8", name: "Nam", role: "photographer", salary: 1_500_000, status: "accepted", note: null, contract: ct("Cưới Minh Anh & Hoàng", addDays(t, -5), "09:00", "Nhà hàng Hoàng Yến, Q.1") },
          { id: "j6", contract_id: "c9", name: "Nam", role: "assistant", salary: 500_000, status: "declined", note: null, contract: ct("Chụp sản phẩm mỹ phẩm", addDays(t, 2), "13:00", "Studio Q.3", "photo") },
        ];
  const working = variant === "working";
  const openEntry: OpenEntry = working ? { id: "ts0", started_at: new Date(Date.now() - (2 * 60 + 15) * 60000).toISOString(), work_date: t, contract_id: "c1" } : null;
  const at = (date: string, hm: string) => new Date(`${date}T${hm}:00+07:00`).toISOString();
  const sheet: TimesheetRow[] =
    variant === "empty" || variant === "new"
      ? []
      : [
          { id: "ts1", phone: "0909", workDate: addDays(t, -5), startedAt: at(addDays(t, -5), "08:40"), endedAt: at(addDays(t, -5), "17:10"), contractId: "c8", note: null },
          { id: "ts2", phone: "0909", workDate: addDays(t, -8), startedAt: at(addDays(t, -8), "13:00"), endedAt: at(addDays(t, -8), "18:30"), contractId: null, note: "Đi thêm điểm Thủ Đức" },
          { id: "ts3", phone: "0909", workDate: addDays(t, -11), startedAt: at(addDays(t, -11), "06:00"), endedAt: null, contractId: null, note: null },
        ];
  const schedule: ScheduleEntry[] =
    variant === "empty" || variant === "new"
      ? []
      : [
          { id: "b1", date: t, note: null, start_time: "08:30:00", end_time: "12:00:00", overnight: false, title: "Phóng sự cưới Ngọc & Khôi", owner_id: "o1", created_by: "studio" },
          { id: "b2", date: addDays(t, 1), note: null, start_time: null, end_time: null, overnight: false, title: "Quay đám cưới cho nhóm bạn", owner_id: "o1", created_by: "crew" },
          { id: "b3", date: addDays(t, 3), note: null, start_time: "20:00:00", end_time: "06:00:00", overnight: true, title: "Trực ca đêm nhà máy", owner_id: "o1", created_by: "crew" },
          { id: "b4", date: addDays(t, 9), note: null, start_time: "07:00:00", end_time: "11:30:00", title: "Chụp kỷ yếu lớp 12A1", overnight: false, owner_id: "o1", created_by: "studio" },
          { id: "b5", date: addDays(t, -4), note: null, start_time: "09:00:00", end_time: "17:00:00", title: "Cưới Minh Anh & Hoàng", overnight: false, owner_id: "o1", created_by: "studio" },
        ];
  const freeSlots: FreeSlot[] =
    variant === "empty" || variant === "new"
      ? []
      : [
          { id: "f1", date: addDays(t, 2), start: null, end: null, note: null },
          { id: "f2", date: addDays(t, 4), start: "13:00:00", end: "18:00:00", note: "Chỉ nhận trong thành phố" },
          { id: "f3", date: addDays(t, 20), start: null, end: null, note: null },
        ];
  const profile = (p: Partial<CrewProfile> & Pick<CrewProfile, "id" | "owner_id" | "studio_name">): CrewProfile => ({
    name: null, email: null, equipment: null, address: null, bank_name: null, bank_account: null, skills: null, status: "active", self_filled_at: null, ...p,
  });
  const profiles: CrewProfile[] =
    variant === "register" || variant === "new"
      ? []
      : variant === "empty"
        ? [profile({ id: "pr9", owner_id: "o9", studio_name: "Mây Studio", status: "pending", name: "Lê Văn Phúc" })]
        : [
            profile({ id: "pr1", owner_id: "o1", studio_name: "Mây Studio", name: "Trần Hoài Nam", email: "nam.tran@gmail.com", bank_name: "Vietcombank", bank_account: "0071 0004 12345", skills: "Chụp phóng sự, quay flycam", equipment: "Sony A7 IV, 24-70 GM, DJI RS3" }),
            profile({ id: "pr2", owner_id: "o2", studio_name: "Lam Wedding House", name: "Trần Hoài Nam", skills: "Chụp phóng sự" }),
          ];
  return { list, openEntry, sheet, schedule, freeSlots, profiles };
}

function useFakeCrew(variant: CrewVariant): CrewPortalState {
  const init = crewData(variant);
  const [phone, setPhone] = useState(variant === "gate" ? "" : "0909 123 456");
  const [list, setList] = useState<Assignment[] | null>(variant === "gate" ? null : init.list);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(init.schedule);
  const [shiftPlan, setShiftPlan] = useState<ShiftPlan>(variant === "full" || variant === "working" ? { company: "hoa_phat", shift: "B" } : null);
  const [calToken, setCalToken] = useState<string | null>(variant === "full" ? "demo-calendar-token-7f3a" : null);
  const [openEntry, setOpenEntry] = useState<OpenEntry>(init.openEntry);
  const [sheet, setSheet] = useState<TimesheetRow[]>(init.sheet);
  const [freeSlots, setFreeSlots] = useState<FreeSlot[]>(init.freeSlots);
  const [captchaToken, setCaptchaToken] = useState<string | null>("demo");
  const profiles = init.profiles;
  const studio = variant === "register" ? { id: "o1", name: "Mây Studio", crewToken: "demo" } : undefined;
  const inThisStudio = !studio || profiles.some((p) => p.owner_id === studio.id);
  const acceptedStudios = profiles.filter((p) => p.status !== "pending");
  const studioOptions = acceptedStudios.map((p) => ({ id: p.owner_id, name: p.studio_name }));
  const clockJobs = (list ?? [])
    .filter((a) => a.status !== "declined" && a.contract_id)
    .map((a) => ({ id: a.contract_id as string, label: a.contract?.title || a.name }));
  const t = todayVN();
  let seq = 100;
  const id = () => `x${seq++}${Math.round(Math.random() * 1e6)}`;

  return {
    lang: "vi",
    tr: CREW_TR.vi,
    studio,
    phone, setPhone, list, schedule, shiftPlan, calToken, setCalToken, openEntry, sheet, freeSlots, profiles,
    inThisStudio, acceptedStudios, studioOptions, clockJobs,
    loading: false, busy: null, captchaToken, setCaptchaToken, session: "demo",
    load: async (e?: React.FormEvent) => {
      e?.preventDefault();
      setList(crewData("full").list);
    },
    addEntry: async (v) =>
      setSchedule((p) => [...p, { id: id(), date: v.date, note: null, start_time: v.start || null, end_time: v.end || null, overnight: !!(v.start && v.end && v.end <= v.start), title: v.title || null, owner_id: v.studioId, created_by: "crew" }]),
    removeEntry: async (rid) => setSchedule((p) => p.filter((e) => e.id !== rid)),
    setShift: async (sh: ShiftLetter | "") => setShiftPlan(sh ? { company: "hoa_phat", shift: sh } : null),
    clockIn: async (v) => setOpenEntry({ id: id(), started_at: new Date().toISOString(), work_date: t, contract_id: v.contractId || null }),
    clockOut: async (note) => {
      if (openEntry) setSheet((p) => [{ id: openEntry.id, phone, workDate: openEntry.work_date, startedAt: openEntry.started_at, endedAt: new Date().toISOString(), contractId: openEntry.contract_id, note: note || null }, ...p]);
      setOpenEntry(null);
    },
    addFree: async (v) => setFreeSlots((p) => [...p, { id: id(), date: v.date, start: v.start || null, end: v.end || null, note: v.note || null }]),
    removeFree: async (rid) => setFreeSlots((p) => p.filter((x) => x.id !== rid)),
    respond: async (rid, status) => setList((p) => (p ? p.map((a) => (a.id === rid ? { ...a, status } : a)) : p)),
    reset: () => setList(null),
  };
}

export function CrewV2Demo({ variant = "full", tab, generic = false }: { variant?: CrewVariant; tab?: CrewTab; generic?: boolean }) {
  const s = useFakeCrew(variant);
  return <CrewPortalV2View s={s} brand={generic ? undefined : BRAND} initialTab={tab} />;
}
