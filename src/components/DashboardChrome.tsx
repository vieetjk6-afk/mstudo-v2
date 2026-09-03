"use client";

import { usePathname } from "next/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import StudioFooterNav from "@/components/StudioFooterNav";
import StudioShell from "@/components/StudioShell";
import type { Profile } from "@/lib/types";
import { isStudioPath } from "@/lib/studio-shell-paths";

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
  branchLocked = false,
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
  /** Phạm vi bị vai trò ghim — ô chọn hiện dạng khoá. */
  branchLocked?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Luật "đường dẫn nào dùng shell studio" nằm ở @/lib/studio-shell-paths, dùng
  // chung với <NavProgress/> — hai chỗ cùng một câu trả lời thì thanh tiến độ ở
  // đỉnh trang mới mang đúng màu của khu đang mở.
  const isStudio = isStudioPath(pathname, tier);

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
        branchLocked={branchLocked}
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
