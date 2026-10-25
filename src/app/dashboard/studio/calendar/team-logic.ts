import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { shiftBlockFor, type ShiftLetter } from "@/lib/crew-shift";
import type { CrewMember, CrewScheduleRow, TeamAssignment } from "./TeamCalendar";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC DÙNG CHUNG của tab "Đội ngũ" — bản cũ (TeamCalendar) và bản giao diện
   mới (TeamV2) cùng gọi: lọc theo thợ, ca công ty, gom việc theo ngày, và hai
   thao tác ghi (studio xếp lịch hộ thợ / gỡ mốc studio đã xếp).
   ═══════════════════════════════════════════════════════════════════════════ */

export function useTeamCalendar({
  assignments,
  members,
  schedule,
  shifts,
}: {
  assignments: TeamAssignment[];
  members: CrewMember[];
  schedule: CrewScheduleRow[];
  shifts: Record<string, ShiftLetter>;
}) {
  const router = useRouter();
  // "" = cả đội. Lọc theo một thợ để xem riêng lịch của người đó.
  const [who, setWho] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ phone: "", start: "08:00", end: "17:00", title: "", allDay: false });
  const [q, setQ] = useState("");
  const [showShift, setShowShift] = useState(false);

  const nameOf = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of members) m[c.phone] = c.name;
    return m;
  }, [members]);

  const filteredMembers = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    // Tìm theo cả tên lẫn SĐT — studio nhớ số nhanh hơn nhớ tên là chuyện thường.
    return members.filter((m) => m.name.toLowerCase().includes(needle) || m.phone.includes(needle.replace(/\D/g, "")));
  }, [members, q]);

  const visibleSchedule = useMemo(
    () => (who ? schedule.filter((r) => r.phone === who) : schedule),
    [schedule, who],
  );
  const visibleAssignments = useMemo(
    () => (who ? assignments.filter((a) => (a.phone ?? "").replace(/\D/g, "") === who) : assignments),
    [assignments, who],
  );
  // Ca công ty CHỈ hiện khi đang xem một thợ cụ thể và studio bật lên. Ở chế độ
  // cả đội thì lịch chỉ còn việc của studio — ca nhà máy của chục người chồng
  // lên nhau làm lịch không đọc nổi, mà cũng không phải việc studio xếp.
  const visibleShifts = useMemo(
    () => (who && showShift && shifts[who] ? { [who]: shifts[who] } : {}),
    [shifts, who, showShift],
  );

  const byDateAssign = useMemo(() => {
    const map: Record<string, TeamAssignment[]> = {};
    for (const a of visibleAssignments) (map[a.date] ||= []).push(a);
    return map;
  }, [visibleAssignments]);

  const byDateSched = useMemo(() => {
    const map: Record<string, CrewScheduleRow[]> = {};
    for (const r of visibleSchedule) (map[r.date] ||= []).push(r);
    return map;
  }, [visibleSchedule]);

  /** Ca công ty của những thợ đang hiển thị, cho một ngày cụ thể. */
  function shiftsOn(dateStr: string) {
    const out: { phone: string; name: string; label: string }[] = [];
    for (const [phone, letter] of Object.entries(visibleShifts)) {
      const b = shiftBlockFor(dateStr, letter);
      if (b) out.push({ phone, name: nameOf[phone] || phone, label: `Ca ${b.shift} ${b.start}–${b.end}${b.overnight ? " (+1)" : ""}` });
    }
    return out;
  }


  async function addForCrew(date: string) {
    const phone = form.phone || who;
    if (!phone) return false;
    setBusy(true);
    const res = await fetch("/api/studio/crew-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        date,
        start: form.allDay ? "" : form.start,
        end: form.allDay ? "" : form.end,
        title: form.title,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setForm((f) => ({ ...f, title: "" }));
      router.refresh();
    }
    return res.ok;
  }

  async function removeEntry(r: CrewScheduleRow) {
    setBusy(true);
    await fetch("/api/studio/crew-schedule", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: r.phone, id: r.id }),
    });
    setBusy(false);
    router.refresh();
  }

  return {
    who, setWho, busy, form, setForm, q, setQ, showShift, setShowShift, nameOf, filteredMembers,
    visibleShifts, byDateAssign, byDateSched, shiftsOn, addForCrew, removeEntry,
  };
}
