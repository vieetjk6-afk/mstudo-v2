import "server-only";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudioBrand, type StudioBrandInfo } from "@/lib/studio-brand";
import { getStudioHost } from "@/lib/studio-site";
import { MAIN_HOST } from "@/lib/hosts";

/**
 * Metadata của một trang GỬI KHÁCH (hợp đồng, báo giá, cổng khách, đặt lịch,
 * bảng giá, form, voucher, love story, album…) — mang thương hiệu của studio sở
 * hữu, không phải của mstudo.
 *
 * Zalo / Messenger / Facebook dựng thẻ xem trước từ og:title, og:description,
 * og:image, og:site_name và og:url. Thiếu cái nào là chúng tự lấy phần mặc định
 * của layout gốc ("mstudo — Phần mềm quản lý studio ảnh"), tên miền mstudo, hoặc
 * không có ảnh. Nên ở đây điền ĐỦ cả bộ:
 *   • site_name / applicationName = tên thương hiệu studio;
 *   • og:url = trang trên domain riêng / tên miền phụ của studio (nếu có);
 *   • ảnh = ảnh riêng của trang (bìa album, ảnh story) → logo studio;
 *   • favicon = logo studio (kể cả khi link vẫn chạy trên host chính).
 */
export async function studioShareMetadata({
  ownerId,
  title,
  description,
  path,
  image,
  noindex,
  appendBrand = true,
}: {
  ownerId: string | null | undefined;
  /** Tiêu đề trang; tên studio được nối sau nếu chưa có trong đó. */
  title: string;
  /** Chuỗi, hoặc hàm nhận tên studio để câu mô tả nhắc đúng thương hiệu. */
  description?: string | null | ((studio: string) => string);
  /** Đường dẫn của trang (vd. `/c/<token>`) để dựng og:url trên domain studio. */
  path: string;
  /** Ảnh riêng của trang (bìa album…) — ưu tiên hơn logo studio. */
  image?: string | null;
  noindex?: boolean;
  /** false → giữ nguyên tiêu đề (trang của cặp đôi), không nối tên studio. */
  appendBrand?: boolean;
}): Promise<Metadata> {
  let brand: StudioBrandInfo = { name: "Studio", logoUrl: null };
  let host: string | null = null;
  if (ownerId) {
    try {
      const db = createAdminClient();
      [brand, host] = await Promise.all([
        getStudioBrand(db, ownerId),
        getStudioHost(db, ownerId).catch(() => null),
      ]);
    } catch {
      /* giữ mặc định trung tính "Studio" — không bao giờ rơi về "mstudo" */
    }
  }
  const desc = typeof description === "function" ? description(brand.name) : description;
  return shareMetadataFor({ brand, host, title, description: desc, path, image, noindex, appendBrand });
}

/** Như studioShareMetadata nhưng với brand/host đã có sẵn (đỡ một lượt query). */
export function shareMetadataFor({
  brand,
  host,
  title,
  description,
  path,
  image,
  noindex,
  appendBrand = true,
}: {
  brand: StudioBrandInfo;
  host: string | null;
  title: string;
  description?: string | null;
  path: string;
  image?: string | null;
  noindex?: boolean;
  appendBrand?: boolean;
}): Metadata {
  const pageHost = host || MAIN_HOST;
  const base = pageHost ? `https://${pageHost}` : "";
  const fullTitle = !appendBrand || title.includes(brand.name) ? title : `${title} · ${brand.name}`;
  const desc = description?.trim() || `${brand.name} gửi bạn đường dẫn này.`;
  const abs = (u: string) => (/^https?:\/\//i.test(u) || !base ? u : `${base}${u.startsWith("/") ? "" : "/"}${u}`);
  const img = image || brand.logoUrl;
  const images = img ? [{ url: abs(img), alt: brand.name }] : undefined;
  const logo = brand.logoUrl ? abs(brand.logoUrl) : null;

  return {
    title: { absolute: fullTitle },
    description: desc,
    applicationName: brand.name,
    ...(base ? { metadataBase: new URL(base), alternates: { canonical: `${base}${path}` } } : {}),
    ...(logo ? { icons: { icon: logo, shortcut: logo, apple: logo } } : {}),
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type: "website",
      title: fullTitle,
      description: desc,
      siteName: brand.name,
      ...(base ? { url: `${base}${path}` } : {}),
      ...(images ? { images } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: fullTitle,
      description: desc,
      ...(images ? { images: images.map((i) => i.url) } : {}),
    },
  };
}
