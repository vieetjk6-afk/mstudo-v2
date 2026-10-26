"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarRange, MapPin, Plus, Trash2, User } from "lucide-react";
import DateInput from "@/components/DateInput";
import { Badge, Callout, Empty, Field, Section, btn, inputCls, type Tone } from "@/components/v2/kit";
import { Menu, Modal } from "@/components/v2/kit-client";
import { fmtDate } from "@/lib/date";
import { apptTimeRange, apptTitle, kindMeta } from "@/lib/appointments";
import { APPOINTMENT_KINDS, APPOINTMENT_KIND_LABEL, APPOINTMENT_STATUS_LABEL, type AppointmentKind, type AppointmentStatus, type StudioAppointment } from "@/lib/types";
import { useContractAppointments, type ContractAppointmentsProps } from "./ContractAppointments";
import { DateTile } from "./ContractV2Shared";

/* ═══════════════════════════════════════════════════════════════════════════
   LỊCH HẸN DỊCH VỤ của hợp đồng — giao diện mới (tab Ê-kíp & lịch). Cùng logic
   với khối bản cũ (useContractAppointments, bảng studio_appointments): mỗi buổi
   hẹn một dòng gọn có ô ngày, loại hẹn, giờ · phòng · người phụ trách. Thêm
   buổi trong hộp thoại; xoá thì hỏi lại. Sửa chi tiết vẫn ở màn Lịch studio.
   ═══════════════════════════════════════════════════════════════════════════ */

const STATUS_TONE: Record<AppointmentStatus, Tone> = { scheduled: "gray", checked_in: "blue", done: "green", cancelled: "red" };

export default function ContractAppointmentsV2(props: ContractAppointmentsProps) {
  const { roster, canEdit } = props;
  const h = useContractAppointments(props);
  const { rows, busy, err, setErr, form, setForm } = h;
  const [adding, setAdding] = useState(false);
  const [del, setDel] = useState<StudioAppointment | null>(null);

  return (
    <>
      <Section
        title="Lịch hẹn dịch vụ"
        icon={CalendarRange}
        desc="Trang điểm, thử đồ, tư vấn… Hiện trên lịch tuần của studio, trang người phụ trách và cổng khách."
        actions={
          <>
            <Link href="/dashboard/studio/calendar?tab=studio" className={btn("ghost", "sm", "hidden sm:inline-flex")}>
              Mở lịch studio <ArrowUpRight size={15} />
            </Link>
            {canEdit && (
              <button
                type="button"
                className={btn("secondary", "sm")}
                onClick={() => {
                  setErr(null);
                  setAdding(true);
                }}
                aria-label="Thêm buổi hẹn"
              >
                <Plus size={15} /> <span className="hidden sm:inline">Thêm buổi hẹn</span>
              </button>
            )}
          </>
        }
        flush
      >
        {err && !adding && (
          <div className="px-4 pt-4 sm:px-5">
            <Callout tone="red">{err}</Callout>
          </div>
        )}
        {rows.length === 0 ? (
          <Empty compact icon={CalendarRange} title="Chưa có buổi hẹn nào" hint="Thêm buổi thử đồ, trang điểm, tư vấn… để cả studio và khách cùng thấy." />
        ) : (
          <ul>
            {rows.map((a) => (
              <ApptRow key={a.id} a={a} canEdit={canEdit} onDelete={() => setDel(a)} />
            ))}
          </ul>
        )}
        <div className="px-4 py-3 sm:hidden" style={{ borderTop: "1px solid var(--bd2)" }}>
          <Link href="/dashboard/studio/calendar?tab=studio" className="inline-flex items-center gap-1 text-[13px] font-semibold" style={{ color: "var(--ac)" }}>
            Mở lịch studio <ArrowUpRight size={14} />
          </Link>
        </div>
      </Section>

      <Modal
        open={adding}
        onClose={() => (busy ? undefined : setAdding(false))}
        icon={CalendarRange}
        title="Thêm buổi hẹn"
        desc="Đổi phòng, đổi người hay check-in làm ở màn Lịch studio."
        width={520}
        footer={
          <>
            <button type="button" className={btn("ghost")} onClick={() => setAdding(false)} disabled={busy}>
              Thôi
            </button>
            <button
              type="button"
              className={btn("primary")}
              disabled={busy}
              onClick={async () => {
                if (await h.add()) setAdding(false);
              }}
            >
              <Plus size={16} /> {busy ? "Đang thêm…" : "Thêm buổi hẹn"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Loại hẹn" htmlFor="ap-kind">
            <select
              id="ap-kind"
              className={inputCls}
              value={form.kind}
              onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value as AppointmentKind }))}
            >
              {APPOINTMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {APPOINTMENT_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ngày" htmlFor="ap-date" error={err && !form.appt_date ? err : undefined}>
              <DateInput id="ap-date" className={inputCls} value={form.appt_date} onChange={(v) => setForm((p) => ({ ...p, appt_date: v }))} />
            </Field>
            <Field label="Giờ bắt đầu" htmlFor="ap-time" hint="Bỏ trống = cả ngày">
              <input id="ap-time" className={inputCls} placeholder="08:00" value={form.start_time} onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))} />
            </Field>
            <Field label="Phòng" htmlFor="ap-room">
              <input id="ap-room" className={inputCls} placeholder="vd: Phòng makeup 1" value={form.room} onChange={(e) => setForm((p) => ({ ...p, room: e.target.value }))} />
            </Field>
            <Field label="Người phụ trách" htmlFor="ap-crew">
              <select id="ap-crew" className={inputCls} value={form.crew_id} onChange={(e) => setForm((p) => ({ ...p, crew_id: e.target.value }))}>
                <option value="">— Chưa chọn —</option>
                {roster.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {err && form.appt_date && <Callout tone="red">{err}</Callout>}
        </div>
      </Modal>

      <Modal
        open={!!del}
        onClose={() => setDel(null)}
        icon={Trash2}
        title="Xoá buổi hẹn này?"
        desc={del ? `${apptTitle(del)} · ${fmtDate(del.appt_date)}. Buổi hẹn biến mất khỏi lịch studio và cổng khách.` : undefined}
        width={440}
        footer={
          <>
            <button type="button" className={btn("ghost")} onClick={() => setDel(null)}>
              Thôi
            </button>
            <button
              type="button"
              className={btn("danger")}
              onClick={async () => {
                const a = del;
                setDel(null);
                if (a) await h.remove(a.id);
              }}
            >
              Xoá buổi hẹn
            </button>
          </>
        }
      />
    </>
  );
}

/* ── Một buổi hẹn ── */
function ApptRow({ a, canEdit, onDelete }: { a: StudioAppointment; canEdit: boolean; onDelete: () => void }) {
  const { label, tone, Icon } = kindMeta(a.kind);
  const place = [a.room, a.location].filter(Boolean).join(" · ");
  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
      <DateTile iso={a.appt_date} size={46} muted={a.status === "cancelled"} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="v2-badge" style={{ background: tone.soft, color: tone.fg }}>
            <Icon size={12} strokeWidth={2.4} /> {label}
          </span>
          {a.status !== "scheduled" && <Badge tone={STATUS_TONE[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>}
        </div>
        <p className="mt-1 truncate text-[14px] font-semibold" style={{ textDecoration: a.status === "cancelled" ? "line-through" : undefined }}>
          {apptTitle(a)}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
          <span className="v2-num">{a.start_time ? apptTimeRange(a) : "Cả ngày"}</span>
          {place && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin size={13} className="flex-none" /> <span className="truncate">{place}</span>
            </span>
          )}
          {a.crew_name && (
            <span className="flex items-center gap-1">
              <User size={13} /> {a.crew_name}
            </span>
          )}
        </p>
      </div>
      {canEdit && <Menu label={`Thao tác cho ${apptTitle(a)}`} items={[{ label: "Xoá buổi hẹn", icon: Trash2, danger: true, onClick: onDelete }]} />}
    </li>
  );
}
