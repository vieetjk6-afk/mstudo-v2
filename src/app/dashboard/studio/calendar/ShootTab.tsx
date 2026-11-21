import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { isUiV2 } from "@/lib/ui-server";
import PlanLockedV2 from "./PlanLockedV2";
import type { CalendarTab } from "./tabs";
import { mainUrl } from "@/lib/hosts";
import { gcalHealth } from "@/lib/gcal";
import { todayVN } from "@/lib/date";
import { loadShootRange, shiftMonths, WINDOW_MONTHS } from "./shoot-data";
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
  // Chỉ tải ±6 tháng quanh hôm nay; lật ra ngoài thì CalendarView tự xin thêm
  // qua /api/studio/calendar-range (xem shoot-data.ts).
  const today = todayVN();
  const range = { from: shiftMonths(today, -WINDOW_MONTHS), to: shiftMonths(today, WINDOW_MONTHS) };
  // Kiểm tra kết nối Google Calendar chạy cùng lượt thay vì chờ sau cùng.
  const [{ events, contracts }, crewRoles, gcal] = await Promise.all([
    loadShootRange(profile, range.from, range.to),
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
      loadedRange={range}
      feedUrl={feedUrl}
      crewRoles={crewRoles}
      gcal={gcal}
    />
  );
}
