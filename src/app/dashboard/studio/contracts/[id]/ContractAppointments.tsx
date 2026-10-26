"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarRange, Plus, Trash2, MapPin, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { KindPill } from "@/components/studio/ui";
import DateInput from "@/components/DateInput";
import { fmtDate } from "@/lib/date";
import { apptTimeRange, apptTitle, kindMeta } from "@/lib/appointments";
import {
  APPOINTMENT_KINDS, APPOINTMENT_KIND_LABEL, APPOINTMENT_STATUS_LABEL,
  type AppointmentKind, type StudioAppointment, type StudioCrew,
} from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   LỊCH HẸN DỊCH VỤ CỦA MỘT HỢP ĐỒNG — khối trong màn chi tiết hợp đồng.

   Cùng bảng `studio_appointments` với màn Lịch studio và cổng nhân viên, nên
   thêm một buổi thử đồ ở đây là buổi đó xuất hiện luôn trên lịch tuần, trên
   trang riêng của người phụ trách, và trên cổng khách hàng của hợp đồng này.

   Khối này CỐ Ý gọn: chỉ thêm/xoá và xem. Sửa chi tiết (đổi phòng, đổi người,
   check-in) làm ở màn Lịch studio — nơi có ngữ cảnh cả tuần để biết đổi sang giờ
   nào thì không trùng.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ContractAppointments({
  ownerId, contractId, clientName, clientPhone, initial, roster, canEdit,
}: {
  ownerId: string;
  contractId: string;
  clientName: string;
  clientPhone: string;
  initial: StudioAppointment[];
  roster: StudioCrew[];
  canEdit: boolean;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<StudioAppointment[]>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    kind: "fitting" as AppointmentKind,
    appt_date: "",
    start_time: "",
    room: "",
    crew_id: "",
  });

  async function add() {
    if (!form.appt_date) { setErr("Chọn ngày cho buổi hẹn."); return; }
    setBusy(true);
    setErr(null);
    const crew = roster.find((r) => r.id === form.crew_id);
    const { data, error } = await supabase
      .from("studio_appointments")
      .insert({
        owner_id: ownerId,
        contract_id: contractId,
        kind: form.kind,
        title: "",
        appt_date: form.appt_date,
        start_time: form.start_time.trim() || null,
        room: form.room.trim() || null,
        crew_id: crew?.id ?? null,
        crew_name: crew?.name ?? null,
        client_name: clientName || null,
        client_phone: clientPhone || null,
      })
      .select("*")
      .single();
    setBusy(false);
    if (error || !data) {
      setErr(
        error?.message?.includes("studio_appointments")
          ? "Chưa chạy migration studio_appointments.sql trong Supabase."
          : error?.message || "Không thêm được lịch hẹn."
      );
      return;
    }
    setRows((p) => [...p, data as StudioAppointment].sort((a, b) => a.appt_date.localeCompare(b.appt_date)));
    setForm((p) => ({ ...p, appt_date: "", start_time: "" }));
  }

  async function remove(id: string) {
    const { error } = await supabase.from("studio_appointments").delete().eq("id", id);
    if (error) { setErr(error.message); return; }
    setRows((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div className="card p-6">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 font-serif text-lg font-medium">
          <CalendarRange size={18} /> Lịch hẹn dịch vụ
        </h2>
        <Link href="/dashboard/studio/calendar?tab=studio" className="ml-auto text-[11.5px] font-bold" style={{ color: "var(--ac)" }}>
          Mở lịch studio →
        </Link>
      </div>
      <p className="mb-4 text-xs" style={{ color: "var(--text3)" }}>
        Trang điểm, thử đồ, chụp, tư vấn — có người phụ trách và phòng. Hiện trên lịch tuần của
        studio, trang riêng của người phụ trách và cổng khách hàng của hợp đồng này.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text3)" }}>Chưa có buổi hẹn nào.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((a) => {
            const { label, tone, Icon } = kindMeta(a.kind);
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl px-3 py-2.5" style={{ background: "var(--surface2)" }}>
                <KindPill icon={Icon} fg={tone.fg} soft={tone.soft}>{label}</KindPill>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium" style={{ textWrap: "pretty" }}>{apptTitle(a)}</p>
                  <p className="tnum flex flex-wrap items-center gap-x-3 text-[11px]" style={{ color: "var(--text3)" }}>
                    <span>{fmtDate(a.appt_date)}{a.start_time ? ` · ${apptTimeRange(a)}` : ""}</span>
                    {(a.room || a.location) && (
                      <span className="flex items-center gap-1"><MapPin size={12} /> {[a.room, a.location].filter(Boolean).join(" · ")}</span>
                    )}
                    {a.crew_name && <span className="flex items-center gap-1"><User size={12} /> {a.crew_name}</span>}
                    {a.status !== "scheduled" && <span style={{ fontWeight: 700 }}>{APPOINTMENT_STATUS_LABEL[a.status]}</span>}
                  </p>
                </div>
                {canEdit && (
                  <button onClick={() => remove(a.id)} style={{ color: "var(--text3)" }} aria-label="Xoá buổi hẹn">
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <>
          <div className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-12" style={{ borderColor: "var(--border)" }}>
            <select
              className="input sm:col-span-3"
              value={form.kind}
              onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value as AppointmentKind }))}
            >
              {APPOINTMENT_KINDS.map((k) => (
                <option key={k} value={k}>{APPOINTMENT_KIND_LABEL[k]}</option>
              ))}
            </select>
            <DateInput wrapperClassName="sm:col-span-3" value={form.appt_date} onChange={(v) => setForm((p) => ({ ...p, appt_date: v }))} />
            <input className="input sm:col-span-2" placeholder="08:00" value={form.start_time} onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))} />
            <input className="input sm:col-span-2" placeholder="Phòng" value={form.room} onChange={(e) => setForm((p) => ({ ...p, room: e.target.value }))} />
            <select
              className="input sm:col-span-2"
              value={form.crew_id}
              onChange={(e) => setForm((p) => ({ ...p, crew_id: e.target.value }))}
            >
              <option value="">Người phụ trách</option>
              {roster.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          {err && <p className="mt-2 text-[11.5px] font-semibold" style={{ color: "var(--rd)" }}>{err}</p>}
          <button onClick={add} disabled={busy} className="btn-ghost mt-3">
            <Plus size={15} /> {busy ? "Đang thêm…" : "Thêm buổi hẹn"}
          </button>
        </>
      )}
    </div>
  );
}
