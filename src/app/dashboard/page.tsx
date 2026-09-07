import { createClient } from "@/lib/supabase/server";
import { effectivePlan, planAllowsDelivery, planAllowsFaceSearch, planAllowsWatermark } from "@/lib/plans";
import { fetchAlbumRows } from "@/lib/album-rows";
import { getStudioHost } from "@/lib/studio-site";
import AlbumList from "./AlbumList";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [rows, { data: profile }, studioHost] = await Promise.all([
    fetchAlbumRows(supabase, user?.id ?? "", { excludeGalleries: true }),
    user ? supabase.from("profiles").select("plan, plan_expires_at, role, trial_used_at").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    // Domain riêng của studio: link "mở album" phải mang tên miền studio,
    // không phải mstudo.com của bảng điều khiển.
    user ? getStudioHost(supabase, user.id) : Promise.resolve(null),
  ]);

  const plan = profile ? effectivePlan(profile.plan, profile.plan_expires_at) : "free";
  const isAdmin = profile?.role === "admin";
  // Show trial button for free/basic plans (photographer has it on studio page)
  const showTrial = !isAdmin && (plan === "free" || plan === "basic");
  const trialUsed = !!(profile as { trial_used_at?: string | null } | null)?.trial_used_at;

  return <AlbumList albums={rows} showTrial={showTrial} trialUsed={trialUsed} canDelivery={planAllowsDelivery(plan, isAdmin)} canWatermark={planAllowsWatermark(plan, isAdmin)} canFaceSearch={planAllowsFaceSearch(plan, isAdmin)} studioHost={studioHost} />;
}
