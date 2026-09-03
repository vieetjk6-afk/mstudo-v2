"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Plus, CalendarDays, AlertCircle, DoorOpen, UsersRound,
  Trash2, X as XIcon, Check, CalendarClock, FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Panel, PanelHead, Pill, ProgressBar, EmptyState, KindPill } from "@/components/studio/ui";
import { useToast } from "@/components/studio/Toast";
import WeatherChip, { WeatherDetail, useShootWeather } from "@/components/studio/WeatherChip";
import type { DayForecast } from "@/lib/weather";
import { Modal } from "@/components/studio/Modal";
import { avatarStyle, initials } from "@/lib/avatar";
import { fmtDayMonth } from "@/lib/date";
import {
  addDays, apptTimeRange, apptTitle, byStartTime, countByKind, findConflicts,
  kindMeta, mondayOf, roomLoads, toMinutes, weekDays, assigneeKey, assigneeName,
} from "@/lib/appointments";
import {
  APPOINTMENT_KINDS, APPOINTMENT_KIND_LABEL, APPOINTMENT_STATUS_LABEL,
  type AppointmentKind, type AppointmentStatus, type StudioAppointment, type StudioRoom,
} from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   LỊCH STUDIO — lịch TUẦN của các buổi hẹn dịch vụ
   (bản thiết kế "Cổng nhân viên & khách hàng", mục 3)

   Lưới 7 cột T2→CN, lọc theo loại lịch, và rail phải gồm ê-kíp trong tuần,
   cảnh báo trùng lịch, công suất phòng. Ghi/xoá đi thẳng qua supabase client
   như CalendarView — RLS `is_studio_member(owner_id)` đã chặn đúng phạm vi.
   ═══════════════════════════════════════════════════════════════════════════ */

export type CrewOption = {
  /** Khoá cho <select>: "crew:<id>" hoặc "staff:<id>" — hai loại người làm nằm
   *  chung một danh sách nên phải phân biệt được bằng chính giá trị chọn. */
  key: string;
  crew_id: string | null;
  staff_id: string | null;
  name: string;
  role: string;
};

export type ContractOption = {
  id: string;
  code: string | null;
  title: string;
  client_name: string | null;
  client_phone: string | null;
  event_date: string | null;
  status: string;
};

const WD = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** Form đặt lịch — giữ riêng khỏi bản ghi DB vì mọi ô đều là chuỗi khi đang nhập. */
type Draft = {
  id: string | null;
  kind: AppointmentKind;
  title: string;
  appt_date: string;
  start_time: string;
  end_time: string;
  location: string;
  room: string;
  assignee: string;
  contract_id: string;
  client_name: string;
  client_phone: string;
  note: string;
  client_visible: boolean;
  status: AppointmentStatus;
  branch_id: string;
};

function emptyDraft(date: string, kind: AppointmentKind = "makeup", branchId = ""): Draft {
  return {
    id: null, kind, title: "", appt_date: date, start_time: "", end_time: "",
    location: "", room: "", assignee: "", contract_id: "", client_name: "", client_phone: "",
    note: "", client_visible: true, status: "scheduled", branch_id: branchId,
  };
}

function draftOf(a: StudioAppointment): Draft {
  return {
    id: a.id,
    kind: a.kind,
    title: a.title ?? "",
    appt_date: a.appt_date,
    start_time: a.start_time ?? "",
    end_time: a.end_time ?? "",
    location: a.location ?? "",
    room: a.room ?? "",
    assignee: a.crew_id ? `crew:${a.crew_id}` : a.staff_id ? `staff:${a.staff_id}` : "",
    contract_id: a.contract_id ?? "",
    client_name: a.client_name ?? "",
    client_phone: a.client_phone ?? "",
    note: a.note ?? "",
    client_visible: a.client_visible,
    status: a.status,
    branch_id: a.branch_id ?? "",
  };
}

export default function SchedulePage({
  ownerId, readOnly, today, initialAppointments, rooms, assignees, contracts,
  branches = [], defaultBranchId = null, studioCoords = null,
}: {
  ownerId: string;
  /** Nhân viên chỉ xem: giữ nguyên mọi thông tin, ẩn nút ghi. */
  readOnly: boolean;
  today: string;
  initialAppointments: StudioAppointment[];
  rooms: StudioRoom[];
  assignees: CrewOption[];
  contracts: ContractOption[];
  /** Chi nhánh còn hoạt động — rỗng thì ô chọn chi nhánh không hiện. */
  branches?: { id: string; name: string }[];
  /** Chi nhánh đang xem: lịch mới đặt mặc định thuộc cơ sở đó. */
  defaultBranchId?: string | null;
  /** Toạ độ studio — điểm xuất phát để ƯỚC LƯỢNG đường đi tới điểm chụp. */
  studioCoords?: { lat: number; lng: number } | null;
}) {
  const supabase = createClient();
  const { toast, toastNode } = useToast();

  const [items, setItems] = useState<StudioAppointment[]>(initialAppointments);
  const [weekAnchor, setWeekAnchor] = useState(mondayOf(today));
  // Mặc định bật cả 4 loại chính; loại phụ (buổi chụp, giao sản phẩm, khác) cũng
  // bật để lịch không âm thầm ẩn mất buổi nào ở lần mở đầu.
  const [kindOn, setKindOn] = useState<Record<AppointmentKind, boolean>>(
    () => Object.fromEntries(APPOINTMENT_KINDS.map((k) => [k, true])) as Record<AppointmentKind, boolean>
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => weekDays(weekAnchor), [weekAnchor]);
  const weekStart = days[0];
  const weekEnd = days[6];

  /** Lịch của tuần đang xem, TRƯỚC khi lọc theo loại — số trong chip lọc phải
   *  đếm trên toàn tuần, nếu đếm sau khi lọc thì chip tắt luôn hiện 0. */
  const weekItems = useMemo(
    () => items.filter((a) => a.appt_date >= weekStart && a.appt_date <= weekEnd && a.status !== "cancelled"),
    [items, weekStart, weekEnd]
  );
  const counts = useMemo(() => countByKind(weekItems), [weekItems]);

  /**
   * Dự báo thời tiết cho các buổi NGOÀI TRỜI của tuần đang xem. Hook tự lọc
   * (chỉ lịch ngoài trời, chỉ trong 7 ngày, chỉ khi có địa điểm) và gọi API MỘT
   * lượt cho cả tuần — xem @/components/studio/WeatherChip.
   */
  const weatherPlaces = useMemo(
    () =>
      weekItems.map((a) => ({
        key: a.id,
        kind: a.kind,
        date: a.appt_date,
        location: a.location,
        lat: a.lat ?? null,
        lng: a.lng ?? null,
      })),
    [weekItems]
  );
  const weather = useShootWeather(weatherPlaces, today);
  const shown = useMemo(() => weekItems.filter((a) => kindOn[a.kind]), [weekItems, kindOn]);

  const byDay = useMemo(() => {
    const m = new Map<string, StudioAppointment[]>();
    for (const d of days) m.set(d, []);
    for (const a of shown) m.get(a.appt_date)?.push(a);
    for (const arr of m.values()) arr.sort(byStartTime);
    return m;
  }, [shown, days]);

  // Cảnh báo trùng lịch, ê-kíp và công suất phòng tính trên TOÀN BỘ lịch của
  // tuần, KHÔNG theo chip lọc: tắt một loại lịch không làm phòng rảnh ra hay làm
  // hai buổi thôi chồng giờ nhau. Chip lọc chỉ đổi thứ hiện trên lưới.
  const conflicts = useMemo(() => findConflicts(weekItems), [weekItems]);
  const conflictKeys = useMemo(() => new Set(conflicts.flatMap((c) => c.items.map((i) => i.id))), [conflicts]);
  const loads = useMemo(() => roomLoads(weekItems, rooms), [weekItems, rooms]);

  /** Ê-kíp trong tuần: mọi người đang có việc, nhiều việc lên trước.
   *  Bản thiết kế gọi khối này là "Ekip trang điểm", nhưng sổ thợ của repo không
   *  có vai trò "trang điểm" (chỉ photographer/cameraman/assistant/editor), nên
   *  liệt kê theo AI ĐANG CÓ VIỆC thay vì lọc theo một vai trò không tồn tại. */
  const crewLoad = useMemo(() => {
    const m = new Map<string, { name: string; n: number; conflict: boolean }>();
    for (const a of weekItems) {
      const k = assigneeKey(a);
      if (!k) continue;
      const cur = m.get(k) ?? { name: assigneeName(a), n: 0, conflict: false };
      cur.n += 1;
      if (conflictKeys.has(a.id)) cur.conflict = true;
      m.set(k, cur);
    }
    return [...m.values()].sort((x, y) => y.n - x.n || x.name.localeCompare(y.name, "vi"));
  }, [weekItems, conflictKeys]);

  /* ── Ghi dữ liệu ─────────────────────────────────────────────────────── */

  function assigneeFields(key: string) {
    const opt = assignees.find((o) => o.key === key);
    return { crew_id: opt?.crew_id ?? null, staff_id: opt?.staff_id ?? null, crew_name: opt?.name ?? null };
  }

  /**
   * Ghi một dòng thông báo cho studio. Đây là thứ làm tab "Thông báo" của cổng
   * nhân viên có nội dung thật: vừa phân công ai, vừa đổi lịch buổi nào. Lỗi ghi
   * thông báo KHÔNG được làm hỏng việc lưu lịch — nên bỏ qua lặng lẽ.
   */
  async function notify(kind: "assigned" | "contract_changed" | "schedule_reminder", message: string, contractId: string | null) {
    await supabase
      .from("studio_notifications")
      .insert({ owner_id: ownerId, contract_id: contractId, kind, message })
      .then(undefined, () => undefined);
  }

  async function save() {
    if (!draft) return;
    const d = draft;
    if (!d.appt_date) { toast("Chưa chọn ngày."); return; }
    setBusy(true);
    const row = {
      owner_id: ownerId,
      contract_id: d.contract_id || null,
      kind: d.kind,
      title: d.title.trim(),
      appt_date: d.appt_date,
      start_time: d.start_time.trim() || null,
      end_time: d.end_time.trim() || null,
      location: d.location.trim() || null,
      room: d.room.trim() || null,
      client_name: d.client_name.trim() || null,
      client_phone: d.client_phone.trim() || null,
      note: d.note.trim() || null,
      client_visible: d.client_visible,
      status: d.status,
      branch_id: d.branch_id || null,
      ...assigneeFields(d.assignee),
    };

    if (d.id) {
      const { data, error } = await supabase
        .from("studio_appointments")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", d.id)
        .select("*")
        .single();
      setBusy(false);
      if (error || !data) { toast(errMsg(error?.message)); return; }
      const before = items.find((x) => x.id === d.id);
      setItems((p) => p.map((x) => (x.id === d.id ? (data as StudioAppointment) : x)));
      // Đổi NGÀY hoặc GIỜ là thứ người phụ trách và khách cần biết ngay — đổi
      // phòng hay ghi chú thì không, nên chỉ báo khi hai thứ đó thay đổi.
      if (before && (before.appt_date !== d.appt_date || (before.start_time ?? "") !== (d.start_time.trim() || ""))) {
        const a = data as StudioAppointment;
        await notify("contract_changed", `Đổi lịch “${apptTitle(a)}” sang ${fmtDayMonth(a.appt_date)}${a.start_time ? ` · ${a.start_time}` : ""}`, a.contract_id);
      }
      toast("Đã lưu lịch hẹn.");
    } else {
      const { data, error } = await supabase.from("studio_appointments").insert(row).select("*").single();
      setBusy(false);
      if (error || !data) { toast(errMsg(error?.message)); return; }
      const a = data as StudioAppointment;
      setItems((p) => [...p, a]);
      if (a.crew_name) {
        await notify("assigned", `Phân công ${a.crew_name}: “${apptTitle(a)}” ngày ${fmtDayMonth(a.appt_date)}${a.start_time ? ` · ${a.start_time}` : ""}`, a.contract_id);
      }
      toast(`Đã đặt ${APPOINTMENT_KIND_LABEL[d.kind].toLowerCase()} ngày ${fmtDayMonth(d.appt_date)}.`);
    }
    setDraft(null);
  }

  async function remove(id: string) {
    setBusy(true);
    const { error } = await supabase.from("studio_appointments").delete().eq("id", id);
    setBusy(false);
    if (error) { toast(errMsg(error.message)); return; }
    setItems((p) => p.filter((x) => x.id !== id));
    setDraft(null);
    toast("Đã xoá lịch hẹn.");
  }

  /** Đẩy trạng thái: đã xếp → đã check-in → đã hoàn tất. */
  async function advance(a: StudioAppointment) {
    const next: AppointmentStatus = a.status === "scheduled" ? "checked_in" : "done";
    const patch: Partial<StudioAppointment> = {
      status: next,
      ...(next === "checked_in" ? { checked_in_at: new Date().toISOString() } : { done_at: new Date().toISOString() }),
    };
    setItems((p) => p.map((x) => (x.id === a.id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("studio_appointments").update(patch).eq("id", a.id);
    if (error) {
      setItems((p) => p.map((x) => (x.id === a.id ? a : x))); // trả về trạng thái cũ
      toast(errMsg(error.message));
      return;
    }
    toast(next === "checked_in" ? `Đã check-in · ${apptTitle(a)}` : `Đã đánh dấu hoàn thành · ${apptTitle(a)}`);
  }

  function errMsg(m?: string | null) {
    if (m?.includes("studio_appointments") || m?.includes("studio_rooms")) {
      return "Chưa chạy migration studio_appointments.sql trong Supabase.";
    }
    return m || "Không lưu được.";
  }

  function openNew(date: string, kind?: AppointmentKind) {
    if (readOnly) return;
    // Đang xem một cơ sở thì lịch mới thuộc luôn cơ sở đó — nếu không, buổi vừa
    // đặt sẽ biến mất khỏi lưới ngay sau khi lưu (vì lưới đang lọc theo chi nhánh).
    setDraft(emptyDraft(date, kind ?? firstOnKind(), defaultBranchId ?? ""));
  }
  function firstOnKind(): AppointmentKind {
    return APPOINTMENT_KINDS.find((k) => kindOn[k]) ?? "makeup";
  }

  /* ── Vẽ ───────────────────────────────────────────────────────────────── */

  const rangeLabel = `${fmtDayMonth(weekStart)} – ${fmtDayMonth(weekEnd)}`;

  return (
    <div className="page-in mx-auto flex w-full max-w-[1320px] flex-col gap-3.5">
      {/* ── Đầu trang ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[19px] font-bold" style={{ letterSpacing: "-.4px" }}>Lịch studio</h1>
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
            Trang điểm · Thử đồ · Chụp pre-wedding · Tư vấn — tuần {rangeLabel}
          </p>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-[10px] p-1" style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}>
            <button
              onClick={() => setWeekAnchor((w) => addDays(w, -7))}
              className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px]"
              style={{ color: "var(--tx2)" }}
              aria-label="Tuần trước"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              onClick={() => setWeekAnchor(mondayOf(today))}
              className="px-2 text-[12px] font-semibold"
              style={{ color: weekStart === mondayOf(today) ? "var(--ac)" : "var(--tx2)" }}
            >
              Tuần này
            </button>
            <button
              onClick={() => setWeekAnchor((w) => addDays(w, 7))}
              className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px]"
              style={{ color: "var(--tx2)" }}
              aria-label="Tuần sau"
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <Link
            href="/dashboard/studio/calendar"
            className="flex flex-none items-center gap-1.5 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold"
            style={{ border: "1px solid var(--bd)", background: "var(--sf)", color: "var(--tx2)" }}
          >
            <CalendarDays size={15} /> Lịch làm việc
          </Link>
          {!readOnly && (
            <button
              onClick={() => openNew(days[0])}
              className="flex flex-none items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12.5px] font-bold"
              style={{ background: "var(--ac)", color: "#fff" }}
            >
              <Plus size={16} /> Đặt lịch mới
            </button>
          )}
        </div>
      </div>

      {/* ── Chip lọc theo loại ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {APPOINTMENT_KINDS.map((k) => {
          const { label, tone } = kindMeta(k);
          const on = kindOn[k];
          const n = counts[k] ?? 0;
          return (
            <button
              key={k}
              onClick={() => setKindOn((p) => ({ ...p, [k]: !p[k] }))}
              className="flex flex-none items-center gap-1.5 rounded-[20px] px-3 py-[7px] text-[12px]"
              style={
                on
                  ? { background: tone.soft, color: tone.fg, fontWeight: 700, border: "1px solid transparent" }
                  : { background: "var(--sf)", color: "var(--tx3)", fontWeight: 550, border: "1px solid var(--bd)" }
              }
              aria-pressed={on}
            >
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: on ? tone.fg : "var(--bd2)" }} />
              {label}
              <span className="tnum" style={{ opacity: 0.75 }}>{n}</span>
            </button>
          );
        })}
        <span className="ml-auto text-[11.5px]" style={{ color: "var(--tx3)" }}>
          {shown.length} lịch hiển thị trong tuần
        </span>
      </div>

      {/* ── Lưới tuần + rail ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3.5 min-[1180px]:grid-cols-[minmax(0,1fr)_300px]">
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="grid min-w-[1020px]" style={{ gridTemplateColumns: "repeat(7, minmax(146px, 1fr))" }}>
              {days.map((d, i) => {
                const list = byDay.get(d) ?? [];
                const isToday = d === today;
                return (
                  <div key={d} style={{ borderLeft: i === 0 ? "none" : "1px solid var(--bd2)", background: isToday ? "var(--acS)" : "transparent" }}>
                    <div
                      className="sticky top-0 z-10 px-2.5 py-2"
                      style={{ background: isToday ? "var(--acM)" : "var(--sf2)", borderBottom: "1px solid var(--bd2)" }}
                    >
                      <p className="text-[10.5px] font-bold uppercase" style={{ letterSpacing: ".4px", color: isToday ? "var(--ac)" : "var(--tx3)" }}>
                        {WD[i]}
                      </p>
                      <p className="tnum text-[17px] font-bold leading-tight" style={{ letterSpacing: "-.5px", color: isToday ? "var(--ac)" : "var(--tx)" }}>
                        {fmtDayMonth(d)}
                      </p>
                      <p className="tnum text-[11px]" style={{ color: isToday ? "var(--ac)" : "var(--tx3)" }}>
                        {list.length ? `${list.length} lịch` : "—"}
                      </p>
                    </div>

                    <div className="flex min-h-[220px] flex-col gap-1.5 p-2">
                      {list.map((a) => {
                        const { tone, Icon } = kindMeta(a.kind);
                        const clash = conflictKeys.has(a.id);
                        return (
                          <button
                            key={a.id}
                            onClick={() => setDraft(draftOf(a))}
                            className="w-full rounded-[10px] px-2 py-1.5 text-left"
                            style={{
                              background: tone.soft,
                              borderLeft: `3px solid ${tone.fg}`,
                              // Trùng lịch: thêm viền đỏ mảnh quanh thẻ để thấy ngay
                              // trên lưới, không phải đối chiếu với rail bên phải.
                              outline: clash ? "1px solid var(--rd)" : "none",
                              opacity: a.status === "done" ? 0.72 : 1,
                            }}
                          >
                            <p className="tnum flex items-center gap-1 text-[11px] font-bold" style={{ color: tone.fg }}>
                              <Icon size={12} /> {a.start_time ? apptTimeRange(a) : "Cả ngày"}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[12px] font-semibold" style={{ textWrap: "pretty" }}>
                              {apptTitle(a)}
                            </p>
                            {/* Dự báo cho buổi ngoài trời — tự ẩn với lịch trong
                                nhà và với buổi ngoài tầm 7 ngày. */}
                            <WeatherChip day={weather.dayOf(a.id)} />
                            <p className="mt-1 flex items-center gap-1 text-[10.5px]" style={{ color: "var(--tx3)" }}>
                              <span
                                className="flex h-[17px] w-[17px] flex-none items-center justify-center rounded-full text-[8px] font-bold"
                                style={avatarStyle(a.crew_name)}
                              >
                                {initials(a.crew_name)}
                              </span>
                              <span className="truncate">{assigneeName(a)}</span>
                              {a.status !== "scheduled" && (
                                <span className="flex-none font-bold" style={{ color: a.status === "done" ? "var(--gn)" : "var(--ac)" }}>
                                  · {APPOINTMENT_STATUS_LABEL[a.status]}
                                </span>
                              )}
                            </p>
                          </button>
                        );
                      })}

                      {!readOnly && (
                        <button
                          onClick={() => openNew(d)}
                          className="mt-auto rounded-[10px] px-2 py-2 text-[11px] font-semibold"
                          style={{ border: "1px dashed var(--bd)", color: "var(--tx3)" }}
                        >
                          {list.length === 0 ? "Trống — đặt lịch" : "+ Thêm lịch"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>

        {/* ── Rail phải ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3.5">
          <Panel>
            <PanelHead icon={UsersRound} tone="brand" title="Ê-kíp trong tuần" count={String(crewLoad.length)} />
            {crewLoad.length === 0 ? (
              <EmptyState icon={UsersRound} title="Chưa phân công ai" hint="Mở một lịch hẹn rồi chọn người phụ trách." />
            ) : (
              <div className="flex flex-col">
                {crewLoad.map((c) => (
                  <div key={c.name + c.n} className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderTop: "1px solid var(--bd2)" }}>
                    <span
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-bold"
                      style={avatarStyle(c.name)}
                    >
                      {initials(c.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold">{c.name}</p>
                      <p className="tnum text-[11px]" style={{ color: "var(--tx3)" }}>{c.n} lịch trong tuần</p>
                    </div>
                    {c.conflict ? <Pill tone="red" dot>Trùng lịch</Pill> : c.n >= 8 ? <Pill tone="amber" dot>Kín lịch</Pill> : <Pill tone="green" dot>Còn trống</Pill>}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {conflicts.length > 0 && (
            <div
              className="rounded-[14px] px-4 py-3.5"
              style={{ background: "var(--rdS)", border: "1px solid color-mix(in srgb, var(--rd) 22%, var(--sf))" }}
            >
              <p className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color: "var(--rd)" }}>
                <AlertCircle size={16} /> Cảnh báo trùng lịch
              </p>
              <div className="mt-2 flex flex-col gap-2.5">
                {conflicts.slice(0, 4).map((c) => (
                  <div key={c.key}>
                    <p className="text-[12px] font-semibold" style={{ textWrap: "pretty" }}>
                      {c.scope === "room" ? "Phòng " : ""}{c.name} · {fmtDayMonth(c.date)}
                    </p>
                    <p className="tnum mt-0.5 text-[11.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                      {c.items.map((i) => `${apptTimeRange(i)} ${apptTitle(i)}`).join(" · ")}
                    </p>
                    {!readOnly && (
                      <button
                        onClick={() => setDraft(draftOf(c.items[c.items.length - 1]))}
                        className="mt-1.5 rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-bold"
                        style={{ background: "var(--rd)", color: "#fff" }}
                      >
                        {c.scope === "room" ? "Đổi phòng" : "Đổi người phụ trách"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Panel>
            <PanelHead icon={DoorOpen} tone="blue" title="Phòng & nguồn lực" note="Công suất tuần" />
            {loads.length === 0 ? (
              <EmptyState icon={DoorOpen} title="Chưa khai phòng nào" hint="Thêm phòng để lịch tính được công suất mỗi tuần." />
            ) : (
              <div className="flex flex-col">
                {loads.map((l) => (
                  <div key={l.room.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: "1px solid var(--bd2)" }}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold">{l.room.name}</p>
                      <p className="tnum text-[11px]" style={{ color: "var(--tx3)" }}>
                        {l.used}/{l.room.capacity_week} buổi
                      </p>
                    </div>
                    <div className="w-[70px] flex-none">
                      <ProgressBar
                        pct={l.pct}
                        height={6}
                        color={l.pct >= 90 ? "var(--rd)" : l.pct >= 65 ? "var(--am)" : "var(--gn)"}
                      />
                      <p className="tnum mt-1 text-right text-[10.5px] font-bold" style={{ color: "var(--tx3)" }}>{l.pct}%</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* ── Hộp thoại đặt / sửa lịch ────────────────────────────────────── */}
      {draft && (
        <ApptDialog
          draft={draft}
          setDraft={setDraft}
          rooms={rooms}
          assignees={assignees}
          contracts={contracts}
          branches={branches}
          busy={busy}
          readOnly={readOnly}
          weatherDay={draft.id ? weather.dayOf(draft.id) : null}
          studioCoords={studioCoords}
          shootCoords={draft.id ? weather.coordsOf(draft.id) : null}
          onSave={save}
          onDelete={remove}
          onAdvance={() => {
            const a = items.find((x) => x.id === draft.id);
            if (a) { advance(a); setDraft(null); }
          }}
        />
      )}

      {toastNode}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HỘP THOẠI ĐẶT LỊCH
   ═══════════════════════════════════════════════════════════════════════════ */

function ApptDialog({
  draft, setDraft, rooms, assignees, contracts, branches, busy, readOnly, onSave, onDelete, onAdvance,
  weatherDay = null, studioCoords = null, shootCoords = null,
}: {
  draft: Draft;
  setDraft: (d: Draft | null) => void;
  rooms: StudioRoom[];
  assignees: CrewOption[];
  contracts: ContractOption[];
  branches: { id: string; name: string }[];
  busy: boolean;
  readOnly: boolean;
  onSave: () => void;
  onDelete: (id: string) => void;
  onAdvance: () => void;
  /** Dự báo ĐÚNG ngày của buổi này (null nếu trong nhà / ngoài 7 ngày). */
  weatherDay?: DayForecast | null;
  studioCoords?: { lat: number; lng: number } | null;
  shootCoords?: { lat: number; lng: number } | null;
}) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  const { label, tone, Icon } = kindMeta(draft.kind);
  // Giờ kết thúc trước giờ bắt đầu là lỗi nhập tay hay gặp — chặn ngay tại form.
  const s = toMinutes(draft.start_time);
  const e = toMinutes(draft.end_time);
  const badRange = s != null && e != null && e <= s;

  return (
    <Modal onClose={() => setDraft(null)} labelledBy="appt-dialog-title">
        <div className="flex items-center gap-2.5 px-[18px] py-3.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
          <KindPill icon={Icon} fg={tone.fg} soft={tone.soft}>{label}</KindPill>
          <h2 id="appt-dialog-title" className="text-[14.5px] font-bold">{draft.id ? "Sửa lịch hẹn" : "Đặt lịch mới"}</h2>
          <button onClick={() => setDraft(null)} className="ml-auto flex-none rounded-[9px] p-1.5" style={{ background: "var(--sf2)", color: "var(--tx2)" }} aria-label="Đóng">
            <XIcon size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto px-[18px] py-4">
          <Field label="Loại lịch">
            <select className="input" value={draft.kind} onChange={(ev) => set("kind", ev.target.value as AppointmentKind)} disabled={readOnly}>
              {APPOINTMENT_KINDS.map((k) => (
                <option key={k} value={k}>{APPOINTMENT_KIND_LABEL[k]}</option>
              ))}
            </select>
          </Field>

          <Field label="Tiêu đề">
            <input
              className="input"
              value={draft.title}
              onChange={(ev) => set("title", ev.target.value)}
              placeholder={`${label} — để trống sẽ tự đặt theo loại + tên khách`}
              disabled={readOnly}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Ngày">
              <input className="input" type="date" value={draft.appt_date} onChange={(ev) => set("appt_date", ev.target.value)} disabled={readOnly} />
            </Field>
            <Field label="Bắt đầu">
              <input className="input" type="time" value={draft.start_time} onChange={(ev) => set("start_time", ev.target.value)} disabled={readOnly} />
            </Field>
            <Field label="Kết thúc">
              <input className="input" type="time" value={draft.end_time} onChange={(ev) => set("end_time", ev.target.value)} disabled={readOnly} />
            </Field>
          </div>
          {badRange && (
            <p className="text-[11.5px] font-semibold" style={{ color: "var(--rd)" }}>
              Giờ kết thúc phải sau giờ bắt đầu.
            </p>
          )}

          <Field label="Hợp đồng">
            <select
              className="input"
              value={draft.contract_id}
              disabled={readOnly}
              onChange={(ev) => {
                const id = ev.target.value;
                const c = contracts.find((x) => x.id === id);
                // Gắn hợp đồng thì điền luôn tên/SĐT khách — khỏi nhập lại thứ
                // hợp đồng đã có, và cổng khách nhận đúng mốc lịch của họ.
                setDraft({
                  ...draft,
                  contract_id: id,
                  client_name: c?.client_name || draft.client_name,
                  client_phone: c?.client_phone || draft.client_phone,
                });
              }}
            >
              <option value="">— Không gắn hợp đồng —</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} · ` : ""}{c.title}{c.client_name ? ` — ${c.client_name}` : ""}
                </option>
              ))}
            </select>
          </Field>

          {branches.length > 0 && (
            <Field label="Chi nhánh">
              <select className="input" value={draft.branch_id} onChange={(ev) => set("branch_id", ev.target.value)} disabled={readOnly}>
                <option value="">— Chưa gán chi nhánh —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Người phụ trách">
              <select className="input" value={draft.assignee} onChange={(ev) => set("assignee", ev.target.value)} disabled={readOnly}>
                <option value="">— Chưa phân công —</option>
                {assignees.map((a) => (
                  <option key={a.key} value={a.key}>{a.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Phòng">
              <input
                className="input"
                list="studio-rooms"
                value={draft.room}
                onChange={(ev) => set("room", ev.target.value)}
                placeholder="Phòng trang điểm 1…"
                disabled={readOnly}
              />
              <datalist id="studio-rooms">
                {rooms.map((r) => <option key={r.id} value={r.name} />)}
              </datalist>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Khách hàng">
              <input className="input" value={draft.client_name} onChange={(ev) => set("client_name", ev.target.value)} disabled={readOnly} />
            </Field>
            <Field label="Số điện thoại">
              <input className="input" value={draft.client_phone} onChange={(ev) => set("client_phone", ev.target.value)} disabled={readOnly} />
            </Field>
          </div>

          <Field label="Địa điểm">
            <input className="input" value={draft.location} onChange={(ev) => set("location", ev.target.value)} placeholder="Đồi chè Cầu Đất, Đà Lạt…" disabled={readOnly} />
            {/* Dự báo nằm NGAY DƯỚI ô địa điểm: đây là lúc studio đang nghĩ về
                nơi chụp, nên là chỗ duy nhất con số mưa đổi được quyết định. */}
            {weatherDay && (
              <div className="mt-2">
                <WeatherDetail
                  day={weatherDay}
                  startTime={draft.start_time || null}
                  from={studioCoords}
                  to={shootCoords}
                />
              </div>
            )}
          </Field>

          <Field label="Ghi chú">
            <textarea className="input" rows={2} value={draft.note} onChange={(ev) => set("note", ev.target.value)} placeholder="Dị ứng phấn nhũ, mang thêm áo dài…" disabled={readOnly} />
          </Field>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-[11px] px-3 py-2.5" style={{ background: "var(--sf2)" }}>
            <input
              type="checkbox"
              checked={draft.client_visible}
              onChange={(ev) => set("client_visible", ev.target.checked)}
              className="mt-0.5"
              disabled={readOnly}
            />
            <span>
              <span className="block text-[12.5px] font-semibold">Hiện cho khách trên cổng khách hàng</span>
              <span className="block text-[11px]" style={{ color: "var(--tx3)" }}>
                Tắt với lịch nội bộ (họp ê-kíp, giữ phòng) — khách sẽ không thấy mốc này.
              </span>
            </span>
          </label>

          {draft.id && (
            <Field label="Trạng thái">
              <select className="input" value={draft.status} onChange={(ev) => set("status", ev.target.value as AppointmentStatus)} disabled={readOnly}>
                {(["scheduled", "checked_in", "done", "cancelled"] as AppointmentStatus[]).map((k) => (
                  <option key={k} value={k}>{APPOINTMENT_STATUS_LABEL[k]}</option>
                ))}
              </select>
            </Field>
          )}

          {draft.contract_id && (
            <Link
              href={`/dashboard/studio/contracts/${draft.contract_id}`}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold"
              style={{ color: "var(--ac)" }}
            >
              <FileText size={15} /> Mở hợp đồng liên quan →
            </Link>
          )}
        </div>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2 px-[18px] py-3.5" style={{ borderTop: "1px solid var(--bd2)" }}>
            {draft.id && draft.status !== "done" && (
              <button
                onClick={onAdvance}
                className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold"
                style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
              >
                {draft.status === "scheduled" ? <><Check size={15} /> Check-in</> : <><CalendarClock size={15} /> Hoàn thành</>}
              </button>
            )}
            {draft.id && (
              <button
                onClick={() => onDelete(draft.id!)}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold"
                style={{ border: "1px solid color-mix(in srgb, var(--rd) 40%, transparent)", color: "var(--rd)" }}
              >
                <Trash2 size={15} /> Xoá
              </button>
            )}
            <button
              onClick={onSave}
              disabled={busy || badRange}
              className="ml-auto rounded-[10px] px-4 py-2 text-[12.5px] font-bold disabled:opacity-50"
              style={{ background: "var(--ac)", color: "#fff" }}
            >
              {busy ? "Đang lưu…" : draft.id ? "Lưu thay đổi" : "Đặt lịch"}
            </button>
          </div>
        )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase" style={{ letterSpacing: ".4px", color: "var(--tx3)" }}>{label}</span>
      {children}
    </label>
  );
}
