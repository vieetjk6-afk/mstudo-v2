"use client";

import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { CustomerHeaderV2, CustomerMainV2 } from "@/components/v2/customer";
import { Badge, Empty, btn } from "@/components/v2/kit";
import type { StudioBrandInfo } from "@/lib/studio-brand";
import { useLang } from "@/lib/i18n";
import { thumbnailUrl, fullImageUrl } from "@/lib/drive";
import { CustomerRootAuto, LangToggle } from "@/app/c/[token]/DocPartsV2";
import { useShowcaseLightbox } from "./useShowcaseLightbox";

interface Photo {
  id: string;
  fileId: string;
  name: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ALBUM THAM KHẢO (showcase, chỉ xem) — giao diện mới. Cùng dữ liệu và cùng
   cách xem ảnh lớn với bản cũ (./useShowcaseLightbox: ← → Esc). Khung làm lại:
   đầu trang thương hiệu studio, tiêu đề + số ảnh gọn, lưới ảnh bo góc 2 cột
   trên điện thoại, ảnh lớn trên nền tối có nút trước/sau to dễ bấm.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ShowcaseAlbumV2({
  title,
  kind,
  description,
  photos,
  brand,
}: {
  brand: StudioBrandInfo | null;
  title: string;
  kind: string;
  description: string | null;
  photos: Photo[];
}) {
  const { lbIdx, setLbIdx } = useShowcaseLightbox(photos.length);
  const { lang, setLang } = useLang();
  const lb = lbIdx !== null ? photos[lbIdx] : null;

  return (
    <CustomerRootAuto>
      <CustomerHeaderV2
        brand={brand ?? { name: "Studio", logoUrl: null }}
        sub="Album tham khảo"
        right={<LangToggle lang={lang} onToggle={() => setLang(lang === "vi" ? "en" : "vi")} />}
      />
      <CustomerMainV2>
        <Link href="/" className={btn("ghost", "sm", "-ml-2.5")}>
          <ArrowLeft size={15} /> Trang chủ
        </Link>
        <div className="mt-3">
          <p className="text-[12.5px] font-medium" style={{ color: "var(--tx3)" }}>
            Album tham khảo · chỉ để xem
          </p>
          <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-[-0.6px] sm:text-[34px]" style={{ textWrap: "balance" }}>
            {title}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[14px]" style={{ color: "var(--tx2)" }}>
            <Badge tone="brand">{kind}</Badge>
            <span>{photos.length} ảnh</span>
          </div>
          {description && (
            <p className="mt-2 max-w-[70ch] text-[14.5px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
              {description}
            </p>
          )}
        </div>

        {photos.length === 0 ? (
          <div className="v2-card mt-6">
            <Empty icon={Images} title="Album này chưa có ảnh." />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
            {photos.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setLbIdx(idx)}
                aria-label={`Xem ${p.name}`}
                className="group aspect-square overflow-hidden rounded-[12px]"
                style={{ background: "var(--sf2)" }}
              >
                <img
                  src={thumbnailUrl(p.fileId, 600)}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full cursor-zoom-in object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </button>
            ))}
          </div>
        )}
      </CustomerMainV2>

      {/* Ảnh lớn (chỉ xem) */}
      {lb && lbIdx !== null && (
        <div className="fixed inset-0 z-[80] flex flex-col" style={{ background: "rgba(8,10,14,.94)" }} role="dialog" aria-modal="true" aria-label={lb.name}>
          <div className="flex flex-none items-center gap-3 px-4 py-3 md:px-6" style={{ color: "rgba(255,255,255,.75)" }}>
            <span className="text-[13.5px] font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
              {lbIdx + 1} / {photos.length}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px]">{lb.name}</span>
            <button
              type="button"
              onClick={() => setLbIdx(null)}
              aria-label="Đóng"
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}
            >
              <X size={19} />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-6 md:px-16">
            <img src={fullImageUrl(lb.fileId, 1600)} alt={lb.name} className="max-h-full max-w-full rounded-[6px] object-contain" />
            <button
              type="button"
              onClick={() => setLbIdx(Math.max(0, lbIdx - 1))}
              disabled={lbIdx === 0}
              aria-label="Ảnh trước"
              className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full disabled:pointer-events-none disabled:opacity-25 md:left-4"
              style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}
            >
              <ChevronLeft size={24} />
            </button>
            <button
              type="button"
              onClick={() => setLbIdx(Math.min(photos.length - 1, lbIdx + 1))}
              disabled={lbIdx >= photos.length - 1}
              aria-label="Ảnh sau"
              className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full disabled:pointer-events-none disabled:opacity-25 md:right-4"
              style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      )}
    </CustomerRootAuto>
  );
}
