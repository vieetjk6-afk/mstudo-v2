import "server-only";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAlbumOwner } from "@/lib/album-owner";

/**
 * Display name of the studio that owns an album — used to personalise the share
 * title. Prefers the owner's own profile name so a shared album shows the
 * creator's studio, not whichever account happens to power the global site.
 * Falls back to the global site title only when the owner has no name set.
 */
export async function albumOwnerName(ownerId?: string | null): Promise<string> {
  try {
    if (ownerId) {
      // Dùng chung dòng profiles đã cache theo request (xem @/lib/album-owner):
      // page cũng đọc đúng dòng này, không tốn thêm round-trip nào.
      const name = (await getAlbumOwner(ownerId)).profile?.full_name?.trim();
      if (name) return name;
    }
    const { data: site } = await createAdminClient()
      .from("site_settings")
      .select("site_title, profile_name")
      .eq("id", 1)
      .maybeSingle();
    return site?.site_title || site?.profile_name || "mstudo";
  } catch {
    return "mstudo";
  }
}

/**
 * Build share-friendly metadata (Open Graph + Twitter card) for a public album
 * or gallery. The card title is personalised with the studio name and the
 * thumbnail uses the album cover so links look good on Messenger / Zalo / FB.
 *
 * `host` is the public host the page is served from (e.g. album.mstudo.com),
 * used to make the cover URL absolute so crawlers can fetch it.
 */
export async function buildAlbumMetadata({
  title,
  description,
  coverUrl,
  host,
  path,
  ownerId,
}: {
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  host: string;
  path: string;
  ownerId?: string | null;
}): Promise<Metadata> {
  // Tên studio và logo lấy song song; cả hai cùng dựa trên getAlbumOwner đã
  // cache nên thực tế chỉ một lượt đọc profiles cho cả metadata lẫn page.
  const [studio, owner] = await Promise.all([albumOwnerName(ownerId), getAlbumOwner(ownerId)]);
  const fullTitle = `${title} · ${studio}`;

  // Studio's own logo as the browser-tab favicon (white-label).
  // brand.logoUrl = studio_logo_url || pl_logo_url — đúng luật favicon cũ.
  const logoUrl: string | null = ownerId ? owner.brand.logoUrl : null;
  const desc =
    description?.trim() ||
    `Album ảnh từ ${studio}. Xem, chọn và tải những khung hình bạn yêu thích.`;

  const base = host ? `https://${host}` : "";
  const images = coverUrl
    ? [{ url: coverUrl.startsWith("http") ? coverUrl : `${base}${coverUrl}`, alt: title }]
    : undefined;
  const pageUrl = base ? `${base}${path}` : undefined;

  return {
    title: fullTitle,
    description: desc,
    ...(logoUrl ? { icons: { icon: logoUrl, shortcut: logoUrl, apple: logoUrl } } : {}),
    openGraph: {
      type: "website",
      title: fullTitle,
      description: desc,
      siteName: studio,
      ...(pageUrl ? { url: pageUrl } : {}),
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: fullTitle,
      description: desc,
      ...(images ? { images: images.map((i) => i.url) } : {}),
    },
  };
}
