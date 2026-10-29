"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarClock, CalendarDays, Check, DoorOpen, FileText, Plus, Trash2, UsersRound } from "lucide-react";
import { Avatar, Badge, Callout, Card, Empty, Field, Progress, btn, inputCls } from "@/components/v2/kit";
import { Drawer, Segmented, Switch } from "@/components/v2/kit-client";
import WeatherChip, { WeatherDetail } from "@/components/studio/WeatherChip";
import TimeInput from "@/components/TimeInput";
import type { DayForecast } from "@/lib/weather";
import { fmtDate, fmtDayMonth } from "@/lib/date";
import { lunarFull } from "@/lib/lunar";
import { addDays, apptTimeRange, apptTitle, assigneeName, byStartTime, countByKind, kindMeta, mondayOf, toMinutes } from "@/lib/appointments";
import {
  APPOINTMENT_KINDS, APPOINTMENT_KIND_LABEL, APPOINTMENT_STATUS_LABEL,
  type AppointmentKind, type AppointmentStatus, type StudioAppointment,
} from "@/lib/types";
import type { SchedulePageProps } from "./SchedulePage";
import { draftOf, useSchedule, type Draft } from "./schedule-logic";
import { MONTHS, ymd } from "./shoot-calendar";
import { Agenda, AgendaRow, CalTabs, CalToolbar, MonthGrid, WeekGrid, dayTitle, soft, useMedia, type CalItem } from "./cal-v2-parts";

/* ═══════════════════════════════════════════════════════════════════════════
   LỊCH LÀM VIỆC · tab LỊCH STUDIO — giao diện mới.

   Cùng dữ liệu, cùng thao tác với bản cũ (SchedulePage); logic ở
   ./schedule-logic.ts. Bày lại:
     • Thanh trên chung với hai tab kia: Hôm nay ‹ › · Tuần/Tháng/Danh sách ·
       "Thêm lịch".
     • Dải loại lịch vừa là CHÚ GIẢI MÀU vừa là BỘ LỌC (bấm để ẩn/hiện).
     • Lưới giờ thật: buổi hẹn cao đúng từ giờ bắt đầu tới giờ kết thúc, bấm ô
       trống để đặt lịch đúng giờ đó. Trùng lịch có viền đỏ.
     • Cột phải: cảnh báo trùng, ê-kíp trong tuần, công suất phòng.
     • Đặt / sửa lịch trong ngăn kéo bên phải thay cho hộp thoại giữa màn.
   ═══════════════════════════════════════════════════════════════════════════ */

type View = "week" | "month" | "list";

export default function ScheduleV2(props: SchedulePageProps) {
  const { readOnly, today, rooms, assignees, contracts, branches = [], studioCoords = null, tabs } = props;
  const s = useSchedule(props);
  const { items, kindOn, setKindOn, counts, draft, setDraft, days, weekStart, conflicts, conflictKeys, loads, crewLoad, weather } = s;

  const [view, setView] = useState<View>("week");
  const [month, setMonth] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const wide = useMedia("(min-width: 1600px)");

  useEffect(() => {
    if (window.innerWidth < 640) setView("list");
  }, []);

  const byMonth = view !== "week";
  const monthDays = useMemo(() => {
    const n = new Date(month.y, month.m + 1, 0).getDate();
    return Array.from({ length: n }, (_, i) => ymd(month.y, month.m, i + 1));
  }, [month]);

  /** Lịch hiện trên lưới: bỏ lịch huỷ, theo chip lọc loại — y như bản cũ. */
  const visible = useMemo(() => items.filter((a) => a.status !== "cancelled" && kindOn[a.kind]), [items, kindOn]);
  const byDate = useMemo(() => {
    const m = new Map<string, StudioAppointment[]>();
    for (const a of visible) {
      const l = m.get(a.appt_date) ?? [];
      l.push(a);
      m.set(a.appt_date, l);
    }
    for (const l of m.values()) l.sort(byStartTime);
    return m;
  }, [visible]);

  function itemsOn(d: string): CalItem[] {
    return (byDate.get(d) ?? []).map((a) => {
      const { tone, Icon } = kindMeta(a.kind);
      const clash = conflictKeys.has(a.id);
      const day = weather.dayOf(a.id);
      return {
        key: a.id,
        date: d,
        time: a.start_time,
        end: a.end_time,
        title: apptTitle(a),
        sub: [assigneeName(a), a.room].filter(Boolean).join(" · "),
        color: tone.fg,
        icon: Icon,
        dim: a.status === "done",
        alert: clash ? "red" : undefined,
        meta: (
          <>
            {day ? <span className="hidden sm:block [&>p]:mt-0">{<WeatherChip day={day} />}</span> : null}
            {clash ? <Badge tone="red" dot>Trùng lịch</Badge> : null}
            {a.status !== "scheduled" ? <Badge tone={a.status === "done" ? "green" : "brand"}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge> : null}
          </>
        ),
        onOpen: () => setDraft(draftOf(a)),
      };
    });
  }

  function step(delta: number) {
    if (byMonth) {
      const d = new Date(month.y, month.m + delta, 1);
      setMonth({ y: d.getFullYear(), m: d.getMonth() });
    } else s.setWeekAnchor((w) => addDays(w, 7 * delta));
  }
  function goToday() {
    s.setWeekAnchor(mondayOf(today));
    setMonth({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 });
  }
  // Lật ra ngoài khoảng server đã nạp sẵn → nạp thêm đoạn đó.
  const rangeFrom = byMonth ? monthDays[0] : days[0];
  const rangeTo = byMonth ? monthDays[monthDays.length - 1] : days[6];
  const { ensureRange } = s;
  useEffect(() => {
    void ensureRange(rangeFrom, rangeTo);
  }, [ensureRange, rangeFrom, rangeTo]);

  // Số trên chip lọc: đếm theo đúng khoảng đang xem (tuần, hoặc cả tháng) —
  // trước đây xem tháng mà chip vẫn đếm theo tuần, lệch với lưới.
  const shownCounts = useMemo(
    () => (byMonth ? countByKind(items.filter((a) => a.status !== "cancelled" && a.appt_date >= rangeFrom && a.appt_date <= rangeTo)) : counts),
    [byMonth, items, rangeFrom, rangeTo, counts]
  );
  const atToday = byMonth ? monthDays.includes(today) : days.includes(today);
  const label = byMonth ? `${MONTHS[month.m]}, ${month.y}` : `${fmtDayMonth(days[0])} – ${fmtDate(days[6])}`;

  function openDay(d: string) {
    // Bấm một ngày ở lịch tháng → tuần đó thành tuần đang xét (cột phải đổi theo).
    s.setWeekAnchor(mondayOf(d));
    setDayOpen(d);
  }

  const rail = (
    <>
      {conflicts.length > 0 && (
        <Callout tone="red" icon={AlertCircle} title={`${conflicts.length} chỗ trùng lịch trong tuần`}>
          <div className="mt-1.5 flex flex-col gap-2.5">
            {conflicts.slice(0, 4).map((c) => (
              <div key={c.key}>
                <p className="text-[12.5px] font-semibold" style={{ color: "var(--tx)" }}>
                  {c.scope === "room" ? "Phòng " : ""}{c.name} · {fmtDayMonth(c.date)}
                </p>
                <p className="tnum text-[12px]">{c.items.map((i) => `${apptTimeRange(i)} ${apptTitle(i)}`).join(" · ")}</p>
                {!readOnly && (
                  <button type="button" onClick={() => setDraft(draftOf(c.items[c.items.length - 1]))} className={btn("secondary", "sm", "mt-1.5")}>
                    {c.scope === "room" ? "Đổi phòng" : "Đổi người phụ trách"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </Callout>
      )}

      <Card padded={false}>
        <div className="flex items-center gap-2 px-4 pb-2 pt-3.5">
          <UsersRound size={15} style={{ color: "var(--ac)" }} />
          <h3 className="text-[14px] font-semibold">Ê-kíp trong tuần</h3>
          <span className="ml-auto text-[12px]" style={{ color: "var(--tx3)" }}>{fmtDayMonth(weekStart)} – {fmtDayMonth(days[6])}</span>
        </div>
        {crewLoad.length === 0 ? (
          <p className="px-4 pb-4 text-[12.5px]" style={{ color: "var(--tx3)" }}>Chưa phân công ai. Mở một lịch hẹn rồi chọn người phụ trách.</p>
        ) : (
          <div className="pb-1.5">
            {crewLoad.map((c) => (
              <div key={c.name + c.n} className="flex items-center gap-2.5 px-4 py-2">
                <Avatar name={c.name} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{c.name}</p>
                  <p className="tnum text-[11.5px]" style={{ color: "var(--tx3)" }}>{c.n} lịch trong tuần</p>
                </div>
                {c.conflict ? <Badge tone="red" dot>Trùng lịch</Badge> : c.n >= 8 ? <Badge tone="amber" dot>Kín lịch</Badge> : <Badge tone="green" dot>Còn trống</Badge>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card padded={false}>
        <div className="flex items-center gap-2 px-4 pb-2 pt-3.5">
          <DoorOpen size={15} style={{ color: "var(--bl)" }} />
          <h3 className="text-[14px] font-semibold">Phòng & công suất tuần</h3>
        </div>
        {loads.length === 0 ? (
          <p className="px-4 pb-4 text-[12.5px]" style={{ color: "var(--tx3)" }}>Chưa khai phòng nào. Thêm phòng để lịch tính được công suất mỗi tuần.</p>
        ) : (
          <div className="flex flex-col gap-3 px-4 pb-4 pt-1">
            {loads.map((l) => (
              <div key={l.room.id}>
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{l.room.name}</span>
                  <span className="tnum text-[12px]" style={{ color: "var(--tx3)" }}>{l.used}/{l.room.capacity_week} buổi · {l.pct}%</span>
                </div>
                <Progress value={l.pct} tone={l.pct >= 90 ? "red" : l.pct >= 65 ? "amber" : "green"} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );

  return (
    <div className="page-in flex min-w-0 flex-col gap-4">
      <CalTabs tabs={tabs} active="studio" />

      <CalToolbar
        label={label}
        sub={byMonth ? undefined : `${s.weekItems.length} lịch hẹn trong tuần · trang điểm, thử đồ, pre-wedding, tư vấn`}
        unit={byMonth ? "tháng" : "tuần"}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onToday={goToday}
        atToday={atToday}
        right={
          <>
            <Segmented<View>
              value={view}
              onChange={setView}
              label="Chế độ xem"
              options={[
                { value: "month", label: "Tháng" },
                { value: "week", label: "Tuần" },
                { value: "list", label: "Danh sách" },
              ]}
            />
            {!readOnly && (
              <button type="button" className={btn("primary", "md", "!hidden sm:!inline-flex")} onClick={() => s.openNew(days.includes(today) ? today : days[0])}>
                <Plus size={17} /> Thêm lịch
              </button>
            )}
          </>
        }
        mobileAction={
          readOnly ? undefined : (
            <button type="button" className={btn("primary", "md", "!w-[38px] !px-0")} aria-label="Thêm lịch" title="Thêm lịch" onClick={() => s.openNew(days.includes(today) ? today : days[0])}>
              <Plus size={19} />
            </button>
          )
        }
      />

      {/* Loại lịch: vừa là chú giải màu, vừa là bộ lọc (số đếm trên cả tuần). */}
      <div className="hscroll -mt-1 gap-1.5 pb-0.5" role="group" aria-label="Lọc theo loại lịch">
        {APPOINTMENT_KINDS.map((k) => {
          const { label: kl, tone } = kindMeta(k);
          const on = kindOn[k];
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => setKindOn((p) => ({ ...p, [k]: !p[k] }))}
              className="flex h-8 flex-none items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors"
              style={on ? { background: soft(tone.fg, 13), color: "var(--tx)" } : { background: "transparent", color: "var(--tx3)", boxShadow: "inset 0 0 0 1px var(--bd)" }}
            >
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: on ? tone.fg : "var(--bd)" }} />
              {kl}
              <span className="tnum text-[11.5px]" style={{ color: "var(--tx3)" }}>{shownCounts[k] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 min-[1600px]:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {view === "week" && (
            <>
              <div className="hidden md:block">
                <WeekGrid
                  days={days}
                  todayStr={today}
                  itemsOn={itemsOn}
                  onDay={(d) => setDayOpen(d)}
                  onSlot={readOnly ? undefined : (d, h) => {
                    s.openNew(d);
                    setDraft((p) => (p ? { ...p, start_time: `${String(h).padStart(2, "0")}:00`, end_time: `${String(Math.min(23, h + 1)).padStart(2, "0")}:00` } : p));
                  }}
                />
              </div>
              <div className="md:hidden">
                <Agenda
                  days={days}
                  todayStr={today}
                  itemsOn={itemsOn}
                  showEmptyDays
                  onEmptyDay={readOnly ? undefined : (d) => s.openNew(d)}
                  empty={<Empty compact icon={CalendarDays} title="Tuần này chưa có lịch hẹn" />}
                />
              </div>
            </>
          )}
          {view === "month" && (
            <MonthGrid year={month.y} month={month.m} todayStr={today} selected={dayOpen} itemsOn={itemsOn} onDay={openDay} />
          )}
          {view === "list" && (
            <Agenda
              days={monthDays}
              todayStr={today}
              itemsOn={itemsOn}
              empty={<Empty compact icon={CalendarDays} title={`${MONTHS[month.m]} chưa có lịch hẹn`} hint={readOnly ? undefined : "Bấm “Thêm lịch” để đặt buổi trang điểm, thử đồ, tư vấn…"} />}
            />
          )}
        </div>
        {wide ? <aside className="sticky top-[76px] flex flex-col gap-4">{rail}</aside> : null}
      </div>
      {!wide ? <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 min-[1200px]:grid-cols-3">{rail}</div> : null}

      {/* ── Một ngày (bấm ô ở lịch tháng / đầu cột tuần) ─────────────────── */}
      <Drawer
        open={!!dayOpen && !draft}
        onClose={() => setDayOpen(null)}
        title={dayOpen ? dayTitle(dayOpen, today, true) : ""}
        desc={dayOpen ? `${fmtDate(dayOpen)} · ${lunarFull(dayOpen)}` : undefined}
        width={440}
        footer={
          !readOnly && dayOpen ? (
            <button type="button" className={btn("secondary")} onClick={() => s.openNew(dayOpen)}>
              <Plus size={16} /> Đặt lịch ngày này
            </button>
          ) : undefined
        }
      >
        {dayOpen && (itemsOn(dayOpen).length ? (
          <Card padded={false} className="overflow-hidden">
            {itemsOn(dayOpen).map((it) => <AgendaRow key={it.key} it={it} />)}
          </Card>
        ) : (
          <p className="py-6 text-center text-[13px]" style={{ color: "var(--tx3)" }}>Ngày trống — chưa có lịch hẹn nào.</p>
        ))}
      </Drawer>

      {/* ── Đặt / sửa lịch ───────────────────────────────────────────────── */}
      {draft && (
        <ApptDrawer
          draft={draft}
          setDraft={setDraft}
          rooms={rooms}
          assignees={assignees}
          contracts={contracts}
          branches={branches}
          busy={s.busy}
          readOnly={readOnly}
          availabilityOf={s.availabilityOf}
          weatherDay={draft.id ? weather.dayOf(draft.id) : null}
          studioCoords={studioCoords}
          shootCoords={draft.id ? weather.coordsOf(draft.id) : null}
          onSave={s.save}
          onDelete={s.remove}
          onAdvance={() => {
            const a = items.find((x) => x.id === draft.id);
            if (a) { s.advance(a); setDraft(null); }
          }}
        />
      )}

      {s.toastNode}
    </div>
  );
}

/* ── Ngăn đặt / sửa lịch — cùng trường, cùng luật với hộp thoại bản cũ ─────── */
function ApptDrawer({
  draft, setDraft, rooms, assignees, contracts, branches, busy, readOnly, onSave, onDelete, onAdvance,
  weatherDay, studioCoords, shootCoords, availabilityOf,
}: {
  draft: Draft;
  setDraft: (d: Draft | null) => void;
  rooms: SchedulePageProps["rooms"];
  assignees: SchedulePageProps["assignees"];
  contracts: SchedulePageProps["contracts"];
  branches: { id: string; name: string }[];
  busy: boolean;
  readOnly: boolean;
  onSave: () => void;
  onDelete: (id: string) => void;
  onAdvance: () => void;
  weatherDay: DayForecast | null;
  studioCoords: { lat: number; lng: number } | null;
  shootCoords: { lat: number; lng: number } | null;
  availabilityOf: (phone: string | null | undefined, date: string) => "busy" | "free" | "unknown";
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  const { label, tone, Icon } = kindMeta(draft.kind);
  const st = toMinutes(draft.start_time);
  const en = toMinutes(draft.end_time);
  const badRange = st != null && en != null && en <= st;
  const picked = assignees.find((a) => a.key === draft.assignee);
  const pickedAv = picked ? availabilityOf(picked.phone, draft.appt_date) : "unknown";

  return (
    <Drawer
      open
      onClose={() => setDraft(null)}
      title={readOnly ? "Chi tiết lịch hẹn" : draft.id ? "Sửa lịch hẹn" : "Đặt lịch mới"}
      desc={
        <span className="inline-flex items-center gap-1.5" style={{ color: tone.fg }}>
          <Icon size={13} /> {label}
          {draft.id ? <span style={{ color: "var(--tx3)" }}> · {APPOINTMENT_STATUS_LABEL[draft.status]}</span> : null}
        </span>
      }
      width={520}
      footer={
        readOnly ? undefined : (
          <div className="flex w-full flex-wrap items-center gap-2">
            {draft.id && draft.status !== "done" && (
              <button type="button" onClick={onAdvance} className={btn("secondary")}>
                {draft.status === "scheduled" ? <><Check size={16} /> Check-in</> : <><CalendarClock size={16} /> Hoàn thành</>}
              </button>
            )}
            {draft.id && (confirmDel ? (
              <>
                <button type="button" onClick={() => onDelete(draft.id!)} disabled={busy} className={btn("danger")}>Xoá hẳn</button>
                <button type="button" onClick={() => setConfirmDel(false)} className={btn("ghost")}>Thôi</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDel(true)} aria-label="Xoá lịch hẹn" title="Xoá lịch hẹn" className={btn("ghost", "md", "!px-2.5")} style={{ color: "var(--rd)" }}>
                <Trash2 size={16} />
              </button>
            ))}
            <button type="button" onClick={onSave} disabled={busy || badRange} className={btn("primary", "md", "ml-auto")}>
              {busy ? "Đang lưu…" : draft.id ? "Lưu thay đổi" : "Đặt lịch"}
            </button>
          </div>
        )
      }
    >
      <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4">
        {/* Loại lịch: một hàng nút màu thay cho ô chọn — nhìn là biết. */}
        <div>
          <p className="v2-label mb-1.5">Loại lịch</p>
          <div className="flex flex-wrap gap-1.5">
            {APPOINTMENT_KINDS.map((k) => {
              const m = kindMeta(k);
              const on = draft.kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set("kind", k as AppointmentKind)}
                  className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium"
                  style={on ? { background: m.tone.fg, color: "#fff" } : { background: soft(m.tone.fg, 10), color: "var(--tx2)" }}
                >
                  <m.Icon size={13} /> {APPOINTMENT_KIND_LABEL[k]}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Tiêu đề">
          <input className={inputCls} value={draft.title} onChange={(ev) => set("title", ev.target.value)} placeholder={`${label} — để trống sẽ tự đặt theo loại + tên khách`} />
        </Field>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Field label="Ngày" className="col-span-2 sm:col-span-1">
            <input className={inputCls} type="date" value={draft.appt_date} onChange={(ev) => set("appt_date", ev.target.value)} />
          </Field>
          <Field label="Bắt đầu">
            <TimeInput className={inputCls} value={draft.start_time} onChange={(v) => set("start_time", v)} ariaLabel="Giờ bắt đầu" />
          </Field>
          <Field label="Kết thúc" error={badRange ? "Phải sau giờ bắt đầu" : undefined}>
            <TimeInput className={inputCls} value={draft.end_time} onChange={(v) => set("end_time", v)} ariaLabel="Giờ kết thúc" placeholder="09:30" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Người phụ trách"
            hint={picked && pickedAv !== "unknown" ? (pickedAv === "busy" ? undefined : `${picked.name} đã khai rảnh ngày này.`) : undefined}
            error={picked && pickedAv === "busy" ? `${picked.name} đã tự báo bận ngày này.` : undefined}
          >
            <select className={inputCls} value={draft.assignee} onChange={(ev) => set("assignee", ev.target.value)}>
              <option value="">— Chưa phân công —</option>
              {assignees.map((a) => {
                const av = availabilityOf(a.phone, draft.appt_date);
                return (
                  <option key={a.key} value={a.key}>
                    {a.name}{av === "busy" ? " — đã báo bận" : av === "free" ? " — đang rảnh" : ""}
                  </option>
                );
              })}
            </select>
          </Field>
          <Field label="Phòng">
            <input className={inputCls} list="studio-rooms-v2" value={draft.room} onChange={(ev) => set("room", ev.target.value)} placeholder="Phòng trang điểm 1…" />
            <datalist id="studio-rooms-v2">
              {rooms.map((r) => <option key={r.id} value={r.name} />)}
            </datalist>
          </Field>
        </div>

        <Field label="Hợp đồng">
          <select
            className={inputCls}
            value={draft.contract_id}
            onChange={(ev) => {
              const id = ev.target.value;
              const c = contracts.find((x) => x.id === id);
              // Gắn hợp đồng thì điền luôn tên/SĐT khách — khỏi nhập lại.
              setDraft({ ...draft, contract_id: id, client_name: c?.client_name || draft.client_name, client_phone: c?.client_phone || draft.client_phone });
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Khách hàng">
            <input className={inputCls} value={draft.client_name} onChange={(ev) => set("client_name", ev.target.value)} />
          </Field>
          <Field label="Số điện thoại">
            <input className={inputCls} inputMode="tel" value={draft.client_phone} onChange={(ev) => set("client_phone", ev.target.value)} />
          </Field>
        </div>

        <Field label="Địa điểm">
          <input className={inputCls} value={draft.location} onChange={(ev) => set("location", ev.target.value)} placeholder="Đồi chè Cầu Đất, Đà Lạt…" />
          {weatherDay && (
            <div className="mt-2">
              <WeatherDetail day={weatherDay} startTime={draft.start_time || null} from={studioCoords} to={shootCoords} />
            </div>
          )}
        </Field>

        {branches.length > 0 && (
          <Field label="Chi nhánh">
            <select className={inputCls} value={draft.branch_id} onChange={(ev) => set("branch_id", ev.target.value)}>
              <option value="">— Chưa gán chi nhánh —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        )}

        <Field label="Ghi chú">
          <textarea className={inputCls} rows={2} value={draft.note} onChange={(ev) => set("note", ev.target.value)} placeholder="Dị ứng phấn nhũ, mang thêm áo dài…" style={{ height: "auto", paddingTop: 8, paddingBottom: 8 }} />
        </Field>

        <Switch
          checked={draft.client_visible}
          onChange={(v) => set("client_visible", v)}
          disabled={readOnly}
          label="Hiện cho khách trên cổng khách hàng"
          desc="Tắt với lịch nội bộ (họp ê-kíp, giữ phòng) — khách sẽ không thấy mốc này."
        />

        {draft.id && (
          <Field label="Trạng thái">
            <select className={inputCls} value={draft.status} onChange={(ev) => set("status", ev.target.value as AppointmentStatus)}>
              {(["scheduled", "checked_in", "done", "cancelled"] as AppointmentStatus[]).map((k) => (
                <option key={k} value={k}>{APPOINTMENT_STATUS_LABEL[k]}</option>
              ))}
            </select>
          </Field>
        )}
      </fieldset>

      {draft.contract_id && (
        <Link href={`/dashboard/studio/contracts/${draft.contract_id}`} className={btn("ghost", "sm", "mt-3 !px-0")} style={{ color: "var(--ac)" }}>
          <FileText size={15} /> Mở hợp đồng liên quan
        </Link>
      )}
    </Drawer>
  );
}
