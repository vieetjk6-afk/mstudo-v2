import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { brandFrom, getStudioBrand } from "@/lib/studio-brand";
import { customerUiV2 } from "@/lib/ui-server";
import StoryEditor from "./StoryEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Chỉnh sửa Love Story", robots: { index: false, follow: false } };

/** Studio sở hữu trang (theo mã sửa) — để chọn giao diện mới và lấy thương hiệu. */
async function ownerOf(token: string): Promise<string | null> {
  try {
    const { data } = await createAdminClient().from("story_pages").select("owner_id").eq("edit_token", token).maybeSingle();
    return (data as { owner_id?: string | null } | null)?.owner_id ?? null;
  } catch {
    return null;
  }
}

export default async function EditStoryPage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  // Giao diện mới theo studio sở hữu trang (xem customerUiV2). Nội dung vẫn tải
  // ở client qua /api/story/<token> như cũ; ở đây chỉ đọc chủ trang.
  const ownerId = await ownerOf(params.token);
  if (await customerUiV2(ownerId)) {
    const brand = ownerId ? await getStudioBrand(createAdminClient(), ownerId) : brandFrom(null);
    return <StoryEditor token={params.token} v2={{ brand }} />;
  }
  return <StoryEditor token={params.token} />;
}
