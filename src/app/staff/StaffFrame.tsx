"use client";

import { useTheme } from "@/lib/theme";

/**
 * Khung của cổng nhân viên. Không có sidebar, không có topbar — nhưng vẫn phải
 * nằm trong `.studio-shell` để lấy TRỌN bộ design token của khu quản lý (màu
 * nhấn, --sf/--bd/--tx, font Be Vietnam Pro, kiểu .input/.btn) thay vì bộ :root
 * của trang chủ. Thêm `.staff-doc` để sau này có chỗ tinh chỉnh riêng cho cổng
 * này mà không đụng vào khu quản trị.
 */
export default function StaffFrame({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <div className="studio-shell staff-doc min-h-screen" data-theme={theme} style={{ background: "var(--bg)", color: "var(--tx)" }}>
      <div className="mx-auto w-full max-w-[1180px] px-[18px] pb-[70px] pt-5">{children}</div>
    </div>
  );
}
