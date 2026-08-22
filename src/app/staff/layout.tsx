import type { Metadata } from "next";
import StaffFrame from "./StaffFrame";

export const metadata: Metadata = {
  title: "Cổng nhân viên",
  description: "Lịch trong ngày, hàng đợi hậu kỳ và thông báo của nhân viên studio.",
  robots: { index: false, follow: false },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffFrame>{children}</StaffFrame>;
}
