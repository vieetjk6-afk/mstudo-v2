import type { Metadata } from "next";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import ContractView from "./ContractView";
import ContractViewV2 from "./ContractViewV2";
import { studioShareMetadata } from "@/lib/studio-share-meta";
import { customerUiV2 } from "@/lib/ui-server";
import { getStudioBrand } from "@/lib/studio-brand";

export const dynamic = "force-dynamic";

/** Dòng đầu của hợp đồng theo token — dùng chung cho metadata và trang (cache theo lượt dựng). */
const loadHead = cache(async (token: string) => {
  const { data } = await createAdminClient()
    .from("studio_contracts")
    .select("title, client_name, owner_id")
    .eq("client_token", token)
    .maybeSingle();
  return data;
});

export async function generateMetadata(props: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const params = await props.params;
  const data = await loadHead(params.token);

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
  // Giao diện mới đi theo studio sở hữu hợp đồng. Chỉ đọc thêm thương hiệu khi
  // vẽ bản mới (đầu trang hiện logo + tên studio ngay ở màn nhập SĐT).
  const ownerId = (await loadHead(params.token))?.owner_id as string | undefined;
  if (await customerUiV2(ownerId)) {
    const brand = ownerId
      ? await getStudioBrand(createAdminClient(), ownerId).catch(() => ({ name: "Studio", logoUrl: null }))
      : { name: "Studio", logoUrl: null };
    return <ContractViewV2 token={params.token} brand={brand} />;
  }
  return <ContractView token={params.token} />;
}
