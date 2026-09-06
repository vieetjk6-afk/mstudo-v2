import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import type { ShiftLetter } from "@/lib/crew-shift";
import TeamCalendar, { type TeamAssignment, type CrewScheduleRow, type CrewMember } from "./TeamCalendar";


/* ═══════════════════════════════════════════════════════════════════════════
   TAB "ĐỘI NGŨ" của màn Lịch làm việc (/dashboard/studio/calendar?tab=team).

   Lịch theo TỪNG NGƯỜI: ai được xếp buổi nào, ai đã nhận/từ chối, ai báo bận.
   Route cũ /dashboard/studio/team giờ chuyển hướng về đây.
   ═══════════════════════════════════════════════════════════════════════════ */

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

export default async function TeamTab() {
  const profile = await requireStudio();
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Studio</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>Tính năng này chỉ dành cho tài khoản gói Studio.</p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Xem gói Studio</a>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: crewRows }, { data: roster }] = await Promise.all([
    supabase
      .from("contract_crew")
      .select("name, phone, role, status, contract:studio_contracts!inner(id, owner_id, title, event_date, status)")
      .eq("contract.owner_id", profile.id)
      .not("contract.event_date", "is", null),
    supabase.from("studio_crew").select("name, phone, role").eq("owner_id", profile.id).order("name"),
  ]);

  type Row = {
    name: string | null;
    phone: string | null;
    role: TeamAssignment["role"];
    status: TeamAssignment["status"];
    contract: { id: string; title: string; event_date: string | null; status: string } | null;
  };

  const assignments: TeamAssignment[] = ((crewRows ?? []) as unknown as Row[])
    .filter((r) => r.contract?.event_date && r.contract.status !== "cancelled")
    .map((r) => ({
      name: r.name || r.phone || "—",
      phone: r.phone,
      role: r.role,
      status: r.status,
      date: r.contract!.event_date as string,
      contractId: r.contract!.id,
      contractTitle: r.contract!.title,
    }));

  // Sổ thợ, khoá theo SĐT dạng số — crew_unavailable/crew_shift_plan đều lưu
  // theo SĐT (thợ không có tài khoản nên không có id để tham chiếu).
  const members: CrewMember[] = ((roster ?? []) as Array<{ name: string | null; phone: string | null; role: string | null }>)
    .map((r) => ({
      phone: digits(r.phone),
      name: r.name || r.phone || digits(r.phone),
      role: (r.role || "photographer") as CrewMember["role"],
    }))
    .filter((m) => m.phone);

  const phones = members.map((m) => m.phone);
  let schedule: CrewScheduleRow[] = [];
  const shifts: Record<string, ShiftLetter> = {};
  if (phones.length) {
    const [{ data: rows }, { data: plans }] = await Promise.all([
      // select("*") chứ không liệt kê cột: chạy được cả TRƯỚC khi migration
      // crew_schedule.sql chạy (lúc đó chưa có start_time/overnight/…). Thiếu cột
      // thì mốc cũ hiện thành "cả ngày", thay vì cả truy vấn hỏng và mất sạch.
      // CÁCH LY TOÀN BỘ: mỗi mốc bận thuộc đúng MỘT studio, kể cả mốc thợ tự
      // báo (thợ chạy nhiều nơi thì báo riêng cho từng nơi). Nên chỉ lọc
      // owner_id = studio này; không còn nhánh "mốc chung".
      supabase.from("crew_unavailable").select("*").in("phone", phones).eq("owner_id", profile.id).order("date"),
      supabase.from("crew_shift_plan").select("phone, company, shift").in("phone", phones),
    ]);
    schedule = ((rows ?? []) as CrewScheduleRow[]).map((r) => ({ ...r, phone: digits(r.phone) }));
    for (const p of (plans ?? []) as Array<{ phone: string; shift: ShiftLetter }>) {
      shifts[digits(p.phone)] = p.shift;
    }
  }

  return (
    <TeamCalendar
      assignments={assignments}
      members={members}
      schedule={schedule}
      shifts={shifts}
    />
  );
}
