import { createClient } from "@/lib/supabase/server";
import { effectivePlan, planAllowsCustomDomain } from "@/lib/plans";
import { availableLists } from "@/lib/site-pricing";
import CanvasBuilder, { type AlbumOption, type PriceItem } from "./CanvasBuilder";
import type { Site, SiteBlock } from "@/lib/types";

export const dynamic = "force-dynamic";

// Trình tạo website kéo-thả (canvas + inline edit + inspector). Dùng chung bảng
// sites/site_blocks với SiteRenderer nên dữ liệu & xuất bản tương thích.
// Trang /dashboard/site là màn tổng quan Website & chatbox; đây là trình sửa.
export default async function SiteBuilderPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // middleware redirects unauthenticated users

  // profile và site đều tra theo user.id, độc lập nhau → chạy song song (bớt 1 round-trip).
  const [{ data: profile }, { data: existingSite }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("sites").select("*").eq("owner_id", user.id).maybeSingle(),
  ]);
  const plan = profile ? effectivePlan(profile.plan, profile.plan_expires_at) : "free";
  const isAdmin = profile?.role === "admin";
  const canPublish = isAdmin || plan === "photographer" || plan === "photographer_plus" || plan === "studio";
  // Tên miền riêng: Photographer Plus & Studio.
  const canCustomDomain = planAllowsCustomDomain(plan, isAdmin);

  let site = existingSite;
  if (!site) {
    const { data: created } = await supabase.from("sites").insert({ owner_id: user.id }).select("*").single();
    site = created;
  }
  const [{ data: blocks }, { data: albums }, { data: pricelist }] = await Promise.all([
    supabase.from("site_blocks").select("*").eq("site_id", (site as Site).id).order("position"),
    // phase + gallery_pinned để builder cảnh báo album chưa đủ điều kiện lên
    // trang công khai (loadSiteBundle chỉ lấy phase='delivery' & gallery_pinned).
    supabase.from("albums").select("id, slug, title, cover_url, phase, gallery_pinned").eq("owner_id", user.id).eq("status", "published").order("created_at", { ascending: false }).limit(48),
    // Lấy cả dòng 0đ (ghi chú "Phát sinh thêm", "Lưu ý"…) — khối bảng giá xếp
    // chúng xuống phần ghi chú, giống trang bảng giá công khai.
    supabase.from("studio_pricelist").select("id, name, price, unit, category, description, list_key").eq("owner_id", user.id).eq("active", true).order("position"),
  ]);

  // Các loại bảng giá (list_key) để studio chọn loại nào hiện trên website.
  const priceLabels = (profile?.pl_list_labels as Record<string, string> | null) ?? {};
  const plItems = (pricelist ?? []) as PriceItem[];
  const priceLists = availableLists(plItems, priceLabels);

  // Lượt xem website 30 ngày gần nhất (bảng site_views, đếm theo ngày).
  const since = new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10);
  const { data: viewRows } = await supabase
    .from("site_views")
    .select("day, views")
    .eq("site_id", (site as Site).id)
    .gte("day", since)
    .order("day");
  const views = (viewRows ?? []) as { day: string; views: number }[];
  const today = new Date().toISOString().slice(0, 10);
  const last7 = new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10);
  const siteViews = {
    today: views.find((v) => v.day === today)?.views ?? 0,
    week: views.filter((v) => v.day >= last7).reduce((s, v) => s + v.views, 0),
    month: views.reduce((s, v) => s + v.views, 0),
    daily: views.map((v) => ({ day: v.day, views: v.views })),
  };

  // pinned = album đủ điều kiện hiện trên trang công khai (đã giao & được ghim).
  const albumList = ((albums ?? []) as (AlbumOption & { phase: string | null; gallery_pinned: boolean | null })[]).map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    cover_url: a.cover_url,
    pinned: a.phase === "delivery" && !!a.gallery_pinned,
  }));

  return (
    <CanvasBuilder
      site={site as Site}
      initialBlocks={(blocks ?? []) as SiteBlock[]}
      albums={albumList}
      pricelist={plItems}
      priceLists={priceLists}
      priceLabels={priceLabels}
      siteViews={siteViews}
      canPublish={canPublish}
      canCustomDomain={canCustomDomain}
      mainHost={process.env.NEXT_PUBLIC_MAIN_HOST || ""}
    />
  );
}
