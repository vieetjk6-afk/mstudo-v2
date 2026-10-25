/* Màn xem trước GIAO DIỆN MỚI của nhóm "taikhoan" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Bọc màn trong
 * <PreviewV2 path="/dashboard/..."> (xem ./shell.tsx). */
import * as f from "../fixtures";
import { PreviewV2 } from "./shell";
import AccountV2 from "@/app/dashboard/account/AccountV2";
import type { AccountProps } from "@/app/dashboard/account/useAccount";
import PaymentView from "@/app/dashboard/upgrade/thanh-toan/[id]/PaymentView";
import UpgradeV2 from "@/app/dashboard/upgrade/UpgradeV2";
import AffiliateV2 from "@/app/dashboard/affiliate/AffiliateV2";
import type { Commission } from "@/app/dashboard/affiliate/useAffiliate";
import AdminPanel from "@/app/dashboard/admin/AdminPanel";
import AdminAffiliateV2 from "@/app/dashboard/admin/affiliate/AdminAffiliateV2";
import type { AdminCommission } from "@/app/dashboard/admin/affiliate/useAdminAffiliate";
import SystemV2 from "@/app/dashboard/admin/system/SystemV2";
import SettingsPanel from "@/app/dashboard/settings/SettingsPanel";
import type { Feedback } from "@/app/dashboard/settings/useSettings";
import { planProfilePatch, type Plan } from "@/lib/plans";
import type { Profile, SiteSettings } from "@/lib/types";

/** Ngày TƯƠNG ĐỐI so với hôm nay, để nhãn "x ngày trước" luôn đúng nghĩa. */
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const account: AccountProps = {
  userId: "o",
  email: "mrlee@studio.vn",
  fullName: "Mr Lee",
  plan: "studio",
  planExpiresAt: "2027-03-12T00:00:00Z",
  planCycle: "year",
  createdAt: "2025-04-02T08:00:00Z",
  providers: ["email", "google"],
  hasPassword: true,
  role: "photographer",
  studioBrandName: "Mai Studio",
  studioLogo: null,
};

const noBank = { bin: null, account: null, holder: null, name: null };

/* ── Affiliate ─────────────────────────────────────────────────────────── */
const com = (o: Partial<Commission>): Commission => ({
  id: Math.random().toString(36).slice(2), referred_email: "studio.nangmai@gmail.com", plan: "studio", cycle: "year",
  sale_amount: 1_500_000, commission_pct: 10, commission_amount: 150_000, status: "pending", created_at: ago(3), paid_at: null, ...o,
});
const commissions: Commission[] = [
  com({}),
  com({ referred_email: "hoanganh.wedding@gmail.com", plan: "photographer_plus", cycle: "month", sale_amount: 129_000, commission_amount: 12_900, created_at: ago(9) }),
  com({ referred_email: "kyyeu.saigon@yahoo.com", plan: "photographer", sale_amount: 999_000, commission_amount: 99_900, status: "paid", created_at: ago(24), paid_at: ago(18) }),
  com({ referred_email: "minhstudio@gmail.com", plan: "basic", cycle: "month", sale_amount: 50_000, commission_amount: 5_000, status: "paid", created_at: ago(40), paid_at: ago(31) }),
  com({ referred_email: "tuan.photo@gmail.com", plan: "studio", cycle: "month", sale_amount: 300_000, commission_amount: 30_000, status: "cancelled", created_at: ago(55) }),
  com({ referred_email: "lananh.makeup@gmail.com", plan: "studio", sale_amount: 1_500_000, commission_amount: 150_000, status: "paid", created_at: ago(70), paid_at: ago(60) }),
];
const sum = (st: Commission["status"]) => commissions.filter((c) => c.status === st).reduce((a, c) => a + c.commission_amount, 0);

const adminCommissions: AdminCommission[] = commissions.map((c, i) => ({
  ...c,
  referrer_id: `r${i % 3}`,
  note: null,
  referrer: [
    { full_name: "Mr Lee", email: "mrlee@studio.vn" },
    { full_name: "Trần Hoàng Phúc", email: "phuc.wedding@gmail.com" },
    { full_name: null, email: "kimngan.photo@gmail.com" },
  ][i % 3],
}));

/* ── Người dùng & studio ───────────────────────────────────────────────── */
const prof = (o: Partial<Profile> & { plan?: Plan }): Profile => ({
  id: Math.random().toString(36).slice(2), email: "x@gmail.com", full_name: null, role: "photographer", max_albums: null,
  ...planProfilePatch(o.plan ?? "free"), compress_daily_limit: 2, compress_picker_limit: 1,
  plan: "free", plan_cycle: null, plan_expires_at: null, trial_used_at: null, studio_owner_id: null, studio_role: null,
  is_active: true, last_active_at: null, last_active_day: null, active_days: 0, visit_count: 0, created_at: "2025-06-01T08:00:00Z",
  ...o,
});
const profiles: Profile[] = [
  prof({ id: "o", email: "mrlee@studio.vn", full_name: "Mr Lee", role: "admin", plan: "studio", last_active_at: ago(0), active_days: 212, visit_count: 640, created_at: "2025-01-10T08:00:00Z" }),
  prof({ id: "p1", email: "studio.anhcuoi@gmail.com", full_name: "Ánh Cưới Studio", plan: "studio", plan_cycle: "year", plan_expires_at: "2027-03-02T00:00:00Z", last_active_at: ago(1), active_days: 88, visit_count: 201 }),
  prof({ id: "p2", email: "phuc.wedding@gmail.com", full_name: "Trần Hoàng Phúc", plan: "photographer_plus", plan_cycle: "month", plan_expires_at: "2026-11-20T00:00:00Z", last_active_at: ago(3), active_days: 41, visit_count: 77 }),
  prof({ id: "p3", email: "kimngan.photo@gmail.com", full_name: "Kim Ngân Photography", plan: "photographer", plan_cycle: "trial", plan_expires_at: "2026-11-12T00:00:00Z", last_active_at: ago(12), active_days: 6, visit_count: 9 }),
  prof({ id: "p4", email: "minhstudio@gmail.com", full_name: "Minh Studio", plan: "basic", plan_cycle: "month", plan_expires_at: "2026-10-30T00:00:00Z", last_active_at: ago(45), active_days: 19, visit_count: 30 }),
  prof({ id: "p5", email: "tuan.photo@gmail.com", full_name: "Tuấn Photo", last_active_at: ago(130), active_days: 3, visit_count: 4, is_active: false }),
  prof({ id: "p6", email: "lananh.makeup@gmail.com", full_name: "Lan Anh Makeup", last_active_at: null }),
  prof({ id: "s1", email: "ha@studioanhcuoi.vn", full_name: "Phạm Thu Hà", studio_owner_id: "p1", studio_role: "staff", plan: "free", last_active_at: ago(1) }),
  prof({ id: "p7", email: "kyyeu.saigon@yahoo.com", full_name: "Kỷ Yếu Sài Gòn", plan: "photographer", plan_cycle: "year", plan_expires_at: "2027-01-15T00:00:00Z", last_active_at: ago(5), active_days: 63, visit_count: 120 }),
];
const albumCounts: Record<string, number> = { o: 24, p1: 186, p2: 52, p3: 4, p4: 17, p5: 1, p7: 73 };
const contractCounts: Record<string, number> = { o: 10, p1: 64, p2: 12, p7: 8 };

/* ── Cấu hình mstudo ───────────────────────────────────────────────────── */
const siteSettings = {
  id: 1,
  site_title: "mstudo — Phần mềm quản lý studio ảnh",
  site_description: "Hợp đồng, báo giá, đặt lịch, album giao khách và tài chính của studio ảnh trong một nơi.",
  favicon_url: null,
  landing_hero_title: "Phần mềm quản lý studio ảnh — toàn diện & đẹp",
  landing_hero_sub: "Hợp đồng, đặt lịch, tài chính, đội ngũ trong một nơi.",
  landing_hero_badge: "Phần mềm quản lý studio ảnh",
  landing_hero_note: "Miễn phí 7 ngày, không cần thẻ",
  feature_flags: { inbox: "live", story: "coming_soon", album: "coming_soon", slide: "live", ui_v2: "beta" },
  price_basic_month: 50_000, price_basic_year: 500_000,
  price_photographer_month: 100_000, price_photographer_year: 999_000,
  price_photographer_plus_month: 129_000, price_photographer_plus_year: 1_249_000,
  price_studio_month: 300_000, price_studio_year: 3_000_000,
  basic_discount_month_percent: 0, basic_discount_year_percent: 0,
  photographer_discount_month_percent: 0, photographer_discount_year_percent: 10,
  photographer_plus_discount_month_percent: 0, photographer_plus_discount_year_percent: 0,
  studio_discount_month_percent: 0, studio_discount_year_percent: 50,
  pay_bank_bin: "970436", pay_bank_account: "0123456789", pay_bank_holder: "NGUYEN VAN A", pay_bank_name: "Vietcombank",
  upgrade_content: null,
} as unknown as SiteSettings;
const feedbacks: Feedback[] = [
  { id: "fb1", name: "Nguyễn Hữu Tài", email: "tai.studio@gmail.com", message: "Cho mình hỏi gói Studio có xuất hoá đơn VAT không ạ? Studio mình cần cho kế toán.", handled: false, created_at: ago(0) },
  { id: "fb2", name: "Hoà Bình Wedding", email: null, message: "App rất tiện, mong có thêm mẫu hợp đồng chụp kỷ yếu.", handled: false, created_at: ago(2) },
  { id: "fb3", name: "Lê Thảo", email: "thao.le@yahoo.com", message: "Đã nhận được hướng dẫn, cảm ơn team!", handled: true, created_at: ago(9) },
];

export const SCREENS_TAIKHOAN: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  "v2-tai-khoan": {
    title: "Giao diện mới — Tài khoản & bảo mật (đã bật 2 lớp)",
    render: () => (
      <PreviewV2 path="/dashboard/account">
        <AccountV2 {...account} mfaSeed={{ factors: [{ id: "f1", friendly_name: "mstudo 2026-08-14", status: "verified", created_at: ago(72) }] }} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-tai-khoan-moi": {
    title: "Giao diện mới — Tài khoản (Google, chưa có mật khẩu, chưa bật 2 lớp)",
    render: () => (
      <PreviewV2 path="/dashboard/account">
        <AccountV2
          {...account}
          fullName="Nguyễn Thị Lan Phương"
          email="lanphuong.photo@gmail.com"
          plan="free"
          planExpiresAt={null}
          planCycle={null}
          providers={["google"]}
          hasPassword={false}
          studioBrandName={null}
          mfaSeed={{ factors: [] }}
        />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-goi-phan-mem": {
    title: "Giao diện mới — Gói phần mềm (đang dùng Photographer, theo năm)",
    render: () => (
      <PreviewV2 path="/dashboard/upgrade">
        <UpgradeV2
          usage={{ used: 41, limit: 50, pro: true, plan: "photographer", expiresAt: "2026-12-02T00:00:00Z" }}
          seed={{ currentPlan: "photographer", trialUsed: true }}
        />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-goi-phan-mem-free": {
    title: "Giao diện mới — Gói phần mềm (miễn phí, chưa dùng thử)",
    render: () => (
      <PreviewV2 path="/dashboard/upgrade">
        <UpgradeV2 usage={{ used: 5, limit: 5, pro: false, plan: "free", expiresAt: null }} seed={{ currentPlan: "free", trialUsed: false }} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-thanh-toan": {
    title: "Giao diện mới — Thanh toán gói (chờ chuyển khoản)",
    render: () => (
      <PreviewV2 path="/dashboard/upgrade/thanh-toan/a">
        <PaymentView id="a" plan="studio" cycle="year" amount={1_500_000} code="MS-4K7Q" initialStatus="none" initialNote={null} bank={f.bank} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-thanh-toan-cho": {
    title: "Giao diện mới — Thanh toán gói (đã báo chuyển, chờ xác nhận)",
    render: () => (
      <PreviewV2 path="/dashboard/upgrade/thanh-toan/b">
        <PaymentView id="b" plan="basic" cycle="month" amount={50_000} code="MS-7QW2" initialStatus="awaiting_confirm" initialNote={null} bank={f.bank} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-thanh-toan-loi": {
    title: "Giao diện mới — Thanh toán gói (chưa nhận được tiền)",
    render: () => (
      <PreviewV2 path="/dashboard/upgrade/thanh-toan/c">
        <PaymentView id="c" plan="photographer" cycle="month" amount={100_000} code="MS-9XZ3" initialStatus="failed" initialNote="Bên mình chưa thấy tiền về, nhờ anh kiểm tra lại nội dung chuyển khoản." bank={f.bank} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-thanh-toan-xong": {
    title: "Giao diện mới — Thanh toán gói (đã nâng cấp, SePay tự xác nhận)",
    render: () => (
      <PreviewV2 path="/dashboard/upgrade/thanh-toan/d">
        <PaymentView id="d" plan="studio" cycle="month" amount={300_000} code="MS-2AB4" initialStatus="paid" initialNote={null} bank={f.bank} autoConfirm />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-thanh-toan-chua-cau-hinh": {
    title: "Giao diện mới — Thanh toán gói (chưa cấu hình tài khoản nhận)",
    render: () => (
      <PreviewV2 path="/dashboard/upgrade/thanh-toan/e">
        <PaymentView id="e" plan="studio" cycle="month" amount={300_000} code="MS-2AB4" initialStatus="none" initialNote={null} bank={noBank} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-affiliate": {
    title: "Giao diện mới — Affiliate",
    render: () => (
      <PreviewV2 path="/dashboard/affiliate">
        <AffiliateV2 seed={{ code: "MRLEE24", commissions, totalEarned: sum("pending") + sum("paid"), totalPaid: sum("paid"), totalPending: sum("pending") }} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-affiliate-trong": {
    title: "Giao diện mới — Affiliate (chưa có hoa hồng)",
    render: () => (
      <PreviewV2 path="/dashboard/affiliate">
        <AffiliateV2 seed={{ code: "MRLEE24", commissions: [], totalEarned: 0, totalPaid: 0, totalPending: 0 }} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-quan-tri": {
    title: "Giao diện mới — Người dùng & studio (admin)",
    render: () => (
      <PreviewV2 path="/dashboard/admin">
        <AdminPanel profiles={profiles} albumCounts={albumCounts} contractCounts={contractCounts} upgrades={f.upgrades} codes={f.codes} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-quan-tri-affiliate": {
    title: "Giao diện mới — Quản lý Affiliate (admin)",
    render: () => (
      <PreviewV2 path="/dashboard/admin/affiliate">
        <AdminAffiliateV2 seed={{ commissions: adminCommissions, rates: { basic: 10, photographer: 10, photographer_plus: 12, studio: 15 } }} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-cau-hinh": {
    title: "Giao diện mới — Cấu hình mstudo (admin)",
    render: () => (
      <PreviewV2 path="/dashboard/settings">
        <SettingsPanel settings={siteSettings} feedbacks={feedbacks} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-he-thong": {
    title: "Giao diện mới — Cài đặt hệ thống (admin, Drive đã kết nối)",
    render: () => (
      <PreviewV2 path="/dashboard/admin/system">
        <SystemV2 driveSeed={{ configured: true, connected: true, ok: true, error: null, lastUploadError: null }} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-he-thong-loi": {
    title: "Giao diện mới — Cài đặt hệ thống (Drive lỗi)",
    render: () => (
      <PreviewV2 path="/dashboard/admin/system">
        <SystemV2 driveSeed={{ configured: true, connected: true, ok: false, error: "invalid_grant: Token has been expired or revoked.", lastUploadError: "403 storageQuotaExceeded" }} />
      </PreviewV2>
    ),
    bare: true,
  },
};
