import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { dropCache, siteHostTags } from "@/lib/public-cache";

export const dynamic = "force-dynamic";

/**
 * Trang website công khai được nhớ 5 phút (src/app/site/...). Trình dựng web
 * ghi thẳng vào Supabase từ trình duyệt, nên sau mỗi lần lưu nó gọi route này
 * để bỏ nhớ — studio mở trang ra là thấy ngay bản vừa sửa. Chỉ bỏ nhớ website
 * của CHÍNH người gọi, không nhận tham số nào.
 */
export async function POST() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: site } = await createAdminClient()
    .from("sites")
    .select("subdomain, custom_domain")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (site) dropCache(...siteHostTags(site));
  return NextResponse.json({ ok: true });
}
