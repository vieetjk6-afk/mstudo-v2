import { createClient } from "@/lib/supabase/server";
import { getStudioHost } from "@/lib/studio-site";
import CreateAlbumFlow, { CreateHero } from "@/components/CreateAlbumFlow";
import CreateAlbumFlowV2 from "@/components/CreateAlbumFlowV2";
import { isUiV2 } from "@/lib/ui-server";

// Server component (trước đây là client dùng useSearchParams): cần đọc domain
// riêng của studio — getStudioHost chạy server-only — để link gửi khách mang
// tên miền studio ngay từ lúc tạo album, thay vì mstudo.com. `phase` đọc thẳng
// từ searchParams nên không cần hook và cũng không cần Suspense.
export default async function CreatePage(
  props: {
    searchParams?: Promise<{ phase?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const mode = searchParams?.phase === "delivery" ? "delivery" : "selection";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const studioHost = user ? await getStudioHost(supabase, user.id) : null;

  // Giao diện mới: các bước đánh số, một nút chính (cùng logic ./useCreateAlbum).
  if (await isUiV2()) return <CreateAlbumFlowV2 mode={mode} studioHost={studioHost} />;

  return (
    <div className="page-in">
      <CreateHero mode={mode} />
      <CreateAlbumFlow mode={mode} studioHost={studioHost} />
    </div>
  );
}
