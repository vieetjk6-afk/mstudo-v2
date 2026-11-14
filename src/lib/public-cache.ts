import "server-only";
import { revalidateTag } from "next/cache";

/* ═══════════════════════════════════════════════════════════════════════════
   Thẻ (tag) của dữ liệu trang CÔNG KHAI được nhớ giữa các request — website
   studio, thiệp cưới. Gom một chỗ để nơi nhớ và nơi bỏ nhớ không lệch tên.
   (Album khách có module riêng: @/lib/album-data-cache.)
   ═══════════════════════════════════════════════════════════════════════════ */

/** Website studio theo khoá host (tên miền phụ hoặc tên miền riêng, chữ thường). */
export const siteHostTag = (key: string) => `site-host:${key.trim().toLowerCase()}`;

/** Bảng giá gói trên trang chủ mstudo (site_settings). */
export const LANDING_PRICING_TAG = "landing-pricing";

/** Lời chúc + link Love Story của một thiệp. */
export const thiepExtrasTag = (invitationId: string) => `thiep-extras:${invitationId}`;

/**
 * Bỏ ngay dữ liệu đã nhớ (lượt mở kế tiếp đọc mới, không phục vụ bản cũ).
 * Ngoài ngữ cảnh request (script, test) thì bỏ qua — TTL vẫn lo.
 */
export function dropCache(...tags: string[]): void {
  for (const t of tags) {
    try {
      revalidateTag(t, { expire: 0 });
    } catch {
      /* không có request */
    }
  }
}

/** Mọi khoá host mà một website có thể được mở theo (tên miền phụ + tên miền riêng). */
export function siteHostTags(site: { subdomain?: string | null; custom_domain?: string | null }): string[] {
  return [site.subdomain, site.custom_domain].filter((k): k is string => !!k && !!k.trim()).map(siteHostTag);
}
