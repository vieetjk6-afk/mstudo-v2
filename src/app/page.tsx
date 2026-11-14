import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import LandingPage, { type LandingPricing } from "./LandingPage";
import { createAdminClient } from "@/lib/supabase/admin";
import { LANDING_PRICING_TAG } from "@/lib/public-cache";
import type { Lang } from "@/lib/i18n";

// Trang vẫn dựng theo từng request (ngôn ngữ đọc từ cookie); riêng bảng giá
// nhớ 5 phút giữa các request — trang chủ bị bot quét liên tục, trước đây lượt
// nào cũng đọc site_settings. Admin lưu Cài đặt (/api/admin/settings) thì bỏ
// nhớ ngay nên giá mới vẫn hiện tức thì.
export const revalidate = 0;

const readPricing = unstable_cache(
  async (): Promise<LandingPricing | null> => {
    const { data, error } = await createAdminClient()
      .from("site_settings")
      // Giảm giá Photographer Plus đọc từ cột theo chu kỳ
      // (photographer_plus_discount_month/year_percent) — các cột này đã tồn tại
      // sẵn trong DB nên select an toàn (không cần migration mới).
      .select(
        "price_basic_month, price_basic_year, price_photographer_month, price_photographer_year, price_photographer_plus_month, price_photographer_plus_year, price_studio_month, price_studio_year, basic_discount_percent, photographer_discount_percent, photographer_plus_discount_month_percent, photographer_plus_discount_year_percent, studio_discount_percent, studio_promo_percent"
      )
      .eq("id", 1)
      .maybeSingle();
    // Lỗi thì ném để KHÔNG nhớ "không có giá" suốt 5 phút (trang tự lùi về giá in sẵn).
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      basicMonth: data.price_basic_month,
      basicYear: data.price_basic_year,
      photographerMonth: data.price_photographer_month,
      photographerYear: data.price_photographer_year,
      photographerPlusMonth: data.price_photographer_plus_month,
      photographerPlusYear: data.price_photographer_plus_year,
      studioMonth: data.price_studio_month,
      studioYear: data.price_studio_year,
      basicDiscount: data.basic_discount_percent ?? 0,
      photographerDiscount: data.photographer_discount_percent ?? 0,
      photographerPlusDiscountMonth: data.photographer_plus_discount_month_percent ?? 0,
      photographerPlusDiscountYear: data.photographer_plus_discount_year_percent ?? 0,
      studioDiscount: data.studio_discount_percent ?? 0,
      studioPromo: data.studio_promo_percent ?? 0,
    };
  },
  ["landing-pricing-v1"],
  { revalidate: 300, tags: [LANDING_PRICING_TAG] },
);

export default async function HomePage() {
  // Ngôn ngữ landing đến từ cookie để server render đúng bản VI/EN (island
  // LandingControls ghi cookie này và đồng bộ với localStorage của app).
  const lang: Lang = (await cookies()).get("vk_lang")?.value === "en" ? "en" : "vi";
  let pricing: LandingPricing | undefined;
  try {
    pricing = (await readPricing()) ?? undefined;
  } catch {
    // Fall back to the static prices baked into LandingPage.
  }

  return <LandingPage lang={lang} pricing={pricing} />;
}
