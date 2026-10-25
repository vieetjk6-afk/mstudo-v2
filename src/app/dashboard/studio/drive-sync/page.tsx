import { HardDrive } from "lucide-react";
import { requireStudio } from "@/lib/auth-guards";
import { getFeatureFlags, driveSyncComingSoon } from "@/lib/feature-flags";
import { isUiV2 } from "@/lib/ui-server";
import IntegrationGateV2 from "@/app/dashboard/connections/IntegrationGateV2";
import StudioDriveCard from "./StudioDriveCard";
import StudioDriveV2 from "./StudioDriveV2";

/**
 * Đồng bộ Google Drive — tính năng riêng trong nhóm Khách hàng.
 * Studio kết nối Drive của mình, đặt tên thư mục gốc, chỉnh mẫu thư mục; MStudo
 * Desktop dùng các cấu hình này để tự đồng bộ ảnh/video hợp đồng lên Drive.
 */
export default async function DriveSyncPage() {
  const profile = await requireStudio("full");
  const v2 = await isUiV2();
  if (!profile) {
    if (v2) return <IntegrationGateV2 kind="plan" title="Cần gói Studio" hint="Đồng bộ Google Drive chỉ dành cho tài khoản gói Studio." action={{ href: "/dashboard/upgrade", label: "Xem gói Studio" }} />;
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Studio</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>Đồng bộ Google Drive chỉ dành cho tài khoản gói Studio.</p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Xem gói Studio</a>
        </div>
      </div>
    );
  }
  // "Sắp ra mắt": khoá với studio; admin vẫn vào để hoàn thiện.
  if (driveSyncComingSoon(await getFeatureFlags()) && profile.actingRole !== "admin") {
    if (v2) {
      return (
        <IntegrationGateV2
          kind="soon"
          icon={HardDrive}
          title="Đồng bộ Google Drive"
          hint="Tự đồng bộ ảnh/video hợp đồng lên Google Drive của studio: tạo thư mục theo tên hợp đồng, JPG Goc thành album chọn ảnh, File ChinhSua thành gallery giao khách. Bọn mình đang hoàn thiện và sẽ báo khi sẵn sàng."
        />
      );
    }
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <HardDrive size={28} className="mx-auto mb-3" style={{ color: "var(--brand)" }} />
          <h1 className="font-serif text-2xl font-medium">Đồng bộ Google Drive · Sắp ra mắt</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Tự đồng bộ ảnh/video hợp đồng lên Google Drive của studio: tạo thư mục theo tên hợp đồng, JPG Goc thành album chọn ảnh,
            File ChinhSua thành gallery giao khách. Bọn mình đang hoàn thiện và sẽ báo khi sẵn sàng.
          </p>
        </div>
      </div>
    );
  }

  // Chỉ CHỦ studio (không phải nhân viên) kết nối Drive & chỉnh cấu hình đồng bộ.
  if (profile.isStaff || (profile.actingRole !== "owner" && profile.actingRole !== "admin")) {
    if (v2) return <IntegrationGateV2 kind="role" title="Chỉ dành cho chủ studio" hint="Kết nối Google Drive và cấu hình đồng bộ chỉ chủ tài khoản studio mới thao tác được." />;
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Chỉ dành cho chủ studio</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Kết nối Google Drive và cấu hình đồng bộ chỉ chủ tài khoản studio mới thao tác được.
          </p>
        </div>
      </div>
    );
  }

  if (v2) return <StudioDriveV2 />;

  return (
    <div className="mx-auto max-w-4xl">
      <StudioDriveCard />
    </div>
  );
}
