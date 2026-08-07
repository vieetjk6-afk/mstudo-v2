import { HardDrive } from "lucide-react";
import { requireStudio } from "@/lib/auth-guards";
import { getFeatureFlags, driveSyncComingSoon } from "@/lib/feature-flags";
import StudioDriveCard from "./StudioDriveCard";

/**
 * Đồng bộ Google Drive — tính năng riêng trong nhóm Khách hàng.
 * Studio kết nối Drive của mình, đặt tên thư mục gốc, chỉnh mẫu thư mục; MStudo
 * Desktop dùng các cấu hình này để tự đồng bộ ảnh/video hợp đồng lên Drive.
 */
export default async function DriveSyncPage() {
  const profile = await requireStudio("full");
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg rounded-[14px] px-6 py-9 text-center" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
        <p className="text-[16px] font-bold" style={{ letterSpacing: "-.3px" }}>Cần gói Studio</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[12.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
          Đồng bộ Google Drive chỉ dành cho tài khoản gói Studio.
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
  // "Sắp ra mắt": khoá với studio; admin vẫn vào để hoàn thiện.
  if (driveSyncComingSoon(await getFeatureFlags()) && profile.actingRole !== "admin") {
    return (
      <div className="mx-auto max-w-lg rounded-[14px] px-6 py-9 text-center" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
        <HardDrive size={26} className="mx-auto" style={{ color: "var(--tx3)" }} />
        <p className="mt-2 text-[16px] font-bold" style={{ letterSpacing: "-.3px" }}>Đồng bộ Google Drive · sắp ra mắt</p>
        <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-[1.6]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
          Tự đồng bộ ảnh/video hợp đồng lên Google Drive của studio: tạo thư mục theo tên hợp đồng, JPG Goc thành album chọn ảnh,
          File ChinhSua thành gallery giao khách. Bọn mình đang hoàn thiện và sẽ báo khi sẵn sàng.
        </p>
      </div>
    );
  }

  // Chỉ CHỦ studio (không phải nhân viên) kết nối Drive & chỉnh cấu hình đồng bộ.
  if (profile.isStaff || (profile.actingRole !== "owner" && profile.actingRole !== "admin")) {
    return (
      <div className="mx-auto max-w-lg rounded-[14px] px-6 py-9 text-center" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
        <p className="text-[16px] font-bold" style={{ letterSpacing: "-.3px" }}>Chỉ dành cho chủ studio</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[12.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
          Kết nối Google Drive và cấu hình đồng bộ chỉ chủ tài khoản studio mới thao tác được.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <StudioDriveCard />
    </div>
  );
}
