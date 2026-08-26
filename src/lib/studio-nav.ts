import {
  LayoutDashboard, ReceiptText, FileText, Kanban, CalendarClock, Inbox,
  CalendarDays, Wand2, Images, Shirt, Camera, Users, Sparkles, BookImage,
  Wallet, Banknote, UsersRound, Trophy, MessagesSquare, Package, Gavel,
  Globe, SlidersHorizontal, Settings, Bell, UserCircle, Crown, Gift, Monitor,
  ShieldCheck, Plus, FilePlus2, CalendarRange, UserCog, FileSignature,
  MessageSquare, HardDrive, Archive, Link2, FolderTree, Paintbrush, CopyCheck,
  Building2, UserRound, MessageCircle,
  type LucideIcon,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   ĐIỀU HƯỚNG KHU QUẢN LÝ STUDIO — nguồn duy nhất cho sidebar, drawer và ô ⌘K.
   Xem mục "Cấu trúc điều hướng" của README.md ở gốc repo.

   Thứ tự nhóm kể lại QUY TRÌNH của một studio, đọc từ trên xuống: khách hỏi →
   chốt đơn (Kinh doanh) → chụp và hậu kỳ (Sản xuất) → đồ nghề (Kho) → tiền
   (Tài chính) → người (Nhân sự) → những thứ khai một lần (Thiết lập). Trong mỗi
   nhóm, mục mở NHIỀU LẦN MỖI NGÀY đứng trên mục mở vài lần một năm — tần suất
   quyết định vị trí, không phải "tính năng này quan trọng hơn".

   Những màn KHÔNG còn trong sidebar (lịch studio, lịch đội, mẫu hợp đồng,
   chatbox, nén ảnh, và cả cụm tài khoản đã chuyển lên menu avatar ở topbar) vẫn
   tới được bằng ⌘K — xem EXTRA_COMMANDS bên dưới.

   Icon: bản thiết kế vẽ bằng Material Symbols Rounded, ở đây dùng lucide-react
   (thư viện sẵn có của repo, đã dùng ở ~50 file) với icon tương đương gần nhất
   — trộn hai bộ icon trong cùng một app trông lệch hơn là lệch vài nét vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export type StudioTier = "none" | "booking" | "plus" | "full";
export const TIER_RANK: Record<StudioTier, number> = { none: 0, booking: 1, plus: 2, full: 3 };

/** Khoá badge đếm việc chưa xử lý (xem /api/studio/nav-badges). */
export type BadgeKey = "quotes" | "bookings" | "leads" | "production" | "notifications" | "inbox";
export type NavBadges = Partial<Record<BadgeKey, number>>;

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  minTier: StudioTier;
  /** Vai trò studio được thấy mục này. Bắt buộc — không để mặc định "ai cũng thấy". */
  roles: readonly string[];
  badge?: BadgeKey;
  /** Route con cũng làm mục này sáng (màn đã gộp vào đây). */
  match?: readonly string[];
  /** Chỉ sáng khi ĐÚNG route này, không tính route con. Cần cho mục cha có mục
   *  con RIÊNG trong menu (vd /dashboard/admin đứng cạnh /dashboard/admin/system)
   *  — nếu không cả hai cùng sáng. */
  exact?: boolean;
  /** Từ khoá không dấu thêm cho ⌘K (nhãn đã tự được tìm). */
  keywords?: string;
  /** Dòng phụ trong ô ⌘K. Mục sidebar tự lấy tên nhóm nếu để trống. */
  sub?: string;
};
export type NavGroup = { label: string; items: NavItem[] };

const EVERYONE = ["owner", "admin", "manager", "branch_manager", "staff", "accountant"] as const;
const STAFF_OK = ["owner", "admin", "manager", "branch_manager", "staff"] as const;
const MANAGER_OK = ["owner", "admin", "manager", "branch_manager"] as const;
/**
 * Quản trị CẤU TRÚC studio (chi nhánh). Giống MANAGER_OK nhưng KHÔNG có
 * `branch_manager`: "Toàn quyền chi nhánh" không được thêm/sửa/xoá chi nhánh
 * (README, mục "Toàn quyền chi nhánh là hàng rào thật"), nên cũng không nên
 * thấy dòng menu dẫn tới đó.
 */
const BRANCH_ADMIN_OK = ["owner", "admin", "manager"] as const;
const OWNER_OK = ["owner", "admin"] as const;
/**
 * Tiền bạc: chủ + kế toán. Quản lý toàn studio KHÔNG xem (README, mục "Phân quyền").
 *
 * `branch_manager` ("Toàn quyền chi nhánh") CÓ xem — nhưng chỉ thấy số của đúng
 * chi nhánh mình, vì phạm vi của họ bị ghim ở tầng truy vấn (xem
 * `forcedBranchScope` trong studio-roles.ts). Đó là điểm phân biệt với `manager`:
 * quản lý toàn studio thấy được MỌI con số nên bị chặn hẳn, còn người phụ trách
 * một cơ sở cần doanh thu của cơ sở đó để chạy việc — đúng lời hứa "mỗi chi nhánh
 * có doanh thu riêng" của tính năng chi nhánh.
 */
const MONEY_OK = ["owner", "admin", "accountant", "branch_manager"] as const;
const ADMIN_ONLY = ["admin"] as const;

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    // Hai màn "mở đầu ca": toàn cảnh cho người quản lý, việc-của-tôi cho người
    // làm. "Trang của tôi" ở ĐẦU menu chứ không phải cuối: với vai trò staff nó
    // là màn duy nhất họ mở mỗi sáng, để dưới đáy thì phải cuộn hết sidebar.
    label: "",
    items: [
      { href: "/dashboard/studio", label: "Tổng quan", icon: LayoutDashboard, minTier: "booking", roles: EVERYONE, keywords: "trang chu dashboard", sub: "Toàn cảnh studio hôm nay" },
      { href: "/staff", label: "Trang của tôi", icon: UserRound, minTier: "booking", roles: EVERYONE, keywords: "cong nhan vien lich hom nay viec cua toi anh can sua", sub: "Lịch hôm nay & việc hậu kỳ của bạn" },
    ],
  },
  {
    // Đọc từ trên xuống là ĐÚNG THỨ TỰ MỘT ĐƠN ĐI: khách nhắn → hẹn gặp → gửi
    // giá → ký hợp đồng. Trước đây nhóm này xếp ngược (Báo giá trước, Yêu cầu
    // mới cuối), nên ba mục có badge việc-chưa-xử-lý nằm rải rác và hai mục lễ
    // tân mở đầu tiên mỗi sáng lại ở đáy nhóm.
    label: "Kinh doanh",
    items: [
      // ĐỨNG ĐẦU nhóm và trên cả "Yêu cầu mới": đây là màn mở liên tục suốt
      // ngày (khách đang chờ trả lời), còn Yêu cầu mới là sổ ghi lại khách đã
      // để số. roles STAFF_OK chứ không MANAGER_OK — trực chat là việc của
      // nhân viên lễ tân, không phải việc của quản lý.
      { href: "/dashboard/studio/inbox", label: "Hộp thư", icon: MessageCircle, minTier: "booking", roles: STAFF_OK, badge: "inbox", match: ["/dashboard/studio/inbox/ket-noi"], keywords: "chat tin nhan zalo facebook messenger instagram mang xa hoi hop thu chung", sub: "Tin nhắn khách từ mọi mạng xã hội" },
      { href: "/dashboard/studio/leads", label: "Yêu cầu mới", icon: Inbox, minTier: "booking", roles: MANAGER_OK, badge: "leads", keywords: "lead website chatbox" },
      { href: "/dashboard/studio/bookings", label: "Đặt lịch khách", icon: CalendarClock, minTier: "booking", roles: MANAGER_OK, badge: "bookings" },
      { href: "/dashboard/studio/quotes", label: "Báo giá", icon: ReceiptText, minTier: "plus", roles: MANAGER_OK, badge: "quotes" },
      { href: "/dashboard/studio/contracts", label: "Hợp đồng & lịch hẹn", icon: FileText, minTier: "plus", roles: STAFF_OK, keywords: "hop dong buoi chup" },
      // Danh bạ khách về đây (trước ở nhóm "Khách hàng" riêng): nó là tài sản
      // bán hàng — tái ký, giới thiệu, chăm sau cưới — chứ không phải việc hậu kỳ.
      { href: "/dashboard/studio/clients", label: "Khách hàng", icon: Users, minTier: "booking", roles: MANAGER_OK, keywords: "danh ba khach" },
    ],
  },
  {
    // TOÀN BỘ chuỗi sau khi ký nằm trong một nhóm: xếp lịch → chia việc → hậu kỳ
    // → giao ảnh → làm sản phẩm (album in, thiệp, slide). Trước đây chuỗi này bị
    // chẻ đôi giữa "Vận hành" và "Khách hàng", thợ hậu kỳ làm một hợp đồng phải
    // nhảy qua lại hai nhóm.
    label: "Sản xuất",
    items: [
      // MỘT mục lịch duy nhất. /schedule (lịch studio) và /team (lịch đội ngũ)
      // đã gộp thành tab của màn này — xem calendar/CalendarTabs.tsx. Trước đây
      // menu có tới bốn dòng chứa chữ "lịch" và không ai đoán được nên mở dòng nào.
      { href: "/dashboard/studio/calendar", label: "Lịch làm việc", icon: CalendarDays, minTier: "booking", roles: STAFF_OK, match: ["/dashboard/studio/schedule", "/dashboard/studio/team"], keywords: "lich chup doi ngu studio trang diem thu do makeup fitting hen" },
      // Bảng công việc chuyển từ "Bán hàng" sang đây: thẻ trên bảng là việc PHẢI
      // LÀM của hợp đồng đã ký, không phải việc chốt đơn.
      { href: "/dashboard/studio/board", label: "Bảng công việc", icon: Kanban, minTier: "full", roles: MANAGER_OK, keywords: "kanban cong viec" },
      { href: "/dashboard/studio/production", label: "Xử lý hình ảnh", icon: Wand2, minTier: "full", roles: STAFF_OK, badge: "production", keywords: "hau ky san xuat in" },
      { href: "/dashboard/albums", label: "Thư viện album", icon: Images, minTier: "booking", roles: STAFF_OK, match: ["/dashboard/create", "/dashboard/studio/album-categories"], keywords: "album chon anh giao khach" },
      { href: "/dashboard/studio/album-designer", label: "Thiết kế album", icon: BookImage, minTier: "full", roles: MANAGER_OK, keywords: "dan trang album in" },
      { href: "/dashboard/studio/thiep", label: "Thiệp · Story · Slide", icon: Sparkles, minTier: "full", roles: MANAGER_OK, match: ["/dashboard/studio/story", "/dashboard/studio/slide"], keywords: "thiep cuoi love story slide" },
      // Công cụ lẻ, để CUỐI nhóm: mở khi cần xử lý một mớ ảnh, không nằm trên
      // đường đi chính của hợp đồng.
      { href: "/dashboard/tools", label: "Công cụ ảnh", icon: SlidersHorizontal, minTier: "booking", roles: STAFF_OK, match: ["/dashboard/filter", "/dashboard/compress"], keywords: "loc anh nen anh watermark" },
    ],
  },
  {
    // Phòng váy và Thiết bị là CÙNG MỘT LOẠI VIỆC — tài sản của studio, cho mượn
    // hoặc cho thuê theo lịch, phải biết cái nào đang ở đâu. Trước đây một cái ở
    // "Bán hàng", một cái ở "Vận hành".
    label: "Kho",
    items: [
      { href: "/dashboard/studio/rental", label: "Phòng váy", icon: Shirt, minTier: "full", roles: MANAGER_OK, keywords: "trang phuc thue vay" },
      { href: "/dashboard/studio/equipment", label: "Thiết bị", icon: Camera, minTier: "full", roles: MANAGER_OK, keywords: "may anh ong kinh den" },
    ],
  },
  {
    label: "Tài chính",
    items: [
      // Bản thiết kế tách "Thu chi & công nợ" và "Báo cáo" thành 2 màn, nhưng
      // repo đang là MỘT trang /reports. Chỉ để một mục ở đây; khi tách màn thì
      // thêm mục "Báo cáo" trỏ vào route mới — không trỏ 2 mục vào cùng một
      // trang, vì cả hai sẽ cùng sáng và người dùng bấm mãi một chỗ.
      { href: "/dashboard/studio/reports", label: "Thu chi & công nợ", icon: Wallet, minTier: "full", roles: MONEY_OK, keywords: "bao cao doanh thu chi phi cong no dong tien" },
      { href: "/dashboard/studio/payroll", label: "Đối soát tiền công", icon: Banknote, minTier: "full", roles: MONEY_OK, keywords: "bang luong tien cong nhan su" },
      // Bảng giá về Tài chính (trước ở "Thiết lập"): giá bán là một quyết định
      // TIỀN BẠC — người ngồi tính doanh thu cũng là người chỉnh giá gói, nên để
      // hai việc đó cạnh nhau. Đứng CUỐI nhóm vì sửa vài lần một năm, còn thu chi
      // và tiền công mở hằng tuần.
      // roles/minTier giữ nguyên MANAGER_OK + "booking": nhóm chỉ là NHÃN, mỗi
      // mục vẫn tự lọc theo vai trò — quản lý không xem được tiền vẫn thấy đúng
      // một dòng "Gói & bảng giá" trong nhóm này, không lộ thêm con số nào.
      { href: "/dashboard/studio/pricing", label: "Gói & bảng giá", icon: Package, minTier: "booking", roles: MANAGER_OK, match: ["/dashboard/studio/packages"], keywords: "goi dich vu bang gia" },
    ],
  },
  {
    label: "Nhân sự",
    items: [
      // Sổ thợ (Đội ngũ) đã GỘP thành tab 2 của màn này. Mục sidebar là "Nhân
      // viên & phân quyền" vì thứ mở thường xuyên hơn là tài khoản + vai trò;
      // sổ thợ chỉ sửa khi có người vào/ra.
      { href: "/dashboard/studio/staff", label: "Nhân viên & phân quyền", icon: UserCog, minTier: "full", roles: MANAGER_OK, match: ["/dashboard/studio/crew"], keywords: "tai khoan nhan vien quyen vai tro so tho crew doi ngu" },
      { href: "/dashboard/studio/ranking", label: "Xếp hạng", icon: Trophy, minTier: "full", roles: MANAGER_OK },
      // Chi nhánh về lại "Nhân sự": chủ studio đi tìm nó bằng câu hỏi "cơ sở này
      // ai làm?", tức cùng mạch với nhân viên và phân quyền — chứ không ai mở
      // "Thiết lập" để mở/đóng một cơ sở. Đứng CUỐI nhóm vì sửa vài lần một năm.
      // roles: BRANCH_ADMIN_OK — "Toàn quyền chi nhánh" KHÔNG thấy, vì họ không
      // được thêm/sửa/xoá chi nhánh (README, mục "Toàn quyền chi nhánh"); trước
      // đây họ vẫn thấy dòng menu này rồi bấm vào mới biết là không làm được gì.
      { href: "/dashboard/studio/branches", label: "Chi nhánh", icon: Building2, minTier: "full", roles: BRANCH_ADMIN_OK, keywords: "chi nhanh studio co so diem chup branch nhieu cua hang" },
    ],
  },
  {
    // Mọi thứ khai MỘT LẦN rồi dùng lại — và KHÔNG thuộc về một nhóm nghiệp vụ
    // nào rõ hơn. Bảng giá đã về "Tài chính", chi nhánh đã về "Nhân sự"; còn lại
    // ở đây là điều khoản, mẫu tin nhắn, website và app máy tính.
    label: "Thiết lập",
    items: [
      { href: "/dashboard/studio/services", label: "Dịch vụ & điều khoản", icon: Gavel, minTier: "booking", roles: MANAGER_OK, match: ["/dashboard/studio/templates"], keywords: "dieu khoan mau hop dong" },
      { href: "/dashboard/studio/messages", label: "Mẫu tin nhắn", icon: MessagesSquare, minTier: "full", roles: MANAGER_OK, keywords: "mau tin zalo sms" },
      { href: "/dashboard/site", label: "Website & chatbox", icon: Globe, minTier: "booking", roles: MANAGER_OK, match: ["/dashboard/studio/chatbox"], keywords: "trang web portfolio tro ly" },
      { href: "/dashboard/studio/desktop", label: "Ứng dụng máy tính", icon: Monitor, minTier: "plus", roles: MANAGER_OK, keywords: "desktop app may tinh sao luu" },
    ],
  },
  {
    // Nhóm RIÊNG cho admin mstudo — không phải cấu hình của một studio. Trước
    // đây ba màn này lẫn trong nhóm "Tài khoản", và "Cài đặt hệ thống"
    // (/dashboard/admin/system) chỉ là một `match` của /dashboard/admin nên
    // không có dòng menu nào dẫn tới — phải gõ tay URL mới vào được.
    label: "Quản trị hệ thống",
    items: [
      { href: "/dashboard/admin", label: "Người dùng & studio", icon: ShieldCheck, minTier: "booking", roles: ADMIN_ONLY, exact: true, keywords: "tai khoan studio nguoi dung quan tri nang cap ma giam gia duyet chuyen khoan" },
      { href: "/dashboard/admin/system", label: "Cài đặt hệ thống", icon: Settings, minTier: "booking", roles: ADMIN_ONLY, keywords: "sao luu khoi phuc thong bao toan studio drive" },
      // /dashboard/settings là cấu hình NỀN TẢNG mstudo (site_settings, bảng giá,
      // phản hồi) và đã chặn non-admin ngay trong page.tsx. Yêu cầu nâng cấp &
      // mã giảm giá đã dọn sang tab "Người dùng & studio" — chúng là việc làm
      // TRÊN một tài khoản, không phải cấu hình nền tảng.
      // Trước nó nằm ở "Thiết lập" với nhãn "Cài đặt studio" và roles owner+admin,
      // nên chủ studio thấy dòng menu rồi bấm vào lại bị đá về /dashboard.
      { href: "/dashboard/settings", label: "Cấu hình mstudo", icon: SlidersHorizontal, minTier: "booking", roles: ADMIN_ONLY, keywords: "site settings phan hoi bang gia tai khoan nhan tien" },
      { href: "/dashboard/admin/affiliate", label: "Quản lý Affiliate", icon: Gift, minTier: "booking", roles: ADMIN_ONLY, keywords: "hoa hong gioi thieu duyet" },
    ],
  },
];

/**
 * Màn KHÔNG nằm trong sidebar (đã gộp nhóm) + các lệnh tạo mới. Chỉ hiện trong
 * ô ⌘K — đây là thứ giữ cho việc gộp nav xuống 25 mục sidebar không làm mất
 * đường tới bất kỳ màn nào.
 */
export const EXTRA_COMMANDS: readonly NavItem[] = [
  // ── Cụm tài khoản: đã rời sidebar sang menu avatar ở topbar (xem
  //    `accountMenu` trong StudioShell.tsx). Mở vài lần một tháng, không đáng
  //    chiếm 4 dòng cuối sidebar — nhưng vẫn phải gõ ⌘K ra được.
  { href: "/dashboard/studio/notifications", label: "Thông báo", icon: Bell, minTier: "full", roles: EVERYONE, badge: "notifications", keywords: "thong bao hoat dong", sub: "Chuông trên topbar" },
  { href: "/dashboard/account", label: "Tài khoản & bảo mật", icon: UserCircle, minTier: "booking", roles: EVERYONE, keywords: "mat khau bao mat thiet bi", sub: "Menu avatar" },
  { href: "/dashboard/upgrade", label: "Gói phần mềm", icon: Crown, minTier: "booking", roles: OWNER_OK, keywords: "nang cap goi plan", sub: "Menu avatar" },
  { href: "/dashboard/affiliate", label: "Affiliate", icon: Gift, minTier: "booking", roles: OWNER_OK, keywords: "hoa hong gioi thieu", sub: "Menu avatar" },
  // ── Màn đã gộp thành tab / lệnh tạo mới ─────────────────────────────────
  { href: "/dashboard/studio/contracts/new", label: "Tạo hợp đồng mới", icon: Plus, minTier: "plus", roles: MANAGER_OK, keywords: "them hop dong moi", sub: "Luồng 5 bước" },
  { href: "/dashboard/studio/quotes/new", label: "Tạo báo giá", icon: FilePlus2, minTier: "plus", roles: MANAGER_OK, keywords: "them bao gia moi gui khach", sub: "Ghép gói và gửi khách" },
  { href: "/dashboard/albums/new", label: "Tạo album giao khách", icon: Images, minTier: "booking", roles: STAFF_OK, keywords: "them album moi", sub: "Album giao khách mới" },
  { href: "/dashboard/studio/calendar?tab=studio", label: "Lịch studio", icon: CalendarRange, minTier: "booking", roles: STAFF_OK, keywords: "lich trang diem thu do tu van makeup fitting hen phong", sub: "Tab của Lịch làm việc" },
  { href: "/dashboard/studio/calendar?tab=team", label: "Lịch đội ngũ", icon: UsersRound, minTier: "full", roles: MANAGER_OK, keywords: "lich nhan su theo nguoi", sub: "Tab của Lịch làm việc" },
  { href: "/dashboard/studio/staff?tab=crew", label: "Đội ngũ thợ", icon: UsersRound, minTier: "full", roles: MANAGER_OK, keywords: "so tho crew doi ngu freelancer", sub: "Đã gộp vào Nhân viên & phân quyền" },
  { href: "/dashboard/studio/templates", label: "Mẫu hợp đồng", icon: FileSignature, minTier: "full", roles: MANAGER_OK, keywords: "mau hop dong dieu khoan", sub: "Đã gộp vào Dịch vụ & điều khoản" },
  { href: "/dashboard/studio/packages", label: "Gói dịch vụ", icon: Package, minTier: "full", roles: MANAGER_OK, keywords: "goi combo dich vu", sub: "Đã gộp vào Gói & bảng giá" },
  { href: "/dashboard/studio/chatbox", label: "Cấu hình chatbox", icon: MessageSquare, minTier: "booking", roles: MANAGER_OK, keywords: "tro ly tra loi khach", sub: "Đã gộp vào Website & chatbox" },
  { href: "/dashboard/studio/drive-sync", label: "Đồng bộ Google Drive", icon: HardDrive, minTier: "full", roles: OWNER_OK, keywords: "drive dong bo anh", sub: "Kết nối và cấu hình đồng bộ" },
  { href: "/dashboard/studio/album-categories", label: "Danh mục album", icon: FolderTree, minTier: "full", roles: MANAGER_OK, keywords: "the loai album", sub: "Đã gộp vào Thư viện album" },
  { href: "/dashboard/site/builder", label: "Giao diện website", icon: Paintbrush, minTier: "booking", roles: MANAGER_OK, keywords: "dung trang web khoi noi dung", sub: "Sắp xếp khối nội dung trang studio" },
  { href: "/dashboard/compress", label: "Nén ảnh & watermark", icon: Archive, minTier: "booking", roles: STAFF_OK, keywords: "nen anh dong dau watermark", sub: "Trong Công cụ ảnh" },
  { href: "/dashboard/filter", label: "Lọc ảnh khách chọn", icon: CopyCheck, minTier: "booking", roles: STAFF_OK, keywords: "loc anh khach chon tach anh", sub: "Trong Công cụ ảnh" },
  { href: "/dashboard/connections", label: "Kết nối Calendar", icon: Link2, minTier: "booking", roles: MANAGER_OK, keywords: "google calendar tich hop", sub: "Google Calendar và tích hợp khác" },
];

export type NavAccess = {
  tier: StudioTier;
  role: string;
  /** Cờ "Sắp ra mắt": khoá với người thường, admin vẫn vào để dựng nốt. */
  comingSoon?: readonly string[];
  /** Chưa xuất bản: ẩn hoàn toàn với người thường. */
  hiddenNav?: readonly string[];
};

export function canSee(it: NavItem, a: NavAccess): boolean {
  if (a.hiddenNav?.includes(it.href) && a.role !== "admin") return false;
  if (TIER_RANK[a.tier] < TIER_RANK[it.minTier]) return false;
  return it.roles.includes(a.role);
}

/** Nhóm sidebar sau khi lọc theo gói + vai trò; nhóm rỗng bị bỏ luôn. */
export function visibleGroups(a: NavAccess): NavGroup[] {
  return NAV_GROUPS
    .map((g) => ({ label: g.label, items: g.items.filter((it) => canSee(it, a)) }))
    .filter((g) => g.items.length > 0);
}

/**
 * Mọi màn tới được bằng ⌘K: mục sidebar + màn đã gộp + lệnh tạo mới.
 * Dòng phụ = tên nhóm trong sidebar, để người dùng biết màn đó nằm ở đâu.
 */
export function commandItems(a: NavAccess): NavItem[] {
  return [
    ...NAV_GROUPS.flatMap((g) => g.items.map((it) => ({ ...it, sub: it.sub ?? g.label ?? "" }))),
    ...EXTRA_COMMANDS,
  ].filter((it) => canSee(it, a));
}

/** Bỏ dấu tiếng Việt để gõ "hop dong" cũng ra "Hợp đồng". */
export function noAccent(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
}

/** Mục đang mở: khớp chính route, route con, hoặc màn đã gộp vào nó. */
export function isNavActive(it: NavItem, pathname: string): boolean {
  const hit = (p: string) =>
    p === "/dashboard/studio" || p === "/dashboard" ? pathname === p : pathname === p || pathname.startsWith(p + "/");
  const self = it.exact ? pathname === it.href : hit(it.href);
  return self || (it.match?.some(hit) ?? false);
}
