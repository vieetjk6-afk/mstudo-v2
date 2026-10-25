import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getProfileById } from "@/lib/auth-guards";
import { getPlanUsage } from "@/lib/plan-usage";
import { isUiV2 } from "@/lib/ui-server";
import UpgradeView from "./UpgradeView";

/**
 * Trang "Gói phần mềm". Phần hiển thị và logic ở UpgradeView (client).
 *
 * Giao diện mới đặt thanh "album đã tạo trong tháng" ngay trong thẻ gói đang
 * dùng, nên máy chủ tính sẵn số đó (getPlanUsage — cùng hàm của trang album).
 * Bản cũ vẫn tự tải bằng <PlanUsage/> như trước, nên không tính thừa cho nó.
 */
export default async function UpgradePage() {
  if (!(await isUiV2())) return <UpgradeView />;
  // Bản CACHE theo lượt dựng trang — layout đã gọi đúng hai câu này rồi.
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);
  const usage = user ? await getPlanUsage(supabase, user.id, getProfileById(user.id)) : null;
  return <UpgradeView usage={usage} />;
}
