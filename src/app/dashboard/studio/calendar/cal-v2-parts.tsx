"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CalendarRange, ChevronLeft, ChevronRight, UsersRound, type LucideIcon } from "lucide-react";
import { Card, btn, iconBtn } from "@/components/v2/kit";
import { Tabs } from "@/components/v2/kit-client";
import { fmtDayMonth, fmtDow } from "@/lib/date";
import { lunarCellLabel, lunarFull } from "@/lib/lunar";
import { tabHref, type CalendarTab } from "./tabs";
import { WD, hourOf, monthGrid, shiftYmd, ymd } from "./shoot-calendar";

/* ═══════════════════════════════════════════════════════════════════════════
   KHỐI DÙNG CHUNG cho ba tab của màn Lịch làm việc ở GIAO DIỆN MỚI.

   Mỗi tab (Buổi chụp · Lịch studio · Đội ngũ) đổi dữ liệu của mình thành một
   danh sách `CalItem` rồi giao cho cùng một bộ lưới: lịch tháng, lưới giờ của
   tuần, danh sách theo ngày. Nhờ vậy ba tab nhìn và bấm giống hệt nhau — khác
   nhau chỉ ở màu (theo loại lịch) và ở ngăn chi tiết.
   ═══════════════════════════════════════════════════════════════════════════ */

export type CalItem = {
  key: string;
  date: string;
  /** Giờ bắt đầu "HH:MM" — null = cả ngày / chưa đặt giờ. */
  time: string | null;
  end?: string | null;
  title: string;
  /** Dòng phụ (khách · địa điểm…) — hiện ở lưới tuần và danh sách. */
  sub?: string;
  /** Màu nhận diện (vạch, chấm) và nền nhạt của chip. */
  color: string;
  icon?: LucideIcon;
  /** Đã xong / mờ đi. */
  dim?: boolean;
  /** Có vấn đề (trùng lịch, chưa phân công) — viền đỏ/cam mảnh. */
  alert?: "red" | "amber";
  /** Phần bên phải ở chế độ danh sách (nhãn trạng thái, ê-kíp…). */
  meta?: React.ReactNode;
  onOpen: () => void;
};

export const soft = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, var(--sf))`;

const DOW_LONG: Record<string, string> = { T2: "Thứ Hai", T3: "Thứ Ba", T4: "Thứ Tư", T5: "Thứ Năm", T6: "Thứ Sáu", T7: "Thứ Bảy", CN: "Chủ nhật" };

/** "Hôm nay · T7 24/10", "Ngày mai · CN 25/10", "T2 · 26/10". */
export function dayTitle(date: string, todayStr: string, long = false) {
  const dow = fmtDow(date);
  const base = `${long ? DOW_LONG[dow] ?? dow : dow} · ${fmtDayMonth(date)}`;
  if (date === todayStr) return `Hôm nay · ${base}`;
  if (date === shiftYmd(todayStr, 1)) return `Ngày mai · ${base}`;
  if (date === shiftYmd(todayStr, -1)) return `Hôm qua · ${base}`;
  return base;
}

/** Theo dõi một media query (vd có đủ chỗ cho cột phải không). SSR = false. */
export function useMedia(query: string) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const f = () => setOn(m.matches);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, [query]);
  return on;
}

/* ── Dải tab của màn (Buổi chụp · Lịch studio · Đội ngũ) ─────────────────── */
const TAB_META: { value: CalendarTab; label: string; icon: LucideIcon }[] = [
  { value: "shoot", label: "Buổi chụp", icon: Camera },
  { value: "studio", label: "Lịch studio", icon: CalendarRange },
  { value: "team", label: "Đội ngũ", icon: UsersRound },
];

/** Điều hướng bằng ?tab= (mỗi tab tải dữ liệu riêng ở server) — giống bản cũ. */
export function CalTabs({ tabs, active }: { tabs?: readonly CalendarTab[]; active: CalendarTab }) {
  const router = useRouter();
  const visible = TAB_META.filter((t) => tabs?.includes(t.value));
  if (visible.length < 2) return null;
  return <Tabs value={active} onChange={(v) => router.push(tabHref(v))} options={visible} label="Lịch làm việc" />;
}

/* ── Thanh điều hướng: Hôm nay · ‹ › · khoảng đang xem · (phải) ──────────── */
export function CalToolbar({
  label,
  sub,
  onPrev,
  onNext,
  onToday,
  atToday,
  unit,
  right,
  mobileAction,
}: {
  label: React.ReactNode;
  sub?: React.ReactNode;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Đang đứng ở khoảng có hôm nay — nút "Hôm nay" nhạt đi. */
  atToday: boolean;
  /** "tháng" / "tuần" — cho nhãn trợ năng của ‹ ›. */
  unit: string;
  right?: React.ReactNode;
  /** Nút chính bản điện thoại (thường chỉ có icon) — nằm cuối hàng đầu. */
  mobileAction?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-1 basis-[300px] items-center gap-1.5">
        <button type="button" onClick={onToday} className={btn("secondary", "sm", "flex-none")} aria-pressed={atToday} style={atToday ? { color: "var(--tx3)" } : undefined}>
          Hôm nay
        </button>
        <button type="button" onClick={onPrev} aria-label={`${unit[0].toUpperCase()}${unit.slice(1)} trước`} title={`${unit[0].toUpperCase()}${unit.slice(1)} trước`} className={iconBtn("!h-8 !w-8")}>
          <ChevronLeft size={18} />
        </button>
        <button type="button" onClick={onNext} aria-label={`${unit[0].toUpperCase()}${unit.slice(1)} sau`} title={`${unit[0].toUpperCase()}${unit.slice(1)} sau`} className={iconBtn("!h-8 !w-8 -ml-1")}>
          <ChevronRight size={18} />
        </button>
        <div className="ml-1 min-w-0">
          <h2 className="truncate text-[17px] font-semibold leading-tight" style={{ letterSpacing: "-.2px" }}>{label}</h2>
          {sub ? <p className="truncate text-[12px]" style={{ color: "var(--tx3)" }}>{sub}</p> : null}
        </div>
        {mobileAction ? <div className="ml-auto flex-none sm:hidden">{mobileAction}</div> : null}
      </div>
      {right ? <div className="flex max-w-full flex-wrap items-center gap-2">{right}</div> : null}
    </div>
  );
}

/* ── Chip một mục trên lịch tháng ─────────────────────────────────────────── */
function Chip({ it, faded }: { it: CalItem; faded?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        it.onOpen();
      }}
      title={`${it.time ? `${it.time} ` : ""}${it.title}${it.sub ? ` · ${it.sub}` : ""}`}
      className="flex h-[22px] w-full min-w-0 items-center gap-1 rounded-[5px] pl-1.5 pr-1 text-left text-[11.5px] transition-[filter] hover:brightness-95"
      style={{
        background: soft(it.color, 15),
        borderLeft: `3px solid ${it.color}`,
        opacity: faded || it.dim ? 0.55 : 1,
        boxShadow: it.alert ? `inset 0 0 0 1px ${it.alert === "red" ? "var(--rd)" : "var(--am)"}` : undefined,
      }}
    >
      {it.time ? <span className="tnum flex-none font-medium" style={{ color: "var(--tx2)" }}>{it.time.slice(0, 5)}</span> : null}
      <span className="min-w-0 flex-1 truncate font-medium" style={{ color: "var(--tx)" }}>{it.title}</span>
    </button>
  );
}

/* ── Lịch tháng ───────────────────────────────────────────────────────────── */
export function MonthGrid({
  year,
  month,
  todayStr,
  selected,
  itemsOn,
  onDay,
  flagOn,
  max = 3,
}: {
  year: number;
  month: number;
  todayStr: string;
  selected: string | null;
  itemsOn: (date: string) => CalItem[];
  onDay: (date: string) => void;
  /** Dấu nhỏ cạnh số ngày (vd "chưa phân công"). */
  flagOn?: (date: string) => React.ReactNode;
  max?: number;
}) {
  // Ô đệm đầu/cuối hiện ngày của tháng bên cạnh (mờ) thay vì ô xám trống.
  const cells = useMemo(() => {
    const g = monthGrid(year, month);
    const first = ymd(year, month, 1);
    const lead = g.findIndex((d) => d !== null);
    return g.map((d, i) => (d !== null ? { date: ymd(year, month, d), out: false } : { date: shiftYmd(first, i - lead), out: true }));
  }, [year, month]);

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="grid grid-cols-7" style={{ borderBottom: "1px solid var(--bd)" }}>
        {WD.map((w) => (
          <span key={w} className="py-2 text-center text-[11.5px] font-semibold sm:px-3 sm:text-left" style={{ color: "var(--tx3)" }}>
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map(({ date, out }, i) => {
          const items = itemsOn(date);
          const isToday = date === todayStr;
          const isSel = date === selected;
          const lastCol = i % 7 === 6;
          const lastRow = i >= cells.length - 7;
          return (
            <div
              key={date}
              role="button"
              tabIndex={0}
              aria-label={`${fmtDow(date)} ${fmtDayMonth(date)} · ${items.length ? `${items.length} mục` : "trống"}`}
              aria-pressed={isSel}
              onClick={() => onDay(date)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onDay(date);
                }
              }}
              className="min-h-[58px] min-w-0 cursor-pointer px-1 pb-1.5 pt-1 outline-none transition-colors hover:bg-[var(--sf2)] focus-visible:bg-[var(--sf2)] sm:min-h-[116px] sm:px-1.5"
              style={{
                borderRight: lastCol ? "none" : "1px solid var(--bd2)",
                borderBottom: lastRow ? "none" : "1px solid var(--bd2)",
                background: isSel ? "color-mix(in srgb, var(--acS) 70%, transparent)" : out ? "color-mix(in srgb, var(--sf2) 55%, transparent)" : undefined,
              }}
            >
              <div className="flex items-center justify-center gap-1 sm:justify-between sm:px-0.5">
                <span
                  className="tnum inline-flex h-[24px] min-w-[24px] items-center justify-center rounded-full px-1 text-[12.5px] font-semibold"
                  style={
                    isToday
                      ? { background: "var(--ac)", color: "#fff" }
                      : { color: out ? "var(--tx3)" : "var(--tx)", opacity: out ? 0.7 : 1 }
                  }
                >
                  {Number(date.slice(8))}
                </span>
                <span className="hidden items-center gap-1 sm:flex">
                  {flagOn?.(date)}
                  <span className="text-[10px] leading-none" style={{ color: "var(--tx3)", opacity: out ? 0.6 : 1 }}>{lunarCellLabel(date)}</span>
                </span>
              </div>

              {/* Màn rộng: chip một dòng. Điện thoại: chấm màu, bấm ô để xem. */}
              <div className="mt-1 hidden flex-col gap-[3px] sm:flex">
                {items.slice(0, items.length > max ? max - 1 : max).map((it) => (
                  <Chip key={it.key} it={it} faded={out} />
                ))}
                {items.length > max && (
                  <span className="px-1.5 text-[11px] font-semibold" style={{ color: "var(--tx3)" }}>
                    +{items.length - (max - 1)} nữa
                  </span>
                )}
              </div>
              {items.length > 0 && (
                <div className="mt-1 flex flex-wrap justify-center gap-[3px] sm:hidden" aria-hidden>
                  {items.slice(0, 4).map((it) => (
                    <span key={it.key} className="h-[6px] w-[6px] rounded-full" style={{ background: it.color, opacity: out ? 0.5 : 1 }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ── Lưới giờ của tuần (màn rộng) ─────────────────────────────────────────── */
const HOUR_H = 48;

/** Xếp làn cho các mục chồng giờ trong một ngày → mỗi mục một phần bề ngang. */
function lanes(items: { it: CalItem; s: number; e: number }[]) {
  const sorted = [...items].sort((a, b) => a.s - b.s || b.e - a.e);
  const out: { it: CalItem; s: number; e: number; lane: number; of: number }[] = [];
  let group: typeof out = [];
  let groupEnd = -1;
  const flush = () => {
    const n = Math.max(1, ...group.map((g) => g.lane + 1));
    for (const g of group) g.of = n;
    out.push(...group);
    group = [];
  };
  for (const x of sorted) {
    if (group.length && x.s >= groupEnd) flush();
    const used = new Set(group.filter((g) => g.e > x.s).map((g) => g.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    group.push({ ...x, lane, of: 1 });
    groupEnd = Math.max(groupEnd, x.e);
  }
  if (group.length) flush();
  return out;
}

export function WeekGrid({
  days,
  todayStr,
  selected,
  itemsOn,
  onDay,
  onSlot,
}: {
  days: string[];
  todayStr: string;
  selected?: string | null;
  itemsOn: (date: string) => CalItem[];
  onDay: (date: string) => void;
  /** Bấm vào ô giờ trống (vd đặt lịch đúng giờ đó). */
  onSlot?: (date: string, hour: number) => void;
}) {
  const byDay = days.map((d) => itemsOn(d));
  const timedHours = byDay.flat().map((it) => hourOf(it.time)).filter((h): h is number => h !== null);
  const endHours = byDay.flat().map((it) => hourOf(it.end ?? null)).filter((h): h is number => h !== null);
  const from = Math.max(0, Math.min(7, ...timedHours.map((h) => Math.floor(h))));
  const to = Math.min(24, Math.max(20, ...timedHours.map((h) => Math.ceil(h) + 2), ...endHours.map((h) => Math.ceil(h))));
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const COLS = "52px repeat(7, minmax(0,1fr))";
  const hasAllDay = byDay.some((l) => l.some((it) => hourOf(it.time) === null));

  // Vạch "bây giờ" — chỉ tính ở trình duyệt để không lệch khi dựng ở server.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const d = new Date(Date.now() + 7 * 3600 * 1000);
      setNow(d.getUTCHours() + d.getUTCMinutes() / 60);
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  // Mở lưới ở gần giờ làm việc đầu tiên thay vì nửa đêm.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = Math.max(0, (Math.min(...timedHours, 8) - from - 0.5) * HOUR_H);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0]]);

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="grid" style={{ gridTemplateColumns: COLS, borderBottom: "1px solid var(--bd)" }}>
        <div />
        {days.map((d, i) => {
          const isToday = d === todayStr;
          const isSel = d === selected;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onDay(d)}
              className="flex flex-col items-center gap-0.5 py-2 transition-colors hover:bg-[var(--sf2)]"
              style={{ borderLeft: "1px solid var(--bd2)", background: isSel ? "color-mix(in srgb, var(--acS) 70%, transparent)" : undefined }}
            >
              <span className="text-[11.5px] font-semibold" style={{ color: isToday ? "var(--ac)" : "var(--tx3)" }}>{WD[i]}</span>
              <span
                className="tnum flex h-[30px] min-w-[30px] items-center justify-center rounded-full px-1 text-[16px] font-semibold"
                style={isToday ? { background: "var(--ac)", color: "#fff" } : { color: "var(--tx)" }}
              >
                {Number(d.slice(8))}
              </span>
            </button>
          );
        })}
      </div>

      {hasAllDay && (
        <div className="grid" style={{ gridTemplateColumns: COLS, borderBottom: "1px solid var(--bd)" }}>
          <span className="whitespace-nowrap px-1 pt-2 text-right text-[10.5px] leading-tight" style={{ color: "var(--tx3)" }}>cả ngày</span>
          {byDay.map((list, i) => (
            <div key={days[i]} className="flex min-w-0 flex-col gap-[3px] p-1" style={{ borderLeft: "1px solid var(--bd2)" }}>
              {list.filter((it) => hourOf(it.time) === null).map((it) => (
                <Chip key={it.key} it={it} />
              ))}
            </div>
          ))}
        </div>
      )}

      <div ref={scroller} className="max-h-[640px] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: COLS }}>
          <div>
            {hours.map((h) => (
              <div key={h} className="relative" style={{ height: HOUR_H }}>
                {h !== from && (
                  <span className="tnum absolute -top-[7px] right-2 text-[10.5px]" style={{ color: "var(--tx3)" }}>
                    {String(h).padStart(2, "0")}:00
                  </span>
                )}
              </div>
            ))}
          </div>
          {days.map((d, di) => {
            const isToday = d === todayStr;
            const timed = byDay[di]
              .map((it) => {
                const s = hourOf(it.time);
                if (s === null) return null;
                const e0 = hourOf(it.end ?? null);
                // Chưa có giờ kết thúc → vẽ 1,5 giờ cho đủ chỗ in tên.
                const e = e0 !== null && e0 > s ? e0 : s + 1.5;
                return { it, s, e };
              })
              .filter((x): x is { it: CalItem; s: number; e: number } => x !== null);
            const placed = lanes(timed);
            return (
              <div
                key={d}
                className="relative"
                style={{
                  borderLeft: "1px solid var(--bd2)",
                  height: hours.length * HOUR_H,
                  background: isToday ? "color-mix(in srgb, var(--acS) 35%, transparent)" : undefined,
                }}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    onClick={() => (onSlot ? onSlot(d, h) : onDay(d))}
                    className="cursor-pointer transition-colors hover:bg-[var(--sf2)]"
                    style={{ height: HOUR_H, borderTop: h === from ? "none" : "1px solid var(--bd2)" }}
                  />
                ))}
                {placed.map(({ it, s, e, lane, of }) => {
                  const h = Math.max(26, (e - s) * HOUR_H - 3);
                  return (
                    <button
                      key={it.key}
                      type="button"
                      onClick={it.onOpen}
                      title={`${it.time ?? ""}${it.end ? `–${it.end.slice(0, 5)}` : ""} ${it.title}${it.sub ? ` · ${it.sub}` : ""}`}
                      className="absolute flex flex-col overflow-hidden rounded-[7px] px-1.5 py-1 text-left transition-[filter] hover:brightness-95"
                      style={{
                        top: (s - from) * HOUR_H + 1,
                        height: h,
                        left: `calc(${(lane / of) * 100}% + 2px)`,
                        width: `calc(${100 / of}% - 4px)`,
                        background: soft(it.color, 16),
                        borderLeft: `3px solid ${it.color}`,
                        opacity: it.dim ? 0.6 : 1,
                        boxShadow: it.alert ? `inset 0 0 0 1px ${it.alert === "red" ? "var(--rd)" : "var(--am)"}` : undefined,
                        zIndex: 1,
                      }}
                    >
                      <span className="tnum truncate text-[10.5px] font-semibold leading-tight" style={{ color: it.color }}>
                        {it.time?.slice(0, 5)}{it.end ? `–${it.end.slice(0, 5)}` : ""}
                      </span>
                      <span className="line-clamp-2 text-[12px] font-semibold leading-tight" style={{ color: "var(--tx)" }}>{it.title}</span>
                      {it.sub && h > 58 ? (
                        <span className="truncate text-[11px] leading-tight" style={{ color: "var(--tx2)" }}>{it.sub}</span>
                      ) : null}
                    </button>
                  );
                })}
                {isToday && now !== null && now >= from && now <= to && (
                  <div className="pointer-events-none absolute left-0 right-0" style={{ top: (now - from) * HOUR_H, zIndex: 2 }}>
                    <div className="relative h-[2px]" style={{ background: "var(--rd)" }}>
                      <span className="absolute -left-[4px] -top-[3px] h-2 w-2 rounded-full" style={{ background: "var(--rd)" }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/* ── Một dòng trong danh sách theo ngày ───────────────────────────────────── */
export function AgendaRow({ it }: { it: CalItem }) {
  const Icon = it.icon;
  return (
    <button type="button" onClick={it.onOpen} className="v2-row v2-row-link w-full text-left" style={{ opacity: it.dim ? 0.65 : 1 }}>
      <div className="w-[52px] flex-none whitespace-nowrap">
        {it.time ? (
          <>
            <p className="tnum text-[13px] font-semibold">{it.time.slice(0, 5)}</p>
            {it.end ? <p className="tnum text-[11.5px]" style={{ color: "var(--tx3)" }}>{it.end.slice(0, 5)}</p> : null}
          </>
        ) : (
          <p className="text-[12px] font-medium" style={{ color: "var(--tx3)" }}>Cả ngày</p>
        )}
      </div>
      <span className="w-[3px] flex-none self-stretch rounded-full" style={{ background: it.color }} />
      <div className="min-w-0 flex-1">
        <p className="v2-row-title flex items-center gap-1.5">
          {Icon ? <Icon size={14} className="flex-none" style={{ color: it.color }} /> : null}
          <span className="truncate">{it.title}</span>
        </p>
        {it.sub ? <p className="v2-row-sub">{it.sub}</p> : null}
        {/* Điện thoại: nhãn phụ xuống dòng dưới, nhường chỗ cho tên. */}
        {it.meta ? <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">{it.meta}</div> : null}
      </div>
      {it.meta ? <div className="hidden flex-none items-center gap-1.5 sm:flex">{it.meta}</div> : null}
    </button>
  );
}

/* ── Danh sách theo ngày (mặc định trên điện thoại) ───────────────────────── */
export function Agenda({
  days,
  todayStr,
  itemsOn,
  empty,
  showEmptyDays = false,
  onEmptyDay,
}: {
  days: string[];
  todayStr: string;
  itemsOn: (date: string) => CalItem[];
  /** Hiện khi cả khoảng không có mục nào. */
  empty: React.ReactNode;
  /** true (chế độ tuần trên điện thoại): ngày trống vẫn có một dòng. */
  showEmptyDays?: boolean;
  onEmptyDay?: (date: string) => void;
}) {
  const [showPast, setShowPast] = useState(false);
  const withItems = days.map((d) => ({ d, items: itemsOn(d) })).filter((x) => showEmptyDays || x.items.length > 0);
  // Khoảng có chứa hôm nay → giấu những ngày đã qua sau một nút, để mở ra là
  // thấy ngay việc sắp tới (điện thoại không phải cuộn qua nửa tháng cũ).
  const hasToday = days.includes(todayStr);
  const past = hasToday ? withItems.filter((x) => x.d < todayStr) : [];
  const shown = hasToday && !showPast ? withItems.filter((x) => x.d >= todayStr) : withItems;

  if (withItems.length === 0) return <Card>{empty}</Card>;

  return (
    <div className="flex flex-col gap-4">
      {past.length > 0 && (
        <button type="button" onClick={() => setShowPast((v) => !v)} className={btn("ghost", "sm", "self-start")}>
          {showPast ? "Ẩn những ngày đã qua" : `Hiện ${past.length} ngày đã qua`}
        </button>
      )}
      {shown.length === 0 && <Card>{empty}</Card>}
      {shown.map(({ d, items }) => (
        <section key={d} className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2 px-1">
            <h3 className="text-[13px] font-semibold" style={{ color: d === todayStr ? "var(--ac)" : "var(--tx)" }}>
              {dayTitle(d, todayStr)}
            </h3>
            <span className="text-[11.5px]" style={{ color: "var(--tx3)" }}>{lunarFull(d)}</span>
            <span className="ml-auto text-[11.5px]" style={{ color: "var(--tx3)" }}>{items.length ? `${items.length} mục` : ""}</span>
          </div>
          <Card padded={false} className="overflow-hidden">
            {items.length ? (
              items.map((it) => <AgendaRow key={it.key} it={it} />)
            ) : (
              <button
                type="button"
                onClick={() => onEmptyDay?.(d)}
                disabled={!onEmptyDay}
                className="v2-row w-full text-left text-[13px] enabled:hover:bg-[var(--sf2)]"
                style={{ color: "var(--tx3)" }}
              >
                Trống{onEmptyDay ? " — bấm để xem / thêm" : ""}
              </button>
            )}
          </Card>
        </section>
      ))}
    </div>
  );
}

/* ── Đầu ngăn chi tiết một ngày: ‹ ngày › ─────────────────────────────────── */
export function DayNav({ date, todayStr, onMove }: { date: string; todayStr: string; onMove: (d: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onMove(shiftYmd(date, -1))} aria-label="Ngày trước" title="Ngày trước" className={iconBtn("!h-8 !w-8")}>
        <ChevronLeft size={17} />
      </button>
      <div className="min-w-0 flex-1 text-center">
        <p className="truncate text-[14px] font-semibold">{dayTitle(date, todayStr, true)}</p>
        <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>{date.slice(0, 4)} · {lunarFull(date)}</p>
      </div>
      <button type="button" onClick={() => onMove(shiftYmd(date, 1))} aria-label="Ngày sau" title="Ngày sau" className={iconBtn("!h-8 !w-8")}>
        <ChevronRight size={17} />
      </button>
    </div>
  );
}

/** Chú giải màu nhỏ dưới lưới. */
export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
      {items.map((x) => (
        <span key={x.label} className="flex items-center gap-1.5 whitespace-nowrap text-[11.5px]" style={{ color: "var(--tx3)" }}>
          <span className="h-2 w-2 flex-none rounded-full" style={{ background: x.color }} /> {x.label}
        </span>
      ))}
    </div>
  );
}
