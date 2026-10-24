import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import ContractView from "./ContractView";
import { studioShareMetadata } from "@/lib/studio-share-meta";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const params = await props.params;
  const db = createAdminClient();
  const { data } = await db
    .from("studio_contracts")
    .select("title, client_name, owner_id")
    .eq("client_token", params.token)
    .maybeSingle();

  const title = data?.title
    ? `${data.title}${data.client_name ? ` · ${data.client_name}` : ""}`
    : "Hợp đồng dịch vụ";
  return studioShareMetadata({
    ownerId: data?.owner_id,
    title,
    description: (studio) => `${studio} — xem và ký hợp đồng dịch vụ nhiếp ảnh trực tuyến.`,
    path: `/c/${params.token}`,
    noindex: true,
  });
}

export default async function PublicContractPage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  return <ContractView token={params.token} />;
}
