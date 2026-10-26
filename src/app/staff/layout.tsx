import type { Metadata } from "next";
import { redirect } from "next/navigation";
import StaffFrame from "./StaffFrame";
import { needsMfa } from "@/lib/auth-guards";
import { isUiV2 } from "@/lib/ui-server";

export const metadata: Metadata = {
  title: "Cổng nhân viên",
  description: "Lịch trong ngày, hàng đợi hậu kỳ và thông báo của nhân viên studio.",
  robots: { index: false, follow: false },
};

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  if (await needsMfa()) redirect("/login/mfa?next=/staff");
  // Giao diện mới tự dựng khung của nó (CustomerRootV2 + thanh tab đáy) trong
  // StaffPortalV2, nên không bọc StaffFrame (khung + lề của bản cũ).
  if (await isUiV2()) return <>{children}</>;
  return <StaffFrame>{children}</StaffFrame>;
}
