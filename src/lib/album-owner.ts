import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { brandFrom, type StudioBrandInfo } from "@/lib/studio-brand";
import type { Plan } from "@/lib/plans";

/** Các cột "an toàn" (có từ lâu) — quyền tải/ghi chú và gói của chủ album. */
const SAFE_COLS = "role, can_zip, can_notes, full_name, plan, plan_expires_at";
/** Cột thương hiệu thêm sau — studio chưa chạy migration thì có thể chưa có. */
const BRAND_COLS = "studio_brand_name, studio_logo_url, pl_logo_url";

export type AlbumOwnerProfile = {
  role: string | null;
  can_zip: boolean | null;
  can_notes: boolean | null;
  full_name: string | null;
  plan: Plan | null;
  plan_expires_at: string | null;
};

export type AlbumOwner = {
  /** null = không có dòng profiles (hoặc đọc lỗi) — nơi gọi tự lùi về mặc định. */
  profile: AlbumOwnerProfile | null;
  brand: StudioBrandInfo;
};

/**
 * Dòng profiles của chủ album, đọc MỘT lần cho mỗi request.
 *
 * Vì sao: trang /a/[slug] và /album/[slug] trước đây đọc cùng dòng này 3–4 lượt
 * (tên studio cho tiêu đề chia sẻ, logo favicon, quyền tải/gói, thương hiệu) —
 * cả generateMetadata lẫn page. Bọc React `cache()` để metadata và page dùng
 * chung một kết quả trong cùng request.
 *
 * Giữ nguyên tinh thần cũ "cột thương hiệu chưa migrate không được làm hỏng
 * quyền tải / gói": đọc gộp trước, lỗi thì đọc lại chỉ các cột an toàn và coi
 * thương hiệu như không có (giống getStudioBrand trả brandFrom(null) khi lỗi).
 */
export const getAlbumOwner = cache(async (ownerId: string | null | undefined): Promise<AlbumOwner> => {
  if (!ownerId) return { profile: null, brand: brandFrom(null) };
  try {
    const db = createAdminClient();
    const full = await db.from("profiles").select(`${SAFE_COLS}, ${BRAND_COLS}`).eq("id", ownerId).maybeSingle();
    if (!full.error) {
      const row = full.data as (AlbumOwnerProfile & { studio_brand_name?: string | null; studio_logo_url?: string | null; pl_logo_url?: string | null }) | null;
      return { profile: row, brand: brandFrom(row) };
    }
    const safe = await db.from("profiles").select(SAFE_COLS).eq("id", ownerId).maybeSingle();
    return { profile: (safe.data as AlbumOwnerProfile | null) ?? null, brand: brandFrom(null) };
  } catch {
    return { profile: null, brand: brandFrom(null) };
  }
});
