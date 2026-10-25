import { notFound } from "next/navigation";
import { requireStudio } from "@/lib/auth-guards";
import { getFeatureFlags, desktopHidden } from "@/lib/feature-flags";
import { isUiV2 } from "@/lib/ui-server";
import IntegrationGateV2 from "@/app/dashboard/connections/IntegrationGateV2";
import DesktopPanel from "./DesktopPanel";
import DesktopPanelV2 from "./DesktopPanelV2";

export default async function DesktopPage() {
  // MStudo Desktop mở cho 2 gói lớn nhất: Photographer Plus (plus) & Studio (full).
  const profile = await requireStudio("plus");
  const v2 = await isUiV2();
  if (!profile) {
    if (v2) return <IntegrationGateV2 kind="plan" title="Cần gói Photographer Plus trở lên" hint="MStudo Desktop dành cho gói Photographer Plus & Studio." />;
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Photographer Plus trở lên</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>MStudo Desktop dành cho gói Photographer Plus &amp; Studio.</p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Xem các gói</a>
        </div>
      </div>
    );
  }

  // Chưa xuất bản: ẩn hoàn toàn với non-admin (không hiện cả trang "Sắp ra mắt").
  if (desktopHidden(await getFeatureFlags()) && profile.actingRole !== "admin") notFound();

  // Chỉ CHỦ studio (không phải nhân viên) được dùng client + xuất dữ liệu.
  if (profile.isStaff || (profile.actingRole !== "owner" && profile.actingRole !== "admin")) {
    if (v2) return <IntegrationGateV2 kind="role" title="Chỉ dành cho chủ studio" hint="MStudo Desktop và sao lưu dữ liệu chỉ chủ tài khoản studio mới sử dụng được." />;
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Chỉ dành cho chủ studio</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            MStudo Desktop và sao lưu dữ liệu chỉ chủ tài khoản studio mới sử dụng được.
          </p>
        </div>
      </div>
    );
  }

  return v2 ? <DesktopPanelV2 /> : <DesktopPanel />;
}
