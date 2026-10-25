import { BookImage } from "lucide-react";
import { requireStudio } from "@/lib/auth-guards";
import { isUiV2 } from "@/lib/ui-server";
import CreativeGateV2 from "../thiep/CreativeGateV2";
import { getFeatureFlags, albumComingSoon } from "@/lib/feature-flags";
import AlbumDesigner from "./AlbumDesigner";

export default async function AlbumDesignerPage() {
  const profile = await requireStudio();
  if (!profile) {
    if (await isUiV2()) {
      return <CreativeGateV2 kind="plan" feature="Cần gói Studio" hint="Thiết kế Album chỉ dành cho tài khoản gói Studio." />;
    }
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Studio</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>Thiết kế Album chỉ dành cho tài khoản gói Studio.</p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Xem gói Studio</a>
        </div>
      </div>
    );
  }

  // "Sắp ra mắt": khoá với studio; admin vẫn vào để hoàn thiện.
  if (albumComingSoon(await getFeatureFlags()) && profile.actingRole !== "admin") {
    if (await isUiV2()) {
      return (
        <CreativeGateV2
          kind="soon"
          icon={BookImage}
          feature="Thiết kế album"
          hint="Công cụ biến folder ảnh cưới thành album in sẵn — chọn khổ, chọn mẫu, AI tự rải ảnh & dàn trang, rồi xuất file in. Bọn mình đang hoàn thiện và sẽ báo khi sẵn sàng."
        />
      );
    }
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <BookImage size={28} className="mx-auto mb-3" style={{ color: "var(--brand)" }} />
          <h1 className="font-serif text-2xl font-medium">Thiết kế Album · Sắp ra mắt</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Công cụ biến folder ảnh cưới thành album in sẵn — chọn khổ, chọn mẫu, AI tự rải ảnh & dàn trang, rồi xuất file in. Bọn mình đang hoàn thiện và sẽ báo khi sẵn sàng.
          </p>
        </div>
      </div>
    );
  }

  return <AlbumDesigner />;
}
