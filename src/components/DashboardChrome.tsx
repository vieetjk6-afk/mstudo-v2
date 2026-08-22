"use client";

import { usePathname } from "next/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import StudioFooterNav from "@/components/StudioFooterNav";
import StudioShell from "@/components/StudioShell";
import type { Profile } from "@/lib/types";

type StudioTier = "none" | "booking" | "plus" | "full";

/**
 * Chooses the dashboard chrome per route:
 *  - studio routes (Photographer+/Studio) → the mstudo green sidebar shell
 *  - everything else → the standard top-nav header + centered main
 * Done client-side so we can branch on the current pathname.
 */
export default function DashboardChrome({
  profile,
  kind,
  tier,
  role,
  showFooter,
  comingSoon = [],
  hiddenNav = [],
  branches = [],
  branchSelected = null,
  branchCookie,
  children,
}: {
  profile: Profile;
  kind: "app" | "img" | "admin";
  tier: StudioTier;
  role: string;
  showFooter: boolean;
  comingSoon?: string[];
  hiddenNav?: string[];
  /** Chi nhánh studio — chỉ shell studio dùng (topbar có ô chọn chi nhánh). */
  branches?: { id: string; name: string; code: string | null; active: boolean }[];
  branchSelected?: string | null;
  branchCookie?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Use the studio shell (green sidebar) for all studio workspace paths.
  // Also pull in adjacent pages (site builder, upgrade, settings) when the
  // user has a studio tier so they stay in the same design context.
  const isStudio =
    pathname.startsWith("/dashboard/studio") ||
    pathname.startsWith("/dashboard/albums") ||
    (tier !== "none" && (
      pathname.startsWith("/dashboard/site") ||
      pathname.startsWith("/dashboard/upgrade") ||
      pathname.startsWith("/dashboard/settings") ||
      // Nhóm "Tài khoản" của sidebar mới trỏ sang các trang này — nếu không
      // nhận là màn studio thì bấm một mục trong sidebar lại rơi ra header cũ.
      pathname.startsWith("/dashboard/account") ||
      pathname.startsWith("/dashboard/affiliate") ||
      pathname.startsWith("/dashboard/connections") ||
      pathname.startsWith("/dashboard/admin") ||
      // Bộ công cụ ảnh chạy ngay trong shell studio (không chuyển hướng ra ngoài)
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/albums") ||
      pathname.startsWith("/dashboard/create") ||
      pathname.startsWith("/dashboard/tools") ||
      pathname.startsWith("/dashboard/filter") ||
      pathname.startsWith("/dashboard/compress")
    ));

  if (isStudio && tier !== "none") {
    return (
      <StudioShell
        profile={profile}
        tier={tier}
        role={role}
        comingSoon={comingSoon}
        hiddenNav={hiddenNav}
        branches={branches}
        branchSelected={branchSelected}
        branchCookie={branchCookie}
      >
        {children}
      </StudioShell>
    );
  }

  return (
    <>
      <DashboardHeader profile={profile} kind={kind} />
      {/* overflow-x-clip: xem ghi chú ở StudioShell — chặn tràn ngang làm lệch
          cả trang, dùng `clip` để không phá sticky bên trong. */}
      <main className={`mx-auto max-w-6xl overflow-x-clip px-6 py-8 md:px-10${showFooter ? " pb-24" : ""}`}>
        {children}
      </main>
      {showFooter && <StudioFooterNav tier={tier} role={role} />}
    </>
  );
}
