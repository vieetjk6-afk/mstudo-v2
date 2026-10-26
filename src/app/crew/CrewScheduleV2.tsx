"use client";

import { useMemo, useState } from "react";
import { CalendarDays, CalendarPlus, ChevronDown, Factory, Lock, Plus, Sun, Trash2, X } from "lucide-react";
import { Badge, Callout, Empty, Field, GroupLabel, Section, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Drawer, Segmented, Switch } from "@/components/v2/kit-client";
import TimeInput from "@/components/TimeInput";
import { addDays } from "@/lib/appointments";
import { fmtDayMonth, todayVN } from "@/lib/date";
import { lunarFull } from "@/lib/lunar";
import { slotLabel } from "@/lib/timesheet";
import { SHIFT_COMPANY_LABEL, SHIFT_LETTERS, shiftBlockFor, shiftBlockLabel, type ShiftLetter } from "@/lib/crew-shift";
import { entryTimeLabel, hhmm, type ScheduleEntry } from "./CrewSchedule";
import type { FreeSlot } from "./CrewFreeSlots";
import { useBusySchedule, useFreeSlotForm, type CrewPortalState } from "./useCrewPortal";

/* ═══════════════════════════════════════════════════════════════════════════
   TAB "LỊCH" của cổng thợ — giao diện mới. Thay lịch tháng của bản cũ bằng:
     • Lịch sắp tới dạng AGENDA (theo ngày): việc studio xếp + giờ tự báo bận,
       báo bận mới mở ngăn kéo;
     • Ngày rảnh: 7–14 ngày tới, mỗi ngày một công tắc "rảnh cả ngày", khai giờ
       cụ thể / ngày xa hơn trong ngăn kéo;
     • Ca công ty: một nút chọn nhóm.
   Thao tác đi qua ĐÚNG các hàm của useCrewPortal (busy_add, busy_remove,
   free_add, free_remove, shift_set) như bản cũ.
   ═══════════════════════════════════════════════════════════════════════════ */

const DOW_LONG = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const utc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const dayName = (iso: string) => DOW_LONG[new Date(utc(iso)).getUTCDay()];

export function dayLabel(iso: string, today: string): string {
  if (iso === today) return `Hôm nay · ${fmtDayMonth(iso)}`;
  if (iso === addDays(today, 1)) return `Ngày mai · ${fmtDayMonth(iso)}`;
  return `${dayName(iso)} · ${fmtDayMonth(iso)}`;
}

/** Nhãn khoảng rảnh, bỏ phần giây của kiểu `time` Postgres ("13:00:00" → "13:00"). */
const freeLabel = (x: FreeSlot) => slotLabel({ date: x.date, start: x.start ? hhmm(x.start) : null, end: x.end ? hhmm(x.end) : null });

const byTime = (a: ScheduleEntry, b: ScheduleEntry) => (a.start_time ?? "").localeCompare(b.start_time ?? "");

function groupByDate(list: ScheduleEntry[], desc = false) {
  const sorted = [...list].sort((a, b) => (desc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)) || byTime(a, b));
  const out: { date: string; rows: ScheduleEntry[] }[] = [];
  for (const e of sorted) {
    const last = out[out.length - 1];
    if (last && last.date === e.date) last.rows.push(e);
    else out.push({ date: e.date, rows: [e] });
  }
  return out;
}

export default function CrewScheduleV2({ s }: { s: CrewPortalState }) {
  const today = todayVN();
  const studios = s.studioOptions;
  const busySched = useBusySchedule(s.schedule, studios);
  const free = useFreeSlotForm(s.freeSlots, studios);
  const [busyOpen, setBusyOpen] = useState(false);
  const [busyDate, setBusyDate] = useState(today);
  const [freeOpen, setFreeOpen] = useState(false);
  const working = s.busy === "sched";

  const pickStudio = (id: string) => {
    busySched.setStudioId(id);
    free.setStudioId(id);
  };
  const studioName = studios.find((x) => x.id === busySched.studioId)?.name ?? "";

  const upcomingDays = useMemo(() => groupByDate(busySched.visible.filter((e) => e.date >= today)), [busySched.visible, today]);
  const pastDays = useMemo(() => groupByDate(busySched.visible.filter((e) => e.date < today), true), [busySched.visible, today]);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {studios.length > 1 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[13px] font-semibold" style={{ color: "var(--tx2)" }}>Báo lịch cho</span>
          <div className="min-w-0 max-w-full">
            <Segmented label="Studio" value={busySched.studioId} onChange={pickStudio} options={studios.map((x) => ({ value: x.id, label: x.name }))} />
          </div>
          <p className="w-full text-[12.5px]" style={{ color: "var(--tx3)" }}>
            Mỗi studio một lịch riêng — nơi này không thấy lịch bạn báo cho nơi kia.
          </p>
        </div>
      ) : null}
      {studios.length === 0 ? (
        <Callout tone="amber" icon={Lock} title="Chưa studio nào nhận bạn vào sổ thợ">
          Nên chưa có lịch để báo. Khi studio duyệt hồ sơ, lịch và ngày rảnh sẽ mở ở đây.
        </Callout>
      ) : null}

      <div className="grid grid-cols-1 gap-5 min-[1000px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] min-[1000px]:items-start">
        {/* ── Lịch sắp tới (agenda) ─────────────────────────────────────── */}
        <Section
          icon={CalendarDays}
          title="Lịch sắp tới"
          desc="Việc studio xếp cho bạn và giờ bạn tự báo bận"
          actions={
            <button
              type="button"
              onClick={() => {
                setBusyDate(today);
                setBusyOpen(true);
              }}
              disabled={!busySched.studioId}
              className={btn("secondary", "sm")}
            >
              <Plus size={15} /> Báo bận
            </button>
          }
          flush
        >
          {upcomingDays.length === 0 ? (
            <Empty compact icon={CalendarDays} title="Chưa có lịch nào từ hôm nay" hint="Ngày không có mốc nào là ngày trống. Bấm “Báo bận” để giữ giờ bạn đã nhận việc nơi khác." />
          ) : (
            <div className="pb-1.5">
              {upcomingDays.map((d) => (
                <AgendaDay key={d.date} date={d.date} rows={d.rows} today={today} shift={s.shiftPlan?.shift ?? null} busy={working} onRemove={s.removeEntry} />
              ))}
            </div>
          )}
          {pastDays.length > 0 ? (
            <details className="group" style={{ borderTop: "1px solid var(--bd2)" }}>
              <summary className="flex cursor-pointer list-none items-center gap-1 px-5 py-3 text-[13px] font-semibold max-sm:px-4" style={{ color: "var(--tx2)" }}>
                Các ngày đã qua ({pastDays.reduce((n, d) => n + d.rows.length, 0)})
                <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="pb-1.5">
                {pastDays.map((d) => (
                  <AgendaDay key={d.date} date={d.date} rows={d.rows} today={today} shift={null} busy={working} onRemove={s.removeEntry} />
                ))}
              </div>
            </details>
          ) : null}
        </Section>

        <div className="flex min-w-0 flex-col gap-5">
          {studios.length > 0 ? (
            <FreeDays slots={s.freeSlots} upcoming={free.upcoming} today={today} busy={working} onAdd={(date) => s.addFree({ studioId: free.studioId, date, start: "", end: "", note: "" })} onRemove={s.removeFree} onMore={() => setFreeOpen(true)} />
          ) : null}
          <ShiftCard shift={s.shiftPlan?.shift ?? null} today={today} busy={working} onShift={s.setShift} />
        </div>
      </div>

      {/* ── Ngăn kéo: báo bận ─────────────────────────────────────────── */}
      <Drawer
        open={busyOpen}
        onClose={() => setBusyOpen(false)}
        title="Báo bận"
        desc={studioName ? `Giữ giờ bạn đã nhận việc nơi khác — báo cho ${studioName}` : "Giữ giờ bạn đã nhận việc nơi khác"}
        width={440}
        footer={
          <button
            type="button"
            disabled={working || !busySched.studioId || !busyDate}
            onClick={async () => {
              await busySched.submitFor(busyDate, s.addEntry);
              setBusyOpen(false);
            }}
            className={btn("primary", "md", "w-full")}
          >
            <Plus size={16} /> {working ? "Đang lưu…" : "Thêm mốc bận"}
          </button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Ngày">
            <input type="date" className={inputCls} value={busyDate} onChange={(e) => setBusyDate(e.target.value)} />
          </Field>
          <Switch checked={busySched.allDay} onChange={busySched.setAllDay} label="Bận cả ngày" />
          {!busySched.allDay ? (
            <Field
              label="Giờ bận"
              hint={busySched.form.end <= busySched.form.start ? "Giờ kết thúc sớm hơn giờ bắt đầu → hiểu là ca đêm, kết thúc vào sáng hôm sau." : undefined}
            >
              <div className="flex items-center gap-2">
                <TimeInput className={inputCls} value={busySched.form.start} onChange={(v) => busySched.setForm((f) => ({ ...f, start: v }))} ariaLabel="Từ giờ" />
                <span style={{ color: "var(--tx3)" }}>→</span>
                <TimeInput className={inputCls} value={busySched.form.end} onChange={(v) => busySched.setForm((f) => ({ ...f, end: v }))} ariaLabel="Đến giờ" />
              </div>
            </Field>
          ) : null}
          <Field label="Nội dung (tuỳ chọn)">
            <input className={inputCls} placeholder="Vd: quay sự kiện cho nơi khác" value={busySched.form.title} onChange={(e) => busySched.setForm((f) => ({ ...f, title: e.target.value }))} />
          </Field>
          {busySched.byDate[busyDate]?.length ? (
            <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
              Ngày này đã có {busySched.byDate[busyDate].length} mốc: {busySched.byDate[busyDate].map(entryTimeLabel).join(", ")}.
            </p>
          ) : null}
        </div>
      </Drawer>

      {/* ── Ngăn kéo: khai rảnh giờ cụ thể / ngày xa ──────────────────── */}
      <Drawer
        open={freeOpen}
        onClose={() => setFreeOpen(false)}
        title="Khai ngày rảnh"
        desc="Ngày bạn chờ việc — studio thấy ngay lúc phân công"
        width={440}
        footer={
          <button
            type="button"
            disabled={working || !free.studioId || !free.date}
            onClick={async () => {
              await s.addFree(free.payload);
              setFreeOpen(false);
            }}
            className={btn("primary", "md", "w-full")}
          >
            <CalendarPlus size={16} /> {working ? "Đang lưu…" : "Khai rảnh ngày này"}
          </button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Ngày">
            <input type="date" className={inputCls} min={today} value={free.date} onChange={(e) => free.setDate(e.target.value)} />
          </Field>
          <Switch checked={free.allDay} onChange={free.setAllDay} label="Rảnh cả ngày" />
          {!free.allDay ? (
            <Field label="Giờ rảnh">
              <div className="flex items-center gap-2">
                <TimeInput className={inputCls} value={free.start} onChange={free.setStart} ariaLabel="Từ giờ" />
                <span style={{ color: "var(--tx3)" }}>→</span>
                <TimeInput className={inputCls} value={free.end} onChange={free.setEnd} ariaLabel="Đến giờ" />
              </div>
            </Field>
          ) : null}
          <Field label="Ghi chú (không bắt buộc)">
            <input className={inputCls} value={free.note} onChange={(e) => free.setNote(e.target.value)} placeholder="Vd: chỉ nhận chụp trong thành phố" />
          </Field>
        </div>
      </Drawer>
    </div>
  );
}

/* ── Một ngày trong agenda ─────────────────────────────────────────────── */
function AgendaDay({
  date, rows, today, shift, busy, onRemove,
}: {
  date: string;
  rows: ScheduleEntry[];
  today: string;
  shift: ShiftLetter | null;
  busy: boolean;
  onRemove: (id: string) => Promise<void>;
}) {
  const block = shift ? shiftBlockFor(date, shift) : null;
  return (
    <div>
      <div className="px-5 pb-1 pt-3.5 max-sm:px-4">
        <GroupLabel count={[lunarFull(date), block ? shiftBlockLabel(block) : null].filter(Boolean).join(" · ")}>
          <span style={date === today ? { color: "var(--ac)" } : undefined}>{dayLabel(date, today)}</span>
        </GroupLabel>
      </div>
      {rows.map((e) => {
        const byStudio = e.created_by === "studio";
        return (
          <div key={e.id} className="v2-row items-start">
            <span className="mt-0.5 w-[3px] flex-none self-stretch rounded-full" style={{ background: byStudio ? "var(--gn)" : "var(--am)" }} />
            <div className="min-w-0 flex-1">
              <p className="v2-num text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>{entryTimeLabel(e)}</p>
              <p className="text-[14px] font-semibold leading-snug" style={{ textWrap: "pretty" }}>
                {e.title || (byStudio ? "Việc studio xếp" : "Bận")}
              </p>
              {e.note ? <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>{e.note}</p> : null}
              <p className="mt-1 flex items-center gap-1 text-[12px] font-medium" style={{ color: byStudio ? "var(--gn)" : "var(--tx3)" }}>
                {byStudio ? (
                  <>
                    <Lock size={12} /> Studio phân việc — chỉ studio gỡ được
                  </>
                ) : (
                  "Bạn tự báo bận"
                )}
              </p>
            </div>
            {/* Mốc studio xếp hộ thì thợ không gỡ được — API cũng chặn. */}
            {!byStudio ? (
              <button type="button" onClick={() => onRemove(e.id)} disabled={busy} className={iconBtn()} aria-label="Xoá mốc lịch" title="Xoá mốc lịch">
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ── Ngày rảnh: công tắc từng ngày ─────────────────────────────────────── */
function FreeDays({
  slots, upcoming, today, busy, onAdd, onRemove, onMore,
}: {
  slots: FreeSlot[];
  upcoming: FreeSlot[];
  today: string;
  busy: boolean;
  onAdd: (date: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onMore: () => void;
}) {
  const [span, setSpan] = useState<7 | 14>(7);
  const days = Array.from({ length: span }, (_, i) => addDays(today, i));
  const last = days[days.length - 1];
  const later = upcoming.filter((x) => x.date > last);
  const freeCount = days.filter((d) => slots.some((x) => x.date === d)).length;

  async function toggle(date: string, on: boolean) {
    if (on) await onAdd(date);
    else for (const x of slots.filter((y) => y.date === date)) await onRemove(x.id);
  }

  return (
    <Section
      icon={Sun}
      title="Ngày rảnh"
      desc={freeCount > 0 ? `Bạn chờ việc ${freeCount}/${span} ngày tới` : "Bật những ngày bạn chờ việc — khác với báo bận"}
      actions={
        <button type="button" onClick={onMore} className={btn("ghost", "sm")}>
          <CalendarPlus size={15} /> Giờ cụ thể
        </button>
      }
      flush
    >
      <div className="px-5 pb-2 pt-1 max-sm:px-4">
        {days.map((d) => {
          const mine = slots.filter((x) => x.date === d);
          return (
            <div key={d} style={{ borderBottom: "1px solid var(--bd2)" }}>
              <Switch
                checked={mine.length > 0}
                onChange={(v) => toggle(d, v)}
                disabled={busy}
                label={<span style={d === today ? { color: "var(--ac)" } : undefined}>{dayLabel(d, today)}</span>}
                desc={mine.length > 0 ? mine.map((x) => [freeLabel(x), x.note].filter(Boolean).join(" · ")).join(" · ") : "Chưa khai"}
              />
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-2 pt-2.5">
          {span === 7 ? (
            <button type="button" onClick={() => setSpan(14)} className={btn("ghost", "sm")}>
              <ChevronDown size={15} /> Thêm 7 ngày
            </button>
          ) : null}
        </div>
        {later.length > 0 ? (
          <div className="pt-2">
            <GroupLabel count={later.length}>Ngày xa hơn đã khai</GroupLabel>
            <div className="mt-1.5 flex flex-col">
              {later.map((x) => (
                <div key={x.id} className="flex items-center gap-2 py-2 text-[13px]" style={{ borderTop: "1px solid var(--bd2)" }}>
                  <span className="v2-num font-semibold">{x.date.split("-").reverse().join("/")}</span>
                  <Badge tone="green">{freeLabel(x)}</Badge>
                  {x.note ? <span className="min-w-0 truncate" style={{ color: "var(--tx3)" }}>{x.note}</span> : null}
                  <button type="button" onClick={() => onRemove(x.id)} disabled={busy} className={iconBtn("ml-auto")} aria-label="Bỏ khoảng rảnh này" title="Bỏ khoảng rảnh này">
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

/* ── Ca công ty ─────────────────────────────────────────────────────────── */
function ShiftCard({
  shift, today, busy, onShift,
}: {
  shift: ShiftLetter | null;
  today: string;
  busy: boolean;
  onShift: (s: ShiftLetter | "") => Promise<void>;
}) {
  const block = shift ? shiftBlockFor(today, shift) : null;
  return (
    <Section icon={Factory} title="Ca công ty (tuỳ chọn)" desc={`Đang làm ca ở ${SHIFT_COMPANY_LABEL.hoa_phat}? Chọn ca để studio thấy sẵn giờ bận.`}>
      <div className="flex flex-col gap-3">
        <div className="max-w-full">
          <Segmented<ShiftLetter | "">
            label="Ca công ty"
            value={shift ?? ""}
            onChange={(v) => {
              if (!busy) onShift(v);
            }}
            options={[{ value: "", label: "Không" }, ...SHIFT_LETTERS.map((x) => ({ value: x, label: `Ca ${x}` }))]}
          />
        </div>
        {shift ? (
          <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
            {block ? (
              <>
                Hôm nay: <b>Ca {block.shift}</b> · {block.start}–{block.end}
                {block.overnight ? " hôm sau" : ""}
              </>
            ) : (
              "Hôm nay bạn không có ca."
            )}
          </p>
        ) : null}
      </div>
    </Section>
  );
}
