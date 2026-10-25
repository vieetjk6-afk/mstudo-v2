"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { contractTotal, sumAmounts } from "@/lib/types";
import { crewRoleLabel, type CrewRoleRow } from "@/lib/crew-roles";
import type { ContractMarker, EventRow } from "./CalendarView";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC DÙNG CHUNG của tab "Buổi chụp" — bản cũ (CalendarView) và bản giao
   diện mới (CalendarV2) cùng gọi, để hai bản không mỗi nơi một cách ghi dữ liệu.

   • Hàm thuần: lưới tháng, tuần, tóm tắt khoảng đang xem, lịch theo nhân sự…
   • useShootCalendar(): dữ liệu (mốc ghi chú + buổi chụp) và MỌI thao tác ghi —
     thêm/xoá mốc (kèm đồng bộ Google Lịch), đổi màu buổi chụp, đẩy lịch cũ
     lên Google. Trạng thái giao diện (đang xem tháng nào, ngày nào được chọn)
     để mỗi bản tự giữ, vì hai bản bày khác nhau.
   ═══════════════════════════════════════════════════════════════════════════ */

export const WD = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
export const MONTHS = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

// Default marker colour + the swatch palette the user can pick from per shoot.
export const DEFAULT_MARK = "#c7a76b";
export const MARK_COLORS = ["#c7a76b", "#3fb98a", "#6ba3c7", "#e0746f", "#b07ad0", "#d6a44a", "#7bb38a", "#e0719e"];

export function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Cộng/trừ `n` ngày vào một chuỗi YYYY-MM-DD (theo lịch, không theo múi giờ). */
export function shiftYmd(date: string, n: number): string {
  const [dy, dm, dd] = date.split("-").map(Number);
  const dt = new Date(dy, dm - 1, dd);
  dt.setDate(dt.getDate() + n);
  return ymd(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

/** Nhãn mốc: nếu mốc thuộc hợp đồng và KHÁC ngày hợp đồng chính → ghi rõ
 *  "{Tên mốc} — [Tên hợp đồng chính]" để không nhầm mốc thuộc hợp đồng nào. */
export function eventLabel(e: EventRow): string {
  const c = e.contract;
  if (c && c.event_date && c.event_date !== e.event_date) return `${e.title} — [${c.title}]`;
  return e.title;
}

/** Ê-kíp còn nhận việc (bỏ người đã từ chối) — dùng ở mọi chế độ xem. */
export function crewOf(c: ContractMarker) {
  return (c.contract_crew || []).filter((x) => x.status !== "declined");
}

/** "Album 30x30 x2, Ảnh cổng" — gói/hạng mục của một buổi. */
export function itemsLabel(c: ContractMarker, sep = ", ", times = "x") {
  return c.contract_items.map((it) => `${it.name}${it.qty > 1 ? ` ${times}${it.qty}` : ""}`).join(sep);
}

/** Ô của lịch tháng (T2 đầu tuần): null = ô đệm ngoài tháng. */
export function monthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const startWd = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWd; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Mon–Sun days of the week containing `anchor`. */
export function weekOf(anchor: string): string[] {
  const [wy, wm, wd] = anchor.split("-").map(Number);
  const base = new Date(wy, wm - 1, wd);
  const startWd = (base.getDay() + 6) % 7; // Mon=0
  const monday = new Date(base);
  monday.setDate(base.getDate() - startWd);
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return ymd(dt.getFullYear(), dt.getMonth(), dt.getDate());
  });
}

/** "08:30" → 8.5; không đọc được thì null (buổi "cả ngày"). */
export function hourOf(t: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec((t || "").trim());
  if (!m) return null;
  const h = Number(m[1]) + Number(m[2]) / 60;
  return h >= 0 && h < 24 ? h : null;
}

/**
 * Tóm tắt một khoảng ngày: số buổi, số mốc, buổi chưa phân công, giá trị, còn
 * phải thu và số ngày dồn lịch (≥3 buổi — ngưỡng cảnh báo ở Tổng quan).
 */
export function summarizeRange(days: string[], contractList: ContractMarker[], events: EventRow[]) {
  const set = new Set(days);
  const cons = contractList.filter((c) => set.has(c.event_date));
  const notes = events.filter((e) => set.has(e.event_date));
  const noCrew = cons.filter((c) => (c.contract_crew || []).filter((x) => x.status !== "declined").length === 0).length;
  const value = cons.reduce((sum, c) => sum + contractTotal(c.contract_items || []), 0);
  const due = cons.reduce(
    (sum, c) => sum + Math.max(0, contractTotal(c.contract_items || []) - sumAmounts(c.contract_payments || [])),
    0
  );
  const perDay = new Map<string, number>();
  for (const c of cons) perDay.set(c.event_date, (perDay.get(c.event_date) ?? 0) + 1);
  const busyDays = Array.from(perDay.values()).filter((n) => n >= 3).length;
  return { shoots: cons.length, notes: notes.length, noCrew, value, due, busyDays };
}

export type PeopleRow = { key: string; name: string; role: string; days: Map<string, ContractMarker[]> };

/**
 * Lịch theo nhân sự: mỗi người MỘT HÀNG × 7 ngày của tuần đang xem. Người nào
 * nhận ≥4 ngày/tuần là đang quá tải — đúng ngưỡng cảnh báo ở màn Tổng quan.
 */
export function peopleWeek(contractList: ContractMarker[], weekDays: string[], crewRoles: CrewRoleRow[]): PeopleRow[] {
  const map = new Map<string, PeopleRow>();
  for (const c of contractList) {
    if (!weekDays.includes(c.event_date)) continue;
    for (const cr of c.contract_crew || []) {
      if (cr.status === "declined") continue;
      const name = (cr.name || "").trim() || "Chưa đặt tên";
      const role = crewRoleLabel(cr.role, crewRoles);
      const cur = map.get(name) ?? { key: name, name, role, days: new Map<string, ContractMarker[]>() };
      const list = cur.days.get(c.event_date) ?? [];
      list.push(c);
      cur.days.set(c.event_date, list);
      map.set(name, cur);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.days.size - a.days.size || a.name.localeCompare(b.name));
}

/** `n` buổi chụp gần nhất SAU ngày `last` — gợi ý khi tuần đang xem trống. */
export function upcomingAfter(contractList: ContractMarker[], last: string, n = 3) {
  return contractList
    .filter((c) => c.event_date && c.event_date > last)
    .sort((a, b) => (a.event_date || "").localeCompare(b.event_date || ""))
    .slice(0, n);
}

export type NoteInput = { title: string; time: string; note: string; remind: boolean };

/** Dữ liệu + thao tác ghi của tab Buổi chụp. Xem ghi chú đầu file. */
export function useShootCalendar({
  ownerId,
  initialEvents,
  contracts,
  todayStr,
}: {
  ownerId: string;
  initialEvents: EventRow[];
  contracts: ContractMarker[];
  todayStr: string;
}) {
  const supabase = createClient();
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [contractList, setContractList] = useState<ContractMarker[]>(contracts);
  const [gcalMsg, setGcalMsg] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [busy, setBusy] = useState(false);

  /** Đẩy toàn bộ lịch ĐÃ CÓ lên Google — dành cho lịch tạo trước khi kết nối. */
  async function backfillGcal() {
    setBackfilling(true);
    setGcalMsg(null);
    try {
      const r = await fetch("/api/gcal/backfill", { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean; reason?: string; contracts?: number; events?: number; failed?: number; done?: boolean; firstError?: string | null;
      };
      if (!r.ok || !j.ok) {
        setGcalMsg(`Không đồng bộ được: ${j.reason ?? "lỗi không rõ"}`);
        return;
      }
      setGcalMsg(
        `Đã đẩy ${j.contracts ?? 0} hợp đồng và ${j.events ?? 0} ghi chú lên Google Lịch` +
          (j.failed ? ` · ${j.failed} mục lỗi (${j.firstError ?? ""})` : "") +
          (j.done === false ? " · còn dở, bấm lại để chạy tiếp" : "."),
      );
    } catch (e) {
      setGcalMsg(`Không đồng bộ được: ${(e as Error)?.message || e}`);
    } finally {
      setBackfilling(false);
    }
  }

  function eventsOn(dateStr: string) {
    return events.filter((e) => e.event_date === dateStr);
  }
  function contractsOn(dateStr: string) {
    return contractList.filter((c) => c.event_date === dateStr);
  }

  // Assign a distinct colour to a shoot so several on the same day stand apart.
  async function setContractColor(id: string, color: string) {
    setContractList((p) => p.map((c) => (c.id === id ? { ...c, calendar_color: color } : c)));
    await supabase.from("studio_contracts").update({ calendar_color: color }).eq("id", id);
  }

  /** Thêm một mốc ghi chú vào ngày `date`. Trả true khi đã lưu (để form tự xoá). */
  async function addNote(date: string, f: NoteInput): Promise<boolean> {
    setBusy(true);
    const { data } = await supabase
      .from("studio_events")
      .insert({
        owner_id: ownerId,
        title: f.title.trim() || "Ghi chú",
        event_date: date,
        event_time: f.time.trim() || null,
        note: f.note.trim() || null,
        remind: f.remind,
      })
      .select("*")
      .single();
    setBusy(false);
    if (!data) return false;
    setEvents((p) => [...p, data as EventRow]);
    // Sync to Google Calendar (fire-and-forget).
    fetch("/api/gcal/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "event", id: data.id, action: "upsert" }),
    })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { synced?: boolean; reason?: string };
        if (!r.ok || j.synced === false) setGcalMsg(`Chưa lên Google Lịch: ${j.reason ?? "lỗi không rõ"}`);
      })
      .catch((e) => setGcalMsg(`Chưa lên Google Lịch: ${(e as Error)?.message || e}`));
    return true;
  }

  async function delEvent(id: string) {
    // Gỡ trên Google TRƯỚC, và PHẢI `await`: server tra `gcal_event_id` từ chính
    // hàng này, nên xoá hàng trước thì không còn gì để tra và sự kiện nằm lại
    // trên lịch Google vĩnh viễn. Trước đây gọi rồi bỏ mặc, thắng thua tuỳ mạng.
    await fetch("/api/gcal/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "event", id, action: "delete" }),
    }).catch(() => {});
    await supabase.from("studio_events").delete().eq("id", id);
    setEvents((p) => p.filter((e) => e.id !== id));
  }

  // Upcoming reminders (next 30 days)
  const upcoming = useMemo(() => {
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    const lim = in30.toISOString().slice(0, 10);
    return events
      .filter((e) => e.remind && e.event_date >= todayStr && e.event_date <= lim)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .slice(0, 8);
  }, [events, todayStr]);

  return {
    events, contractList, eventsOn, contractsOn, upcoming,
    gcalMsg, setGcalMsg, backfilling, backfillGcal,
    busy, addNote, delEvent, setContractColor,
  };
}
