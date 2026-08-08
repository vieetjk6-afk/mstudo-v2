import {
  LayoutDashboard, ReceiptText, FileText, Kanban, CalendarClock, Inbox,
  CalendarDays, Wand2, Images, Shirt, Camera, Users, Sparkles, BookImage,
  Wallet, Banknote, UsersRound, Trophy, MessagesSquare, Package, Gavel,
  Globe, SlidersHorizontal, Settings, Bell, UserCircle, Crown, Gift, Monitor,
  ShieldCheck, Plus, FilePlus2, CalendarRange, UserCog, FileSignature,
  MessageSquare, HardDrive, Archive, Link2, FolderTree, Paintbrush, CopyCheck,
  type LucideIcon,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   ĐIỀU HƯỚNG KHU QUẢN LÝ STUDIO — nguồn duy nhất cho sidebar, drawer và ô ⌘K.
   Theo mục "Cấu trúc điều hướng" của README.md ở gốc repo: 7 nhóm, gộp từ ~40
   mục rời rạc. Những màn KHÔNG còn trong sidebar (lịch đội, nhân viên, mẫu hợp
   đồng, chatbox, nén ảnh…) vẫn tới được bằng ⌘K — xem EXTRA_COMMANDS bên dưới.

   Icon: bản thiết kế vẽ bằng Material Symbols Rounded, ở đây dùng lucide-react
   (thư viện sẵn có của repo, đã dùng ở ~50 file) với icon tương đương gần nhất
   — trộn hai bộ icon trong cùng một app trông lệch hơn là lệch vài nét vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export type StudioTier = "none" | "booking" | "plus" | "full";
export const TIER_RANK: Record<StudioTier, number> = { none: 0, booking: 1, plus: 2, full: 3 };

/** Khoá badge đếm việc chưa xử lý (xem /api/studio/nav-badges). */
export type BadgeKey = "quotes" | "bookings" | "leads" | "production" | "notifications";
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
  /** Từ khoá không dấu thêm cho ⌘K (nhãn đã tự được tìm). */
  keywords?: string;
  /** Dòng phụ trong ô ⌘K. Mục sidebar tự lấy tên nhóm nếu để trống. */
  sub?: string;
};
export type NavGroup = { label: string; items: NavItem[] };

const EVERYONE = ["owner", "admin", "manager", "staff", "accountant"] as const;
const STAFF_OK = ["owner", "admin", "manager", "staff"] as const;
const MANAGER_OK = ["owner", "admin", "manager"] as const;
const OWNER_OK = ["owner", "admin"] as const;
/** Tiền bạc: chủ + kế toán. Quản lý KHÔNG xem (README, mục "Phân quyền"). */
const MONEY_OK = ["owner", "admin", "accountant"] as const;
const ADMIN_ONLY = ["admin"] as const;

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "",
    items: [
      { href: "/dashboard/studio", label: "Tổng quan", icon: LayoutDashboard, minTier: "booking", roles: EVERYONE, keywords: "trang chu dashboard", sub: "Toàn cảnh studio hôm nay" },
    ],
  },
  {
    label: "Bán hàng",
    items: [
      { href: "/dashboard/studio/quotes", label: "Báo giá", icon: ReceiptText, minTier: "plus", roles: MANAGER_OK, badge: "quotes" },
      { href: "/dashboard/studio/contracts", label: "Hợp đồng & lịch hẹn", icon: FileText, minTier: "plus", roles: STAFF_OK, keywords: "hop dong buoi chup" },
      { href: "/dashboard/studio/board", label: "Bảng công việc", icon: Kanban, minTier: "full", roles: MANAGER_OK, keywords: "kanban cong viec" },
      { href: "/dashboard/studio/bookings", label: "Đặt lịch khách", icon: CalendarClock, minTier: "booking", roles: MANAGER_OK, badge: "bookings" },
      { href: "/dashboard/studio/leads", label: "Yêu cầu mới", icon: Inbox, minTier: "booking", roles: MANAGER_OK, badge: "leads", keywords: "lead website chatbox" },
    ],
  },
  {
    label: "Vận hành",
    items: [
      // Lịch đội ngũ (/team) sẽ gộp thành tab 4 của màn này ở bước 5.
      { href: "/dashboard/studio/calendar", label: "Lịch làm việc", icon: CalendarDays, minTier: "booking", roles: STAFF_OK, match: ["/dashboard/studio/team"], keywords: "lich chup doi ngu" },
      { href: "/dashboard/studio/production", label: "Xử lý hình ảnh", icon: Wand2, minTier: "full", roles: STAFF_OK, badge: "production", keywords: "hau ky san xuat in" },
      { href: "/dashboard/albums", label: "Thư viện album", icon: Images, minTier: "booking", roles: STAFF_OK, match: ["/dashboard/create", "/dashboard/studio/album-categories"], keywords: "album chon anh giao khach" },
      { href: "/dashboard/studio/rental", label: "Phòng váy", icon: Shirt, minTier: "full", roles: MANAGER_OK, keywords: "trang phuc thue vay" },
      { href: "/dashboard/studio/equipment", label: "Thiết bị", icon: Camera, minTier: "full", roles: MANAGER_OK, keywords: "may anh ong kinh den" },
    ],
  },
  {
    label: "Khách hàng",
    items: [
      { href: "/dashboard/studio/clients", label: "Khách hàng", icon: Users, minTier: "booking", roles: MANAGER_OK, keywords: "danh ba khach" },
      { href: "/dashboard/studio/thiep", label: "Thiệp · Story · Slide", icon: Sparkles, minTier: "full", roles: MANAGER_OK, match: ["/dashboard/studio/story", "/dashboard/studio/slide"], keywords: "thiep cuoi love story slide" },
      { href: "/dashboard/studio/album-designer", label: "Thiết kế album", icon: BookImage, minTier: "full", roles: MANAGER_OK, keywords: "dan trang album in" },
    ],
  },
  {
    label: "Tài chính",
    items: [
      // Bản thiết kế tách "Thu chi & công nợ" và "Báo cáo" thành 2 màn, nhưng
      // repo đang là MỘT trang /reports. Chỉ để một mục ở đây; khi tách màn ở
      // bước 5 thì thêm mục "Báo cáo" trỏ vào route mới — không trỏ 2 mục vào
      // cùng một trang, vì cả hai sẽ cùng sáng và người dùng bấm mãi một chỗ.
      { href: "/dashboard/studio/reports", label: "Thu chi & công nợ", icon: Wallet, minTier: "full", roles: MONEY_OK, keywords: "bao cao doanh thu chi phi cong no dong tien" },
      { href: "/dashboard/studio/payroll", label: "Đối soát tiền công", icon: Banknote, minTier: "full", roles: MONEY_OK, keywords: "bang luong tien cong nhan su" },
    ],
  },
  {
    label: "Nhân sự",
    items: [
      { href: "/dashboard/studio/crew", label: "Đội ngũ", icon: UsersRound, minTier: "full", roles: MANAGER_OK, match: ["/dashboard/studio/staff"], keywords: "so tho nhan vien crew" },
      { href: "/dashboard/studio/ranking", label: "Xếp hạng", icon: Trophy, minTier: "full", roles: MANAGER_OK },
      { href: "/dashboard/studio/messages", label: "Mẫu tin nhắn", icon: MessagesSquare, minTier: "full", roles: MANAGER_OK, keywords: "mau tin zalo sms" },
    ],
  },
  {
    label: "Thiết lập",
    items: [
      { href: "/dashboard/studio/pricing", label: "Gói & bảng giá", icon: Package, minTier: "booking", roles: MANAGER_OK, match: ["/dashboard/studio/packages"], keywords: "goi dich vu bang gia" },
      { href: "/dashboard/studio/services", label: "Dịch vụ & điều khoản", icon: Gavel, minTier: "booking", roles: MANAGER_OK, match: ["/dashboard/studio/templates"], keywords: "dieu khoan mau hop dong" },
      { href: "/dashboard/site", label: "Website & chatbox", icon: Globe, minTier: "booking", roles: MANAGER_OK, match: ["/dashboard/studio/chatbox"], keywords: "trang web portfolio tro ly" },
      { href: "/dashboard/tools", label: "Công cụ ảnh", icon: SlidersHorizontal, minTier: "booking", roles: MANAGER_OK, match: ["/dashboard/filter", "/dashboard/compress"], keywords: "loc anh nen anh watermark" },
      { href: "/dashboard/settings", label: "Cài đặt studio", icon: Settings, minTier: "booking", roles: OWNER_OK },
    ],
  },
  {
    label: "Tài khoản",
    items: [
      { href: "/dashboard/studio/notifications", label: "Thông báo", icon: Bell, minTier: "full", roles: EVERYONE, badge: "notifications" },
      { href: "/dashboard/account", label: "Tài khoản & bảo mật", icon: UserCircle, minTier: "booking", roles: EVERYONE, keywords: "mat khau bao mat thiet bi" },
      { href: "/dashboard/upgrade", label: "Gói phần mềm", icon: Crown, minTier: "booking", roles: OWNER_OK, keywords: "nang cap goi plan" },
      { href: "/dashboard/affiliate", label: "Affiliate", icon: Gift, minTier: "booking", roles: OWNER_OK, keywords: "hoa hong gioi thieu" },
      { href: "/dashboard/studio/desktop", label: "Ứng dụng máy tính", icon: Monitor, minTier: "plus", roles: MANAGER_OK, keywords: "desktop app may tinh sao luu" },
      { href: "/dashboard/admin", label: "Quản trị hệ thống", icon: ShieldCheck, minTier: "booking", roles: ADMIN_ONLY, match: ["/dashboard/admin/system", "/dashboard/admin/affiliate"] },
    ],
  },
];

/**
 * Màn KHÔNG nằm trong sidebar (đã gộp nhóm) + các lệnh tạo mới. Chỉ hiện trong
 * ô ⌘K — đây là thứ giữ cho việc gộp nav từ ~40 mục xuống 24 không làm mất
 * đường tới bất kỳ màn nào.
 */
export const EXTRA_COMMANDS: readonly NavItem[] = [
  { href: "/dashboard/studio/contracts/new", label: "Tạo hợp đồng mới", icon: Plus, minTier: "plus", roles: MANAGER_OK, keywords: "them hop dong moi", sub: "Luồng 5 bước" },
  { href: "/dashboard/studio/quotes/new", label: "Tạo báo giá", icon: FilePlus2, minTier: "plus", roles: MANAGER_OK, keywords: "them bao gia moi gui khach", sub: "Ghép gói và gửi khách" },
  { href: "/dashboard/albums/new", label: "Tạo album giao khách", icon: Images, minTier: "booking", roles: STAFF_OK, keywords: "them album moi", sub: "Album giao khách mới" },
  { href: "/dashboard/studio/team", label: "Lịch đội ngũ", icon: CalendarRange, minTier: "full", roles: MANAGER_OK, keywords: "lich nhan su theo nguoi", sub: "Đã gộp vào Lịch làm việc" },
  { href: "/dashboard/studio/staff", label: "Nhân viên & phân quyền", icon: UserCog, minTier: "full", roles: MANAGER_OK, keywords: "tai khoan nhan vien quyen", sub: "Đã gộp vào Đội ngũ" },
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
  return hit(it.href) || (it.match?.some(hit) ?? false);
}
