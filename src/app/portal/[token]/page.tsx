import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import ContractPortalView from "./ContractPortalView";

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

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const db = createAdminClient();
  const { data } = await db
    .from("studio_contracts")
    .select("title, client_name, portal_owner:profiles!owner_id(full_name)")
    .eq("client_token", params.token)
    .maybeSingle();

  const studioName = (data?.portal_owner as { full_name?: string } | null)?.full_name || "Studio";
  const title = data?.client_name ? `Trang của ${data.client_name}` : data?.title || "Trang khách hàng";

  return {
    title,
    description: `${studioName} — theo dõi lịch trình, thanh toán và sản phẩm của hợp đồng.`,
    // Trang riêng của một khách: không cho công cụ tìm kiếm lập chỉ mục.
    robots: { index: false, follow: false },
    openGraph: { title, type: "website" },
  };
}

export default function ContractPortalPage({ params }: { params: { token: string } }) {
  return <ContractPortalView token={params.token} />;
}
