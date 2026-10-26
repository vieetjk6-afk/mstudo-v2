"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, CalendarDays, CalendarHeart, CheckCircle2, ChevronDown, Clock, FileSignature, FileText, Heart, Images,
  LifeBuoy, MapPin, Package, Phone, Receipt, StickyNote, Wallet, type LucideIcon,
} from "lucide-react";
import InstallPwaButton from "@/components/InstallPwaButton";
import { Badge, Callout, Card, Empty, GroupLabel, Progress, Section, Stack, btn, toneFg, type Tone } from "@/components/v2/kit";
import { fmtDate, fmtDateLunar, fmtDayMonth, fmtDow } from "@/lib/date";
import { kindMeta } from "@/lib/appointments";
import { thiepUrl } from "@/lib/hosts";
import { CONTRACT_STATUS_LABEL, PRODUCT_STATUS_LABEL, SHOOT_TYPE_LABEL, vnd, type ContractStatus } from "@/lib/types";
import { daysUntil } from "@/lib/wedding-plan";
import { LinkRow } from "./AlbumViewV2";
import type { PortalPay } from "./PaymentPanelV2";
import type { PortalTabKey } from "./PortalShellV2";
import { PORTAL_STEPS, portalSteps, type PortalPayload } from "./types";
import { usePortalTimeline, type PortalTimelineItem } from "./usePortal";

/* ═══════════════════════════════════════════════════════════════════════════
   TỔNG QUAN — cổng khách, giao diện mới.

   Thẻ đầu trả lời ba câu khách mở trang để hỏi: buổi hẹn tới là khi nào, còn
   phải trả bao nhiêu, ảnh đã có chưa — kèm MỘT nút chính đổi theo việc cần làm
   tiếp (ký → trả đợt quá hạn → chọn ảnh → mở album → trả đợt tiếp → gọi
   studio). Lịch trình, sản phẩm, hồ sơ đẩy xuống dưới.
   ═══════════════════════════════════════════════════════════════════════════ */

export const STATUS_TONE: Record<ContractStatus, Tone> = {
  draft: "gray",
  sent: "amber",
  approved: "blue",
  in_progress: "teal",
  post_production: "violet",
  completed: "green",
  cancelled: "red",
};

type Action = { label: string; icon: LucideIcon; href?: string; onClick?: () => void };

export default function PortalHomeV2({
  token, data, today, pay, go,
}: {
  token: string;
  data: PortalPayload;
  today: string;
  pay: PortalPay;
  go: (t: PortalTabKey) => void;
}) {
  const c = data.contract;
  const timeline = usePortalTimeline(data, today);
  const steps = useMemo(() => portalSteps(data), [data]);
  const current = steps.findIndex((s) => !s);
  const completed = c.status === "completed";
  const signed = !!c.client_signed_at;
  const delivered = !!data.gallery || data.selection?.phase === "delivery";
  const albumHref = data.gallery ? `/album/${data.gallery.slug}` : data.selection ? `/a/${data.selection.slug}` : null;
  const upcoming = timeline.filter((t) => !t.done && t.date >= today);
  const next = upcoming[0] ?? null;
  const { remaining, nextDue } = pay;
  const payLate = !!nextDue?.due_date && nextDue.due_date < today;
  const paySoon = !!nextDue?.due_date && (daysUntil(nextDue.due_date, today) ?? 99) <= 14;
  const plannerHref = `/portal/${token}/ke-hoach`;

  /* ── Một nút chính theo việc cần làm tiếp ── */
  const payAction: Action = { label: nextDue ? `Thanh toán ${nextDue.label.toLowerCase()}` : "Thanh toán đợt tiếp theo", icon: Wallet, onClick: () => pay.setQrOpen(true) };
  const action: Action | null = completed
    ? { label: "Xem ảnh & video", icon: Images, onClick: () => go("media") }
    : !signed
      ? { label: "Xem & ký hợp đồng", icon: FileSignature, href: `/c/${token}` }
      : remaining > 0 && payLate
        ? payAction
        : albumHref && !delivered
          ? { label: "Chọn ảnh của bạn", icon: Images, href: albumHref }
          : albumHref && delivered
            ? { label: "Mở album của bạn", icon: Images, href: albumHref }
            : remaining > 0 && (paySoon || !next)
              ? payAction
              : data.planner
                ? { label: data.planner.combo ? "Mở quà cưới của bạn" : "Mở kế hoạch cưới", icon: CalendarHeart, href: plannerHref }
                : remaining > 0
                  ? payAction
                  : null;

  /* ── Ba ô trạng thái ── */
  const tiles = (
    <>
      <Tile
        icon={Wallet}
        tone={remaining > 0 ? (payLate ? "red" : "amber") : "green"}
        label={remaining > 0 ? "Còn phải trả" : "Thanh toán"}
        value={remaining > 0 ? vnd(remaining) : "Đã đủ"}
        sub={remaining > 0 && nextDue ? `${nextDue.label}${nextDue.due_date ? ` · ${payLate ? "quá hạn" : "hạn"} ${fmtDayMonth(nextDue.due_date)}` : ""}` : `Đã trả ${pay.pct}% hợp đồng`}
        onClick={() => go("pay")}
      />
      <Tile
        icon={Images}
        tone={completed || delivered ? "green" : albumHref ? "amber" : "gray"}
        label="Ảnh của bạn"
        value={completed && data.album ? `${data.album.photos.filter((p) => !p.is_video).length} ảnh` : delivered ? "Đã giao" : albumHref ? "Chờ bạn chọn" : "Chưa có"}
        sub={completed ? "Album đã sẵn sàng" : delivered ? "Mở để xem và tải về" : albumHref ? "Đánh dấu tấm bạn thích" : "Studio gửi sau buổi chụp"}
        onClick={() => go("media")}
      />
      {data.planner ? (
        <Tile
          icon={CalendarHeart}
          tone="brand"
          label={data.planner.combo ? "Quà cưới" : "Kế hoạch cưới"}
          value={`${data.planner.done}/${data.planner.total} việc`}
          sub={plannerLeft(data.planner.wedding_date, today)}
          href={plannerHref}
        />
      ) : (
        <Tile
          icon={CalendarDays}
          tone="blue"
          label="Lịch hẹn"
          value={upcoming.length ? `${upcoming.length} buổi tới` : "Chưa có"}
          sub={next ? `Gần nhất ${fmtDayMonth(next.date)}` : "Studio đang xếp lịch"}
        />
      )}
    </>
  );

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
      <Stack className="min-w-0">
        {/* ── Thẻ trạng thái ─────────────────────────────────────────────── */}
        <Card padded={false}>
          <div className="v2-card-pad">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[c.status]} dot>{CONTRACT_STATUS_LABEL[c.status]}</Badge>
              {c.code && <span className="tnum text-[12px] font-semibold" style={{ color: "var(--tx3)" }}>{c.code}</span>}
              {signed && <Badge tone="green" icon={CheckCircle2}>Đã ký</Badge>}
            </div>
            <h1 className="mt-2 text-[22px] font-bold leading-tight sm:text-[26px]" style={{ letterSpacing: "-.5px", textWrap: "balance" }}>
              {c.client_name || c.title}
            </h1>
            <p className="mt-1 text-[13.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
              {c.client_name ? `${c.title} · ` : ""}{SHOOT_TYPE_LABEL[c.shoot_type] ?? "Dịch vụ"}
            </p>
            {(c.event_date || c.location) && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]" style={{ color: "var(--tx2)" }}>
                {c.event_date && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={15} style={{ color: "var(--tx3)", flex: "none" }} /> {fmtDateLunar(c.event_date)}{c.event_time ? ` · ${c.event_time}` : ""}
                  </span>
                )}
                {c.location && (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <MapPin size={15} style={{ color: "var(--tx3)", flex: "none" }} /> <span className="min-w-0">{c.location}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Buổi hẹn tới — đếm ngược */}
          <div className="flex items-center gap-3.5 px-4 py-4 sm:px-5" style={{ borderTop: "1px solid var(--bd2)" }}>
            {next ? (
              <>
                <Countdown days={daysUntil(next.date, today) ?? 0} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium" style={{ color: "var(--tx3)" }}>Buổi hẹn tới</p>
                  <p className="text-[15px] font-semibold leading-snug" style={{ textWrap: "pretty" }}>{next.title}</p>
                  <p className="mt-0.5 text-[13px]" style={{ color: "var(--tx2)" }}>
                    {fmtDow(next.date)}, {fmtDate(next.date)}{next.time ? ` · ${next.time}` : ""}{next.place ? ` · ${next.place}` : ""}
                  </p>
                </div>
              </>
            ) : (
              <>
                <span className="flex h-[60px] w-[60px] flex-none items-center justify-center rounded-[14px]" style={{ background: completed ? "var(--gnS)" : "var(--sf2)", color: completed ? "var(--gn)" : "var(--tx3)" }}>
                  {completed ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{completed ? "Hợp đồng đã hoàn thành" : "Chưa có buổi hẹn sắp tới"}</p>
                  <p className="mt-0.5 text-[13px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                    {completed ? `Cảm ơn bạn đã đồng hành cùng ${data.studio_name}.` : "Studio sẽ báo lịch ngay khi xếp xong — lịch hiện ở trang này."}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Tiến độ 6 bước */}
          <div className="px-4 py-4 sm:px-5" style={{ borderTop: "1px solid var(--bd2)" }}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span style={{ color: "var(--tx3)" }}>Tiến độ</span>
              <span className="min-w-0 truncate text-right font-semibold">
                {current === -1 ? "Đã hoàn tất cả 6 bước" : <>Bước {current + 1}/6 · <span style={{ color: "var(--ac)" }}>{PORTAL_STEPS[current]}</span></>}
              </span>
            </div>
            <div className="mt-2.5 grid grid-cols-6 gap-1" aria-hidden>
              {steps.map((done, i) => (
                <span key={i} className="h-1.5 rounded-full" style={{ background: done ? "var(--ac)" : i === current ? "var(--acM)" : "var(--bd2)" }} />
              ))}
            </div>
            <ol className="mt-2 hidden grid-cols-6 gap-1 sm:grid">
              {PORTAL_STEPS.map((label, i) => (
                <li key={label} className="text-[11.5px] leading-tight" style={{ color: steps[i] ? "var(--ac)" : i === current ? "var(--tx)" : "var(--tx3)", fontWeight: steps[i] || i === current ? 600 : 500 }}>
                  {label}
                </li>
              ))}
            </ol>
          </div>

          {(action || data.studio_phone) && (
            <div className="flex flex-wrap gap-2 px-4 py-3.5 sm:px-5" style={{ borderTop: "1px solid var(--bd2)" }}>
              {action && <ActionButton a={action} />}
              {data.studio_phone && (
                <a href={`tel:${data.studio_phone}`} className={btn("secondary", "lg", action ? "flex-1 sm:flex-none" : "w-full sm:w-auto")}>
                  <Phone size={17} /> Gọi studio
                </a>
              )}
            </div>
          )}
        </Card>

        {/* Ba ô trạng thái — điện thoại: ngay dưới thẻ đầu; máy tính: cột phải. */}
        <div className="lg:hidden"><div className="v2-statgrid v2-statgrid-3">{tiles}</div></div>

        <TimelineSection timeline={timeline} today={today} />

        {data.products.length > 0 && (
          <Section title="Sản phẩm & tiến độ" icon={Package} flush>
            {data.products.map((p) => {
              const pct = p.status === "done" ? 100 : p.status === "in_progress" ? 50 : 0;
              const tone: Tone = p.status === "done" ? "green" : p.status === "in_progress" ? "blue" : "gray";
              return (
                <div key={p.id} className="v2-row">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--sf2)", color: toneFg(tone) }}>
                    <Package size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-[14px] font-semibold leading-snug" style={{ textWrap: "pretty" }}>{p.name}</p>
                      <Badge tone={tone}>{PRODUCT_STATUS_LABEL[p.status]}</Badge>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2.5">
                      <div className="min-w-0 flex-1"><Progress value={pct} tone={tone} /></div>
                      <span className="tnum flex-none text-[12px]" style={{ color: "var(--tx3)" }}>SL {p.qty}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </Section>
        )}
      </Stack>

      {/* ── Cột phải ───────────────────────────────────────────────────── */}
      <Stack className="min-w-0">
        <div className="hidden flex-col gap-3 lg:flex">{tiles}</div>

        <Section title="Hồ sơ hợp đồng" icon={FileText} flush>
          <LinkRow href={`/c/${token}`} icon={FileText} title="Bản hợp đồng" sub={c.client_signed_at ? `Bạn đã ký ${fmtDate(c.client_signed_at)}` : "Chưa ký — mở để xem và ký"} />
          <LinkRow href={`/c/${token}`} icon={Receipt} title="Bảng hạng mục & phiếu thu" sub={`${data.items.length} hạng mục · ${data.payments.length} lần thu`} />
          {data.wedding?.published && <LinkRow href={thiepUrl(`/${data.wedding.slug}`)} icon={Heart} title="Thiệp cưới điện tử" sub="Studio tặng kèm hợp đồng" />}
          {data.story?.published && <LinkRow href={`/story/${data.story.slug}`} icon={Heart} title="Trang Love Story" sub="Studio tặng kèm hợp đồng" />}
          {/* Cài trang lên màn hình chính — tự ẩn khi đã cài / máy không hỗ trợ. */}
          <div className="px-4 py-3 empty:hidden sm:px-5" style={{ borderTop: "1px solid var(--bd2)" }}>
            <InstallPwaButton variant="pill" label="Lưu trang vào màn hình chính" />
          </div>
        </Section>

        <Callout
          tone="brand"
          icon={LifeBuoy}
          title="Cần đổi lịch hay hỏi thêm?"
        >
          <p style={{ textWrap: "pretty" }}>
            Theo điều khoản hợp đồng, lịch hẹn xin đổi trước <b>72 giờ</b> để studio kịp xếp lại ê-kíp và phòng. Nhắn cho {data.studio_name} sớm nhất khi bạn cần thay đổi.
          </p>
          {data.studio_phone && (
            <a href={`tel:${data.studio_phone}`} className={btn("secondary", "sm", "mt-2.5")}>
              <Phone size={15} /> {data.studio_phone}
            </a>
          )}
        </Callout>
      </Stack>
    </div>
  );
}

function plannerLeft(date: string | null, today: string): string {
  const left = daysUntil(date, today);
  if (left === null) return "Việc cần làm, ngân sách, khách mời";
  if (left > 0) return `Còn ${left} ngày tới ngày cưới`;
  if (left === 0) return "Hôm nay là ngày cưới!";
  return "Việc cần làm, ngân sách, khách mời";
}

function ActionButton({ a }: { a: Action }) {
  const cls = btn("primary", "lg", "w-full sm:w-auto");
  const body = (
    <>
      <a.icon size={18} /> {a.label} <ArrowRight size={16} />
    </>
  );
  return a.href ? <Link href={a.href} className={cls}>{body}</Link> : <button type="button" onClick={a.onClick} className={cls}>{body}</button>;
}

/** Ô đếm ngược: số ngày to + chữ nhỏ. */
function Countdown({ days }: { days: number }) {
  const today = days <= 0;
  return (
    <span className="flex h-[60px] w-[60px] flex-none flex-col items-center justify-center rounded-[14px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
      <span className="tnum text-[22px] font-bold leading-none" style={{ letterSpacing: "-.5px" }}>{today ? "Nay" : days}</span>
      <span className="mt-1 text-[11px] font-semibold leading-none">{today ? "hôm nay" : days === 1 ? "ngày mai" : "ngày nữa"}</span>
    </span>
  );
}

/** Ô trạng thái bấm được — sang tab tương ứng (hoặc trang kế hoạch). */
function Tile({
  icon: Icon, tone, label, value, sub, onClick, href,
}: { icon: LucideIcon; tone: Tone; label: string; value: string; sub: string; onClick?: () => void; href?: string }) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="v2-stat-label">{label}</p>
        <span className="v2-stat-icon" style={{ color: toneFg(tone), background: `var(--${tone === "brand" ? "acS" : tone === "gray" ? "nuS" : `${TONE_KEY[tone]}S`})` }}>
          <Icon size={16} />
        </span>
      </div>
      <p className="v2-stat-value truncate" style={tone === "red" || tone === "amber" ? { color: toneFg(tone) } : undefined}>{value}</p>
      <p className="v2-stat-sub truncate">{sub}</p>
    </>
  );
  const cls = "v2-card v2-stat text-left" + (onClick || href ? " v2-card-link" : "");
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}
const TONE_KEY: Partial<Record<Tone, string>> = { green: "gn", amber: "am", red: "rd", blue: "bl", teal: "tl", violet: "pu" };

/* ── Lịch trình: sắp tới trước, mốc đã xong gấp lại ─────────────────────── */
function TimelineSection({ timeline, today }: { timeline: PortalTimelineItem[]; today: string }) {
  const [showDone, setShowDone] = useState(false);
  const todo = timeline.filter((t) => !t.done);
  const done = timeline.filter((t) => t.done);
  return (
    <Section title="Lịch trình của bạn" desc="Thử đồ · Trang điểm · Chụp · Chọn ảnh · Nhận sản phẩm" icon={CalendarDays} flush>
      {timeline.length === 0 ? (
        <Empty compact icon={CalendarDays} title="Studio đang xếp lịch cho bạn" hint="Các mốc hẹn sẽ hiện ở đây ngay khi có." />
      ) : (
        <>
          {todo.map((t, i) => <TimelineRow key={t.key} t={t} today={today} first={i === 0 && t.date >= today} />)}
          {todo.length === 0 && (
            <p className="px-4 py-4 text-[13px] sm:px-5" style={{ color: "var(--tx3)" }}>Không còn mốc nào sắp tới.</p>
          )}
          {done.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left sm:px-5"
                style={{ borderTop: "1px solid var(--bd2)" }}
                aria-expanded={showDone}
              >
                <GroupLabel count={done.length}>Đã hoàn tất</GroupLabel>
                <ChevronDown size={16} className="ml-auto transition-transform" style={{ color: "var(--tx3)", transform: showDone ? "rotate(180deg)" : undefined }} />
              </button>
              {showDone && done.map((t) => <TimelineRow key={t.key} t={t} today={today} />)}
            </>
          )}
        </>
      )}
    </Section>
  );
}

function TimelineRow({ t, today, first }: { t: PortalTimelineItem; today: string; first?: boolean }) {
  const meta = t.kind ? kindMeta(t.kind) : null;
  const upcoming = !t.done && t.date >= today;
  const d = new Date(t.date + "T00:00:00");
  return (
    <div className="v2-row items-start" style={{ borderTop: "1px solid var(--bd2)", borderBottom: 0 }}>
      <span
        className="flex w-[50px] flex-none flex-col items-center rounded-[12px] py-1.5"
        style={{ background: first ? "var(--acS)" : "var(--sf2)", color: first ? "var(--ac)" : t.done ? "var(--tx3)" : "var(--tx)" }}
      >
        <span className="tnum text-[18px] font-bold leading-tight">{String(d.getDate()).padStart(2, "0")}</span>
        <span className="text-[10.5px] font-semibold" style={{ color: first ? "var(--ac)" : "var(--tx3)" }}>Th{d.getMonth() + 1}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {meta && (
            <span className="v2-badge" style={{ background: meta.tone.soft, color: meta.tone.fg }}>
              <meta.Icon size={12} /> {meta.label}
            </span>
          )}
          {t.done ? <Badge tone="green">Đã xong</Badge> : upcoming ? <Badge tone="brand">Sắp tới</Badge> : <Badge>Chờ lịch</Badge>}
        </div>
        <p className="mt-1 text-[14.5px] font-semibold leading-snug" style={{ color: t.done ? "var(--tx2)" : "var(--tx)", textWrap: "pretty" }}>{t.title}</p>
        {(t.time || t.place) && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px]" style={{ color: "var(--tx2)" }}>
            {t.time && <span className="tnum flex items-center gap-1"><Clock size={13} style={{ color: "var(--tx3)" }} /> {t.time}</span>}
            {t.place && <span className="flex items-center gap-1"><MapPin size={13} style={{ color: "var(--tx3)" }} /> {t.place}</span>}
          </p>
        )}
        {t.note && (
          <p className="mt-1.5 flex items-start gap-1.5 rounded-[10px] px-2.5 py-2 text-[12.5px]" style={{ background: "var(--amS)", color: "var(--tx2)" }}>
            <StickyNote size={14} style={{ flex: "none", color: "var(--am)", marginTop: 1 }} />
            <span style={{ textWrap: "pretty" }}>{t.note}</span>
          </p>
        )}
      </div>
    </div>
  );
}
