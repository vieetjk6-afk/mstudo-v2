"use client";

import { useMemo, useState } from "react";
import {
  Briefcase, CalendarCheck, CalendarDays, Check, ChevronDown, Clock, IdCard, Inbox, Loader2, MapPin, Navigation, Play,
  RefreshCw, Square, StickyNote, Timer, Wallet, X,
} from "lucide-react";
import { CustomerHeaderV2, CustomerMainV2, CustomerRootV2 } from "@/components/v2/customer";
import {
  Avatar, Badge, Empty, Field, GroupLabel, ListRow, Section, Stack, Stat, StatGrid, btn, iconBtn, inputCls, type Tone,
} from "@/components/v2/kit";
import { Menu, Modal, Tabs, type MenuItem } from "@/components/v2/kit-client";
import Turnstile from "@/components/Turnstile";
import { useTheme } from "@/lib/theme";
import { crewRoleLabel } from "@/lib/crew-roles";
import { fmtDate, fmtDayMonth, fmtDow, todayVN } from "@/lib/date";
import { humanHours, sessionHours } from "@/lib/timesheet";
import { CREW_STATUS_LABEL, SHOOT_TYPE_LABEL, vnd, vndShort, type CrewStatus } from "@/lib/types";
import type { StudioBrandInfo } from "@/lib/studio-brand";
import { MobileTabBarV2, mapsHref } from "@/app/staff/PortalBitsV2";
import CrewScheduleV2, { dayLabel } from "./CrewScheduleV2";
import CrewProfileV2, { CrewRegisterV2 } from "./CrewProfileV2";
import { clockTime, useCrewPortal, useTimeClock, type Assignment, type CrewPortalState, type CrewStudio } from "./useCrewPortal";

/* ═══════════════════════════════════════════════════════════════════════════
   CỔNG THỢ (/crew, /crew/<token>) — giao diện mới. Thợ mở bằng link (không đăng
   nhập), trên điện thoại, ở phim trường. Bố cục:
     • Chưa tra: một thẻ duy nhất — nhập SĐT, captcha, "Xem việc".
     • Link riêng của studio mà chưa có trong sổ: chỉ form đăng ký.
     • Đã tra: bốn tab (đáy trên điện thoại, trên cùng trên máy tính)
         Việc      — số liệu thu nhập + thẻ việc theo nhóm (đang làm · chờ trả
                     lời · sắp tới · đã qua · đã từ chối), mỗi thẻ MỘT nút chính
                     (Nhận việc / Chấm công vào / Chấm công ra);
         Chấm công — đồng hồ lớn + buổi gần đây;
         Lịch      — agenda, ngày rảnh (công tắc), ca công ty;
         Hồ sơ     — thông tin ở từng studio, đồng bộ Google Lịch.
   Toàn bộ trạng thái và thao tác lấy từ useCrewPortal — đúng như bản cũ.
   ═══════════════════════════════════════════════════════════════════════════ */

export type CrewTab = "jobs" | "clock" | "schedule" | "profile";

const STATUS_TONE: Record<CrewStatus, Tone> = { pending: "amber", accepted: "green", declined: "red" };

/**
 * `brand`: thương hiệu studio khi vào bằng link riêng (/crew/<token>). Cổng chung
 * /crew không thuộc studio nào nên bỏ trống — đầu trang ghi "Cổng cộng tác viên".
 */
export default function CrewPortalV2({ studio, brand }: { studio?: CrewStudio; brand?: StudioBrandInfo }) {
  const s = useCrewPortal(studio);
  return <CrewPortalV2View s={s} brand={brand} />;
}

/** Phần vẽ — tách khỏi hook để màn xem trước dựng được bằng dữ liệu giả. */
export function CrewPortalV2View({ s, brand, initialTab = "jobs" }: { s: CrewPortalState; brand?: StudioBrandInfo; initialTab?: CrewTab }) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<CrewTab>(initialTab);
  const clock = useTimeClock(s.openEntry, s.studioOptions);
  const [clockInOpen, setClockInOpen] = useState(false);
  const [clockOutOpen, setClockOutOpen] = useState(false);

  const signedIn = s.list !== null;
  const header = (
    <CustomerHeaderV2
      brand={brand ?? { name: s.tr.eyebrow, logoUrl: null }}
      sub={brand ? s.tr.eyebrow : s.lang === "en" ? "Jobs from every studio you work with" : "Việc từ mọi studio bạn cộng tác"}
      right={
        signedIn ? (
          <>
            <span className="v2-num text-[13px] font-semibold max-sm:hidden" style={{ color: "var(--tx2)" }}>{s.phone}</span>
            <button type="button" onClick={s.reset} className={iconBtn()} aria-label="Tra số khác" title="Tra số khác">
              <RefreshCw size={17} />
            </button>
          </>
        ) : undefined
      }
    />
  );

  /* ── Chưa tra: cổng nhập số ─────────────────────────────────────────── */
  if (!signedIn) {
    return (
      <CustomerRootV2 theme={theme}>
        {header}
        <main
          className="mx-auto flex w-full max-w-[440px] flex-col justify-center pb-16 pt-8 sm:pt-14"
          style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}
        >
          <form onSubmit={s.load} className="v2-card v2-card-pad flex flex-col gap-4 sm:!px-7 sm:!py-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-[14px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
              <Briefcase size={22} />
            </span>
            <div>
              <h1 className="text-[21px] font-bold" style={{ letterSpacing: "-.4px" }}>{s.tr.title}</h1>
              <p className="mt-1 text-[14px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{s.tr.subtitle}</p>
            </div>
            <label className="v2-field">
              <span className="v2-label">{s.tr.phonePh}</span>
              <input
                className={`${inputCls} !h-12 text-[16px] font-semibold tracking-wide`}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="09xx xxx xxx"
                value={s.phone}
                onChange={(e) => s.setPhone(e.target.value)}
              />
            </label>
            <Turnstile onVerify={s.setCaptchaToken} onExpire={() => s.setCaptchaToken(null)} onError={() => s.setCaptchaToken(null)} />
            <button type="submit" disabled={s.loading || !s.captchaToken} className={btn("primary", "lg", "w-full")}>
              {s.loading ? <Loader2 size={17} className="animate-spin" /> : null}
              {s.loading ? s.tr.searching : s.tr.search}
            </button>
            <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
              {s.studio
                ? `Link riêng của ${s.studio.name}. Nếu bạn chưa có trong sổ thợ của studio, trang sẽ mời bạn đăng ký.`
                : "Không cần tài khoản — studio giao việc cho bạn theo số điện thoại."}
            </p>
          </form>
        </main>
      </CustomerRootV2>
    );
  }

  /* ── Link riêng của studio, chưa có trong sổ: chỉ đăng ký ──────────── */
  if (s.studio && !s.inThisStudio) {
    return (
      <CustomerRootV2 theme={theme}>
        {header}
        <CustomerMainV2 width={640}>
          <CrewRegisterV2 studioName={s.studio.name} crewToken={s.studio.crewToken} phone={s.phone} />
        </CustomerMainV2>
      </CustomerRootV2>
    );
  }

  /* ── Đã tra ─────────────────────────────────────────────────────────── */
  const list = s.list ?? [];
  const pending = list.filter((a) => a.status === "pending").length;
  const displayName = s.profiles.find((p) => p.name?.trim())?.name?.trim() ?? "";
  const firstName = displayName.split(/\s+/).pop() ?? "";
  const studiosLine =
    s.acceptedStudios.length > 0
      ? `Thợ của ${s.acceptedStudios.map((p) => p.studio_name).join(", ")}`
      : s.profiles.length > 0
        ? "Đang chờ studio duyệt hồ sơ"
        : "Chưa có trong sổ thợ của studio nào";

  /** Chấm công vào một việc: một studio thì vào luôn, nhiều studio thì hỏi studio nào. */
  function clockInFor(contractId: string) {
    clock.setContractId(contractId);
    if (s.studioOptions.length === 1) s.clockIn({ studioId: s.studioOptions[0].id, contractId });
    else setClockInOpen(true);
  }

  const tabs: { value: CrewTab; label: string; icon: typeof Briefcase; count?: number }[] = [
    { value: "jobs", label: "Việc", icon: Briefcase, count: pending || undefined },
    { value: "clock", label: "Chấm công", icon: Timer },
    { value: "schedule", label: "Lịch", icon: CalendarDays },
    { value: "profile", label: "Hồ sơ", icon: IdCard },
  ];

  return (
    <CustomerRootV2 theme={theme}>
      {header}
      <CustomerMainV2 width={1000}>
        <Stack>
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={displayName || s.phone} size={44} />
            <div className="min-w-0">
              <h1 className="truncate text-[20px] font-bold leading-tight" style={{ letterSpacing: "-.4px" }}>
                {firstName ? `Chào ${firstName}` : s.tr.title}
              </h1>
              <p className="mt-0.5 truncate text-[13px]" style={{ color: "var(--tx2)" }}>
                <span className="v2-num sm:hidden">{s.phone} · </span>
                {studiosLine}
              </p>
            </div>
          </div>

          <div className="max-md:hidden">
            <Tabs label="Các phần của trang" value={tab} onChange={setTab} options={tabs} />
          </div>

          {/* Lỗi nhận / từ chối việc (lỗi trong ngăn kéo thì hiện ngay trong ngăn). */}
          {s.actionError && !clockInOpen && !clockOutOpen ? (
            <p role="alert" className="text-[13px] font-medium" style={{ color: "var(--rd)" }}>
              {s.actionError}
            </p>
          ) : null}

          {tab === "jobs" ? (
            <JobsTab s={s} clock={clock} onClockIn={clockInFor} onClockOut={() => setClockOutOpen(true)} />
          ) : tab === "clock" ? (
            <ClockTab s={s} clock={clock} />
          ) : tab === "schedule" ? (
            <CrewScheduleV2 s={s} />
          ) : (
            <CrewProfileV2 s={s} />
          )}
        </Stack>
      </CustomerMainV2>

      <MobileTabBarV2
        items={tabs.map((t) => ({
          key: t.value,
          label: t.label,
          icon: t.icon,
          active: tab === t.value,
          onClick: () => setTab(t.value),
          badge: t.value === "jobs" ? pending : undefined,
          dot: t.value === "clock" && !!s.openEntry,
        }))}
      />

      {/* ── Chấm công vào (nhiều studio: hỏi studio nào) ──────────────── */}
      <Modal
        open={clockInOpen}
        onClose={() => {
          setClockInOpen(false);
          s.setActionError(null);
        }}
        icon={Play}
        title="Chấm công vào"
        desc="Bấm khi bạn đã tới nơi. Studio dùng giờ này để đối soát tiền công."
        width={420}
        footer={
          <>
            {s.actionError ? (
              <p role="alert" className="w-full text-[12.5px] font-medium" style={{ color: "var(--rd)" }}>
                {s.actionError}
              </p>
            ) : null}
            <button
              type="button"
              disabled={s.busy === "sched" || !clock.studioId}
              onClick={async () => {
                if (await s.clockIn({ studioId: clock.studioId, contractId: clock.contractId })) setClockInOpen(false);
              }}
              className={btn("primary", "md", "w-full")}
            >
              <Play size={16} /> {s.busy === "sched" ? "Đang lưu…" : "Chấm công vào"}
            </button>
          </>
        }
      >
        <ClockInFields s={s} clock={clock} />
      </Modal>

      {/* ── Chấm công ra ──────────────────────────────────────────────── */}
      <Modal
        open={clockOutOpen}
        onClose={() => {
          setClockOutOpen(false);
          s.setActionError(null);
        }}
        icon={Square}
        title="Chấm công ra"
        desc={s.openEntry ? `Bắt đầu ${clockTime(s.openEntry.started_at)} · đã làm ${humanHours(Math.max(0, clock.elapsed))}` : undefined}
        width={420}
        footer={
          <>
            {s.actionError ? (
              <p role="alert" className="w-full text-[12.5px] font-medium" style={{ color: "var(--rd)" }}>
                {s.actionError}
              </p>
            ) : null}
            <button
              type="button"
              disabled={s.busy === "sched"}
              onClick={async () => {
                if (await s.clockOut(clock.note)) setClockOutOpen(false);
              }}
              className={btn("primary", "md", "w-full")}
            >
              <Square size={15} /> {s.busy === "sched" ? "Đang lưu…" : "Chấm công ra"}
            </button>
          </>
        }
      >
        <Field label="Ghi chú (không bắt buộc)">
          <input className={inputCls} value={clock.note} onChange={(e) => clock.setNote(e.target.value)} placeholder="Phát sinh, đi thêm điểm…" />
        </Field>
      </Modal>
    </CustomerRootV2>
  );
}

type Clock = ReturnType<typeof useTimeClock>;

function ClockInFields({ s, clock }: { s: CrewPortalState; clock: Clock }) {
  return (
    <div className="flex flex-col gap-3">
      {s.studioOptions.length > 1 ? (
        <Field label="Studio">
          <select className={inputCls} value={clock.studioId} onChange={(e) => clock.setStudioId(e.target.value)}>
            {s.studioOptions.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
        </Field>
      ) : null}
      {s.clockJobs.length > 0 ? (
        <Field label="Gắn với việc">
          <select className={inputCls} value={clock.contractId} onChange={(e) => clock.setContractId(e.target.value)}>
            <option value="">— Không gắn việc cụ thể —</option>
            {s.clockJobs.map((j) => (
              <option key={j.id} value={j.id}>{j.label}</option>
            ))}
          </select>
        </Field>
      ) : null}
    </div>
  );
}

/* ═══ Tab "Việc" ═════════════════════════════════════════════════════════════ */
function JobsTab({
  s, clock, onClockIn, onClockOut,
}: {
  s: CrewPortalState;
  clock: Clock;
  onClockIn: (contractId: string) => void;
  onClockOut: () => void;
}) {
  const today = todayVN();
  const list = useMemo(() => s.list ?? [], [s.list]);
  const open = s.openEntry;
  const openJob = open?.contract_id ? list.find((a) => a.contract_id === open.contract_id && a.status === "accepted") ?? null : null;

  const groups = useMemo(() => {
    const date = (a: Assignment) => a.contract?.event_date ?? "";
    const asc = (a: Assignment, b: Assignment) => (date(a) || "9999").localeCompare(date(b) || "9999") || (a.contract?.event_time ?? "").localeCompare(b.contract?.event_time ?? "");
    const rest = list.filter((a) => a !== openJob);
    return {
      pending: rest.filter((a) => a.status === "pending").sort(asc),
      upcoming: rest.filter((a) => a.status === "accepted" && (!date(a) || date(a) >= today)).sort(asc),
      past: rest.filter((a) => a.status === "accepted" && !!date(a) && date(a) < today).sort((a, b) => asc(b, a)),
      declined: rest.filter((a) => a.status === "declined").sort(asc),
    };
  }, [list, openJob, today]);

  const accepted = list.filter((a) => a.status === "accepted");
  const earned = accepted.reduce((n, a) => n + (a.salary || 0), 0);
  const hours = s.sheet.reduce((n, r) => n + (sessionHours(r) ?? 0), 0);
  const next = groups.upcoming.find((a) => a.contract?.event_date) ?? null;
  const canClock = s.studioOptions.length > 0;

  const card = (a: Assignment) => (
    <JobCard key={a.id} a={a} s={s} today={today} openJob={openJob} canClock={canClock} onClockIn={onClockIn} onClockOut={onClockOut} elapsed={clock.elapsed} />
  );

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* Chưa có việc, chưa chấm công buổi nào: bốn số 0 không nói gì — bỏ hẳn. */}
      {list.length > 0 || open || s.sheet.length > 0 ? (
        <StatGrid cols={4}>
          <Stat label="Chờ bạn trả lời" value={groups.pending.length} valueTone={groups.pending.length > 0 ? "amber" : undefined} sub={groups.pending.length > 0 ? "việc mới được giao" : "Không có việc mới"} icon={Inbox} tone="amber" />
          <Stat
            label="Việc sắp tới"
            value={groups.upcoming.length + (openJob ? 1 : 0)}
            sub={next?.contract?.event_date ? `Gần nhất ${next.contract.event_date === today ? "hôm nay" : `${fmtDow(next.contract.event_date)} · ${fmtDayMonth(next.contract.event_date)}`}` : "Chưa có lịch mới"}
            icon={CalendarDays}
            tone="brand"
          />
          <Stat label="Thù lao đã nhận" value={vndShort(earned)} sub={`${accepted.length} việc đã nhận`} icon={Wallet} tone="green" />
          <Stat label="Giờ làm gần đây" value={humanHours(hours)} sub={`${s.sheet.length} buổi chấm công`} icon={Clock} tone="blue" />
        </StatGrid>
      ) : null}

      {list.length === 0 && !open ? (
        <div className="v2-card">
          <Empty icon={Briefcase} title={s.tr.noJobs} hint="Khi studio phân công bạn vào một buổi chụp, việc sẽ hiện ở đây kèm mức thù lao." />
        </div>
      ) : null}

      {open ? (
        <JobGroup label="Đang làm" count={1}>
          {openJob ? (
            card(openJob)
          ) : (
            <OpenClockCard s={s} elapsed={clock.elapsed} onClockOut={onClockOut} />
          )}
        </JobGroup>
      ) : null}
      {groups.pending.length > 0 ? <JobGroup label="Chờ bạn trả lời" count={groups.pending.length}>{groups.pending.map(card)}</JobGroup> : null}
      {groups.upcoming.length > 0 ? <JobGroup label="Hôm nay & sắp tới" count={groups.upcoming.length}>{groups.upcoming.map(card)}</JobGroup> : null}
      {groups.past.length > 0 ? <JobGroup label="Đã qua" count={groups.past.length} collapsed>{groups.past.map(card)}</JobGroup> : null}
      {groups.declined.length > 0 ? <JobGroup label="Đã từ chối" count={groups.declined.length} collapsed>{groups.declined.map(card)}</JobGroup> : null}
    </div>
  );
}

function JobGroup({ label, count, collapsed = false, children }: { label: string; count: number; collapsed?: boolean; children: React.ReactNode }) {
  if (collapsed)
    return (
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1">
          <GroupLabel count={count}>{label}</GroupLabel>
          <ChevronDown size={15} className="transition-transform group-open:rotate-180" style={{ color: "var(--tx3)" }} />
        </summary>
        <div className="mt-2.5 grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">{children}</div>
      </details>
    );
  return (
    <section>
      <GroupLabel count={count}>{label}</GroupLabel>
      <div className="mt-2.5 grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">{children}</div>
    </section>
  );
}

/** Ô ngày bên trái thẻ việc: thứ · ngày · tháng. Hôm nay tô màu chủ đạo. */
function DateTile({ iso, today }: { iso: string | null; today: string }) {
  const isToday = iso === today;
  return (
    <span
      className="flex h-[58px] w-[52px] flex-none flex-col items-center justify-center rounded-[12px]"
      style={isToday ? { background: "var(--ac)", color: "#fff" } : { background: "var(--sf2)", color: "var(--tx)", border: "1px solid var(--bd2)" }}
    >
      {iso ? (
        <>
          <span className="text-[11px] font-semibold uppercase leading-none" style={{ opacity: isToday ? 0.9 : 0.6 }}>{isToday ? "Nay" : fmtDow(iso)}</span>
          <span className="v2-num mt-1 text-[20px] font-bold leading-none">{iso.slice(8, 10)}</span>
          <span className="v2-num mt-1 text-[10.5px] font-semibold leading-none" style={{ opacity: isToday ? 0.9 : 0.6 }}>Th{+iso.slice(5, 7)}</span>
        </>
      ) : (
        <span className="px-1 text-center text-[10.5px] font-semibold leading-tight" style={{ color: "var(--tx3)" }}>Chưa có ngày</span>
      )}
    </span>
  );
}

function JobCard({
  a, s, today, openJob, canClock, onClockIn, onClockOut, elapsed,
}: {
  a: Assignment;
  s: CrewPortalState;
  today: string;
  openJob: Assignment | null;
  canClock: boolean;
  onClockIn: (contractId: string) => void;
  onClockOut: () => void;
  elapsed: number;
}) {
  const c = a.contract;
  const working = s.busy === a.id;
  const isOpen = openJob?.id === a.id;
  const isToday = c?.event_date === today;
  const role = [a.role_label || crewRoleLabel(a.role), c ? SHOOT_TYPE_LABEL[c.shoot_type] : null].filter(Boolean).join(" · ");
  const canClockIn = a.status === "accepted" && canClock && !s.openEntry && !!a.contract_id;

  // Một nút chính theo trạng thái; thao tác phụ dồn vào ⋯.
  let primary: React.ReactNode = null;
  const menu: MenuItem[] = [];
  if (a.status === "pending") {
    primary = (
      <>
        <button type="button" onClick={() => s.respond(a.id, "declined")} disabled={working} className={btn("secondary", "sm")}>
          <X size={15} /> {s.tr.decline}
        </button>
        <button type="button" onClick={() => s.respond(a.id, "accepted")} disabled={working} className={btn("primary", "sm")}>
          <Check size={15} /> {s.tr.accept}
        </button>
      </>
    );
  } else if (a.status === "accepted") {
    if (isOpen)
      primary = (
        <button type="button" onClick={onClockOut} disabled={s.busy === "sched"} className={btn("primary", "sm")}>
          <Square size={14} /> Chấm công ra
        </button>
      );
    else if (canClockIn && isToday)
      primary = (
        <button type="button" onClick={() => onClockIn(a.contract_id as string)} disabled={s.busy === "sched"} className={btn("primary", "sm")}>
          <Play size={15} /> Chấm công vào
        </button>
      );
    else if (canClockIn) menu.push({ label: "Chấm công vào việc này", icon: Play, onClick: () => onClockIn(a.contract_id as string) });
    menu.push({ label: `${s.tr.switchTo} “${s.tr.decline}”`, icon: X, danger: true, onClick: () => s.respond(a.id, "declined"), disabled: working });
  } else {
    primary = (
      <button type="button" onClick={() => s.respond(a.id, "accepted")} disabled={working} className={btn("ghost", "sm")}>
        {s.tr.switchTo} “{s.tr.accept}”
      </button>
    );
  }

  return (
    <article className="v2-card flex min-w-0 flex-col overflow-hidden" style={isOpen ? { borderColor: "color-mix(in srgb, var(--gn) 45%, var(--bd))" } : undefined}>
      <div className="flex gap-3 p-4">
        <DateTile iso={c?.event_date ?? null} today={today} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug" style={{ textWrap: "pretty", color: a.status === "declined" ? "var(--tx3)" : undefined }}>
              {c?.title || s.tr.contract}
            </p>
            {isOpen ? (
              <Badge tone="green" dot>Đang làm</Badge>
            ) : (
              <Badge tone={STATUS_TONE[a.status]}>{CREW_STATUS_LABEL[a.status]}</Badge>
            )}
          </div>
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>{role}</p>
          <div className="mt-2 flex flex-col gap-1 text-[13px]" style={{ color: "var(--tx2)" }}>
            <span className="flex items-center gap-1.5">
              <Clock size={14} style={{ color: "var(--tx3)", flex: "none" }} />
              <span className="v2-num">
                {c?.event_date ? (c.event_date === today ? "Hôm nay" : fmtDate(c.event_date)) : "Chưa có ngày"}
                {c?.event_time ? ` · ${c.event_time}` : ""}
              </span>
            </span>
            {c?.location ? (
              <span className="flex items-start gap-1.5">
                <MapPin size={14} style={{ color: "var(--tx3)", flex: "none", marginTop: 2 }} />
                <span className="min-w-0" style={{ textWrap: "pretty" }}>{c.location}</span>
              </span>
            ) : null}
            {isOpen ? (
              <span className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--gn)" }}>
                <Timer size={14} style={{ flex: "none" }} /> Đã làm {humanHours(Math.max(0, elapsed))} · từ {clockTime(s.openEntry?.started_at ?? null)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {a.note ? (
        <p className="mx-4 mb-3 flex items-start gap-1.5 rounded-[10px] px-3 py-2 text-[13px]" style={{ background: "var(--amS)", color: "var(--tx2)" }}>
          <StickyNote size={15} style={{ flex: "none", color: "var(--am)", marginTop: 1 }} />
          <span style={{ textWrap: "pretty" }}>
            <b style={{ color: "var(--tx)" }}>{s.tr.studioNote}</b> {a.note}
          </span>
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--bd2)", background: "var(--sf2)" }}>
        {/* Điện thoại: hàng 1 = thù lao · chỉ đường · ⋯, hàng 2 = nút chính kéo hết bề ngang.
            Từ sm: một hàng — thù lao … chỉ đường · nút chính · ⋯. */}
        <span className="order-1">
          <Badge tone="blue" icon={Wallet} title={s.tr.salary}>{vnd(a.salary)}</Badge>
        </span>
        {c?.location && a.status !== "declined" ? (
          <a href={mapsHref(c.location)} target="_blank" rel="noopener noreferrer" className={iconBtn("order-2 ml-auto")} aria-label="Chỉ đường" title="Chỉ đường">
            <Navigation size={16} />
          </a>
        ) : (
          <span className="order-2 ml-auto" />
        )}
        {menu.length > 0 ? (
          <span className="order-2 sm:order-4">
            <Menu items={menu} />
          </span>
        ) : null}
        {primary ? <div className="order-3 flex w-full gap-2 [&>*]:flex-1 sm:w-auto sm:[&>*]:flex-none">{primary}</div> : null}
      </div>
    </article>
  );
}

/** Buổi đang mở mà không gắn việc nào trong danh sách. */
function OpenClockCard({ s, elapsed, onClockOut }: { s: CrewPortalState; elapsed: number; onClockOut: () => void }) {
  const open = s.openEntry;
  if (!open) return null;
  return (
    <article className="v2-card flex flex-col overflow-hidden" style={{ borderColor: "color-mix(in srgb, var(--gn) 45%, var(--bd))" }}>
      <div className="flex items-center gap-3 p-4">
        <span className="flex h-[58px] w-[52px] flex-none items-center justify-center rounded-[12px]" style={{ background: "var(--gnS)", color: "var(--gn)" }}>
          <Timer size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Đang làm · {humanHours(Math.max(0, elapsed))}</p>
          <p className="v2-num mt-0.5 text-[13px]" style={{ color: "var(--tx2)" }}>
            Bắt đầu {clockTime(open.started_at)} · {open.work_date.split("-").reverse().join("/")}
          </p>
        </div>
      </div>
      <div className="flex justify-end px-4 py-3" style={{ borderTop: "1px solid var(--bd2)", background: "var(--sf2)" }}>
        <button type="button" onClick={onClockOut} disabled={s.busy === "sched"} className={btn("primary", "sm")}>
          <Square size={14} /> Chấm công ra
        </button>
      </div>
    </article>
  );
}

/* ═══ Tab "Chấm công" ════════════════════════════════════════════════════════ */
function ClockTab({ s, clock }: { s: CrewPortalState; clock: Clock }) {
  const open = s.openEntry;
  const busy = s.busy === "sched";
  const jobLabel = (id: string | null | undefined) => (id ? s.clockJobs.find((j) => j.id === id)?.label ?? null : null);
  const total = s.sheet.reduce((n, r) => n + (sessionHours(r) ?? 0), 0);

  if (s.studioOptions.length === 0)
    return (
      <div className="v2-card">
        <Empty icon={Timer} title="Chưa chấm công được" hint="Chỉ studio đã nhận bạn vào sổ thợ mới chấm công được. Khi studio duyệt hồ sơ, nút chấm công sẽ hiện ở đây." />
      </div>
    );

  return (
    <div className="grid grid-cols-1 gap-5 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] min-[900px]:items-start">
      <section className="v2-card v2-card-pad flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="v2-section-icon" style={open ? { background: "var(--gnS)", color: "var(--gn)" } : undefined}>
            <Timer size={17} />
          </span>
          <div className="min-w-0">
            <h2 className="v2-section-title">{open ? "Đang làm" : "Chưa chấm công"}</h2>
            <p className="v2-section-desc">{open ? "Bấm Chấm công ra khi bạn rời đi" : "Bấm Chấm công vào khi bạn tới nơi"}</p>
          </div>
        </div>

        {open ? (
          <>
            <div className="rounded-[14px] px-4 py-4 text-center" style={{ background: "var(--gnS)" }}>
              <p className="v2-num text-[30px] font-bold leading-none" style={{ color: "var(--gn)", letterSpacing: "-.6px" }}>
                {humanHours(Math.max(0, clock.elapsed))}
              </p>
              <p className="v2-num mt-2 text-[13px]" style={{ color: "var(--tx2)" }}>
                Bắt đầu {clockTime(open.started_at)} · {open.work_date.split("-").reverse().join("/")}
              </p>
              {jobLabel(open.contract_id) ? <p className="mt-1 text-[13px] font-semibold">{jobLabel(open.contract_id)}</p> : null}
            </div>
            <Field label="Ghi chú (không bắt buộc)">
              <input className={inputCls} value={clock.note} onChange={(e) => clock.setNote(e.target.value)} placeholder="Phát sinh, đi thêm điểm…" />
            </Field>
            <button type="button" onClick={() => s.clockOut(clock.note)} disabled={busy} className={btn("primary", "lg", "w-full")}>
              <Square size={16} /> {busy ? "Đang lưu…" : "Chấm công ra"}
            </button>
          </>
        ) : (
          <>
            <ClockInFields s={s} clock={clock} />
            <button type="button" onClick={() => s.clockIn({ studioId: clock.studioId, contractId: clock.contractId })} disabled={busy || !clock.studioId} className={btn("primary", "lg", "w-full")}>
              <Play size={16} /> {busy ? "Đang lưu…" : "Chấm công vào"}
            </button>
          </>
        )}
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
          Studio dùng số giờ này để đối soát tiền công, nên bạn không phải nhắc lại bằng tin nhắn. Giờ tính tiền do máy chủ chốt.
        </p>
      </section>

      <Section icon={CalendarCheck} title="Buổi gần đây" desc={s.sheet.length > 0 ? `Tổng ${humanHours(total)} · ${s.sheet.length} buổi` : "Chưa có buổi nào"} flush>
        {s.sheet.length === 0 ? (
          <Empty compact icon={CalendarCheck} title="Chưa có buổi chấm công nào" hint="Các buổi bạn chấm công sẽ hiện ở đây kèm số giờ." />
        ) : (
          <div>
            {s.sheet.map((r) => {
              const h = sessionHours(r);
              const range = [clockTime(r.startedAt), r.endedAt ? clockTime(r.endedAt) : "…"].join(" – ");
              return (
                <ListRow
                  key={r.id}
                  leading={
                    <span className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: "var(--blS)", color: "var(--bl)" }}>
                      <CalendarCheck size={16} />
                    </span>
                  }
                  title={dayLabel(r.workDate, todayVN())}
                  sub={[range, jobLabel(r.contractId), r.note].filter(Boolean).join(" · ")}
                  trailing={
                    // `null` = dòng còn hở hoặc dữ liệu sai. Nói thẳng, đừng hiện
                    // "0 phút" — thợ sẽ tưởng mình mất công.
                    h === null ? <Badge tone="amber">Cần studio sửa giờ</Badge> : <span className="v2-num text-[14px] font-semibold">{humanHours(h)}</span>
                  }
                />
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

