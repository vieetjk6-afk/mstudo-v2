import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudio } from "@/lib/auth-guards";
import { todayVN } from "@/lib/date";
import { addDays, mondayOf } from "@/lib/appointments";
import { applyBranch, getActiveBranches, getBranchScope } from "@/lib/branches";
import type { StudioAppointment, StudioRoom } from "@/lib/types";
import SchedulePage, { type ContractOption, type CrewOption } from "./SchedulePage";

/* ═══════════════════════════════════════════════════════════════════════════
   TAB "LỊCH STUDIO" của màn Lịch làm việc (/dashboard/studio/calendar?tab=studio).

   Khác gì tab "Buổi chụp": tab kia xoay quanh BUỔI CHỤP của hợp đồng (mỗi hợp
   đồng một ngày chính + mốc ghi chú), còn tab này xếp các buổi HẸN DỊCH VỤ
   trong tuần — trang điểm, thử đồ, chụp pre-wedding, tư vấn — thứ có người phụ
   trách, có phòng, và có thể trùng giờ nhau. Hai tab đọc hai bảng khác nhau và
   cùng liên kết về hợp đồng.

   Route cũ /dashboard/studio/schedule giờ chuyển hướng về đây.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Phòng mặc định khi studio chưa khai phòng nào — để thanh công suất có thứ để
 *  vẽ ngay lần mở đầu tiên. Studio sửa/xoá được sau đó như dữ liệu thường. */
const DEFAULT_ROOMS: { name: string; kind: StudioRoom["kind"]; capacity_week: number; position: number }[] = [
  { name: "Phòng trang điểm 1", kind: "makeup", capacity_week: 14, position: 0 },
  { name: "Phòng trang điểm 2", kind: "makeup", capacity_week: 14, position: 1 },
  { name: "Phòng váy tầng 2", kind: "fitting", capacity_week: 12, position: 2 },
  { name: "Phim trường", kind: "studio", capacity_week: 10, position: 3 },
];

export default async function StudioTab() {
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

  const supabase = await createClient();
  const today = todayVN();
  // Nạp sẵn một dải rộng quanh hôm nay để bấm ‹ › đổi tuần không phải gọi lại
  // server: 4 tuần trước + 12 tuần sau, tính từ THỨ HAI của tuần này.
  const from = addDays(mondayOf(today), -28);
  const to = addDays(mondayOf(today), 7 * 12);

  // Chi nhánh đang chọn: lịch, phòng và hợp đồng đều lọc theo cùng phạm vi, nếu
  // không thì lưới tuần hiện lịch của cơ sở này mà thanh công suất lại đếm phòng
  // của cơ sở khác.
  const scope = await getBranchScope(profile.id, profile.actingBranchId as string | null, profile.actingRole as string);
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

  // Ai RẢNH / ai BẬN, để ô chọn người phụ trách nói được điều đó ngay lúc phân
  // công. Hai bảng ngược chiều nhau và luật ưu tiên nằm ở @/lib/timesheet
  // (availabilityOn): báo bận THẮNG khai rảnh, chưa khai gì = "chưa rõ".
  // Project chưa chạy migrations/crew_timesheet.sql thì chưa có bảng
  // crew_available: supabase-js TRẢ VỀ lỗi chứ không ném, nên `?? []` mới là
  // đường lui thật — try/catch chỉ để chắc thêm. Cả hai cùng cho kết quả: ô
  // chọn người phụ trách giữ nguyên như trước, không sập màn lịch.
  let crewFree: { phone: string; date: string }[] = [];
  let crewBusy: { phone: string; date: string }[] = [];
  try {
    const [{ data: fr }, { data: bs }] = await Promise.all([
      supabase.from("crew_available").select("phone, date").eq("owner_id", profile.id).gte("date", from).lte("date", to),
      supabase.from("crew_unavailable").select("phone, date").eq("owner_id", profile.id).gte("date", from).lte("date", to),
    ]);
    crewFree = (fr ?? []) as { phone: string; date: string }[];
    crewBusy = (bs ?? []) as { phone: string; date: string }[];
  } catch {
    /* giữ hai danh sách rỗng */
  }

  // Toạ độ studio — điểm xuất phát để ƯỚC LƯỢNG đường đi tới điểm chụp. Query
  // RIÊNG và best-effort, giống cách getStudioBrand làm: project chưa chạy
  // migration weather.sql thì cột chưa tồn tại, và một lỗi ở đây KHÔNG được
  // phép làm sập cả màn lịch chỉ vì mất một dòng chữ ước lượng km.
  let studioCoords: { lat: number; lng: number } | null = null;
  try {
    const { data: loc } = await createAdminClient()
      .from("profiles")
      .select("studio_lat, studio_lng")
      .eq("id", profile.id)
      .maybeSingle();
    const la = Number((loc as { studio_lat?: number | null } | null)?.studio_lat);
    const ln = Number((loc as { studio_lng?: number | null } | null)?.studio_lng);
    if (Number.isFinite(la) && Number.isFinite(ln) && !(la === 0 && ln === 0)) studioCoords = { lat: la, lng: ln };
  } catch {
    /* chưa chạy migration weather.sql → không ước lượng đường đi, không lỗi gì */
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
      phone: c.phone,
      role: c.role,
    })),
    ...((staff ?? []) as { id: string; full_name: string | null; email: string }[]).map((s) => ({
      key: `staff:${s.id}`,
      crew_id: null,
      staff_id: s.id,
      // Nhân viên có tài khoản không khai rảnh ở cổng thợ (cổng đó khoá theo
      // SĐT), nên ô chọn sẽ hiện "chưa rõ" cho họ — đúng, không phải thiếu sót.
      phone: null,
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
      studioCoords={studioCoords}
      crewFree={crewFree}
      crewBusy={crewBusy}
    />
  );
}
