"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Clock, Factory, Lock, Plus, Trash2, UserRound, Users } from "lucide-react";
import { Avatar, Badge, Card, Empty, Field, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Drawer, PopLayer, SearchInput, Segmented, Switch, popStyle, useAnchoredPop } from "@/components/v2/kit-client";
import TimeInput from "@/components/TimeInput";
import { CREW_STATUS_LABEL, type CrewStatus } from "@/lib/types";
import { crewRoleLabel } from "@/lib/crew-roles";
import { SHIFT_COMPANY_LABEL } from "@/lib/crew-shift";
import { fmtDate, fmtDayMonth, todayVN } from "@/lib/date";
import type { CrewScheduleRow, TeamCalendarProps } from "./TeamCalendar";
import { useTeamCalendar } from "./team-logic";
import { MONTHS, shiftYmd, weekOf, ymd } from "./shoot-calendar";
import { Agenda, CalTabs, CalToolbar, DayNav, Legend, MonthGrid, WeekGrid, useMedia, type CalItem } from "./cal-v2-parts";

/* ═══════════════════════════════════════════════════════════════════════════
   LỊCH LÀM VIỆC · tab ĐỘI NGŨ — giao diện mới.

   Cùng dữ liệu, cùng thao tác với bản cũ (TeamCalendar); logic ở
   ./team-logic.ts. Bày lại theo khuôn chung của màn Lịch:
     • Thanh trên: Hôm nay ‹ › · Tháng/Tuần/Danh sách · lọc theo thợ (có ô
       tìm) · "Thêm lịch" (studio xếp lịch hộ thợ, mở ngăn kéo).
     • Mỗi việc là một chip màu theo trạng thái (đã nhận / chờ / từ chối), lịch
       thợ báo bận màu cam, ca công ty màu xanh.
     • Cột phải (màn rộng) hoặc ngăn kéo: chi tiết ngày đang chọn.
   ═══════════════════════════════════════════════════════════════════════════ */

type View = "month" | "week" | "list";

const STATUS_COLOR: Record<CrewStatus, string> = { accepted: "var(--gn)", pending: "var(--tx3)", declined: "var(--rd)" };
const hhmm = (t: string | null) => (t ?? "").slice(0, 5);
function timeLabel(r: CrewScheduleRow): string {
  if (!r.start_time || !r.end_time) return "Cả ngày";
  return `${hhmm(r.start_time)}–${hhmm(r.end_time)}${r.overnight ? " (+1)" : ""}`;
}

export default function TeamV2({ assignments, members, schedule, shifts, crewRoles = [], tabs }: TeamCalendarProps) {
  const todayStr = todayVN();
  const t = useTeamCalendar({ assignments, members, schedule, shifts });
  const { who, nameOf, byDateAssign, byDateSched, shiftsOn, showShift, setShowShift } = t;

  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(todayStr);
  const [selected, setSelected] = useState(todayStr);
  const [dayOpen, setDayOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const wide = useMedia("(min-width: 1600px)");

  useEffect(() => {
    if (window.innerWidth < 640) setView("list");
  }, []);

  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7)) - 1;
  const byMonth = view !== "week";
  const week = useMemo(() => weekOf(anchor), [anchor]);
  const monthDays = useMemo(() => {
    const n = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: n }, (_, i) => ymd(year, month, i + 1));
  }, [year, month]);
  const rangeDays = byMonth ? monthDays : week;

  function step(delta: number) {
    if (byMonth) {
      const d = new Date(year, month + delta, 1);
      const first = ymd(d.getFullYear(), d.getMonth(), 1);
      setAnchor(first.slice(0, 7) === todayStr.slice(0, 7) ? todayStr : first);
    } else setAnchor(shiftYmd(anchor, 7 * delta));
  }
  function openDay(d: string) {
    setSelected(d);
    if (!wide) setDayOpen(true);
  }

  function itemsOn(d: string): CalItem[] {
    const a = (byDateAssign[d] ?? []).map<CalItem>((x, k) => ({
      key: `a${k}-${x.contractId}-${x.name}`,
      date: d,
      time: null,
      title: x.name,
      sub: `${crewRoleLabel(x.role, crewRoles)} · ${x.contractTitle}`,
      color: STATUS_COLOR[x.status],
      icon: UserRound,
      dim: x.status === "declined",
      meta: <Badge tone={x.status === "accepted" ? "green" : x.status === "declined" ? "red" : "gray"}>{CREW_STATUS_LABEL[x.status]}</Badge>,
      onOpen: () => openDay(d),
    }));
    const s = (byDateSched[d] ?? []).map<CalItem>((r) => ({
      key: `s${r.id}`,
      date: d,
      time: r.start_time && r.end_time ? hhmm(r.start_time) : null,
      end: r.start_time && r.end_time && !r.overnight ? hhmm(r.end_time) : null,
      title: nameOf[r.phone] || r.phone,
      sub: r.title || "Báo bận",
      color: "var(--am)",
      icon: Clock,
      meta: <Badge tone="amber">{r.owner_id ? "Studio xếp" : "Thợ báo"}</Badge>,
      onOpen: () => openDay(d),
    }));
    const sh = shiftsOn(d).map<CalItem>((x) => ({
      key: `h${x.phone}`,
      date: d,
      time: null,
      title: `${x.name} · ${x.label.replace("Ca ", "ca ")}`,
      sub: SHIFT_COMPANY_LABEL.hoa_phat,
      color: "var(--bl)",
      icon: Factory,
      onOpen: () => openDay(d),
    }));
    return [...a, ...s, ...sh];
  }

  const label = byMonth ? `${MONTHS[month]}, ${year}` : `${fmtDayMonth(week[0])} – ${fmtDate(week[6])}`;
  const moveSel = (d: string) => {
    setSelected(d);
    if (!rangeDays.includes(d)) setAnchor(d);
  };

  const day = (
    <DayBody
      date={selected}
      t={t}
      crewRoles={crewRoles}
      canAdd={members.length > 0}
      onAdd={() => setAddOpen(true)}
    />
  );

  return (
    <div className="page-in flex min-w-0 flex-col gap-4">
      <CalTabs tabs={tabs} active="team" />

      <CalToolbar
        label={label}
        sub={who ? `Đang xem riêng: ${nameOf[who] || who}` : "Ai làm gì ngày nào — cả đội"}
        unit={byMonth ? "tháng" : "tuần"}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onToday={() => { setAnchor(todayStr); setSelected(todayStr); }}
        atToday={rangeDays.includes(todayStr)}
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
            <CrewPicker t={t} total={members.length} shifts={shifts} />
            {members.length > 0 && (
              <button type="button" className={btn("primary", "md", "!hidden sm:!inline-flex")} onClick={() => setAddOpen(true)}>
                <Plus size={17} /> Thêm lịch
              </button>
            )}
          </>
        }
        mobileAction={
          members.length > 0 ? (
            <button type="button" className={btn("primary", "md", "!w-[38px] !px-0")} aria-label="Thêm lịch" title="Thêm lịch" onClick={() => setAddOpen(true)}>
              <Plus size={19} />
            </button>
          ) : undefined
        }
      />

      {who && shifts[who] && (
        <div className="-mt-1 max-w-[460px]">
          <Switch
            checked={showShift}
            onChange={setShowShift}
            label={`Hiện ca công ty (ca ${shifts[who]})`}
            desc={`Ca làm tại ${SHIFT_COMPANY_LABEL.hoa_phat} của ${nameOf[who] || who}`}
          />
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 min-[1600px]:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          {view === "month" && (
            <MonthGrid year={year} month={month} todayStr={todayStr} selected={wide || dayOpen ? selected : null} itemsOn={itemsOn} onDay={openDay} max={4} />
          )}
          {view === "week" && (
            <>
              <div className="hidden md:block">
                <WeekGrid days={week} todayStr={todayStr} selected={wide ? selected : null} itemsOn={itemsOn} onDay={openDay} />
              </div>
              <div className="md:hidden">
                <Agenda days={week} todayStr={todayStr} itemsOn={itemsOn} showEmptyDays onEmptyDay={openDay} empty={<Empty compact icon={Users} title="Tuần này chưa ai có lịch" />} />
              </div>
            </>
          )}
          {view === "list" && (
            <Agenda
              days={monthDays}
              todayStr={todayStr}
              itemsOn={itemsOn}
              empty={<Empty compact icon={Users} title={`${MONTHS[month]} chưa ai có lịch`} hint="Phân công thợ trong hợp đồng, hoặc bấm “Thêm lịch” để xếp lịch cho thợ." />}
            />
          )}
          {view !== "list" && (
            <Legend
              items={[
                { color: "var(--gn)", label: "Đã nhận" },
                { color: "var(--tx3)", label: "Chờ phản hồi" },
                { color: "var(--rd)", label: "Từ chối" },
                { color: "var(--am)", label: "Thợ báo lịch / bận" },
                ...(who && showShift && shifts[who] ? [{ color: "var(--bl)", label: `Ca ${SHIFT_COMPANY_LABEL.hoa_phat}` }] : []),
              ]}
            />
          )}
        </div>

        {wide && (
          <aside className="sticky top-[76px]">
            <Card padded={false}>
              <div className="px-3 pt-3"><DayNav date={selected} todayStr={todayStr} onMove={moveSel} /></div>
              <div className="px-4 pb-4 pt-3">{day}</div>
            </Card>
          </aside>
        )}
      </div>

      <Drawer
        open={dayOpen && !wide && !addOpen}
        onClose={() => setDayOpen(false)}
        title="Lịch trong ngày"
        width={440}
      >
        <div className="mb-3"><DayNav date={selected} todayStr={todayStr} onMove={moveSel} /></div>
        {day}
      </Drawer>

      <AddDrawer open={addOpen} onClose={() => setAddOpen(false)} date={selected} t={t} members={members} onDate={moveSel} />
    </div>
  );
}

/* ── Chọn thợ (có ô tìm theo tên / SĐT) ───────────────────────────────────── */
function CrewPicker({ t, total, shifts }: { t: ReturnType<typeof useTeamCalendar>; total: number; shifts: TeamCalendarProps["shifts"] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const pos = useAnchoredPop(open, ref, popRef, 280, "right");
  const { who, setWho, q, setQ, filteredMembers, nameOf, setShowShift } = t;
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const pick = (phone: string) => {
    setWho(phone);
    setShowShift(false);
    setOpen(false);
  };
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={btn("secondary", "md", "max-w-[220px]")}>
        <Users size={16} />
        <span className="truncate">{who ? nameOf[who] || who : "Cả đội"}</span>
        {who && shifts[who] ? <span style={{ color: "var(--tx3)" }}>· ca {shifts[who]}</span> : null}
        <ChevronDown size={15} style={{ color: "var(--tx3)" }} />
      </button>
      {open && pos && (
        <PopLayer pos={pos}>
          <div ref={popRef} className="v2-menu-pop" style={popStyle(pos)}>
            <div className="p-1.5">
              <SearchInput value={q} onChange={setQ} placeholder="Tìm thợ theo tên hoặc SĐT…" autoFocus />
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              <button type="button" className="v2-menu-item" onClick={() => pick("")} style={!who ? { background: "var(--sf2)" } : undefined}>
                <Users size={16} />
                <span className="min-w-0 flex-1">Cả đội <span style={{ color: "var(--tx3)" }}>({total})</span></span>
              </button>
              {filteredMembers.map((m) => (
                <button key={m.phone} type="button" className="v2-menu-item" onClick={() => pick(m.phone)} style={who === m.phone ? { background: "var(--sf2)" } : undefined}>
                  <Avatar name={m.name} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{m.name}</span>
                    <span className="v2-menu-hint">{m.phone}{shifts[m.phone] ? ` · ca ${shifts[m.phone]}` : ""}</span>
                  </span>
                </button>
              ))}
              {filteredMembers.length === 0 && <p className="px-3 py-4 text-center text-[12.5px]" style={{ color: "var(--tx3)" }}>Không tìm thấy thợ nào.</p>}
            </div>
          </div>
        </PopLayer>
      )}
    </div>
  );
}

/* ── Chi tiết một ngày ─────────────────────────────────────────────────────── */
function DayBody({
  date, t, crewRoles, canAdd, onAdd,
}: {
  date: string;
  t: ReturnType<typeof useTeamCalendar>;
  crewRoles: NonNullable<TeamCalendarProps["crewRoles"]>;
  canAdd: boolean;
  onAdd: () => void;
}) {
  const assign = t.byDateAssign[date] ?? [];
  const sched = t.byDateSched[date] ?? [];
  const sh = t.shiftsOn(date);
  if (!assign.length && !sched.length && !sh.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-[13px]" style={{ color: "var(--tx3)" }}>Ngày trống — chưa ai báo lịch.</p>
        {canAdd && <button type="button" className={btn("soft", "sm")} onClick={onAdd}><Plus size={15} /> Xếp lịch cho thợ</button>}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {assign.map((a, k) => (
        <Link
          key={k}
          href={`/dashboard/studio/contracts/${a.contractId}`}
          className="flex items-center gap-2.5 rounded-[12px] p-2.5 transition-colors hover:bg-[var(--sf2)]"
          style={{ border: "1px solid var(--bd)" }}
        >
          <Avatar name={a.name} size={30} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium">{a.name}</span>
            <span className="block truncate text-[12px]" style={{ color: "var(--tx3)" }}>{crewRoleLabel(a.role, crewRoles)} · {a.contractTitle}</span>
          </span>
          <Badge tone={a.status === "accepted" ? "green" : a.status === "declined" ? "red" : "gray"}>{CREW_STATUS_LABEL[a.status]}</Badge>
        </Link>
      ))}
      {sh.map((s) => (
        <div key={s.phone} className="flex items-center gap-2.5 rounded-[12px] p-2.5" style={{ background: "var(--blS)" }}>
          <Factory size={16} className="flex-none" style={{ color: "var(--bl)" }} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium">{s.name}</span>
            <span className="block text-[12px]" style={{ color: "var(--bl)" }}>{SHIFT_COMPANY_LABEL.hoa_phat} · {s.label}</span>
          </span>
        </div>
      ))}
      {sched.map((r) => (
        <div key={r.id} className="flex items-start gap-2.5 rounded-[12px] p-2.5" style={{ background: "var(--amS)" }}>
          <Clock size={16} className="mt-0.5 flex-none" style={{ color: "var(--am)" }} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium">{t.nameOf[r.phone] || r.phone}</span>
            <span className="block text-[12px]" style={{ color: "var(--am)" }}>{timeLabel(r)}{r.title ? ` · ${r.title}` : ""}</span>
            {r.owner_id && (
              <span className="flex items-center gap-1 text-[11.5px]" style={{ color: "var(--tx3)" }}><Lock size={11} /> Studio xếp</span>
            )}
          </span>
          {/* Chỉ gỡ được mốc do studio xếp; mốc thợ tự thêm là của thợ. */}
          {r.owner_id && (
            <button type="button" onClick={() => t.removeEntry(r)} disabled={t.busy} aria-label="Gỡ mốc lịch" title="Gỡ mốc lịch" className={iconBtn("!h-8 !w-8 -mr-1 -mt-1")}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ))}
      {canAdd && (
        <button type="button" className={btn("ghost", "sm", "mt-1 self-start")} onClick={onAdd}>
          <Plus size={15} /> Xếp lịch cho thợ ngày {fmtDayMonth(date)}
        </button>
      )}
    </div>
  );
}

/* ── Studio xếp lịch hộ thợ ────────────────────────────────────────────────── */
function AddDrawer({
  open, onClose, date, t, members, onDate,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  t: ReturnType<typeof useTeamCalendar>;
  members: TeamCalendarProps["members"];
  onDate: (d: string) => void;
}) {
  const { form, setForm, who, busy } = t;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Xếp lịch cho thợ"
      desc="Studio ghi lịch bận / lịch làm hộ thợ. Mốc này chỉ studio gỡ được."
      width={440}
      footer={
        <>
          <button type="button" className={btn("ghost")} onClick={onClose}>Đóng</button>
          <button
            type="button"
            className={btn("primary")}
            disabled={busy || !(form.phone || who)}
            onClick={async () => {
              if (await t.addForCrew(date)) onClose();
            }}
          >
            {busy ? "Đang thêm…" : `Thêm vào ${fmtDayMonth(date)}`}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Thợ">
          <select className={inputCls} value={form.phone || who} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} aria-label="Chọn thợ">
            <option value="">— Chọn thợ —</option>
            {members.map((m) => <option key={m.phone} value={m.phone}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Ngày">
          <input className={inputCls} type="date" value={date} onChange={(e) => e.target.value && onDate(e.target.value)} />
        </Field>
        <Switch checked={form.allDay} onChange={(v) => setForm((f) => ({ ...f, allDay: v }))} label="Bận cả ngày" />
        {!form.allDay && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Từ giờ">
              <TimeInput className={inputCls} value={form.start} onChange={(v) => setForm((f) => ({ ...f, start: v }))} ariaLabel="Từ giờ" />
            </Field>
            <Field label="Đến giờ">
              <TimeInput className={inputCls} value={form.end} onChange={(v) => setForm((f) => ({ ...f, end: v }))} ariaLabel="Đến giờ" />
            </Field>
          </div>
        )}
        <Field label="Nội dung" hint="Không bắt buộc">
          <input className={inputCls} placeholder="VD: Đi quay sự kiện bên ngoài" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </Field>
      </div>
    </Drawer>
  );
}
