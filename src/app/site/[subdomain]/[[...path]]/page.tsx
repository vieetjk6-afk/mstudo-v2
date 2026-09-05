import { cache } from "react";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSiteBundle, type SiteData } from "@/lib/site-loader";
import SiteRenderer from "@/components/SiteRenderer";
import type { Site } from "@/lib/types";
import { BRAND, getService, tr, type Lang } from "@/lib/vieetjk/content";
import { loadVieetjkData } from "@/lib/vieetjk/data";
import VieetjkChrome from "@/components/vieetjk/VieetjkChrome";
import VieetjkHome from "@/components/vieetjk/VieetjkHome";
import VieetjkService from "@/components/vieetjk/VieetjkService";

export const dynamic = "force-dynamic";

type Params = { subdomain: string; path?: string[] };

/** Ngôn ngữ hiện tại từ cookie (mặc định tiếng Việt). */
function currentLang(): Lang {
  return cookies().get("vjk_lang")?.value === "en" ? "en" : "vi";
}

/** Giao diện hiện tại từ cookie (mặc định tối). */
function currentTheme(): "dark" | "light" {
  return cookies().get("vjk_theme")?.value === "light" ? "light" : "dark";
}

/** Đây có phải trang vieetjk (theo domain/subdomain hoặc template)? */
function isVieetjkKey(key: string): boolean {
  const k = key.toLowerCase();
  return k === BRAND.domain || k === "vieetjk" || k === `www.${BRAND.domain}`;
}

// cache(): generateMetadata VÀ SitePage cùng gọi các hàm này trong một request —
// dedupe để mỗi trang chỉ query bảng `sites` một lần thay vì 3-4 lần.
/**
 * MỘT lượt tra bảng `sites` cho cả trang — dùng chung cho câu hỏi "có phải mẫu
 * vieetjk không" và cho việc nạp dữ liệu tenant.
 *
 * Trước đây hai câu hỏi đó là hai hàm `cache()` riêng, mỗi hàm tự query bảng
 * `sites`. Vì `siteHasVieetjkTemplate` luôn chạy TRƯỚC `loadTenant` (cả ở
 * generateMetadata lẫn ở component), một lượt xem trang portfolio phải chờ hai
 * vòng mạng nối tiếp tới Supabase trước khi bắt đầu nạp nội dung — trong khi cả
 * hai đọc đúng một dòng. Gộp lại: dòng `sites` lấy một lần, cả hai bên đọc từ
 * đó, tiết kiệm trọn một vòng chờ trên MỌI lượt xem trang công khai của studio.
 */
type SiteMatch = { site: Site; via: "custom_domain" | "subdomain" };

const loadSiteRow = cache(async (key: string): Promise<SiteMatch | null> => {
  const db = createAdminClient();
  const k = key.toLowerCase();
  if (k.includes(".")) {
    const { data } = await db.from("sites").select("*").eq("custom_domain", k).maybeSingle();
    if (data) return { site: data as Site, via: "custom_domain" };
  }
  const { data } = await db.from("sites").select("*").eq("subdomain", k).maybeSingle();
  return data ? { site: data as Site, via: "subdomain" } : null;
});

const siteHasVieetjkTemplate = async (key: string): Promise<boolean> =>
  (await loadSiteRow(key))?.site.template === "vieetjk";

const loadTenant = cache(async (key: string): Promise<SiteData | null> => {
  const match = await loadSiteRow(key);
  if (!match) return null;
  // Tên miền riêng phải ĐÃ XÁC MINH mới được phục vụ site — nếu không, bất kỳ ai
  // trỏ DNS về mstudo rồi khai bừa domain đó đều dựng được site của studio khác
  // dưới tên miền của mình.
  if (match.via === "custom_domain" && !match.site.custom_domain_verified) return null;
  if (!match.site.published) return null;
  return loadSiteBundle(createAdminClient(), match.site, true);
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const key = params.subdomain;
  if (isVieetjkKey(key) || (await siteHasVieetjkTemplate(key))) {
    const lang = currentLang();
    const svc = params.path?.length ? getService(params.path[0]) : null;
    const title = svc ? `${tr(lang, svc.title)} · ${BRAND.name}` : `${BRAND.name} — ${tr(lang, BRAND.tagline)}`;
    const description = svc ? tr(lang, svc.intro) : tr(lang, BRAND.heroSub);
    return { title, description, openGraph: { title, description, type: "website" } };
  }
  const data = await loadTenant(key);
  if (!data) return { title: "Không tìm thấy trang" };
  const name = data.owner?.full_name || data.site.subdomain || "Portfolio";
  const title = data.site.seo?.title || name;
  const description = data.site.seo?.description || `Portfolio của ${name}`;
  // Ảnh chia sẻ: ảnh studio tự đặt → ảnh bìa của khối hero → không có.
  const heroImage = data.blocks.find((b) => b.type === "hero" && typeof b.config?.image === "string" && b.config.image)?.config
    ?.image as string | undefined;
  const image = data.site.seo?.og_image || heroImage;
  const canonical = `https://${data.site.custom_domain_verified && data.site.custom_domain ? data.site.custom_domain : key}`;
  const logo = (data.site.theme || {}).logo;
  return {
    title,
    description,
    alternates: { canonical },
    // Trang chỉ tồn tại khi đã xuất bản (loadTenant trả null nếu chưa), nên cho
    // Google lập chỉ mục bình thường.
    robots: { index: true, follow: true },
    icons: logo ? { icon: logo } : undefined,
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      siteName: name,
      locale: "vi_VN",
      images: image ? [image] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

export default async function SitePage({ params }: { params: Params }) {
  const key = params.subdomain;
  const path = params.path ?? [];

  // ── Trang riêng của vieetjk (thiết kế code tay, không dùng builder) ──────
  const vieetjk = isVieetjkKey(key) || (await siteHasVieetjkTemplate(key));
  if (vieetjk) {
    const lang = currentLang();
    const theme = currentTheme();
    const data = await loadVieetjkData();

    if (path.length === 0) {
      return (
        <VieetjkChrome bookingToken={data.bookingToken} logoUrl={data.logoUrl} active="" lang={lang} theme={theme}>
          <VieetjkHome data={data} lang={lang} />
        </VieetjkChrome>
      );
    }
    const svc = getService(path[0]);
    if (svc && path.length === 1) {
      return (
        <VieetjkChrome bookingToken={data.bookingToken} logoUrl={data.logoUrl} active={svc.slug} lang={lang} theme={theme}>
          <VieetjkService service={svc} data={data} lang={lang} />
        </VieetjkChrome>
      );
    }
    notFound();
  }

  // ── Tenant site thông thường (builder → SiteRenderer). ──────────────────
  if (path.length > 0) notFound(); // các site builder chỉ có 1 trang gốc
  const data = await loadTenant(key);
  if (!data) notFound();
  return <SiteRenderer data={data} />;
}
