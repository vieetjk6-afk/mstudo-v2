import { createAdminClient } from "@/lib/supabase/admin";
import CrewPortal from "../CrewPortal";

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

  if (!studio) return <CrewPortal />;
  return <CrewPortal studio={{ id: studio.id as string, name: studio.full_name || "Studio", crewToken: params.token }} />;
}
