import { createAdminClient } from "@/lib/supabase/admin";
import { getStudioBrand } from "@/lib/studio-brand";
import { buildClientManifest, manifestResponse } from "@/lib/client-manifest";

export const dynamic = "force-dynamic";

/**
 * Manifest của cổng khách theo hợp đồng — `/portal/<token>/manifest.webmanifest`.
 *
 * Đây là app "theo dõi hợp đồng" của khách: lịch trình, các đợt thanh toán, tiến
 * độ sản phẩm, rồi thành trang album khi hợp đồng hoàn thành. Một hợp đồng cưới
 * chạy 3–6 tháng nên khách mở lại rất nhiều lần — chính là thứ đáng cài về máy.
 *
 * Manifest KHÔNG chứa gì bí mật ngoài chính token vốn đã nằm trong URL, và cổng
 * vẫn hỏi số điện thoại mới mở (xem POST /api/c/[token]). Vẫn đặt `noindex`.
 */
export async function GET(_req: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const db = createAdminClient();
  const { data: c } = await db
    .from("studio_contracts")
    .select("title, client_name, owner_id")
    .eq("client_token", params.token)
    .maybeSingle();

  const brand = c?.owner_id ? await getStudioBrand(db, c.owner_id) : { name: "Studio", logoUrl: null };
  // Tên app là tên KHÁCH, không phải tên hợp đồng: icon trên màn hình chính của
  // khách nên đọc là "Minh & Lan", không phải "HĐ chụp cưới trọn gói 2".
  const name = c?.client_name?.trim() || c?.title?.trim() || "Hợp đồng của tôi";

  return manifestResponse(
    buildClientManifest({
      id: `/portal/${params.token}`,
      name: `${name} · ${brand.name}`,
      shortName: name,
      description: `Theo dõi lịch trình, thanh toán và sản phẩm của hợp đồng — ${brand.name}.`,
      startUrl: `/portal/${params.token}`,
      logoUrl: brand.logoUrl,
      themeColor: "#1e9e72",
    })
  );
}
