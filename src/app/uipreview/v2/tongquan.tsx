/* Màn xem trước GIAO DIỆN MỚI của nhóm "tongquan" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Bọc màn trong
 * <PreviewV2 path="/dashboard/..."> (xem ./shell.tsx). */
import OverviewV2, { OverviewBookingV2 } from "@/app/dashboard/studio/OverviewV2";
import type { OverviewBookingV2Data, OverviewV2Data } from "@/app/dashboard/studio/OverviewTypes";
import { PreviewV2 } from "./shell";

const TODAY = "2026-10-24";
const bank = { bin: "970436", account: "0123456789", holder: "NGUYEN VAN LEE", name: "Vietcombank" };
const qr = (planId: string, contractId: string, amount: number, note: string) => ({
  kind: "qr" as const, planId, contractId, amount, addInfo: note, amountLabel: `${amount.toLocaleString("vi-VN")}đ`,
});

const full: OverviewV2Data = {
  greeting: "Chào buổi sáng",
  firstName: "Lee",
  today: TODAY,
  vnMonth: 10,
  todayJobs: 3,
  jobsDelta: 1,
  revenueMonth: 186_500_000,
  revDeltaPct: 14,
  contractsCount: 42,
  totalDue: 238_000_000,
  debtsCount: 17,
  overdueDebtsCount: 4,
  tasks: [
    { key: "crew-1", kind: "crew", tone: "red", title: "Cưới Minh Anh & Quốc Bảo chưa có nhân sự", sub: "T2 26/10/2026 · 07:30 · Minh Anh", tag: "Phân công", cta: "Phân công", href: "#" },
    { key: "plan-1", kind: "plan", tone: "red", title: "Quá hạn thu: Pre-wedding Đà Lạt — Hà & Tuấn", sub: "Đợt 2 · 15.000.000đ · hạn 20/10/2026", tag: "Công nợ", cta: "Mở hợp đồng", href: "#", act: qr("p1", "c2", 15_000_000, "HD0231 Dot 2") },
    { key: "late-1", kind: "late", tone: "red", title: "Trễ cam kết giao ảnh: Kỷ yếu 12A1 THPT Chu Văn An", sub: "Cô Hương · hạn 21/10/2026 · quá 3 ngày", tag: "Cam kết", cta: "Giao ngay", href: "#" },
    { key: "proof-1", kind: "proof", tone: "amber", title: "Chờ đối soát: Nguyễn Thu Trang", sub: "Khách đã gửi ảnh chuyển khoản · Đặt cọc · 5.000.000đ · 23/10/2026", tag: "Thanh toán", cta: "Mở hợp đồng", href: "#", act: { kind: "collect", planId: "p9", contractId: "c9", amountLabel: "5.000.000đ" } },
    { key: "bank-pending", kind: "bank", tone: "amber", title: "2 khoản tiền vào chưa rõ của hợp đồng nào", sub: "SePay đã báo tiền về nhưng nội dung không có mã đợt · gán vào đúng đợt hoặc bỏ qua", tag: "Thanh toán", cta: "Xem & gán", href: "#" },
    { key: "sign-1", kind: "sign", tone: "amber", title: "Chụp gia đình nhà anh Phong chưa được ký", sub: "Trần Phong · đã gửi 4 ngày trước", tag: "Hợp đồng", cta: "Mở hợp đồng", href: "#", act: { kind: "messenger", link: null, label: "Nhắc khách", message: "Xin chào…" } },
    { key: "quote-1", kind: "quote", tone: "amber", title: "Báo giá \"Album cưới cao cấp\" khách chưa chốt", sub: "Lê Mai · 32.000.000đ · gửi 3 ngày trước", tag: "Báo giá", cta: "Mở báo giá", href: "#" },
    { key: "edit-1", kind: "edit", tone: "amber", title: "Khách yêu cầu sửa: Cưới Lan & Huy", sub: "Phạm Lan · yêu cầu đang mở", tag: "Yêu cầu sửa", cta: "Xem yêu cầu", href: "#" },
    { key: "reviews-pending", kind: "reviews", tone: "amber", title: "3 đánh giá khách chờ bạn duyệt", sub: "Khách đã viết cảm nhận — duyệt thì mới lên website studio", tag: "Đánh giá", cta: "Duyệt ngay", href: "#" },
    { key: "album-1", kind: "album", tone: "blue", title: "Sinh nhật bé Na đã chụp xong — chưa có album chọn ảnh", sub: "Hoàng Yến · chụp 19/10/2026 · hạn giao 02/11/2026", tag: "Album", cta: "Tạo album", href: "#" },
    { key: "pcrew-1", kind: "pcrew", tone: "blue", title: "Đức Anh chưa phản hồi lời mời", sub: "Quay phim · Cưới Minh Anh & Quốc Bảo · 26/10/2026", tag: "Nhân sự", cta: "Mở hợp đồng", href: "#", act: { kind: "messenger", label: "Nhắc thợ", message: "Chào Đức Anh…" } },
  ],
  dueSoon: [
    { key: "soon-1", kind: "plan-soon", tone: "blue", title: "Cưới Minh Anh & Quốc Bảo", sub: "Thanh toán đợt cuối · 28.000.000đ · hạn 27/10/2026", tag: "Sắp tới hạn", cta: "Mở hợp đồng", href: "#", act: qr("p3", "c1", 28_000_000, "HD0244 Dot cuoi") },
    { key: "soon-2", kind: "plan-soon", tone: "blue", title: "Chụp sản phẩm Bếp Nhà Mây", sub: "Đặt cọc · 4.500.000đ · hạn 30/10/2026", tag: "Sắp tới hạn", cta: "Mở hợp đồng", href: "#", act: qr("p4", "c5", 4_500_000, "HD0250 Dat coc") },
  ],
  schedule: [
    { id: "s1", title: "Pre-wedding phố cổ — Thảo & Nam", client_name: "Thảo Nguyễn", event_date: TODAY, event_time: "06:00", status: "in_progress", location: "Phố cổ Hà Nội", shootLabel: "Chụp ảnh", crewCount: 2 },
    { id: "s2", title: "Chụp profile công ty Mekong", client_name: "Mekong Tech", event_date: TODAY, event_time: "10:30", status: "sent", location: "Studio tầng 2", shootLabel: "Chụp ảnh", crewCount: 1 },
    { id: "s3", title: "Tiệc thôi nôi bé Bin", client_name: "Chị Hạnh", event_date: TODAY, event_time: "17:00", status: "approved", location: "Nhà hàng Sen", shootLabel: "Quay chụp PSC", crewCount: 0 },
    { id: "s4", title: "Cưới Minh Anh & Quốc Bảo", client_name: "Minh Anh", event_date: "2026-10-26", event_time: "07:30", status: "approved", location: "Long Biên", shootLabel: "Quay chụp PSC", crewCount: 0 },
    { id: "s5", title: "Chụp gia đình ngoại cảnh", client_name: "Trần Phong", event_date: "2026-10-26", event_time: "15:00", status: "approved", location: "Công viên Thống Nhất", shootLabel: "Chụp ảnh", crewCount: 1 },
    { id: "s6", title: "Kỷ yếu 12A3", client_name: "Thầy Long", event_date: "2026-10-28", event_time: null, status: "approved", location: null, shootLabel: "Chụp ảnh", crewCount: 3 },
    { id: "s7", title: "Chụp sản phẩm Bếp Nhà Mây", client_name: "Bếp Nhà Mây", event_date: "2026-10-30", event_time: "09:00", status: "approved", location: null, shootLabel: "Chụp ảnh", crewCount: 1 },
    { id: "s8", title: "Cưới Lan & Huy — lễ gia tiên", client_name: "Phạm Lan", event_date: "2026-11-01", event_time: "08:00", status: "approved", location: "Nam Định", shootLabel: "Quay chụp PSC", crewCount: 4 },
    { id: "s9", title: "Concert mùa thu", client_name: "CLB Guitar", event_date: "2026-11-02", event_time: "19:00", status: "approved", location: null, shootLabel: "Quay phim", crewCount: 2 },
  ],
  warns: [
    { key: "day-1", kind: "day", tone: "amber", title: "T2 26/10/2026 có 3 buổi chụp", sub: "Kiểm tra nhân sự và thiết bị trước khi nhận thêm job vào ngày này." },
  ],
  sla: [
    { id: "a1", title: "Kỷ yếu 12A1 THPT Chu Văn An", client_name: "Cô Hương", shootLabel: "Chụp ảnh", delivery_due: "2026-10-21", left: -3 },
    { id: "a2", title: "Cưới Ngọc & Khang", client_name: "Ngọc Trần", shootLabel: "Quay chụp PSC", delivery_due: "2026-10-26", left: 2 },
    { id: "a3", title: "Sinh nhật bé Na", client_name: "Hoàng Yến", shootLabel: "Chụp ảnh", delivery_due: "2026-11-02", left: 9 },
    { id: "a4", title: "Lookbook thu đông — Mây Store", client_name: "Mây Store", shootLabel: "Chụp ảnh", delivery_due: "2026-11-10", left: 17 },
  ],
  slaLate: 1,
  stalled: [
    { id: "t1", title: "Chụp gia đình nhà anh Phong", client_name: "Trần Phong", reason: "Khách chưa ký hợp đồng", days: 12, tone: "amber" },
    { id: "t2", title: "Kỷ yếu 12A1 THPT Chu Văn An", client_name: "Cô Hương", reason: "Trễ hạn giao ảnh", days: 3, tone: "red" },
    { id: "t3", title: "Pre-wedding Đà Lạt — Hà & Tuấn", client_name: "Thu Hà", reason: "Khách chưa chọn ảnh", days: 9, tone: "amber" },
  ],
  stallDays: 7,
  milestones: [
    { key: "m1", contractId: "x1", name: "Vũ Hồng Nhung", label: "Kỷ niệm 1 năm ngày cưới", date: "2026-10-27", inDays: 3, message: "Chúc mừng…" },
    { key: "m2", contractId: "x2", name: "Đỗ Minh Khôi", label: "Bé tròn 1 tuổi", date: "2026-11-05", inDays: 12, message: "Chúc mừng…" },
    { key: "m3", contractId: "x3", name: "Lê Thanh Tâm", label: "Kỷ niệm 5 năm ngày cưới", date: "2026-11-18", inDays: 25, message: "Chúc mừng…" },
  ],
  milestonesTotal: 5,
  revBars: [
    { label: "T5", value: 98_000_000 },
    { label: "T6", value: 142_000_000 },
    { label: "T7", value: 121_000_000 },
    { label: "T8", value: 175_000_000 },
    { label: "T9", value: 163_500_000 },
    { label: "T10", value: 186_500_000 },
  ],
  bank,
  autoEmail: { ownerId: "o", initial: true },
};

const empty: OverviewV2Data = {
  ...full,
  greeting: "Chào buổi tối",
  todayJobs: 0, jobsDelta: 0, revenueMonth: 0, revDeltaPct: null, contractsCount: 0, totalDue: 0, debtsCount: 0, overdueDebtsCount: 0,
  tasks: [], dueSoon: [], schedule: [], warns: [], sla: [], slaLate: 0, stalled: [], milestones: [], milestonesTotal: 0,
  revBars: full.revBars.map((b) => ({ ...b, value: 0 })),
};

const booking: OverviewBookingV2Data = {
  today: TODAY,
  newCount: 2,
  selectingAlbums: 3,
  totalBookings: 24,
  trialUsed: false,
  newBookings: [
    { id: "b1", name: "Nguyễn Thu Trang", phone: "0912 345 678", service: "Chụp pre-wedding", preferred_date: "2026-11-08", package_name: "Gói Ngoại cảnh", package_price: 12_000_000, status: "new", created_at: "2026-10-23" },
    { id: "b2", name: "Trần Đức Minh", phone: "0987 111 222", service: "Chụp gia đình", preferred_date: null, package_name: null, package_price: null, status: "new", created_at: "2026-10-22" },
  ],
  upcoming: [
    { id: "u1", name: "Lê Mai", phone: "0903 222 111", service: "Chụp profile", preferred_date: TODAY, package_name: "Gói Cơ bản", package_price: 2_500_000, status: "handled", created_at: "2026-10-10" },
    { id: "u2", name: "Phạm Hoàng", phone: "0938 555 666", service: "Chụp cưới", preferred_date: "2026-10-26", package_name: "Gói Trọn ngày", package_price: 25_000_000, status: "handled", created_at: "2026-10-01" },
    { id: "u3", name: "Nguyễn Thu Trang", phone: "0912 345 678", service: "Chụp pre-wedding", preferred_date: "2026-11-08", package_name: "Gói Ngoại cảnh", package_price: 12_000_000, status: "new", created_at: "2026-10-23" },
  ],
};

export const SCREENS_TONGQUAN: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  "moi-tongquan": {
    title: "Giao diện mới — Tổng quan studio",
    render: () => (
      <PreviewV2 path="/dashboard/studio">
        <OverviewV2 {...full} />
      </PreviewV2>
    ),
    bare: true,
  },
  "moi-tongquan-trong": {
    title: "Giao diện mới — Tổng quan studio (chưa có việc)",
    render: () => (
      <PreviewV2 path="/dashboard/studio">
        <OverviewV2 {...empty} />
      </PreviewV2>
    ),
    bare: true,
  },
  "moi-tongquan-datlich": {
    title: "Giao diện mới — Tổng quan gói nhiếp ảnh (đặt lịch)",
    render: () => (
      <PreviewV2 path="/dashboard/studio">
        <OverviewBookingV2 {...booking} />
      </PreviewV2>
    ),
    bare: true,
  },
};
