"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtDate, fmtDow, fmtDayMonth, todayVN } from "@/lib/date";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Trash2, Bell, BellOff, Camera, CalendarDays, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import MessengerButton from "@/components/MessengerButton";
import { shootReminderMessage } from "@/lib/zalo";
import { Panel, EmptyState } from "@/components/studio/ui";
import { avatarColor, initials } from "@/lib/avatar";
import { SHOOT_TYPE_LABEL, CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE, CREW_ROLE_LABEL, contractTotal, sumAmounts, vndShort, type StudioEvent, type ShootType, type ContractStatus, type CrewRole } from "@/lib/types";
import { lunarCellLabel, lunarFull } from "@/lib/lunar";

export type ContractMarker = {
  id: string;
  code: string | null;
  title: string;
  client_name: string | null;
  client_phone: string | null;
  location: string | null;
  event_date: string;
  event_time: string | null;
  status: string;
  shoot_type: ShootType;
  calendar_color: string | null;
  contract_items: { name: string; qty: number; unit_price: number }[];
  contract_crew: { id: string; name: string | null; role: string; status: string }[];
  contract_payments: { amount: number }[];
};

/** Mốc thời gian (studio_events) kèm thông tin HỢP ĐỒNG CHÍNH (nếu có). */
export type EventRow = StudioEvent & { contract?: { title: string; event_date: string | null } | null };

/** Nhãn mốc: nếu mốc thuộc hợp đồng và KHÁC ngày hợp đồng chính → ghi rõ
 *  "{Tên mốc} — [Tên hợp đồng chính]" để không nhầm mốc thuộc hợp đồng nào. */
function eventLabel(e: EventRow): string {
  const c = e.contract;
  if (c && c.event_date && c.event_date !== e.event_date) return `${e.title} — [${c.title}]`;
  return e.title;
}

const WD = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** Ê-kíp còn nhận việc (bỏ người đã từ chối) — dùng ở cả bốn chế độ xem. */
function crewOf(c: ContractMarker) {
  return (c.contract_crew || []).filter((x) => x.status !== "declined");
}

// Default marker colour + the swatch palette the user can pick from per shoot.
const DEFAULT_MARK = "#c7a76b";
const MARK_COLORS = ["#c7a76b", "#3fb98a", "#6ba3c7", "#e0746f", "#b07ad0", "#d6a44a", "#7bb38a", "#e0719e"];
const MONTHS = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function CalendarView({
  ownerId,
  initialEvents,
  contracts,
  feedUrl,
  gcal,
}: {
  ownerId: string;
  initialEvents: EventRow[];
  contracts: ContractMarker[];
  feedUrl: string;
  /** Trạng thái THẬT của kết nối Google Lịch (đã gọi thử API). */
  gcal?: { connected: boolean; ok: boolean; error: string | null };
}) {
  const [feedCopied, setFeedCopied] = useState(false);
  const [gcalMsg, setGcalMsg] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);

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
  const supabase = createClient();
  const todayStr = todayVN();
  const [y, mIdx] = todayStr.split("-").map(Number);
  const [cursor, setCursor] = useState({ year: y, month: mIdx - 1 });
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [contractList, setContractList] = useState<ContractMarker[]>(contracts);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"day" | "week" | "month" | "people">("month");
  // Ngày đang xem ở chế độ "Ngày" (mặc định hôm nay).
  const [dayAnchor, setDayAnchor] = useState(todayStr);
  const [weekAnchor, setWeekAnchor] = useState(todayStr); // any date inside the displayed week

  // Trên điện thoại, lịch tháng chật → mặc định mở chế độ Tuần (dễ đọc/chạm hơn).
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 640) setView("week");
  }, []);

  // add-note form
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [remind, setRemind] = useState(true);
  const [busy, setBusy] = useState(false);

  const grid = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const startWd = (first.getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startWd; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  // Mon–Sun days of the week containing weekAnchor.
  const weekDays = useMemo(() => {
    const [wy, wm, wd] = weekAnchor.split("-").map(Number);
    const base = new Date(wy, wm - 1, wd);
    const startWd = (base.getDay() + 6) % 7; // Mon=0
    const monday = new Date(base);
    monday.setDate(base.getDate() - startWd);
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(monday);
      dt.setDate(monday.getDate() + i);
      return ymd(dt.getFullYear(), dt.getMonth(), dt.getDate());
    });
  }, [weekAnchor]);

  function moveWeek(delta: number) {
    setSelected(null);
    const [wy, wm, wd] = weekAnchor.split("-").map(Number);
    const dt = new Date(wy, wm - 1, wd);
    dt.setDate(dt.getDate() + delta * 7);
    setWeekAnchor(ymd(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  }

  function eventsOn(dateStr: string) {
    return events.filter((e) => e.event_date === dateStr);
  }
  function contractsOn(dateStr: string) {
    return contractList.filter((c) => c.event_date === dateStr);
  }

  /**
   * Buổi chụp gần nhất SAU tuần đang xem — dùng khi tuần trống.
   *
   * Studio thường có lịch rải rác vài tháng tới, nên mở lịch tuần vào một tuần
   * trống là chuyện thường; để trắng thì màn hình không nói được gì. Ba buổi kế
   * tiếp cho biết ngay "sắp tới có gì" mà không phải bấm sang từng tuần.
   */
  const upcomingAfterWeek = useMemo(() => {
    const last = weekDays[weekDays.length - 1];
    return contractList
      .filter((c) => c.event_date && c.event_date > last)
      .sort((a, b) => (a.event_date || "").localeCompare(b.event_date || ""))
      .slice(0, 3);
  }, [contractList, weekDays]);

  /**
   * Lịch theo nhân sự (tính năng mới số 4): mỗi người MỘT HÀNG × 7 ngày của
   * tuần đang xem, kèm cột "tải tuần" đổi màu. Người nào nhận ≥4 ngày/tuần là
   * đang quá tải — đúng ngưỡng cảnh báo dồn lịch ở màn Tổng quan.
   */
  const peopleRows = useMemo(() => {
    const map = new Map<string, { key: string; name: string; role: string; days: Map<string, ContractMarker[]> }>();
    for (const c of contractList) {
      if (!weekDays.includes(c.event_date)) continue;
      for (const cr of c.contract_crew || []) {
        if (cr.status === "declined") continue;
        const name = (cr.name || "").trim() || "Chưa đặt tên";
        const role = CREW_ROLE_LABEL[cr.role as CrewRole] ?? "";
        const cur = map.get(name) ?? { key: name, name, role, days: new Map<string, ContractMarker[]>() };
        const list = cur.days.get(c.event_date) ?? [];
        list.push(c);
        cur.days.set(c.event_date, list);
        map.set(name, cur);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.days.size - a.days.size || a.name.localeCompare(b.name));
  }, [contractList, weekDays]);

  /** Buổi chụp + mốc lịch của ngày đang xem ở chế độ "Ngày". */
  const dayContracts = useMemo(
    () => contractList.filter((c) => c.event_date === dayAnchor).sort((a, b) => (a.event_time || "").localeCompare(b.event_time || "")),
    [contractList, dayAnchor]
  );

  function moveDay(delta: number) {
    const [dy, dm, dd] = dayAnchor.split("-").map(Number);
    const dt = new Date(dy, dm - 1, dd);
    dt.setDate(dt.getDate() + delta);
    setDayAnchor(ymd(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  }

  // Assign a distinct colour to a shoot so several on the same day stand apart.
  async function setContractColor(id: string, color: string) {
    setContractList((p) => p.map((c) => (c.id === id ? { ...c, calendar_color: color } : c)));
    await supabase.from("studio_contracts").update({ calendar_color: color }).eq("id", id);
  }

  function move(delta: number) {
    setSelected(null);
    setCursor((c) => {
      const m = c.month + delta;
      const year = c.year + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      return { year, month };
    });
  }

  async function addNote() {
    if (!selected || (!title.trim() && !note.trim())) return;
    setBusy(true);
    const { data } = await supabase
      .from("studio_events")
      .insert({
        owner_id: ownerId,
        title: title.trim() || "Ghi chú",
        event_date: selected,
        event_time: time.trim() || null,
        note: note.trim() || null,
        remind,
      })
      .select("*")
      .single();
    setBusy(false);
    if (data) {
      setEvents((p) => [...p, data as EventRow]);
      setTitle("");
      setTime("");
      setNote("");
      setRemind(true);
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
    }
  }

  async function delEvent(id: string) {
    // Sync deletion to Google Calendar before removing locally.
    fetch("/api/gcal/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "event", id, action: "delete" }),
    }).catch(() => {});
    await supabase.from("studio_events").delete().eq("id", id);
    setEvents((p) => p.filter((e) => e.id !== id));
  }

  const selEvents = selected ? eventsOn(selected) : [];
  const selContracts = selected ? contractsOn(selected) : [];

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

  /** Điều hướng chung cho thanh trên: ‹ / › đổi đơn vị theo chế độ đang mở. */
  function step(delta: number) {
    if (view === "day") moveDay(delta);
    else if (view === "month") move(delta);
    else moveWeek(delta);
  }
  function goToday() {
    setDayAnchor(todayStr);
    setWeekAnchor(todayStr);
    setCursor({ year: y, month: mIdx - 1 });
    setSelected(null);
  }
  const rangeLabel =
    view === "day" ? `${fmtDow(dayAnchor)} · ${fmtDate(dayAnchor)}`
      : view === "month" ? `${MONTHS[cursor.month]} ${cursor.year}`
      : `${fmtDate(weekDays[0])} – ${fmtDate(weekDays[6])}`;


  /* ── Tóm tắt khoảng đang xem ──────────────────────────────────────────────
     Nhìn lịch mà không biết "tháng này bao nhiêu buổi, còn ai chưa phân công,
     thu về bao nhiêu" thì vẫn phải bấm vào từng ô. Dải này trả lời ngay. */
  const rangeDays = useMemo(() => {
    if (view === "day") return [dayAnchor];
    if (view === "month") {
      return grid.filter((d): d is number => d !== null).map((d) => ymd(cursor.year, cursor.month, d));
    }
    return weekDays;
  }, [view, dayAnchor, grid, cursor, weekDays]);

  const summary = useMemo(() => {
    const set = new Set(rangeDays);
    const cons = contractList.filter((c) => set.has(c.event_date));
    const notes = events.filter((e) => set.has(e.event_date));
    const noCrew = cons.filter((c) => (c.contract_crew || []).filter((x) => x.status !== "declined").length === 0).length;
    const value = cons.reduce((sum, c) => sum + contractTotal(c.contract_items || []), 0);
    const due = cons.reduce(
      (sum, c) => sum + Math.max(0, contractTotal(c.contract_items || []) - sumAmounts(c.contract_payments || [])),
      0
    );
    // Ngày dồn lịch: từ 3 buổi trở lên trong một ngày (ngưỡng cảnh báo ở Tổng quan).
    const perDay = new Map<string, number>();
    for (const c of cons) perDay.set(c.event_date, (perDay.get(c.event_date) ?? 0) + 1);
    const busyDays = Array.from(perDay.values()).filter((n) => n >= 3).length;
    return { shoots: cons.length, notes: notes.length, noCrew, value, due, busyDays };
  }, [rangeDays, contractList, events]);

  const navBtn = "flex h-8 w-8 flex-none items-center justify-center rounded-[9px]";
  const navStyle = { border: "1px solid var(--bd)", background: "var(--sf)" } as const;

  return (
    <div className="page-in">
      {/* ── Thanh điều khiển: ‹ Hôm nay › · khoảng đang xem · chú giải · chế độ ──
          Một bộ điều hướng duy nhất cho cả bốn chế độ (bản thiết kế), thay vì
          mỗi chế độ tự mọc một cặp mũi tên riêng. */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <button onClick={() => step(-1)} aria-label="Lùi" className={navBtn} style={navStyle}><ChevronLeft size={17} /></button>
        <button
          onClick={goToday}
          className="flex-none rounded-[9px] px-3.5 py-[7px] text-[12.5px] font-semibold"
          style={navStyle}
        >
          Hôm nay
        </button>
        <button onClick={() => step(1)} aria-label="Tiến" className={navBtn} style={navStyle}><ChevronRight size={17} /></button>
        <h1 className="ml-1.5 text-[15px] font-bold">{rangeLabel}</h1>

        <div className="ml-auto flex flex-wrap items-center gap-3.5">
          <div className="hidden gap-3 min-[1100px]:flex">
            {[["var(--am)", "Chờ khách duyệt"], ["var(--bl)", "Khách đã duyệt"], ["var(--tl)", "Đang thực hiện"], ["var(--gn)", "Hoàn thành"]].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5 whitespace-nowrap text-[11.5px]" style={{ color: "var(--tx2)" }}>
                <span className="h-[9px] w-[9px] flex-none rounded-[3px]" style={{ background: c }} /> {l}
              </span>
            ))}
          </div>
          <div role="tablist" aria-label="Chế độ xem lịch" className="flex gap-[3px] rounded-[10px] p-[3px]" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
            {([["day", "Ngày"], ["week", "Tuần"], ["month", "Tháng"], ["people", "Nhân sự"]] as const).map(([v, label]) => {
              const on = view === v;
              return (
                <button
                  key={v}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setView(v)}
                  className="whitespace-nowrap rounded-[7px] px-[15px] py-1.5 text-[12.5px] font-semibold"
                  style={{ color: on ? "var(--ac)" : "var(--tx2)", background: on ? "var(--sf)" : "transparent", boxShadow: on ? "0 1px 3px rgba(0,0,0,.10)" : "none" }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Dải tóm tắt khoảng đang xem ───────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-[12px] px-4 py-2.5" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold">
          <Camera size={15} style={{ color: "var(--ac)" }} />
          {summary.shoots} buổi chụp
        </span>
        {summary.notes > 0 && (
          <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>
            <Bell size={14} style={{ color: "var(--bl)" }} /> {summary.notes} mốc lịch
          </span>
        )}
        {summary.noCrew > 0 && (
          <span className="flex items-center gap-1.5 whitespace-nowrap rounded-[20px] px-2.5 py-[3px] text-[11.5px] font-bold" style={{ background: "var(--amS)", color: "var(--am)" }}>
            <Users size={13} /> {summary.noCrew} buổi chưa phân công
          </span>
        )}
        {summary.busyDays > 0 && (
          <span className="flex items-center gap-1.5 whitespace-nowrap rounded-[20px] px-2.5 py-[3px] text-[11.5px] font-bold" style={{ background: "var(--rdS)", color: "var(--rd)" }}>
            <CalendarDays size={13} /> {summary.busyDays} ngày dồn ≥3 buổi
          </span>
        )}
        {summary.shoots > 0 && (
          <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ color: "var(--tx2)" }}>
            <span>Giá trị <b className="tnum" style={{ color: "var(--tx)" }}>{vndShort(summary.value)}</b></span>
            <span>Còn phải thu <b className="tnum" style={{ color: summary.due > 0 ? "var(--am)" : "var(--gn)" }}>{vndShort(summary.due)}</b></span>
          </span>
        )}
      </div>

      {/* Kết nối Google Lịch — gập lại để không đẩy lịch xuống dưới màn hình. */}
      {(gcal || feedUrl) && (
        <details className="mb-3">
          <summary
            className="flex cursor-pointer list-none items-center gap-2.5 rounded-[12px] px-4 py-2.5 text-[12.5px] font-semibold"
            style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}
          >
            <CalendarDays size={16} style={{ color: gcal?.ok ? "var(--gn)" : "var(--tx3)" }} />
            Google Lịch
            <span className="font-normal" style={{ color: gcal?.ok ? "var(--gn)" : gcal?.connected ? "var(--am)" : "var(--tx3)" }}>
              {gcal?.ok ? "đã kết nối" : gcal?.connected ? "có token nhưng gọi API lỗi" : "chưa kết nối"}
            </span>
            <ChevronDown size={16} className="ml-auto" style={{ color: "var(--tx3)" }} />
          </summary>

          <div className="mt-2 flex flex-col gap-2.5">
            {gcal && (
              <div className="rounded-[12px] px-4 py-3.5" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
                {!gcal.connected ? (
                  <p className="text-[12.5px]" style={{ color: "var(--tx2)" }}>
                    Chưa kết nối Google Lịch.{" "}
                    <a href="/dashboard/connections" className="font-semibold underline" style={{ color: "var(--ac)" }}>Kết nối ngay</a> để lịch chụp tự lên Google.
                  </p>
                ) : gcal.ok ? (
                  <p className="text-[12.5px]" style={{ color: "var(--tx2)" }}>
                    Đã kết nối và hoạt động. Chỉ hợp đồng ĐÃ XÁC NHẬN/KÝ và có ngày chụp mới được đẩy lên.
                    Lịch tạo TRƯỚC khi kết nối không tự lên — dùng nút bên dưới.
                  </p>
                ) : (
                  <div className="text-[12.5px]" style={{ color: "var(--am)" }}>
                    Có token nhưng gọi API KHÔNG được — lịch đang không lên Google.
                    <div className="mt-1 font-mono text-[11px]" style={{ color: "var(--tx3)" }}>{gcal.error}</div>
                    <a href="/dashboard/connections" className="mt-1 inline-block font-semibold underline" style={{ color: "var(--ac)" }}>Ngắt rồi kết nối lại</a>
                  </div>
                )}
                {gcal.ok && (
                  <button
                    onClick={backfillGcal}
                    disabled={backfilling}
                    className="mt-2.5 rounded-[9px] px-3 py-2 text-[12px] font-semibold"
                    style={{ border: "1px solid var(--bd)" }}
                  >
                    {backfilling ? "Đang đẩy…" : "Đồng bộ toàn bộ lịch cũ lên Google"}
                  </button>
                )}
                {gcalMsg && (
                  <p className="mt-2 rounded-[9px] px-2.5 py-1.5 font-mono text-[11px]" style={{ background: "var(--sf2)", color: "var(--am)" }}>{gcalMsg}</p>
                )}
              </div>
            )}

            {feedUrl && (
              <div className="flex flex-wrap items-center gap-3 rounded-[12px] px-4 py-3.5" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">Link đăng ký lịch (tự cập nhật)</p>
                  <p className="mt-0.5 truncate text-[12.5px]" style={{ color: "var(--tx2)" }}>{feedUrl}</p>
                  <p className="text-[11px]" style={{ color: "var(--tx3)" }}>
                    Google Calendar → Cài đặt → Thêm lịch → <b>Từ URL</b> → dán link trên.
                  </p>
                </div>
                <button
                  onClick={() => { navigator.clipboard?.writeText(feedUrl); setFeedCopied(true); setTimeout(() => setFeedCopied(false), 1500); }}
                  className="flex-none rounded-[9px] px-3 py-2 text-[12px] font-semibold"
                  style={{ border: "1px solid var(--bd)" }}
                >
                  {feedCopied ? "Đã chép" : "Chép link"}
                </button>
              </div>
            )}
          </div>
        </details>
      )}

      {view === "day" ? (
        <DayView date={dayAnchor} contracts={dayContracts} events={eventsOn(dayAnchor)} />
      ) : view === "people" ? (
        <PeopleWeek rows={peopleRows} weekDays={weekDays} todayStr={todayStr} />
      ) : view === "week" ? (
        // Hai cách xem tuần khác nhau hẳn, theo bề ngang màn hình:
        //   • Dưới 900px — lướt ngang từng ngày, mỗi ngày một tấm gần cả màn hình
        //     nên in được đủ thông tin buổi chụp. Lưới 7 cột ở khổ này mỗi ngày
        //     chỉ còn ~47px, đọc không nổi.
        //   • Từ 900px — lưới giờ như cũ (nhìn cả tuần một lần) + danh sách chi
        //     tiết bên dưới.
        <>
          <div className="min-[900px]:hidden">
            <WeekSwipe
              weekDays={weekDays}
              todayStr={todayStr}
              contractsOn={contractsOn}
              eventsOn={eventsOn}
              onColor={setContractColor}
              upcoming={upcomingAfterWeek}
            />
          </div>
          {/* Lưới giờ nay in đủ thông tin ngay trong ô ngày, nên danh sách chi
              tiết bên dưới chỉ là bản lặp — đã bỏ. */}
          <div className="hidden min-[900px]:block">
            <WeekGrid weekDays={weekDays} todayStr={todayStr} eventsOn={eventsOn} contractsOn={contractsOn} onColor={setContractColor} />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3.5">
          {/* ── Lịch tháng ────────────────────────────────────────────────
              Đầu bảng T2…CN nền phụ, ô cao tối thiểu 96px, số ngày trong
              vòng tròn, mỗi buổi/ghi chú một chip — đúng bản thiết kế. */}
          <Panel className="overflow-hidden">
            <div className="grid grid-cols-7" style={{ background: "var(--sf2)", borderBottom: "1px solid var(--bd)" }}>
              {WD.map((w) => (
                <span key={w} className="px-3 py-2.5 text-[11px] font-extrabold uppercase" style={{ letterSpacing: ".6px", color: "var(--tx3)" }}>{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grid.map((d, i) => {
                if (d === null) return <div key={i} style={{ borderRight: "1px solid var(--bd2)", borderBottom: "1px solid var(--bd2)", background: "var(--sf2)" }} />;
                const dateStr = ymd(cursor.year, cursor.month, d);
                const evs = eventsOn(dateStr);
                const cons = contractsOn(dateStr);
                const isToday = dateStr === todayStr;
                const isSel = dateStr === selected;
                return (
                  <div
                    key={i}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(dateStr)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelected(dateStr); }}
                    // 112px thay vì 96px: mỗi chip nay hai dòng (tên hợp đồng +
                    // gói), ba chip không còn vừa ô cao 96px.
                    className="min-h-[112px] cursor-pointer px-2.5 py-2"
                    style={{
                      borderRight: "1px solid var(--bd2)",
                      borderBottom: "1px solid var(--bd2)",
                      background: isSel ? "var(--acS)" : "transparent",
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-1">
                      <span
                        className="inline-flex h-[23px] min-w-[23px] items-center justify-center rounded-full px-1 text-[12.5px] font-semibold"
                        style={isToday ? { background: "var(--ac)", color: "#fff" } : { color: "var(--tx)" }}
                      >
                        {d}
                      </span>
                      <span className="text-[9px] leading-none" style={{ color: "var(--tx3)" }}>{lunarCellLabel(dateStr)}</span>
                    </div>
                    <div className="mt-1.5 flex flex-col gap-1">
                      {/* Ô ngày in TÊN HỢP ĐỒNG rồi tới gói/hạng mục — đó mới là
                          thứ phân biệt hai buổi trong cùng một ngày. Tên khách
                          vẫn còn trong tooltip và trong thẻ chi tiết. */}
                      {/* Tô theo MÀU ĐÃ CHỌN của từng hợp đồng (calendar_color),
                          không theo trạng thái: chọn màu ở thẻ chi tiết mà lịch
                          tháng vẫn một màu thì việc chọn màu vô nghĩa, và nhiều
                          buổi cùng trạng thái trong tháng nhìn y hệt nhau.
                          Trạng thái vẫn đọc được qua chấm tròn nhỏ đầu dòng —
                          đúng bốn màu ở chú giải trên đầu màn. */}
                      {cons.slice(0, 3).map((c) => {
                        const tone = CONTRACT_STATUS_TONE[(c.status as ContractStatus)] ?? CONTRACT_STATUS_TONE.draft;
                        const mc = c.calendar_color || DEFAULT_MARK;
                        const goi = c.contract_items.map((it) => `${it.name}${it.qty > 1 ? ` x${it.qty}` : ""}`).join(", ");
                        return (
                          <Link
                            key={c.id}
                            href={`/dashboard/studio/contracts/${c.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block rounded-[6px] py-[3px] pl-1.5 pr-1.5"
                            style={{
                              background: `color-mix(in srgb, ${mc} 20%, transparent)`,
                              color: mc,
                              borderLeft: `3px solid ${mc}`,
                            }}
                            title={`${c.title}${c.client_name ? ` · ${c.client_name}` : ""}${goi ? ` · ${goi}` : ""} · ${CONTRACT_STATUS_LABEL[(c.status as ContractStatus)] ?? c.status}`}
                          >
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: tone.fg }} />
                              <span className="truncate text-[11px] font-semibold">
                                {c.event_time ? `${c.event_time} ` : ""}{c.title}
                              </span>
                            </span>
                            {goi && (
                              <span className="block truncate text-[10px]" style={{ opacity: 0.8 }}>{goi}</span>
                            )}
                          </Link>
                        );
                      })}
                      {evs.slice(0, 3 - Math.min(3, cons.length)).map((e) => (
                        <span key={e.id} className="truncate rounded-[6px] px-1.5 py-[3px] text-[11px] font-semibold" style={{ background: "var(--blS)", color: "var(--bl)" }} title={eventLabel(e)}>
                          {eventLabel(e)}
                        </span>
                      ))}
                      {cons.length + evs.length > 3 && (
                        <span className="px-1 text-[10.5px] font-semibold" style={{ color: "var(--tx3)" }}>
                          +{cons.length + evs.length - 3} nữa
                        </span>
                      )}
                      {cons.length > 0 && (
                        <span className="mt-0.5 flex items-center gap-1 px-1 text-[10px] font-semibold" style={{ color: cons.some((c) => crewOf(c).length === 0) ? "var(--am)" : "var(--tx3)" }}>
                          <Users size={11} />
                          {cons.some((c) => crewOf(c).length === 0)
                            ? `${cons.filter((c) => crewOf(c).length === 0).length} buổi chưa có người`
                            : `${cons.reduce((n, c) => n + crewOf(c).length, 0)} người đi`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* ── Ngày đang chọn + nhắc lịch ────────────────────────────── */}
          <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            {selected ? (
              <Panel className="px-5 py-4">
                <h2 className="text-[14px] font-bold">{fmtDow(selected)} · {fmtDate(selected)}</h2>
                <p className="mb-3 text-[11.5px]" style={{ color: "var(--tx3)" }}>{lunarFull(selected)}</p>

                {selContracts.map((c) => (
                  <ContractDetailCard key={c.id} c={c} onColor={setContractColor} />
                ))}

                {selEvents.map((e) => (
                  <div key={e.id} className="mb-2 flex items-start justify-between gap-2 rounded-[12px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                        {e.remind ? <Bell size={13} style={{ color: "var(--bl)" }} /> : <BellOff size={13} style={{ color: "var(--tx3)" }} />}
                        {eventLabel(e)}{e.event_time ? ` · ${e.event_time}` : ""}
                      </p>
                      {e.note && <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>{e.note}</p>}
                    </div>
                    <button onClick={() => delEvent(e.id)} aria-label="Xoá ghi chú" title="Xoá" className="p-1" style={{ color: "var(--tx3)" }}><Trash2 size={14} /></button>
                  </div>
                ))}

                {/* Thêm ghi chú */}
                <div className="mt-3 space-y-2 pt-3" style={{ borderTop: "1px solid var(--bd2)" }}>
                  <input className="input" placeholder="Tiêu đề ghi chú" value={title} onChange={(e) => setTitle(e.target.value)} />
                  <div className="flex gap-2">
                    <input className="input" placeholder="Giờ (08:00)" value={time} onChange={(e) => setTime(e.target.value)} />
                    <button
                      onClick={() => setRemind((r) => !r)}
                      className="flex flex-none items-center justify-center rounded-[10px] px-3"
                      style={{ border: "1px solid var(--bd)", color: remind ? "var(--bl)" : "var(--tx3)" }}
                      title={remind ? "Có nhắc" : "Không nhắc"}
                    >
                      {remind ? <Bell size={15} /> : <BellOff size={15} />}
                    </button>
                  </div>
                  <textarea className="input min-h-[60px]" placeholder="Nội dung…" value={note} onChange={(e) => setNote(e.target.value)} />
                  <button
                    onClick={addNote}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[13px] font-bold disabled:opacity-50"
                    style={{ background: "var(--ac)", color: "#fff" }}
                  >
                    <Plus size={15} /> {busy ? "Đang thêm…" : "Thêm ghi chú"}
                  </button>
                </div>
              </Panel>
            ) : (
              <Panel>
                <EmptyState icon={CalendarDays} title="Chọn một ngày" hint="Bấm vào ô ngày trên lịch để xem buổi chụp và thêm ghi chú." />
              </Panel>
            )}

            <Panel className="px-5 py-4">
              <h2 className="mb-3 flex items-center gap-2 text-[14px] font-bold">
                <Bell size={16} style={{ color: "var(--bl)" }} /> Nhắc lịch 30 ngày tới
              </h2>
              {upcoming.length === 0 ? (
                <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Không có nhắc nào.</p>
              ) : (
                upcoming.map((e) => (
                  <div key={e.id} className="flex justify-between gap-3 py-2 text-[12.5px]" style={{ borderBottom: "1px solid var(--bd2)" }}>
                    <span className="min-w-0 truncate">{eventLabel(e)}</span>
                    <span className="flex-none" style={{ color: "var(--tx3)" }}>{fmtDate(e.event_date)}</span>
                  </div>
                ))
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Chế độ TUẦN — lưới giờ ────────────────────────────────────────────────
   Bản thiết kế: cột giờ 58px + 7 cột ngày, mỗi giờ một hàng, buổi chụp là khối
   đặt đúng vị trí theo giờ bắt đầu. Khoảng giờ hiển thị co theo dữ liệu thật
   của tuần (mặc định 6h–20h) nên không phải cuộn qua những giờ trống. */
const HOUR_H = 46;
const DEFAULT_FROM = 6;
const DEFAULT_TO = 20;
/** "08:30" → 8.5; không đọc được thì null (buổi "cả ngày"). */
function hourOf(t: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec((t || "").trim());
  if (!m) return null;
  const h = Number(m[1]) + Number(m[2]) / 60;
  return h >= 0 && h < 24 ? h : null;
}

/* ── Thẻ chi tiết một hợp đồng ──────────────────────────────────────────────
   Dùng ở hai nơi: panel "ngày đang chọn" của chế độ Tháng, và danh sách dưới
   lưới Tuần. Cùng một thẻ nên đổi màu hay bấm gửi khách ở đâu cũng như nhau. */
function ContractDetailCard({
  c, onColor,
}: {
  c: ContractMarker;
  onColor: (id: string, color: string) => void;
}) {
  const mc = c.calendar_color || DEFAULT_MARK;
  return (
    <div className="mb-2 min-w-0 rounded-[12px] px-3.5 py-3" style={{ background: "var(--sf2)", borderLeft: `3px solid ${mc}` }}>
      <Link href={`/dashboard/studio/contracts/${c.id}`} className="flex items-center gap-2.5">
        <Camera size={16} style={{ flex: "none", color: mc }} />
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">{c.title}</p>
          <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>
            {c.client_name || "—"}{c.event_time ? ` · ${c.event_time}` : ""}
          </p>
        </div>
      </Link>

      {/* Đổi màu từng hợp đồng — nhiều buổi cùng ngày thì nhìn màu là phân biệt
          được. Ẩn trên điện thoại: 8 chấm màu chiếm gần hết bề ngang một cột
          ngày, mà đổi màu là việc ngồi máy tính mới làm. */}
      <div className="mt-2 hidden flex-wrap items-center gap-1.5 min-[900px]:flex">
        <span className="text-[11px]" style={{ color: "var(--tx3)" }}>Màu:</span>
        {MARK_COLORS.map((col) => (
          <button
            key={col}
            onClick={() => onColor(c.id, col)}
            title={col}
            aria-label={`Đổi màu ${col}`}
            className="flex h-6 w-6 items-center justify-center rounded-full"
          >
            <span
              className="block h-4 w-4 rounded-full"
              style={{ background: col, border: mc.toLowerCase() === col.toLowerCase() ? "2px solid var(--tx)" : "1px solid var(--bd)" }}
            />
          </button>
        ))}
      </div>
      {/* Nhãn một dòng, giá trị dòng dưới. Trong cột ngày hẹp, để "Dịch vụ: Chụp
          ảnh" cùng dòng thì chữ tự ngắt lung tung giữa nhãn và giá trị; tách ra
          thì mỗi dòng đọc trọn một ý.
          break-words: tên hạng mục do studio tự đặt, có thể là một chuỗi dài
          không dấu cách — để mặc định thì nó đẩy thẻ rộng ra khỏi màn hình. */}
      <div className="mt-2 space-y-1.5 break-words text-[11.5px]" style={{ color: "var(--tx2)" }}>
        <div>
          <p className="text-[10.5px] uppercase" style={{ letterSpacing: ".3px", color: "var(--tx3)" }}>Dịch vụ</p>
          <p>{SHOOT_TYPE_LABEL[c.shoot_type] || c.shoot_type}</p>
        </div>
        {c.contract_items.length > 0 && (
          <div>
            <p className="text-[10.5px] uppercase" style={{ letterSpacing: ".3px", color: "var(--tx3)" }}>Hạng mục</p>
            <p>{c.contract_items.map((it) => `${it.name}${it.qty > 1 ? ` x${it.qty}` : ""}`).join(", ")}</p>
          </div>
        )}
        <div>
          <p className="text-[10.5px] uppercase" style={{ letterSpacing: ".3px", color: "var(--tx3)" }}>Nhân sự</p>
          <p>{c.contract_crew.length} người</p>
        </div>
        {c.location && (
          <div>
            <p className="text-[10.5px] uppercase" style={{ letterSpacing: ".3px", color: "var(--tx3)" }}>Địa điểm</p>
            <p>{c.location}</p>
          </div>
        )}
      </div>
      {c.client_phone && (
        <div className="mt-2">
          <MessengerButton
            label="Gửi cho khách"
            message={shootReminderMessage({
              name: c.client_name,
              title: c.title,
              date: c.event_date,
              time: c.event_time,
              location: c.location,
            })}
          />
        </div>
      )}
    </div>
  );
}

/* ── Lịch tuần trên điện thoại: lướt ngang từng NGÀY ────────────────────────
   Lưới 7 cột × 24 giờ là cách xem của màn hình rộng. Nhét nó vào 390px thì mỗi
   ngày còn ~47px: không đọc được tên khách, không thấy dịch vụ, và phần lớn ô
   trống trơn — nhìn nhiều mà không biết gì.

   Ở đây mỗi ngày là một tấm chiếm gần cả bề ngang màn hình, lướt ngang để sang
   ngày khác (có scroll-snap nên dừng đúng từng tấm). Nhờ đó mỗi buổi chụp có đủ
   chỗ in màu, dịch vụ, hạng mục, nhân sự, địa điểm và nút gửi khách — cùng một
   thẻ với chế độ Tháng. Tuần trống thì tấm cuối chỉ ra buổi gần nhất sắp tới. */
function WeekSwipe({
  weekDays, todayStr, contractsOn, eventsOn, onColor, upcoming,
}: {
  weekDays: string[];
  todayStr: string;
  contractsOn: (d: string) => ContractMarker[];
  eventsOn: (d: string) => EventRow[];
  onColor: (id: string, color: string) => void;
  upcoming: ContractMarker[];
}) {
  const soBuoi = weekDays.reduce((n, d) => n + contractsOn(d).length, 0);

  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>
        {soBuoi > 0 ? `${soBuoi} buổi chụp trong tuần` : "Tuần này chưa có buổi chụp"} · lướt ngang để xem từng ngày
      </p>
      <div className="hscroll snap-x snap-mandatory gap-3 pb-1">
        {weekDays.map((d, i) => {
          const cons = contractsOn(d);
          const evs = eventsOn(d);
          const isToday = d === todayStr;
          return (
            <div key={d} className="w-[36%] min-w-[128px] max-w-[300px] snap-start">
              <Panel className="min-w-0 px-4 py-3.5" >
                <div className="flex items-baseline gap-2">
                  <h2 className="text-[14px] font-bold">{WD[i]} · {fmtDate(d)}</h2>
                  {isToday && (
                    <span className="rounded-[20px] px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>hôm nay</span>
                  )}
                  <span className="ml-auto text-[11px]" style={{ color: "var(--tx3)" }}>
                    {cons.length > 0 ? `${cons.length} buổi` : "trống"}
                  </span>
                </div>
                <p className="mb-3 text-[11.5px]" style={{ color: "var(--tx3)" }}>{lunarFull(d)}</p>

                {cons.map((c) => (
                  <ContractDetailCard key={c.id} c={c} onColor={onColor} />
                ))}

                {evs.map((e) => (
                  <div key={e.id} className="mb-2 flex items-start gap-2 rounded-[12px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
                    {e.remind ? <Bell size={13} style={{ flex: "none", marginTop: 3, color: "var(--bl)" }} /> : <BellOff size={13} style={{ flex: "none", marginTop: 3, color: "var(--tx3)" }} />}
                    <div className="min-w-0">
                      <p className="break-words text-[13px] font-semibold">{eventLabel(e)}{e.event_time ? ` · ${e.event_time}` : ""}</p>
                      {e.note && <p className="break-words text-[11.5px]" style={{ color: "var(--tx3)" }}>{e.note}</p>}
                    </div>
                  </div>
                ))}

                {cons.length === 0 && evs.length === 0 && (
                  <p className="py-6 text-center text-[12px]" style={{ color: "var(--tx3)" }}>
                    Ngày trống — nhận thêm job được.
                  </p>
                )}
              </Panel>
            </div>
          );
        })}

        {soBuoi === 0 && upcoming.length > 0 && (
          <div className="w-[36%] min-w-[128px] max-w-[300px] snap-start">
            <Panel className="min-w-0 px-4 py-3.5">
              <h2 className="mb-1 text-[14px] font-bold">Buổi chụp sắp tới</h2>
              <p className="mb-3 text-[11.5px]" style={{ color: "var(--tx3)" }}>Không nằm trong tuần này.</p>
              {upcoming.map((c) => (
                <div key={c.id}>
                  <p className="mb-1 text-[11.5px] font-semibold" style={{ color: "var(--tx2)" }}>
                    {fmtDow(c.event_date)} · {fmtDate(c.event_date)}
                  </p>
                  <ContractDetailCard c={c} onColor={onColor} />
                </div>
              ))}
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

function WeekGrid({
  weekDays, todayStr, eventsOn, contractsOn, onColor,
}: {
  weekDays: string[];
  todayStr: string;
  eventsOn: (d: string) => EventRow[];
  contractsOn: (d: string) => ContractMarker[];
  onColor: (id: string, color: string) => void;
}) {
  const timed = weekDays.flatMap((d) => [
    ...contractsOn(d).map((c) => hourOf(c.event_time)),
    ...eventsOn(d).map((e) => hourOf(e.event_time)),
  ]).filter((h): h is number => h !== null);

  const from = Math.max(0, Math.min(DEFAULT_FROM, ...timed.map((h) => Math.floor(h))));
  // +2 giờ đuôi để khối cuối cùng không bị cắt mất nửa dưới.
  const to = Math.min(24, Math.max(DEFAULT_TO, ...timed.map((h) => Math.ceil(h) + 2)));
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const COLS = "58px repeat(7, minmax(0,1fr))";

  return (
    <Panel className="overflow-hidden">
      {/* Đầu bảng: thứ + số ngày, hôm nay tô tròn màu nhấn */}
      <div className="grid" style={{ gridTemplateColumns: COLS, borderBottom: "1px solid var(--bd)" }}>
        <div />
        {weekDays.map((d, i) => {
          const isToday = d === todayStr;
          return (
            <div key={d} className="py-2 text-center" style={{ borderLeft: "1px solid var(--bd2)", background: isToday ? "var(--acS)" : "transparent" }}>
              <p className="text-[11px] font-bold" style={{ letterSpacing: ".5px", color: "var(--tx3)" }}>{WD[i]}</p>
              <p
                className="mx-auto mt-[3px] flex h-[26px] w-[26px] items-center justify-center rounded-full text-[13.5px] font-bold"
                style={isToday ? { background: "var(--ac)", color: "#fff" } : undefined}
              >
                {d.slice(8)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Hàng "cả ngày": buổi/ghi chú không có giờ — không đặt được vào lưới. */}
      {weekDays.some((d) => contractsOn(d).some((c) => hourOf(c.event_time) === null) || eventsOn(d).some((e) => hourOf(e.event_time) === null)) && (
        <div className="grid" style={{ gridTemplateColumns: COLS, borderBottom: "1px solid var(--bd)" }}>
          <span className="px-2 py-2 text-right text-[10.5px]" style={{ color: "var(--tx3)" }}>cả ngày</span>
          {weekDays.map((d) => (
            <div key={d} className="flex flex-col gap-1 p-1" style={{ borderLeft: "1px solid var(--bd2)" }}>
              {/* Buổi chụp CHƯA ĐẶT GIỜ rơi xuống hàng này vì không xếp được vào
                  lưới. Nó cũng phải in đủ thông tin như buổi có giờ — trước đây
                  chỉ có tên khách, nên hợp đồng chưa điền giờ trông như không có
                  chi tiết gì. */}
              {contractsOn(d).filter((c) => hourOf(c.event_time) === null).map((c) => (
                <ContractDetailCard key={c.id} c={c} onColor={onColor} />
              ))}
              {eventsOn(d).filter((e) => hourOf(e.event_time) === null).map((e) => (
                <span key={e.id} className="truncate rounded-[7px] px-1.5 py-1 text-[11px] font-semibold" style={{ background: "var(--blS)", color: "var(--bl)", borderLeft: "3px solid var(--bl)" }} title={eventLabel(e)}>
                  {eventLabel(e)}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Lưới giờ */}
      <div className="grid max-h-[620px] overflow-y-auto" style={{ gridTemplateColumns: COLS }}>
        <div>
          {hours.map((h) => (
            <div key={h} className="px-2 pt-[3px] text-right" style={{ height: HOUR_H, borderBottom: "1px solid var(--bd2)" }}>
              <span className="tnum text-[10.5px]" style={{ color: "var(--tx3)" }}>{String(h).padStart(2, "0")}:00</span>
            </div>
          ))}
        </div>
        {weekDays.map((d) => {
          const isToday = d === todayStr;
          const cons = contractsOn(d).filter((c) => hourOf(c.event_time) !== null);
          const evs = eventsOn(d).filter((e) => hourOf(e.event_time) !== null);
          return (
            <div key={d} className="relative" style={{ borderLeft: "1px solid var(--bd2)", background: isToday ? "color-mix(in srgb, var(--acS) 55%, transparent)" : "transparent", height: hours.length * HOUR_H }}>
              {hours.map((h) => (
                <div key={h} style={{ height: HOUR_H, borderBottom: "1px solid var(--bd2)" }} />
              ))}
              {/* Khối buổi chụp in ĐỦ thông tin ngay trong ô ngày — cùng thẻ với
                  chế độ Tháng và chế độ Ngày: màu đổi được, dịch vụ, hạng mục,
                  nhân sự, địa điểm, nút gửi khách. Trước đây khối chỉ có tên
                  khách nên muốn biết gì cũng phải bấm vào từng buổi.
                  Không đặt height cứng nữa: thẻ cao theo nội dung, đặt đúng vị
                  trí giờ bắt đầu. */}
              {cons.map((c) => {
                const h = hourOf(c.event_time)!;
                const top = (h - from) * HOUR_H;
                return (
                  <div key={c.id} className="absolute" style={{ left: 3, right: 3, top }}>
                    <ContractDetailCard c={c} onColor={onColor} />
                  </div>
                );
              })}
              {evs.map((e) => {
                const h = hourOf(e.event_time)!;
                return (
                  <div
                    key={e.id}
                    className="absolute overflow-hidden rounded-[7px] px-[7px] py-[5px]"
                    style={{ left: 3, right: 3, top: (h - from) * HOUR_H, height: HOUR_H - 4, background: "var(--blS)", borderLeft: "3px solid var(--bl)" }}
                    title={eventLabel(e)}
                  >
                    <p className="truncate text-[11.5px] font-semibold leading-tight" style={{ color: "var(--bl)" }}>{eventLabel(e)}</p>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ── Chế độ NGÀY ───────────────────────────────────────────────────────────
   Danh sách buổi chụp trong một ngày: giờ bắt đầu to, tên job, khách, địa
   điểm và ê-kíp. Đây cũng là màn hay mở nhất trên điện thoại. */
function DayView({
  date, contracts, events,
}: {
  date: string;
  contracts: ContractMarker[];
  events: EventRow[];
}) {
  return (
    <div className="flex max-w-[840px] flex-col gap-2.5">
      {contracts.length === 0 && events.length === 0 ? (
        <Panel><EmptyState icon={CalendarDays} title="Ngày này chưa có lịch" hint="Không có buổi chụp hay mốc lịch nào — ngày trống để nhận job mới." /></Panel>
      ) : (
        <>
          {contracts.map((c) => {
            const crew = (c.contract_crew || []).filter((x) => x.status !== "declined");
            const tone = CONTRACT_STATUS_TONE[(c.status as ContractStatus)] ?? CONTRACT_STATUS_TONE.draft;
            return (
              // Vạch bên trái theo MÀU ĐÃ CHỌN của hợp đồng, giống lịch tháng và
              // lịch tuần. Trạng thái đã có pill chữ ở lề phải nên không mất gì.
              <Link key={c.id} href={`/dashboard/studio/contracts/${c.id}`} className="flex gap-3.5 rounded-[14px] px-[17px] py-[15px]" style={{ background: "var(--sf)", border: "1px solid var(--bd)", borderLeft: `3px solid ${c.calendar_color || DEFAULT_MARK}` }}>
                <div className="flex-none pr-3.5 text-center" style={{ borderRight: "1px solid var(--bd2)" }}>
                  <p className="tnum text-[15px] font-bold">{c.event_time || "--:--"}</p>
                  <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>{SHOOT_TYPE_LABEL[c.shoot_type]}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="truncate text-[14.5px] font-bold">{c.title}</p>
                    {c.code && (
                      <span className="flex-none text-[11px] font-bold" style={{ color: "var(--tx3)", fontFamily: "ui-monospace, monospace" }}>{c.code}</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[12px]" style={{ color: "var(--tx3)" }}>
                    {[c.client_name, c.client_phone, c.location].filter(Boolean).join(" · ") || "Chưa có thông tin khách"}
                  </p>
                  {c.contract_items.length > 0 && (
                    <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--tx2)" }}>
                      {c.contract_items.map((it) => `${it.name}${it.qty > 1 ? ` ×${it.qty}` : ""}`).join(" · ")}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex">
                      {crew.map((p) => (
                        <span key={p.id} title={p.name || ""} className="-ml-1.5 flex h-[25px] w-[25px] items-center justify-center rounded-full text-[9.5px] font-bold text-white first:ml-0" style={{ background: avatarColor(p.name), border: "2px solid var(--sf)" }}>
                          {initials(p.name)}
                        </span>
                      ))}
                    </div>
                    {crew.length === 0 && (
                      <span className="rounded-[20px] px-[9px] py-1 text-[11px] font-semibold" style={{ border: "1px dashed var(--am)", color: "var(--am)", background: "var(--amS)" }}>
                        Chưa phân công
                      </span>
                    )}
                    {(() => {
                      const total = contractTotal(c.contract_items || []);
                      const left = Math.max(0, total - sumAmounts(c.contract_payments || []));
                      if (total <= 0) return null;
                      return (
                        <span className="tnum ml-auto whitespace-nowrap text-[11.5px]" style={{ color: "var(--tx3)" }}>
                          {vndShort(total)}
                          {left > 0 ? <> · còn <b style={{ color: "var(--am)" }}>{vndShort(left)}</b></> : <> · <b style={{ color: "var(--gn)" }}>đã thu đủ</b></>}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <span className="flex-none self-start whitespace-nowrap rounded-[20px] px-[11px] py-[5px] text-[11.5px] font-semibold" style={{ background: tone.bg, color: tone.fg }}>
                  {CONTRACT_STATUS_LABEL[(c.status as ContractStatus)] ?? c.status}
                </span>
              </Link>
            );
          })}
          {events.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-[14px] px-[17px] py-3.5" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
              <Bell size={16} style={{ flex: "none", color: "var(--bl)" }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold">{eventLabel(e)}</p>
                {e.note && <p className="mt-px truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>{e.note}</p>}
              </div>
              {e.event_time && <span className="tnum flex-none text-[12px]" style={{ color: "var(--tx3)" }}>{e.event_time}</span>}
            </div>
          ))}
          <p className="px-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>{fmtDow(date)} · {fmtDate(date)}</p>
        </>
      )}
    </div>
  );
}

/* ── Chế độ NHÂN SỰ (tính năng mới số 4) ───────────────────────────────────
   Mỗi người một hàng × 7 ngày; cột cuối là tải tuần đổi màu. Dưới 1100px ẩn
   dòng tên job trong ô, chỉ còn giờ — đúng ngưỡng responsive của bản thiết kế. */
function PeopleWeek({
  rows, weekDays, todayStr,
}: {
  rows: { key: string; name: string; role: string; days: Map<string, ContractMarker[]> }[];
  weekDays: string[];
  todayStr: string;
}) {
  const COLS = "minmax(140px,1.2fr) repeat(7, minmax(72px,1fr)) minmax(96px,.9fr)";
  return (
    <Panel className="overflow-x-auto">
      <div className="grid gap-2 px-4 py-2.5" style={{ gridTemplateColumns: COLS, minWidth: 860, background: "var(--sf2)", borderBottom: "1px solid var(--bd)" }}>
        <span className="text-[10.5px] font-extrabold uppercase" style={{ letterSpacing: ".7px", color: "var(--tx3)" }}>Nhân sự</span>
        {weekDays.map((d) => (
          <span key={d} className="text-center text-[10.5px] font-extrabold uppercase" style={{ letterSpacing: ".5px", color: d === todayStr ? "var(--ac)" : "var(--tx3)" }}>
            {fmtDow(d)} {fmtDayMonth(d)}
          </span>
        ))}
        <span className="text-right text-[10.5px] font-extrabold uppercase" style={{ letterSpacing: ".7px", color: "var(--tx3)" }}>Tải tuần</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title="Tuần này chưa phân công ai" hint="Phân công nhân sự trong hợp đồng để thấy lịch của từng người ở đây." />
      ) : (
        rows.map((r) => {
          const load = r.days.size;
          const tone = load >= 4 ? { fg: "var(--rd)", bg: "var(--rdS)" } : load >= 3 ? { fg: "var(--am)", bg: "var(--amS)" } : { fg: "var(--gn)", bg: "var(--gnS)" };
          return (
            <div key={r.key} className="grid items-center gap-2 px-4 py-2.5" style={{ gridTemplateColumns: COLS, minWidth: 860, borderBottom: "1px solid var(--bd2)" }}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: avatarColor(r.name) }}>
                  {initials(r.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">{r.name}</span>
                  {r.role && <span className="block truncate text-[10.5px]" style={{ color: "var(--tx3)" }}>{r.role}</span>}
                </span>
              </div>
              {weekDays.map((d) => {
                const jobs = r.days.get(d) ?? [];
                return (
                  <div key={d} className="flex min-h-[40px] flex-col justify-center rounded-[7px] px-1.5 py-1" style={{ background: jobs.length ? "var(--acS)" : "transparent", border: jobs.length ? "1px solid var(--acM)" : `1px dashed ${d === todayStr ? "var(--acM)" : "var(--bd2)"}` }}>
                    {jobs.length === 0 ? (
                      <span className="text-center text-[10px]" style={{ color: "var(--tx3)" }}>trống</span>
                    ) : (
                      jobs.map((j) => (
                        <Link key={j.id} href={`/dashboard/studio/contracts/${j.id}`} className="block" title={`${j.title}${j.location ? ` · ${j.location}` : ""}`}>
                          <span className="tnum block text-center text-[10px] font-bold" style={{ color: "var(--ac)" }}>{j.event_time || "cả ngày"}</span>
                          <span className="hidden truncate text-center text-[10px] min-[1100px]:block" style={{ color: "var(--tx2)" }}>{j.title}</span>
                          {j.location && (
                            <span className="hidden truncate text-center text-[9.5px] min-[1280px]:block" style={{ color: "var(--tx3)" }}>{j.location}</span>
                          )}
                        </Link>
                      ))
                    )}
                  </div>
                );
              })}
              <div className="flex flex-col items-end gap-1">
                <span className="whitespace-nowrap text-[11px] font-bold" style={{ color: tone.fg }}>{load}/7 ngày</span>
                <div className="h-1 w-full overflow-hidden rounded-[3px]" style={{ background: "var(--bd2)" }}>
                  <div className="h-full rounded-[3px]" style={{ width: `${(load / 7) * 100}%`, background: tone.fg }} />
                </div>
              </div>
            </div>
          );
        })
      )}
    </Panel>
  );
}
