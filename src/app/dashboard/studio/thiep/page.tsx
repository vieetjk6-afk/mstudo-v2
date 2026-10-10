import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { brandFrom } from "@/lib/studio-brand";
import StudioUpsell from "@/components/studio/StudioUpsell";
import ThiepListView, { type InvitationRow } from "./ThiepListView";

export default async function ThiepManagePage() {
  const profile = await requireStudio();
  // Mục menu "Thiệp · Story · Slide" hiện cả với gói Photographer (nhãn Studio)
  // và trỏ về đây — nên đây là màn mời nâng cấp của cả nhóm, kể cả slide ảnh.
  if (!profile) {
    return (
      <StudioUpsell
        icon={Heart}
        feature="Thiệp · Story · Slide"
        desc="Thiệp cưới online, trang Love Story và slide ảnh chiếu tiệc gửi tặng khách."
      />
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("wedding_invitations")
    .select("id, slug, edit_token, template, published, config, contract_id, created_at, wedding_rsvps(count)")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false });

  const rows: InvitationRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    slug: r.slug as string,
    edit_token: r.edit_token as string,
    template: r.template as string,
    published: r.published as boolean,
    config: (r.config ?? {}) as InvitationRow["config"],
    contract_id: (r.contract_id ?? null) as string | null,
    created_at: r.created_at as string,
    rsvp_count: Array.isArray(r.wedding_rsvps) && r.wedding_rsvps[0] ? (r.wedding_rsvps[0] as { count: number }).count : 0,
  }));

  return (
    <ThiepListView
      rows={rows}
      ownerId={profile.id}
      studio={{
        name: brandFrom(profile).name,
        phone: (profile.pl_phone as string | null) ?? null,
        email: (profile.email as string | null) ?? null,
      }}
    />
  );
}
