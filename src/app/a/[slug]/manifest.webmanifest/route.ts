import { createAdminClient } from "@/lib/supabase/admin";
import { getStudioBrand } from "@/lib/studio-brand";
import { buildClientManifest, manifestResponse } from "@/lib/client-manifest";

export const dynamic = "force-dynamic";

/**
 * Manifest của MỘT album chọn ảnh — `/a/<slug>/manifest.webmanifest`.
 *
 * Khách chọn ảnh gần như 100% trên điện thoại và thường phải quay lại nhiều lần
 * (chọn 300 ảnh không xong trong một lượt). Cài được lên màn hình chính nghĩa là
 * không phải đi tìm lại link trong tin nhắn Zalo.
 */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const db = createAdminClient();
  const { data: album } = await db
    .from("albums")
    .select("title, owner_id, status")
    .eq("slug", params.slug)
    .maybeSingle();

  // Album không tồn tại / chưa xuất bản: vẫn trả manifest hợp lệ (mang thương
  // hiệu mstudo) thay vì 404. Trình duyệt gặp manifest 404 sẽ ghi lỗi vào
  // console của khách, mà bản thân trang cũng đã hiện "album không khả dụng".
  const brand = album?.owner_id ? await getStudioBrand(db, album.owner_id) : { name: "Studio", logoUrl: null };
  const title = (album?.status === "published" && album.title) || "Album ảnh";

  return manifestResponse(
    buildClientManifest({
      id: `/a/${params.slug}`,
      name: title,
      shortName: title,
      description: `Chọn ảnh cho album “${title}” — ${brand.name}.`,
      startUrl: `/a/${params.slug}`,
      logoUrl: brand.logoUrl,
    })
  );
}
