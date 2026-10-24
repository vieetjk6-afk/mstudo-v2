"use client";

import { usePathname } from "next/navigation";
import DashboardHeader from "@/components/DashboardHeader";
import StudioFooterNav from "@/components/StudioFooterNav";
import StudioShell from "@/components/StudioShell";
import StudioShellV2 from "@/components/v2/StudioShellV2";
import type { AccentKey, UiState } from "@/lib/ui-version";
import type { ChromeProfile } from "@/lib/types";
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
  ui = { eligible: false, active: false },
  accent = "blue",
  children,
}: {
  profile: ChromeProfile;
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
  /** Giao diện mới (thử nghiệm) — xem @/lib/ui-version. */
  ui?: UiState;
  accent?: AccentKey;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Luật "đường dẫn nào dùng shell studio" nằm ở @/lib/studio-shell-paths, dùng
  // chung với <NavProgress/> — hai chỗ cùng một câu trả lời thì thanh tiến độ ở
  // đỉnh trang mới mang đúng màu của khu đang mở.
  const isStudio = isStudioPath(pathname, tier);

  if (isStudio && tier !== "none" && ui.active) {
    return (
      <StudioShellV2
        profile={profile}
        tier={tier}
        role={role}
        comingSoon={comingSoon}
        hiddenNav={hiddenNav}
        branches={branches}
        branchSelected={branchSelected}
        branchCookie={branchCookie}
        branchLocked={branchLocked}
        accent={accent}
      >
        {children}
      </StudioShellV2>
    );
  }

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
        suggestNewUi={ui.eligible}
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
