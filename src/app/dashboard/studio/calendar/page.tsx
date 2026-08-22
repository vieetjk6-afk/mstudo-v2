import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { mainUrl } from "@/lib/hosts";
import { gcalHealth } from "@/lib/gcal";
import { applyBranch, getBranchScope } from "@/lib/branches";
import CalendarView, { type ContractMarker, type EventRow } from "./CalendarView";


export default async function CalendarPage() {
  const profile = await requireStudio("booking");
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Photographer trở lên</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Tính năng này dành cho tài khoản gói Photographer trở lên.
          </p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Nâng cấp gói</a>
        </div>
      </div>
    );
  }

  const supabase = createClient();
  // Chi nhánh đang chọn. Chỉ lọc HỢP ĐỒNG: `studio_events` là mốc ghi chú, phần
  // lớn gắn với một hợp đồng và không có cột chi nhánh riêng — lọc chúng theo
  // chi nhánh sẽ làm mất các mốc studio ghi chung (nghỉ lễ, bảo trì thiết bị).
  const scope = await getBranchScope(profile.id, profile.actingBranchId as string | null, profile.actingRole as string);
  const CONTRACT_COLS =
    "id, code, title, client_name, client_phone, location, event_date, event_time, status, shoot_type, calendar_color, branch_id, contract_items(name, qty, unit_price), contract_crew(id, name, role, status), contract_payments(amount)";
  const [{ data: events }, { data: contracts }] = await Promise.all([
    // Kèm tên & ngày của HỢP ĐỒNG CHÍNH để lịch ghi rõ mốc thuộc hợp đồng nào.
    supabase.from("studio_events").select("*, contract:studio_contracts(title, event_date)").eq("owner_id", profile.id).order("event_date"),
    applyBranch(
      (profile.actingRole === "staff"
        ? supabase.from("studio_contracts").select(CONTRACT_COLS).eq("owner_id", profile.id).eq("assigned_to", profile.actingUserId)
        : supabase.from("studio_contracts").select(CONTRACT_COLS).eq("owner_id", profile.id)
      )
        .not("event_date", "is", null)
        // Chỉ hiện hợp đồng đã xác nhận/khách đã ký — bỏ nháp & mới gửi.
        .in("status", ["approved", "in_progress", "completed"]),
      scope.selected
    ),
  ]);

  // Read-only calendar feed (owner sets it once; staff just see the URL).
  let calToken = profile.calendar_token as string | null;
  if (!calToken && profile.actingRole !== "staff") {
    calToken = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "");
    await supabase.from("profiles").update({ calendar_token: calToken }).eq("id", profile.id);
  }
  const feedUrl = calToken ? mainUrl(`/api/calendar/${calToken}`) : "";

  return (
    <CalendarView
      ownerId={profile.id}
      initialEvents={(events ?? []) as unknown as EventRow[]}
      contracts={(contracts ?? []) as ContractMarker[]}
      feedUrl={feedUrl}
      gcal={await gcalHealth(profile.id)}
    />
  );
}
