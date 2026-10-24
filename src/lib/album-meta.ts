import "server-only";
import type { Metadata } from "next";
import { studioShareMetadata } from "@/lib/studio-share-meta";

/**
 * Build share-friendly metadata (Open Graph + Twitter card) for a public album
 * or gallery. The card carries the owning studio's brand (name, logo favicon,
 * og:site_name) and the album cover as thumbnail so links look good on
 * Messenger / Zalo / FB. og:url points at the studio's own domain / subdomain
 * when it has one — never back to mstudo.com.
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
  return studioShareMetadata({
    ownerId,
    title,
    description: (studio) => description?.trim() || `Album ảnh từ ${studio}. Xem, chọn và tải những khung hình bạn yêu thích.`,
    path,
    image: coverUrl,
  });
}
