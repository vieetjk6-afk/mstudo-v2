import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getSessionUser, getProfileById } from "@/lib/auth-guards";
import { getFeatureFlags } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { UI_COOKIE, resolveUi, uiV2Mode, type UiState } from "@/lib/ui-version";

/**
 * Trạng thái giao diện mới cho người đang đăng nhập — dùng ở layout VÀ ở từng
 * page.tsx (server) để chọn vẽ bản V2 hay bản cũ của màn. Bốn câu đọc bên dưới
 * đều là bản cache theo lượt dựng trang (layout đã gọi), nên page gọi lại không
 * tốn round-trip nào.
 */
export const getUiState = cache(async (): Promise<UiState> => {
  const user = await getSessionUser();
  if (!user) return { eligible: false, active: false };
  const [profile, flags, jar] = await Promise.all([getProfileById(user.id), getFeatureFlags(), cookies()]);
  return resolveUi(uiV2Mode(flags), profile?.role === "admin", jar.get(UI_COOKIE)?.value);
});

/** Đang vẽ giao diện mới? — rút gọn cho page.tsx. */
export async function isUiV2(): Promise<boolean> {
  return (await getUiState()).active;
}

/**
 * TRANG KHÁCH (hợp đồng, báo giá, album, cổng khách, đặt lịch, cổng thợ…) có vẽ
 * bằng giao diện mới không. Khách không đăng nhập nên không có công tắc riêng —
 * quyết định theo STUDIO sở hữu trang, đúng tinh thần "admin dùng trước":
 *   • cờ ui_v2 = "default" → mọi studio;
 *   • còn lại (chỉ admin / studio tự bật) → chỉ studio của tài khoản admin.
 * Đọc role bằng service-role (trang khách không có phiên đăng nhập), cache theo
 * lượt dựng trang.
 */
export const customerUiV2 = cache(async (ownerId: string | null | undefined): Promise<boolean> => {
  // Đọc cờ và role SONG SONG: trang khách là trang đông nhất, nối tiếp hai câu
  // này là thêm một vòng tới DB cho mọi lượt mở.
  const [flags, role] = await Promise.all([getFeatureFlags(), ownerId ? ownerRole(ownerId) : Promise.resolve(null)]);
  if (uiV2Mode(flags) === "default") return true;
  return role === "admin";
});

async function ownerRole(ownerId: string): Promise<string | null> {
  try {
    const { data } = await createAdminClient().from("profiles").select("role").eq("id", ownerId).maybeSingle();
    return (data as { role?: string } | null)?.role ?? null;
  } catch {
    return null;
  }
}
