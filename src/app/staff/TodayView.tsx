"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays, Wand2, FileText, MapPin, Phone, StickyNote, Check, CircleDot,
  CheckCircle2, Circle, CalendarRange,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Panel, PanelHead, Pill, EmptyState, KindPill } from "@/components/studio/ui";
import { avatarStyle, initials } from "@/lib/avatar";
import { fmtDayMonth, fmtDow } from "@/lib/date";
import { apptDuration, apptTimeRange, apptTitle, kindMeta } from "@/lib/appointments";
import type { AppointmentStatus, StudioAppointment } from "@/lib/types";
import type { ChecklistRow } from "./StaffPortal";

/* ═══════════════════════════════════════════════════════════════════════════
   TAB "HÔM NAY" — 3 thẻ KPI + timeline lịch trong ngày, rail phải là lịch sắp
   tới và checklist việc sau buổi chụp.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function TodayView({
  today, todayAppts, upcoming, openTaskCount, overdueTaskCount, monthCount, contractCount, checklist, toast,
}: {
  today: string;
  todayAppts: StudioAppointment[];
  upcoming: StudioAppointment[];
  openTaskCount: number;
  overdueTaskCount: number;
  monthCount: number;
  contractCount: number;
  checklist: ChecklistRow[];
  toast: (m: string) => void;
}) {
  const supabase = createClient();
  const [appts, setAppts] = useState(todayAppts);
  const [checks, setChecks] = useState(checklist);

  /** Check-in → hoàn thành. Cùng cột `status` với lịch studio, nên chủ studio
   *  thấy ngay nhân viên đã tới điểm hẹn chưa mà không cần nhắn hỏi. */
  async function advance(a: StudioAppointment) {
    const next: AppointmentStatus = a.status === "scheduled" ? "checked_in" : "done";
    const patch =
      next === "checked_in"
        ? { status: next, checked_in_at: new Date().toISOString() }
        : { status: next, done_at: new Date().toISOString() };
    setAppts((p) => p.map((x) => (x.id === a.id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("studio_appointments").update(patch).eq("id", a.id);
    if (error) {
      setAppts((p) => p.map((x) => (x.id === a.id ? a : x)));
      toast("Không cập nhật được — thử lại.");
      return;
    }
    toast(next === "checked_in" ? `Đã check-in · ${apptTitle(a)}` : `Đã đánh dấu hoàn thành · ${apptTitle(a)}`);
  }

  async function toggleTask(t: ChecklistRow) {
    const done = !t.done;
    setChecks((p) => p.map((x) => (x.id === t.id ? { ...x, done } : x)));
    const { error } = await supabase.from("contract_tasks").update({ done }).eq("id", t.id);
    if (error) {
      setChecks((p) => p.map((x) => (x.id === t.id ? t : x)));
      toast("Không lưu được — thử lại.");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3.5 min-[1080px]:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3.5">
        {/* ── KPI ─────────────────────────────────────────────────────── */}
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <Kpi icon={CalendarDays} label="Buổi tháng này" value={String(monthCount)} sub={`${appts.length} buổi trong hôm nay`} />
          <Kpi
            icon={Wand2}
            label="Việc hậu kỳ"
            value={String(openTaskCount)}
            sub={overdueTaskCount > 0 ? `${overdueTaskCount} việc trễ hạn` : "Không có việc trễ hạn"}
            subTone={overdueTaskCount > 0 ? "var(--rd)" : undefined}
          />
          {/* Bản thiết kế đặt "Thù lao tạm tính" ở ô thứ ba. Sổ tiền công của repo
              (contract_crew) khoá theo TÊN/SĐT thợ, không theo tài khoản đăng
              nhập, nên không thể quy ra tiền của một nhân viên mà không đoán. Ô
              này hiện số hợp đồng đang phụ trách — dữ liệu thật, cùng mức hữu ích. */}
          <Kpi icon={FileText} label="Hợp đồng phụ trách" value={String(contractCount)} sub="Đang thực hiện" />
        </div>

        {/* ── Timeline hôm nay ───────────────────────────────────────── */}
        <Panel className="px-[18px] pb-2 pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-[14px] font-bold">Lịch hôm nay</h2>
            <Link href="/dashboard/studio/schedule" className="text-[12px] font-semibold" style={{ color: "var(--ac)" }}>
              Mở lịch studio →
            </Link>
          </div>

          {appts.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Hôm nay chưa có buổi nào" hint="Lịch được studio xếp ở màn Lịch studio sẽ hiện tại đây." />
          ) : (
            <div className="flex flex-col">
              {appts.map((a, i) => {
                const { label, tone, Icon } = kindMeta(a.kind);
                const checked = a.status === "checked_in" || a.status === "done";
                return (
                  <div key={a.id} className="flex gap-2.5">
                    {/* Cột giờ */}
                    <div className="w-[56px] flex-none pt-3.5 text-right">
                      <p className="tnum text-[13px] font-bold">{a.start_time || "—"}</p>
                      <p className="text-[11px]" style={{ color: "var(--tx3)" }}>{apptDuration(a)}</p>
                    </div>

                    {/* Rail chấm + đường kẻ */}
                    <div className="flex w-[14px] flex-none flex-col items-center pt-[18px]">
                      <span
                        className="h-[11px] w-[11px] flex-none rounded-full"
                        style={{ background: tone.fg, border: "2px solid var(--sf)", boxShadow: `0 0 0 2px ${tone.soft}` }}
                      />
                      {i < appts.length - 1 && <span className="mt-1 w-[2px] flex-1" style={{ background: "var(--bd2)" }} />}
                    </div>

                    {/* Thẻ nội dung */}
                    <div className="min-w-0 flex-1 pb-3 pt-2.5">
                      <div
                        className="rounded-[13px] px-3.5 py-3"
                        style={{
                          border: "1px solid var(--bd)",
                          // Đã check-in → nền xanh nhạt, thấy ngay buổi nào đã tới.
                          background: checked ? "var(--gnS)" : "var(--sf)",
                        }}
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                          <KindPill icon={Icon} fg={tone.fg} soft={tone.soft}>{label}</KindPill>
                          {a.contract_id && (
                            <Link
                              href={`/dashboard/studio/contracts/${a.contract_id}`}
                              className="text-[11px] font-semibold"
                              style={{ fontFamily: "ui-monospace, monospace", color: "var(--tx3)" }}
                            >
                              Hợp đồng →
                            </Link>
                          )}
                          {a.status === "checked_in" && <Pill tone="green" dot>Đã check-in</Pill>}
                          {a.status === "done" && <Pill tone="green">Đã hoàn tất</Pill>}
                        </div>

                        <p className="mt-1.5 text-[14.5px] font-bold" style={{ textWrap: "pretty" }}>{apptTitle(a)}</p>

                        {(a.location || a.room || a.client_phone) && (
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ color: "var(--tx2)" }}>
                            {(a.location || a.room) && (
                              <span className="flex items-center gap-1">
                                <MapPin size={15} style={{ color: "var(--tx3)" }} />
                                {[a.room, a.location].filter(Boolean).join(" · ")}
                              </span>
                            )}
                            {a.client_phone && (
                              <a href={`tel:${a.client_phone}`} className="flex items-center gap-1">
                                <Phone size={15} style={{ color: "var(--tx3)" }} />
                                {a.client_phone}
                              </a>
                            )}
                          </p>
                        )}

                        {a.note && (
                          <p
                            className="mt-2 flex items-start gap-1.5 rounded-[10px] px-2.5 py-2 text-[12px]"
                            style={{ background: "var(--amS)", color: "var(--tx2)" }}
                          >
                            <StickyNote size={15} style={{ flex: "none", color: "var(--am)" }} />
                            <span style={{ textWrap: "pretty" }}>{a.note}</span>
                          </p>
                        )}

                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <span
                            className="flex h-[25px] w-[25px] flex-none items-center justify-center rounded-full text-[9px] font-bold"
                            style={{ ...avatarStyle(a.crew_name), border: "2px solid var(--sf)" }}
                          >
                            {initials(a.crew_name)}
                          </span>
                          <span className="text-[11.5px]" style={{ color: "var(--tx3)" }}>
                            {a.crew_name || "Chưa phân công"}
                          </span>
                          {a.status !== "done" && (
                            <button
                              onClick={() => advance(a)}
                              className="ml-auto flex flex-none items-center gap-1.5 rounded-[9px] px-3 py-[7px] text-[12px] font-bold"
                              style={
                                a.status === "scheduled"
                                  ? { background: "var(--ac)", color: "#fff" }
                                  : { background: "var(--sf)", border: "1px solid var(--bd)", color: "var(--tx)" }
                              }
                            >
                              {a.status === "scheduled" ? <><CircleDot size={14} /> Check-in</> : <><Check size={14} /> Hoàn thành</>}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Rail phải ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3.5">
        <Panel>
          <PanelHead icon={CalendarRange} tone="brand" title="Sắp tới trong tuần" count={String(upcoming.length)} />
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarRange} title="Tuần này trống" hint="Chưa có buổi nào được xếp trong 7 ngày tới." />
          ) : (
            <div className="flex flex-col">
              {upcoming.map((a) => {
                const { tone, Icon } = kindMeta(a.kind);
                return (
                  <div key={a.id} className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderTop: "1px solid var(--bd2)" }}>
                    <span
                      className="flex h-[42px] w-[42px] flex-none flex-col items-center justify-center rounded-[10px]"
                      style={{ background: tone.soft, color: tone.fg }}
                    >
                      <Icon size={13} />
                      <span className="tnum text-[10.5px] font-bold">{fmtDayMonth(a.appt_date)}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold">{apptTitle(a)}</p>
                      <p className="tnum truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
                        {fmtDow(a.appt_date)} · {apptTimeRange(a)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="px-4 py-3" style={{ borderTop: "1px solid var(--bd2)" }}>
            <Link
              href="/dashboard/studio/schedule"
              className="block rounded-[9px] py-2 text-center text-[12.5px] font-semibold"
              style={{ border: "1px solid var(--bd)", color: "var(--tx)" }}
            >
              Mở lịch studio
            </Link>
          </div>
        </Panel>

        <Panel>
          <PanelHead
            icon={CheckCircle2}
            tone="green"
            title="Việc cần làm sau buổi chụp"
            count={`${checks.filter((c) => c.done).length}/${checks.length}`}
          />
          {checks.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Chưa có việc nào" hint="Checklist của hợp đồng bạn phụ trách sẽ hiện ở đây." />
          ) : (
            <div className="flex flex-col">
              {checks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleTask(t)}
                  className="flex items-start gap-2.5 px-4 py-2.5 text-left"
                  style={{ borderTop: "1px solid var(--bd2)" }}
                >
                  {t.done ? (
                    <CheckCircle2 size={17} style={{ flex: "none", color: "var(--gn)", marginTop: 1 }} />
                  ) : (
                    <Circle size={17} style={{ flex: "none", color: "var(--tx3)", marginTop: 1 }} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className="block text-[12.5px] font-semibold"
                      style={{ color: t.done ? "var(--tx3)" : "var(--tx)", textDecoration: t.done ? "line-through" : "none", textWrap: "pretty" }}
                    >
                      {t.label}
                    </span>
                    <span className="block truncate text-[11px]" style={{ color: "var(--tx3)" }}>
                      {t.contract_code ? `${t.contract_code} · ` : ""}{t.contract_title}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** Thẻ KPI của cổng nhân viên: nhãn viết hoa nhỏ + số lớn + dòng phụ.
 *  Khác StatCard của khu quản lý (ô icon nền nhạt, số 25px) — bản thiết kế cổng
 *  nhân viên vẽ gọn hơn để 3 thẻ vừa một hàng trên điện thoại. */
function Kpi({
  icon: Icon, label, value, sub, subTone,
}: { icon: typeof CalendarDays; label: string; value: string; sub: string; subTone?: string }) {
  return (
    <div className="rounded-[13px] px-[15px] py-[13px]" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase" style={{ letterSpacing: ".4px", color: "var(--tx3)" }}>
        <Icon size={16} /> {label}
      </p>
      <p className="tnum mt-1.5 text-[21px] font-bold leading-none" style={{ letterSpacing: "-.6px" }}>{value}</p>
      <p className="mt-1 text-[11.5px]" style={{ color: subTone ?? "var(--tx3)", fontWeight: subTone ? 700 : 400 }}>{sub}</p>
    </div>
  );
}
