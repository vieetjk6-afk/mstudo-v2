import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { getStudioBrand } from "@/lib/studio-brand";
import { studioShareMetadata } from "@/lib/studio-share-meta";
import ShowcaseAlbum from "./ShowcaseAlbum";
import ShowcaseAlbumV2 from "./ShowcaseAlbumV2";
import { customerUiV2 } from "@/lib/ui-server";

// Trang showcase công khai chỉ đổi khi studio publish lại → ISR + CDN cache 5'
// thay vì SSR mọi lượt khách xem (giảm origin transfer, nhanh hơn).
export const revalidate = 300;
// force-static: client Supabase admin gọi fetch với cache "no-store" (xem
// @/lib/no-store-fetch) — một fetch no-store trong lúc render là Next đánh dấu
// cả trang dynamic, nên `revalidate` ở trên KHÔNG có tác dụng: mọi lượt xem đều
// chạy hàm. force-static giữ trang là ISR (dữ liệu vẫn đọc mới mỗi lần dựng lại,
// tức tối đa 5'). An toàn vì trang không đọc cookies/headers/searchParams.
export const dynamic = "force-static";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const { data } = await createAdminClient()
    .from("albums")
    .select("title, description, cover_url, owner_id")
    .eq("slug", params.slug)
    .maybeSingle();
  return studioShareMetadata({
    ownerId: data?.owner_id,
    title: data?.title || "Album",
    description: data?.description,
    path: `/showcase/${params.slug}`,
    image: data?.cover_url,
  });
}

export default async function ShowcasePage(
  props: {
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;
  const db = createAdminClient();

  const { data: album } = await db
    .from("albums")
    .select("id, owner_id, slug, title, kind, description, status, is_showcase")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!album || album.status !== "published" || !album.is_showcase) {
    notFound();
  }

  const { data: photos } = await db
    .from("photos")
    .select("id, drive_file_id, name, position")
    .eq("album_id", album.id)
    .order("position");

  const View = (await customerUiV2(album.owner_id as string | null)) ? ShowcaseAlbumV2 : ShowcaseAlbum;

  return (
    <View
      brand={album.owner_id ? await getStudioBrand(db, album.owner_id).catch(() => null) : null}
      title={album.title}
      kind={(album.kind as string | null) ?? "Album"}
      description={album.description as string | null}
      photos={(photos ?? []).map((p) => ({ id: p.id, fileId: p.drive_file_id, name: p.name }))}
    />
  );
}
