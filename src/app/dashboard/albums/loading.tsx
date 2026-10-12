"use client";

import { usePathname } from "next/navigation";
import DashboardLoading from "../loading";

/**
 * Khung xương của thư viện album — hiện NGAY khi bấm vào "Album", trong lúc máy
 * chủ còn đọc danh sách. Cùng bố cục với AlbumList (dòng gói, hàng nút, tab,
 * lưới 1 · 2 · 3 · 4 · 5 cột với bìa 4:3) để lúc dữ liệu tới trang không nhảy.
 */
export default function AlbumsLoading() {
  // loading.tsx bọc CẢ các trang con (/dashboard/albums/<id>, /new, /selections)
  // — chúng không giống lưới album, nên giữ khung xương chung của dashboard.
  const pathname = usePathname();
  if (pathname !== "/dashboard/albums") return <DashboardLoading />;
  return (
    <div aria-hidden="true">
      {/* Dòng "Gói … · đã tạo N album" (PlanUsage) */}
      <div
        className="mb-6 flex items-center gap-3 rounded-2xl px-5 py-3.5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <span className="skeleton h-8 w-8 rounded-lg" />
        <span className="skeleton h-4 w-52 max-w-[60%] rounded" />
      </div>

      {/* Mô tả + hàng nút tạo album */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="skeleton h-4 w-72 max-w-full" />
        <div className="ml-auto flex gap-2">
          {[96, 116, 148].map((w, i) => (
            <div key={i} className="skeleton h-9 rounded-[9px]" style={{ width: w }} />
          ))}
        </div>
      </div>

      {/* Tab Album chọn ảnh / Album giao khách */}
      <div className="mb-3.5 flex gap-[3px]">
        <div className="skeleton h-8 w-36 rounded-[8px]" />
        <div className="skeleton h-8 w-36 rounded-[8px]" />
      </div>

      <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 min-[820px]:grid-cols-3 min-[1060px]:grid-cols-4 min-[1320px]:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-[14px]"
            style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}
          >
            <div className="skeleton aspect-[4/3] w-full rounded-none" />
            <div className="px-[15px] pb-[15px] pt-[13px]">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton mt-2 h-3 w-1/2" />
              <div className="skeleton mt-3 h-[5px] w-full rounded-[4px]" />
              <div className="skeleton mt-2 h-3 w-2/3" />
              <div className="skeleton mt-4 h-9 w-full rounded-[10px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
