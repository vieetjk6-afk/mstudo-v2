import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { categoryLabel } from "@/lib/category";
import AlbumCategoriesManager from "./AlbumCategoriesManager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Loại album · mstudo" };

export default async function AlbumCategoriesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/studio/album-categories");

  const { data: albums } = await supabase
    .from("albums")
    .select("category, category_label")
    .eq("owner_id", user.id)
    .not("category", "is", null);

  // Gom theo loại (slug) + đếm số album — bộ phân loại riêng của studio này.
  const map = new Map<string, { slug: string; label: string; count: number }>();
  for (const a of albums ?? []) {
    const slug = ((a.category as string | null) ?? "").trim();
    if (!slug) continue;
    const ex = map.get(slug);
    if (ex) ex.count += 1;
    else map.set(slug, { slug, label: categoryLabel(slug, a.category_label as string | null), count: 1 });
  }
  const cats = [...map.values()].sort((a, b) => b.count - a.count);

  return <AlbumCategoriesManager ownerId={user.id} initial={cats} />;
}
