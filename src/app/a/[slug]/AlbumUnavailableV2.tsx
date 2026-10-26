import { ImageOff } from "lucide-react";
import type { StudioBrandInfo } from "@/lib/studio-brand";
import { CustomerHeaderV2, CustomerRootV2 } from "@/components/v2/customer";
import { Empty } from "@/components/v2/kit";

/**
 * Album không mở được (không tồn tại, chưa xuất bản, hết giai đoạn) — giao diện
 * mới, dùng chung cho /a/[slug] và /album/[slug]. Server component: không có
 * trạng thái gì. Chưa biết studio (album không tồn tại) thì không vẽ đầu trang,
 * đúng như bản cũ không rơi về logo mstudo.
 */
export default function AlbumUnavailableV2({ brand, title }: { brand: StudioBrandInfo | null; title: string }) {
  return (
    <CustomerRootV2>
      {brand ? <CustomerHeaderV2 brand={brand} sub="Album ảnh" /> : null}
      <div className="flex min-h-[calc(100svh-60px)] items-center justify-center px-4 py-10">
        <div className="v2-card w-full max-w-[420px]">
          <Empty icon={ImageOff} title={title} hint="Link có thể đã hết hạn hoặc studio đang chỉnh lại album. Bạn liên hệ studio để nhận link mới nhé." />
        </div>
      </div>
    </CustomerRootV2>
  );
}
