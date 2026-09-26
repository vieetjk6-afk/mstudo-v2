import type { Metadata } from "next";
import { redirect } from "next/navigation";
import StaffFrame from "./StaffFrame";
import { needsMfa } from "@/lib/auth-guards";

export const metadata: Metadata = {
  title: "Cổng nhân viên",
  description: "Lịch trong ngày, hàng đợi hậu kỳ và thông báo của nhân viên studio.",
  robots: { index: false, follow: false },
};

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  if (await needsMfa()) redirect("/login/mfa?next=/staff");
  return <StaffFrame>{children}</StaffFrame>;
}
