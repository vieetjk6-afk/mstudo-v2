import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export const DEFAULT_TITLE = "mstudo — Phần mềm quản lý studio ảnh";
export const DEFAULT_DESCRIPTION =
  "mstudo · Phần mềm quản lý studio ảnh: hợp đồng, báo giá, đặt lịch, lịch chụp, đội ngũ & tài chính trong một nơi.";

// Tiêu đề/favicon do admin chỉnh rất hiếm khi đổi → cache 5 phút giữa các
// request thay vì query Supabase trên MỌI page-load (giảm TTFB toàn trang).
// Dùng chung cho layout gốc và /api/brand-icon.
export const getSiteMeta = unstable_cache(
  async () => {
    let title = DEFAULT_TITLE;
    let description = DEFAULT_DESCRIPTION;
    let favicon: string | null = null;
    try {
      const db = createAdminClient();
      const { data } = await db
        .from("site_settings")
        .select("site_title, site_description, favicon_url")
        .eq("id", 1)
        .maybeSingle();
      if (data?.site_title) title = data.site_title;
      if (data?.site_description) description = data.site_description;
      if (data?.favicon_url) favicon = data.favicon_url;
    } catch {
      /* keep defaults */
    }
    return { title, description, favicon };
  },
  ["site-meta"],
  { revalidate: 300 }
);
