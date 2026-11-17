/* Màn xem trước GIAO DIỆN MỚI của "Chụp theo khung giờ": màn quản lý đợt chụp
 * (/dashboard/studio/dot-chup) và trang khách chọn khung (/book/dot/<token>).
 * Dữ liệu giả ở ./dotchup-demo.tsx. Đăng ký trong ../screens.tsx. */
import { DotChupDemo, SlotBookingDemo } from "./dotchup-demo";

export const SCREENS_DOTCHUP: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  "v2-dot-chup": {
    title: "V2 · Chụp theo khung giờ — danh sách đợt (sắp tới trước, đã qua gập lại)",
    render: () => <DotChupDemo />,
    bare: true,
  },
  "v2-dot-chup-chi-tiet": {
    title: "V2 · Chụp theo khung giờ — chi tiết đợt: lưới khung trống / giữ chờ cọc / đã đặt, link + QR",
    render: () => <DotChupDemo open />,
    bare: true,
  },
  "v2-dot-chup-tao": {
    title: "V2 · Chụp theo khung giờ — form tạo đợt",
    render: () => <DotChupDemo create />,
    bare: true,
  },
  "v2-dot-chup-trong": {
    title: "V2 · Chụp theo khung giờ — chưa có đợt nào + chưa chạy migration",
    render: () => <DotChupDemo empty />,
    bare: true,
  },
  "v2-dot-chup-khach": {
    title: "V2 · Khách chọn khung giờ — khung trống / đã có người, form tên + SĐT",
    render: () => <SlotBookingDemo />,
    bare: true,
  },
  "v2-dot-chup-khach-coc": {
    title: "V2 · Khách chọn khung giờ — bước cọc VietQR (đang giữ chỗ)",
    render: () => <SlotBookingDemo step="deposit" />,
    bare: true,
  },
  "v2-dot-chup-khach-xong": {
    title: "V2 · Khách chọn khung giờ — đặt xong",
    render: () => <SlotBookingDemo step="done" />,
    bare: true,
  },
};
