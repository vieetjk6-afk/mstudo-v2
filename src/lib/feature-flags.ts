import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type FeatureFlags = Record<string, string>;

/**
 * Global feature flags controlled by the admin in Settings (site_settings.feature_flags).
 * Cached per-request. Falls back to {} if the column/row is missing.
 */
export const getFeatureFlags = cache(async (): Promise<FeatureFlags> => {
  try {
    const { data } = await createAdminClient().from("site_settings").select("feature_flags").eq("id", 1).maybeSingle();
    const f = (data as { feature_flags?: FeatureFlags } | null)?.feature_flags;
    return f && typeof f === "object" ? f : {};
  } catch {
    return {};
  }
});

/** Love Story is marked "Sắp ra mắt" (coming soon) — locked for non-admins. */
export function storyComingSoon(flags: FeatureFlags): boolean {
  return flags?.story === "coming_soon";
}

/** Album designer defaults to "Sắp ra mắt" until the admin explicitly sets it live. */
export function albumComingSoon(flags: FeatureFlags): boolean {
  return flags?.album !== "live";
}

/** Slide cưới (video slideshow) defaults to "Sắp ra mắt" until set live. */
export function slideComingSoon(flags: FeatureFlags): boolean {
  return flags?.slide !== "live";
}

/**
 * Phòng váy đã PHÁT HÀNH — không còn gắn nhãn "Sắp ra mắt" nữa.
 * Giữ lại hàm (luôn trả false) thay vì xoá, để admin lỡ còn đặt
 * feature_flags.rental = "coming_soon" trong DB cũng không khoá lại màn này.
 */
export function rentalComingSoon(_flags: FeatureFlags): boolean {
  return false;
}

/** Đồng bộ Google Drive (ảnh/video hợp đồng) defaults to "Sắp ra mắt" until set live. */
export function driveSyncComingSoon(flags: FeatureFlags): boolean {
  return flags?.drive_sync !== "live";
}


/**
 * Chi nhánh studio đã PHÁT HÀNH — không còn gắn nhãn "Sắp ra mắt" nữa.
 * Giữ lại hàm (luôn trả false) thay vì xoá, giống `rentalComingSoon`: admin lỡ
 * còn để feature_flags.branches = "coming_soon" trong DB cũng không khoá lại màn
 * này, và mọi chỗ đang gọi hàm vẫn biên dịch được.
 */
export function branchesComingSoon(_flags: FeatureFlags): boolean {
  return false;
}

/**
 * MStudo Desktop: chưa xuất bản — ẩn HOÀN TOÀN với non-admin (không hiện cả
 * nhãn "Sắp ra mắt") cho tới khi admin bật live.
 */
export function desktopHidden(flags: FeatureFlags): boolean {
  return flags?.desktop !== "live";
}

/**
 * Hộp thư hợp nhất — mặc định "Sắp ra mắt" cho tới khi admin đặt live.
 *
 * Mặc định KHOÁ (giống album/slide/drive_sync) chứ không mặc định mở: tính năng
 * vừa dựng xong, còn phải khai Meta App, chạy migration và đi App Review. Bật
 * nhầm ra cho studio lúc chưa đủ những thứ đó thì họ bấm vào một màn không chạy
 * — và lần sau họ không bấm nữa.
 *
 * Bật khi sẵn sàng: Cài đặt hệ thống → Tính năng → bỏ tích "Hộp thư".
 */
export function inboxComingSoon(flags: FeatureFlags): boolean {
  return flags?.inbox !== "live";
}

/** Nav hrefs currently flagged "Sắp ra mắt" (used to chip + lock the sidebar). */
export function comingSoonNav(flags: FeatureFlags): string[] {
  const out: string[] = [];
  if (inboxComingSoon(flags)) out.push("/dashboard/studio/inbox");
  if (storyComingSoon(flags)) out.push("/dashboard/studio/story");
  if (albumComingSoon(flags)) out.push("/dashboard/studio/album-designer");
  if (slideComingSoon(flags)) out.push("/dashboard/studio/slide");
  if (driveSyncComingSoon(flags)) out.push("/dashboard/studio/drive-sync");
  if (branchesComingSoon(flags)) out.push("/dashboard/studio/branches");
  return out;

}
