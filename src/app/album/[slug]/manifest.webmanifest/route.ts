import { createAdminClient } from "@/lib/supabase/admin";
import { getStudioBrand } from "@/lib/studio-brand";
import { buildClientManifest, manifestResponse } from "@/lib/client-manifest";

export const dynamic = "force-dynamic";

/**
 * Manifest của MỘT album đã giao khách — `/album/<slug>/manifest.webmanifest`.
 *
 * Cùng `id` với album chọn ảnh của chính nó là CỐ Ý: một dự án chỉ có một app
 * trên màn hình khách, và khi studio bấm "Giao khách" thì icon đã cài mở ra
 * trang ảnh hoàn thiện chứ không phải một icon thứ hai. Đường dẫn `/a/<slug>` tự
 * chuyển sang `/album/<slug>` ở giai đoạn giao khách (xem a/[slug]/page.tsx).
 */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const db = createAdminClient();
  const { data: album } = await db
    .from("albums")
    .select("title, owner_id, status")
    .eq("slug", params.slug)
    .maybeSingle();

  const brand = album?.owner_id ? await getStudioBrand(db, album.owner_id) : { name: "Studio", logoUrl: null };
  const title = (album?.status === "published" && album.title) || "Album ảnh";

  return manifestResponse(
    buildClientManifest({
      id: `/a/${params.slug}`,
      name: title,
      shortName: title,
      description: `Album ảnh “${title}” — ${brand.name}.`,
      startUrl: `/album/${params.slug}`,
      logoUrl: brand.logoUrl,
      // Trang giao khách là nền tối (xem GalleryView) — thanh trạng thái phải
      // theo, nếu không app mở ra có một vạch sáng ở đỉnh.
      themeColor: "#0f0f10",
      backgroundColor: "#0f0f10",
    })
  );
}
