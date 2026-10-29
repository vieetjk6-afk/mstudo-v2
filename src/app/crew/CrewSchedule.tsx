"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Lock } from "lucide-react";
import { todayVN } from "@/lib/date";
import TimeInput from "@/components/TimeInput";
import { lunarCellLabel } from "@/lib/lunar";
import { SHIFT_LETTERS, SHIFT_COMPANY_LABEL, shiftBlockFor, type ShiftLetter } from "@/lib/crew-shift";
import { useBusySchedule } from "./useCrewPortal";

export type ScheduleEntry = {
  id: string;
  date: string;
  note: string | null;
  start_time: string | null;
  end_time: string | null;
  overnight: boolean;
  title: string | null;
  /** Mốc này báo cho studio nào — lịch bận tách riêng theo từng studio. */
  owner_id: string | null;
  /** "studio" ⇒ studio xếp, thợ không tự gỡ được. */
  created_by?: string | null;
};

export type StudioOption = { id: string; name: string };

export type ShiftPlan = { company: string; shift: ShiftLetter } | null;

const WD = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTHS = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "08:00:00" (kiểu time của Postgres) → "08:00". */
export function hhmm(t: string | null): string {
  return (t ?? "").slice(0, 5);
}

/** Nhãn khoảng thời gian của một mốc lịch; không có giờ ⇒ cả ngày. */
export function entryTimeLabel(e: ScheduleEntry): string {
  if (!e.start_time || !e.end_time) return "Cả ngày";
  return `${hhmm(e.start_time)}–${hhmm(e.end_time)}${e.overnight ? " (+1)" : ""}`;
}

/**
 * Lịch của thợ: xem tháng, bấm một ngày để thêm mốc "đã nhận việc từ mấy giờ
 * đến mấy giờ". Ngày không có mốc nào = ngày trống.
 */
export default function CrewSchedule({
  entries,
  studios,
  shiftPlan,
  busy,
  onAdd,
  onRemove,
  onShift,
}: {
  entries: ScheduleEntry[];
  /** Các studio đã nhận thợ này vào sổ. */
  studios: StudioOption[];
  shiftPlan: ShiftPlan;
  busy: boolean;
  onAdd: (v: { date: string; start: string; end: string; title: string; studioId: string }) => Promise<unknown>;
  onRemove: (id: string) => Promise<unknown>;
  onShift: (shift: ShiftLetter | "") => Promise<unknown>;
}) {
  const todayStr = todayVN();
  const [y, mIdx] = todayStr.split("-").map(Number);
  const [cursor, setCursor] = useState({ year: y, month: mIdx - 1 });
  const [selected, setSelected] = useState<string>(todayStr);
  // Lịch bận tách riêng theo studio + ô nhập mốc bận: logic chung với giao diện
  // mới, xem ./useCrewPortal.
  const { studioId, setStudioId, form, setForm, allDay, setAllDay, byDate, submitFor } = useBusySchedule(entries, studios);

  const grid = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const startWd = (first.getDay() + 6) % 7;
    const days = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startWd; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  function move(delta: number) {
    setCursor((c) => {
      const m = c.month + delta;
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }

  const selEntries = byDate[selected] ?? [];
  const selShift = shiftPlan ? shiftBlockFor(selected, shiftPlan.shift) : null;

  async function submit() {
    await submitFor(selected, onAdd);
  }

  return (
    <div className="card p-5">
      <h2 className="mb-1 font-serif text-lg font-medium">Lịch của tôi</h2>
      <p className="mb-3 text-xs" style={{ color: "var(--text3)" }}>
        Bấm vào một ngày rồi thêm giờ bạn đã nhận việc. Ngày không có mốc nào là ngày trống.
      </p>

      {studios.length === 0 ? (
        <p className="mb-4 rounded-xl px-3 py-2 text-xs" style={{ background: "var(--surface2)", color: "var(--text3)" }}>
          Chưa studio nào nhận bạn vào sổ thợ, nên chưa có lịch để báo.
        </p>
      ) : (
        <div className="mb-4">
          <p className="mb-1.5 text-[11px]" style={{ color: "var(--text3)" }}>
            Báo lịch cho studio nào? Mỗi studio một lịch riêng — nơi này không thấy lịch bạn báo cho nơi kia.
          </p>
          <div className="flex flex-wrap gap-2">
            {studios.map((st) => (
              <button
                key={st.id}
                onClick={() => setStudioId(st.id)}
                className={studioId === st.id ? "btn-primary px-3 py-1.5 text-xs" : "btn-ghost px-3 py-1.5 text-xs"}
              >
                {st.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ca công ty (freelancer làm ca ở nhà máy) */}
      <div className="mb-4 rounded-xl p-3" style={{ background: "var(--surface2)" }}>
        <p className="text-[13px] font-medium">Ca công ty (tuỳ chọn)</p>
        <p className="mb-2 text-[11px]" style={{ color: "var(--text3)" }}>
          Đang làm ca ở {SHIFT_COMPANY_LABEL.hoa_phat}? Chọn ca của bạn để studio thấy sẵn giờ bận trên lịch.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onShift("")}
            disabled={busy}
            className={shiftPlan ? "btn-ghost px-3 py-1.5 text-xs" : "btn-primary px-3 py-1.5 text-xs"}
          >
            Không
          </button>
          {SHIFT_LETTERS.map((s) => (
            <button
              key={s}
              onClick={() => onShift(s)}
              disabled={busy}
              className={shiftPlan?.shift === s ? "btn-primary px-3 py-1.5 text-xs" : "btn-ghost px-3 py-1.5 text-xs"}
            >
              Ca {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-base font-medium">{MONTHS[cursor.month]} {cursor.year}</h3>
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
          const list = byDate[dateStr] ?? [];
          const shiftBlock = shiftPlan ? shiftBlockFor(dateStr, shiftPlan.shift) : null;
          const isToday = dateStr === todayStr;
          const isSel = dateStr === selected;
          return (
            <button
              key={i}
              onClick={() => setSelected(dateStr)}
              className="flex min-h-[58px] flex-col rounded-lg p-1.5 text-left text-sm transition-colors"
              style={{
                background: isSel ? "var(--surface2)" : "transparent",
                border: isToday ? "1px solid var(--border2)" : "1px solid transparent",
              }}
            >
              <span className="flex items-baseline gap-1">
                <span style={{ color: isToday ? "var(--accent)" : "var(--text)" }}>{d}</span>
                <span className="text-[9px] leading-none" style={{ color: "var(--text3)" }}>{lunarCellLabel(dateStr)}</span>
              </span>
              {shiftBlock && (
                <span className="mt-0.5 block truncate text-[9px]" style={{ color: "var(--s-blue)" }}>
                  {shiftBlock.shift} {shiftBlock.start}
                </span>
              )}
              {list.slice(0, 2).map((e) => (
                // Việc studio phân được tô đậm + chấm dẫn: đó là thứ thợ cần
                // thấy ngay, khác hẳn mốc bận do chính mình ghi.
                <span
                  key={e.id}
                  className="block truncate text-[9px]"
                  style={
                    e.created_by === "studio"
                      ? { color: "var(--s-green)", fontWeight: 600 }
                      : { color: "var(--s-amber)" }
                  }
                >
                  {e.created_by === "studio" ? "● " : ""}
                  {e.start_time ? hhmm(e.start_time) : "cả ngày"}
                </span>
              ))}
              {list.length > 2 && (
                <span className="block text-[9px]" style={{ color: "var(--text3)" }}>+{list.length - 2}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Chi tiết ngày đang chọn + thêm mốc */}
      <div className="mt-3 flex flex-wrap gap-4 text-[11px]" style={{ color: "var(--text3)" }}>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--s-green)" }} /> Studio phân việc</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--s-amber)" }} /> Bạn tự báo bận</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--s-blue)" }} /> Ca công ty</span>
      </div>

      <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
        <p className="mb-2 text-[13px] font-medium">{selected}</p>

        {selShift && (
          <p className="mb-2 rounded-xl px-3 py-2 text-xs" style={{ background: "var(--surface2)", color: "var(--text2)" }}>
            Ca {selShift.shift} · {selShift.start}–{selShift.end}{selShift.overnight ? " hôm sau" : ""}
          </p>
        )}

        {selEntries.length > 0 && (
          <ul className="mb-3 space-y-2">
            {selEntries.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-sm"
                style={
                  e.created_by === "studio"
                    ? { background: "var(--s-greenS, var(--surface2))", borderLeft: "3px solid var(--s-green)" }
                    : { background: "var(--surface2)" }
                }
              >
                <span className="min-w-0">
                  {e.created_by === "studio" && (
                    <span className="block text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--s-green)" }}>
                      Studio phân việc
                    </span>
                  )}
                  <span className="block truncate">{entryTimeLabel(e)}{e.title ? ` · ${e.title}` : ""}</span>
                  {e.created_by === "studio" && (
                    <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text3)" }}>
                      <Lock size={10} /> studio xếp
                    </span>
                  )}
                </span>
                {/* Mốc studio xếp hộ thì thợ không gỡ được — API cũng chặn, nút
                    này chỉ để khỏi bấm nhầm. */}
                {e.created_by !== "studio" && (
                  <button onClick={() => onRemove(e.id)} aria-label="Xoá mốc lịch" title="Xoá mốc lịch" className="shrink-0 rounded-md p-1.5" style={{ color: "var(--text3)" }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <label className="mb-2 flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          Bận cả ngày
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {!allDay && (
            <>
              <TimeInput className="input w-auto" value={form.start} onChange={(v) => setForm((f) => ({ ...f, start: v }))} ariaLabel="Từ giờ" />
              <span className="text-sm" style={{ color: "var(--text3)" }}>→</span>
              <TimeInput className="input w-auto" value={form.end} onChange={(v) => setForm((f) => ({ ...f, end: v }))} ariaLabel="Đến giờ" />
            </>
          )}
          <input className="input flex-1" placeholder="Nội dung (tuỳ chọn)" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <button onClick={submit} disabled={busy || !studioId} className="btn-primary shrink-0">
            <Plus size={15} /> Thêm
          </button>
        </div>
        {!allDay && form.end <= form.start && (
          <p className="mt-2 text-[11px]" style={{ color: "var(--text3)" }}>
            Giờ kết thúc sớm hơn giờ bắt đầu → hiểu là ca đêm, kết thúc vào sáng hôm sau.
          </p>
        )}
      </div>
    </div>
  );
}
