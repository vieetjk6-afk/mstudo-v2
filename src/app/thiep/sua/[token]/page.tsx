import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { brandFrom, getStudioBrand } from "@/lib/studio-brand";
import { customerUiV2 } from "@/lib/ui-server";
import WeddingEditor from "./WeddingEditor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chỉnh sửa thiệp cưới",
  robots: { index: false, follow: false },
};

/** Studio sở hữu thiệp (theo mã sửa) — để chọn giao diện mới và lấy thương hiệu. */
async function ownerOf(token: string): Promise<string | null> {
  try {
    const { data } = await createAdminClient().from("wedding_invitations").select("owner_id").eq("edit_token", token).maybeSingle();
    return (data as { owner_id?: string | null } | null)?.owner_id ?? null;
  } catch {
    return null;
  }
}

export default async function EditWeddingPage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  // Giao diện mới theo studio sở hữu thiệp (xem customerUiV2). Nội dung thiệp
  // vẫn tải ở client qua /api/thiep/<token> như cũ; ở đây chỉ đọc chủ thiệp.
  // Mã sai vẫn đi cùng nhánh khi cờ bật cho mọi studio (trang báo "không tìm
  // thấy" theo đúng giao diện đang dùng).
  const ownerId = await ownerOf(params.token);
  if (await customerUiV2(ownerId)) {
    const brand = ownerId ? await getStudioBrand(createAdminClient(), ownerId) : brandFrom(null);
    return <WeddingEditor token={params.token} v2={{ brand }} />;
  }
  return <WeddingEditor token={params.token} />;
}
