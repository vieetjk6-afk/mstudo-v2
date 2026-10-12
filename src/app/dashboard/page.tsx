import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getProfileById } from "@/lib/auth-guards";
import { getPlanUsage } from "@/lib/plan-usage";
import { effectivePlan, planAllowsDelivery, planAllowsFaceSearch, planAllowsWatermark } from "@/lib/plans";
import { fetchAlbumRows } from "@/lib/album-rows";
import { getStudioHost } from "@/lib/studio-site";
import AlbumList from "./AlbumList";

export default async function DashboardPage() {
  // Bản CACHE theo lượt dựng trang — layout đã gọi đúng hai câu này rồi.
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);
  const profileP = user ? getProfileById(user.id) : Promise.resolve(null);

  const [rows, profile, studioHost, usage] = await Promise.all([
    fetchAlbumRows(supabase, user?.id ?? "", { excludeGalleries: true }),
    profileP,
    // Domain riêng của studio: link "mở album" phải mang tên miền studio,
    // không phải mstudo.com của bảng điều khiển.
    user ? getStudioHost(supabase, user.id) : Promise.resolve(null),
    user ? getPlanUsage(supabase, user.id, profileP) : Promise.resolve(null),
  ]);

  const plan = profile ? effectivePlan(profile.plan, profile.plan_expires_at) : "free";
  const isAdmin = profile?.role === "admin";
  // Show trial button for free/basic plans (photographer has it on studio page)
  const showTrial = !isAdmin && (plan === "free" || plan === "basic");
  const trialUsed = !!(profile as { trial_used_at?: string | null } | null)?.trial_used_at;

  return <AlbumList albums={rows} showTrial={showTrial} trialUsed={trialUsed} canDelivery={planAllowsDelivery(plan, isAdmin)} canWatermark={planAllowsWatermark(plan, isAdmin)} canFaceSearch={planAllowsFaceSearch(plan, isAdmin)} studioHost={studioHost} planUsage={usage} />;
}
