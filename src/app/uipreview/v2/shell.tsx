import StudioShellV2 from "@/components/v2/StudioShellV2";
import type { ChromeProfile } from "@/lib/types";

/** Chủ studio giả cho màn xem trước giao diện mới. */
export const previewProfile: ChromeProfile = {
  id: "o", email: "mrlee@studio.vn", full_name: "Mr Lee", role: "photographer",
  plan: "studio", plan_expires_at: null, studio_owner_id: null, studio_role: null,
};

/** Bọc một màn trong khung giao diện mới, giả như đang mở `path`. Nhớ đặt `bare: true` cho màn. */
export function PreviewV2({ path, children }: { path: string; children: React.ReactNode }) {
  return (
    <StudioShellV2 profile={previewProfile} tier="full" role="owner" accent="blue" previewPath={path}>
      {children}
    </StudioShellV2>
  );
}
