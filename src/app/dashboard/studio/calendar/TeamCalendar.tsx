"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock, Plus, Trash2, Lock, ChevronDown, Search, X } from "lucide-react";
import { CREW_ROLE_LABEL, CREW_STATUS_LABEL, type CrewRole, type CrewStatus } from "@/lib/types";
import { lunarCellLabel } from "@/lib/lunar";
import { todayVN } from "@/lib/date";
import TimeInput from "@/components/TimeInput";
import { SHIFT_COMPANY_LABEL, shiftBlockFor, type ShiftLetter } from "@/lib/crew-shift";

export type TeamAssignment = {
  name: string;
  phone: string | null;
  role: CrewRole;
  status: CrewStatus;
  date: string; // YYYY-MM-DD
  contractId: string;
  contractTitle: string;
};

export type CrewMember = { phone: string; name: string; role: CrewRole };

export type CrewScheduleRow = {
  id: string;
  phone: string;
  date: string;
  note: string | null;
  start_time: string | null;
  end_time: string | null;
  overnight: boolean;
  title: string | null;
  /** Có giá trị ⇒ studio xếp hộ (chỉ studio gỡ được). */
  owner_id: string | null;
};

const WD = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTHS = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
const STATUS_TONE: Record<CrewStatus, string> = { pending: "var(--text3)", accepted: "var(--s-green)", declined: "var(--s-red)" };

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const hhmm = (t: string | null) => (t ?? "").slice(0, 5);

function timeLabel(r: CrewScheduleRow): string {
  if (!r.start_time || !r.end_time) return "Cả ngày";
  return `${hhmm(r.start_time)}–${hhmm(r.end_time)}${r.overnight ? " (+1)" : ""}`;
}

export default function TeamCalendar({
  assignments,
  members,
  schedule,
  shifts,
}: {
  assignments: TeamAssignment[];
  members: CrewMember[];
  schedule: CrewScheduleRow[];
  shifts: Record<string, ShiftLetter>;
}) {
  const router = useRouter();
  const todayStr = todayVN();
  const [y, mIdx] = todayStr.split("-").map(Number);
  const [cursor, setCursor] = useState({ year: y, month: mIdx - 1 });
  const [selected, setSelected] = useState<string>(todayStr);
  // "" = cả đội. Lọc theo một thợ để xem riêng lịch của người đó.
  const [who, setWho] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ phone: "", start: "08:00", end: "17:00", title: "", allDay: false });
  const [pickOpen, setPickOpen] = useState(false);
  const [q, setQ] = useState("");
  const [showShift, setShowShift] = useState(false);
  const pickRef = useRef<HTMLDivElement>(null);

  // Bấm ra ngoài thì đóng menu chọn thợ.
  useEffect(() => {
    if (!pickOpen) return;
    function onDown(e: MouseEvent) {
      if (pickRef.current && !pickRef.current.contains(e.target as Node)) setPickOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickOpen]);

  const nameOf = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of members) m[c.phone] = c.name;
    return m;
  }, [members]);

  const filteredMembers = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    // Tìm theo cả tên lẫn SĐT — studio nhớ số nhanh hơn nhớ tên là chuyện thường.
    return members.filter((m) => m.name.toLowerCase().includes(needle) || m.phone.includes(needle.replace(/\D/g, "")));
  }, [members, q]);

  const visibleSchedule = useMemo(
    () => (who ? schedule.filter((r) => r.phone === who) : schedule),
    [schedule, who],
  );
  const visibleAssignments = useMemo(
    () => (who ? assignments.filter((a) => (a.phone ?? "").replace(/\D/g, "") === who) : assignments),
    [assignments, who],
  );
  // Ca công ty CHỈ hiện khi đang xem một thợ cụ thể và studio bật lên. Ở chế độ
  // cả đội thì lịch chỉ còn việc của studio — ca nhà máy của chục người chồng
  // lên nhau làm lịch không đọc nổi, mà cũng không phải việc studio xếp.
  const visibleShifts = useMemo(
    () => (who && showShift && shifts[who] ? { [who]: shifts[who] } : {}),
    [shifts, who, showShift],
  );

  const byDateAssign = useMemo(() => {
    const map: Record<string, TeamAssignment[]> = {};
    for (const a of visibleAssignments) (map[a.date] ||= []).push(a);
    return map;
  }, [visibleAssignments]);

  const byDateSched = useMemo(() => {
    const map: Record<string, CrewScheduleRow[]> = {};
    for (const r of visibleSchedule) (map[r.date] ||= []).push(r);
    return map;
  }, [visibleSchedule]);

  /** Ca công ty của những thợ đang hiển thị, cho một ngày cụ thể. */
  function shiftsOn(dateStr: string) {
    const out: { phone: string; name: string; label: string }[] = [];
    for (const [phone, letter] of Object.entries(visibleShifts)) {
      const b = shiftBlockFor(dateStr, letter);
      if (b) out.push({ phone, name: nameOf[phone] || phone, label: `Ca ${b.shift} ${b.start}–${b.end}${b.overnight ? " (+1)" : ""}` });
    }
    return out;
  }

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

  async function addForCrew() {
    const phone = form.phone || who;
    if (!phone) return;
    setBusy(true);
    const res = await fetch("/api/studio/crew-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        date: selected,
        start: form.allDay ? "" : form.start,
        end: form.allDay ? "" : form.end,
        title: form.title,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setForm((f) => ({ ...f, title: "" }));
      router.refresh();
    }
  }

  async function removeEntry(r: CrewScheduleRow) {
    setBusy(true);
    await fetch("/api/studio/crew-schedule", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: r.phone, id: r.id }),
    });
    setBusy(false);
    router.refresh();
  }

  const selAssign = byDateAssign[selected] ?? [];
  const selSched = byDateSched[selected] ?? [];
  const selShifts = shiftsOn(selected);

  return (
    <div className="page-in">
      <div className="mb-4">
        <h1 className="font-serif text-2xl font-medium">Lịch đội ngũ</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text2)" }}>
          Ai làm gì ngày nào — toàn đội trong một màn hình. Ngày không có mốc nào là ngày trống.
        </p>
      </div>

      {/* Lọc theo thợ — dạng menu đổ xuống có ô tìm kiếm. Đội đông thì một hàng
          chip sẽ tràn kín màn hình và không tìm nổi ai. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative" ref={pickRef}>
          <button onClick={() => setPickOpen((o) => !o)} className="btn-ghost px-3 py-1.5 text-xs">
            {who ? nameOf[who] || who : "Cả đội"}
            {who && shifts[who] ? ` · ca ${shifts[who]}` : ""}
            <ChevronDown size={14} />
          </button>

          {pickOpen && (
            <div
              className="absolute left-0 z-30 mt-1 w-64 rounded-xl p-2 shadow-xl"
              style={{ background: "var(--bg2)", border: "1px solid var(--border2)" }}
            >
              <div className="mb-2 flex items-center gap-2 rounded-lg px-2" style={{ background: "var(--surface2)" }}>
                <Search size={13} style={{ color: "var(--text3)" }} />
                <input
                  autoFocus
                  className="w-full bg-transparent py-1.5 text-xs outline-none"
                  placeholder="Tìm thợ theo tên hoặc SĐT…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q && (
                  <button onClick={() => setQ("")} aria-label="Xoá tìm kiếm" style={{ color: "var(--text3)" }}>
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto">
                <button
                  onClick={() => { setWho(""); setShowShift(false); setPickOpen(false); }}
                  className="block w-full rounded-lg px-2 py-1.5 text-left text-xs"
                  style={{ background: who ? "transparent" : "var(--surface2)" }}
                >
                  Cả đội <span style={{ color: "var(--text3)" }}>({members.length})</span>
                </button>
                {filteredMembers.map((m) => (
                  <button
                    key={m.phone}
                    onClick={() => { setWho(m.phone); setShowShift(false); setPickOpen(false); }}
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-xs"
                    style={{ background: who === m.phone ? "var(--surface2)" : "transparent" }}
                  >
                    <span className="block truncate">{m.name}</span>
                    <span className="block text-[10px]" style={{ color: "var(--text3)" }}>
                      {m.phone}
                      {shifts[m.phone] ? ` · ca ${shifts[m.phone]}` : ""}
                    </span>
                  </button>
                ))}
                {filteredMembers.length === 0 && (
                  <p className="px-2 py-3 text-center text-[11px]" style={{ color: "var(--text3)" }}>Không tìm thấy thợ nào.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {who && (
          <button onClick={() => setWho("")} className="btn-ghost px-2.5 py-1.5 text-xs" title="Xem lại cả đội">
            <X size={13} /> Bỏ lọc
          </button>
        )}

        {who && shifts[who] && (
          <button
            onClick={() => setShowShift((v) => !v)}
            className={showShift ? "btn-primary px-3 py-1.5 text-xs" : "btn-ghost px-3 py-1.5 text-xs"}
            title={`Ca ${shifts[who]} tại ${SHIFT_COMPANY_LABEL.hoa_phat}`}
          >
            {showShift ? "Đang hiện" : "Hiện"} ca công ty ({shifts[who]})
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-lg font-medium">{MONTHS[cursor.month]} {cursor.year}</h2>
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
              const a = byDateAssign[dateStr] ?? [];
              const sch = byDateSched[dateStr] ?? [];
              const sh = shiftsOn(dateStr);
              const isToday = dateStr === todayStr;
              const isSel = dateStr === selected;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(dateStr)}
                  className="flex min-h-[70px] flex-col rounded-lg p-1.5 text-left text-sm transition-colors"
                  style={{ background: isSel ? "var(--surface2)" : "transparent", border: isToday ? "1px solid var(--border2)" : "1px solid transparent" }}
                >
                  <span className="flex items-baseline gap-1">
                    <span style={{ color: isToday ? "var(--accent)" : "var(--text)" }}>{d}</span>
                    <span className="text-[9px] leading-none" style={{ color: "var(--text3)" }}>{lunarCellLabel(dateStr)}</span>
                  </span>
                  <span className="mt-0.5 space-y-0.5">
                    {a.slice(0, 2).map((x, k) => (
                      <span key={k} className="block truncate text-[10px]" style={{ color: STATUS_TONE[x.status] }}>{x.name}</span>
                    ))}
                    {a.length > 2 && <span className="block text-[10px]" style={{ color: "var(--text3)" }}>+{a.length - 2}</span>}
                    {sch.slice(0, 2).map((r) => (
                      <span key={r.id} className="block truncate text-[10px]" style={{ color: "var(--s-amber)" }}>
                        {nameOf[r.phone] || r.phone} {r.start_time ? hhmm(r.start_time) : ""}
                      </span>
                    ))}
                    {sch.length > 2 && <span className="block text-[10px]" style={{ color: "var(--s-amber)" }}>+{sch.length - 2}</span>}
                    {sh.slice(0, 2).map((s) => (
                      <span key={s.phone} className="block truncate text-[10px]" style={{ color: "var(--s-blue)" }}>
                        {s.name} {s.label.replace("Ca ", "")}
                      </span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-[11px]" style={{ color: "var(--text3)" }}>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--s-green)" }} /> Đã nhận</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--text3)" }} /> Chờ phản hồi</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--s-amber)" }} /> Thợ báo lịch</span>
            {who && showShift && shifts[who] && (
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--s-blue)" }} /> Ca {SHIFT_COMPANY_LABEL.hoa_phat}</span>
            )}
          </div>
        </div>

        {/* Chi tiết ngày */}
        <div className="card p-5">
          <h2 className="mb-3 font-serif text-lg font-medium">{selected}</h2>

          {selAssign.length === 0 && selSched.length === 0 && selShifts.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text3)" }}>Ngày trống — chưa ai báo lịch.</p>
          ) : (
            <div className="space-y-3">
              {selAssign.map((a, k) => (
                <Link key={k} href={`/dashboard/studio/contracts/${a.contractId}`} className="block rounded-xl px-3 py-2.5" style={{ background: "var(--surface2)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{a.name}</span>
                    <span className="text-[11px]" style={{ color: STATUS_TONE[a.status] }}>{CREW_STATUS_LABEL[a.status]}</span>
                  </div>
                  <p className="text-[11px]" style={{ color: "var(--text3)" }}>{CREW_ROLE_LABEL[a.role]} · {a.contractTitle}</p>
                </Link>
              ))}

              {selShifts.map((s) => (
                <div key={s.phone} className="rounded-xl px-3 py-2.5" style={{ background: "var(--surface2)" }}>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-[11px]" style={{ color: "var(--s-blue)" }}>{SHIFT_COMPANY_LABEL.hoa_phat} · {s.label}</p>
                </div>
              ))}

              {selSched.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-2 rounded-xl px-3 py-2.5" style={{ background: "var(--surface2)" }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{nameOf[r.phone] || r.phone}</p>
                    <p className="flex items-center gap-1 text-[11px]" style={{ color: "var(--s-amber)" }}>
                      <Clock size={11} /> {timeLabel(r)}{r.title ? ` · ${r.title}` : ""}
                    </p>
                    {r.owner_id && (
                      <p className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text3)" }}>
                        <Lock size={10} /> studio xếp
                      </p>
                    )}
                  </div>
                  {/* Chỉ gỡ được mốc do studio xếp; mốc thợ tự thêm là của thợ. */}
                  {r.owner_id && (
                    <button onClick={() => removeEntry(r)} disabled={busy} aria-label="Gỡ mốc lịch" title="Gỡ mốc lịch" className="shrink-0 rounded-md p-1.5" style={{ color: "var(--text3)" }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Studio xếp lịch hộ thợ */}
          {members.length > 0 && (
            <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <p className="mb-2 text-[13px] font-medium">Thêm lịch cho thợ</p>
              <div className="space-y-2">
                <select className="input" value={form.phone || who} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} aria-label="Chọn thợ">
                  <option value="">— Chọn thợ —</option>
                  {members.map((m) => (
                    <option key={m.phone} value={m.phone}>{m.name}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={form.allDay} onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))} />
                  Bận cả ngày
                </label>
                {!form.allDay && (
                  <div className="flex items-center gap-2">
                    <TimeInput className="input w-auto" value={form.start} onChange={(v) => setForm((f) => ({ ...f, start: v }))} ariaLabel="Từ giờ" />
                    <span className="text-sm" style={{ color: "var(--text3)" }}>→</span>
                    <TimeInput className="input w-auto" value={form.end} onChange={(v) => setForm((f) => ({ ...f, end: v }))} ariaLabel="Đến giờ" />
                  </div>
                )}
                <input className="input" placeholder="Nội dung (tuỳ chọn)" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                <button onClick={addForCrew} disabled={busy || !(form.phone || who)} className="btn-primary w-full">
                  <Plus size={15} /> Thêm vào {selected}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
