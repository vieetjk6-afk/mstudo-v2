"use client";

import CrewTimeClock from "./CrewTimeClock";
import CrewFreeSlots from "./CrewFreeSlots";

import { fmtDate } from "@/lib/date";
import { crewRoleLabel } from "@/lib/crew-roles";
import { Phone, MapPin, Calendar, Check, X, Camera } from "lucide-react";
import Turnstile from "@/components/Turnstile";
import CrewSchedule from "./CrewSchedule";
import { CrewProfileCard, CrewRegisterCard, CrewCalendarSync } from "./CrewExtras";
import { vnd, SHOOT_TYPE_LABEL, CREW_STATUS_LABEL } from "@/lib/types";
import { useCrewPortal, type CrewStudio } from "./useCrewPortal";

// Chuỗi hai thứ tiếng (CREW_TR), kiểu Assignment và toàn bộ trạng thái + thao
// tác (tra cứu, nhận/từ chối, chấm công, khai rảnh, báo bận, ca công ty) nằm ở
// ./useCrewPortal — dùng chung với giao diện mới (CrewPortalV2).

const STATUS_TONE: Record<string, string> = {
  pending: "var(--text3)",
  accepted: "#7bb38a",
  declined: "#c77b7b",
};

export default function CrewPortal({ studio }: { studio?: CrewStudio } = {}) {
  const {
    tr, phone, setPhone, list, schedule, shiftPlan, calToken, setCalToken, openEntry, sheet, freeSlots, profiles,
    inThisStudio, acceptedStudios, loading, busy, captchaToken, setCaptchaToken, session,
    load, addEntry, removeEntry, setShift, clockIn, clockOut, addFree, removeFree, respond,
  } = useCrewPortal(studio);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <p className="eyebrow mb-1.5">{tr.eyebrow}</p>
      <h1 className="font-serif text-3xl font-medium">{tr.title}</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text2)" }}>{tr.subtitle}</p>

      <form onSubmit={load} className="card mt-6 p-4 flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            className="input"
            placeholder={tr.phonePh}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button type="submit" disabled={loading || !captchaToken} className="btn-primary shrink-0">
            {loading ? tr.searching : tr.search}
          </button>
        </div>
        <Turnstile
          onVerify={setCaptchaToken}
          onExpire={() => setCaptchaToken(null)}
          onError={() => setCaptchaToken(null)}
        />
      </form>

      {studio && list !== null && !inThisStudio && (
        <div className="mt-6">
          <CrewRegisterCard studioName={studio.name} crewToken={studio.crewToken} phone={phone} />
        </div>
      )}

      {list !== null && inThisStudio && (
        <div className="mt-6 space-y-3">
          {list.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-14 text-center">
              <Phone size={20} style={{ color: "var(--text3)" }} />
              <p className="mt-3 text-sm" style={{ color: "var(--text2)" }}>{tr.noJobs}</p>
            </div>
          ) : (
            list.map((a) => (
              <div key={a.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-serif text-lg font-medium">
                      <Camera size={16} style={{ color: "#c7a76b" }} />
                      {a.contract?.title || tr.contract}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text3)" }}>
                      {a.role_label || crewRoleLabel(a.role)}
                      {a.contract ? ` · ${SHOOT_TYPE_LABEL[a.contract.shoot_type]}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs" style={{ color: STATUS_TONE[a.status] }}>
                    {CREW_STATUS_LABEL[a.status]}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-sm" style={{ color: "var(--text2)" }}>
                  {a.contract?.event_date && (
                    <p className="flex items-center gap-2">
                      <Calendar size={14} style={{ color: "var(--text3)" }} />
                      {fmtDate(a.contract.event_date)}{a.contract.event_time ? ` · ${a.contract.event_time}` : ""}
                    </p>
                  )}
                  {a.contract?.location && (
                    <p className="flex items-center gap-2">
                      <MapPin size={14} style={{ color: "var(--text3)" }} /> {a.contract.location}
                    </p>
                  )}
                </div>

                {a.note && (
                  <p className="mt-3 rounded-xl px-3 py-2 text-sm" style={{ background: "var(--surface2)", color: "var(--text2)" }}>
                    <b>{tr.studioNote}</b> {a.note}
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--border)" }}>
                  <span className="text-sm" style={{ color: "var(--text2)" }}>
                    {tr.salary} <b style={{ color: "var(--text)" }}>{vnd(a.salary)}</b>
                  </span>
                  {a.status === "pending" ? (
                    <div className="flex gap-2">
                      <button onClick={() => respond(a.id, "declined")} disabled={busy === a.id} className="btn-ghost px-3 py-1.5 text-xs">
                        <X size={14} /> {tr.decline}
                      </button>
                      <button onClick={() => respond(a.id, "accepted")} disabled={busy === a.id} className="btn-primary px-3 py-1.5 text-xs">
                        <Check size={14} /> {tr.accept}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => respond(a.id, a.status === "accepted" ? "declined" : "accepted")}
                      disabled={busy === a.id}
                      className="btn-ghost px-3 py-1.5 text-xs"
                    >
                      {tr.switchTo} &ldquo;{a.status === "accepted" ? tr.decline : tr.accept}&rdquo;
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Chấm công đứng TRƯỚC hồ sơ và lịch bận: đây là thứ thợ mở cổng
              này để bấm, còn hai cái kia là việc thỉnh thoảng mới sửa. */}
          <CrewTimeClock
            open={openEntry}
            recent={sheet}
            studios={acceptedStudios.map((p) => ({ id: p.owner_id, name: p.studio_name }))}
            jobs={(list ?? [])
              // `contract_id` chứ KHÔNG phải `a.id`: `a.id` là dòng phân công
              // (contract_crew), còn crew_timesheet.contract_id trỏ tới hợp
              // đồng. Nhầm hai cái này thì khoá ngoại chối và giờ làm không lưu.
              .filter((a) => a.status !== "declined" && a.contract_id)
              .slice(0, 20)
              .map((a) => ({ id: a.contract_id as string, label: a.contract?.title || a.name || "Việc" }))}
            busy={busy === "sched"}
            onClockIn={clockIn}
            onClockOut={clockOut}
          />

          <CrewFreeSlots
            slots={freeSlots}
            studios={acceptedStudios.map((p) => ({ id: p.owner_id, name: p.studio_name }))}
            busy={busy === "sched"}
            onAdd={addFree}
            onRemove={removeFree}
          />

          <CrewProfileCard profiles={profiles} phone={phone} session={session} onSaved={load} />

          <CrewSchedule
            entries={schedule}
            studios={profiles
              // Chỉ studio đã NHẬN vào sổ mới báo lịch được; hồ sơ đang chờ
              // duyệt thì chưa có chỗ để gắn mốc.
              .filter((p) => p.status !== "pending")
              .map((p) => ({ id: p.owner_id, name: p.studio_name }))}
            shiftPlan={shiftPlan}
            busy={busy === "sched"}
            onAdd={addEntry}
            onRemove={removeEntry}
            onShift={setShift}
          />

          <CrewCalendarSync phone={phone} session={session} token={calToken} onToken={setCalToken} />
        </div>
      )}
    </div>
  );
}
