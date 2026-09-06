import { createClient } from "@/lib/supabase/server";
import { MAIN_HOST } from "@/lib/hosts";
import { SITE_BLOCK_LABEL, type Site, type SiteBlock, type SiteBlockType } from "@/lib/types";
import WebsiteHub from "./WebsiteHub";

export const dynamic = "force-dynamic";

/**
 * Màn "Website & chatbox" của bản thiết kế: bên trái là tình trạng trang +
 * các khối nội dung đang có, bên phải là trợ lý chatbox. Trình tạo kéo-thả
 * nằm ở /dashboard/site/builder (bấm "Sửa trang").
 */
export default async function WebsitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // middleware redirects unauthenticated users

  const { data: existingSite } = await supabase.from("sites").select("*").eq("owner_id", user.id).maybeSingle();

  let site = existingSite as Site | null;
  if (!site) {
    const { data: created } = await supabase.from("sites").insert({ owner_id: user.id }).select("*").single();
    site = created as Site;
  }

  const since = new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10);
  const [{ data: blocks }, { data: viewRows }, { data: chat }] = await Promise.all([
    supabase.from("site_blocks").select("id, type, position, visible").eq("site_id", site.id).order("position"),
    supabase.from("site_views").select("day, views").eq("site_id", site.id).gte("day", since).order("day"),
    supabase.from("website_chat_config").select("greeting, instructions").eq("owner_id", user.id).maybeSingle(),
  ]);

  const views = (viewRows ?? []) as { day: string; views: number }[];
  const today = new Date().toISOString().slice(0, 10);
  const last7 = new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10);

  const liveUrl = site.custom_domain
    ? `https://${site.custom_domain}`
    : site.subdomain && MAIN_HOST
      ? `https://${site.subdomain}.${MAIN_HOST}`
      : "";

  return (
    <WebsiteHub
      host={site.custom_domain || (site.subdomain && MAIN_HOST ? `${site.subdomain}.${MAIN_HOST}` : "")}
      liveUrl={liveUrl}
      published={!!site.published}
      updatedAt={site.updated_at}
      stats={{
        today: views.find((v) => v.day === today)?.views ?? 0,
        week: views.filter((v) => v.day >= last7).reduce((s, v) => s + v.views, 0),
        month: views.reduce((s, v) => s + v.views, 0),
      }}
      blocks={((blocks ?? []) as Pick<SiteBlock, "id" | "type" | "position" | "visible">[]).map((b) => ({
        id: b.id,
        label: SITE_BLOCK_LABEL[b.type as SiteBlockType] ?? b.type,
        visible: b.visible,
      }))}
      greeting={(chat?.greeting as string | undefined) ?? ""}
      instructions={(chat?.instructions as string | undefined) ?? ""}
    />
  );
}
