/* Màn xem trước GIAO DIỆN MỚI của nhóm "noibo" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Trang khách tự bọc
 * <CustomerRootV2>; màn trong khu quản lý bọc <PreviewV2 path="..."> (./shell).
 *
 * Nhóm này: "Trang của tôi" của nhân viên (/staff) và cổng thợ tự do (/crew,
 * /crew/<token>). Cả hai nằm NGOÀI khung studio nên tự dựng khung V2. Dữ liệu
 * giả ở ./noibo-demo.tsx. */
import { CrewV2Demo, StaffSignInV2Demo, StaffV2Demo } from "./noibo-demo";

export const SCREENS_NOIBO: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  /* ── Trang của tôi (nhân viên) ── */
  "v2-nhan-vien": {
    title: "V2 · Trang của tôi (/staff) — lời chào, 4 số liệu, dòng thời gian hôm nay (một nút chính), tuần tới, checklist",
    render: () => <StaffV2Demo />,
    bare: true,
  },
  "v2-nhan-vien-viec": {
    title: "V2 · Trang của tôi — Việc của tôi: hàng đợi hậu kỳ nhóm theo hạn giao (trễ, hôm nay, 7 ngày, chưa hạn, đã giao)",
    render: () => <StaffV2Demo tab="tasks" />,
    bare: true,
  },
  "v2-nhan-vien-trong": {
    title: "V2 · Trang của tôi — ngày trống (không lịch, không việc, không thông báo), nhân viên thường không có nút phạm vi",
    render: () => <StaffV2Demo empty role="staff" />,
    bare: true,
  },
  "v2-nhan-vien-dang-nhap": {
    title: "V2 · Trang của tôi — chưa đăng nhập tài khoản studio",
    render: () => <StaffSignInV2Demo />,
    bare: true,
  },

  /* ── Cổng thợ ── */
  "v2-cong-tho": {
    title: "V2 · Cổng thợ (/crew/<token>) — Việc: số liệu thu nhập, thẻ việc theo nhóm, mỗi thẻ một nút chính",
    render: () => <CrewV2Demo variant="full" />,
    bare: true,
  },
  "v2-cong-tho-dang-lam": {
    title: "V2 · Cổng thợ — đang chấm công: thẻ “Đang làm” với nút Chấm công ra",
    render: () => <CrewV2Demo variant="working" />,
    bare: true,
  },
  "v2-cong-tho-cham-cong": {
    title: "V2 · Cổng thợ — Chấm công: đồng hồ lớn + buổi gần đây",
    render: () => <CrewV2Demo variant="working" tab="clock" />,
    bare: true,
  },
  "v2-cong-tho-lich": {
    title: "V2 · Cổng thợ — Lịch: agenda (studio xếp / tự báo bận), ngày rảnh bằng công tắc, ca công ty",
    render: () => <CrewV2Demo variant="full" tab="schedule" />,
    bare: true,
  },
  "v2-cong-tho-ho-so": {
    title: "V2 · Cổng thợ — Hồ sơ ở từng studio + đồng bộ Google Lịch",
    render: () => <CrewV2Demo variant="full" tab="profile" />,
    bare: true,
  },
  "v2-cong-tho-nhap-so": {
    title: "V2 · Cổng thợ (/crew) — nhập số điện thoại (cổng chung, không gắn studio)",
    render: () => <CrewV2Demo variant="gate" generic />,
    bare: true,
  },
  "v2-cong-tho-dang-ky": {
    title: "V2 · Cổng thợ — link riêng của studio, chưa có trong sổ thợ: form đăng ký",
    render: () => <CrewV2Demo variant="register" />,
    bare: true,
  },
  "v2-cong-tho-trong": {
    title: "V2 · Cổng thợ — chưa có việc, hồ sơ đang chờ studio duyệt",
    render: () => <CrewV2Demo variant="empty" />,
    bare: true,
  },
};
