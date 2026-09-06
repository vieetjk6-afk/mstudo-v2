import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { studioUrl } from "@/lib/hosts";
import { getStudioHost } from "@/lib/studio-site";
import { STUDIO_TIER_RANK, type StudioTier } from "@/lib/plans";
import { ALL_SEED } from "@/lib/pricelist-seeds";
import type { PricelistItem } from "@/lib/types";
import PricingManager from "./PricingManager";
import StudioDenied from "@/components/StudioDenied";


export default async function PricingPage() {
  const profile = await requireStudio("booking");
  if (profile?.actingRole === "accountant") return <StudioDenied message="Kế toán chỉ truy cập mục Thu chi & Bảng lương." />;
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

  const supabase = await createClient();

  // Reuse the public studio token (shared with the booking link).
  let token = profile.booking_token as string | null;
  if (!token && profile.actingRole !== "staff") {
    token = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "");
    await supabase.from("profiles").update({ booking_token: token }).eq("id", profile.id);
  }

  // Price list + services in parallel (services drive the list categories).
  // `data` được GÁN LẠI ở dưới (lần đầu vào trang thì tự nạp bảng giá mẫu),
  // nên phải là `let`. Tách `services` ra `const` cho đúng: nó không đổi.
  const [pricelistRes, { data: services }] = await Promise.all([
    supabase.from("studio_pricelist").select("*").eq("owner_id", profile.id).order("position"),
    supabase.from("studio_services").select("id, name").eq("owner_id", profile.id).eq("active", true).order("position", { ascending: true }),
  ]);
  let { data } = pricelistRes;

  const hiddenLists = (profile.pl_hidden_lists as string[] | null) ?? [];
  const listLabels = (profile.pl_list_labels as Record<string, string> | null) ?? {};
  const showClauses = !!profile.pl_show_clauses;

  // First visit: auto-fill the wedding + engagement lists from the studio's cards.
  // Skip any built-in list the studio has explicitly hidden so it is not
  // re-seeded after being removed.
  if ((!data || data.length === 0) && profile.actingRole !== "staff" && hiddenLists.length === 0) {
    await supabase.from("studio_pricelist").insert(
      ALL_SEED.map((s, i) => ({ ...s, owner_id: profile.id, position: i }))
    );
    ({ data } = await supabase.from("studio_pricelist").select("*").eq("owner_id", profile.id).order("position"));
  }

  const studioHost = await getStudioHost(supabase, profile.id);

  // Báo giá cần gói Studio (plus trở lên) — booking-tier chỉ có bảng giá.
  const canQuote = STUDIO_TIER_RANK[profile.studioTier as StudioTier] >= STUDIO_TIER_RANK.plus;

  return (
    <PricingManager
      ownerId={profile.id}
      initial={(data ?? []) as PricelistItem[]}
      hiddenLists={hiddenLists}
      listLabels={listLabels}
      services={(services ?? []) as { id: string; name: string }[]}
      showClauses={showClauses}
      canQuote={canQuote}
      shareUrl={token ? studioUrl(studioHost, `/gia/${token}`) : ""}
      contact={{
        pl_phone: profile.pl_phone ?? "",
        pl_facebook: profile.pl_facebook ?? "",
        pl_bank_holder: profile.pl_bank_holder ?? "",
        pl_bank_account: profile.pl_bank_account ?? "",
        pl_bank_name: profile.pl_bank_name ?? "",
        pl_bank_bin: profile.pl_bank_bin ?? "",
      }}
      appearance={{
        pl_bg: profile.pl_bg ?? "",
        pl_text: profile.pl_text ?? "",
        pl_accent: profile.pl_accent ?? "",
        pl_logo_url: profile.pl_logo_url ?? "",
      }}
    />
  );
}
