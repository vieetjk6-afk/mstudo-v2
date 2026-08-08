import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { getStudioHost } from "@/lib/studio-site";
import { studioUrl } from "@/lib/hosts";
import StudioDenied from "@/components/StudioDenied";
import SharePreview from "./SharePreview";

/**
 * HỢP ĐỒNG GỬI KHÁCH (màn `share` của bản thiết kế) — xem trước đúng thứ khách
 * sẽ thấy, kèm link và mã QR để gửi.
 *
 * Khung xem trước nhúng THẲNG trang khách thật `/c/<token>` bằng iframe chứ
 * không vẽ lại nội dung hợp đồng: vẽ lại thì mỗi lần trang khách đổi, bản xem
 * trước lại nói dối — mà đây đúng là màn người ta tin để bấm gửi.
 */
export default async function ContractSharePage({ params }: { params: { id: string } }) {
  const profile = await requireStudio("plus");
  if (profile?.actingRole === "accountant") return <StudioDenied message="Kế toán chỉ truy cập mục Thu chi & Bảng lương." />;
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg rounded-[14px] px-6 py-9 text-center" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
        <p className="text-[16px] font-bold" style={{ letterSpacing: "-.3px" }}>Cần gói Studio</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[12.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
          Gửi hợp đồng cho khách ký online nằm trong gói Studio.
        </p>
        <a
          href="/dashboard/upgrade"
          className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold"
          style={{ background: "var(--ac)", color: "#fff" }}
        >
          Xem gói Studio
        </a>
      </div>
    );
  }

  const supabase = createClient();
  const { data: contract } = await supabase
    .from("studio_contracts")
    .select("id, code, title, client_name, client_phone, client_token, client_signed_at, client_viewed_at, status")
    .eq("id", params.id)
    .eq("owner_id", profile.id)
    .maybeSingle();
  if (!contract) notFound();

  const studioHost = await getStudioHost(supabase, profile.id);
  const shareUrl = studioUrl(studioHost, `/c/${contract.client_token}`);

  return (
    <SharePreview
      contractId={contract.id}
      code={contract.code}
      title={contract.title}
      clientName={contract.client_name}
      clientPhone={contract.client_phone}
      signedAt={contract.client_signed_at}
      viewedAt={contract.client_viewed_at}
      shareUrl={shareUrl}
      previewPath={`/c/${contract.client_token}`}
    />
  );
}
