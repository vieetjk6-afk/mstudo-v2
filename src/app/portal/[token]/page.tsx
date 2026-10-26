import type { Metadata } from "next";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import ContractPortalView from "./ContractPortalView";
import ContractPortalViewV2 from "./ContractPortalViewV2";
import { studioShareMetadata } from "@/lib/studio-share-meta";
import { customerUiV2 } from "@/lib/ui-server";
import { getStudioBrand } from "@/lib/studio-brand";

export const dynamic = "force-dynamic";

/* ═══════════════════════════════════════════════════════════════════════════
   CỔNG KHÁCH HÀNG THEO HỢP ĐỒNG — /portal/<client_token>
   (bản thiết kế "Cổng nhân viên & khách hàng", mục 2)

   Trang RIÊNG của từng khách theo từng hợp đồng: tiến độ hợp đồng, lịch trình
   hẹn, các đợt thanh toán, tiến độ từng sản phẩm, album xem trước. Khi hợp đồng
   sang trạng thái **Hoàn thành**, cùng đường dẫn này đổi thành TRANG ALBUM nền
   tối: ảnh, video, tải về, đánh giá sao.

   Dùng CHUNG token với trang hợp đồng /c/<client_token> và chung endpoint
   /api/c/<token> — nên một link khách đã có vẫn mở được cả hai trang, và cổng
   mới không phải dựng lại cổng chặn theo số điện thoại.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Tên + chủ hợp đồng — metadata và trang dùng chung MỘT lượt đọc (cache theo lượt dựng). */
const contractHead = cache(async (token: string) => {
  const { data } = await createAdminClient()
    .from("studio_contracts")
    .select("title, client_name, owner_id")
    .eq("client_token", token)
    .maybeSingle();
  return data as { title: string | null; client_name: string | null; owner_id: string | null } | null;
});

export async function generateMetadata(props: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const params = await props.params;
  const data = await contractHead(params.token);

  const title = data?.client_name ? `Trang của ${data.client_name}` : data?.title || "Trang khách hàng";
  const meta = await studioShareMetadata({
    ownerId: data?.owner_id,
    title,
    description: (studio) => `${studio} — theo dõi lịch trình, thanh toán và sản phẩm của hợp đồng.`,
    path: `/portal/${params.token}`,
    // Trang riêng của một khách: không cho công cụ tìm kiếm lập chỉ mục.
    noindex: true,
  });
  // Manifest riêng → khách cài "trang hợp đồng của tôi" lên màn hình chính.
  return { ...meta, manifest: `/portal/${params.token}/manifest.webmanifest` };
}

export default async function ContractPortalPage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  // Giao diện mới theo studio sở hữu hợp đồng (xem customerUiV2). Bản V2 cần
  // thương hiệu studio cho cổng SĐT — chỉ đọc khi bật, bản cũ không tốn gì thêm.
  const ownerId = (await contractHead(params.token))?.owner_id ?? null;
  if (ownerId && (await customerUiV2(ownerId))) {
    const brand = await getStudioBrand(createAdminClient(), ownerId);
    return <ContractPortalViewV2 token={params.token} brand={brand} />;
  }
  return <ContractPortalView token={params.token} />;
}
