import { createAdminClient } from "@/lib/supabase/admin";
import { isMainHost, requestHost, tenantSiteForHost } from "@/lib/seo-host";
import { AI_ORIGIN, aiSitemapPaths, isVieetjkAiHost } from "@/lib/vieetjk-ai/content";

export const dynamic = "force-dynamic";

/* sitemap.xml phục vụ THEO HOST:
   • website studio → trang chủ + các album đang ghim ở trang chủ (công khai,
     không đặt mật khẩu);
   • host chính → các trang giới thiệu công khai.
   Chỉ liệt kê thứ Google vào được: link theo token (hợp đồng, báo giá, form) và
   album có mật khẩu KHÔNG bao giờ nằm ở đây. */

type Entry = { loc: string; lastmod?: string | null; priority?: string };

function xml(entries: Entry[]): Response {
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries
      .map((e) => {
        const parts = [`    <loc>${escapeXml(e.loc)}</loc>`];
        if (e.lastmod) parts.push(`    <lastmod>${new Date(e.lastmod).toISOString().slice(0, 10)}</lastmod>`);
        if (e.priority) parts.push(`    <priority>${e.priority}</priority>`);
        return `  <url>\n${parts.join("\n")}\n  </url>`;
      })
      .join("\n") +
    `\n</urlset>\n`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));
}

export async function GET(req: Request) {
  const host = requestHost(req);
  const base = `https://${host}`;

  // ── ai.vieetjk.com — trang chủ + từng trang dịch vụ ──────────────────────
  if (isVieetjkAiHost(host)) {
    return xml(aiSitemapPaths().map(({ path, priority }) => ({ loc: `${AI_ORIGIN}${path}`, priority })));
  }

  // ── Website riêng của studio ──────────────────────────────────────────────
  if (!isMainHost(host)) {
    const { site } = await tenantSiteForHost(host);
    // Không tra được hoặc không có site → sitemap rỗng (vô hại, Google thử lại).
    if (!site) return xml([]);

    const entries: Entry[] = [{ loc: `${base}/`, lastmod: site.updated_at, priority: "1.0" }];

    // Album đang hiện ở trang chủ và KHÔNG đặt mật khẩu → khách vào được.
    try {
      const { data: albums } = await createAdminClient()
        .from("albums")
        .select("slug, updated_at, created_at")
        .eq("owner_id", site.owner_id)
        .eq("status", "published")
        .eq("phase", "delivery")
        .eq("gallery_pinned", true)
        .is("password_hash", null)
        .order("created_at", { ascending: false })
        .limit(200);

      for (const a of (albums ?? []) as { slug: string; updated_at: string | null; created_at: string }[]) {
        entries.push({ loc: `${base}/album/${a.slug}`, lastmod: a.updated_at || a.created_at, priority: "0.7" });
      }
    } catch {
      // Lỗi tra album không được làm mất trang chủ khỏi sitemap.
    }
    return xml(entries);
  }

  // ── Host chính (mstudo.com) — các trang giới thiệu công khai ──────────────
  const staticPaths: [string, string][] = [
    ["/", "1.0"],
    ["/banggia", "0.8"],
    ["/thiep", "0.6"],
    ["/privacy", "0.3"],
    ["/terms", "0.3"],
  ];
  return xml(staticPaths.map(([p, priority]) => ({ loc: `${base}${p}`, priority })));
}
