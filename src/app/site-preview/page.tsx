import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSiteBundle } from "@/lib/site-loader";
import { SITE_TEMPLATES } from "@/lib/site-templates";
import SiteRenderer from "@/components/SiteRenderer";
import type { Site, SiteBlock } from "@/lib/types";

export const dynamic = "force-dynamic";

// Owner-only live preview (full-bleed). With ?template=<key> it previews that
// template as a finished page (without saving), for the template picker.
export default async function SitePreviewPage(props: { searchParams?: Promise<{ template?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Cần đăng nhập để xem trước.</div>;

  const { data: site } = await supabase.from("sites").select("*").eq("owner_id", user.id).maybeSingle();
  if (!site) return <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Chưa có trang để xem trước.</div>;

  const db = createAdminClient();
  const data = await loadSiteBundle(db, site as Site, true);

  // Template preview: swap in the template's theme + blocks (not persisted).
  const tplKey = searchParams?.template;
  if (tplKey) {
    const tpl = SITE_TEMPLATES.find((t) => t.key === tplKey);
    if (tpl) {
      data.site = { ...data.site, theme: tpl.theme };
      data.blocks = tpl.blocks.map((b, i) => ({
        id: `tpl-${i}`,
        site_id: data.site.id,
        type: b.type,
        position: i,
        visible: true,
        config: b.config,
        created_at: "",
      })) as SiteBlock[];
    }
  }

  return <SiteRenderer data={data} demo />;
}
