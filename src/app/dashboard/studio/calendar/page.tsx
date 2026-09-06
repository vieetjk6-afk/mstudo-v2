import { requireStudio } from "@/lib/auth-guards";
import CalendarTabs from "./CalendarTabs";
import { readTab, type CalendarTab } from "./tabs";
import ShootTab from "./ShootTab";
import StudioTab from "./StudioTab";
import TeamTab from "./TeamTab";

/* ═══════════════════════════════════════════════════════════════════════════
   LỊCH LÀM VIỆC — /dashboard/studio/calendar

   MỘT màn, ba góc nhìn chọn bằng ?tab=:
     (mặc định)   buổi chụp của hợp đồng      → ShootTab
     ?tab=studio  buổi hẹn dịch vụ tại studio → StudioTab  (route cũ /schedule)
     ?tab=team    lịch theo từng người        → TeamTab    (route cũ /team)

   Vì sao gộp: ba màn cùng trả lời một câu hỏi — "ngày mai studio làm gì" — chỉ
   khác đơn vị đếm (buổi chụp / buổi hẹn / con người). Để rời nhau thì sidebar có
   bốn dòng chứa chữ "lịch" và không ai đoán được nên mở dòng nào.

   Mỗi tab là một server component RIÊNG và chỉ được gọi khi đúng tab đó mở, nên
   mở tab "Buổi chụp" không kéo theo truy vấn phòng, ê-kíp hay sổ thợ của hai tab
   kia. Quyền và gói vẫn do chính từng tab tự kiểm tra (requireStudio) — dải tab
   dưới đây chỉ ẩn lối vào, không phải hàng rào.
   ═══════════════════════════════════════════════════════════════════════════ */

const MANAGERS = ["owner", "admin", "manager", "branch_manager"];

export default async function CalendarPage(
  props: {
    searchParams?: Promise<{ tab?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const tab = readTab(searchParams?.tab);
  const profile = await requireStudio("booking");

  // Tab "Đội ngũ" đọc sổ thợ + phân công của cả studio → gói Studio và từ quản
  // lý trở lên, đúng như mục "Lịch đội ngũ" trong sidebar trước đây.
  const show: CalendarTab[] = ["shoot", "studio"];
  if (profile && profile.studioTier === "full" && MANAGERS.includes(profile.actingRole as string)) {
    show.push("team");
  }
  // Gõ tay ?tab=team khi không đủ quyền → về tab mặc định, không hiện màn trắng.
  const active: CalendarTab = show.includes(tab) ? tab : "shoot";

  return (
    <div>
      <CalendarTabs show={show} active={active} />
      {active === "studio" ? <StudioTab /> : active === "team" ? <TeamTab /> : <ShootTab />}
    </div>
  );
}
