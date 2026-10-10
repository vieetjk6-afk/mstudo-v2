import { Video } from "lucide-react";
import { requireStudio } from "@/lib/auth-guards";
import { getFeatureFlags, slideComingSoon } from "@/lib/feature-flags";
import { albumAiStatusOf } from "@/lib/albumai";
import StudioUpsell from "@/components/studio/StudioUpsell";
import AlbumAiPromo from "@/components/AlbumAiPromo";
import SlideStudio from "./SlideStudio";

export default async function SlidePage() {
  const profile = await requireStudio();
  if (!profile) {
    return (
      <StudioUpsell
        icon={Video}
        feature="Slide ảnh"
        desc="Tự dựng video slideshow ảnh cưới để chiếu tiệc — chọn ảnh, chủ đề, nhạc, hiệu ứng chuyển cảnh rồi xuất video."
      />
    );
  }

  // "Sắp ra mắt": khoá với studio; admin vẫn vào để hoàn thiện.
  if (slideComingSoon(await getFeatureFlags()) && profile.actingRole !== "admin") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div className="card p-8 text-center">
          <Video size={28} className="mx-auto mb-3" style={{ color: "var(--brand)" }} />
          <h1 className="font-serif text-2xl font-medium">Slide cưới · Sắp ra mắt</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Công cụ tự tạo video slideshow ảnh cưới — chọn ảnh, chủ đề, nhạc, hiệu ứng chuyển cảnh rồi xuất video. Bọn mình đang hoàn thiện và sẽ báo khi sẵn sàng.
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Trong lúc chờ, gói Studio của bạn được tặng bản quyền phần mềm <b>Album AI</b> để dựng slide ảnh ngay.
          </p>
        </div>
        <AlbumAiPromo status={albumAiStatusOf(profile, profile.isStaff)} email={profile.isStaff ? null : profile.email} />
      </div>
    );
  }

  return <SlideStudio />;
}
