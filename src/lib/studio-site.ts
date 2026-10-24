import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAIN_HOST, studioUrl } from "@/lib/hosts";

/**
 * The studio's own customer-facing host, or null. Prefers a verified custom
 * domain (studio.com), then the site subdomain (<sub>.mstudo.com). Only returns
 * a host when the site is PUBLISHED — so customer links stay on mstudo.com until
 * the studio launches its own website, then switch to its own domain.
 */
export async function getStudioHost(db: SupabaseClient, ownerId: string): Promise<string | null> {
  // Full select (incl. the newer custom_domain_verified). If that column hasn't
  // been migrated yet the query errors → fall back to safe columns so the
  // subdomain feature keeps working.
  type SiteRow = { subdomain?: string | null; custom_domain?: string | null; custom_domain_verified?: boolean; published?: boolean };
  let row: SiteRow | null = null;
  const full = await db.from("sites").select("subdomain, custom_domain, custom_domain_verified, published").eq("owner_id", ownerId).maybeSingle();
  if (full.error) {
    const safe = await db.from("sites").select("subdomain, published").eq("owner_id", ownerId).maybeSingle();
    row = (safe.data as SiteRow) ?? null;
  } else {
    row = (full.data as SiteRow) ?? null;
  }
  if (!row?.published) return null;
  if (row.custom_domain && row.custom_domain_verified) return row.custom_domain;
  if (row.subdomain && MAIN_HOST) return `${row.subdomain}.${MAIN_HOST}`;
  return null;
}

/**
 * Dựng link GỬI KHÁCH theo tên miền của studio sở hữu (tên miền riêng → tên
 * miền phụ → host chính khi studio chưa có website). Nhớ host theo owner nên
 * một lượt cron / một route quét nhiều hợp đồng của cùng studio chỉ tra DB một
 * lần. Mọi link tới khách (email, Zalo, thông báo) đi qua đây để không còn chỗ
 * nào lỡ dựng thẳng mstudo.com khi studio đã có domain riêng.
 */
export function studioLinker(db: SupabaseClient): (ownerId: string, path: string) => Promise<string> {
  const hosts = new Map<string, Promise<string | null>>();
  return async (ownerId, path) => {
    if (!hosts.has(ownerId)) hosts.set(ownerId, getStudioHost(db, ownerId).catch(() => null));
    return studioUrl(await hosts.get(ownerId)!, path);
  };
}

/** Link gửi khách cho MỘT studio — tiện cho route chỉ dựng một link. */
export async function studioLink(db: SupabaseClient, ownerId: string, path: string): Promise<string> {
  return studioLinker(db)(ownerId, path);
}
