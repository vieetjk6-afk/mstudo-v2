"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/studio/Toast";
import { useShootWeather } from "@/components/studio/WeatherChip";
import { availabilityOn, digitsOnly } from "@/lib/timesheet";
import { fmtDayMonth } from "@/lib/date";
import { inBranch } from "@/lib/branch-rules";
import {
  apptTitle, assigneeKey, assigneeName, byStartTime, countByKind, findConflicts, mondayOf, roomLoads, weekDays,
} from "@/lib/appointments";
import {
  APPOINTMENT_KINDS, APPOINTMENT_KIND_LABEL,
  type AppointmentKind, type AppointmentStatus, type StudioAppointment, type StudioRoom,
} from "@/lib/types";
import type { CrewOption } from "./SchedulePage";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC DÙNG CHUNG của tab "Lịch studio" — bản cũ (SchedulePage) và bản giao
   diện mới (ScheduleV2) cùng gọi: dữ liệu lịch hẹn, tuần đang xem, chip lọc
   loại, form đặt/sửa lịch, và mọi thao tác ghi (lưu, xoá, check-in/hoàn
   thành, ghi thông báo). Hai bản chỉ khác nhau ở phần vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Form đặt lịch — giữ riêng khỏi bản ghi DB vì mọi ô đều là chuỗi khi đang nhập. */
export type Draft = {
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

export function emptyDraft(date: string, kind: AppointmentKind = "makeup", branchId = ""): Draft {
  return {
    id: null, kind, title: "", appt_date: date, start_time: "", end_time: "",
    location: "", room: "", assignee: "", contract_id: "", client_name: "", client_phone: "",
    note: "", client_visible: true, status: "scheduled", branch_id: branchId,
  };
}

export function draftOf(a: StudioAppointment): Draft {
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

export type ScheduleInput = {
  ownerId: string;
  readOnly: boolean;
  today: string;
  initialAppointments: StudioAppointment[];
  rooms: StudioRoom[];
  assignees: CrewOption[];
  defaultBranchId?: string | null;
  crewFree?: { phone: string; date: string }[];
  crewBusy?: { phone: string; date: string }[];
  /** Khoảng ngày server đã nạp sẵn (initialAppointments) và phạm vi chi nhánh
   *  đang xem — để tự nạp thêm khi người dùng lật ra ngoài khoảng đó. */
  loadedRange?: { from: string; to: string } | null;
  branchScope?: string | null;
};

export function useSchedule({
  ownerId, readOnly, today, initialAppointments, rooms, assignees,
  defaultBranchId = null, crewFree = [], crewBusy = [], loadedRange = null, branchScope = null,
}: ScheduleInput) {
  const supabase = useMemo(() => createClient(), []);
  const { toast, toastNode } = useToast();

  const [items, setItems] = useState<StudioAppointment[]>(initialAppointments);

  /* Server chỉ nạp sẵn ~4 tuần trước → 12 tuần sau. Lật lịch (tuần/tháng) ra
     ngoài khoảng đó thì nạp thêm đúng đoạn còn thiếu — trước đây những tháng ấy
     hiện "chưa có lịch hẹn" dù thật ra có lịch. */
  const loaded = useRef(loadedRange);
  const ensureRange = useCallback(
    async (from: string, to: string) => {
      const cur = loaded.current;
      if (!cur || (from >= cur.from && to <= cur.to)) return;
      // Chỉ nạp phần nằm ngoài khoảng đã có (lật về trước / lật về sau / cả hai).
      const qFrom = from < cur.from ? from : cur.to;
      const qTo = to > cur.to ? to : cur.from;
      loaded.current = { from: from < cur.from ? from : cur.from, to: to > cur.to ? to : cur.to };
      const { data, error } = await supabase
        .from("studio_appointments")
        .select("*")
        .eq("owner_id", ownerId)
        .gte("appt_date", qFrom)
        .lte("appt_date", qTo);
      if (error) {
        loaded.current = cur; // cho lần lật sau thử lại
        return;
      }
      const rows = ((data ?? []) as StudioAppointment[]).filter((a) => inBranch(a, branchScope));
      setItems((prev) => {
        const have = new Set(prev.map((a) => a.id));
        return [...prev, ...rows.filter((a) => !have.has(a.id))];
      });
    },
    [supabase, ownerId, branchScope]
  );
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

  /**
   * Thợ này RẢNH / BẬN / CHƯA RÕ vào ngày đó. Luật ưu tiên ở @/lib/timesheet:
   * báo bận thắng khai rảnh, và chưa khai gì là "chưa rõ" chứ không phải "rảnh"
   * — phần lớn thợ không bao giờ vào khai, coi im lặng là rảnh sẽ khiến màn này
   * tự tin gán việc cho người đang đi làm chỗ khác.
   */
  const availabilityOf = useCallback(
    (phone: string | null | undefined, date: string) => {
      const d = digitsOnly(phone);
      if (!d || !date) return "unknown" as const;
      return availabilityOn(
        date,
        crewFree.filter((x) => digitsOnly(x.phone) === d).map((x) => ({ date: x.date, start: null, end: null })),
        crewBusy.filter((x) => digitsOnly(x.phone) === d).map((x) => ({ date: x.date, start: null, end: null }))
      );
    },
    [crewFree, crewBusy]
  );
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


  return {
    toast, toastNode, items, setItems, ensureRange, weekAnchor, setWeekAnchor, kindOn, setKindOn, draft, setDraft, busy,
    days, weekStart, weekEnd, weekItems, counts, weather, availabilityOf, shown, byDay,
    conflicts, conflictKeys, loads, crewLoad, save, remove, advance, openNew, firstOnKind,
  };
}
