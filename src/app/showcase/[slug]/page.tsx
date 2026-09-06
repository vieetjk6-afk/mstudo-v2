import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import ShowcaseAlbum from "./ShowcaseAlbum";

// Trang showcase công khai chỉ đổi khi studio publish lại → ISR + CDN cache 5'
// thay vì SSR mọi lượt khách xem (giảm origin transfer, nhanh hơn).
export const revalidate = 300;

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const db = createAdminClient();
  const { data } = await db
    .from("albums")
    .select("title, owner_id")
    .eq("slug", params.slug)
    .maybeSingle();
  let studio = "mstudo";
  if (data?.owner_id) {
    const { data: owner } = await db.from("profiles").select("full_name").eq("id", data.owner_id).maybeSingle();
    studio = (owner?.full_name ?? "").trim() || studio;
  }
  return { title: data?.title ? `${data.title} · ${studio}` : studio };
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
    .select("id, slug, title, kind, description, status, is_showcase")
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

  return (
    <ShowcaseAlbum
      title={album.title}
      kind={(album.kind as string | null) ?? "Album"}
      description={album.description as string | null}
      photos={(photos ?? []).map((p) => ({ id: p.id, fileId: p.drive_file_id, name: p.name }))}
    />
  );
}
