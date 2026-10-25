/* Màn xem trước GIAO DIỆN MỚI của nhóm "khthiep" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Trang khách tự bọc
 * <CustomerRootV2>; màn trong khu quản lý bọc <PreviewV2 path="..."> (./shell). */
export const SCREENS_KHTHIEP: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {};
