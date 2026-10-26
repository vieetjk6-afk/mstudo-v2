import { createAdminClient } from "@/lib/supabase/admin";
import { customerUiV2 } from "@/lib/ui-server";
import { getStudioBrand } from "@/lib/studio-brand";
import CrewPortal from "../CrewPortal";
import CrewPortalV2 from "../CrewPortalV2";

export const dynamic = "force-dynamic";

/**
 * Cổng thợ có GẮN STUDIO: /crew/<crew_token>.
 *
 * /crew trần cố ý không biết thợ thuộc studio nào — nó chỉ nhận SĐT rồi gom
 * việc từ MỌI studio. Muốn thợ đăng ký vào đúng một sổ thợ thì studio phải chia
 * sẻ link mang token riêng của mình, giống cách /book/<booking_token> làm với
 * khách. Token sai/hết hiệu lực thì rơi về cổng chung, không báo lỗi — thợ vẫn
 * xem được việc của mình.
 */
export default async function CrewStudioPortalPage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const db = createAdminClient();
  const { data: studio } = await db
    .from("profiles")
    .select("id, full_name")
    .eq("crew_token", params.token)
    .maybeSingle();

  // Giao diện mới đi theo studio sở hữu link (token sai → cổng chung, không chủ).
  const v2 = await customerUiV2((studio?.id as string | undefined) ?? null);

  if (!studio) return v2 ? <CrewPortalV2 /> : <CrewPortal />;
  const crewStudio = { id: studio.id as string, name: studio.full_name || "Studio", crewToken: params.token };
  if (v2) {
    // Logo + tên thương hiệu studio cho đầu trang; thiếu thì dùng tên đã tải.
    const brand = await getStudioBrand(db, crewStudio.id).catch(() => null);
    return (
      <CrewPortalV2
        studio={crewStudio}
        brand={{ name: brand && brand.name !== "Studio" ? brand.name : crewStudio.name, logoUrl: brand?.logoUrl ?? null }}
      />
    );
  }
  return <CrewPortal studio={crewStudio} />;
}
