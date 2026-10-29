"use client";

import { useEffect, useMemo, useState } from "react";
import { todayVN } from "@/lib/date";
import type { TimesheetRow } from "@/lib/timesheet";
import type { ShiftLetter } from "@/lib/crew-shift";
import type { CrewRole, CrewStatus, ShootType } from "@/lib/types";
import type { OpenEntry } from "./CrewTimeClock";
import type { FreeSlot } from "./CrewFreeSlots";
import type { ScheduleEntry, ShiftPlan, StudioOption } from "./CrewSchedule";
import type { CrewProfile } from "./CrewExtras";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC CHUNG của cổng thợ (/crew, /crew/<token>) — bản cũ (CrewPortal và các
   thẻ con) và giao diện mới (CrewPortalV2) cùng gọi các hook dưới đây, nên tra
   cứu, nhận/từ chối việc, chấm công, khai rảnh, báo bận, ca công ty, hồ sơ và
   đồng bộ lịch đi qua ĐÚNG một đường: cùng route API, cùng payload, cùng luật
   "ghi xong thì nạp lại từ server".
   ═══════════════════════════════════════════════════════════════════════════ */

export type Lang = "vi" | "en";
export const CREW_TR = {
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

export type Assignment = {
  id: string;
  /** Hợp đồng của dòng phân công này — khác `id` (id của chính dòng phân công). */
  contract_id?: string | null;
  name: string;
  role: CrewRole;
  /** Tên vai trò server đã tra sẵn (gồm cả vai trò studio tự đặt). */
  role_label?: string;
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

export type CrewStudio = { id: string; name: string; crewToken: string };

/** Toàn bộ trạng thái + thao tác của cổng thợ. */
export function useCrewPortal(studio?: CrewStudio) {
  const [lang, setLang] = useState<Lang>("vi");
  useEffect(() => {
    const stored = localStorage.getItem("vk_lang") as Lang | null;
    if (stored === "en") setLang("en");
  }, []);
  const tr = CREW_TR[lang];

  const [phone, setPhone] = useState("");
  /** Lỗi của thao tác ghi gần nhất — để thẻ / ngăn kéo báo cho thợ thay vì lặng im. */
  const [actionError, setActionError] = useState<string | null>(null);
  const [list, setList] = useState<Assignment[] | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [shiftPlan, setShiftPlan] = useState<ShiftPlan>(null);
  const [calToken, setCalToken] = useState<string | null>(null);
  const [openEntry, setOpenEntry] = useState<OpenEntry>(null);
  const [sheet, setSheet] = useState<TimesheetRow[]>([]);
  const [freeSlots, setFreeSlots] = useState<FreeSlot[]>([]);
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
  // Phiên do lượt tra cứu qua captcha cấp — mã captcha chỉ dùng được một lần,
  // các lượt nạp lại / hồ sơ / lịch đồng bộ trình phiên này thay thế.
  const [session, setSession] = useState<string | null>(null);

  async function load(e?: React.FormEvent) {
    e?.preventDefault();
    if (!phone.trim() || !captchaToken) return;
    setLoading(true);
    const res = await fetch("/api/crew", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, captcha: captchaToken, session }),
    });
    setLoading(false);
    const j = await res.json().catch(() => ({ assignments: [], busy: [], shift: null }));
    const sess = (j.session as string | undefined) ?? null;
    setSession(sess);
    setList(j.assignments ?? []);
    setSchedule(j.busy ?? []);
    setShiftPlan(j.shift ?? null);
    setCalToken(j.calendarToken ?? null);
    setOpenEntry(j.timesheet?.open ?? null);
    setFreeSlots(
      ((j.free ?? []) as { id: string; date: string; start_time: string | null; end_time: string | null; note: string | null; owner_id?: string | null }[]).map(
        (r) => ({ id: r.id, date: r.date, start: r.start_time, end: r.end_time, note: r.note, studioId: r.owner_id ?? null })
      )
    );
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
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, session: sess }),
    })
      .then((r) => r.json())
      .catch(() => ({ profiles: [] }));
    setProfiles(prof.profiles ?? []);
  }

  // Mọi thao tác ghi đều nạp lại: server là nơi chốt giờ (chuẩn hoá, cờ ca đêm),
  // nên đừng đoán trạng thái mới ở client rồi lệch với DB.
  // Trả về true khi lưu được — nơi gọi chỉ đóng ngăn kéo khi đã lưu thật.
  async function post(payload: Record<string, unknown>): Promise<boolean> {
    setBusy("sched");
    setActionError(null);
    let ok = false;
    try {
      const res = await fetch("/api/crew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, ...payload }),
      });
      ok = res.ok;
    } catch {
      /* mất mạng — báo lỗi bên dưới, không kẹt nút "Đang lưu…" */
    } finally {
      setBusy(null);
    }
    if (!ok) {
      setActionError(lang === "en" ? "Couldn't save. Check the times and try again." : "Không lưu được. Kiểm tra lại giờ rồi thử lại.");
      return false;
    }
    await load();
    return true;
  }

  async function addEntry(v: { date: string; start: string; end: string; title: string; studioId: string }) {
    return post({ action: "busy_add", ...v });
  }

  async function removeEntry(id: string) {
    return post({ action: "busy_remove", id });
  }

  async function setShift(shift: ShiftLetter | "") {
    return post({ action: "shift_set", company: "hoa_phat", shift });
  }

  async function clockIn(v: { studioId: string; contractId: string }) {
    return post({ action: "clock_in", studioId: v.studioId, contractId: v.contractId || null });
  }

  async function clockOut(note: string) {
    return post({ action: "clock_out", studioId: studioIds[0] ?? "", note });
  }

  async function addFree(v: { studioId: string; date: string; start: string; end: string; note: string }) {
    return post({ action: "free_add", ...v });
  }

  async function removeFree(id: string) {
    return post({ action: "free_remove", id, studioId: studioIds[0] ?? "" });
  }

  async function respond(id: string, status: "accepted" | "declined") {
    setBusy(id);
    setActionError(null);
    let ok = false;
    try {
      const res = await fetch("/api/crew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "respond", id, phone, status }),
      });
      ok = res.ok;
    } catch {
      /* mất mạng */
    } finally {
      setBusy(null);
    }
    if (ok) setList((p) => (p ? p.map((a) => (a.id === id ? { ...a, status } : a)) : p));
    else setActionError(lang === "en" ? "Couldn't send your answer. Try again." : "Chưa gửi được trả lời. Thử lại nhé.");
  }

  /** Giao diện mới: quay lại ô nhập số (tra số khác). Không gọi API nào. */
  function reset() {
    setList(null);
  }

  /** Studio đã nhận thợ vào sổ, dạng lựa chọn cho các thẻ con. */
  const studioOptions: StudioOption[] = acceptedStudios.map((p) => ({ id: p.owner_id, name: p.studio_name }));
  /** Việc để gắn giờ chấm công. `contract_id` chứ KHÔNG phải `a.id`: `a.id` là
   *  dòng phân công (contract_crew), còn crew_timesheet.contract_id trỏ tới hợp
   *  đồng. Nhầm hai cái này thì khoá ngoại chối và giờ làm không lưu. */
  const clockJobs = (list ?? [])
    .filter((a) => a.status !== "declined" && a.contract_id)
    .slice(0, 20)
    .map((a) => ({ id: a.contract_id as string, label: a.contract?.title || a.name || "Việc" }));

  return {
    lang, tr, studio,
    phone, setPhone, list, schedule, shiftPlan, calToken, setCalToken, openEntry, sheet, freeSlots, profiles,
    inThisStudio, acceptedStudios, studioOptions, clockJobs,
    loading, busy, actionError, setActionError, captchaToken, setCaptchaToken, session,
    load, addEntry, removeEntry, setShift, clockIn, clockOut, addFree, removeFree, respond, reset,
  };
}

export type CrewPortalState = ReturnType<typeof useCrewPortal>;

/**
 * Studio đang chọn trong một thẻ có ô chọn studio. Thẻ có thể dựng TRƯỚC khi hồ
 * sơ về (danh sách studio còn rỗng) — khi đó chưa chọn gì thì lấy studio đầu
 * tiên, để thợ chỉ thuộc một sổ không bị kẹt nút "Thêm" ở trạng thái tắt.
 */
export function useStudioPick(studios: { id: string }[]) {
  const [picked, setPicked] = useState(studios[0]?.id ?? "");
  const studioId = studios.some((s) => s.id === picked) ? picked : studios[0]?.id ?? picked;
  return [studioId, setPicked] as const;
}

/* ── Chấm công ─────────────────────────────────────────────────────────── */
/**
 * Ô chọn studio / việc / ghi chú của thẻ chấm công + đồng hồ đếm. Đồng hồ chỉ
 * chạy khi ĐANG có buổi mở — không đặt một setInterval sống mãi trên trang mà
 * thợ để mở cả ngày trong túi. Giờ tính tiền do server chốt, đồng hồ chỉ để nhìn.
 */
export function useTimeClock(open: OpenEntry, studios: { id: string }[]) {
  const [studioId, setStudioId] = useState(studios[0]?.id ?? "");
  const [contractId, setContractId] = useState("");
  const [note, setNote] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open?.started_at) return;
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, [open?.started_at]);

  useEffect(() => {
    if (!studioId && studios[0]) setStudioId(studios[0].id);
  }, [studios, studioId]);

  const elapsed = open?.started_at ? (now - Date.parse(open.started_at)) / 3_600_000 : 0;
  return { studioId, setStudioId, contractId, setContractId, note, setNote, elapsed };
}

/** "08:05" — giờ bắt đầu của buổi đang mở. */
export function clockTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—";
}

/* ── Khoảng rảnh ───────────────────────────────────────────────────────── */
export function useFreeSlotForm(slots: FreeSlot[], studios: { id: string }[]) {
  const [studioId, setStudioId] = useStudioPick(studios);
  const [date, setDate] = useState(todayVN());
  const [allDay, setAllDay] = useState(true);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("17:00");
  const [note, setNote] = useState("");

  // Chỉ hiện khoảng từ HÔM NAY trở đi: khai rảnh của tuần trước không giúp ai
  // phân công, mà để đó thì danh sách dài dần rồi thợ ngưng đọc.
  const upcoming = useMemo(() => {
    const t = todayVN();
    return slots.filter((s) => s.date >= t).sort((a, b) => a.date.localeCompare(b.date));
  }, [slots]);

  /** Payload gửi `onAdd` — "cả ngày" thì gửi giờ rỗng. */
  const payload = { studioId, date, start: allDay ? "" : start, end: allDay ? "" : end, note };

  return { studioId, setStudioId, date, setDate, allDay, setAllDay, start, setStart, end, setEnd, note, setNote, upcoming, payload };
}

/* ── Lịch bận (theo từng studio) ───────────────────────────────────────── */
/**
 * Lịch bận tách riêng theo studio: xem và báo bận cho ĐÚNG studio đang chọn.
 * Thợ chạy nhiều nơi thì mỗi nơi một lịch, không nơi nào thấy lịch của nơi kia.
 */
export function useBusySchedule(entries: ScheduleEntry[], studios: StudioOption[]) {
  const [studioId, setStudioId] = useStudioPick(studios);
  const [form, setForm] = useState({ start: "08:00", end: "17:00", title: "" });
  const [allDay, setAllDay] = useState(false);

  const visible = useMemo(() => entries.filter((e) => (e.owner_id ?? "") === studioId), [entries, studioId]);
  const byDate = useMemo(() => {
    const map: Record<string, ScheduleEntry[]> = {};
    for (const e of visible) (map[e.date] ||= []).push(e);
    return map;
  }, [visible]);

  /** Gửi một mốc bận cho `date`; xong thì xoá ô nội dung, giữ giờ. */
  async function submitFor(date: string, onAdd: (v: { date: string; start: string; end: string; title: string; studioId: string }) => Promise<unknown>) {
    if (!studioId) return false;
    const ok = (await onAdd({ date, start: allDay ? "" : form.start, end: allDay ? "" : form.end, title: form.title, studioId })) !== false;
    if (ok) setForm((f) => ({ ...f, title: "" }));
    return ok;
  }

  return { studioId, setStudioId, form, setForm, allDay, setAllDay, visible, byDate, submitFor };
}

/* ── Hồ sơ thợ ở từng studio ───────────────────────────────────────────── */
/**
 * Hồ sơ thợ gọn đúng những gì studio cần để xếp việc và trả lương. SĐT không
 * nằm trong danh sách này vì nó là danh tính của thợ — hiện ra để đối chiếu chứ
 * không sửa được.
 */
export const CREW_PROFILE_FIELDS: { key: keyof CrewProfile; label: string; type?: string }[] = [
  { key: "name", label: "Họ tên (trùng tên trên tài khoản ngân hàng)" },
  { key: "email", label: "Email", type: "email" },
  { key: "address", label: "Địa chỉ" },
  { key: "bank_name", label: "Tên ngân hàng" },
  { key: "bank_account", label: "Số tài khoản" },
  { key: "skills", label: "Kỹ năng (chụp, quay, dựng…)" },
  { key: "equipment", label: "Thiết bị (body, lens, gimbal…)" },
];

/** Số mục hồ sơ còn trống. */
export function profileMissing(p: CrewProfile): number {
  return CREW_PROFILE_FIELDS.length - CREW_PROFILE_FIELDS.filter((f) => (p[f.key] as string | null)?.trim()).length;
}

export function useProfileEditor(phone: string, session: string | null, onSaved: () => void) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function open(p: CrewProfile) {
    setOpenId(p.id);
    const d: Record<string, string> = {};
    for (const f of CREW_PROFILE_FIELDS) d[f.key as string] = (p[f.key] as string | null) ?? "";
    setDraft(d);
  }

  async function save(p: CrewProfile) {
    setSaving(true);
    const res = await fetch("/api/crew/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", phone, session, studioId: p.owner_id, profile: draft }),
    });
    setSaving(false);
    if (res.ok) { setOpenId(null); onSaved(); }
  }

  return { openId, setOpenId, draft, setDraft, saving, open, save };
}

/** Xin vào sổ thợ của MỘT studio (vào bằng link riêng của studio). */
export function useCrewRegister(phone: string, crewToken: string) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "done" | "already">("idle");

  async function submit() {
    if (!phone.trim() || !captcha) return;
    setState("sending");
    const res = await fetch("/api/crew/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "register", phone, crewToken, captcha, profile: draft }),
    });
    const j = (await res.json().catch(() => ({}))) as { already?: boolean };
    setState(res.ok ? (j.already ? "already" : "done") : "idle");
  }

  return { draft, setDraft, captcha, setCaptcha, state, submit };
}

/**
 * Đồng bộ sang Google Lịch bằng feed .ics (một chiều, không OAuth — thợ không
 * có tài khoản nên không có chỗ gắn refresh token).
 */
export function useCalendarSync(phone: string, session: string | null, token: string | null, onToken: (t: string) => void) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/crew-calendar/${token}` : "";

  async function enable() {
    setBusy(true);
    const res = await fetch("/api/crew", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "calendar_token", phone, session }),
    });
    setBusy(false);
    const j = (await res.json().catch(() => ({}))) as { token?: string };
    if (j.token) onToken(j.token);
  }

  function copy() {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return { busy, copied, url, enable, copy };
}
