/* Màn xem trước GIAO DIỆN MỚI của nhóm "khachhang" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Bọc màn trong
 * <PreviewV2 path="/dashboard/..."> (xem ./shell.tsx). */
import * as f from "../fixtures";
import { PreviewV2 } from "./shell";
import ClientsView, { type ClientAgg } from "@/app/dashboard/studio/clients/ClientsView";
import ClientDetailV2, { type ClientContractV2 } from "@/app/dashboard/studio/clients/[phone]/ClientDetailV2";
import LeadsView, { type Lead } from "@/app/dashboard/studio/leads/LeadsView";
import BookingsView from "@/app/dashboard/studio/bookings/BookingsView";
import ReviewsView from "@/app/dashboard/studio/reviews/ReviewsView";
import type { StudioBooking, StudioReferral } from "@/lib/types";

/** Ngày/giờ TƯƠNG ĐỐI so với hôm nay, để nhóm "Hôm nay / 7 ngày qua" luôn có hàng. */
const ago = (days: number, hour = 3) => {
  const d = new Date(Date.now() - days * 86_400_000);
  d.setUTCHours(hour, 10, 0, 0);
  return d.toISOString();
};

const clients: ClientAgg[] = [
  ...f.clients,
  { key: "4", name: "Phạm Thu Hà", phone: "0977888999", count: 2, value: 16_000_000, collected: 16_000_000, last: "2026-09-12", source: "google" },
  { key: "5", name: "Công ty TNHH Hạ Vy", phone: "0903111222", count: 4, value: 128_000_000, collected: 96_000_000, last: "2026-10-02", source: "referral" },
  { key: "6", name: "Đỗ Quang Huy", phone: "0966777888", count: 1, value: 34_000_000, collected: 10_000_000, last: "2026-11-08", source: "facebook" },
  { key: "7", name: "Lê Minh Khang", phone: "0933222111", count: 1, value: 6_500_000, collected: 0, last: "2026-10-28", source: "website" },
  { key: "8", name: "Vũ Ngọc Ánh", phone: "0912000333", count: 1, value: 9_000_000, collected: 9_000_000, last: "2025-12-01", source: null },
];

const referrals: StudioReferral[] = [
  { id: "rf1", owner_id: "o", referrer_phone: "0987654321", referrer_name: "Trần Văn B", referred_phone: "0912345678", referred_name: "Nguyễn Thị Lan Phương", booking_id: "b1", contract_id: null, reward_amount: 500_000, status: "pending", note: null, created_at: ago(2), granted_at: null },
  { id: "rf2", owner_id: "o", referrer_phone: "0903111222", referrer_name: "Công ty TNHH Hạ Vy", referred_phone: "0966777888", referred_name: "Đỗ Quang Huy", booking_id: null, contract_id: "c8", reward_amount: 1_000_000, status: "earned", note: null, created_at: ago(9), granted_at: null },
  { id: "rf3", owner_id: "o", referrer_phone: "0977888999", referrer_name: null, referred_phone: "0933222111", referred_name: "Lê Minh Khang", booking_id: null, contract_id: null, reward_amount: 500_000, status: "granted", note: null, created_at: ago(30), granted_at: ago(20) },
  { id: "rf4", owner_id: "o", referrer_phone: "0900111222", referrer_name: "Lê Hoàng Anh Quân", referred_phone: "0944555666", referred_name: null, booking_id: null, contract_id: null, reward_amount: 0, status: "cancelled", note: null, created_at: ago(45), granted_at: null },
];

const leads: Lead[] = [
  { ...f.leads[0], created_at: ago(0, 2) },
  { id: "l3", name: "Anh Tuấn", phone: "0911555777", interest: "Hỏi giá chụp kỷ yếu cho lớp 40 bạn, tháng 12", status: "new", created_at: ago(0, 1), transcript: [{ role: "user", content: "Chụp kỷ yếu lớp 40 bạn giá sao ạ?" }, { role: "assistant", content: "Dạ gói kỷ yếu bên em từ 350k/bạn, gồm áo + makeup ạ. Anh cho em xin số để tư vấn kỹ hơn nhé." }, { role: "user", content: "0911555777 nha em" }] },
  { id: "l4", name: "Chị Mai", phone: "0988123456", interest: "Chụp gia đình cuối tuần", status: "new", created_at: ago(2), transcript: null },
  { ...f.leads[1], created_at: ago(3) },
  { id: "l5", name: "Ngọc Trâm", phone: "0909888777", interest: "Makeup cô dâu + thuê váy ngày 20/12", status: "contacted", created_at: ago(12), transcript: [{ role: "user", content: "Em muốn hỏi makeup cô dâu ạ" }] },
];

const bookings: StudioBooking[] = [
  { ...f.bookings[0], created_at: ago(0) },
  { ...f.bookings[1], created_at: ago(1) },
  { ...f.bookings[0], id: "b3", name: "Đỗ Quang Huy", phone: "0966777888", service: "Phóng sự cưới nhà trai", package_name: "Phóng sự cưới", package_price: 28_000_000, status: "accepted", deposit_status: "confirmed", deposit_amount: 5_000_000, deposit_code: "COC-9PQ2", referrer_phone: null, facebook: "facebook.com/quanghuy", note: null, voucher_code: "KHACHCU10", created_at: ago(4) } as StudioBooking,
  { ...f.bookings[1], id: "b4", name: "Lê Minh Khang", phone: "0933222111", service: "Chụp gia đình", preferred_date: "2026-11-02", status: "handled", created_at: ago(9) },
  { ...f.bookings[1], id: "b5", name: "Hoàng Yến", phone: "0911000222", service: "Chụp sản phẩm", status: "declined", created_at: ago(15) },
];

const detailRows: ClientContractV2[] = [
  { id: "c1", title: "Chụp cưới Đà Lạt + phóng sự ngày cưới", event_date: "2026-11-20", status: "approved", value: 45_000_000, collected: 15_000_000 },
  { id: "c2", title: "Chụp ảnh bầu tại studio", event_date: "2026-06-02", status: "completed", value: 12_000_000, collected: 12_000_000 },
  { id: "c3", title: "Chụp gia đình Tết 2026", event_date: "2026-01-18", status: "completed", value: 25_000_000, collected: 25_000_000 },
  { id: "c4", title: "Quay phóng sự kỷ niệm 1 năm", event_date: "2025-12-10", status: "cancelled", value: 8_000_000, collected: 0 },
];

export const SCREENS_KHACHHANG: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  "v2-khach-hang": {
    title: "Giao diện mới — Khách hàng",
    render: () => (
      <PreviewV2 path="/dashboard/studio/clients">
        <ClientsView clients={clients} studio={f.studio} referrals={{ rows: referrals, bookingUrl: "https://maistudio.vn/book/tk" }} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-khach-hang-trong": {
    title: "Giao diện mới — Khách hàng (chưa có khách)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/clients">
        <ClientsView clients={[]} studio={f.studio} referrals={{ rows: [], bookingUrl: null }} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-khach-chi-tiet": {
    title: "Giao diện mới — Hồ sơ khách",
    render: () => (
      <PreviewV2 path="/dashboard/studio/clients/0912345678">
        <ClientDetailV2 name="Nguyễn Thị Lan Phương" phone="0912345678" email="lanphuong@gmail.com" sourceLabel="Facebook" rows={detailRows} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-yeu-cau-moi": {
    title: "Giao diện mới — Yêu cầu mới (chatbox)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/leads">
        <LeadsView leads={leads} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-yeu-cau-moi-trong": {
    title: "Giao diện mới — Yêu cầu mới (trống)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/leads">
        <LeadsView leads={[]} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-dat-lich": {
    title: "Giao diện mới — Đặt lịch khách",
    render: () => (
      <PreviewV2 path="/dashboard/studio/bookings">
        <BookingsView ownerId="o" token="tk" initial={bookings} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-dat-lich-trong": {
    title: "Giao diện mới — Đặt lịch khách (trống, lỗi mã)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/bookings">
        <BookingsView ownerId="o" token="tk" tokenSaved={false} initial={[]} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-danh-gia": {
    title: "Giao diện mới — Đánh giá khách",
    render: () => (
      <PreviewV2 path="/dashboard/studio/reviews">
        <ReviewsView reviews={f.reviews} awaiting={f.awaitingReviews} studioHost={null} />
      </PreviewV2>
    ),
    bare: true,
  },
};
