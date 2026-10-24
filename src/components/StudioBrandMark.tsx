import type { StudioBrandInfo } from "@/lib/studio-brand";

/**
 * Logo (hoặc tên) của STUDIO ở đầu các trang gửi khách — thay cho <Brand /> của
 * mstudo, để khách mở link không thấy dấu nền tảng. Chưa biết studio (album
 * không tồn tại) thì không vẽ gì, thay vì rơi về logo mstudo.
 */
export default function StudioBrandMark({ brand }: { brand: StudioBrandInfo | null }) {
  if (!brand) return <span />;
  if (brand.logoUrl) {
    return <img src={brand.logoUrl} alt={brand.name} className="h-[38px] w-auto max-w-[180px] object-contain" />;
  }
  return <span className="font-serif text-[20px] font-medium">{brand.name}</span>;
}
