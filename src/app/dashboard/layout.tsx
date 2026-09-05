import { Suspense } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser, getProfileById } from "@/lib/auth-guards";
import DashboardChrome from "@/components/DashboardChrome";
import NavProgress from "@/components/NavProgress";
import TrialExpiredBanner from "@/components/TrialExpiredBanner";
import AnnouncementPopup from "@/components/AnnouncementPopup";
import ProductTour from "@/components/ProductTour";
import ActivityPing from "@/components/ActivityPing";
import MaintenanceScreen from "@/components/MaintenanceScreen";
import {
  MAINTENANCE_REASON,
  MAINTENANCE_UNTIL,
  MAINTENANCE_UNTIL_LABEL,
  maintenanceActive,
} from "@/lib/maintenance";
import { effectivePlan, planProfilePatch, studioTier } from "@/lib/plans";
import { getFeatureFlags, comingSoonNav, desktopHidden } from "@/lib/feature-flags";
import { BRANCH_COOKIE, getBranchScope } from "@/lib/branches";
import type { Profile } from "@/lib/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) redirect("/login");

  let profile = await getProfileById(user.id);

  // Detect expired trial BEFORE the downgrade resets the plan column.
  const trialJustExpired =
    profile?.role !== "admin" &&
    profile?.plan_cycle === "trial" &&
    profile?.plan !== "free" &&
    effectivePlan(profile?.plan, profile?.plan_expires_at) === "free";
  const expiredTrialPlan = trialJustExpired ? (profile!.plan as string) : null;

  // Auto-downgrade an expired paid plan back to free (resets the synced limits).
  if (profile && profile.role !== "admin" && effectivePlan(profile.plan, profile.plan_expires_at) === "free" && profile.plan !== "free") {
    const patch = { ...planProfilePatch("free"), plan_cycle: null, plan_expires_at: null };
    // Cột plan* là cột nhạy cảm — chỉ service-role được ghi (xem grant ở schema C1).
    await createAdminClient().from("profiles").update(patch).eq("id", user.id);
    profile = { ...profile, ...patch };
  }

  // Authenticated but no profile row (e.g. the account was created before
  // schema.sql ran, so the new-user trigger never created a profile).
  // Don't bounce to /login — that loops. Explain how to fix it.
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="card max-w-lg p-8">
          <h1 className="font-serif text-2xl font-medium">Chưa có hồ sơ cho tài khoản này</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Bạn đã đăng nhập với <b>{user.email}</b> nhưng chưa có hàng trong bảng{" "}
            <code>profiles</code>. Chạy lệnh sau trong Supabase SQL Editor để tạo
            &amp; cấp quyền admin:
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg p-4 text-left text-xs" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
{`insert into public.profiles (id, email, role, is_active, full_name)
select id, email, 'admin', true, 'Admin'
from auth.users where email = '${user.email}'
on conflict (id) do update set role='admin', is_active=true;`}
          </pre>
          <a href="/dashboard" className="btn-ghost mt-5">Tải lại</a>
        </div>
      </div>
    );
  }

  if (!profile.is_active) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="card max-w-md p-8">
          <h1 className="text-lg font-medium text-accent">
            Tài khoản chưa được kích hoạt
          </h1>
          <p className="mt-2 text-sm text-accent-muted">
            Account pending activation. Vui lòng liên hệ quản trị viên để được
            cấp quyền truy cập.
          </p>
        </div>
      </div>
    );
  }

  // Bảo trì khu quản trị: chặn toàn bộ /dashboard tới mốc trong @/lib/maintenance.
  // Admin vẫn vào được để xử lý. Trang chủ và mọi trang khách (site studio,
  // album, thiệp, form, báo giá…) nằm ngoài layout này nên không bị ảnh hưởng.
  if (MAINTENANCE_UNTIL && maintenanceActive() && profile.role !== "admin") {
    return (
      <MaintenanceScreen
        untilIso={MAINTENANCE_UNTIL}
        untilLabel={MAINTENANCE_UNTIL_LABEL}
        reason={MAINTENANCE_REASON}
      />
    );
  }

  // The header shows a focused menu per subdomain: just the compress tool on
  // img.mstudo.com, the studio-management nav on studio.mstudo.com.
  const host = headers().get("host")?.split(":")[0] ?? "";
  const kind: "app" | "img" | "admin" =
    process.env.NEXT_PUBLIC_IMG_HOST && host === process.env.NEXT_PUBLIC_IMG_HOST
      ? "img"
      : process.env.NEXT_PUBLIC_ADMIN_HOST && host === process.env.NEXT_PUBLIC_ADMIN_HOST
      ? "admin"
      : "app";

  // Staff belong to a full Studio account, so they inherit the full tier;
  // otherwise it's derived from the user's own plan (matches DashboardHeader).
  const tier = profile.studio_owner_id
    ? "full"
    : studioTier(effectivePlan(profile.plan, profile.plan_expires_at), profile.role === "admin");
  const showFooter = tier !== "none";
  const actingRole = profile.studio_owner_id
    ? (profile.studio_role ?? "staff")
    : profile.role === "admin" ? "admin" : "owner";

  // Hai truy vấn này KHÔNG phụ thuộc nhau — chạy song song, vì layout dựng lại ở
  // MỌI lần chuyển màn trong khu quản lý nên một round-trip thừa là thừa ở khắp
  // nơi.
  //   • flags: cờ "Sắp ra mắt" + khoá menu với người thường.
  //   • branchScope: chi nhánh đang xem, nạp một lần ở layout rồi đưa xuống
  //     topbar để mỗi màn khỏi tự truy vấn lại chỉ để vẽ ô chọn. Studio chưa
  //     khai chi nhánh (hoặc chưa chạy migration) → enabled = false.
  const owner = profile.studio_owner_id ?? profile.id;
  const [flags, branchScope] = await Promise.all([
    getFeatureFlags(),
    tier === "none"
      ? Promise.resolve({ branches: [], selected: null, enabled: false, locked: false })
      // Ở layout, `profile` là dòng của CHÍNH người đang đăng nhập (không đi qua
      // requireStudio), nên chi nhánh của họ nằm ngay ở studio_branch_id.
      : getBranchScope(owner as string, profile.studio_branch_id as string | null, actingRole),
  ]);
  const comingSoon = comingSoonNav(flags);
  // Chưa xuất bản (ẩn hoàn toàn với non-admin, không hiện cả nhãn "Sắp ra mắt").
  const hiddenNav = desktopHidden(flags) ? ["/dashboard/studio/desktop"] : [];

  return (
    <div className="min-h-screen">
      <Suspense fallback={null}>
        {/* `tier` để thanh tiến độ mang màu của khu đang mở (xanh trong khu
            studio, vàng ngoài đó) — nó nằm NGOÀI .studio-shell nên không tự
            thừa hưởng token màu. Xem @/lib/studio-shell-paths. */}
        <NavProgress tier={tier} />
      </Suspense>
      {expiredTrialPlan && <TrialExpiredBanner expiredPlan={expiredTrialPlan} />}
      <DashboardChrome
        profile={profile as Profile}
        kind={kind}
        tier={tier}
        role={actingRole}
        showFooter={showFooter}
        comingSoon={comingSoon}
        hiddenNav={hiddenNav}
        branches={branchScope.branches.map((b) => ({ id: b.id, name: b.name, code: b.code, active: b.active }))}
        branchSelected={branchScope.selected}
        branchCookie={branchScope.enabled ? BRANCH_COOKIE : undefined}
        branchLocked={branchScope.locked}
      >
        {children}
      </DashboardChrome>
      <AnnouncementPopup />
      <ProductTour />
      {/* Ghi nhận "tài khoản này vừa mở app" — không hiện gì trên màn hình. */}
      <ActivityPing />
    </div>
  );
}
