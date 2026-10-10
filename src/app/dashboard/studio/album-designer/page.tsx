import { BookImage } from "lucide-react";
import { requireStudio } from "@/lib/auth-guards";
import { getFeatureFlags, albumComingSoon } from "@/lib/feature-flags";
import { albumAiStatusOf } from "@/lib/albumai";
import StudioUpsell from "@/components/studio/StudioUpsell";
import AlbumAiPromo from "@/components/AlbumAiPromo";
import AlbumDesigner from "./AlbumDesigner";

export default async function AlbumDesignerPage() {
  const profile = await requireStudio();
  if (!profile) {
    return (
      <StudioUpsell
        icon={BookImage}
        feature="Thiết kế album"
        desc="Biến folder ảnh cưới thành album in — chọn khổ, chọn mẫu, AI tự rải ảnh & dàn trang rồi xuất file in."
      />
    );
  }

  // "Sắp ra mắt": khoá với studio; admin vẫn vào để hoàn thiện.
  if (albumComingSoon(await getFeatureFlags()) && profile.actingRole !== "admin") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div className="card p-8 text-center">
          <BookImage size={28} className="mx-auto mb-3" style={{ color: "var(--brand)" }} />
          <h1 className="font-serif text-2xl font-medium">Thiết kế Album · Sắp ra mắt</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Công cụ biến folder ảnh cưới thành album in sẵn — chọn khổ, chọn mẫu, AI tự rải ảnh & dàn trang, rồi xuất file in. Bọn mình đang hoàn thiện và sẽ báo khi sẵn sàng.
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Trong lúc chờ, gói Studio của bạn được tặng bản quyền phần mềm <b>Album AI</b> để thiết kế album ngay.
          </p>
        </div>
        <AlbumAiPromo status={albumAiStatusOf(profile, profile.isStaff)} email={profile.isStaff ? null : profile.email} />
      </div>
    );
  }

  return <AlbumDesigner />;
}
