import { Clapperboard } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { getStudioHost } from "@/lib/studio-site";
import { getFeatureFlags, storyComingSoon } from "@/lib/feature-flags";
import StoryListView, { type StoryRow } from "./StoryListView";

export default async function StoryManagePage() {
  const profile = await requireStudio();
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Studio</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>Trang Love Story chỉ dành cho tài khoản gói Studio.</p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Xem gói Studio</a>
        </div>
      </div>
    );
  }

  // "Sắp ra mắt": khoá với studio, admin vẫn vào để hoàn thiện.
  if (storyComingSoon(await getFeatureFlags()) && profile.actingRole !== "admin") {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <Clapperboard size={28} className="mx-auto mb-3" style={{ color: "#d0687a" }} />
          <h1 className="font-serif text-2xl font-medium">Love Story · Sắp ra mắt</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>Tính năng trang chia sẻ khoảnh khắc đang được hoàn thiện. Bọn mình sẽ thông báo khi sẵn sàng — cảm ơn bạn đã chờ nhé!</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data }, studioHost] = await Promise.all([
    supabase.from("story_pages").select("id, slug, edit_token, config, published, contract_id, created_at, story_wishes(count)").eq("owner_id", profile.id).order("created_at", { ascending: false }),
    getStudioHost(supabase, profile.id),
  ]);

  const rows: StoryRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    slug: r.slug as string,
    edit_token: r.edit_token as string,
    published: r.published as boolean,
    config: (r.config ?? {}) as StoryRow["config"],
    contract_id: (r.contract_id ?? null) as string | null,
    wish_count: Array.isArray(r.story_wishes) && r.story_wishes[0] ? (r.story_wishes[0] as { count: number }).count : 0,
  }));

  return <StoryListView rows={rows} ownerId={profile.id} studioHost={studioHost} />;
}
