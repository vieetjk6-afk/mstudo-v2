/* Màn xem trước GIAO DIỆN MỚI của nhóm "khcong" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Trang khách tự bọc
 * <CustomerRootV2>; màn trong khu quản lý bọc <PreviewV2 path="..."> (./shell).
 *
 * Nhóm này: cổng khách /portal/<token> (tổng quan, thanh toán, ảnh & video,
 * album khi hoàn thành), kế hoạch cưới /portal/<token>/ke-hoach và đặt lịch
 * /book/<token>. Dữ liệu giả ở ./khcong-demo.tsx. */
import { BookingV2Demo, PlannerV2Demo, PortalGateV2Demo, PortalV2Demo } from "./khcong-demo";

export const SCREENS_KHCONG: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  /* ── Cổng khách ── */
  "v2-cong-khach": {
    title: "V2 · Cổng khách — tổng quan: thẻ trạng thái (buổi hẹn tới, tiến độ 6 bước, một nút chính), lịch trình, hồ sơ",
    render: () => <PortalV2Demo />,
    bare: true,
  },
  "v2-cong-khach-chua-ky": {
    title: "V2 · Cổng khách — chưa ký hợp đồng (nút chính: Xem & ký), chưa thu đồng nào",
    render: () => <PortalV2Demo variant="unsigned" />,
    bare: true,
  },
  "v2-cong-khach-thanh-toan": {
    title: "V2 · Cổng khách — thanh toán: còn phải trả, các đợt, thông tin chuyển khoản (QR mở hộp thoại)",
    render: () => <PortalV2Demo tab="pay" />,
    bare: true,
  },
  "v2-cong-khach-anh": {
    title: "V2 · Cổng khách — ảnh & video khi đang chờ chọn ảnh",
    render: () => <PortalV2Demo tab="media" />,
    bare: true,
  },
  "v2-cong-khach-album": {
    title: "V2 · Cổng khách — hợp đồng hoàn thành: album (ảnh bìa, lưới ảnh, tải từng ảnh, đánh giá)",
    render: () => <PortalV2Demo variant="completed" />,
    bare: true,
  },
  "v2-cong-khach-album-video": {
    title: "V2 · Cổng khách — album, tab Video (khung phát + danh sách phát)",
    render: () => <PortalV2Demo variant="video" albumTab="videos" />,
    bare: true,
  },
  "v2-cong-khach-album-tai-ve": {
    title: "V2 · Cổng khách — album, tab Tải về",
    render: () => <PortalV2Demo variant="completed" albumTab="files" />,
    bare: true,
  },
  "v2-cong-khach-khoa": {
    title: "V2 · Cổng khách — cổng nhập số điện thoại (báo sai số)",
    render: () => <PortalGateV2Demo error />,
    bare: true,
  },

  /* ── Kế hoạch cưới ── */
  "v2-ke-hoach": {
    title: "V2 · Kế hoạch cưới — tổng quan: bốn con số, Sắp tới, lối tắt",
    render: () => <PlannerV2Demo />,
    bare: true,
  },
  "v2-ke-hoach-viec": {
    title: "V2 · Kế hoạch cưới — việc cần làm theo mốc (lọc người lo, ẩn việc xong, sửa trong ngăn kéo)",
    render: () => <PlannerV2Demo tab="tasks" />,
    bare: true,
  },
  "v2-ke-hoach-ngan-sach": {
    title: "V2 · Kế hoạch cưới — ngân sách vượt mức, ai chi bao nhiêu, bảng khoản chi",
    render: () => <PlannerV2Demo tab="budget" />,
    bare: true,
  },
  "v2-ke-hoach-khach": {
    title: "V2 · Kế hoạch cưới — khách mời (phản hồi qua thiệp, khách ngoài danh sách, tên rất dài)",
    render: () => <PlannerV2Demo tab="guests" />,
    bare: true,
  },
  "v2-ke-hoach-so-do-ban": {
    title: "V2 · Kế hoạch cưới — sơ đồ bàn (bàn vượt sức chứa, khách chưa xếp bàn)",
    render: () => <PlannerV2Demo tab="guests" guestView="tables" />,
    bare: true,
  },
  "v2-ke-hoach-nha-cung-cap": {
    title: "V2 · Kế hoạch cưới — nhà cung cấp theo hạng mục, đã chốt, đưa vào ngân sách",
    render: () => <PlannerV2Demo tab="vendors" />,
    bare: true,
  },
  "v2-ke-hoach-ngay-cuoi": {
    title: "V2 · Kế hoạch cưới — ngày cưới: lịch trình, đội hỗ trợ, đồ cần mang",
    render: () => <PlannerV2Demo tab="day" />,
    bare: true,
  },
  "v2-ke-hoach-phong-cach": {
    title: "V2 · Kế hoạch cưới — ảnh cần chụp, bảng màu, concept, link cảm hứng",
    render: () => <PlannerV2Demo tab="style" />,
    bare: true,
  },
  "v2-ke-hoach-chua-co-ngay": {
    title: "V2 · Kế hoạch cưới — chưa chọn ngày cưới, danh sách trống",
    render: () => <PlannerV2Demo variant="no-date" tab="day" />,
    bare: true,
  },
  "v2-ke-hoach-khoa": {
    title: "V2 · Kế hoạch cưới — chỉ xem (gói studio hết hạn)",
    render: () => <PlannerV2Demo tab="budget" variant="locked" />,
    bare: true,
  },
  "v2-qua-cuoi-khach": {
    title: "V2 · Quà cưới — khách mời: link thiệp từng khách, thiệp chưa xuất bản",
    render: () => <PlannerV2Demo variant="combo" tab="guests" />,
    bare: true,
  },
  "v2-ke-hoach-db-cu": {
    title: "V2 · Kế hoạch cưới — database cũ (chỉ 4 phần gốc)",
    render: () => <PlannerV2Demo variant="old-db" />,
    bare: true,
  },

  /* ── Đặt lịch ── */
  "v2-dat-lich": {
    title: "V2 · Đặt lịch — bước 1: chọn gói (vào từ QR voucher)",
    render: () => <BookingV2Demo />,
    bare: true,
  },
  "v2-dat-lich-thong-tin": {
    title: "V2 · Đặt lịch — bước 3: thông tin liên hệ (người giới thiệu, SĐT voucher)",
    render: () => <BookingV2Demo step={2} />,
    bare: true,
  },
  "v2-dat-lich-xac-nhan": {
    title: "V2 · Đặt lịch — bước 4: xác nhận + tóm tắt + captcha",
    render: () => <BookingV2Demo step={3} voucher="bad" />,
    bare: true,
  },
  "v2-dat-lich-coc": {
    title: "V2 · Đặt lịch — đã gửi, bước cọc giữ ngày (QR + ảnh biên lai)",
    render: () => <BookingV2Demo sent="deposit" voucher="none" />,
    bare: true,
  },
  "v2-dat-lich-da-gui": {
    title: "V2 · Đặt lịch — đã gửi yêu cầu",
    render: () => <BookingV2Demo sent="done" voucher="none" />,
    bare: true,
  },
};
