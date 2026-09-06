import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { isDeliveryPhase } from "@/lib/album-phase";
import { getStudioHost } from "@/lib/studio-site";
import type { AwaitingReviewAlbum, ReviewRow } from "@/lib/types";
import ReviewsView from "./ReviewsView";

export const dynamic = "force-dynamic";

/** Số album "đã giao, chưa ai đánh giá" hiện ra để studio đi xin — quá dài thì
 *  danh sách thành bãi rác, studio không bấm cái nào cả. */
const AWAITING_LIMIT = 12;

export default async function ReviewsPage() {
  const profile = await requireStudio("booking");
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói trả phí</h1>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Xem các gói</a>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // Đánh giá thuộc về studio qua ALBUM của nó — đúng đường mà RLS đang dùng, nên
  // không cần cột owner_id trùng nghĩa trên bảng feedback.
  const [{ data: reviewRows }, { data: albumRows }, studioHost] = await Promise.all([
    supabase
      .from("feedback")
      .select("*, album:albums!inner(id, slug, title, client_name, owner_id)")
      .eq("album.owner_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(300),
    // Album giao khách đã xuất bản — lọc ra cái chưa có đánh giá ở dưới.
    supabase
      .from("albums")
      .select("id, slug, title, client_name, created_at, phase, is_gallery")
      .eq("owner_id", profile.id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(120),
    // Link xin đánh giá phải mang tên miền RIÊNG của studio nếu có — gửi khách
    // một link mstudo.com trong khi studio đang bán thương hiệu mình thì hỏng.
    getStudioHost(supabase, profile.id),
  ]);

  const reviews = (reviewRows ?? []) as ReviewRow[];

  // Album nào ĐÃ có đánh giá thì thôi không giục nữa (kể cả bản chờ duyệt —
  // khách đã viết rồi, giục lần nữa là phiền khách).
  const reviewed = new Set(reviews.map((r) => r.album_id).filter(Boolean) as string[]);
  const awaiting = ((albumRows ?? []) as (AwaitingReviewAlbum & { phase: string | null; is_gallery: boolean | null })[])
    .filter((a) => isDeliveryPhase(a) && !reviewed.has(a.id))
    .slice(0, AWAITING_LIMIT)
    .map(({ id, slug, title, client_name, created_at }) => ({ id, slug, title, client_name, created_at }));

  return <ReviewsView reviews={reviews} awaiting={awaiting} studioHost={studioHost} />;
}
