"use client";

import { Download, Loader2 } from "lucide-react";
import { retryAltHost, thumbnailUrl } from "@/lib/drive";
import { Lightbox, usePhotoGrid, type GridPhoto } from "./PortalPhotoGrid";

/* ═══════════════════════════════════════════════════════════════════════════
   LƯỚI ẢNH — cổng khách, giao diện mới. Cùng cơ chế với PortalPhotoGrid (dựng
   dần từng đợt, cỡ thumbnail theo màn hình, tải từng ảnh theo cờ cho tải +
   watermark, khung xem lớn vuốt được) — chỉ đổi phần vẽ theo bộ màu V2: ô bo
   nhẹ trên nền thẻ, 3 cột trên điện thoại như thư viện ảnh của máy.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function PortalPhotoGridV2({
  photos,
  canDownload,
  watermark,
  toast,
  src,
}: {
  photos: GridPhoto[];
  canDownload: boolean;
  watermark: string | null;
  toast: (m: string) => void;
  /** Chỉ màn xem trước (/uipreview): ảnh giữ chỗ thay cho ảnh Drive thật. */
  src?: (p: GridPhoto, w: number) => string;
}) {
  const { gridW, fullW, shown, open, setOpen, busy, sentinel, download } = usePhotoGrid(photos, watermark, toast);

  return (
    <>
      <div className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(168px, 30vw), 1fr))" }}>
        {photos.slice(0, shown).map((p, i) => (
          <div key={p.id} className="group relative overflow-hidden rounded-[10px]" style={{ aspectRatio: "4 / 5", background: "var(--sf2)" }}>
            <button type="button" onClick={() => setOpen(i)} className="block h-full w-full" aria-label={`Xem ảnh ${p.name}`}>
              <img
                src={src ? src(p, gridW) : thumbnailUrl(p.drive_file_id, gridW)}
                alt={p.name}
                loading={i < 12 ? "eager" : "lazy"}
                fetchPriority={i < 6 ? "high" : "auto"}
                decoding="async"
                draggable={false}
                ref={(im) => { if (im?.complete && im.naturalWidth > 0) im.style.opacity = "1"; }}
                onLoad={(e) => { e.currentTarget.style.opacity = "1"; }}
                onError={src ? undefined : retryAltHost}
                className="h-full w-full object-cover transition-[opacity,transform] duration-300 group-hover:scale-[1.03]"
                style={{ opacity: 0 }}
              />
            </button>
            {canDownload && (
              <button
                type="button"
                onClick={() => download(p)}
                disabled={busy === p.id}
                aria-label={`Tải ảnh ${p.name}`}
                title="Tải ảnh này"
                className="absolute bottom-1.5 right-1.5 flex h-9 w-9 items-center justify-center rounded-full transition-opacity focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                style={{ background: "color-mix(in srgb, #000 55%, transparent)", color: "#fff", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
              >
                {busy === p.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              </button>
            )}
          </div>
        ))}
      </div>
      {shown < photos.length && <div ref={sentinel} className="h-px" aria-hidden />}

      {open != null && photos[open] && (
        <Lightbox
          photos={photos}
          index={open}
          setIndex={setOpen}
          gridW={gridW}
          fullW={fullW}
          canDownload={canDownload}
          busy={busy === photos[open].id}
          onDownload={download}
        />
      )}
    </>
  );
}
