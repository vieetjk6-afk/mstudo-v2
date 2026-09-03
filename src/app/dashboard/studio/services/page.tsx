import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { STUDIO_TIER_RANK, type StudioTier } from "@/lib/plans";
import type { StudioService } from "@/lib/types";
import ServicesTemplatesTabs from "./ServicesTemplatesTabs";
import StudioPolicyCard from "@/components/studio/StudioPolicyCard";
import AutomationsCard from "@/components/studio/AutomationsCard";
import type { AutomationConfig } from "@/lib/automations";
import type { TemplateWithItems } from "../templates/TemplatesManager";

export default async function ServicesPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const profile = await requireStudio("booking");
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Photographer trở lên</h1>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Nâng cấp gói</a>
        </div>
      </div>
    );
  }

  const canUseTemplates = STUDIO_TIER_RANK[profile.studioTier as StudioTier] >= STUDIO_TIER_RANK.plus;

  const supabase = createClient();
  const [{ data: services }, { data: templates }] = await Promise.all([
    supabase
      .from("studio_services")
      .select("*")
      .eq("owner_id", profile.id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    canUseTemplates
      ? supabase
          .from("contract_templates")
          .select("*, contract_template_items(*)")
          .eq("owner_id", profile.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  // Cấu hình việc tự động. Query RIÊNG và bọc try/catch: project chưa chạy
  // supabase/migrations/automations.sql thì bảng chưa tồn tại, và cả trang Dịch
  // vụ & điều khoản KHÔNG được sập chỉ vì thiếu một bảng cấu hình.
  let automations: Record<string, AutomationConfig | undefined> = {};
  try {
    const { data: autoRows } = await supabase
      .from("studio_automations")
      .select("rule, enabled, offset_days, message")
      .eq("owner_id", profile.id);
    automations = Object.fromEntries(
      ((autoRows ?? []) as { rule: string; enabled: boolean; offset_days: number | null; message: string | null }[]).map(
        (r) => [r.rule, { rule: r.rule, enabled: r.enabled, days: r.offset_days, message: r.message }]
      )
    );
  } catch {
    /* chưa chạy migration → thẻ hiện mặc định, bấm Lưu sẽ báo cần chạy migration */
  }

  const initialTab = searchParams?.tab === "templates" ? "templates" : "services";

  return (
    <div className="space-y-3.5">
      <ServicesTemplatesTabs
        ownerId={profile.id}
        services={(services ?? []) as StudioService[]}
        templates={(templates ?? []) as unknown as TemplateWithItems[]}
        canUseTemplates={canUseTemplates}
        initialTab={initialTab}
      />
      {/* Chính sách chạy ngầm (hạn lưu trữ ảnh gốc, hiệu lực báo giá) đặt cùng
          trang với điều khoản dịch vụ — đều là "studio này làm việc theo luật
          nào". Chỉ chủ studio đặt được, nhân viên không thấy. */}
      {(profile.actingRole === "owner" || profile.actingRole === "admin") && (
        <StudioPolicyCard
          ownerId={profile.id}
          initialStorageMonths={(profile as { storage_months?: number }).storage_months ?? 6}
          initialQuoteValidDays={(profile as { quote_valid_days?: number }).quote_valid_days ?? 15}
          initialDeposit={(profile as { booking_deposit?: number }).booking_deposit ?? 0}
          initialContractDepositPercent={(profile as { contract_deposit_percent?: number }).contract_deposit_percent ?? 25}
          initialReferralReward={(profile as { referral_reward?: number }).referral_reward ?? 0}
          initialReferralDiscount={(profile as { referral_discount?: number }).referral_discount ?? 0}
          initialStudioAddress={(profile as { studio_address?: string | null }).studio_address ?? ""}
          initialStudioLat={(profile as { studio_lat?: number | null }).studio_lat ?? null}
          initialStudioLng={(profile as { studio_lng?: number | null }).studio_lng ?? null}
        />
      )}
      {/* Việc tự động cũng là "studio này làm việc theo luật nào" → cùng trang
          với điều khoản và chính sách. Chỉ chủ studio bật/tắt được: luật gửi
          Zalo cho khách là thứ nhân viên không nên tự mở. */}
      {(profile.actingRole === "owner" || profile.actingRole === "admin") && (
        <AutomationsCard ownerId={profile.id} initial={automations} />
      )}
    </div>
  );
}
