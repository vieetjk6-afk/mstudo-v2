import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { brandFrom } from "@/lib/studio-brand";
import ThiepListView, { type InvitationRow } from "./ThiepListView";

export default async function ThiepManagePage() {
  const profile = await requireStudio();
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Studio</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Tính năng thiệp cưới online chỉ dành cho tài khoản gói Studio.
          </p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Xem gói Studio</a>
        </div>
      </div>
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
