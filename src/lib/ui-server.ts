import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getSessionUser, getProfileById } from "@/lib/auth-guards";
import { getFeatureFlags } from "@/lib/feature-flags";
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
