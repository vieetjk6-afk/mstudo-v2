import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudioBrand } from "@/lib/studio-brand";
import { effectivePlan, studioTier } from "@/lib/plans";
import QuoteClientView from "./QuoteClientView";
import QuoteClientViewV2 from "./QuoteClientViewV2";
import { customerUiV2 } from "@/lib/ui-server";
import type { StudioQuote, QuoteItem, QuoteAdjustment } from "@/lib/types";
import { studioShareMetadata } from "@/lib/studio-share-meta";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const params = await props.params;
  const db = createAdminClient();
  const { data } = await db
    .from("studio_quotes")
    .select("title, client_name, owner_id")
    .eq("client_token", params.token)
    .maybeSingle();

  const title = data?.title
    ? `${data.title}${data.client_name ? ` · ${data.client_name}` : ""}`
    : "Báo giá dịch vụ";
  return studioShareMetadata({
    ownerId: data?.owner_id,
    title,
    description: (studio) => `${studio} — xem và xác nhận báo giá dịch vụ nhiếp ảnh.`,
    path: `/q/${params.token}`,
    noindex: true,
  });
}

export default async function QuoteClientPage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const db = createAdminClient();
  const { data: quote } = await db.from("studio_quotes").select("*").eq("client_token", params.token).maybeSingle();
  if (!quote) notFound();

  // Mark as 'viewed' on first open (don't downgrade later statuses).
  if (quote.status === "sent") {
    await db.from("studio_quotes").update({ status: "viewed", viewed_at: new Date().toISOString() }).eq("id", quote.id);
  }

  const [{ data: items }, { data: adjustments }, { data: owner }, contractRes] = await Promise.all([
    db.from("quote_items").select("*").eq("quote_id", quote.id).order("position"),
    db.from("quote_adjustments").select("*").eq("quote_id", quote.id).order("created_at", { ascending: true }),
    db.from("profiles").select("full_name, email, plan, plan_expires_at, role").eq("id", quote.owner_id).maybeSingle(),
    // If a contract has already been spawned from this quote (auto-create on a
    // previous visit), fetch its client_token so we can show the link on reload.
    quote.contract_id
      ? db.from("studio_contracts").select("client_token").eq("id", quote.contract_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Photographers (booking tier) don't have the contract feature, so we hide
  // the "tự động tạo hợp đồng" checkbox for their quotes.
  const studioCanContract = owner
    ? studioTier(effectivePlan(owner.plan, owner.plan_expires_at), owner.role === "admin") === "full"
    : false;

  const [brand, v2] = await Promise.all([getStudioBrand(db, quote.owner_id), customerUiV2(quote.owner_id)]);
  const View = v2 ? QuoteClientViewV2 : QuoteClientView;

  return (
    <View
      quote={quote as StudioQuote}
      initialItems={(items ?? []) as QuoteItem[]}
      initialAdjustments={(adjustments ?? []) as QuoteAdjustment[]}
      studioName={brand.name}
      studioLogo={brand.logoUrl}
      studioCanContract={studioCanContract}
      initialContractToken={contractRes?.data?.client_token ?? null}
    />
  );
}
