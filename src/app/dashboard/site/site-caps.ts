import { effectivePlan, planAllowsCustomDomain, type Plan } from "@/lib/plans";

/**
 * Quyền của studio với website: được xuất bản không, được dùng tên miền riêng
 * không. Dùng chung cho trình dựng (/dashboard/site/builder) và màn tổng quan
 * Website ở giao diện mới — một chỗ quyết định, hai màn không thể lệch nhau.
 */
export function siteCaps(profile: { plan?: string | null; plan_expires_at?: string | null; role?: string | null } | null) {
  const plan = profile ? effectivePlan(profile.plan as Plan | null, profile.plan_expires_at) : "free";
  const isAdmin = profile?.role === "admin";
  const canPublish = isAdmin || plan === "photographer" || plan === "photographer_plus" || plan === "studio";
  // Tên miền riêng: Photographer Plus & Studio.
  const canCustomDomain = planAllowsCustomDomain(plan, isAdmin);
  return { canPublish, canCustomDomain };
}
