import { customerUiV2 } from "@/lib/ui-server";
import CrewPortal from "./CrewPortal";
import CrewPortalV2 from "./CrewPortalV2";

export const dynamic = "force-dynamic";

export default async function CrewPortalPage() {
  // Cổng chung không thuộc studio nào → chỉ vẽ giao diện mới khi cờ ui_v2 =
  // "default" (customerUiV2 với chủ rỗng).
  if (await customerUiV2(null)) return <CrewPortalV2 />;
  return <CrewPortal />;
}
