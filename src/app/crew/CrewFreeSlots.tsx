"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, X, Sun } from "lucide-react";
import { todayVN } from "@/lib/date";
import { slotLabel, type Slot } from "@/lib/timesheet";

/* ═══════════════════════════════════════════════════════════════════════════
   KHOẢNG RẢNH THỢ TỰ ĐĂNG KÝ — ngược của "báo bận".

   Vì sao cần cả hai chiều. Báo bận trả lời "ngày này tôi KHÔNG nhận việc". Khai
   rảnh trả lời "ngày này tôi CHỜ VIỆC" — và đó mới là thứ studio cần lúc phân
   công. Không có nó, màn phân công chỉ biết ai đã báo bận, còn im lặng thì
   không phân biệt được người rảnh với người quên khai.

   Nên luật đọc (@/lib/timesheet, availabilityOn) có ba trạng thái chứ không hai:
   bận · rảnh · CHƯA RÕ. Và "chưa khai gì" là "chưa rõ", không phải "rảnh".

   Cố ý làm thẻ GỌN chứ không thêm một lịch tháng thứ hai: thợ đã có lịch tháng
   để báo bận; dựng thêm một cái nữa cạnh nó chỉ làm cổng thợ rối lên.
   ═══════════════════════════════════════════════════════════════════════════ */

export type FreeSlot = Slot & { id: string; note: string | null };

export default function CrewFreeSlots({
  slots,
  studios,
  busy,
  onAdd,
  onRemove,
}: {
  slots: FreeSlot[];
  /** Studio đã nhận thợ này vào sổ. */
  studios: { id: string; name: string }[];
  busy: boolean;
  onAdd: (v: { studioId: string; date: string; start: string; end: string; note: string }) => void;
  onRemove: (id: string) => void;
}) {
  const [studioId, setStudioId] = useState(studios[0]?.id ?? "");
  const [date, setDate] = useState(todayVN());
  const [allDay, setAllDay] = useState(true);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("17:00");
  const [note, setNote] = useState("");

  // Chỉ hiện khoảng từ HÔM NAY trở đi: khai rảnh của tuần trước không giúp ai
  // phân công, mà để đó thì danh sách dài dần rồi thợ ngưng đọc.
  const upcoming = useMemo(() => {
    const t = todayVN();
    return slots.filter((s) => s.date >= t).sort((a, b) => a.date.localeCompare(b.date));
  }, [slots]);

  if (studios.length === 0) return null;

  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 font-serif text-lg font-medium">
        <Sun size={18} style={{ color: "var(--gold)" }} /> Khoảng rảnh của tôi
      </h2>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text3)" }}>
        Khai những ngày bạn <b>chờ việc</b> để studio thấy ngay lúc phân công. Khác với “báo bận” ở lịch bên
        dưới — cái đó là ngày bạn <b>không</b> nhận việc.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {studios.length > 1 && (
          <select className="input" value={studioId} onChange={(e) => setStudioId(e.target.value)}>
            {studios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" className="input w-auto flex-1" min={todayVN()} value={date} onChange={(e) => setDate(e.target.value)} />
          <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px]" style={{ color: "var(--text2)" }}>
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            Cả ngày
          </label>
        </div>
        {!allDay && (
          <div className="flex items-center gap-2">
            <input type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
            <span style={{ color: "var(--text3)" }}>→</span>
            <input type="time" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        )}
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú (không bắt buộc)" />
        <button
          onClick={() => onAdd({ studioId, date, start: allDay ? "" : start, end: allDay ? "" : end, note })}
          disabled={busy || !studioId || !date}
          className="btn-primary w-full"
        >
          <CalendarPlus size={15} /> {busy ? "Đang lưu…" : "Khai rảnh ngày này"}
        </button>
      </div>

      {upcoming.length > 0 && (
        <div className="mt-4 flex flex-col">
          {upcoming.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-2 py-2 text-[12.5px]"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <span className="tnum font-semibold">{s.date.split("-").reverse().join("/")}</span>
              <span style={{ color: "var(--text2)" }}>{slotLabel(s)}</span>
              {s.note && <span className="truncate" style={{ color: "var(--text3)" }}>· {s.note}</span>}
              <button
                onClick={() => onRemove(s.id)}
                disabled={busy}
                aria-label="Bỏ khoảng rảnh này"
                className="ml-auto flex h-6 w-6 flex-none items-center justify-center rounded-full"
                style={{ background: "var(--surface2)", color: "var(--text3)" }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
