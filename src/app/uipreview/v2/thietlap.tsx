/* Màn xem trước GIAO DIỆN MỚI của nhóm "thietlap" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Bọc màn trong
 * <PreviewV2 path="/dashboard/..."> (xem ./shell.tsx). */
import * as f from "../fixtures";
import { PreviewV2 } from "./shell";
import StaffAndCrew from "@/app/dashboard/studio/staff/StaffAndCrew";
import type { RankRow } from "@/app/dashboard/studio/staff/RankingList";
import BranchesManager, { type BranchStaff } from "@/app/dashboard/studio/branches/BranchesManager";
import PackagesManager from "@/app/dashboard/studio/packages/PackagesManager";
import ServicesTemplatesTabsV2 from "@/app/dashboard/studio/services/ServicesTemplatesTabsV2";
import type { TemplateWithItems } from "@/app/dashboard/studio/templates/TemplatesManager";
import PricingV2 from "@/app/dashboard/studio/pricing/PricingV2";
import MessagesV2 from "@/app/dashboard/studio/messages/MessagesV2";
import ChatboxConfigV2 from "@/app/dashboard/studio/chatbox/ChatboxConfigV2";
import VouchersView from "@/app/dashboard/studio/vouchers/VouchersView";
import AuditView, { type AuditRow } from "@/app/dashboard/studio/audit/AuditView";
import NotificationsList from "@/app/dashboard/studio/notifications/NotificationsList";
import StudioPolicyCard from "@/components/studio/StudioPolicyCard";
import AutomationsCard from "@/components/studio/AutomationsCard";
import BankAutoCard from "@/components/studio/BankAutoCard";
import type { MessageTemplate, PricelistItem, StudioBranch, StudioCrew, StudioNotification, StudioPackage, StudioService } from "@/lib/types";
import type { CrewRoleRow } from "@/lib/crew-roles";
import type { BranchStats } from "@/lib/branch-rules";
import type { Voucher } from "@/lib/vouchers";

type Screen = { title: string; render: () => React.ReactNode; bare?: boolean };

/* ── Nhân sự ─────────────────────────────────────────────────────────────── */
const D = "2026-10-01";
const crew: StudioCrew[] = [
  ...f.roster,
  { id: "sc3", owner_id: "o1", name: "Phan Đức Long", phone: "0933555777", role: "cameraman", note: "Có flycam", branch_id: "b2", created_at: `${D}T00:00:00Z`, email: "long@gmail.com", skills: "Quay phóng sự, dựng" },
  { id: "sc4", owner_id: "o1", name: "Ngô Bảo Châu", phone: "0912888999", role: "makeup", note: null, branch_id: null, created_at: `${D}T00:00:00Z` },
  { id: "sc5", owner_id: "o1", name: "Đinh Thị Mai", phone: "0977666555", role: "photographer", note: null, branch_id: null, created_at: `${D}T00:00:00Z`, status: "pending" },
  { id: "sc6", owner_id: "o1", name: "Vũ Hoàng", phone: "0909000111", role: "c_flycam1", note: "Chỉ nhận cuối tuần", branch_id: "b1", created_at: `${D}T00:00:00Z` },
];
const crewStats = {
  "0987654321": { total: 14, accepted: 12, declined: 1 },
  "0901112223": { total: 9, accepted: 5, declined: 3 },
  "0933555777": { total: 6, accepted: 6, declined: 0 },
  "0909000111": { total: 4, accepted: 1, declined: 2 },
};
const crewRoles: CrewRoleRow[] = [
  { key: "c_flycam1", label: "Flycam", kinds: ["shoot", "combo"], active: true, position: 7 },
  { key: "makeup", label: "Trang điểm cô dâu", kinds: ["makeup", "combo"], active: true, position: 3 },
];
const ranked: RankRow[] = [
  { key: "0987654321", name: "Trần Minh Quân", role: "photographer", jobs: 14, accepted: 12, earned: 18_400_000 },
  { key: "0933555777", name: "Phan Đức Long", role: "cameraman", jobs: 6, accepted: 6, earned: 12_000_000 },
  { key: "0901112223", name: "Lê Thị Hồng Nhung Phương Thảo", role: "assistant", jobs: 9, accepted: 5, earned: 4_500_000 },
  { key: "0909000111", name: "Vũ Hoàng", role: "c_flycam1", jobs: 4, accepted: 1, earned: 1_500_000 },
];
const staffProps = (over: Partial<Parameters<typeof StaffAndCrew>[0]["staffProps"]> = {}) => ({
  initial: [
    ...f.staffRows,
    { id: "u4", email: "linh@maistudio.vn", full_name: "Đặng Mỹ Linh", studio_role: "branch_manager", studio_branch_id: null, is_active: true, created_at: "2026-08-02T03:00:00Z" },
  ],
  branches: f.branches,
  canManageRoles: true,
  canAssignBranch: true,
  lockedBranchName: null,
  ...over,
});
const crewProps = (over: Partial<Parameters<typeof StaffAndCrew>[0]["crewProps"]> = {}) => ({
  ownerId: "o1",
  initial: crew,
  stats: crewStats,
  registerUrl: "https://mstudo.com/crew/join/7f3k9p2m",
  registerError: null,
  branches: f.branches,
  crewRoles,
  canEditCrewRoles: true,
  ...over,
});

/* ── Chi nhánh ───────────────────────────────────────────────────────────── */
const branchRows: StudioBranch[] = [
  { id: "b1", owner_id: "o1", name: "Cơ sở Quận 1", code: "Q1", address: "12 Nguyễn Huệ, Quận 1, TP.HCM", phone: "0283 822 1234", manager_id: "u1", note: "Mở cửa 8:00–21:00, nghỉ thứ Hai.\nGửi xe ở hầm B1.", active: true, position: 0, created_at: `${D}T00:00:00Z` },
  { id: "b2", owner_id: "o1", name: "Cơ sở Thủ Đức", code: "TĐ", address: "88 Võ Văn Ngân, TP. Thủ Đức", phone: null, manager_id: null, note: null, active: true, position: 1, created_at: `${D}T00:00:00Z` },
  { id: "b3", owner_id: "o1", name: "Cơ sở Đà Lạt (mùa cưới)", code: "DL", address: null, phone: null, manager_id: null, note: null, active: false, position: 2, created_at: `${D}T00:00:00Z` },
];
const branchStats: BranchStats[] = [
  { branchId: "b1", contracts: 14, revenue: 186_500_000, contractValue: 320_000_000, expenses: 42_000_000, staff: 2, crew: 3, appointments: 9 },
  { branchId: "b2", contracts: 6, revenue: 64_000_000, contractValue: 110_000_000, expenses: 12_500_000, staff: 1, crew: 2, appointments: 4 },
  { branchId: "b3", contracts: 0, revenue: 0, contractValue: 0, expenses: 0, staff: 0, crew: 0, appointments: 0 },
  { branchId: null, contracts: 3, revenue: 12_000_000, contractValue: 30_000_000, expenses: 0, staff: 1, crew: 1, appointments: 2 },
];
const branchStaff: BranchStaff[] = f.staffRows.map((s) => ({ id: s.id, full_name: s.full_name, email: s.email, studio_role: s.studio_role, studio_branch_id: s.studio_branch_id }));

/* ── Thẻ buổi ───────────────────────────────────────────────────────────── */
const packageRows: StudioPackage[] = [
  ...f.packages,
  { id: "g3", owner_id: "o", client_name: "Công ty TNHH Hạ Vy", client_phone: "0903111222", name: "Gói 6 buổi chụp sản phẩm", total_sessions: 6, used_sessions: 1, price: 18_000_000, paid: true, note: null, created_at: "2026-09-12T03:00:00Z" },
  { id: "g4", owner_id: "o", client_name: "Lê Minh Khang", client_phone: "0933222111", name: "Thẻ 3 buổi gia đình", total_sessions: 3, used_sessions: 0, price: 4_500_000, paid: false, note: null, created_at: "2026-10-02T03:00:00Z" },
];

/* ── Dịch vụ & điều khoản, mẫu hợp đồng ─────────────────────────────────── */
const clauses = [
  "1. Bên B đặt cọc 30% giá trị hợp đồng để giữ lịch.",
  "2. Thanh toán phần còn lại trước khi nhận album.",
  "3. Đổi lịch báo trước 7 ngày, không mất cọc.",
  "4. Ảnh gốc lưu trên Drive 6 tháng sau khi giao.",
  "5. Studio được dùng ảnh làm portfolio nếu khách đồng ý.",
].join("\n");
const serviceRows: StudioService[] = [
  { id: "s1", owner_id: "o1", name: "Chụp phóng sự cưới", clauses, position: 0, active: true, created_at: `${D}T00:00:00Z` },
  { id: "s2", owner_id: "o1", name: "Chụp kỷ yếu", clauses: "1. Giá tính theo đầu người, tối thiểu 20 bạn.\n2. Trang phục do studio chuẩn bị.", position: 1, active: true, created_at: `${D}T00:00:00Z` },
  { id: "s3", owner_id: "o1", name: "Chụp doanh nghiệp / sự kiện", clauses: "", position: 2, active: true, created_at: `${D}T00:00:00Z` },
];
const templateRows: TemplateWithItems[] = [
  {
    id: "t1", owner_id: "o1", name: "Gói cưới trọn ngày", shoot_type: "photo", note: "Giao ảnh 20 ngày sau buổi chụp.", created_at: `${D}T00:00:00Z`,
    contract_template_items: [
      { id: "i1", template_id: "t1", name: "Chụp phóng sự ngày cưới (2 thợ)", qty: 1, unit_price: 12_000_000, position: 0 },
      { id: "i2", template_id: "t1", name: "Album in 30x30, 30 trang", qty: 1, unit_price: 3_500_000, position: 1 },
      { id: "i3", template_id: "t1", name: "Phụ thu đi tỉnh", qty: 2, unit_price: 500_000, position: 2 },
    ],
  },
  { id: "t2", owner_id: "o1", name: "Quay phóng sự", shoot_type: "video", note: null, created_at: `${D}T00:00:00Z`, contract_template_items: [] },
];

/* ── Bảng giá ───────────────────────────────────────────────────────────── */
const pl = (o: Partial<PricelistItem> & Pick<PricelistItem, "id" | "name" | "price">): PricelistItem => ({
  owner_id: "o1", list_key: "cuoi", unit: null, category: null, description: null, active: true, show_on_home: true, position: 0, created_at: `${D}T00:00:00Z`, ...o,
});
const pricelist: PricelistItem[] = [
  pl({ id: "p1", name: "Truyền thống", price: 8_500_000, unit: "/ gói", category: "Gói chụp", description: "1 thợ chụp\nAlbum 25x25, 20 trang\nGiao ảnh 15 ngày", position: 0 }),
  pl({ id: "p2", name: "Phóng sự x2", price: 15_000_000, unit: "/ gói", category: "Gói chụp", description: "2 thợ chụp cả ngày\nAlbum 30x30, 30 trang", show_on_home: false, position: 1 }),
  pl({ id: "p3", name: "Gói combo chụp + quay phóng sự ngày cưới", price: 28_000_000, category: "Gói quay", description: "2 thợ chụp + 1 quay\nPhim highlight 3–5 phút", position: 2 }),
  pl({ id: "p4", name: "Flycam", price: 2_000_000, category: "Thêm", active: false, position: 3 }),
  pl({ id: "p5", name: "Phát sinh thêm", price: 0, category: "Phát sinh thêm", description: "Đi tỉnh: +500.000đ / 50km\nChụp thêm giờ: 500.000đ / giờ", position: 4 }),
  pl({ id: "p6", list_key: "dinh-hon", name: "Đính hôn cơ bản", price: 4_000_000, position: 5 }),
];

/* ── Mẫu tin nhắn ───────────────────────────────────────────────────────── */
const messageRows: MessageTemplate[] = [
  { id: "m1", owner_id: "o1", title: "Nhắc lịch chụp", body: "Chào anh/chị {tên}, studio xin nhắc lịch chụp ngày {ngày} lúc {giờ} tại {địa điểm}. Anh/chị chuẩn bị giúp em & có mặt đúng giờ nhé. Hẹn gặp anh/chị ạ! 📸", created_at: `${D}T00:00:00Z` },
  { id: "m2", owner_id: "o1", title: "Xác nhận đặt cọc", body: "Em đã nhận cọc {số tiền} cho hợp đồng \"{tên HĐ}\". Cảm ơn anh/chị, studio đã giữ lịch ngày {ngày} cho mình ạ.", created_at: `${D}T00:00:00Z` },
  { id: "m3", owner_id: "o1", title: "Giao ảnh", body: "Ảnh của anh/chị đã hoàn thiện! Mời anh/chị xem & tải tại: {link}. Nếu cần chỉnh thêm anh/chị nhắn em trong 7 ngày nhé ạ.", created_at: `${D}T00:00:00Z` },
  { id: "m4", owner_id: "o1", title: "Xin đánh giá sau khi giao album", body: "Cảm ơn anh/chị đã tin tưởng studio! Anh/chị dành chút thời gian đánh giá giúp em tại {link} nhé, em rất trân trọng ạ. 🙏", created_at: `${D}T00:00:00Z` },
];

/* ── Voucher ────────────────────────────────────────────────────────────── */
const vb = {
  buyer_name: null, paid_method: null, paid_at: "2026-09-01", redeemed_contract_id: null, redeemed_at: null, note: null,
  created_at: "2026-09-01T10:00:00Z", paid: true, status: "active" as const,
};
const voucherRows: Voucher[] = [
  { ...vb, id: "v1", code: "UD-7K3M9P", title: "Voucher ưu đãi lần sau", amount: 0, price: 0, buyer_phone: "0933444555", recipient_name: "Phạm Thị Nhật Ý", expires_on: "2027-09-29", kind: "loyalty", discount_type: "percent", percent: 10, max_discount: 2_000_000, source_contract_id: "c1", public_token: "demo-token-1234567890" },
  { ...vb, id: "v2", code: "UD-4HRT8W", title: "Voucher ưu đãi lần sau", amount: 500_000, price: 0, buyer_phone: "0911222333", recipient_name: "Trần Minh Khoa", expires_on: null, kind: "loyalty", discount_type: "amount", status: "redeemed", redeemed_contract_id: "c2", source_contract_id: "c3", public_token: "demo-token-abcdefghij" },
  { ...vb, id: "v3", code: "QUA-9PXK2M", title: "Voucher chụp ảnh 20/10", amount: 2_000_000, price: 1_800_000, buyer_phone: "0988777666", buyer_name: "Lê Văn Hùng", recipient_name: "Nguyễn Thu Hà", expires_on: "2027-10-20" },
  { ...vb, id: "v4", code: "QUA-3MN7QR", title: "Thẻ quà chụp gia đình Tết", amount: 3_000_000, price: 3_000_000, buyer_phone: "0912000333", buyer_name: "Vũ Ngọc Ánh", recipient_name: null, expires_on: "2027-02-28", paid: false, paid_at: null },
  { ...vb, id: "v5", code: "QUA-8TT2WX", title: "Voucher chụp ảnh 8/3", amount: 1_000_000, price: 900_000, buyer_phone: null, recipient_name: "Hoàng Yến", expires_on: "2026-03-31" },
  { ...vb, id: "v6", code: "QUA-5KD9PL", title: "Voucher chụp ảnh 20/10", amount: 2_000_000, price: 2_000_000, buyer_phone: null, recipient_name: null, expires_on: "2027-10-20", status: "void" },
];

/* ── Nhật ký thao tác & thông báo: giờ TƯƠNG ĐỐI để luôn có "Hôm nay" ─── */
const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const audit = (o: Partial<AuditRow> & Pick<AuditRow, "id" | "action" | "summary" | "created_at">): AuditRow => ({
  actor_id: "u1", actor_name: "Phạm Thu Hà", entity: "contract", entity_id: null, contract_id: null, contract_label: null, before: null, after: null, ...o,
});
const auditRows: AuditRow[] = [
  audit({ id: 1, action: "payment.create", summary: "Ghi thu 15.000.000đ — đợt 2", contract_id: "c1", contract_label: "HD2609 · Nguyễn Thị Lan Phương", after: { amount: 15_000_000, kind: "installment", method: "transfer", paid_at: "2026-10-25" }, created_at: ago(1) }),
  audit({ id: 2, action: "payment.delete", summary: "Xoá khoản thu 2.000.000đ", actor_id: "u2", actor_name: "Trần Hoài Nam", contract_id: "c2", contract_label: "HD2611 · Đỗ Quang Huy", before: { amount: 2_000_000, method: "cash", note: "Thu nhầm" }, created_at: ago(3) }),
  audit({ id: 3, action: "contract.update", summary: "Đổi ngày chụp", contract_id: "c1", contract_label: "HD2609 · Nguyễn Thị Lan Phương", before: { event_date: "2026-11-20" }, after: { event_date: "2026-11-22" }, created_at: ago(5) }),
  audit({ id: 4, action: "account.login", summary: "Đăng nhập trên thiết bị mới", actor_id: null, actor_name: null, created_at: ago(26) }),
  audit({ id: 5, action: "voucher.void", summary: "Huỷ voucher QUA-5KD9PL", created_at: ago(30) }),
  audit({ id: 6, action: "contract.status", summary: "Đổi trạng thái: Đã duyệt → Hoàn thành", contract_id: "c3", contract_label: "HD2590 · Phạm Thu Hà", before: { status: "approved" }, after: { status: "completed" }, created_at: ago(80) }),
];
const notif = (o: Partial<StudioNotification> & Pick<StudioNotification, "id" | "kind" | "message" | "created_at">): StudioNotification => ({
  owner_id: "o1", contract_id: "c1", read: false, ...o,
});
const notificationRows: StudioNotification[] = [
  notif({ id: "n1", kind: "signed", message: "Nguyễn Thị Lan Phương đã ký hợp đồng HD2609", created_at: ago(0.5) }),
  notif({ id: "n2", kind: "payment", message: "Khách chuyển cọc 5.000.000đ cho HD2611", created_at: ago(2) }),
  notif({ id: "n3", kind: "crew_accepted", message: "Trần Minh Quân nhận buổi chụp ngày 22/11", created_at: ago(4), read: true }),
  notif({ id: "n4", kind: "crew_declined", message: "Lê Thị Hồng Nhung Phương Thảo từ chối buổi chụp ngày 30/11 — bận việc gia đình", created_at: ago(27) }),
  notif({ id: "n5", kind: "review", message: "Phạm Thu Hà gửi đánh giá 5 sao", created_at: ago(50), read: true, contract_id: null }),
];

export const SCREENS_THIETLAP: Record<string, Screen> = {
  "v2-nhan-su": {
    title: "Giao diện mới — Nhân sự (nhân viên & phân quyền)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/staff">
        <StaffAndCrew canSeeStaffTab staffProps={staffProps()} crewProps={crewProps()} ranked={ranked} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-nhan-su-quan-ly": {
    title: "Giao diện mới — Nhân sự (quản lý: không đổi được vai trò)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/staff">
        <StaffAndCrew canSeeStaffTab staffProps={staffProps({ canManageRoles: false })} crewProps={crewProps({ canEditCrewRoles: true })} ranked={ranked} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-nhan-su-chi-nhanh": {
    title: "Giao diện mới — Sổ thợ (quản lý chi nhánh: chỉ thấy tab thợ)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/staff">
        <StaffAndCrew
          canSeeStaffTab={false}
          staffProps={staffProps({ canManageRoles: false, canAssignBranch: false, lockedBranchName: "Cơ sở Quận 1" })}
          crewProps={crewProps({ canEditCrewRoles: false, registerUrl: "", registerError: "column profiles.crew_token does not exist" })}
          ranked={ranked}
        />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-nhan-su-trong": {
    title: "Giao diện mới — Nhân sự (chưa có ai)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/staff">
        <StaffAndCrew canSeeStaffTab staffProps={staffProps({ initial: [] })} crewProps={crewProps({ initial: [], stats: {} })} ranked={[]} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-chi-nhanh": {
    title: "Giao diện mới — Chi nhánh",
    render: () => (
      <PreviewV2 path="/dashboard/studio/branches">
        <BranchesManager ownerId="o1" canEdit initial={branchRows} stats={branchStats} staff={branchStaff} monthLabel="10/2026" />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-chi-nhanh-trong": {
    title: "Giao diện mới — Chi nhánh (chưa có, quản lý chi nhánh chỉ xem)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/branches">
        <BranchesManager ownerId="o1" canEdit={false} initial={[]} stats={[]} staff={[]} monthLabel="10/2026" />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-the-buoi": {
    title: "Giao diện mới — Thẻ buổi",
    render: () => (
      <PreviewV2 path="/dashboard/studio/packages">
        <PackagesManager ownerId="o1" initial={packageRows} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-dich-vu": {
    title: "Giao diện mới — Dịch vụ & điều khoản (chủ studio)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/services">
        <ServicesTemplatesTabsV2
          ownerId="o1"
          services={serviceRows}
          templates={templateRows}
          canUseTemplates
          policy={<StudioPolicyCard ownerId="o1" initialStorageMonths={6} initialQuoteValidDays={15} initialDeposit={500_000} />}
          automations={<AutomationsCard ownerId="o1" initial={{}} />}
        />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-mau-hop-dong": {
    title: "Giao diện mới — Mẫu hợp đồng (tab 2 của Dịch vụ & điều khoản)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/services">
        <ServicesTemplatesTabsV2 ownerId="o1" services={serviceRows} templates={templateRows} canUseTemplates initialTab="templates" />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-dich-vu-trong": {
    title: "Giao diện mới — Dịch vụ & điều khoản (trống, gói chưa có mẫu hợp đồng)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/services">
        <ServicesTemplatesTabsV2 ownerId="o1" services={[]} templates={[]} canUseTemplates={false} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-bang-gia": {
    title: "Giao diện mới — Gói & bảng giá",
    render: () => (
      <PreviewV2 path="/dashboard/studio/pricing">
        <PricingV2
          ownerId="o1"
          initial={pricelist}
          listLabels={{ s1: "Kỷ yếu" }}
          services={[{ id: "s1", name: "Kỷ yếu" }]}
          hiddenLists={[]}
          canQuote
          shareUrl="https://maystudio.mstudo.com/gia/7f3k9p2m"
          contact={{ pl_phone: "0933444555", pl_facebook: "fb.com/maystudio", pl_bank_holder: "NGUYEN VAN A", pl_bank_account: "0123456789", pl_bank_name: "Vietcombank", pl_bank_bin: "970436" }}
          appearance={{ pl_bg: "", pl_text: "", pl_accent: "", pl_logo_url: "" }}
          bankAuto={<BankAutoCard />}
        />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-mau-tin": {
    title: "Giao diện mới — Mẫu tin nhắn",
    render: () => (
      <PreviewV2 path="/dashboard/studio/messages">
        <MessagesV2 ownerId="o1" initial={messageRows} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-mau-tin-trong": {
    title: "Giao diện mới — Mẫu tin nhắn (chưa có mẫu)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/messages">
        <MessagesV2 ownerId="o1" initial={[]} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-chatbox": {
    title: "Giao diện mới — Cấu hình chatbox",
    render: () => (
      <PreviewV2 path="/dashboard/studio/chatbox">
        <ChatboxConfigV2
          ownerId="o1"
          greeting="Chào anh/chị! Mây Studio có thể tư vấn gói chụp nào cho mình ạ?"
          instructions={"• Giọng văn: thân thiện, xưng \"studio\".\n• Đặt cọc 30% để giữ lịch.\n• Giao ảnh cưới 20–30 ngày."}
        />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-voucher": {
    title: "Giao diện mới — Voucher & thẻ quà",
    render: () => (
      <PreviewV2 path="/dashboard/studio/vouchers">
        <VouchersView
          program={{ enabled: true, percent: 5, max_discount: 2_000_000, valid_months: 12, title: "Voucher ưu đãi lần sau", package_names: ["Phóng sự x2", "Gói combo"], tiers: [{ min: 0, percent: 5 }, { min: 15_000_000, percent: 7 }, { min: 30_000_000, percent: 10, max: 3_000_000 }] }}
          packages={[
            { name: "Truyền thống", group: "Cưới · Gói chụp cơ bản" },
            { name: "Phóng sự x1", group: "Cưới · Gói chụp cơ bản" },
            { name: "Phóng sự x2", group: "Cưới · Gói chụp cơ bản" },
            { name: "Gói quay cơ bản", group: "Cưới · Gói quay PS ngày cưới" },
            { name: "Gói combo", group: "Cưới · Gói quay PS ngày cưới" },
          ]}
          programMigrated
          migrated
          studioName="Mây Studio"
          studioPhone="0933444555"
          studioHost="mayanh.mstudo.com"
          initial={voucherRows}
        />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-nhat-ky": {
    title: "Giao diện mới — Nhật ký thao tác",
    render: () => (
      <PreviewV2 path="/dashboard/studio/audit">
        <AuditView rows={auditRows} migrated filteredContract={null} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-thong-bao": {
    title: "Giao diện mới — Thông báo",
    render: () => (
      <PreviewV2 path="/dashboard/studio/notifications">
        <NotificationsList initial={notificationRows} />
      </PreviewV2>
    ),
    bare: true,
  },
};
