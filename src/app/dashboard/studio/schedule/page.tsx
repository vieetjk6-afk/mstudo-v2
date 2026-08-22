import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudio } from "@/lib/auth-guards";
import { todayVN } from "@/lib/date";
import { addDays, mondayOf } from "@/lib/appointments";
import { applyBranch, getActiveBranches, getBranchScope } from "@/lib/branches";
import type { StudioAppointment, StudioRoom } from "@/lib/types";
import SchedulePage, { type ContractOption, type CrewOption } from "./SchedulePage";

/* ═══════════════════════════════════════════════════════════════════════════
   LỊCH STUDIO — /dashboard/studio/schedule

   Khác gì "Lịch làm việc" (/dashboard/studio/calendar) đang có: màn kia xoay
   quanh BUỔI CHỤP của hợp đồng (mỗi hợp đồng một ngày chính + mốc ghi chú), còn
   màn này xếp các buổi HẸN DỊCH VỤ trong tuần — trang điểm, thử đồ, chụp
   pre-wedding, tư vấn — thứ có người phụ trách, có phòng, và có thể trùng giờ
   nhau. Hai màn đọc hai bảng khác nhau và cùng liên kết về hợp đồng.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Phòng mặc định khi studio chưa khai phòng nào — để thanh công suất có thứ để
 *  vẽ ngay lần mở đầu tiên. Studio sửa/xoá được sau đó như dữ liệu thường. */
const DEFAULT_ROOMS: { name: string; kind: StudioRoom["kind"]; capacity_week: number; position: number }[] = [
  { name: "Phòng trang điểm 1", kind: "makeup", capacity_week: 14, position: 0 },
  { name: "Phòng trang điểm 2", kind: "makeup", capacity_week: 14, position: 1 },
  { name: "Phòng váy tầng 2", kind: "fitting", capacity_week: 12, position: 2 },
  { name: "Phim trường", kind: "studio", capacity_week: 10, position: 3 },
];

export default async function StudioSchedulePage() {
  const profile = await requireStudio("booking");
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Photographer trở lên</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Lịch studio dành cho tài khoản gói Photographer trở lên.
          </p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Nâng cấp gói</a>
        </div>
      </div>
    );
  }

  const supabase = createClient();
  const today = todayVN();
  // Nạp sẵn một dải rộng quanh hôm nay để bấm ‹ › đổi tuần không phải gọi lại
  // server: 4 tuần trước + 12 tuần sau, tính từ THỨ HAI của tuần này.
  const from = addDays(mondayOf(today), -28);
  const to = addDays(mondayOf(today), 7 * 12);

  // Chi nhánh đang chọn: lịch, phòng và hợp đồng đều lọc theo cùng phạm vi, nếu
  // không thì lưới tuần hiện lịch của cơ sở này mà thanh công suất lại đếm phòng
  // của cơ sở khác.
  const scope = await getBranchScope(profile.id, profile.actingBranchId as string | null);
  const branchOptions = await getActiveBranches(profile.id);

  const [{ data: appointments }, { data: rooms }, { data: crew }, { data: contracts }] = await Promise.all([
    applyBranch(
      supabase
        .from("studio_appointments")
        .select("*")
        .eq("owner_id", profile.id)
        .gte("appt_date", from)
        .lte("appt_date", to),
      scope.selected
    )
      .order("appt_date")
      .order("start_time"),
    applyBranch(
      supabase.from("studio_rooms").select("*").eq("owner_id", profile.id).eq("active", true),
      scope.selected
    ).order("position"),
    supabase.from("studio_crew").select("id, name, phone, role").eq("owner_id", profile.id).order("name"),
    applyBranch(
      supabase
        .from("studio_contracts")
        .select("id, code, title, client_name, client_phone, event_date, status")
        .eq("owner_id", profile.id)
        .in("status", ["sent", "approved", "in_progress"]),
      scope.selected
    )
      .order("event_date", { ascending: false })
      .limit(200),
  ]);

  // Chưa có phòng nào → tạo bộ mặc định (chỉ chủ/quản lý mới được ghi, nhân viên
  // chỉ xem). Giống cách trang Lịch làm việc tự sinh calendar_token lần đầu.
  let roomList = (rooms ?? []) as StudioRoom[];
  if (roomList.length === 0 && profile.actingRole !== "staff") {
    const { data: seeded } = await supabase
      .from("studio_rooms")
      .insert(DEFAULT_ROOMS.map((r) => ({ ...r, owner_id: profile.id })))
      .select("*");
    roomList = (seeded ?? []) as StudioRoom[];
  }

  // RLS bảng profiles chỉ cho đọc dòng của chính mình → service-role để liệt kê
  // nhân viên của studio (đã giới hạn theo studio_owner_id).
  const { data: staff } = await createAdminClient()
    .from("profiles")
    .select("id, full_name, email")
    .eq("studio_owner_id", profile.id)
    .order("full_name");

  // Người phụ trách chọn được = thợ trong sổ + nhân viên có tài khoản. Gộp thành
  // MỘT danh sách để ô chọn không phải hỏi "thợ hay nhân viên?" trước.
  const assignees: CrewOption[] = [
    ...((crew ?? []) as { id: string; name: string; phone: string | null; role: string }[]).map((c) => ({
      key: `crew:${c.id}`,
      crew_id: c.id,
      staff_id: null,
      name: c.name,
      role: c.role,
    })),
    ...((staff ?? []) as { id: string; full_name: string | null; email: string }[]).map((s) => ({
      key: `staff:${s.id}`,
      crew_id: null,
      staff_id: s.id,
      name: s.full_name || s.email,
      role: "staff",
    })),
  ];

  return (
    <SchedulePage
      ownerId={profile.id}
      readOnly={profile.actingRole === "staff"}
      today={today}
      initialAppointments={(appointments ?? []) as StudioAppointment[]}
      rooms={roomList}
      assignees={assignees}
      contracts={(contracts ?? []) as ContractOption[]}
      branches={branchOptions.map((b) => ({ id: b.id, name: b.name }))}
      defaultBranchId={typeof scope.selected === "string" && scope.selected !== "none" ? scope.selected : null}
    />
  );
}
