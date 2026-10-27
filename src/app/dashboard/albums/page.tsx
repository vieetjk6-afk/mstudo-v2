import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getProfileById } from "@/lib/auth-guards";
import { effectivePlan, planAllowsDelivery, planAllowsFaceSearch, planAllowsWatermark } from "@/lib/plans";
import { fetchAlbumRows } from "@/lib/album-rows";
import { getPlanUsage } from "@/lib/plan-usage";
import { getStudioHost } from "@/lib/studio-site";
import { doToc } from "@/lib/do-toc";
import AlbumList from "../AlbumList";

// Album library reachable from the studio shell. Lives at its own path so it
// doesn't collide with the bare /dashboard → /dashboard/studio redirect (which
// makes the studio overview the home page on the main host).
export default async function AlbumsPage() {
  // getSessionUser/getProfileById là bản CACHE theo lượt dựng trang: layout đã
  // gọi đúng hai câu này, nên ở đây không tốn thêm round-trip nào.
  const dt = doToc("/dashboard/albums");
  const [supabase, user] = await Promise.all([createClient(), dt.buoc("user", getSessionUser())]);
  const uid = user?.id ?? "";
  const profileP = user ? getProfileById(user.id) : Promise.resolve(null);

  // Mọi thứ còn lại không phụ thuộc nhau — chạy MỘT đợt song song.
  const [rows, profile, studioHost, usage] = await Promise.all([
    dt.buoc("albums", fetchAlbumRows(supabase, uid)),
    dt.buoc("profile", profileP),
    // Domain riêng của studio: link "mở album" phải mang tên miền studio,
    // không phải mstudo.com của bảng điều khiển.
    dt.buoc("site", user ? getStudioHost(supabase, user.id) : Promise.resolve(null)),
    // Dòng "Gói … · đã tạo N album" tính sẵn ở máy chủ — khỏi ba truy vấn nối
    // đuôi trong trình duyệt sau khi trang đã vẽ.
    dt.buoc("usage", user ? getPlanUsage(supabase, user.id, profileP) : Promise.resolve(null)),
  ]);
  dt.xong();

  const plan = profile ? effectivePlan(profile.plan, profile.plan_expires_at) : "free";
  const isAdmin = profile?.role === "admin";
  const showTrial = !isAdmin && (plan === "free" || plan === "basic");
  const trialUsed = !!(profile as { trial_used_at?: string | null } | null)?.trial_used_at;

  return <AlbumList albums={rows} showTrial={showTrial} trialUsed={trialUsed} canDelivery={planAllowsDelivery(plan, isAdmin)} canWatermark={planAllowsWatermark(plan, isAdmin)} canFaceSearch={planAllowsFaceSearch(plan, isAdmin)} studioHost={studioHost} planUsage={usage} />;
}
