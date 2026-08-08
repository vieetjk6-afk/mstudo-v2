"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtDate, fmtDow, fmtDayMonth, todayVN } from "@/lib/date";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Trash2, Bell, BellOff, Camera, CalendarDays, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import MessengerButton from "@/components/MessengerButton";
import { shootReminderMessage } from "@/lib/zalo";
import { Panel, EmptyState } from "@/components/studio/ui";
import { avatarColor, initials } from "@/lib/avatar";
import { SHOOT_TYPE_LABEL, CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE, type StudioEvent, type ShootType, type ContractStatus } from "@/lib/types";
import { lunarCellLabel, lunarFull } from "@/lib/lunar";

export type ContractMarker = {
  id: string;
  title: string;
  client_name: string | null;
  client_phone: string | null;
  location: string | null;
  event_date: string;
  event_time: string | null;
  status: string;
  shoot_type: ShootType;
  calendar_color: string | null;
  contract_items: { name: string; qty: number }[];
  contract_crew: { id: string; name: string | null; role: string; status: string }[];
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

  // Trên điện thoại mở thẳng chế độ NGÀY: bản mobile của thiết kế là dải ngày
  // cuộn ngang + danh sách thẻ, chứ không phải lưới tuần (lưới tuần ở khổ hẹp
  // vẫn là 7 cột bé xíu, chạm rất khó).
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 640) setView("day");
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
   * Lịch theo nhân sự (tính năng mới số 4): mỗi người MỘT HÀNG × 7 ngày của
   * tuần đang xem, kèm cột "tải tuần" đổi màu. Người nào nhận ≥4 ngày/tuần là
   * đang quá tải — đúng ngưỡng cảnh báo dồn lịch ở màn Tổng quan.
   */
  const peopleRows = useMemo(() => {
    const map = new Map<string, { key: string; name: string; days: Map<string, ContractMarker[]> }>();
    for (const c of contractList) {
      if (!weekDays.includes(c.event_date)) continue;
      for (const cr of c.contract_crew || []) {
        if (cr.status === "declined") continue;
        const name = (cr.name || "").trim() || "Chưa đặt tên";
        const cur = map.get(name) ?? { key: name, name, days: new Map<string, ContractMarker[]>() };
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

  /** Dải ngày quanh ngày đang xem: lùi 3, tiến 10 — đủ để lướt một tuần rưỡi. */
  const dayStrip = useMemo(() => {
    const [ay, am, ad] = dayAnchor.split("-").map(Number);
    const out: { date: string; dow: string; num: string; jobs: number; today: boolean }[] = [];
    for (let i = -3; i <= 10; i++) {
      const dt = new Date(ay, am - 1, ad + i);
      const iso = ymd(dt.getFullYear(), dt.getMonth(), dt.getDate());
      out.push({
        date: iso,
        dow: fmtDow(iso),
        num: String(dt.getDate()).padStart(2, "0"),
        jobs: contractList.filter((c) => c.event_date === iso).length,
        today: iso === todayStr,
      });
    }
    return out;
  }, [dayAnchor, contractList, todayStr]);

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

  return (
    <div className="page-in flex flex-col">
      {/* ── Thanh điều khiển: hôm nay · dải ngày · 4 chế độ xem ─────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <button
          onClick={() => { setDayAnchor(todayStr); setWeekAnchor(todayStr); setCursor({ year: y, month: mIdx - 1 }); }}
          className="flex-none rounded-[9px] px-3.5 py-[7px] text-[12.5px] font-semibold"
          style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
        >
          Hôm nay
        </button>
        <h1 className="text-[15px] font-bold">
          {view === "day" ? fmtDate(dayAnchor) : view === "month" ? `Tháng ${cursor.month + 1}/${cursor.year}` : `Tuần ${fmtDate(weekDays[0])} – ${fmtDate(weekDays[6])}`}
        </h1>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <div className="hidden gap-3 min-[900px]:flex">
            {[["var(--am)", "Chờ khách duyệt"], ["var(--bl)", "Khách đã duyệt"], ["var(--tl)", "Đang thực hiện"], ["var(--gn)", "Hoàn thành"]].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--tx2)" }}>
                <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: c }} /> {l}
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

      {/* Trạng thái Google Lịch: nói rõ đang nối được hay không, và lỗi gì.
          Trước đây mọi lượt đồng bộ đều fire-and-forget nên hỏng cũng im. */}
      {gcal && (
        <div className="card mb-4 p-4">
          {!gcal.connected ? (
            <p className="text-[13px]" style={{ color: "var(--text2)" }}>
              Chưa kết nối Google Lịch.{" "}
              <a href="/dashboard/connections" style={{ color: "var(--gold)" }}>Kết nối ngay</a> để lịch chụp tự lên Google.
            </p>
          ) : gcal.ok ? (
            <p className="text-[13px]" style={{ color: "var(--s-green)" }}>
              Google Lịch: đã kết nối và hoạt động. Chỉ hợp đồng ĐÃ XÁC NHẬN/KÝ và có ngày chụp mới được đẩy lên.
              Lịch tạo TRƯỚC khi kết nối không tự lên — dùng nút bên dưới.
            </p>
          ) : (
            <div className="text-[13px]" style={{ color: "var(--s-amber)" }}>
              Google Lịch: có token nhưng gọi API KHÔNG được — lịch đang không lên Google.
              <div className="mt-1 font-mono text-[11px]" style={{ color: "var(--text3)" }}>{gcal.error}</div>
              <a href="/dashboard/connections" className="mt-1 inline-block" style={{ color: "var(--gold)" }}>Ngắt rồi kết nối lại</a>
            </div>
          )}
          {gcal.ok && (
            <button onClick={backfillGcal} disabled={backfilling} className="btn-ghost mt-2 px-3 py-1.5 text-xs">
              {backfilling ? "Đang đẩy…" : "Đồng bộ toàn bộ lịch cũ lên Google"}
            </button>
          )}
          {gcalMsg && (
            <p className="mt-2 rounded-lg px-2.5 py-1.5 font-mono text-[11px]" style={{ background: "var(--surface2)", color: "var(--s-amber)" }}>{gcalMsg}</p>
          )}
        </div>
      )}

      {/* Đồng bộ Google là việc cài MỘT LẦN. Trên điện thoại nó chiếm nguyên
          đầu màn, đẩy lịch — thứ người ta mở app để xem — xuống dưới nếp gấp;
          nên đẩy xuống cuối ở khổ hẹp, giữ nguyên vị trí từ lg trở lên. */}
      {feedUrl && (
        <div className="card order-last mb-6 mt-6 flex flex-wrap items-center gap-3 p-4 lg:order-none lg:mt-0">
          <CalendarDays size={16} style={{ color: "var(--text3)" }} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text3)" }}>
              Đồng bộ Google Calendar (link đăng ký — tự cập nhật buổi chụp &amp; mốc lịch)
            </p>
            <p className="truncate text-sm" style={{ color: "var(--text2)" }}>{feedUrl}</p>
            <p className="text-[11px]" style={{ color: "var(--text3)" }}>
              Google Calendar → Cài đặt → Thêm lịch → <b>Từ URL</b> → dán link trên.
            </p>
          </div>
          <button
            onClick={() => { navigator.clipboard?.writeText(feedUrl); setFeedCopied(true); setTimeout(() => setFeedCopied(false), 1500); }}
            className="btn-ghost px-3 py-2 text-xs"
          >
            {feedCopied ? "Đã chép" : "Chép link"}
          </button>
        </div>
      )}

      {view === "day" ? (
        <DayView
          date={dayAnchor}
          contracts={dayContracts}
          events={eventsOn(dayAnchor)}
          onMove={moveDay}
          strip={dayStrip}
          onPick={setDayAnchor}
        />
      ) : view === "people" ? (
        <PeopleWeek rows={peopleRows} weekDays={weekDays} todayStr={todayStr} onMove={moveWeek} />
      ) : view === "week" ? (
        <WeekView
          weekDays={weekDays}
          todayStr={todayStr}
          eventsOn={eventsOn}
          contractsOn={contractsOn}
          moveWeek={moveWeek}
          onDelEvent={delEvent}
        />
      ) : (
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-lg font-medium">
              {MONTHS[cursor.month]} {cursor.year}
            </h2>
            <div className="flex gap-2">
              <button onClick={() => move(-1)} aria-label="Tháng trước" className="btn-ghost p-2"><ChevronLeft size={16} /></button>
              <button onClick={() => move(1)} aria-label="Tháng sau" className="btn-ghost p-2"><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {WD.map((w) => (
              <div key={w} className="py-1 text-center text-[11px] font-medium" style={{ color: "var(--text3)" }}>{w}</div>
            ))}
            {grid.map((d, i) => {
              if (d === null) return <div key={i} />;
              const dateStr = ymd(cursor.year, cursor.month, d);
              const evs = eventsOn(dateStr);
              const cons = contractsOn(dateStr);
              const isToday = dateStr === todayStr;
              const isSel = dateStr === selected;
              const has = evs.length + cons.length > 0;
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(dateStr)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelected(dateStr); }}
                  className="flex min-h-[72px] cursor-pointer flex-col items-stretch rounded-lg p-1.5 text-sm transition-colors"
                  style={{
                    background: isSel ? "var(--surface2)" : "transparent",
                    border: isToday ? "1px solid var(--border2)" : "1px solid transparent",
                  }}
                >
                  <div className="flex items-baseline justify-between gap-1">
                    <span style={{ color: isToday ? "var(--accent)" : "var(--text)" }}>{d}</span>
                    <span className="text-[9px] leading-none" style={{ color: "var(--text3)" }}>{lunarCellLabel(dateStr)}</span>
                  </div>
                  <div className="mt-1 flex flex-col gap-0.5 text-left">
                    {cons.map((c) => {
                      const mc = c.calendar_color || DEFAULT_MARK;
                      return (
                        <Link
                          key={c.id}
                          href={`/dashboard/studio/contracts/${c.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block truncate rounded px-1 py-0.5 text-[9px] leading-tight"
                          style={{ background: `color-mix(in srgb,${mc} 22%,transparent)`, borderLeft: `2px solid ${mc}`, color: "var(--text2)" }}
                          title={`Mở hợp đồng: ${c.title}`}
                        >
                          {c.event_time ? `${c.event_time} ` : ""}{c.client_name || c.title}
                        </Link>
                      );
                    })}
                    {evs.map((e) => (
                      <span key={e.id} className="truncate rounded px-1 py-0.5 text-[9px] leading-tight" style={{ background: "color-mix(in srgb,var(--s-blue) 18%,transparent)", color: "var(--text2)" }} title={eventLabel(e)}>
                        {eventLabel(e)}
                      </span>
                    ))}
                  </div>
                  {has && <span className="sr-only">có lịch</span>}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-4 text-[11px]" style={{ color: "var(--text3)" }}>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: DEFAULT_MARK }} /> Hợp đồng</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--s-blue)" }} /> Ghi chú</span>
            <span style={{ color: "var(--text3)" }}>· Chọn ngày để đổi màu từng hợp đồng</span>
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-6">
          {selected ? (
            <div className="card p-5">
              <h2 className="font-serif text-lg font-medium">{fmtDate(selected)}</h2>
              <p className="mb-3 text-xs" style={{ color: "var(--text3)" }}>{lunarFull(selected)}</p>

              {selContracts.map((c) => {
                const mc = c.calendar_color || DEFAULT_MARK;
                return (
                <div key={c.id} className="mb-2 rounded-xl px-3 py-2.5" style={{ background: "var(--surface2)", borderLeft: `3px solid ${mc}` }}>
                  <Link href={`/dashboard/studio/contracts/${c.id}`} className="flex items-center gap-2">
                    <Camera size={15} style={{ color: mc }} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="text-[11px]" style={{ color: "var(--text3)" }}>
                        {c.client_name || "—"}{c.event_time ? ` · ${c.event_time}` : ""}
                      </p>
                    </div>
                  </Link>

                  {/* Per-contract colour picker — tell apart multiple shoots on the same day */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px]" style={{ color: "var(--text3)" }}>Màu:</span>
                    {MARK_COLORS.map((col) => (
                      <button
                        key={col}
                        onClick={() => setContractColor(c.id, col)}
                        title={col}
                        aria-label={`Đổi màu ${col}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110"
                      >
                        <span
                          className="block h-4 w-4 rounded-full"
                          style={{ background: col, border: mc.toLowerCase() === col.toLowerCase() ? "2px solid var(--text)" : "1px solid var(--border)" }}
                        />
                      </button>
                    ))}
                  </div>
                  <dl className="mt-2 space-y-0.5 text-[11px]" style={{ color: "var(--text2)" }}>
                    <div><span style={{ color: "var(--text3)" }}>Dịch vụ: </span>{SHOOT_TYPE_LABEL[c.shoot_type] || c.shoot_type}</div>
                    {c.contract_items.length > 0 && (
                      <div><span style={{ color: "var(--text3)" }}>Hạng mục: </span>{c.contract_items.map((it) => `${it.name}${it.qty > 1 ? ` x${it.qty}` : ""}`).join(", ")}</div>
                    )}
                    <div><span style={{ color: "var(--text3)" }}>Nhân sự: </span>{c.contract_crew.length} người</div>
                    {c.location && <div><span style={{ color: "var(--text3)" }}>Địa điểm: </span>{c.location}</div>}
                  </dl>
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
              })}

              {selEvents.map((e) => (
                <div key={e.id} className="mb-2 flex items-start justify-between gap-2 rounded-xl px-3 py-2.5" style={{ background: "var(--surface2)" }}>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      {e.remind ? <Bell size={12} style={{ color: "var(--s-blue)" }} /> : <BellOff size={12} style={{ color: "var(--text3)" }} />}
                      {eventLabel(e)}{e.event_time ? ` · ${e.event_time}` : ""}
                    </p>
                    {e.note && <p className="text-[11px]" style={{ color: "var(--text3)" }}>{e.note}</p>}
                  </div>
                  <button onClick={() => delEvent(e.id)} aria-label="Xoá ghi chú" title="Xoá" className="p-1" style={{ color: "var(--text3)" }}><Trash2 size={14} /></button>
                </div>
              ))}

              {/* Add note */}
              <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                <input className="input" placeholder="Tiêu đề ghi chú" value={title} onChange={(e) => setTitle(e.target.value)} />
                <div className="flex gap-2">
                  <input className="input" placeholder="Giờ (08:00)" value={time} onChange={(e) => setTime(e.target.value)} />
                  <button
                    onClick={() => setRemind((r) => !r)}
                    className="btn-ghost shrink-0 px-3"
                    title={remind ? "Có nhắc" : "Không nhắc"}
                  >
                    {remind ? <Bell size={15} /> : <BellOff size={15} />}
                  </button>
                </div>
                <textarea className="input min-h-[60px]" placeholder="Nội dung…" value={note} onChange={(e) => setNote(e.target.value)} />
                <button onClick={addNote} disabled={busy} className="btn-primary w-full">
                  <Plus size={15} /> {busy ? "Đang thêm…" : "Thêm ghi chú"}
                </button>
              </div>
            </div>
          ) : (
            <div className="card p-5 text-sm" style={{ color: "var(--text3)" }}>
              Chọn một ngày để xem lịch &amp; thêm ghi chú.
            </div>
          )}

          {/* Reminders */}
          <div className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-medium">
              <Bell size={16} style={{ color: "var(--s-blue)" }} /> Nhắc lịch 30 ngày tới
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text3)" }}>Không có nhắc nào.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((e) => (
                  <li key={e.id} className="flex justify-between text-sm">
                    <span>{eventLabel(e)}</span>
                    <span style={{ color: "var(--text3)" }}>{fmtDate(e.event_date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

function WeekView({
  weekDays,
  todayStr,
  eventsOn,
  contractsOn,
  moveWeek,
  onDelEvent,
}: {
  weekDays: string[];
  todayStr: string;
  eventsOn: (d: string) => StudioEvent[];
  contractsOn: (d: string) => ContractMarker[];
  moveWeek: (delta: number) => void;
  onDelEvent: (id: string) => void;
}) {
  const first = weekDays[0];
  const last = weekDays[6];
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-lg font-medium">
          {first.slice(8)}/{first.slice(5, 7)} – {last.slice(8)}/{last.slice(5, 7)}/{last.slice(0, 4)}
        </h2>
        <div className="flex gap-2">
          <button onClick={() => moveWeek(-1)} aria-label="Tuần trước" className="btn-ghost p-2"><ChevronLeft size={16} /></button>
          <button onClick={() => moveWeek(1)} aria-label="Tuần sau" className="btn-ghost p-2"><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {weekDays.map((dateStr, i) => {
          const evs = eventsOn(dateStr);
          const cons = contractsOn(dateStr);
          const isToday = dateStr === todayStr;
          return (
            <div
              key={dateStr}
              className="flex flex-col rounded-xl p-2.5"
              style={{
                background: isToday ? "var(--surface2)" : "transparent",
                border: isToday ? "1px solid var(--brand, var(--accent))" : "1px solid var(--border)",
                minHeight: 120,
              }}
            >
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[11px] font-semibold" style={{ color: "var(--text3)" }}>{WD[i]}</span>
                <span className="text-sm font-medium" style={{ color: isToday ? "var(--accent)" : "var(--text)" }}>{dateStr.slice(8)}/{dateStr.slice(5, 7)}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {cons.map((c) => {
                  const mc = c.calendar_color || DEFAULT_MARK;
                  return (
                  <Link
                    key={c.id}
                    href={`/dashboard/studio/contracts/${c.id}`}
                    className="rounded-lg px-2 py-1.5 text-[11px] leading-snug"
                    style={{ background: `color-mix(in srgb,${mc} 16%,transparent)`, borderLeft: `2px solid ${mc}` }}
                  >
                    <p className="flex items-center gap-1 font-medium">
                      <Camera size={11} style={{ color: mc, flex: "none" }} />
                      <span className="truncate">{c.event_time ? `${c.event_time} · ` : ""}{c.title}</span>
                    </p>
                    {c.client_name && <p style={{ color: "var(--text3)" }}>{c.client_name}</p>}
                    <p style={{ color: "var(--text3)" }}>{SHOOT_TYPE_LABEL[c.shoot_type] || c.shoot_type}</p>
                    {c.contract_items.length > 0 && (
                      <p style={{ color: "var(--text2)" }}>📦 {c.contract_items.map((it) => `${it.name}${it.qty > 1 ? ` x${it.qty}` : ""}`).join(", ")}</p>
                    )}
                    {c.location && <p className="truncate" style={{ color: "var(--text3)" }}>📍 {c.location}</p>}
                  </Link>
                  );
                })}
                {evs.map((e) => (
                  <div
                    key={e.id}
                    className="group flex items-start justify-between gap-1 rounded-lg px-2 py-1.5 text-[11px] leading-snug"
                    style={{ background: "color-mix(in srgb,var(--s-blue) 16%,transparent)", borderLeft: "2px solid var(--s-blue)" }}
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 font-medium">
                        {e.remind ? <Bell size={10} style={{ color: "var(--s-blue)", flex: "none" }} /> : <BellOff size={10} style={{ color: "var(--text3)", flex: "none" }} />}
                        <span className="truncate">{e.event_time ? `${e.event_time} · ` : ""}{eventLabel(e)}</span>
                      </p>
                      {e.note && <p style={{ color: "var(--text3)" }}>{e.note}</p>}
                    </div>
                    <button onClick={() => onDelEvent(e.id)} aria-label="Xoá ghi chú" title="Xoá" className="shrink-0 p-1" style={{ color: "var(--text3)" }}><Trash2 size={12} /></button>
                  </div>
                ))}
                {evs.length + cons.length === 0 && (
                  <span className="text-[11px]" style={{ color: "var(--text3)" }}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Chế độ NGÀY ───────────────────────────────────────────────────────────
   Danh sách buổi chụp trong một ngày: giờ bắt đầu to, tên job, khách, địa
   điểm và ê-kíp. Đây cũng là màn hay mở nhất trên điện thoại. */
function DayView({
  date, contracts, events, onMove, strip, onPick,
}: {
  date: string;
  contracts: ContractMarker[];
  events: EventRow[];
  onMove: (d: number) => void;
  strip: { date: string; dow: string; num: string; jobs: number; today: boolean }[];
  onPick: (d: string) => void;
}) {
  return (
    <div className="flex max-w-[840px] flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <button onClick={() => onMove(-1)} aria-label="Ngày trước" className="flex h-8 w-8 items-center justify-center rounded-[9px]" style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}>
          <ChevronLeft size={17} />
        </button>
        <span className="text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>{fmtDow(date)} · {fmtDate(date)}</span>
        <button onClick={() => onMove(1)} aria-label="Ngày sau" className="flex h-8 w-8 items-center justify-center rounded-[9px]" style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}>
          <ChevronRight size={17} />
        </button>
      </div>

      {/* Dải ngày cuộn ngang (bản mobile của thiết kế): chạm để nhảy ngày, khỏi
          phải bấm mũi tên từng ngày một. Ô có việc hiện chấm đếm bên dưới. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {strip.map((d) => {
          const on = d.date === date;
          return (
            <button
              key={d.date}
              onClick={() => onPick(d.date)}
              aria-current={on ? "date" : undefined}
              className="w-[46px] flex-none rounded-[14px] py-[9px] text-center"
              style={{
                background: on ? "var(--ac)" : "var(--sf)",
                border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`,
              }}
            >
              <p className="text-[10.5px] font-semibold" style={{ color: on ? "rgba(255,255,255,.75)" : "var(--tx3)" }}>{d.dow}</p>
              <p className="tnum mt-0.5 text-[16px] font-bold" style={{ color: on ? "#fff" : d.today ? "var(--ac)" : "var(--tx)" }}>{d.num}</p>
              <p className="mt-0.5 text-[9.5px]" style={{ color: on ? "rgba(255,255,255,.75)" : "var(--tx3)" }}>
                {d.jobs > 0 ? `${d.jobs} buổi` : "—"}
              </p>
            </button>
          );
        })}
      </div>

      {contracts.length === 0 && events.length === 0 ? (
        <Panel><EmptyState icon={CalendarDays} title="Ngày này chưa có lịch" hint="Không có buổi chụp hay mốc lịch nào — ngày trống để nhận job mới." /></Panel>
      ) : (
        <>
          {contracts.map((c) => {
            const crew = (c.contract_crew || []).filter((x) => x.status !== "declined");
            const tone = CONTRACT_STATUS_TONE[(c.status as ContractStatus)] ?? CONTRACT_STATUS_TONE.draft;
            return (
              <Link key={c.id} href={`/dashboard/studio/contracts/${c.id}`} className="flex gap-3.5 rounded-[14px] px-[17px] py-[15px]" style={{ background: "var(--sf)", border: "1px solid var(--bd)", borderLeft: `3px solid ${tone.fg}` }}>
                <div className="flex-none pr-3.5 text-center" style={{ borderRight: "1px solid var(--bd2)" }}>
                  <p className="tnum text-[15px] font-bold">{c.event_time || "--:--"}</p>
                  <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>{SHOOT_TYPE_LABEL[c.shoot_type]}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-bold">{c.title}</p>
                  <p className="mt-0.5 truncate text-[12px]" style={{ color: "var(--tx3)" }}>
                    {[c.client_name, c.location].filter(Boolean).join(" · ") || "Chưa có thông tin khách"}
                  </p>
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
        </>
      )}
    </div>
  );
}

/* ── Chế độ NHÂN SỰ (tính năng mới số 4) ───────────────────────────────────
   Mỗi người một hàng × 7 ngày; cột cuối là tải tuần đổi màu. Dưới 1100px ẩn
   dòng tên job trong ô, chỉ còn chấm — đúng ngưỡng responsive của bản thiết kế. */
function PeopleWeek({
  rows, weekDays, todayStr, onMove,
}: {
  rows: { key: string; name: string; days: Map<string, ContractMarker[]> }[];
  weekDays: string[];
  todayStr: string;
  onMove: (d: number) => void;
}) {
  const COLS = "minmax(140px,1.2fr) repeat(7, minmax(72px,1fr)) minmax(96px,.9fr)";
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <button onClick={() => onMove(-1)} aria-label="Tuần trước" className="flex h-8 w-8 items-center justify-center rounded-[9px]" style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}>
          <ChevronLeft size={17} />
        </button>
        <span className="text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>{fmtDate(weekDays[0])} – {fmtDate(weekDays[6])}</span>
        <button onClick={() => onMove(1)} aria-label="Tuần sau" className="flex h-8 w-8 items-center justify-center rounded-[9px]" style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}>
          <ChevronRight size={17} />
        </button>
      </div>

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
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: avatarColor(r.name) }}>
                    {initials(r.name)}
                  </span>
                  <span className="truncate text-[12.5px] font-semibold">{r.name}</span>
                </div>
                {weekDays.map((d) => {
                  const jobs = r.days.get(d) ?? [];
                  return (
                    <div key={d} className="min-h-[38px] rounded-[8px] px-1.5 py-1" style={{ background: jobs.length ? "var(--acS)" : d === todayStr ? "var(--sf2)" : "transparent", border: jobs.length ? "1px solid var(--acM)" : "1px solid transparent" }}>
                      {jobs.map((j) => (
                        <Link key={j.id} href={`/dashboard/studio/contracts/${j.id}`} className="block">
                          <span className="tnum block text-center text-[10.5px] font-bold" style={{ color: "var(--ac)" }}>{j.event_time || "cả ngày"}</span>
                          <span className="hidden truncate text-center text-[10px] min-[1100px]:block" style={{ color: "var(--tx2)" }}>{j.title}</span>
                        </Link>
                      ))}
                    </div>
                  );
                })}
                <span className="justify-self-end whitespace-nowrap rounded-[20px] px-[10px] py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                  {load} ngày
                </span>
              </div>
            );
          })
        )}
      </Panel>
    </div>
  );
}
