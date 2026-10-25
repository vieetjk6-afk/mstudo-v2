"use client";

import Link from "next/link";
import {
  AlertCircle,
  Ban,
  CalendarClock,
  CalendarX,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  ListTodo,
  Lock,
  MessageSquareWarning,
  PackageCheck,
  PenLine,
  Pencil,
  Send,
  Trash2,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Callout, GroupLabel, InfoList, Section, btn, inputCls, toneBg, toneFg, type Tone } from "@/components/v2/kit";
import { SHOOT_TYPE_LABEL, vnd } from "@/lib/types";
import { daysFromToday, fmtDate, fmtDateLunar } from "@/lib/date";
import { kindHasPhotoWork } from "@/lib/contract-kind";
import { LEAD_SOURCE_LABEL } from "@/lib/lead-source";
import { INTERNAL_NOTE_MISSING, useInternalNote } from "./InternalNoteCard";
import { RailCrew, RailMoney, RailShoot } from "./ContractV2Rail";
import type { V2Ctx } from "./ContractV2Parts";

/* ═══════════════════════════════════════════════════════════════════════════
   Tab TỔNG QUAN (giao diện mới): việc cần làm ngay → (màn hẹp) ba thẻ tóm tắt
   → thông tin hợp đồng dạng đọc (sửa trong ngăn kéo) → ghi chú nội bộ.
   ═══════════════════════════════════════════════════════════════════════════ */

type Todo = {
  key: string;
  tone: Tone;
  icon: LucideIcon;
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: { label: string; run: () => void };
};

export default function ContractV2Overview({ ctx }: { ctx: V2Ctx }) {
  const { ed } = ctx;
  const { f, reqMissing } = ed;
  const { contract, sameDayContracts, services, staffList, canAssign, branches } = ed.props;
  const live = f.status !== "cancelled";

  /* ── Việc cần làm: suy ra từ dữ liệu, mỗi việc một nút đi thẳng tới chỗ làm ── */
  const todos: Todo[] = [];
  const missing = [
    reqMissing.title && "tên hợp đồng",
    reqMissing.code && "mã hợp đồng",
    reqMissing.client_name && "tên khách",
    reqMissing.client_phone && "SĐT khách (đủ 10 số)",
  ].filter(Boolean) as string[];
  if (missing.length)
    todos.push({
      key: "req",
      tone: "red",
      icon: AlertCircle,
      title: "Thiếu thông tin bắt buộc",
      sub: `Cần bổ sung ${missing.join(", ")}.`,
      action: { label: "Bổ sung", run: ctx.openInfo },
    });
  if (live && !f.event_date)
    todos.push({
      key: "date",
      tone: "amber",
      icon: CalendarX,
      title: "Chưa có ngày chụp",
      sub: "Đặt ngày để lên lịch thợ và Google Lịch.",
      action: { label: "Đặt ngày", run: ctx.openInfo },
    });
  if (ed.openRequests.length)
    todos.push({
      key: "editreq",
      tone: "amber",
      icon: MessageSquareWarning,
      title: `Khách yêu cầu chỉnh sửa (${ed.openRequests.length})`,
      sub: `“${ed.openRequests[0].message}”`,
      action: { label: "Xem", run: () => ctx.go("send", "v2-requests") },
    });
  for (const p of ed.plan) {
    if (p.paid || !p.due_date || p.due_date >= ed.todayStr) continue;
    const late = -(daysFromToday(p.due_date) ?? 0);
    todos.push({
      key: `od-${p.id}`,
      tone: "red",
      icon: Wallet,
      title: `${p.label} quá hạn ${late} ngày`,
      sub: `${vnd(p.amount)} · hạn ${fmtDate(p.due_date)}`,
      action: { label: "Ghi thu", run: () => ctx.openCollect(p.id) },
    });
  }
  if (live && f.status === "draft")
    todos.push({ key: "draft", tone: "blue", icon: Send, title: "Hợp đồng còn nháp, chưa gửi khách", action: { label: "Gửi khách", run: ctx.openSend } });
  if (live && f.status === "sent" && !contract.client_signed_at)
    todos.push({
      key: "csign",
      tone: "amber",
      icon: PenLine,
      title: "Khách chưa ký hợp đồng",
      sub: ed.clientViewedAt ? `Khách xem lần cuối ${ed.clientViewedAt}` : "Khách chưa mở link hợp đồng",
      action: { label: "Nhắc khách", run: ctx.openSend },
    });
  if (live && !ed.studioSigned)
    todos.push({
      key: "ssign",
      tone: "amber",
      icon: PenLine,
      title: "Studio chưa ký xác nhận (Bên A)",
      sub: "Chữ ký Bên A hiện trên bản PDF hợp đồng.",
      action: { label: "Ký ngay", run: () => ctx.go("send", "v2-sign") },
    });
  if (live && ed.activeCrew.length === 0 && f.status !== "completed")
    todos.push({ key: "crew", tone: "amber", icon: UserPlus, title: "Chưa phân công ai", action: { label: "Phân công", run: () => ctx.openCrew(null) } });
  const pending = ed.activeCrew.filter((c) => c.id && (c.status || "pending") === "pending");
  if (live && pending.length)
    todos.push({
      key: "pending",
      tone: "amber",
      icon: Clock,
      title: `${pending.length} người chưa nhận việc`,
      sub: pending.map((c) => c.name || c.phone).join(", "),
      action: { label: "Xem ê-kíp", run: () => ctx.go("crew") },
    });
  if (sameDayContracts.length)
    todos.push({
      key: "same",
      tone: "amber",
      icon: CalendarClock,
      title: `Trùng ngày ${f.event_date ? fmtDate(f.event_date) : ""} với ${sameDayContracts.length} hợp đồng khác`,
      sub: (
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          {sameDayContracts.map((c) => (
            <Link key={c.id} href={`/dashboard/studio/contracts/${c.id}`} className="font-medium underline-offset-2 hover:underline" style={{ color: "var(--ac)" }}>
              {c.title}
              {c.client_name ? ` · ${c.client_name}` : ""}
            </Link>
          ))}
        </span>
      ),
      action: { label: "Kiểm tra ê-kíp", run: () => ctx.go("crew") },
    });
  if (f.status === "completed" && !ed.deliveryDone && kindHasPhotoWork(ed.kind) && ed.albumMode !== "manual")
    todos.push({
      key: "deliver",
      tone: "blue",
      icon: PackageCheck,
      title: "Đã hoàn thành nhưng album còn ở giai đoạn Chọn ảnh",
      sub: "Album tự chuyển sang Giao khách khi ảnh chỉnh sửa lên Drive.",
      action: { label: "Xem album", run: () => ctx.go("album") },
    });

  /* ── Huỷ: số tiền đã hoàn / studio giữ ── */
  const refunds = ed.payments.filter((p) => p.kind === "refund");
  const refunded = -refunds.reduce((s, p) => s + p.amount, 0);
  const kept = Math.max(0, ed.payments.reduce((s, p) => s + p.amount, 0));

  const svcName = services.find((s) => s.id === f.service_id)?.name || SHOOT_TYPE_LABEL[f.shoot_type];
  const staff = staffList.find((s) => s.id === f.assigned_to);
  const branch = branches.find((b) => b.id === f.branch_id);
  const dash = <span style={{ color: "var(--tx3)" }}>—</span>;

  return (
    <>
      {!live && (
        <Callout
          tone="red"
          icon={Ban}
          title={`Hợp đồng đã huỷ${contract.cancelled_at ? ` ngày ${fmtDate(contract.cancelled_at)}` : ""}`}
          action={
            <button
              type="button"
              className={btn("danger", "sm")}
              disabled={ed.busy === "delete"}
              onClick={() =>
                ctx.ask({
                  title: "Xoá hợp đồng này?",
                  desc: "Mọi hạng mục, nhân sự, thanh toán và yêu cầu của hợp đồng sẽ bị xoá theo. Không khôi phục được.",
                  confirm: "Xoá hợp đồng",
                  danger: true,
                  run: ed.deleteContractNow,
                })
              }
            >
              <Trash2 size={15} /> Xoá
            </button>
          }
        >
          {contract.cancel_reason && <p>Lý do: {contract.cancel_reason}</p>}
          {refunds.length > 0 && (
            <p>
              Đã hoàn khách {vnd(refunded)} · studio giữ {vnd(kept)}
            </p>
          )}
        </Callout>
      )}

      <Section
        title="Việc cần làm"
        icon={ListTodo}
        desc={todos.length ? `${todos.length} việc · làm xong tự biến mất` : undefined}
        flush
      >
        {todos.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-4 text-[13.5px]" style={{ color: "var(--tx2)" }}>
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full" style={{ background: "var(--gnS)", color: "var(--gn)" }}>
              <CheckCircle2 size={17} />
            </span>
            Không có việc nào cần làm ngay.
          </div>
        ) : (
          <ul>
            {todos.map((t) => (
              <li key={t.key} className="flex items-start gap-3 px-4 py-3.5 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
                <span
                  className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full"
                  style={{ background: toneBg(t.tone), color: toneFg(t.tone) }}
                >
                  <t.icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold leading-snug">{t.title}</p>
                  {t.sub && (
                    <div className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "var(--tx3)" }}>
                      {t.sub}
                    </div>
                  )}
                </div>
                {t.action && (
                  <button type="button" onClick={t.action.run} className={btn("secondary", "sm", "flex-none")}>
                    {t.action.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Màn hẹp không có cột phải: ba thẻ tóm tắt nằm ngay đây. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:hidden">
        <RailMoney ctx={ctx} />
        <RailShoot ctx={ctx} />
        <div className="sm:col-span-2">
          <RailCrew ctx={ctx} />
        </div>
      </div>

      {ed.reschedules.length > 0 && (
        <Section title={`Đã dời lịch ${ed.reschedules.length} lần`} icon={CalendarClock} flush>
          <ul>
            {ed.reschedules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-3 text-[13.5px] sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
                <span style={{ color: "var(--tx2)" }}>{r.old_date ? fmtDate(r.old_date) : "chưa có ngày"}</span>
                <span style={{ color: "var(--tx3)" }}>→</span>
                <b>{fmtDate(r.new_date)}</b>
                {r.reason && <span style={{ color: "var(--tx2)" }}>· {r.reason}</span>}
                {r.fee > 0 && <span style={{ color: "var(--tx2)" }}>· phí {vnd(r.fee)}</span>}
                <span className="ml-auto text-[12px]" style={{ color: "var(--tx3)" }}>
                  {fmtDate(r.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="Thông tin hợp đồng"
        icon={FileText}
        actions={
          <button type="button" className={btn("secondary", "sm")} onClick={ctx.openInfo}>
            <Pencil size={14} /> Sửa
          </button>
        }
      >
        <div className="grid gap-x-10 gap-y-5 md:grid-cols-2">
          <div className="min-w-0">
            <GroupLabel>Khách hàng</GroupLabel>
            <InfoList
              items={[
                { label: "Họ tên", value: f.client_name || dash },
                { label: "Điện thoại", value: f.client_phone || <span style={{ color: "var(--rd)" }}>Chưa có</span> },
                { label: "Email", value: f.client_email ? <span className="break-all">{f.client_email}</span> : dash },
                {
                  label: "Messenger",
                  value: f.client_messenger ? (
                    <a href={f.client_messenger.startsWith("http") ? f.client_messenger : `https://${f.client_messenger}`} target="_blank" rel="noreferrer" className="break-all" style={{ color: "var(--ac)" }}>
                      {f.client_messenger}
                    </a>
                  ) : (
                    dash
                  ),
                },
                { label: "Nguồn khách", value: f.source ? LEAD_SOURCE_LABEL[f.source] ?? f.source : dash },
              ]}
            />
          </div>
          <div className="min-w-0">
            <GroupLabel>Buổi chụp</GroupLabel>
            <InfoList
              items={[
                { label: "Dịch vụ", value: svcName },
                {
                  label: "Ngày",
                  value: f.event_date ? `${fmtDateLunar(f.event_date)}${f.event_time ? ` · ${f.event_time}` : ""}` : <span style={{ color: "var(--am)" }}>Chưa có</span>,
                },
                { label: "Địa điểm", value: f.location || dash },
                ...(kindHasPhotoWork(ed.kind) ? [{ label: "Hạn giao ảnh", value: f.delivery_due ? fmtDate(f.delivery_due) : dash }] : []),
                ...(canAssign && staffList.length ? [{ label: "Nhân viên phụ trách", value: staff ? staff.full_name || staff.email : dash }] : []),
                ...(branches.length ? [{ label: "Chi nhánh", value: branch?.name ?? dash }] : []),
              ]}
            />
          </div>
        </div>
      </Section>

      <InternalNote contractId={contract.id} initial={contract.internal_note} />
    </>
  );
}

/** Ghi chú nội bộ — cùng logic tự lưu với thẻ bản cũ (useInternalNote). */
function InternalNote({ contractId, initial }: { contractId: string; initial: string | null | undefined }) {
  const { value, setValue, state } = useInternalNote(contractId, initial);
  const bad = state === "missing" || state === "error";
  return (
    <Section title="Ghi chú nội bộ" icon={Lock} desc="Chỉ người trong studio thấy — khách không đọc được ở cổng hợp đồng.">
      <textarea
        className={inputCls}
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="vd: khách quen, đã bớt 1tr; cô dâu ngại chụp cận mặt; nhớ mang thêm đèn"
        aria-label="Ghi chú nội bộ"
      />
      <p
        className="mt-2 flex items-center gap-1 text-[12px]"
        style={{ color: state === "saved" ? "var(--gn)" : bad ? "var(--rd)" : "var(--tx3)" }}
      >
        {state === "saving" ? (
          "Đang lưu…"
        ) : state === "saved" ? (
          <>
            <Check size={13} /> Đã lưu
          </>
        ) : state === "missing" ? (
          INTERNAL_NOTE_MISSING
        ) : state === "error" ? (
          "Không lưu được — thử lại sau."
        ) : (
          "Tự động lưu khi nhập"
        )}
      </p>
    </Section>
  );
}
