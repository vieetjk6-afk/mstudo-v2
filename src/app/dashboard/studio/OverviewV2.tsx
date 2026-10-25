"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus, ReceiptText, CalendarDays, CalendarCheck, TrendingUp, Hourglass, Landmark, ListChecks, Wallet,
  UserPlus, Banknote, Clock, ImagePlus, PenLine, CircleAlert, Users, Star, CalendarClock, CalendarRange,
  ChevronRight, QrCode, AlertTriangle, Gift, CheckCircle2, Globe, Images, Inbox, Sparkles, type LucideIcon,
} from "lucide-react";
import {
  Avatar, Badge, Callout, Empty, GroupLabel, ListRow, PageHead, Section, Stack, Stat, StatGrid, btn, iconBtn, toneBg, toneFg,
} from "@/components/v2/kit";
import { Modal } from "@/components/v2/kit-client";
import CollectButton from "@/components/studio/CollectButton";
import MessengerButton from "@/components/MessengerButton";
import AutoEmailToggle from "@/components/AutoEmailToggle";
import StudioTrialButton from "@/components/StudioTrialButton";
import { VietQR } from "@/components/VietQR";
import type { BankInfo } from "@/lib/vietqr";
import { vnd, vndShort } from "@/lib/types";
import { fmtDate, fmtDayMonth } from "@/lib/date";
import type {
  OvAct, OvBooking, OvScheduleRow, OvTask, OvTaskKind, OverviewBookingV2Data, OverviewV2Data,
} from "./OverviewTypes";

/* ═══════════════════════════════════════════════════════════════════════════
   TỔNG QUAN — giao diện mới. Cùng dữ liệu page.tsx đã tải và tính cho bản cũ;
   khác ở cách sắp xếp, theo đúng thứ tự người ta nhìn mỗi sáng:
     1. Lời chào + một dòng tóm tắt hôm nay, 4 số liệu.
     2. Cột trái (rộng): "Việc cần làm hôm nay" gom theo mức gấp, rồi "Tiền cần
        thu" (chờ đối soát · quá hạn · tới hạn 7 ngày) — mọi nút thu/QR/nhắc
        nằm ngay trên dòng.
        Cột phải: "Lịch chụp" theo ngày (kèm cảnh báo dồn lịch), "Hạn giao ảnh".
     3. "Theo dõi thêm": doanh thu 6 tháng, hợp đồng đang tắc, khách cũ tới mốc
        kỷ niệm, và công tắc tự email.
   ═══════════════════════════════════════════════════════════════════════════ */

const DOW_LONG = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const utc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const dayName = (iso: string) => DOW_LONG[new Date(utc(iso)).getUTCDay()];
const dayDiff = (iso: string, today: string) => Math.round((utc(iso) - utc(today)) / 86400000);
function dayLabel(iso: string | null, today: string) {
  if (!iso) return "Chưa có ngày";
  const d = dayDiff(iso, today);
  if (d === 0) return "Hôm nay";
  if (d === 1) return "Ngày mai";
  return `${dayName(iso)} · ${fmtDayMonth(iso)}`;
}

const KIND_ICON: Record<OvTaskKind, LucideIcon> = {
  crew: UserPlus, proof: Banknote, bank: Landmark, plan: Banknote, "plan-soon": CalendarClock, late: Clock,
  album: ImagePlus, sign: PenLine, quote: ReceiptText, edit: CircleAlert, pcrew: Users, reviews: Star,
};
const MONEY: OvTaskKind[] = ["proof", "bank", "plan"];

/* ── Nút QR thu tiền (mở hộp thoại V2, dùng lại mã VietQR có sẵn) ────────── */
function QrButton({ bank, amount, addInfo }: { bank: BankInfo; amount: number; addInfo: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={iconBtn()} aria-label="Mã QR chuyển khoản" title="Mã QR chuyển khoản">
        <QrCode size={17} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Quét mã để chuyển khoản" desc="Gửi mã này cho khách, nội dung chuyển khoản đã điền sẵn." width={380}>
        <VietQR bank={bank} amount={amount} addInfo={addInfo} />
      </Modal>
    </>
  );
}

/* ── Một việc: icon · tiêu đề + dòng phụ · thao tác tại chỗ ──────────────── */
function TaskActions({ t, bank }: { t: OvTask; bank: BankInfo }) {
  const a: OvAct | undefined = t.act;
  const open = (
    <Link href={t.href} className={iconBtn()} aria-label={t.cta} title={t.cta}>
      <ChevronRight size={18} />
    </Link>
  );
  if (!a)
    return (
      <Link href={t.href} className={btn("secondary", "sm")}>
        {t.cta}
      </Link>
    );
  if (a.kind === "collect")
    return (
      <>
        <CollectButton planId={a.planId} contractId={a.contractId} amountLabel={a.amountLabel} />
        {open}
      </>
    );
  if (a.kind === "qr")
    return (
      <>
        <QrButton bank={bank} amount={a.amount} addInfo={a.addInfo} />
        {a.contractId && <CollectButton planId={a.planId} contractId={a.contractId} amountLabel={a.amountLabel} />}
        {open}
      </>
    );
  return (
    <>
      <MessengerButton link={a.link} label={a.label} message={a.message} className={btn("secondary", "sm")} />
      {open}
    </>
  );
}

function TaskRow({ t, bank }: { t: OvTask; bank: BankInfo }) {
  const Icon = KIND_ICON[t.kind];
  return (
    <div className="grid border-b border-[var(--bd2)] last:border-b-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 px-5 py-3 max-sm:px-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
      <span
        className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]"
        style={{ background: toneBg(t.tone), color: toneFg(t.tone) }}
      >
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <Link href={t.href} className="block text-[14px] font-semibold leading-snug hover:underline" style={{ textWrap: "pretty" }}>
          {t.title}
        </Link>
        <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "var(--tx3)" }}>
          <span className="font-semibold" style={{ color: toneFg(t.tone) }}>{t.tag}</span> · {t.sub}
        </p>
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-3 sm:justify-end">
        <TaskActions t={t} bank={bank} />
      </div>
    </div>
  );
}

function Group({ label, count, children }: { label: React.ReactNode; count?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-5 pb-1 pt-3.5 max-sm:px-4">
        <GroupLabel count={count}>{label}</GroupLabel>
      </div>
      {children}
    </div>
  );
}

const TASK_GROUPS: { tone: OvTask["tone"][]; label: string }[] = [
  { tone: ["red"], label: "Gấp" },
  { tone: ["amber"], label: "Đang chờ khách hoặc bạn" },
  { tone: ["blue", "teal", "brand", "green", "gray"], label: "Nên làm" },
];

function groupTasks(list: OvTask[]) {
  return TASK_GROUPS.map((g) => ({ label: g.label, rows: list.filter((t) => g.tone.includes(t.tone)) })).filter((g) => g.rows.length);
}

const VISIBLE_TASKS = 7;
/* Cột của lưới chính: trên máy tính là một cột xếp dọc; trên điện thoại "tan"
   ra (display: contents) để bốn khối xếp theo `order`: việc → lịch → tiền → hạn giao. */
const COL = "contents min-[1180px]:flex min-[1180px]:min-w-0 min-[1180px]:flex-col min-[1180px]:gap-5";

/* ── Biểu đồ doanh thu 6 tháng (cột) ─────────────────────────────────────── */
function RevenueBars({ bars }: { bars: { label: string; value: number }[] }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="flex h-[150px] items-end gap-2.5">
      {bars.map((b, i) => {
        const last = i === bars.length - 1;
        return (
          <div key={b.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="v2-num text-[11px] font-semibold" style={{ color: last ? "var(--tx)" : "var(--tx3)" }}>
              {b.value > 0 ? vndShort(b.value) : ""}
            </span>
            <div
              className="w-full max-w-[40px] rounded-t-[6px]"
              style={{
                height: `${Math.max(3, (b.value / max) * 100)}%`,
                minHeight: 4,
                background: b.value > 0 ? (last ? "var(--ac)" : "color-mix(in srgb, var(--ac) 38%, var(--sf))") : "var(--bd2)",
              }}
            />
            <span className="text-[11.5px] font-semibold" style={{ color: last ? "var(--tx)" : "var(--tx3)" }}>{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function deltaText(pct: number | null) {
  if (pct == null) return null;
  return (
    <span className="font-semibold" style={{ color: pct >= 0 ? "var(--gn)" : "var(--rd)" }}>
      {pct >= 0 ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

/* ── Lịch chụp theo ngày ─────────────────────────────────────────────────── */
const SCHEDULE_ROWS = 8;

function ScheduleList({ rows, today }: { rows: OvScheduleRow[]; today: string }) {
  const shown = rows.slice(0, SCHEDULE_ROWS);
  const days: { date: string | null; rows: OvScheduleRow[] }[] = [];
  for (const r of shown) {
    const last = days[days.length - 1];
    if (last && last.date === r.event_date) last.rows.push(r);
    else days.push({ date: r.event_date, rows: [r] });
  }
  return (
    <>
      {days.map((d) => (
        <Group key={d.date ?? "none"} label={dayLabel(d.date, today)} count={`${d.rows.length} buổi`}>
          {d.rows.map((r) => {
            const isToday = r.event_date === today;
            const unsigned = r.status === "draft" || r.status === "sent";
            return (
              <Link key={r.id} href={`/dashboard/studio/contracts/${r.id}`} className="v2-row v2-row-link items-start">
                <span
                  className="v2-num w-[46px] flex-none pt-px text-[13px] font-bold"
                  style={{ color: isToday ? "var(--ac)" : "var(--tx2)" }}
                >
                  {r.event_time || "—"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="v2-row-title block">{r.title}</span>
                  <span className="v2-row-sub block">
                    {[r.client_name || "Chưa có tên khách", r.location].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {unsigned ? (
                  <Badge tone="amber">Chưa ký</Badge>
                ) : r.crewCount === 0 ? (
                  <Badge tone="red">Chưa có người</Badge>
                ) : (
                  <span className="flex-none pt-0.5 text-[12px]" style={{ color: "var(--tx3)" }}>
                    {r.crewCount} người
                  </span>
                )}
              </Link>
            );
          })}
        </Group>
      ))}
      {rows.length > SCHEDULE_ROWS && (
        <p className="px-5 pb-3 pt-1 text-[12.5px] max-sm:px-4" style={{ color: "var(--tx3)" }}>
          và {rows.length - SCHEDULE_ROWS} buổi nữa
        </p>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function OverviewV2(d: OverviewV2Data) {
  const work = d.tasks.filter((t) => !MONEY.includes(t.kind));
  const proofs = d.tasks.filter((t) => t.kind === "proof" || t.kind === "bank");
  const overdue = d.tasks.filter((t) => t.kind === "plan");
  const moneyCount = proofs.length + overdue.length + d.dueSoon.length;
  const urgentCount = d.tasks.filter((t) => t.tone === "red").length;
  const todayCount = d.schedule.filter((r) => r.event_date === d.today).length;
  const visible = work.slice(0, VISIBLE_TASKS);
  const hidden = work.slice(VISIBLE_TASKS);

  const jobsSub =
    d.jobsDelta === 0 ? "bằng hôm qua" : d.jobsDelta > 0 ? `nhiều hơn hôm qua ${d.jobsDelta} buổi` : `ít hơn hôm qua ${-d.jobsDelta} buổi`;

  return (
    <Stack>
      <PageHead
        title={`${d.greeting}, ${d.firstName}`}
        desc={
          <>
            {dayName(d.today)}, {fmtDate(d.today)} · {d.todayJobs > 0 ? `${d.todayJobs} buổi chụp hôm nay` : "hôm nay không có buổi chụp"} ·{" "}
            {d.tasks.length > 0 ? `${d.tasks.length} việc đang chờ bạn` : "không còn việc nào treo"}
          </>
        }
        actions={
          <>
            <Link href="/dashboard/studio/quotes/new" className={btn("secondary")}>
              <ReceiptText size={16} /> Báo giá mới
            </Link>
            <Link href="/dashboard/studio/contracts/new" className={btn("primary")}>
              <Plus size={17} /> Hợp đồng mới
            </Link>
          </>
        }
      />

      <StatGrid>
        <Stat label="Buổi chụp hôm nay" value={d.todayJobs} sub={jobsSub} icon={CalendarCheck} tone="brand" href="#lich-chup" />
        <Stat
          label={`Doanh thu tháng ${d.vnMonth}`}
          value={vndShort(d.revenueMonth)}
          sub={
            <>
              {deltaText(d.revDeltaPct)}
              {d.revDeltaPct != null ? " so với tháng trước" : `${d.contractsCount} hợp đồng đang có`}
            </>
          }
          icon={TrendingUp}
          tone="green"
          href="#doanh-thu"
        />
        <Stat
          label="Việc đang chờ bạn"
          value={d.tasks.length}
          valueTone={urgentCount > 0 ? "red" : d.tasks.length > 0 ? "amber" : undefined}
          sub={d.tasks.length === 0 ? "Không còn việc nào treo" : urgentCount > 0 ? `${urgentCount} việc gấp` : "chưa có việc gấp"}
          icon={Hourglass}
          tone="amber"
          href="#viec-can-lam"
        />
        <Stat
          label="Công nợ khách"
          value={vndShort(d.totalDue)}
          valueTone={d.overdueDebtsCount > 0 ? "red" : undefined}
          sub={`trên ${d.debtsCount} hợp đồng${d.overdueDebtsCount > 0 ? ` · ${d.overdueDebtsCount} quá hạn` : ""}`}
          icon={Landmark}
          tone="red"
          href="#tien-can-thu"
        />
      </StatGrid>

      <div className="flex flex-col gap-5 min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] min-[1180px]:items-start">
        {/* ── Cột trái: việc + tiền ─────────────────────────────────────── */}
        <div className={COL}>
          <Section
            id="viec-can-lam"
            className="order-1"
            icon={ListChecks}
            title="Việc cần làm hôm nay"
            desc="Xử lý xong việc nào, việc đó tự biến mất khỏi danh sách"
            actions={work.length > 0 ? <Badge tone={urgentCount > 0 ? "red" : "amber"}>{work.length} việc</Badge> : undefined}
            flush
          >
            {work.length === 0 ? (
              <Empty
                compact
                icon={CheckCircle2}
                title="Không còn việc nào đang treo"
                hint={moneyCount > 0 ? `Chỉ còn ${moneyCount} khoản tiền ở khối "Tiền cần thu" bên dưới.` : "Mọi hợp đồng, phân công và lịch giao ảnh đều đang đúng hạn."}
              />
            ) : (
              <div className="pb-1.5">
                {groupTasks(visible).map((g) => (
                  <Group key={g.label} label={g.label} count={g.rows.length}>
                    {g.rows.map((t) => <TaskRow key={t.key} t={t} bank={d.bank} />)}
                  </Group>
                ))}
                {hidden.length > 0 && (
                  <details className="group">
                    <summary
                      className="mx-5 my-2 inline-flex cursor-pointer list-none items-center gap-1 text-[13px] font-semibold max-sm:mx-4"
                      style={{ color: "var(--ac)" }}
                    >
                      Xem thêm {hidden.length} việc <ChevronRight size={15} className="transition-transform group-open:rotate-90" />
                    </summary>
                    {groupTasks(hidden).map((g) => (
                      <Group key={g.label} label={g.label} count={g.rows.length}>
                        {g.rows.map((t) => <TaskRow key={t.key} t={t} bank={d.bank} />)}
                      </Group>
                    ))}
                  </details>
                )}
              </div>
            )}
          </Section>

          <Section
            id="tien-can-thu"
            className="order-3"
            icon={Wallet}
            title="Tiền cần thu"
            desc={
              d.totalDue > 0
                ? `Khách còn nợ ${vnd(d.totalDue)} trên ${d.debtsCount} hợp đồng`
                : "Khách đã thanh toán đủ mọi hợp đồng"
            }
            actions={
              <Link href="/dashboard/studio/contracts" className={btn("ghost", "sm")}>
                Hợp đồng <ChevronRight size={15} />
              </Link>
            }
            flush
          >
            {moneyCount === 0 ? (
              <Empty compact icon={Wallet} title="Không có khoản nào cần thu tuần này" hint="Đợt thu quá hạn, tới hạn trong 7 ngày và khoản khách báo đã chuyển sẽ hiện ở đây." />
            ) : (
              <div className="pb-1.5">
                {proofs.length > 0 && (
                  <Group label="Khách báo đã chuyển — chờ bạn xác nhận" count={proofs.length}>
                    {proofs.map((t) => <TaskRow key={t.key} t={t} bank={d.bank} />)}
                  </Group>
                )}
                {overdue.length > 0 && (
                  <Group label="Quá hạn" count={overdue.length}>
                    {overdue.map((t) => <TaskRow key={t.key} t={t} bank={d.bank} />)}
                  </Group>
                )}
                {d.dueSoon.length > 0 && (
                  <Group label="Tới hạn trong 7 ngày" count={d.dueSoon.length}>
                    {d.dueSoon.map((t) => <TaskRow key={t.key} t={t} bank={d.bank} />)}
                  </Group>
                )}
              </div>
            )}
          </Section>
        </div>

        {/* ── Cột phải: lịch + hạn giao ─────────────────────────────────── */}
        <div className={COL}>
          <Section
            id="lich-chup"
            className="order-2"
            icon={CalendarDays}
            title="Lịch chụp"
            desc={`${todayCount} buổi hôm nay · ${d.schedule.length - todayCount} buổi sắp tới`}
            actions={
              <Link href="/dashboard/studio/calendar" className={btn("ghost", "sm")}>
                Xem lịch <ChevronRight size={15} />
              </Link>
            }
            flush
          >
            {d.warns.length > 0 && (
              <div className="flex flex-col gap-2 px-5 pt-4 max-sm:px-4">
                {d.warns.map((w) => (
                  <Callout key={w.key} tone={w.tone} icon={w.kind === "day" ? CalendarRange : CircleAlert} title={w.title}>
                    {w.sub}
                  </Callout>
                ))}
              </div>
            )}
            {d.schedule.length === 0 ? (
              <Empty compact icon={CalendarDays} title="Chưa có buổi chụp nào sắp tới" hint="Tạo hợp đồng hoặc nhận đặt lịch để lấp lịch tuần này." />
            ) : (
              <div className="pb-1.5">
                <ScheduleList rows={d.schedule} today={d.today} />
              </div>
            )}
          </Section>

          <Section
            className="order-4"
            icon={CalendarClock}
            title="Hạn giao ảnh"
            desc="Đếm ngược theo hạn giao ghi trong hợp đồng"
            actions={d.slaLate > 0 ? <Badge tone="red">{d.slaLate} trễ</Badge> : undefined}
            flush
          >
            {d.sla.length === 0 ? (
              <Empty compact icon={CalendarClock} title="Chưa có mốc giao ảnh nào" hint="Đặt hạn giao trong hợp đồng để theo dõi đếm ngược ở đây." />
            ) : (
              d.sla.map((r) => {
                const tone = r.left < 0 ? "red" : r.left <= 3 ? "amber" : "gray";
                const label = r.left < 0 ? `Trễ ${-r.left} ngày` : r.left === 0 ? "Hạn hôm nay" : `Còn ${r.left} ngày`;
                return (
                  <ListRow
                    key={r.id}
                    href={`/dashboard/studio/contracts/${r.id}`}
                    title={r.title}
                    sub={`${r.shootLabel} · ${r.client_name || "—"} · hạn ${fmtDayMonth(r.delivery_due)}`}
                    trailing={<Badge tone={tone}>{label}</Badge>}
                  />
                );
              })
            )}
          </Section>
        </div>
      </div>

      {/* ── Theo dõi thêm ─────────────────────────────────────────────── */}
      <div className="pt-1">
        <GroupLabel>Theo dõi thêm</GroupLabel>
      </div>
      <div className="grid items-start gap-5 min-[1180px]:grid-cols-2">
        <Section
          id="doanh-thu"
          icon={TrendingUp}
          title="Doanh thu 6 tháng"
          desc="Tiền thực thu về studio"
          actions={
            <div className="text-right">
              <p className="v2-num text-[17px] font-bold" style={{ color: "var(--ac)" }}>{vnd(d.revenueMonth)}</p>
              {d.revDeltaPct != null && <p className="text-[11.5px]">{deltaText(d.revDeltaPct)} <span style={{ color: "var(--tx3)" }}>so với tháng trước</span></p>}
            </div>
          }
        >
          <RevenueBars bars={d.revBars} />
        </Section>

        {d.stalled.length > 0 ? (
          <Section icon={AlertTriangle} title="Hợp đồng đang tắc" desc={`Đứng im từ ${d.stallDays} ngày trở lên`} actions={<Badge tone="amber">{d.stalled.length}</Badge>} flush>
            {d.stalled.slice(0, 6).map((s) => (
              <ListRow
                key={`${s.id}-${s.reason}`}
                href={`/dashboard/studio/contracts/${s.id}`}
                leading={<Avatar name={s.client_name || s.title} size={32} />}
                title={s.title}
                sub={`${s.client_name || "Chưa có tên khách"} · ${s.reason}`}
                trailing={<Badge tone={s.tone}>{s.days} ngày</Badge>}
              />
            ))}
            {d.stalled.length > 6 && (
              <p className="px-5 py-2.5 text-[12.5px] max-sm:px-4" style={{ color: "var(--tx3)" }}>
                và {d.stalled.length - 6} hợp đồng khác
              </p>
            )}
          </Section>
        ) : (
          <Section icon={AlertTriangle} title="Hợp đồng đang tắc" desc={`Đứng im từ ${d.stallDays} ngày trở lên`}>
            <Empty compact icon={CheckCircle2} title="Không có hợp đồng nào đứng im" hint="Khách ký, chọn ảnh và giao ảnh đều đang trôi." />
          </Section>
        )}
      </div>

      {d.milestones.length > 0 && (
        <Section icon={Gift} title="Nên liên hệ tháng này" desc="Khách cũ tới mốc kỷ niệm — một lời chúc là một cơ hội chụp lại" actions={<Badge tone="brand">{d.milestonesTotal} khách</Badge>} flush>
          <div>
            {d.milestones.map((m) => {
              const when = m.inDays === 0 ? "Hôm nay" : m.inDays < 0 ? `Qua ${-m.inDays} ngày` : `Còn ${m.inDays} ngày`;
              return (
                <div key={m.key} className="v2-row flex-wrap">
                  <Avatar name={m.name} size={34} />
                  <div className="min-w-[140px] flex-1">
                    <p className="v2-row-title">{m.name}</p>
                    <p className="v2-row-sub">
                      {m.label} · {fmtDate(m.date)} · <span style={{ color: m.inDays <= 3 ? "var(--am)" : undefined }}>{when}</span>
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <MessengerButton label="Gửi lời chúc" message={m.message} className={btn("secondary", "sm")} />
                    <Link href={`/dashboard/studio/contracts/${m.contractId}`} className={iconBtn()} aria-label="Mở hợp đồng" title="Mở hợp đồng">
                      <ChevronRight size={18} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
          {d.milestonesTotal > d.milestones.length && (
            <p className="px-5 py-2.5 text-[12.5px] max-sm:px-4" style={{ color: "var(--tx3)" }}>
              Còn {d.milestonesTotal - d.milestones.length} khách nữa tới mốc trong 45 ngày tới.
            </p>
          )}
        </Section>
      )}

      {d.autoEmail && (
        <div className="[&>.card]:mt-0 [&_button[aria-pressed=true]]:!bg-[var(--ac)]">
          <AutoEmailToggle ownerId={d.autoEmail.ownerId} initial={d.autoEmail.initial} />
        </div>
      )}
    </Stack>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TỔNG QUAN GÓI NHIẾP ẢNH (đặt lịch) — giao diện mới. Cùng dữ liệu BookingOverview.
   ═══════════════════════════════════════════════════════════════════════════ */
function bookingSub(b: OvBooking) {
  return [b.package_name || b.service, b.phone].filter(Boolean).join(" · ") || "—";
}

export function OverviewBookingV2(d: OverviewBookingV2Data) {
  const days: { date: string; rows: OvBooking[] }[] = [];
  for (const b of d.upcoming) {
    const k = b.preferred_date as string;
    const last = days[days.length - 1];
    if (last && last.date === k) last.rows.push(b);
    else days.push({ date: k, rows: [b] });
  }
  const shortcuts = [
    { href: "/dashboard/studio/bookings", icon: Clock, label: "Đặt lịch", desc: "Yêu cầu khách gửi" },
    { href: "/dashboard/studio/calendar", icon: CalendarDays, label: "Lịch chụp", desc: "Xem & sắp lịch" },
    { href: "/dashboard/studio/pricing", icon: Wallet, label: "Bảng giá", desc: "Các gói dịch vụ" },
    { href: "/dashboard/studio/clients", icon: Users, label: "Khách hàng", desc: "Danh bạ khách" },
  ];
  const todo = d.newBookings.length + (d.selectingAlbums > 0 ? 1 : 0);

  return (
    <Stack>
      <PageHead
        desc={`${dayName(d.today)}, ${fmtDate(d.today)} · Quản lý lịch chụp và yêu cầu đặt lịch của khách`}
        actions={
          <>
            <Link href="/dashboard/site" className={btn("secondary")}>
              <Globe size={16} /> Website riêng
            </Link>
            <Link href="/dashboard/studio/bookings" className={btn("primary")}>
              <CalendarDays size={16} /> Đặt lịch
            </Link>
          </>
        }
      />

      <StatGrid>
        <Stat label="Đặt lịch mới" value={d.newCount} valueTone={d.newCount > 0 ? "amber" : undefined} sub={d.newCount > 0 ? "cần xử lý" : "đã xử lý hết"} icon={Inbox} tone="amber" href="/dashboard/studio/bookings" />
        <Stat label="Album khách đang chọn" value={d.selectingAlbums} sub={d.selectingAlbums > 0 ? "khách đang chọn ảnh" : "không có album chờ"} icon={Images} tone="blue" href="/dashboard/albums" />
        <Stat label="Lịch sắp tới" value={d.upcoming.length} sub="buổi chụp đã có ngày" icon={CalendarCheck} tone="brand" href="#lich-chup" />
        <Stat label="Tổng yêu cầu đặt lịch" value={d.totalBookings} sub="chưa lưu trữ" icon={Users} tone="gray" />
      </StatGrid>

      <div className="grid items-start gap-5 min-[1180px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Stack>
          <Section icon={ListChecks} title="Việc cần làm" desc="Yêu cầu đặt lịch mới và album khách đang chọn" actions={todo > 0 ? <Badge tone="amber">{todo} việc</Badge> : undefined} flush>
            {todo === 0 ? (
              <Empty compact icon={CheckCircle2} title="Không còn yêu cầu nào chờ" hint="Yêu cầu đặt lịch mới của khách sẽ hiện ở đây." />
            ) : (
              <div className="pb-1.5">
                {d.newBookings.length > 0 && (
                  <Group label="Đặt lịch mới" count={d.newCount}>
                    {d.newBookings.map((b) => (
                      <ListRow
                        key={b.id}
                        href="/dashboard/studio/bookings"
                        leading={<Avatar name={b.name} size={34} />}
                        title={b.name}
                        sub={bookingSub(b)}
                        trailing={<Badge tone="amber">{b.preferred_date ? fmtDayMonth(b.preferred_date) : "Chưa chọn ngày"}</Badge>}
                      />
                    ))}
                  </Group>
                )}
                {d.selectingAlbums > 0 && (
                  <Group label="Album">
                    <ListRow
                      href="/dashboard/albums"
                      leading={
                        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px]" style={{ background: toneBg("blue"), color: toneFg("blue") }}>
                          <Images size={17} />
                        </span>
                      }
                      title={`${d.selectingAlbums} album khách đang chọn ảnh`}
                      sub="Khách chốt xong là bạn lọc ảnh được ngay"
                      trailing={<ChevronRight size={18} style={{ color: "var(--tx3)" }} />}
                    />
                  </Group>
                )}
              </div>
            )}
          </Section>

          <Section id="lich-chup" icon={CalendarDays} title="Lịch chụp sắp tới" desc={d.upcoming.length > 0 ? `${d.upcoming.length} buổi chụp đã có ngày` : "Chưa có lịch chụp nào sắp tới"} flush>
            {d.upcoming.length === 0 ? (
              <Empty compact icon={CalendarDays} title="Chưa có lịch chụp nào sắp tới" action={<Link href="/dashboard/studio/bookings" className={btn("secondary", "sm")}>Mở trang đặt lịch</Link>} />
            ) : (
              <div className="pb-1.5">
                {days.map((g) => (
                  <Group key={g.date} label={dayLabel(g.date, d.today)} count={`${g.rows.length} buổi`}>
                    {g.rows.map((b) => (
                      <ListRow
                        key={b.id}
                        leading={<Avatar name={b.name} size={34} />}
                        title={b.name}
                        sub={bookingSub(b)}
                        trailing={
                          <span className="text-right">
                            <span className="block text-[13px] font-semibold" style={{ color: "var(--ac)" }}>{fmtDate(b.preferred_date)}</span>
                            {b.package_price ? <span className="v2-num block text-[12px]" style={{ color: "var(--tx3)" }}>{vnd(b.package_price)}</span> : null}
                          </span>
                        }
                      />
                    ))}
                  </Group>
                ))}
              </div>
            )}
          </Section>
        </Stack>

        <Stack>
          <Section title="Lối tắt" flush>
            {shortcuts.map((q) => (
              <ListRow
                key={q.href}
                href={q.href}
                leading={
                  <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                    <q.icon size={17} />
                  </span>
                }
                title={q.label}
                sub={q.desc}
                trailing={<ChevronRight size={18} style={{ color: "var(--tx3)" }} />}
              />
            ))}
          </Section>

          <Section icon={Sparkles} title="Nâng cấp lên Studio" desc="Mở khoá hợp đồng, tài chính, đội ngũ và toàn bộ tính năng studio chuyên nghiệp.">
            <div className="flex flex-wrap items-center gap-3">
              <StudioTrialButton used={d.trialUsed} />
              <Link href="/dashboard/upgrade" className={btn("secondary", "sm")}>
                Xem gói Studio
              </Link>
            </div>
          </Section>
        </Stack>
      </div>
    </Stack>
  );
}
