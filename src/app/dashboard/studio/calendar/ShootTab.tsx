import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { requireStudio } from "@/lib/auth-guards";
import { isUiV2 } from "@/lib/ui-server";
import PlanLockedV2 from "./PlanLockedV2";
import type { CalendarTab } from "./tabs";
import { mainUrl } from "@/lib/hosts";
import { gcalHealth } from "@/lib/gcal";
import { applyBranch, getBranchScope } from "@/lib/branches";
import { loadCrewRoles } from "@/lib/crew-roles";
import CalendarView, { type ContractMarker, type EventRow } from "./CalendarView";


/* ═══════════════════════════════════════════════════════════════════════════
   TAB "BUỔI CHỤP" của màn Lịch làm việc (/dashboard/studio/calendar).

   Lịch tháng/tuần/ngày của các BUỔI CHỤP thuộc hợp đồng, kèm mốc ghi chú
   (studio_events). Trước đây đây chính là toàn bộ màn /calendar; giờ là tab 1
   trong ba góc nhìn — xem CalendarTabs.tsx.
   ═══════════════════════════════════════════════════════════════════════════ */

export default async function ShootTab({ tabs }: { tabs?: readonly CalendarTab[] } = {}) {
  const profile = await requireStudio("booking");
  if (!profile) {
    if (await isUiV2()) return <PlanLockedV2 title="Cần gói Photographer trở lên" hint="Tính năng này dành cho tài khoản gói Photographer trở lên." cta="Nâng cấp gói" />;
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

  const supabase = await createClient();
  // Chi nhánh đang chọn. Chỉ lọc HỢP ĐỒNG: `studio_events` là mốc ghi chú, phần
  // lớn gắn với một hợp đồng và không có cột chi nhánh riêng — lọc chúng theo
  // chi nhánh sẽ làm mất các mốc studio ghi chung (nghỉ lễ, bảo trì thiết bị).
  const scope = await getBranchScope(profile.id, profile.actingBranchId as string | null, profile.actingRole as string);
  const CONTRACT_COLS =
    "id, code, title, client_name, client_phone, location, event_date, event_time, status, shoot_type, calendar_color, branch_id, contract_items(name, qty, unit_price), contract_crew(id, name, role, status), contract_payments(amount)";
  // Lịch lật được tới mọi tháng nên đọc toàn bộ — nhưng LẬT TRANG: đọc trơn thì
  // PostgREST cắt ở hàng 1000 và các buổi chụp cũ/xa biến mất khỏi lịch.
  // Kiểm tra kết nối Google Calendar chạy cùng lượt thay vì chờ sau cùng.
  const [events, contracts, crewRoles, gcal] = await Promise.all([
    // Kèm tên & ngày của HỢP ĐỒNG CHÍNH để lịch ghi rõ mốc thuộc hợp đồng nào.
    fetchAllRows<unknown>((from, to) =>
      supabase
        .from("studio_events")
        .select("*, contract:studio_contracts(title, event_date)")
        .eq("owner_id", profile.id)
        .order("event_date")
        .order("id")
        .range(from, to)
    ),
    fetchAllRows<unknown>((from, to) =>
      applyBranch(
        (profile.actingRole === "staff"
          ? supabase.from("studio_contracts").select(CONTRACT_COLS).eq("owner_id", profile.id).eq("assigned_to", profile.actingUserId)
          : supabase.from("studio_contracts").select(CONTRACT_COLS).eq("owner_id", profile.id)
        )
          .not("event_date", "is", null)
          // Chỉ hiện hợp đồng đã xác nhận/khách đã ký — bỏ nháp & mới gửi.
          .in("status", ["approved", "in_progress", "post_production", "completed"]),
        scope.selected
      )
        .order("id")
        .range(from, to)
    ),
    loadCrewRoles(supabase, profile.id as string),
    gcalHealth(profile.id),
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
      tabs={tabs}
      ownerId={profile.id}
      initialEvents={events as EventRow[]}
      contracts={contracts as ContractMarker[]}
      feedUrl={feedUrl}
      crewRoles={crewRoles}
      gcal={gcal}
    />
  );
}
