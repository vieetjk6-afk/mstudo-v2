"use client";

import { useMemo, useState } from "react";
import { PlayCircle, Send, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { apptTitle } from "@/lib/appointments";
import { todayVN } from "@/lib/date";
import type { AppointmentStatus, ProductStatus, StudioAppointment, StudioNotification } from "@/lib/types";
import type { ChecklistRow, TaskRow } from "./StaffPortal";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC CHUNG của cổng nhân viên — bản cũ (StaffPortal/TodayView/TaskQueue/
   StaffNotifications) và giao diện mới (StaffPortalV2) cùng gọi các hook dưới
   đây, nên check-in, đổi trạng thái việc hậu kỳ, tick checklist và đánh dấu đã
   đọc ghi vào CÙNG bảng, CÙNG cột, CÙNG câu báo — hai giao diện không thể lệch.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Vai trò được xem việc của CẢ studio, không chỉ việc gán cho mình. */
export const SEES_ALL = ["owner", "admin", "manager"];

/**
 * Phạm vi "Việc của tôi" / "Cả studio" và các danh sách lọc theo phạm vi.
 * Mặc định: có việc gán cho mình thì mở "của tôi", chưa có gì thì mở "cả studio"
 * — tránh cảnh mở app ra trống trơn trong khi hôm nay studio có 6 buổi.
 */
export function useStaffScope({
  me,
  actingRole,
  appointments,
  tasks,
  today,
}: {
  me: string;
  actingRole: string;
  appointments: StudioAppointment[];
  tasks: TaskRow[];
  today: string;
}) {
  const hasMine = useMemo(
    () => appointments.some((a) => a.staff_id === me) || tasks.some((t) => t.assigned_to === me),
    [appointments, tasks, me]
  );
  const [scope, setScope] = useState<"mine" | "all">(hasMine ? "mine" : "all");
  const canSeeAll = SEES_ALL.includes(actingRole);

  const myAppts = useMemo(
    () => (scope === "mine" ? appointments.filter((a) => a.staff_id === me) : appointments),
    [appointments, scope, me]
  );
  const myTasks = useMemo(
    () => (scope === "mine" ? tasks.filter((t) => t.assigned_to === me || t.contract?.assigned_to === me) : tasks),
    [tasks, scope, me]
  );
  const todayAppts = useMemo(() => myAppts.filter((a) => a.appt_date === today), [myAppts, today]);
  const openTasks = useMemo(() => myTasks.filter((t) => t.status !== "done"), [myTasks]);

  return { scope, setScope, canSeeAll, myAppts, myTasks, todayAppts, openTasks };
}

/* ── Check-in → hoàn thành ─────────────────────────────────────────────── */

/** Bước kế tiếp của một lịch: đã xếp → check-in → hoàn thành. */
export function nextApptStatus(a: Pick<StudioAppointment, "status">): AppointmentStatus {
  return a.status === "scheduled" ? "checked_in" : "done";
}

/**
 * Check-in → hoàn thành. Cùng cột `status` với lịch studio, nên chủ studio thấy
 * ngay nhân viên đã tới điểm hẹn chưa mà không cần nhắn hỏi. Cập nhật lạc quan,
 * lỗi thì trả lại như cũ.
 */
export function useApptCheckIn(initial: StudioAppointment[], toast: (m: string) => void) {
  const supabase = createClient();
  const [appts, setAppts] = useState(initial);

  async function advance(a: StudioAppointment) {
    const next = nextApptStatus(a);
    const patch =
      next === "checked_in"
        ? { status: next, checked_in_at: new Date().toISOString() }
        : { status: next, done_at: new Date().toISOString() };
    setAppts((p) => p.map((x) => (x.id === a.id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("studio_appointments").update(patch).eq("id", a.id);
    if (error) {
      setAppts((p) => p.map((x) => (x.id === a.id ? a : x)));
      toast("Không cập nhật được — thử lại.");
      return;
    }
    toast(next === "checked_in" ? `Đã check-in · ${apptTitle(a)}` : `Đã đánh dấu hoàn thành · ${apptTitle(a)}`);
  }

  return { appts, advance };
}

/* ── Checklist việc sau buổi chụp ──────────────────────────────────────── */
export function useChecklist(initial: ChecklistRow[], toast: (m: string) => void) {
  const supabase = createClient();
  const [checks, setChecks] = useState(initial);

  async function toggleTask(t: ChecklistRow) {
    const done = !t.done;
    setChecks((p) => p.map((x) => (x.id === t.id ? { ...x, done } : x)));
    const { error } = await supabase.from("contract_tasks").update({ done }).eq("id", t.id);
    if (error) {
      setChecks((p) => p.map((x) => (x.id === t.id ? t : x)));
      toast("Không lưu được — thử lại.");
    }
  }

  return { checks, toggleTask };
}

/* ── Hàng đợi hậu kỳ (contract_products) ───────────────────────────────── */

/**
 * Máy trạng thái ba bước của contract_products (ordered → in_progress → done) —
 * xem ghi chú ở TaskQueue.tsx vì sao không có bước "Chờ duyệt".
 */
export const TASK_FLOW: Record<ProductStatus, { next: ProductStatus | null; btn: string; Icon: typeof Send; toast: string }> = {
  ordered: { next: "in_progress", btn: "Nhận việc", Icon: PlayCircle, toast: "Đã nhận việc" },
  in_progress: { next: "done", btn: "Bàn giao", Icon: Send, toast: "Đã bàn giao" },
  done: { next: null, btn: "Xem lại", Icon: Eye, toast: "Đã giao trước đó" },
};

/** Màu + phần trăm thanh tiến độ theo bước (bảng không đếm số ảnh). */
export const TASK_TONE: Record<ProductStatus, { fg: string; soft: string; pct: number }> = {
  ordered: { fg: "var(--tx3)", soft: "var(--sf2)", pct: 5 },
  in_progress: { fg: "var(--bl)", soft: "var(--blS)", pct: 55 },
  done: { fg: "var(--gn)", soft: "var(--gnS)", pct: 100 },
};

/** Danh sách việc hậu kỳ + thao tác đẩy sang bước kế (Nhận việc / Bàn giao). */
export function useTaskItems(rows: TaskRow[], toast: (m: string) => void) {
  const supabase = createClient();
  const [items, setItems] = useState(rows);

  async function push(r: TaskRow) {
    const flow = TASK_FLOW[r.status];
    if (!flow.next) {
      toast(`${flow.toast} · ${r.contract?.code ?? r.name}`);
      return;
    }
    const next = flow.next;
    setItems((p) => p.map((x) => (x.id === r.id ? { ...x, status: next } : x)));
    const { error } = await supabase.from("contract_products").update({ status: next }).eq("id", r.id);
    if (error) {
      setItems((p) => p.map((x) => (x.id === r.id ? r : x)));
      toast("Không cập nhật được — thử lại.");
      return;
    }
    toast(`${flow.toast} · ${r.contract?.code ?? r.name}`);
  }

  return { items, push };
}

export type TaskFilter = "all" | ProductStatus;

/** Việc còn mở đã quá hạn giao. */
export function isTaskLate(r: TaskRow, today: string): boolean {
  return r.status !== "done" && !!r.contract?.delivery_due && r.contract.delivery_due < today;
}

/** Lọc theo trạng thái + đếm từng nhóm + việc trễ hạn; hạn gần nhất lên đầu. */
export function useTaskFilter(items: TaskRow[], today: string) {
  const [filter, setFilter] = useState<TaskFilter>("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length, ordered: 0, in_progress: 0, done: 0 };
    for (const r of items) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [items]);

  const overdue = useMemo(() => items.filter((r) => isTaskLate(r, today)), [items, today]);

  const visible = useMemo(() => {
    const list = filter === "all" ? items : items.filter((r) => r.status === filter);
    // Hạn gần nhất lên đầu; việc chưa có hạn xuống cuối.
    return [...list].sort((a, b) => (a.contract?.delivery_due || "9999-99-99").localeCompare(b.contract?.delivery_due || "9999-99-99"));
  }, [items, filter]);

  return { filter, setFilter, counts, overdue, visible };
}

/* ── Thông báo ─────────────────────────────────────────────────────────── */

/** Ngày (giờ Việt Nam) của một mốc ISO. */
function vnDay(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** "vừa xong" / "3 giờ" / "12/07" — cột thời gian bên phải mỗi hàng. */
export function shortWhen(iso: string, today: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút`;
  const isToday = new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10) === today;
  if (isToday) return `${Math.floor(mins / 60)} giờ`;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Dòng thông báo của studio (studio_notifications): nhóm "Hôm nay" / "Trước đó",
 * đánh dấu đã đọc từng hàng hoặc tất cả.
 */
export function useStaffNotifications(initial: StudioNotification[], toast: (m: string) => void) {
  const supabase = createClient();
  const [items, setItems] = useState(initial);
  const today = todayVN();

  const unread = useMemo(() => items.filter((n) => !n.read), [items]);

  const groups = useMemo(() => {
    const isToday = (n: StudioNotification) => vnDay(n.created_at) === today;
    return [
      { label: "Hôm nay", rows: items.filter(isToday) },
      { label: "Trước đó", rows: items.filter((n) => !isToday(n)) },
    ].filter((g) => g.rows.length > 0);
  }, [items, today]);

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    setItems((p) => p.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    const { error } = await supabase.from("studio_notifications").update({ read: true }).in("id", ids);
    if (error) toast("Không lưu được trạng thái đã đọc.");
  }

  function markAllRead() {
    markRead(unread.map((n) => n.id));
    toast("Đã đánh dấu đọc tất cả.");
  }

  return { items, unread, groups, markRead, markAllRead, today };
}
