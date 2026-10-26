import { createAdminClient } from "@/lib/supabase/admin";
import AlbumBrowse, { type GalleryCard } from "./AlbumBrowse";
import AlbumBrowseV2 from "./AlbumBrowseV2";
import { customerUiV2 } from "@/lib/ui-server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Album khách hàng · mstudo" };

export default async function AlbumDirectoryPage() {
  const db = createAdminClient();
  // Public homepage lists ONLY albums the studio explicitly pinned ("Hiện ở
  // trang chủ"). Anything else — old galleries, private client deliveries —
  // stays off the homepage.
  const [{ data }, v2] = await Promise.all([
    db
      .from("albums")
      .select("slug, title, client_name, event_date, category, category_label, cover_url, gallery_pinned")
      .eq("gallery_pinned", true)
      .eq("status", "published")
      .order("event_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    // Thư mục chung nhiều studio, không có chủ riêng → chỉ bật khi giao diện mới
    // là mặc định cho mọi studio (cờ ui_v2 = "default").
    customerUiV2(null),
  ]);

  const Browse = v2 ? AlbumBrowseV2 : AlbumBrowse;
  return <Browse galleries={(data ?? []) as GalleryCard[]} />;
}
