import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudioBrand, type StudioBrandInfo } from "@/lib/studio-brand";
import { MAIN_HOST, APP_HOST, IMG_HOST, ADMIN_HOST, THIEP_HOST } from "@/lib/hosts";
import { isVieetjkAiHost } from "@/lib/vieetjk-ai/content";

const SYSTEM_HOSTS = new Set([MAIN_HOST, APP_HOST, IMG_HOST, ADMIN_HOST, THIEP_HOST].filter(Boolean));

/**
 * Resolve the studio brand (name + logo) that owns a given request host — a
 * tenant subdomain (<sub>.mstudo.com) or a verified custom domain. Returns null
 * for the platform's own hosts (mstudo.com, app/img/admin/thiep) and localhost /
 * *.vercel.app, so those keep the default mstudo branding.
 *
 * Used to white-label the browser-tab favicon/title on a studio's own domain.
 */
export const getBrandForHost = cache(async (rawHost: string | null | undefined): Promise<StudioBrandInfo | null> => {
  const host = (rawHost || "").split(":")[0].toLowerCase().trim();
  if (!host || SYSTEM_HOSTS.has(host) || host === "localhost" || host.endsWith(".vercel.app") || host.endsWith(".local")) {
    return null;
  }
  // ai.vieetjk.com là trang code tay, không có dòng `sites` — tra DB mỗi lượt xem
  // chỉ tốn một vòng gọi Supabase để nhận về null. Trang tự khai favicon/tiêu đề.
  if (isVieetjkAiHost(host)) return null;

  try {
    const db = createAdminClient();
    let ownerId: string | null = null;

    if (MAIN_HOST && host.endsWith(`.${MAIN_HOST}`)) {
      // Tenant subdomain: <sub>.mstudo.com
      const sub = host.slice(0, host.length - MAIN_HOST.length - 1);
      if (!sub || sub.includes(".")) return null;
      const { data } = await db.from("sites").select("owner_id").eq("subdomain", sub).maybeSingle();
      ownerId = (data as { owner_id?: string } | null)?.owner_id ?? null;
    } else if (host.includes(".")) {
      // Studio's own custom domain (must be verified).
      const { data } = await db.from("sites").select("owner_id").eq("custom_domain", host).eq("custom_domain_verified", true).maybeSingle();
      ownerId = (data as { owner_id?: string } | null)?.owner_id ?? null;
    }

    if (!ownerId) return null;
    return await getStudioBrand(db, ownerId);
  } catch {
    return null;
  }
});
