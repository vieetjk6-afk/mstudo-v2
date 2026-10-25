"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Bell, BellOff, CalendarDays, CalendarPlus, Camera, Check, Copy, FileText, Link2, MapPin, Phone,
  Plus, RefreshCw, Trash2, Users,
} from "lucide-react";
import { Avatar, Callout, Card, Empty, Field, InfoList, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Drawer, Menu, Modal, Segmented, Switch } from "@/components/v2/kit-client";
import MessengerButton from "@/components/MessengerButton";
import TimeInput from "@/components/TimeInput";
import { shootReminderMessage } from "@/lib/zalo";
import { fmtDate, fmtDayMonth, fmtDow, todayVN } from "@/lib/date";
import { lunarFull } from "@/lib/lunar";
import { crewRoleLabel } from "@/lib/crew-roles";
import {
  CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE, CREW_STATUS_LABEL, SHOOT_TYPE_LABEL, contractTotal, sumAmounts, vndShort,
  type ContractStatus, type CrewStatus,
} from "@/lib/types";
import type { CalendarViewProps, ContractMarker, EventRow } from "./CalendarView";
import {
  DEFAULT_MARK, MARK_COLORS, MONTHS, WD, crewOf, eventLabel, itemsLabel, peopleWeek, shiftYmd, summarizeRange,
  useShootCalendar, weekOf, ymd, type NoteInput, type PeopleRow,
} from "./shoot-calendar";
import {
  Agenda, CalTabs, CalToolbar, DayNav, Legend, MonthGrid, WeekGrid, dayTitle, soft, useMedia, type CalItem,
} from "./cal-v2-parts";

/* ═══════════════════════════════════════════════════════════════════════════
   LỊCH LÀM VIỆC · tab BUỔI CHỤP — giao diện mới.

   Cùng dữ liệu và cùng thao tác với bản cũ (CalendarView), logic dùng chung ở
   ./shoot-calendar.ts. Khác ở cách bày:
     • Một thanh: Hôm nay ‹ › khoảng đang xem — chế độ xem — "Thêm lịch".
     • Một dòng tóm tắt (số buổi, chưa phân công, ngày dồn, tiền) thay hộp lớn.
     • Lưới gọn: mỗi buổi một chip một dòng theo màu của buổi; bấm chip mở ngăn
       chi tiết (đổi màu, gửi khách, mở hợp đồng). Bấm ô ngày xem cả ngày ở cột
       phải (màn rộng) hoặc ngăn kéo (màn hẹp).
     • Google Lịch + link đăng ký gom vào menu ⋯ (ngăn kéo riêng).
     • Điện thoại mặc định chế độ Danh sách.
   ═══════════════════════════════════════════════════════════════════════════ */

type View = "month" | "week" | "list" | "people";

const statusTone = (s: string) => CONTRACT_STATUS_TONE[s as ContractStatus] ?? CONTRACT_STATUS_TONE.draft;
const statusLabel = (s: string) => CONTRACT_STATUS_LABEL[s as ContractStatus] ?? s;

function StatusPill({ status }: { status: string }) {
  const t = statusTone(status);
  return (
    <span className="v2-badge" style={{ background: t.bg, color: t.fg }}>
      {statusLabel(status)}
    </span>
  );
}

function money(c: ContractMarker) {
  const total = contractTotal(c.contract_items || []);
  const left = Math.max(0, total - sumAmounts(c.contract_payments || []));
  return { total, left };
}

export default function CalendarV2({ ownerId, initialEvents, contracts, feedUrl, gcal, crewRoles = [], tabs }: CalendarViewProps) {
  const todayStr = todayVN();
  const cal = useShootCalendar({ ownerId, initialEvents, contracts, todayStr });
  const { events, contractList, eventsOn, contractsOn, upcoming, gcalMsg, setGcalMsg } = cal;

  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(todayStr);
  const [selected, setSelected] = useState(todayStr);
  const [dayOpen, setDayOpen] = useState(false);
  const [shootId, setShootId] = useState<string | null>(null);
  const [addDate, setAddDate] = useState<string | null>(null);
  const [gcalOpen, setGcalOpen] = useState(false);
  const wide = useMedia("(min-width: 1600px)");

  // Điện thoại: lịch tháng chỉ còn chấm màu → mở sẵn chế độ Danh sách.
  useEffect(() => {
    if (window.innerWidth < 640) setView("list");
  }, []);

  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7)) - 1;
  const byMonth = view === "month" || view === "list";
  const week = useMemo(() => weekOf(anchor), [anchor]);
  const rangeDays = useMemo(() => {
    if (!byMonth) return week;
    const n = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: n }, (_, i) => ymd(year, month, i + 1));
  }, [byMonth, week, year, month]);
  const summary = useMemo(() => summarizeRange(rangeDays, contractList, events), [rangeDays, contractList, events]);

  function step(delta: number) {
    if (byMonth) {
      const d = new Date(year, month + delta, 1);
      const first = ymd(d.getFullYear(), d.getMonth(), 1);
      // Về đúng tháng có hôm nay thì neo lại vào hôm nay (sang Tuần vẫn đúng tuần này).
      setAnchor(first.slice(0, 7) === todayStr.slice(0, 7) ? todayStr : first);
    } else setAnchor(shiftYmd(anchor, 7 * delta));
  }
  function goToday() {
    setAnchor(todayStr);
    setSelected(todayStr);
  }
  const atToday = rangeDays.includes(todayStr);

  function openDay(d: string) {
    setSelected(d);
    if (!wide) setDayOpen(true);
  }

  const shoot = shootId ? contractList.find((c) => c.id === shootId) ?? null : null;

  /** Mọi thứ trong một ngày, đổi về dạng chung của lưới. */
  function itemsOn(d: string): CalItem[] {
    const cons = contractsOn(d).sort((a, b) => (a.event_time || "99").localeCompare(b.event_time || "99"));
    const notes = eventsOn(d).sort((a, b) => (a.event_time || "99").localeCompare(b.event_time || "99"));
    return [
      ...cons.map<CalItem>((c) => {
        const crew = crewOf(c);
        const { left } = money(c);
        return {
          key: c.id,
          date: d,
          time: c.event_time,
          title: c.title,
          sub: [c.client_name, c.location, itemsLabel(c, " · ", "×")].filter(Boolean).join(" · ") || undefined,
          color: c.calendar_color || DEFAULT_MARK,
          icon: Camera,
          alert: crew.length === 0 ? "amber" : undefined,
          meta: (
            <>
              {crew.length === 0 ? (
                <span className="v2-badge" style={{ background: "var(--amS)", color: "var(--am)" }}>Chưa phân công</span>
              ) : (
                <span className="flex items-center" title={crew.map((x) => x.name).join(", ")}>
                  {crew.slice(0, 3).map((x) => (
                    <span key={x.id} className="-ml-1.5 rounded-full first:ml-0" style={{ boxShadow: "0 0 0 2px var(--sf)" }}>
                      <Avatar name={x.name || "?"} size={24} />
                    </span>
                  ))}
                </span>
              )}
              {left > 0 && <span className="tnum text-[12px] font-semibold" style={{ color: "var(--am)" }}>còn {vndShort(left)}</span>}
              <StatusPill status={c.status} />
            </>
          ),
          onOpen: () => setShootId(c.id),
        };
      }),
      ...notes.map<CalItem>((e) => ({
        key: e.id,
        date: d,
        time: e.event_time,
        title: eventLabel(e),
        sub: e.note || undefined,
        color: "var(--bl)",
        icon: e.remind ? Bell : BellOff,
        meta: <span className="v2-badge" style={{ background: "var(--blS)", color: "var(--bl)" }}>Mốc</span>,
        onOpen: () => openDay(d),
      })),
    ];
  }

  const noCrewOn = (d: string) => contractsOn(d).filter((c) => crewOf(c).length === 0).length;

  const label = byMonth ? `${MONTHS[month]}, ${year}` : `${fmtDayMonth(week[0])} – ${fmtDate(week[6])}`;

  const dayBody = (
    <DayDetail
      date={selected}
      contracts={contractsOn(selected).sort((a, b) => (a.event_time || "99").localeCompare(b.event_time || "99"))}
      events={eventsOn(selected)}
      onShoot={setShootId}
      onDelete={cal.delEvent}
      onAdd={() => setAddDate(selected)}
    />
  );

  return (
    <div className="page-in flex min-w-0 flex-col gap-4">
      <CalTabs tabs={tabs} active="shoot" />

      <CalToolbar
        label={label}
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
                { value: "people", label: "Nhân sự" },
              ]}
            />
            <Menu
              label="Thêm thao tác"
              width={260}
              items={[
                {
                  label: "Google Lịch",
                  icon: CalendarDays,
                  hint: gcal?.ok ? "Đã kết nối" : gcal?.connected ? "Đang lỗi — bấm để xem" : "Chưa kết nối",
                  onClick: () => setGcalOpen(true),
                },
                ...(feedUrl
                  ? [{ label: "Chép link đăng ký lịch", icon: Link2, onClick: () => navigator.clipboard?.writeText(feedUrl) }]
                  : []),
              ]}
            />
            <button type="button" className={btn("primary", "md", "!hidden sm:!inline-flex")} onClick={() => setAddDate(selected || todayStr)}>
              <Plus size={17} /> Thêm lịch
            </button>
          </>
        }
        mobileAction={
          <button type="button" className={btn("primary", "md", "!w-[38px] !px-0")} aria-label="Thêm lịch" title="Thêm lịch" onClick={() => setAddDate(selected || todayStr)}>
            <Plus size={19} />
          </button>
        }
      />

      {/* ── Một dòng tóm tắt khoảng đang xem ─────────────────────────────── */}
      <div className="-mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 px-0.5 text-[13px]" style={{ color: "var(--tx2)" }}>
        <span className="flex items-center gap-1.5">
          <Camera size={15} style={{ color: "var(--ac)" }} />
          <b className="tnum" style={{ color: "var(--tx)" }}>{summary.shoots}</b> buổi chụp
        </span>
        {summary.notes > 0 && (
          <span className="flex items-center gap-1.5">
            <Bell size={14} style={{ color: "var(--bl)" }} />
            <b className="tnum" style={{ color: "var(--tx)" }}>{summary.notes}</b> mốc lịch
          </span>
        )}
        {summary.noCrew > 0 && (
          <span className="v2-badge" style={{ background: "var(--amS)", color: "var(--am)" }}>
            <Users size={12} strokeWidth={2.4} /> {summary.noCrew} buổi chưa phân công
          </span>
        )}
        {summary.busyDays > 0 && (
          <span className="v2-badge" style={{ background: "var(--rdS)", color: "var(--rd)" }}>
            <CalendarDays size={12} strokeWidth={2.4} /> {summary.busyDays} ngày dồn ≥3 buổi
          </span>
        )}
        {summary.shoots > 0 && (
          <span className="flex flex-wrap items-center gap-x-3 sm:ml-auto">
            <span>Giá trị <b className="tnum" style={{ color: "var(--tx)" }}>{vndShort(summary.value)}</b></span>
            <span>Còn phải thu <b className="tnum" style={{ color: summary.due > 0 ? "var(--am)" : "var(--gn)" }}>{vndShort(summary.due)}</b></span>
          </span>
        )}
      </div>

      {gcal?.connected && !gcal.ok && (
        <Callout
          tone="amber"
          icon={AlertTriangle}
          title="Google Lịch đang lỗi — lịch chụp không lên Google"
          action={<button type="button" className={btn("secondary", "sm")} onClick={() => setGcalOpen(true)}>Xem cách sửa</button>}
        >
          Có kết nối nhưng gọi Google không được. Ngắt rồi kết nối lại ở mục Kết nối.
        </Callout>
      )}
      {gcalMsg && !gcalOpen && (
        <Callout
          tone="amber"
          icon={AlertTriangle}
          action={<button type="button" className={btn("ghost", "sm")} onClick={() => setGcalMsg(null)}>Đóng</button>}
        >
          {gcalMsg}
        </Callout>
      )}

      {/* ── Lịch + cột phải ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-4 min-[1600px]:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          {view === "month" && (
            <>
              <MonthGrid
                year={year}
                month={month}
                todayStr={todayStr}
                selected={wide || dayOpen ? selected : null}
                itemsOn={itemsOn}
                onDay={openDay}
                flagOn={(d) => {
                  const n = noCrewOn(d);
                  return n ? (
                    <span title={`${n} buổi chưa phân công`} className="flex items-center" style={{ color: "var(--am)" }}>
                      <Users size={12} strokeWidth={2.4} />
                    </span>
                  ) : null;
                }}
              />
              <Legend
                items={[
                  { color: DEFAULT_MARK, label: "Buổi chụp (màu chọn trong chi tiết buổi)" },
                  { color: "var(--bl)", label: "Mốc ghi chú" },
                  { color: "var(--am)", label: "Viền cam / biểu tượng người: chưa phân công" },
                ]}
              />
            </>
          )}
          {view === "week" && (
            <>
              <div className="hidden md:block">
                <WeekGrid days={week} todayStr={todayStr} selected={wide ? selected : null} itemsOn={itemsOn} onDay={openDay} />
              </div>
              <div className="md:hidden">
                <Agenda
                  days={week}
                  todayStr={todayStr}
                  itemsOn={itemsOn}
                  showEmptyDays
                  onEmptyDay={openDay}
                  empty={<Empty compact icon={CalendarDays} title="Tuần này chưa có lịch" />}
                />
              </div>
              <UpcomingHint list={summary.shoots === 0 ? contractList.filter((c) => c.event_date > week[6]).sort((a, b) => a.event_date.localeCompare(b.event_date)).slice(0, 3) : []} onOpen={setShootId} />
            </>
          )}
          {view === "list" && (
            <Agenda
              days={rangeDays}
              todayStr={todayStr}
              itemsOn={itemsOn}
              empty={
                <Empty
                  compact
                  icon={CalendarDays}
                  title={`${MONTHS[month]} chưa có buổi chụp nào`}
                  hint="Buổi chụp tự lên lịch khi hợp đồng đã xác nhận và có ngày chụp."
                />
              }
            />
          )}
          {view === "people" && <PeopleV2 rows={peopleWeek(contractList, week, crewRoles)} week={week} todayStr={todayStr} onShoot={setShootId} />}
        </div>

        {/* Cột phải (màn rộng): chi tiết ngày đang chọn + nhắc lịch */}
        {wide && (
          <aside className="sticky top-[76px] flex flex-col gap-4">
            <Card padded={false}>
              <div className="px-3 pt-3">
                <DayNav date={selected} todayStr={todayStr} onMove={(d) => { setSelected(d); if (!rangeDays.includes(d)) setAnchor(d); }} />
              </div>
              <div className="px-4 pb-4 pt-3">{dayBody}</div>
            </Card>
            <Reminders list={upcoming} todayStr={todayStr} onOpen={openDay} />
          </aside>
        )}
      </div>

      {!wide && view !== "list" && <Reminders list={upcoming} todayStr={todayStr} onOpen={openDay} />}

      {/* ── Ngăn chi tiết một ngày (màn hẹp) ─────────────────────────────── */}
      <Drawer
        open={dayOpen && !wide}
        onClose={() => setDayOpen(false)}
        title="Lịch trong ngày"
        width={440}
        footer={
          <button type="button" className={btn("secondary")} onClick={() => setAddDate(selected)}>
            <Plus size={16} /> Thêm mốc vào ngày này
          </button>
        }
      >
        <div className="mb-3">
          <DayNav date={selected} todayStr={todayStr} onMove={(d) => { setSelected(d); if (!rangeDays.includes(d)) setAnchor(d); }} />
        </div>
        {dayBody}
      </Drawer>

      {/* ── Ngăn chi tiết một buổi chụp ──────────────────────────────────── */}
      <ShootDrawer c={shoot} onClose={() => setShootId(null)} onColor={cal.setContractColor} crewRoles={crewRoles} todayStr={todayStr} />

      {/* ── Thêm mốc ─────────────────────────────────────────────────────── */}
      {addDate && (
        <NoteModal
          date={addDate}
          busy={cal.busy}
          onClose={() => setAddDate(null)}
          onSave={async (d, f) => {
            if (await cal.addNote(d, f)) {
              setAddDate(null);
              setSelected(d);
              if (!rangeDays.includes(d)) setAnchor(d);
            }
          }}
        />
      )}

      {/* ── Google Lịch & link đăng ký ───────────────────────────────────── */}
      <Drawer open={gcalOpen} onClose={() => setGcalOpen(false)} title="Google Lịch" desc="Đưa lịch chụp lên Google Calendar của bạn" width={460}>
        <GcalBody gcal={gcal} feedUrl={feedUrl} msg={gcalMsg} backfilling={cal.backfilling} onBackfill={cal.backfillGcal} />
      </Drawer>
    </div>
  );
}

/* ── Chi tiết một ngày ─────────────────────────────────────────────────────── */
function DayDetail({
  date, contracts, events, onShoot, onDelete, onAdd,
}: {
  date: string;
  contracts: ContractMarker[];
  events: EventRow[];
  onShoot: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  if (contracts.length === 0 && events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-[13px]" style={{ color: "var(--tx3)" }}>Ngày trống — nhận thêm job được.</p>
        <button type="button" className={btn("soft", "sm")} onClick={onAdd}>
          <CalendarPlus size={15} /> Thêm mốc
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {contracts.map((c) => {
        const crew = crewOf(c);
        const mc = c.calendar_color || DEFAULT_MARK;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onShoot(c.id)}
            className="flex w-full min-w-0 gap-3 rounded-[12px] p-3 text-left transition-colors hover:bg-[var(--sf2)]"
            style={{ border: "1px solid var(--bd)" }}
          >
            <span className="w-[3px] flex-none self-stretch rounded-full" style={{ background: mc }} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="tnum text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>{c.event_time || "Cả ngày"}</span>
                <span className="ml-auto"><StatusPill status={c.status} /></span>
              </span>
              <span className="mt-0.5 block truncate text-[14px] font-semibold">{c.title}</span>
              <span className="block truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                {[c.client_name, c.location].filter(Boolean).join(" · ") || SHOOT_TYPE_LABEL[c.shoot_type]}
              </span>
              <span className="mt-1.5 flex items-center gap-1.5 text-[12px]" style={{ color: crew.length ? "var(--tx2)" : "var(--am)" }}>
                <Users size={13} />
                {crew.length ? crew.map((x) => x.name || "?").join(", ") : "Chưa phân công"}
              </span>
            </span>
          </button>
        );
      })}
      {events.map((e) => (
        <div key={e.id} className="flex items-start gap-2.5 rounded-[12px] p-3" style={{ background: "var(--blS)" }}>
          {e.remind ? <Bell size={15} className="mt-0.5 flex-none" style={{ color: "var(--bl)" }} /> : <BellOff size={15} className="mt-0.5 flex-none" style={{ color: "var(--tx3)" }} />}
          <div className="min-w-0 flex-1">
            <p className="break-words text-[13.5px] font-semibold">
              {eventLabel(e)}
              {e.event_time ? <span className="tnum font-normal" style={{ color: "var(--tx2)" }}> · {e.event_time}</span> : null}
            </p>
            {e.note && <p className="break-words text-[12.5px]" style={{ color: "var(--tx2)" }}>{e.note}</p>}
          </div>
          {confirm === e.id ? (
            <span className="flex flex-none items-center gap-1">
              <button type="button" className={btn("danger", "sm")} onClick={() => { setConfirm(null); onDelete(e.id); }}>Xoá</button>
              <button type="button" className={btn("ghost", "sm")} onClick={() => setConfirm(null)}>Thôi</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirm(e.id)} aria-label="Xoá ghi chú" title="Xoá ghi chú" className={iconBtn("!h-8 !w-8 -mr-1 -mt-1")}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ))}
      <button type="button" className={btn("ghost", "sm", "mt-1 self-start")} onClick={onAdd}>
        <Plus size={15} /> Thêm mốc vào {fmtDayMonth(date)}
      </button>
    </div>
  );
}

/* ── Nhắc lịch 30 ngày tới ─────────────────────────────────────────────────── */
function Reminders({ list, todayStr, onOpen }: { list: EventRow[]; todayStr: string; onOpen: (d: string) => void }) {
  return (
    <Card padded={false}>
      <div className="flex items-center gap-2 px-4 pb-2 pt-3.5">
        <Bell size={15} style={{ color: "var(--bl)" }} />
        <h3 className="text-[14px] font-semibold">Nhắc lịch 30 ngày tới</h3>
        <span className="ml-auto text-[12px]" style={{ color: "var(--tx3)" }}>{list.length || ""}</span>
      </div>
      {list.length === 0 ? (
        <p className="px-4 pb-4 text-[12.5px]" style={{ color: "var(--tx3)" }}>Không có nhắc nào.</p>
      ) : (
        <div className="pb-1.5">
          {list.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onOpen(e.event_date)}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] transition-colors hover:bg-[var(--sf2)]"
            >
              <span className="min-w-0 flex-1 truncate">{eventLabel(e)}</span>
              <span className="tnum flex-none text-[12px]" style={{ color: e.event_date === todayStr ? "var(--ac)" : "var(--tx3)" }}>
                {e.event_date === todayStr ? "Hôm nay" : `${fmtDow(e.event_date)} ${fmtDayMonth(e.event_date)}`}
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ── Tuần trống: chỉ ra buổi gần nhất sắp tới ─────────────────────────────── */
function UpcomingHint({ list, onOpen }: { list: ContractMarker[]; onOpen: (id: string) => void }) {
  if (list.length === 0) return null;
  return (
    <Card padded={false}>
      <p className="px-4 pb-1 pt-3 text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>
        Tuần này chưa có buổi chụp · buổi gần nhất sắp tới
      </p>
      {list.map((c) => (
        <button key={c.id} type="button" onClick={() => onOpen(c.id)} className="v2-row v2-row-link w-full text-left">
          <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: c.calendar_color || DEFAULT_MARK }} />
          <span className="min-w-0 flex-1">
            <span className="v2-row-title block">{c.title}</span>
            <span className="v2-row-sub block">{fmtDow(c.event_date)} · {fmtDate(c.event_date)}{c.event_time ? ` · ${c.event_time}` : ""}{c.client_name ? ` · ${c.client_name}` : ""}</span>
          </span>
          <StatusPill status={c.status} />
        </button>
      ))}
    </Card>
  );
}

/* ── Ngăn chi tiết một buổi chụp ───────────────────────────────────────────── */
function ShootDrawer({
  c, onClose, onColor, crewRoles, todayStr,
}: {
  c: ContractMarker | null;
  onClose: () => void;
  onColor: (id: string, color: string) => void;
  crewRoles: CalendarViewProps["crewRoles"];
  todayStr: string;
}) {
  if (!c) return <Drawer open={false} onClose={onClose} title="">{null}</Drawer>;
  const crew = crewOf(c);
  const declined = (c.contract_crew || []).length - crew.length;
  const mc = c.calendar_color || DEFAULT_MARK;
  const { total, left } = money(c);
  return (
    <Drawer
      open
      onClose={onClose}
      title={c.title}
      desc={[c.code, SHOOT_TYPE_LABEL[c.shoot_type] || c.shoot_type].filter(Boolean).join(" · ")}
      width={480}
      footer={
        <>
          {c.client_phone && (
            <MessengerButton
              label="Gửi cho khách"
              className={btn("secondary")}
              message={shootReminderMessage({
                name: c.client_name,
                title: c.title,
                date: c.event_date,
                time: c.event_time,
                location: c.location,
              })}
            />
          )}
          <Link href={`/dashboard/studio/contracts/${c.id}`} className={btn("primary")}>
            <FileText size={16} /> Mở hợp đồng
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3 rounded-[12px] p-3.5" style={{ background: soft(mc, 12) }}>
          <span className="mt-0.5 h-3 w-3 flex-none rounded-full" style={{ background: mc }} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">
              {dayTitle(c.event_date, todayStr, true)}
              {c.event_time ? <span className="tnum"> · {c.event_time}</span> : <span style={{ color: "var(--tx3)" }}> · chưa đặt giờ</span>}
            </p>
            <p className="text-[12.5px]" style={{ color: "var(--tx2)" }}>{fmtDate(c.event_date)} · {lunarFull(c.event_date)}</p>
          </div>
          <StatusPill status={c.status} />
        </div>

        <InfoList
          items={[
            {
              label: "Khách",
              value: (
                <span className="flex flex-col items-end">
                  <span>{c.client_name || "—"}</span>
                  {c.client_phone && (
                    <a href={`tel:${c.client_phone}`} className="flex items-center gap-1 text-[12.5px]" style={{ color: "var(--ac)" }}>
                      <Phone size={12} /> {c.client_phone}
                    </a>
                  )}
                </span>
              ),
            },
            { label: "Địa điểm", value: c.location ? <span className="flex items-center justify-end gap-1"><MapPin size={13} style={{ color: "var(--tx3)" }} /> {c.location}</span> : "—" },
            { label: "Dịch vụ", value: SHOOT_TYPE_LABEL[c.shoot_type] || c.shoot_type },
            ...(c.contract_items.length ? [{ label: "Hạng mục", value: <span className="break-words">{itemsLabel(c)}</span> }] : []),
            ...(total > 0
              ? [
                  { label: "Giá trị", value: <span className="tnum font-semibold">{vndShort(total)}</span> },
                  {
                    label: "Còn phải thu",
                    value: left > 0
                      ? <span className="tnum font-semibold" style={{ color: "var(--am)" }}>{vndShort(left)}</span>
                      : <span className="font-semibold" style={{ color: "var(--gn)" }}>Đã thu đủ</span>,
                  },
                ]
              : []),
          ]}
        />

        <div>
          <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
            Ê-kíp <span className="font-normal" style={{ color: "var(--tx3)" }}>{c.contract_crew.length} người{declined ? ` · ${declined} từ chối` : ""}</span>
          </p>
          {crew.length === 0 ? (
            <Callout tone="amber" icon={Users} title="Chưa phân công ai">
              Mở hợp đồng để xếp người cho buổi này.
            </Callout>
          ) : (
            <div className="flex flex-col gap-1">
              {crew.map((x) => (
                <div key={x.id} className="flex items-center gap-2.5 py-1">
                  <Avatar name={x.name || "?"} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{x.name || "Chưa đặt tên"}</p>
                    <p className="text-[12px]" style={{ color: "var(--tx3)" }}>{crewRoleLabel(x.role, crewRoles)}</p>
                  </div>
                  <span
                    className="v2-badge"
                    style={x.status === "accepted" ? { background: "var(--gnS)", color: "var(--gn)" } : { background: "var(--nuS)", color: "var(--tx2)" }}
                  >
                    {CREW_STATUS_LABEL[x.status as CrewStatus] ?? x.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Màu riêng của buổi — nhiều buổi cùng ngày nhìn màu là phân biệt được. */}
        <div>
          <p className="mb-2 text-[13px] font-semibold">Màu trên lịch</p>
          <div className="flex flex-wrap gap-1.5">
            {MARK_COLORS.map((col) => {
              const on = mc.toLowerCase() === col.toLowerCase();
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => onColor(c.id, col)}
                  aria-label={`Đổi màu ${col}`}
                  aria-pressed={on}
                  title={col}
                  className="flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-105"
                  style={{ background: col, boxShadow: on ? "0 0 0 2px var(--sf), 0 0 0 4px var(--tx)" : "none" }}
                >
                  {on ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

/* ── Hộp thêm mốc ──────────────────────────────────────────────────────────── */
function NoteModal({
  date, busy, onClose, onSave,
}: {
  date: string;
  busy: boolean;
  onClose: () => void;
  onSave: (date: string, f: NoteInput) => void;
}) {
  const [d, setD] = useState(date);
  const [f, setF] = useState<NoteInput>({ title: "", time: "", note: "", remind: true });
  const empty = !f.title.trim() && !f.note.trim();
  return (
    <Modal
      open
      onClose={onClose}
      icon={CalendarPlus}
      title="Thêm mốc vào lịch"
      desc="Ghi chú cho một ngày: thử váy, trả đồ, bảo trì máy, nghỉ lễ…"
      footer={
        <>
          <button type="button" className={btn("ghost")} onClick={onClose}>Huỷ</button>
          <button type="button" className={btn("primary")} disabled={busy || empty || !d} onClick={() => onSave(d, f)}>
            {busy ? "Đang thêm…" : "Thêm mốc"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Tiêu đề">
          <input className={inputCls} autoFocus placeholder="VD: Khách thử váy cưới" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ngày">
            <input className={inputCls} type="date" value={d} onChange={(e) => setD(e.target.value)} />
          </Field>
          <Field label="Giờ" hint="Để trống = cả ngày">
            <TimeInput className={inputCls} value={f.time} onChange={(v) => setF({ ...f, time: v })} ariaLabel="Giờ" />
          </Field>
        </div>
        <Field label="Nội dung">
          <textarea className={inputCls} rows={3} placeholder="Ghi thêm nếu cần…" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} style={{ height: "auto", paddingTop: 8, paddingBottom: 8 }} />
        </Field>
        <Switch checked={f.remind} onChange={(v) => setF({ ...f, remind: v })} label="Nhắc tôi" desc="Hiện trong mục “Nhắc lịch 30 ngày tới”" />
        <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
          Buổi chụp tự lên lịch khi hợp đồng đã xác nhận và có ngày chụp.{" "}
          <Link href="/dashboard/studio/contracts/new" className="font-semibold" style={{ color: "var(--ac)" }}>Tạo hợp đồng</Link>
        </p>
      </div>
    </Modal>
  );
}

/* ── Nội dung ngăn Google Lịch ─────────────────────────────────────────────── */
function GcalBody({
  gcal, feedUrl, msg, backfilling, onBackfill,
}: {
  gcal: CalendarViewProps["gcal"];
  feedUrl: string;
  msg: string | null;
  backfilling: boolean;
  onBackfill: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-5">
      {gcal && (
        <div className="flex flex-col gap-3">
          {!gcal.connected ? (
            <Callout tone="gray" icon={CalendarDays} title="Chưa kết nối Google Lịch" action={<a href="/dashboard/connections" className={btn("secondary", "sm")}>Kết nối ngay</a>}>
              Kết nối để lịch chụp tự lên Google.
            </Callout>
          ) : gcal.ok ? (
            <Callout tone="green" icon={Check} title="Đã kết nối và đang hoạt động">
              Chỉ hợp đồng ĐÃ XÁC NHẬN/KÝ và có ngày chụp mới được đẩy lên. Lịch tạo TRƯỚC khi kết nối không tự lên — dùng nút bên dưới.
            </Callout>
          ) : (
            <Callout tone="amber" icon={AlertTriangle} title="Có kết nối nhưng gọi Google không được" action={<a href="/dashboard/connections" className={btn("secondary", "sm")}>Kết nối lại</a>}>
              Lịch đang không lên Google. Ngắt rồi kết nối lại.
              {gcal.error && <span className="mt-1 block break-all font-mono text-[11px]" style={{ color: "var(--tx3)" }}>{gcal.error}</span>}
            </Callout>
          )}
          {gcal.ok && (
            <button type="button" onClick={onBackfill} disabled={backfilling} className={btn("secondary", "md", "self-start")}>
              <RefreshCw size={15} className={backfilling ? "animate-spin" : ""} /> {backfilling ? "Đang đẩy…" : "Đồng bộ toàn bộ lịch cũ lên Google"}
            </button>
          )}
          {msg && (
            <p className="break-words rounded-[10px] px-3 py-2 font-mono text-[11.5px]" style={{ background: "var(--sf2)", color: "var(--am)" }}>{msg}</p>
          )}
        </div>
      )}

      {feedUrl && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold">Link đăng ký lịch (tự cập nhật)</p>
          <div className="flex items-center gap-2">
            <input className={inputCls} readOnly value={feedUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Link đăng ký lịch" />
            <button
              type="button"
              className={btn("secondary", "md", "flex-none")}
              onClick={() => {
                navigator.clipboard?.writeText(feedUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Đã chép" : "Chép"}
            </button>
          </div>
          <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
            Google Calendar → Cài đặt → Thêm lịch → <b>Từ URL</b> → dán link trên.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Chế độ NHÂN SỰ: mỗi người một hàng × 7 ngày, kèm tải tuần ─────────────── */
function PeopleV2({ rows, week, todayStr, onShoot }: { rows: PeopleRow[]; week: string[]; todayStr: string; onShoot: (id: string) => void }) {
  if (rows.length === 0) {
    return (
      <Card>
        <Empty icon={Users} title="Tuần này chưa phân công ai" hint="Phân công nhân sự trong hợp đồng để thấy lịch của từng người ở đây." />
      </Card>
    );
  }
  const toneOf = (n: number) => (n >= 4 ? "var(--rd)" : n >= 3 ? "var(--am)" : "var(--gn)");
  const COLS = "minmax(150px,1.3fr) repeat(7, minmax(0,1fr)) 88px";
  return (
    <Card padded={false} className="overflow-hidden">
      {/* Màn rộng: bảng người × ngày */}
      <div className="hidden md:block">
        <div className="grid items-center gap-1.5 px-4 py-2.5" style={{ gridTemplateColumns: COLS, borderBottom: "1px solid var(--bd)" }}>
          <span className="text-[11.5px] font-semibold" style={{ color: "var(--tx3)" }}>Nhân sự</span>
          {week.map((d, i) => (
            <span key={d} className="text-center text-[11.5px] font-semibold" style={{ color: d === todayStr ? "var(--ac)" : "var(--tx3)" }}>
              {WD[i]} {Number(d.slice(8))}
            </span>
          ))}
          <span className="text-right text-[11.5px] font-semibold" style={{ color: "var(--tx3)" }}>Tải tuần</span>
        </div>
        {rows.map((r) => {
          const load = r.days.size;
          return (
            <div key={r.key} className="grid items-center gap-1.5 px-4 py-2" style={{ gridTemplateColumns: COLS, borderBottom: "1px solid var(--bd2)" }}>
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={r.name} size={30} />
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium">{r.name}</span>
                  {r.role && <span className="block truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>{r.role}</span>}
                </span>
              </div>
              {week.map((d) => {
                const jobs = r.days.get(d) ?? [];
                return (
                  <div key={d} className="flex min-h-[38px] min-w-0 flex-col justify-center gap-0.5">
                    {jobs.map((j) => (
                      <button
                        key={j.id}
                        type="button"
                        onClick={() => onShoot(j.id)}
                        title={`${j.title}${j.location ? ` · ${j.location}` : ""}`}
                        className="mx-0.5 truncate rounded-[6px] px-1.5 py-0.5 text-left text-[11px] font-medium hover:brightness-95"
                        style={{ background: soft(j.calendar_color || DEFAULT_MARK, 18), color: "var(--tx)" }}
                      >
                        <span className="tnum font-semibold" style={{ color: "var(--tx2)" }}>{j.event_time || "Cả ngày"}</span>{" "}
                        <span className="hidden min-[1100px]:inline">{j.title}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
              <div className="flex flex-col items-end gap-1">
                <span className="tnum whitespace-nowrap text-[12px] font-semibold" style={{ color: toneOf(load) }}>{load}/7 ngày</span>
                <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--bd2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(load / 7) * 100}%`, background: toneOf(load) }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Điện thoại: mỗi người một dòng, liệt kê ngày có việc */}
      <div className="md:hidden">
        {rows.map((r) => {
          const load = r.days.size;
          const days = week.filter((d) => r.days.has(d));
          return (
            <div key={r.key} className="v2-row">
              <Avatar name={r.name} size={34} />
              <div className="min-w-0 flex-1">
                <p className="v2-row-title">{r.name}</p>
                <p className="v2-row-sub">{days.map((d) => `${fmtDow(d)} ${fmtDayMonth(d)}`).join(" · ")}</p>
              </div>
              <span className="tnum flex-none text-[12px] font-semibold" style={{ color: toneOf(load) }}>{load}/7</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
