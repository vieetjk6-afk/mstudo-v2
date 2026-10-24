import "server-only";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAlbumOwner } from "@/lib/album-owner";
import { getStudioHost } from "@/lib/studio-site";
import { shareMetadataFor } from "@/lib/studio-share-meta";

/**
 * Build share-friendly metadata (Open Graph + Twitter card) for a public album
 * or gallery. The card carries the owning studio's brand (name, logo favicon,
 * og:site_name) and the album cover as thumbnail so links look good on
 * Messenger / Zalo / FB. og:url points at the studio's own domain / subdomain
 * when it has one — never back to mstudo.com.
 *
 * Thương hiệu lấy từ getAlbumOwner (cache theo request) — page cũng đọc đúng dòng
 * profiles này, nên metadata không tốn thêm lượt đọc nào.
 */
export async function buildAlbumMetadata({
  title,
  description,
  coverUrl,
  path,
  ownerId,
}: {
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  path: string;
  ownerId?: string | null;
}): Promise<Metadata> {
  const [owner, host] = await Promise.all([
    getAlbumOwner(ownerId),
    ownerId ? getStudioHost(createAdminClient(), ownerId).catch(() => null) : Promise.resolve(null),
  ]);
  const brand = owner.brand;
  return shareMetadataFor({
    brand,
    host,
    title,
    description: description?.trim() || `Album ảnh từ ${brand.name}. Xem, chọn và tải những khung hình bạn yêu thích.`,
    path,
    image: coverUrl,
  });
}
