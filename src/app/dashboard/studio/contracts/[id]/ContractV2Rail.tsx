"use client";

import { CalendarDays, ChevronDown, MapPin, QrCode, UserPlus, Users, Wallet } from "lucide-react";
import { Badge, Progress, btn, type Tone } from "@/components/v2/kit";
import { CREW_STATUS_LABEL, vnd, type CrewStatus } from "@/lib/types";
import { fmtDate, todayVN } from "@/lib/date";
import { crewRoleLabel } from "@/lib/crew-roles";
import { CREW_TONE, CrewFaces, DateTile, initialsOf, nextSession, relDay, sessionWhen, sessionsOf, toneText, type V2Ctx } from "./ContractV2Parts";

/* ═══════════════════════════════════════════════════════════════════════════
   Cột phải của màn chi tiết hợp đồng (giao diện mới): ba thẻ tóm tắt — tiền,
   buổi sắp tới, ê-kíp. Máy tính rộng: dính theo cuộn ở mọi tab. Hẹp hơn: vẽ
   trong tab Tổng quan (xem ContractV2Overview).
   ═══════════════════════════════════════════════════════════════════════════ */

export function ContractV2Rail({ ctx }: { ctx: V2Ctx }) {
  return (
    <>
      <RailMoney ctx={ctx} />
      <RailShoot ctx={ctx} />
      <RailCrew ctx={ctx} />
    </>
  );
}

function RailHead({ icon: Icon, title, action }: { icon: typeof Wallet; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon size={16} style={{ color: "var(--tx3)" }} />
      <p className="flex-1 text-[13.5px] font-semibold">{title}</p>
      {action}
    </div>
  );
}

const linkBtn = "text-[12.5px] font-semibold";

/* ── Tiền ── */
export function RailMoney({ ctx }: { ctx: V2Ctx }) {
  const { ed } = ctx;
  const next = ed.plan.find((p) => !p.paid) ?? null;
  const nextOverdue = !!next?.due_date && next.due_date < ed.todayStr;
  const marginTone: Tone = ed.total <= 0 ? "gray" : ed.marginPct < 45 ? "red" : ed.marginPct < 60 ? "amber" : "green";
  const done = ed.total > 0 && ed.balance <= 0;
  return (
    <section className="v2-card v2-card-pad">
      <RailHead
        icon={Wallet}
        title="Thanh toán"
        action={
          <button type="button" className={linkBtn} style={{ color: "var(--ac)" }} onClick={() => ctx.go("pay")}>
            Chi tiết
          </button>
        }
      />
      <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
        {done ? "Đã thu đủ" : "Còn phải thu"}
      </p>
      <p className="v2-num mt-0.5 text-[24px] font-bold tracking-[-0.6px]" style={{ color: done ? "var(--gn)" : ed.balance > 0 ? "var(--am)" : "var(--tx)" }}>
        {vnd(done ? ed.collected : Math.max(0, ed.balance))}
      </p>
      <div className="mt-2.5">
        <Progress value={ed.pct} tone={done ? "green" : "brand"} />
      </div>
      <p className="mt-2 flex justify-between gap-2 text-[12.5px]" style={{ color: "var(--tx2)" }}>
        <span>
          Đã thu <b className="v2-num" style={{ color: "var(--gn)" }}>{vnd(ed.collected)}</b>
        </span>
        <span className="v2-num">/ {vnd(ed.total)}</span>
      </p>

      {next && (
        <div className="mt-3 rounded-[12px] px-3 py-2.5" style={{ background: nextOverdue ? "var(--rdS)" : "var(--sf2)" }}>
          <p className="text-[12px] font-medium" style={{ color: nextOverdue ? "var(--rd)" : "var(--tx3)" }}>
            {nextOverdue ? "Đợt quá hạn" : "Đợt tiếp theo"}
            {next.due_date ? ` · hạn ${fmtDate(next.due_date)}` : ""}
          </p>
          <p className="mt-0.5 flex items-baseline justify-between gap-2 text-[13.5px]">
            <span className="min-w-0 truncate font-medium">{next.label}</span>
            <b className="v2-num flex-none">{vnd(next.amount)}</b>
          </p>
        </div>
      )}

      {ed.balance > 0 && ed.props.contract.status !== "cancelled" && (
        <div className="mt-3 flex gap-2">
          <button type="button" className={btn("secondary", "sm", "flex-1")} onClick={() => ctx.openCollect(next?.id)}>
            <Wallet size={15} /> Ghi nhận
          </button>
          <button
            type="button"
            className={btn("secondary", "sm")}
            onClick={() => ctx.openQr({ amount: ed.balance, addInfo: ed.qrInfo, title: `QR thu ${vnd(ed.balance)}` })}
            aria-label="Mã QR thu phần còn lại"
            title="Mã QR thu phần còn lại"
          >
            <QrCode size={15} /> QR
          </button>
        </div>
      )}

      {/* Lãi dự kiến — cùng công thức bản cũ, thu gọn vì ít khi cần nhìn. */}
      <details className="group mt-3 border-t pt-2.5" style={{ borderColor: "var(--bd2)" }}>
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[12.5px]">
          <span style={{ color: "var(--tx2)" }}>Lợi nhuận dự kiến</span>
          <span className="ml-auto flex items-center gap-1.5">
            <Badge tone={marginTone}>{ed.marginPct}%</Badge>
            <b className="v2-num" style={{ color: toneText(marginTone === "gray" ? "gray" : marginTone) }}>
              {vnd(ed.profit)}
            </b>
          </span>
          <ChevronDown size={14} className="flex-none transition-transform group-open:rotate-180" style={{ color: "var(--tx3)" }} />
        </summary>
        <dl className="mt-2 flex flex-col gap-1 text-[12.5px]">
          <MoneyLine label="Giá trị hợp đồng" value={vnd(ed.total)} />
          <MoneyLine label="Tiền công nhân sự" value={`− ${vnd(ed.payroll)}`} />
          <MoneyLine label="· đã trả" value={vnd(ed.paidPayroll)} muted />
          <MoneyLine label="Chi phí sản phẩm" value={`− ${vnd(ed.productCost)}`} />
          <MoneyLine label="Chi phí khác" value={`− ${vnd(ed.expenseTotal)}`} />
        </dl>
        <p className="mt-2 text-[11.5px]" style={{ color: "var(--tx3)" }}>
          Lợi nhuận = giá trị HĐ − tiền công − chi phí sản phẩm − chi phí khác.
        </p>
      </details>
    </section>
  );
}

function MoneyLine({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-2" style={{ color: muted ? "var(--tx3)" : "var(--tx2)" }}>
      <dt>{label}</dt>
      <dd className="v2-num font-medium" style={{ color: muted ? "var(--tx3)" : "var(--tx)" }}>
        {value}
      </dd>
    </div>
  );
}

/* ── Buổi sắp tới ── */
export function RailShoot({ ctx }: { ctx: V2Ctx }) {
  const { ed } = ctx;
  const sessions = sessionsOf(ed);
  const today = todayVN();
  const up = nextSession(sessions, today);
  const later = sessions.filter((s) => s.date && s.date >= today).length;
  const shown = up ?? sessions[0];
  const rel = relDay(shown.date);
  const live = shown.crew.filter((c) => (c.row.status || "pending") !== "declined").map((c) => c.row);
  return (
    <section className="v2-card v2-card-pad">
      <RailHead
        icon={CalendarDays}
        title={up ? "Buổi sắp tới" : "Lịch chụp"}
        action={
          <button type="button" className={linkBtn} style={{ color: "var(--ac)" }} onClick={() => ctx.go("crew")}>
            {sessions.length > 1 ? `Cả ${sessions.length} buổi` : "Xem lịch"}
          </button>
        }
      />
      {shown.date ? (
        <div className="flex gap-3">
          <DateTile iso={shown.date} muted={!up} size={50} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold">{shown.title}</p>
            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>
              {sessionWhen(shown)}
            </p>
            {rel && (
              <p className="text-[12.5px] font-medium" style={{ color: up ? toneText(rel.tone) : "var(--tx3)" }}>
                {up ? rel.text : `Đã qua · ${rel.text}`}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-[13px]" style={{ color: "var(--am)" }}>
          Chưa có ngày chụp.{" "}
          <button type="button" className="font-semibold underline underline-offset-2" onClick={ctx.openInfo}>
            Đặt ngày
          </button>
        </p>
      )}
      {ed.f.location && shown.main && (
        <p className="mt-2.5 flex gap-1.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>
          <MapPin size={14} className="mt-[1px] flex-none" style={{ color: "var(--tx3)" }} />
          <span className="line-clamp-2">{ed.f.location}</span>
        </p>
      )}
      <div className="mt-2.5 flex items-center gap-2">
        {live.length ? (
          <>
            <CrewFaces rows={live} />
            <span className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
              {live.length} người làm buổi này
            </span>
          </>
        ) : (
          <Badge tone="amber" icon={UserPlus}>
            Chưa có thợ
          </Badge>
        )}
      </div>
      {up && later > 1 && (
        <p className="mt-2 text-[12px]" style={{ color: "var(--tx3)" }}>
          Còn {later - 1} buổi khác sau buổi này.
        </p>
      )}
    </section>
  );
}

/* ── Ê-kíp ── */
export function RailCrew({ ctx }: { ctx: V2Ctx }) {
  const { ed } = ctx;
  const { crewRoles } = ed.props;
  const live = ed.activeCrew;
  const pending = live.filter((c) => (c.status || "pending") === "pending").length;
  const declined = ed.crew.length - live.length;
  return (
    <section className="v2-card v2-card-pad">
      <RailHead
        icon={Users}
        title="Ê-kíp"
        action={
          <button type="button" className={linkBtn} style={{ color: "var(--ac)" }} onClick={() => ctx.go("crew")}>
            {live.length ? "Sửa" : "Phân công"}
          </button>
        }
      />
      {live.length === 0 ? (
        <button
          type="button"
          onClick={() => ctx.openCrew(null)}
          className="flex w-full items-center justify-center gap-1.5 rounded-[12px] p-3.5 text-[13px] font-semibold"
          style={{ border: "1.5px dashed color-mix(in srgb, var(--am) 60%, transparent)", color: "var(--am)", background: "var(--amS)" }}
        >
          <UserPlus size={16} /> Chưa có ai — phân công ngay
        </button>
      ) : (
        <>
          {(pending > 0 || declined > 0) && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {pending > 0 && <Badge tone="amber">{pending} chờ xác nhận</Badge>}
              {declined > 0 && <Badge tone="red">{declined} từ chối</Badge>}
            </div>
          )}
          <ul className="flex flex-col">
            {live.slice(0, 6).map((c, i) => {
              const st = (c.status || "pending") as CrewStatus;
              return (
                <li key={c.id ?? `n${i}`} className="flex items-center gap-2.5 py-1.5">
                  <span
                    className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: "var(--acS)", color: "var(--ac)" }}
                  >
                    {initialsOf(c.name || c.phone || "?")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{c.name || c.phone || "Chưa đặt tên"}</p>
                    <p className="truncate text-[12px]" style={{ color: "var(--tx3)" }}>
                      {crewRoleLabel(c.role, crewRoles)} · {vnd(c.salary || 0)} · {c.paid ? "đã trả" : "chưa trả"}
                    </p>
                  </div>
                  <span
                    className="h-2 w-2 flex-none rounded-full"
                    title={CREW_STATUS_LABEL[st]}
                    aria-label={CREW_STATUS_LABEL[st]}
                    style={{ background: toneText(CREW_TONE[st] ?? "gray") }}
                  />
                </li>
              );
            })}
          </ul>
          {live.length > 6 && (
            <p className="mt-1 text-[12px]" style={{ color: "var(--tx3)" }}>
              và {live.length - 6} người khác
            </p>
          )}
        </>
      )}
    </section>
  );
}
