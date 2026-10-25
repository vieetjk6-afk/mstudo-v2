/* Màn xem trước GIAO DIỆN MỚI của nhóm "taikhoan" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Bọc màn trong
 * <PreviewV2 path="/dashboard/..."> (xem ./shell.tsx). */
export const SCREENS_TAIKHOAN: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {};
