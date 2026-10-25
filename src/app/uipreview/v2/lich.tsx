/* Màn xem trước GIAO DIỆN MỚI của nhóm "lich" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Bọc màn trong
 * <PreviewV2 path="/dashboard/..."> (xem ./shell.tsx). */
import CalendarView, { type ContractMarker, type EventRow } from "@/app/dashboard/studio/calendar/CalendarView";
import SchedulePage, { type CrewOption, type ContractOption } from "@/app/dashboard/studio/calendar/SchedulePage";
import TeamCalendar, { type CrewMember, type CrewScheduleRow, type TeamAssignment } from "@/app/dashboard/studio/calendar/TeamCalendar";
import { addDays, mondayOf } from "@/lib/appointments";
import { todayVN } from "@/lib/date";
import type { AppointmentKind, AppointmentStatus, StudioAppointment, StudioRoom } from "@/lib/types";
import { PreviewV2 } from "./shell";

/* ── Dữ liệu giả quanh ngày 24/10/2026 ─────────────────────────────────────── */
const TABS = ["shoot", "studio", "team"] as const;

const crew = (id: string, name: string, role = "photographer", status = "accepted") => ({ id, name, role, status });
const item = (name: string, qty = 1, unit_price = 5_000_000) => ({ name, qty, unit_price });

const mk = (
  id: string,
  date: string,
  time: string | null,
  title: string,
  client: string,
  extra: Partial<ContractMarker> = {},
): ContractMarker => ({
  id,
  code: `HD${id.replace(/\D/g, "").padStart(4, "0")}`,
  title,
  client_name: client,
  client_phone: "0912345678",
  location: null,
  event_date: date,
  event_time: time,
  status: "approved",
  shoot_type: "photo",
  calendar_color: null,
  contract_items: [item("Gói chụp cơ bản")],
  contract_crew: [crew(`${id}-a`, "Minh Tuấn")],
  contract_payments: [{ amount: 2_000_000 }],
  ...extra,
});

const shoots: ContractMarker[] = [
  mk("c1", "2026-10-03", "08:00", "Cưới Ngọc & Khang", "Ngọc Trần", { status: "completed", calendar_color: "#3fb98a", contract_payments: [{ amount: 25_000_000 }], contract_items: [item("Quay chụp PSC", 1, 25_000_000)] }),
  mk("c2", "2026-10-10", "15:00", "Kỷ yếu 12A1 Chu Văn An", "Cô Hương", { status: "post_production", calendar_color: "#6ba3c7" }),
  mk("c3", "2026-10-17", null, "Chụp sản phẩm Bếp Nhà Mây", "Bếp Nhà Mây", { status: "in_progress" }),
  mk("c4", "2026-10-24", "06:00", "Pre-wedding phố cổ — Thảo & Nam", "Thảo Nguyễn", {
    status: "in_progress", location: "Phố cổ Hà Nội", calendar_color: "#e0719e",
    contract_items: [item("Pre-wedding ngoại cảnh", 1, 18_000_000), item("Album 30x30", 2, 2_500_000)],
    contract_crew: [crew("c4-a", "Minh Tuấn"), crew("c4-b", "Lan Anh", "assistant", "pending")],
    contract_payments: [{ amount: 10_000_000 }],
  }),
  mk("c5", "2026-10-24", "10:30", "Chụp profile công ty Mekong", "Mekong Tech", { location: "Studio tầng 2", calendar_color: "#6ba3c7" }),
  mk("c6", "2026-10-24", "17:00", "Tiệc thôi nôi bé Bin", "Chị Hạnh", { location: "Nhà hàng Sen", contract_crew: [] }),
  mk("c7", "2026-10-26", "07:30", "Cưới Minh Anh & Quốc Bảo", "Minh Anh", {
    location: "Long Biên", calendar_color: "#b07ad0", contract_crew: [],
    contract_items: [item("Quay chụp PSC", 1, 32_000_000)], contract_payments: [{ amount: 10_000_000 }],
  }),
  mk("c8", "2026-10-26", "15:00", "Chụp gia đình ngoại cảnh", "Trần Phong", { location: "Công viên Thống Nhất", calendar_color: "#3fb98a" }),
  mk("c9", "2026-10-26", "18:00", "Sinh nhật bé Na", "Hoàng Yến", { calendar_color: "#d6a44a", contract_crew: [crew("c9-a", "Đức Anh", "cameraman")] }),
  mk("c10", "2026-10-28", null, "Kỷ yếu 12A3", "Thầy Long", { contract_crew: [crew("c10-a", "Minh Tuấn"), crew("c10-b", "Đức Anh", "cameraman"), crew("c10-c", "Lan Anh", "assistant")] }),
  mk("c11", "2026-10-30", "09:00", "Chụp lookbook Thu Đông", "Lá Boutique", { calendar_color: "#e0746f", location: "Studio tầng 1" }),
  mk("c12", "2026-11-01", "08:00", "Cưới Lan & Huy — lễ gia tiên", "Phạm Lan", { location: "Nam Định", contract_crew: [crew("c12-a", "Minh Tuấn"), crew("c12-b", "Đức Anh", "cameraman")] }),
  mk("c13", "2026-11-07", "19:00", "Concert mùa thu", "CLB Guitar", { shoot_type: "video" as ContractMarker["shoot_type"] }),
];

const ev = (id: string, date: string, title: string, time: string | null = null, note: string | null = null, remind = true): EventRow => ({
  id, owner_id: "o", contract_id: null, title, event_date: date, event_time: time, note, remind, created_at: "2026-10-01T00:00:00Z",
});
const notes: EventRow[] = [
  ev("e1", "2026-10-24", "Khách Thảo thử váy lần 2", "14:00", "Mang thêm khăn voan"),
  ev("e2", "2026-10-25", "Bảo trì máy Sony A7IV", null, null, false),
  ev("e3", "2026-10-29", "Trả đồ cưới — Minh Anh", "16:00"),
  { ...ev("e4", "2026-10-22", "Đãi trước nhà gái", "11:00"), contract_id: "c7", contract: { title: "Cưới Minh Anh & Quốc Bảo", event_date: "2026-10-26" } },
  ev("e5", "2026-11-02", "Họp ê-kíp tháng 11", "09:00"),
];

const shootProps = {
  ownerId: "o",
  initialEvents: notes,
  contracts: shoots,
  feedUrl: "https://mstudo.vn/api/calendar/3f9a1c2b7d",
  gcal: { connected: true, ok: true, error: null },
  crewRoles: [],
  tabs: TABS,
};

/* ── Lịch studio: buổi hẹn trong tuần này ─────────────────────────────────── */
const T = todayVN();
const MON = mondayOf(T);
const room = (id: string, name: string, kind: StudioRoom["kind"], cap: number): StudioRoom => ({
  id, owner_id: "o", name, kind, capacity_week: cap, branch_id: null, note: null, active: true, position: 0, created_at: "",
});
const rooms: StudioRoom[] = [
  room("r1", "Phòng trang điểm 1", "makeup", 14),
  room("r2", "Phòng trang điểm 2", "makeup", 14),
  room("r3", "Phòng váy tầng 2", "fitting", 12),
  room("r4", "Phim trường", "studio", 10),
];
const appt = (
  id: string, dayOff: number, kind: AppointmentKind, start: string | null, end: string | null,
  client: string, crewName: string | null, roomName: string | null, extra: Partial<StudioAppointment> = {},
): StudioAppointment => ({
  id, owner_id: "o", contract_id: null, kind, title: "", appt_date: addDays(MON, dayOff), start_time: start, end_time: end,
  duration_min: null, location: null, room: roomName, crew_id: crewName ? `k-${crewName}` : null, staff_id: null, crew_name: crewName,
  client_name: client, client_phone: "0912345678", status: "scheduled" as AppointmentStatus, checked_in_at: null, done_at: null,
  note: null, client_visible: true, branch_id: null, position: 0, created_at: "", updated_at: "", ...extra,
});
const appointments: StudioAppointment[] = [
  appt("a1", 0, "makeup", "07:00", "08:30", "Thảo Nguyễn", "Hà My", "Phòng trang điểm 1", { status: "done" }),
  appt("a2", 0, "fitting", "09:30", "10:30", "Minh Anh", "Lan Anh", "Phòng váy tầng 2", { status: "done" }),
  appt("a3", 1, "consult", "14:00", "15:00", "Anh Phong", "Mr Lee", null),
  appt("a4", 2, "makeup", "06:00", "07:30", "Cô dâu Ngọc", "Hà My", "Phòng trang điểm 1"),
  appt("a5", 2, "makeup", "07:00", "08:00", "Cô dâu Lan", "Hà My", "Phòng trang điểm 2"),
  appt("a6", 2, "pre", "15:00", "18:00", "Thảo & Nam", "Minh Tuấn", null, { location: "Hồ Tây" }),
  appt("a7", 3, "fitting", "10:00", "11:30", "Hoàng Yến", "Lan Anh", "Phòng váy tầng 2"),
  appt("a8", 4, "shoot", "08:00", "11:00", "Lá Boutique", "Minh Tuấn", "Phim trường"),
  appt("a9", 4, "delivery", "16:00", null, "Ngọc Trần", null, null),
  appt("a10", 5, "makeup", "05:30", "07:00", "Cô dâu Minh Anh", "Hà My", "Phòng trang điểm 1", { status: "checked_in" }),
  appt("a11", 5, "pre", "09:00", "12:00", "Hà & Tuấn", "Đức Anh", null, { location: "Đồi chè Long Cốc" }),
  appt("a12", 5, "consult", "16:30", "17:30", "Chị Hạnh", "Mr Lee", null),
  appt("a13", 6, "fitting", "09:00", "10:00", "Phạm Lan", "Lan Anh", "Phòng váy tầng 2"),
  appt("a14", 6, "other", null, null, "", null, "Phim trường", { title: "Giữ phòng — bảo trì đèn", client_visible: false }),
  appt("a15", 8, "makeup", "07:00", "08:30", "Cô dâu Hằng", "Hà My", "Phòng trang điểm 1"),
  appt("a16", 10, "pre", "15:00", "18:00", "Vy & Khoa", "Minh Tuấn", null),
];
const assignees: CrewOption[] = ["Hà My", "Lan Anh", "Minh Tuấn", "Đức Anh", "Mr Lee"].map((n) => ({
  key: `crew:k-${n}`, crew_id: `k-${n}`, staff_id: null, name: n, phone: null, role: "photographer",
}));
const contractOpts: ContractOption[] = shoots.map((c) => ({
  id: c.id, code: c.code, title: c.title, client_name: c.client_name, client_phone: c.client_phone, event_date: c.event_date, status: c.status,
}));
const studioProps = {
  ownerId: "o", readOnly: false, today: T, initialAppointments: appointments, rooms, assignees, contracts: contractOpts,
  branches: [], defaultBranchId: null, studioCoords: null, crewFree: [], crewBusy: [], tabs: TABS,
};

/* ── Đội ngũ ───────────────────────────────────────────────────────────────── */
const members: CrewMember[] = [
  { phone: "0901000001", name: "Minh Tuấn", role: "photographer" },
  { phone: "0901000002", name: "Đức Anh", role: "cameraman" },
  { phone: "0901000003", name: "Lan Anh", role: "assistant" },
  { phone: "0901000004", name: "Hà My", role: "editor" },
];
const asg = (name: string, phone: string, role: TeamAssignment["role"], status: TeamAssignment["status"], c: ContractMarker): TeamAssignment => ({
  name, phone, role, status, date: c.event_date, contractId: c.id, contractTitle: c.title,
});
const byId = (id: string) => shoots.find((c) => c.id === id)!;
const assignments: TeamAssignment[] = [
  asg("Minh Tuấn", "0901000001", "photographer", "accepted", byId("c4")),
  asg("Lan Anh", "0901000003", "assistant", "pending", byId("c4")),
  asg("Minh Tuấn", "0901000001", "photographer", "accepted", byId("c5")),
  asg("Đức Anh", "0901000002", "cameraman", "declined", byId("c7")),
  asg("Minh Tuấn", "0901000001", "photographer", "accepted", byId("c8")),
  asg("Đức Anh", "0901000002", "cameraman", "accepted", byId("c9")),
  asg("Minh Tuấn", "0901000001", "photographer", "pending", byId("c10")),
  asg("Đức Anh", "0901000002", "cameraman", "accepted", byId("c10")),
  asg("Lan Anh", "0901000003", "assistant", "accepted", byId("c10")),
  asg("Minh Tuấn", "0901000001", "photographer", "accepted", byId("c11")),
  asg("Minh Tuấn", "0901000001", "photographer", "accepted", byId("c12")),
  asg("Đức Anh", "0901000002", "cameraman", "accepted", byId("c2")),
];
const busy = (id: string, phone: string, date: string, start: string | null, end: string | null, title: string | null, studio = false): CrewScheduleRow => ({
  id, phone, date, note: null, start_time: start, end_time: end, overnight: false, title, owner_id: studio ? "o" : null,
});
const crewSchedule: CrewScheduleRow[] = [
  busy("b1", "0901000002", "2026-10-25", "08:00", "12:00", "Quay sự kiện bên ngoài"),
  busy("b2", "0901000003", "2026-10-27", null, null, "Nghỉ phép", true),
  busy("b3", "0901000004", "2026-10-29", "13:00", "17:00", "Dựng phim cưới Ngọc", true),
  busy("b4", "0901000001", "2026-10-31", null, null, null),
];
const teamProps = { assignments, members, schedule: crewSchedule, shifts: { "0901000002": "B" as const }, crewRoles: [], tabs: TABS };

export const SCREENS_LICH: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  "moi-lich": {
    title: "Giao diện mới — Lịch làm việc · Buổi chụp",
    render: () => (
      <PreviewV2 path="/dashboard/studio/calendar">
        <CalendarView {...shootProps} />
      </PreviewV2>
    ),
    bare: true,
  },
  "moi-lich-gcal-loi": {
    title: "Giao diện mới — Lịch làm việc · Buổi chụp (Google Lịch lỗi, chưa có buổi)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/calendar">
        <CalendarView {...shootProps} contracts={[]} initialEvents={[]} gcal={{ connected: true, ok: false, error: "invalid_grant: Token has been expired or revoked." }} />
      </PreviewV2>
    ),
    bare: true,
  },
  "moi-lich-studio": {
    title: "Giao diện mới — Lịch làm việc · Lịch studio",
    render: () => (
      <PreviewV2 path="/dashboard/studio/calendar">
        <SchedulePage {...studioProps} />
      </PreviewV2>
    ),
    bare: true,
  },
  "moi-lich-doingu": {
    title: "Giao diện mới — Lịch làm việc · Đội ngũ",
    render: () => (
      <PreviewV2 path="/dashboard/studio/calendar">
        <TeamCalendar {...teamProps} />
      </PreviewV2>
    ),
    bare: true,
  },
};
