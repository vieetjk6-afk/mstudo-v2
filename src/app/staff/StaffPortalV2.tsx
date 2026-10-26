"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, Bell, CalendarCheck, CalendarDays, CalendarRange, Check, CheckCheck, CheckCircle2, ChevronRight,
  Circle, CircleDot, FileText, Hourglass, LayoutDashboard, ListChecks, LogIn, MapPin, Navigation, Phone, StickyNote,
  Users, Wand2, type LucideIcon,
} from "lucide-react";
import { CustomerHeaderV2, CustomerMainV2, CustomerRootV2 } from "@/components/v2/customer";
import {
  Avatar, Badge, Empty, GroupLabel, ListRow, Progress, Section, Stack, Stat, StatGrid, btn, iconBtn, toneBg, toneFg, type Tone,
} from "@/components/v2/kit";
import { Drawer, Segmented, Tabs } from "@/components/v2/kit-client";
import { useTheme } from "@/lib/theme";
import { addDays, apptDuration, apptTimeRange, apptTitle, kindMeta } from "@/lib/appointments";
import { daysFromToday, fmtDate, fmtDayMonth, fmtDow } from "@/lib/date";
import { notificationHref, notificationMeta, notificationText } from "@/lib/notifications";
import { PRODUCT_STATUS_LABEL, type AppointmentKind, type ProductStatus, type StudioAppointment } from "@/lib/types";
import type { StudioBrandInfo } from "@/lib/studio-brand";
import type { ChecklistRow, StaffPortalProps, TaskRow } from "./StaffPortal";
import {
  TASK_FLOW, TASK_TONE, isTaskLate, shortWhen, useApptCheckIn, useChecklist, useStaffNotifications, useStaffScope,
  useTaskFilter, useTaskItems, type TaskFilter,
} from "./useStaffPortal";
import { MobileTabBarV2, mapsHref, useFloatToast } from "./PortalBitsV2";

/* ═══════════════════════════════════════════════════════════════════════════
   TRANG CỦA TÔI (/staff) — giao diện mới. Một "app trong ngày" cho nhân viên
   ngoài hiện trường, đọc theo thứ tự người ta cần:
     1. Lời chào + ngày + một dòng tóm tắt; 4 số liệu (buổi hôm nay, việc hậu
        kỳ, hạn giao gần nhất, hợp đồng phụ trách).
     2. Tab "Hôm nay": dòng thời gian các buổi trong ngày — mỗi buổi một nút
        chính (check-in → hoàn thành), chỉ đường, gọi khách; cột phải là lịch
        sắp tới trong tuần và checklist sau buổi chụp.
     3. Tab "Việc của tôi": hàng đợi hậu kỳ nhóm theo hạn giao.
     4. Thông báo mở bằng ngăn kéo (chuông trên đầu trang / tab đáy).
   Dữ liệu y hệt bản cũ (cùng props từ page.tsx); mọi thao tác ghi đi qua các
   hook chung ở ./useStaffPortal. Trạng thái được giữ ở ĐÂY, trên toàn bộ danh
   sách, nên check-in rồi đổi tab / đổi phạm vi không bị mất.
   ═══════════════════════════════════════════════════════════════════════════ */

export type StaffPortalV2Props = StaffPortalProps & {
  brand: StudioBrandInfo;
  /** Màu chủ đạo người dùng chọn ở khu quản lý (mã hex từ ACCENTS). */
  accent: string;
  greeting: string;
  /** Tab mở sẵn (màn xem trước); trang thật luôn mở "Hôm nay". */
  initialTab?: StaffTab;
};

export type StaffTab = "today" | "tasks";
type Tab = StaffTab;

const DOW_LONG = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const utc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const dayName = (iso: string) => DOW_LONG[new Date(utc(iso)).getUTCDay()];

/** Màu nhãn theo loại lịch — cùng cặp màu APPOINTMENT_KIND_TONE, viết theo `Tone` của bộ khối. */
const KIND_TONE: Record<AppointmentKind, Tone> = {
  makeup: "brand",
  fitting: "blue",
  pre: "green",
  consult: "amber",
  shoot: "teal",
  delivery: "gray",
  other: "gray",
};

/** Khung gốc: token V2 + màu chủ đạo của người dùng (đặt ở phần tử CHA để `--ac` tính lại). */
function Root({ accent, children }: { accent?: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <div style={accent ? ({ ["--ac-base" as string]: accent } as React.CSSProperties) : undefined}>
      <CustomerRootV2 theme={theme}>{children}</CustomerRootV2>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function StaffPortalV2(p: StaffPortalV2Props) {
  const { toast, toastNode } = useFloatToast();
  const [tab, setTab] = useState<Tab>(p.initialTab ?? "today");
  const [notifOpen, setNotifOpen] = useState(false);

  // Trạng thái sống trên TOÀN BỘ danh sách (không phải bản đã lọc theo phạm vi).
  const { appts, advance } = useApptCheckIn(p.appointments, toast);
  const { items: taskItems, push } = useTaskItems(p.tasks, toast);
  const { checks, toggleTask } = useChecklist(p.checklist, toast);
  const notif = useStaffNotifications(p.notifications, toast);
  const { scope, setScope, canSeeAll, myAppts, myTasks, todayAppts, openTasks } = useStaffScope({
    me: p.me, actingRole: p.actingRole, appointments: appts, tasks: taskItems, today: p.today,
  });

  const upcoming = myAppts.filter((a) => a.appt_date > p.today).slice(0, 6);
  const overdueCount = openTasks.filter((t) => isTaskLate(t, p.today)).length;
  const checkedIn = todayAppts.filter((a) => a.status !== "scheduled").length;
  const monthCount = scope === "mine" ? p.myMonthApptCount : p.monthApptCount;
  const nearest = useMemo(
    () =>
      openTasks
        .filter((t) => !!t.contract?.delivery_due)
        .sort((a, b) => (a.contract!.delivery_due as string).localeCompare(b.contract!.delivery_due as string))[0] ?? null,
    [openTasks]
  );
  const firstName = p.meName.trim().split(/\s+/).pop() || "bạn";
  const unread = notif.unread.length;

  const nearestDue = nearest?.contract?.delivery_due ?? null;
  const nearestDays = nearestDue ? daysFromToday(nearestDue) : null;

  return (
    <Root accent={p.accent}>
      <CustomerHeaderV2
        brand={p.brand}
        sub="Trang của tôi"
        right={
          <>
            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              className={iconBtn("relative")}
              aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}
              title="Thông báo"
            >
              <Bell size={18} />
              {unread > 0 ? (
                <span
                  className="v2-num absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10.5px] font-bold"
                  style={{ background: "var(--rd)", color: "#fff", boxShadow: "0 0 0 2px var(--sf)" }}
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </button>
            <Link href="/dashboard/studio" className={btn("secondary", "sm", "hidden sm:inline-flex")}>
              <LayoutDashboard size={15} /> Khu quản lý
            </Link>
            <Link href="/dashboard/studio" className={iconBtn("sm:hidden")} aria-label="Khu quản lý" title="Khu quản lý">
              <LayoutDashboard size={18} />
            </Link>
          </>
        }
      />

      <CustomerMainV2 width={1120}>
        <Stack>
          {/* ── Lời chào ─────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-auto">
              <span className="max-sm:hidden">
                <Avatar name={p.meName} size={46} />
              </span>
              <div className="min-w-0">
                <h1 className="text-[22px] font-bold leading-tight max-sm:text-[20px]" style={{ letterSpacing: "-.5px" }}>
                  {p.greeting}, {firstName}
                </h1>
                <p className="mt-1 text-[13.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                  {dayName(p.today)}, {fmtDate(p.today)} ·{" "}
                  {todayAppts.length > 0 ? `${todayAppts.length} buổi hôm nay` : "hôm nay không có buổi nào"} ·{" "}
                  {openTasks.length > 0 ? `${openTasks.length} việc hậu kỳ đang mở` : "không còn việc hậu kỳ"}
                </p>
              </div>
            </div>
            {canSeeAll ? (
              <Segmented
                size="sm"
                label="Phạm vi"
                value={scope}
                onChange={setScope}
                options={[
                  { value: "mine", label: "Việc của tôi" },
                  { value: "all", label: "Cả studio" },
                ]}
              />
            ) : null}
          </div>

          {/* ── Số liệu (điện thoại: chỉ hiện ở tab Hôm nay) ──────────────── */}
          <div className={tab === "tasks" ? "max-md:hidden" : undefined}>
            <StatGrid cols={4}>
              <Stat
                label="Buổi hôm nay"
                value={todayAppts.length}
                sub={todayAppts.length > 0 ? `${checkedIn} đã check-in · ${monthCount} buổi tháng này` : `${monthCount} buổi trong tháng này`}
                icon={CalendarCheck}
                tone="brand"
              />
              <Stat
                label="Việc hậu kỳ"
                value={openTasks.length}
                valueTone={overdueCount > 0 ? "red" : undefined}
                sub={overdueCount > 0 ? `${overdueCount} việc trễ hạn` : "Không có việc trễ hạn"}
                icon={Wand2}
                tone="violet"
              />
              <Stat
                label="Hạn giao gần nhất"
                value={nearestDue ? fmtDayMonth(nearestDue) : "—"}
                valueTone={nearestDays !== null && nearestDays < 0 ? "red" : nearestDays !== null && nearestDays <= 2 ? "amber" : undefined}
                sub={nearest ? `${relDays(nearestDays)} · ${nearest.contract?.code || nearest.name}` : "Chưa có hạn giao nào"}
                icon={Hourglass}
                tone="amber"
              />
              <Stat label="Hợp đồng phụ trách" value={p.contractCount} sub="Đang thực hiện" icon={FileText} tone="teal" />
            </StatGrid>
          </div>

          {/* ── Tab trên máy tính (điện thoại dùng tab đáy) ─────────────── */}
          <div className="max-md:hidden">
            <Tabs
              label="Các phần của trang"
              value={tab}
              onChange={setTab}
              options={[
                { value: "today", label: "Hôm nay", icon: CalendarDays, count: todayAppts.length },
                { value: "tasks", label: "Việc của tôi", icon: Wand2, count: openTasks.length },
              ]}
            />
          </div>

          {tab === "today" ? (
            <TodayV2
              me={p.me}
              today={p.today}
              todayAppts={todayAppts}
              upcoming={upcoming}
              checks={checks}
              onAdvance={advance}
              onToggle={toggleTask}
            />
          ) : (
            <TasksV2 rows={myTasks} today={p.today} onPush={push} />
          )}
        </Stack>
      </CustomerMainV2>

      <MobileTabBarV2
        items={[
          { key: "today", label: "Hôm nay", icon: CalendarDays, active: tab === "today" && !notifOpen, onClick: () => setTab("today"), badge: todayAppts.length },
          { key: "tasks", label: "Việc của tôi", icon: Wand2, active: tab === "tasks" && !notifOpen, onClick: () => setTab("tasks"), badge: openTasks.length },
          { key: "notif", label: "Thông báo", icon: Bell, active: notifOpen, onClick: () => setNotifOpen(true), badge: unread, badgeTone: "red" },
        ]}
      />

      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} n={notif} />
      {toastNode}
    </Root>
  );
}

function relDays(d: number | null): string {
  if (d === null) return "";
  if (d < 0) return `trễ ${-d} ngày`;
  if (d === 0) return "hạn hôm nay";
  if (d === 1) return "hạn ngày mai";
  return `còn ${d} ngày`;
}

/* ═══ Tab "Hôm nay" ══════════════════════════════════════════════════════════ */
function TodayV2({
  me, today, todayAppts, upcoming, checks, onAdvance, onToggle,
}: {
  me: string;
  today: string;
  todayAppts: StudioAppointment[];
  upcoming: StudioAppointment[];
  checks: ChecklistRow[];
  onAdvance: (a: StudioAppointment) => void;
  onToggle: (t: ChecklistRow) => void;
}) {
  // Buổi kế tiếp chưa xong là buổi DUY NHẤT mang nút chính.
  const nextId = todayAppts.find((a) => a.status !== "done")?.id ?? null;
  const checkedIn = todayAppts.filter((a) => a.status !== "scheduled").length;
  const doneChecks = checks.filter((c) => c.done).length;

  return (
    <div className="grid grid-cols-1 gap-5 min-[1080px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] min-[1080px]:items-start">
      <Section
        icon={CalendarDays}
        title="Lịch hôm nay"
        desc={todayAppts.length > 0 ? `${todayAppts.length} buổi · ${checkedIn} đã check-in` : fmtDate(today)}
        actions={
          <Link href="/dashboard/studio/calendar?tab=studio" className={btn("ghost", "sm")}>
            Lịch studio <ChevronRight size={15} />
          </Link>
        }
        flush
      >
        {todayAppts.length === 0 ? (
          <Empty compact icon={CalendarDays} title="Hôm nay chưa có buổi nào" hint="Lịch được studio xếp ở màn Lịch studio sẽ hiện tại đây." />
        ) : (
          <div>
            {todayAppts.map((a, i) => (
              <TimelineRow key={a.id} a={a} me={me} isNext={a.id === nextId} last={i === todayAppts.length - 1} onAdvance={onAdvance} />
            ))}
          </div>
        )}
      </Section>

      <div className="flex min-w-0 flex-col gap-5">
        <Section
          icon={CalendarRange}
          title="Sắp tới trong tuần"
          desc={upcoming.length > 0 ? `${upcoming.length} buổi trong 7 ngày tới` : "Chưa có buổi nào trong 7 ngày tới"}
          flush
        >
          {upcoming.length === 0 ? (
            <Empty compact icon={CalendarRange} title="Tuần này trống" hint="Chưa có buổi nào được xếp trong 7 ngày tới." />
          ) : (
            <div>
              {upcoming.map((a) => {
                const { tone, Icon } = kindMeta(a.kind);
                return (
                  <ListRow
                    key={a.id}
                    leading={
                      <span
                        className="flex h-[44px] w-[44px] flex-col items-center justify-center gap-0.5 rounded-[11px]"
                        style={{ background: tone.soft, color: tone.fg }}
                      >
                        <Icon size={14} />
                        <span className="v2-num text-[11px] font-bold leading-none">{fmtDayMonth(a.appt_date)}</span>
                      </span>
                    }
                    title={apptTitle(a)}
                    sub={[`${fmtDow(a.appt_date)} · ${apptTimeRange(a)}`, a.location].filter(Boolean).join(" · ")}
                    href={a.contract_id ? `/dashboard/studio/contracts/${a.contract_id}` : undefined}
                  />
                );
              })}
            </div>
          )}
        </Section>

        <Section
          icon={ListChecks}
          title="Việc sau buổi chụp"
          desc={checks.length > 0 ? `${doneChecks}/${checks.length} việc đã xong` : "Checklist của hợp đồng bạn phụ trách"}
          flush
        >
          {checks.length === 0 ? (
            <Empty compact icon={CheckCircle2} title="Chưa có việc nào" hint="Checklist của hợp đồng bạn phụ trách sẽ hiện ở đây." />
          ) : (
            <div>
              <div className="px-5 pb-1 pt-3.5 max-sm:px-4">
                <Progress value={(doneChecks / checks.length) * 100} tone="green" />
              </div>
              {checks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onToggle(t)}
                  aria-pressed={t.done}
                  className="v2-row v2-row-link w-full items-start text-left"
                >
                  {t.done ? (
                    <CheckCircle2 size={19} style={{ flex: "none", color: "var(--gn)", marginTop: 1 }} />
                  ) : (
                    <Circle size={19} style={{ flex: "none", color: "var(--tx3)", marginTop: 1 }} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className="block text-[13.5px] font-medium"
                      style={{ color: t.done ? "var(--tx3)" : "var(--tx)", textDecoration: t.done ? "line-through" : "none", textWrap: "pretty" }}
                    >
                      {t.label}
                    </span>
                    <span className="v2-row-sub block">
                      {t.contract_code ? `${t.contract_code} · ` : ""}
                      {t.contract_title}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

/** Một buổi trên dòng thời gian: giờ · chấm · nội dung + một nút chính. */
function TimelineRow({
  a, me, isNext, last, onAdvance,
}: {
  a: StudioAppointment;
  me: string;
  isNext: boolean;
  last: boolean;
  onAdvance: (a: StudioAppointment) => void;
}) {
  const { label, tone, Icon } = kindMeta(a.kind);
  const done = a.status === "done";
  const place = [a.room, a.location].filter(Boolean).join(" · ");
  const contractHref = a.contract_id ? `/dashboard/studio/contracts/${a.contract_id}` : null;
  const mine = !!a.staff_id && a.staff_id === me;
  return (
    <div className="flex gap-3 px-5 max-sm:gap-2.5 max-sm:px-4" style={{ background: isNext ? "color-mix(in srgb, var(--acS) 45%, transparent)" : undefined }}>
      {/* Giờ */}
      <div className="w-[50px] flex-none pt-4 text-right max-sm:w-[44px]">
        <p className="v2-num text-[14px] font-bold leading-none" style={{ color: isNext ? "var(--ac)" : done ? "var(--tx3)" : "var(--tx)" }}>
          {a.start_time || "—"}
        </p>
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>{apptDuration(a)}</p>
      </div>
      {/* Chấm + đường kẻ */}
      <div className="flex w-[12px] flex-none flex-col items-center pt-[18px]">
        <span
          className="h-[11px] w-[11px] flex-none rounded-full"
          style={{
            background: done || a.status === "checked_in" ? "var(--gn)" : tone.fg,
            boxShadow: `0 0 0 3px ${done || a.status === "checked_in" ? "var(--gnS)" : tone.soft}`,
          }}
        />
        {!last ? <span className="mt-1.5 w-[2px] flex-1" style={{ background: "var(--bd2)" }} /> : null}
      </div>
      {/* Nội dung */}
      <div className="min-w-0 flex-1 py-3.5" style={{ borderBottom: last ? undefined : "1px solid var(--bd2)" }}>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={KIND_TONE[a.kind] ?? "gray"} icon={Icon}>{label}</Badge>
          {a.status === "checked_in" ? <Badge tone="green" dot>Đã check-in</Badge> : null}
          {done ? <Badge tone="green" icon={Check}>Đã hoàn tất</Badge> : null}
          {isNext && a.status === "scheduled" ? <Badge tone="brand">Tiếp theo</Badge> : null}
        </div>
        {contractHref ? (
          <Link href={contractHref} className="mt-1.5 block text-[15px] font-semibold leading-snug hover:underline" style={{ textWrap: "pretty", color: done ? "var(--tx2)" : undefined }}>
            {apptTitle(a)}
          </Link>
        ) : (
          <p className="mt-1.5 text-[15px] font-semibold leading-snug" style={{ textWrap: "pretty", color: done ? "var(--tx2)" : undefined }}>
            {apptTitle(a)}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]" style={{ color: "var(--tx2)" }}>
          {place ? (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin size={14} style={{ color: "var(--tx3)", flex: "none" }} />
              <span className="min-w-0" style={{ textWrap: "pretty" }}>{place}</span>
            </span>
          ) : null}
          {a.client_phone ? (
            <a href={`tel:${a.client_phone}`} className="v2-num flex items-center gap-1 hover:underline">
              <Phone size={14} style={{ color: "var(--tx3)" }} /> {a.client_phone}
            </a>
          ) : null}
          <span className="flex items-center gap-1">
            <Users size={14} style={{ color: "var(--tx3)" }} />
            {mine ? "Bạn phụ trách" : a.crew_name || "Chưa phân công"}
          </span>
        </div>
        {a.note ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-[10px] px-2.5 py-2 text-[12.5px]" style={{ background: "var(--amS)", color: "var(--tx2)" }}>
            <StickyNote size={15} style={{ flex: "none", color: "var(--am)", marginTop: 1 }} />
            <span style={{ textWrap: "pretty" }}>{a.note}</span>
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!done ? (
            <button type="button" onClick={() => onAdvance(a)} className={btn(isNext ? "primary" : "secondary", "sm")}>
              {a.status === "scheduled" ? (
                <>
                  <CircleDot size={15} /> Check-in
                </>
              ) : (
                <>
                  <Check size={15} /> Hoàn thành
                </>
              )}
            </button>
          ) : contractHref ? (
            <Link href={contractHref} className={btn("ghost", "sm")}>
              <FileText size={15} /> Mở hợp đồng
            </Link>
          ) : null}
          {a.location ? (
            <a href={mapsHref(a.location)} target="_blank" rel="noopener noreferrer" className={iconBtn()} aria-label="Chỉ đường" title="Chỉ đường">
              <Navigation size={17} />
            </a>
          ) : null}
          {a.client_phone ? (
            <a href={`tel:${a.client_phone}`} className={iconBtn()} aria-label="Gọi khách" title="Gọi khách">
              <Phone size={17} />
            </a>
          ) : null}
          {!done && contractHref ? (
            // Điện thoại: tiêu đề đã là link hợp đồng — bớt một nút cho hàng thao tác khỏi xuống dòng.
            <Link href={contractHref} className={iconBtn("max-sm:hidden")} aria-label="Mở hợp đồng" title="Mở hợp đồng">
              <FileText size={17} />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ═══ Tab "Việc của tôi" — hàng đợi hậu kỳ ═══════════════════════════════════ */
const STATUS_ICON: Record<ProductStatus, LucideIcon> = { ordered: CircleDot, in_progress: Wand2, done: CheckCircle2 };
const STATUS_TONE: Record<ProductStatus, Tone> = { ordered: "gray", in_progress: "blue", done: "green" };

type DueKey = "late" | "today" | "week" | "later" | "none" | "done";
const DUE_GROUPS: { key: DueKey; label: string }[] = [
  { key: "late", label: "Trễ hạn" },
  { key: "today", label: "Hạn hôm nay" },
  { key: "week", label: "Trong 7 ngày tới" },
  { key: "later", label: "Sau đó" },
  { key: "none", label: "Chưa đặt hạn" },
  { key: "done", label: "Đã giao" },
];

function dueKey(r: TaskRow, today: string): DueKey {
  if (r.status === "done") return "done";
  const due = r.contract?.delivery_due;
  if (!due) return "none";
  if (due < today) return "late";
  if (due === today) return "today";
  if (due <= addDays(today, 7)) return "week";
  return "later";
}

function TasksV2({ rows, today, onPush }: { rows: TaskRow[]; today: string; onPush: (r: TaskRow) => void }) {
  const { filter, setFilter, counts, overdue, visible } = useTaskFilter(rows, today);
  const groups = DUE_GROUPS.map((g) => ({ ...g, rows: visible.filter((r) => dueKey(r, today) === g.key) })).filter((g) => g.rows.length);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 max-w-full">
          <Segmented<TaskFilter>
            label="Lọc theo trạng thái"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Tất cả", count: counts.all ?? 0 },
              { value: "ordered", label: PRODUCT_STATUS_LABEL.ordered, count: counts.ordered ?? 0 },
              { value: "in_progress", label: PRODUCT_STATUS_LABEL.in_progress, count: counts.in_progress ?? 0 },
              { value: "done", label: PRODUCT_STATUS_LABEL.done, count: counts.done ?? 0 },
            ]}
          />
        </div>
        {overdue.length > 0 ? (
          <span className="ml-auto">
            <Badge tone="red" icon={AlertCircle}>{overdue.length} việc trễ hạn</Badge>
          </span>
        ) : null}
      </div>

      <div className="v2-card">
        {visible.length === 0 ? (
          <Empty compact icon={CheckCircle2} title="Không còn việc nào ở nhóm này" hint="Chọn nhóm khác, hoặc chờ studio giao việc mới." />
        ) : (
          <div className="pb-1.5">
            {groups.map((g) => (
              <div key={g.key}>
                <div className="px-5 pb-1 pt-3.5 max-sm:px-4">
                  <GroupLabel count={g.rows.length}>
                    <span style={g.key === "late" ? { color: "var(--rd)" } : undefined}>{g.label}</span>
                  </GroupLabel>
                </div>
                {g.rows.map((r) => (
                  <TaskRowV2 key={r.id} r={r} today={today} onPush={onPush} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
        <Wand2 size={14} style={{ flex: "none" }} /> Cùng danh sách với màn “Xử lý hình ảnh” của khu quản lý — đổi ở đây là đổi ở đó.
      </p>
    </div>
  );
}

function TaskRowV2({ r, today, onPush }: { r: TaskRow; today: string; onPush: (r: TaskRow) => void }) {
  const flow = TASK_FLOW[r.status];
  const tone = TASK_TONE[r.status];
  const Icon = STATUS_ICON[r.status];
  const due = r.contract?.delivery_due ?? null;
  const late = isTaskLate(r, today);
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 border-b border-[var(--bd2)] px-5 py-3 last:border-b-0 max-sm:px-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]" style={{ background: toneBg(STATUS_TONE[r.status]), color: toneFg(STATUS_TONE[r.status]) }}>
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold leading-snug" style={{ textWrap: "pretty" }}>{r.name}</p>
        <p className="v2-row-sub">
          {[r.contract?.code, r.contract?.client_name || r.contract?.title].filter(Boolean).join(" · ") || "—"}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <Badge tone={STATUS_TONE[r.status]} dot>{PRODUCT_STATUS_LABEL[r.status]}</Badge>
          <span className="v2-num text-[12.5px] font-semibold" style={{ color: late ? "var(--rd)" : "var(--tx2)" }}>
            {due ? `${late ? "Trễ" : "Hạn"} ${fmtDayMonth(due)}` : "Chưa đặt hạn"}
          </span>
          <span className="v2-num text-[12.5px]" style={{ color: "var(--tx3)" }}>{r.qty} cái</span>
          <span className="w-[72px] max-sm:hidden">
            <Progress value={tone.pct} tone={STATUS_TONE[r.status] === "gray" ? "brand" : STATUS_TONE[r.status]} />
          </span>
        </div>
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-3 sm:justify-end">
        <button type="button" onClick={() => onPush(r)} className={btn(flow.next ? "soft" : "ghost", "sm")}>
          <flow.Icon size={15} /> {flow.btn}
        </button>
        {r.contract?.id ? (
          <Link href={`/dashboard/studio/contracts/${r.contract.id}`} className={iconBtn()} aria-label="Chi tiết hợp đồng" title="Chi tiết hợp đồng">
            <ChevronRight size={18} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/* ═══ Thông báo — ngăn kéo ═══════════════════════════════════════════════════ */
function NotificationsDrawer({
  open, onClose, n,
}: {
  open: boolean;
  onClose: () => void;
  n: ReturnType<typeof useStaffNotifications>;
}) {
  const unread = n.unread.length;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Thông báo"
      desc={unread > 0 ? `${unread} thông báo chưa đọc` : "Bạn đã đọc hết thông báo"}
      width={460}
      footer={
        unread > 0 ? (
          <button type="button" onClick={n.markAllRead} className={btn("secondary", "md", "w-full")}>
            <CheckCheck size={16} /> Đánh dấu đã đọc tất cả
          </button>
        ) : undefined
      }
    >
      {n.items.length === 0 ? (
        <Empty compact icon={Bell} title="Chưa có thông báo nào" hint="Nhắc lịch, phân công và thay đổi hợp đồng đều báo về đây." />
      ) : (
        <div className="-mx-5 -mt-2 flex flex-col">
          {n.groups.map((g) => (
            <div key={g.label}>
              <div className="px-5 pb-1 pt-3">
                <GroupLabel count={g.rows.length}>{g.label}</GroupLabel>
              </div>
              {g.rows.map((row) => {
                const { Icon, fg, soft } = notificationMeta(row.kind);
                const href = notificationHref(row);
                const read = () => {
                  if (!row.read) n.markRead([row.id]);
                };
                return (
                  <div
                    key={row.id}
                    className="flex items-start gap-3 px-5 py-3"
                    style={{ borderBottom: "1px solid var(--bd2)", background: row.read ? undefined : "color-mix(in srgb, var(--acS) 55%, transparent)" }}
                  >
                    <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-[10px]" style={{ background: soft, color: fg }}>
                      <Icon size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={read} className="block w-full text-left">
                        <span className="block text-[13.5px] leading-snug" style={{ fontWeight: row.read ? 450 : 650, textWrap: "pretty" }}>
                          {notificationText(row)}
                        </span>
                      </button>
                      {href ? (
                        <Link href={href} onClick={read} className="mt-1 inline-flex items-center gap-0.5 text-[12.5px] font-semibold" style={{ color: "var(--ac)" }}>
                          Xem chi tiết <ChevronRight size={14} />
                        </Link>
                      ) : null}
                    </div>
                    <div className="flex flex-none flex-col items-end gap-1.5 pt-0.5">
                      <span className="v2-num text-[11.5px]" style={{ color: "var(--tx3)" }}>{shortWhen(row.created_at, n.today)}</span>
                      {!row.read ? <span className="h-2 w-2 rounded-full" style={{ background: "var(--ac)" }} aria-label="Chưa đọc" /> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}

/* ═══ Chưa đăng nhập / không có quyền studio ═════════════════════════════════ */
export function StaffSignInV2() {
  return (
    <Root>
      <main
        className="mx-auto flex min-h-[80vh] w-full max-w-[440px] flex-col justify-center py-10"
        style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}
      >
        <div className="v2-card v2-card-pad flex flex-col gap-4 sm:!px-7 sm:!py-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
            <LogIn size={22} />
          </span>
          <div>
            <h1 className="text-[21px] font-bold" style={{ letterSpacing: "-.4px" }}>Cần đăng nhập tài khoản studio</h1>
            <p className="mt-1 text-[14px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
              Cổng nhân viên dành cho tài khoản được studio cấp. Nếu bạn là cộng tác viên tự do, hãy mở cổng tra việc theo số điện thoại.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/login" className={btn("primary", "lg", "w-full")}>
              Đăng nhập
            </Link>
            <Link href="/crew" className={btn("secondary", "lg", "w-full")}>
              Cổng cộng tác viên
            </Link>
          </div>
        </div>
      </main>
    </Root>
  );
}
