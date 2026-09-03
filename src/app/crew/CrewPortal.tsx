"use client";

import { useEffect, useState } from "react";
import CrewTimeClock, { type OpenEntry } from "./CrewTimeClock";
import type { TimesheetRow } from "@/lib/timesheet";

import { fmtDate } from "@/lib/date";
import { Phone, MapPin, Calendar, Check, X, Camera } from "lucide-react";
import Turnstile from "@/components/Turnstile";
import CrewSchedule, { type ScheduleEntry, type ShiftPlan } from "./CrewSchedule";
import { CrewProfileCard, CrewRegisterCard, CrewCalendarSync, type CrewProfile } from "./CrewExtras";
import type { ShiftLetter } from "@/lib/crew-shift";
import {
  vnd,
  SHOOT_TYPE_LABEL,
  CREW_ROLE_LABEL,
  CREW_STATUS_LABEL,
  type ShootType,
  type CrewRole,
  type CrewStatus,
} from "@/lib/types";

type Lang = "vi" | "en";
const TR = {
  vi: {
    eyebrow: "Cổng cộng tác viên",
    title: "Công việc của tôi",
    subtitle: "Nhập số điện thoại của bạn để xem các buổi chụp / quay được studio giao & mức lương.",
    phonePh: "Số điện thoại của bạn",
    search: "Xem việc",
    searching: "Đang tìm…",
    noJobs: "Chưa có công việc nào cho số này.",
    contract: "Hợp đồng",
    studioNote: "Yêu cầu của studio:",
    salary: "Lương:",
    decline: "Từ chối",
    accept: "Nhận việc",
    switchTo: "Đổi sang",
  },
  en: {
    eyebrow: "Crew portal",
    title: "My assignments",
    subtitle: "Enter your phone number to see shoots assigned by studios & your pay.",
    phonePh: "Your phone number",
    search: "View jobs",
    searching: "Searching…",
    noJobs: "No assignments found for this number.",
    contract: "Contract",
    studioNote: "Studio note:",
    salary: "Pay:",
    decline: "Decline",
    accept: "Accept",
    switchTo: "Switch to",
  },
} as const;

type Assignment = {
  id: string;
  /** Hợp đồng của dòng phân công này — khác `id` (id của chính dòng phân công). */
  contract_id?: string | null;
  name: string;
  role: CrewRole;
  salary: number;
  status: CrewStatus;
  note: string | null;
  contract: {
    title: string;
    client_name: string | null;
    shoot_type: ShootType;
    event_date: string | null;
    event_time: string | null;
    location: string | null;
    status: string;
  } | null;
};



const STATUS_TONE: Record<string, string> = {
  pending: "var(--text3)",
  accepted: "#7bb38a",
  declined: "#c77b7b",
};

export default function CrewPortal({ studio }: { studio?: { id: string; name: string; crewToken: string } } = {}) {
  const [lang, setLang] = useState<Lang>("vi");
  useEffect(() => {
    const stored = localStorage.getItem("vk_lang") as Lang | null;
    if (stored === "en") setLang("en");
  }, []);
  const tr = TR[lang];

  const [phone, setPhone] = useState("");
  const [list, setList] = useState<Assignment[] | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [shiftPlan, setShiftPlan] = useState<ShiftPlan>(null);
  const [calToken, setCalToken] = useState<string | null>(null);
  const [openEntry, setOpenEntry] = useState<OpenEntry>(null);
  const [sheet, setSheet] = useState<TimesheetRow[]>([]);
  const [profiles, setProfiles] = useState<CrewProfile[]>([]);
  // Vào bằng link riêng của studio: chưa có trong sổ studio đó thì CHỈ hiện form
  // đăng ký, không hiện lịch — lịch của studio này chưa liên quan gì tới họ.
  const inThisStudio = !studio || profiles.some((p) => p.owner_id === studio.id);
  /** Studio đã NHẬN thợ vào sổ — chỉ những nơi này mới chấm công được. */
  const acceptedStudios = profiles.filter((p) => p.status !== "pending");
  const studioIds = acceptedStudios.map((p) => p.owner_id);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  async function load(e?: React.FormEvent) {
    e?.preventDefault();
    if (!phone.trim() || !captchaToken) return;
    setLoading(true);
    const res = await fetch("/api/crew", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, captcha: captchaToken }),
    });
    setLoading(false);
    const j = await res.json().catch(() => ({ assignments: [], busy: [], shift: null }));
    setList(j.assignments ?? []);
    setSchedule(j.busy ?? []);
    setShiftPlan(j.shift ?? null);
    setCalToken(j.calendarToken ?? null);
    setOpenEntry(j.timesheet?.open ?? null);
    // Đổi tên trường từ snake_case của DB sang hình dữ liệu của @/lib/timesheet.
    setSheet(
      ((j.timesheet?.recent ?? []) as {
        id: string; work_date: string; started_at: string | null; ended_at: string | null; contract_id: string | null; note: string | null;
      }[]).map((r) => ({
        id: r.id, phone, workDate: r.work_date, startedAt: r.started_at,
        endedAt: r.ended_at, contractId: r.contract_id, note: r.note,
      }))
    );
    // Phải CHỜ hồ sơ: khi vào bằng link riêng của studio, việc hiện lịch hay
    // hiện form đăng ký phụ thuộc vào thợ đã có trong sổ studio đó chưa. Nạp
    // song song rồi mới vẽ thì tránh chớp nhoáng sai màn hình.
    const prof = await fetch("/api/crew/profile", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }),
    })
      .then((r) => r.json())
      .catch(() => ({ profiles: [] }));
    setProfiles(prof.profiles ?? []);
  }

  // Mọi thao tác ghi đều nạp lại: server là nơi chốt giờ (chuẩn hoá, cờ ca đêm),
  // nên đừng đoán trạng thái mới ở client rồi lệch với DB.
  async function post(payload: Record<string, unknown>) {
    setBusy("sched");
    const res = await fetch("/api/crew", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, ...payload }),
    });
    setBusy(null);
    if (res.ok) await load();
  }

  async function addEntry(v: { date: string; start: string; end: string; title: string; studioId: string }) {
    await post({ action: "busy_add", ...v });
  }

  async function removeEntry(id: string) {
    await post({ action: "busy_remove", id });
  }

  async function setShift(shift: ShiftLetter | "") {
    await post({ action: "shift_set", company: "hoa_phat", shift });
  }

  async function clockIn(v: { studioId: string; contractId: string }) {
    await post({ action: "clock_in", studioId: v.studioId, contractId: v.contractId || null });
  }

  async function clockOut(note: string) {
    await post({ action: "clock_out", studioId: studioIds[0] ?? "", note });
  }

  async function respond(id: string, status: "accepted" | "declined") {
    setBusy(id);
    const res = await fetch("/api/crew", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "respond", id, phone, status }),
    });
    setBusy(null);
    if (res.ok) setList((p) => (p ? p.map((a) => (a.id === id ? { ...a, status } : a)) : p));
  }

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
                      {CREW_ROLE_LABEL[a.role] ?? a.role}
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

          <CrewProfileCard profiles={profiles} phone={phone} onSaved={load} />

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

          <CrewCalendarSync phone={phone} token={calToken} onToken={setCalToken} />
        </div>
      )}
    </div>
  );
}
