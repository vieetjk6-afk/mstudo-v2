import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeatureFlags, plannerComingSoon } from "@/lib/feature-flags";
import WeddingPlanner from "./WeddingPlanner";

export const dynamic = "force-dynamic";

/* ═══════════════════════════════════════════════════════════════════════════
   KẾ HOẠCH CƯỚI CỦA KHÁCH — /portal/<client_token>/ke-hoach

   Việc cần làm theo mốc trước ngày cưới, ngân sách, lịch trình ngày cưới. Cùng
   token + cổng SĐT với cổng khách /portal/<token>; dữ liệu qua
   /api/c/<token>/ke-hoach. Luật ở @/lib/wedding-plan.

   "Sắp ra mắt" (feature_flags.planner chưa live): trang không tồn tại với khách
   — trừ hợp đồng của tài khoản admin, để admin thử trọn vòng trước khi mở.
   ═══════════════════════════════════════════════════════════════════════════ */

export async function generateMetadata(props: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const params = await props.params;
  const { data } = await createAdminClient()
    .from("studio_contracts")
    .select("client_name, title")
    .eq("client_token", params.token)
    .maybeSingle();
  const who = data?.client_name || data?.title;
  return {
    title: who ? `Kế hoạch cưới · ${who}` : "Kế hoạch cưới",
    robots: { index: false, follow: false },
    // Cùng manifest với cổng khách: đã "Lưu vào máy" thì mở từ màn hình chính
    // vẫn là một app, trang này chỉ là một màn trong đó.
    manifest: `/portal/${params.token}/manifest.webmanifest`,
  };
}

export default async function WeddingPlannerPage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  if (plannerComingSoon(await getFeatureFlags())) {
    const db = createAdminClient();
    const { data: c } = await db.from("studio_contracts").select("owner_id").eq("client_token", params.token).maybeSingle();
    const { data: owner } = c
      ? await db.from("profiles").select("role").eq("id", c.owner_id).maybeSingle()
      : { data: null };
    if (owner?.role !== "admin") notFound();
  }
  return <WeddingPlanner token={params.token} />;
}
