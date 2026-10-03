"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { preconnect } from "react-dom";
import { ChevronLeft, ChevronRight, Download, Loader2, X as XIcon } from "lucide-react";
import { Portal } from "@/components/studio/Modal";
import { fullImageUrl, retryViaProxy, thumbnailUrl } from "@/lib/drive";
import { downloadImage } from "@/lib/download";
import { useFullImageWidth, useGridThumbWidth } from "@/lib/use-img-width";
import { DIM, LINE } from "./dark";

/* ═══════════════════════════════════════════════════════════════════════════
   LƯỚI ẢNH + KHUNG XEM LỚN của trang album nền tối (/portal, hợp đồng đã xong)

   Vì sao bản trước chậm:
     • Dựng cùng lúc cả 400 ô; `loading="lazy"` của Chrome tải trước rất xa
       (1–2 nghìn px), nên vừa mở trang đã có cả trăm lượt tải ảnh giành nhau
       đúng mấy kết nối của trình duyệt — ảnh trên màn hình phải xếp hàng.
     • Luôn xin thumbnail 500px dù điện thoại chỉ cần cỡ khác, máy tính thường
       cần nhỏ hơn.
     • Khung xem lớn mở ra là màn đen cho tới khi ảnh 1600px tải xong.

   Bản này:
     • Dựng dần từng đợt 48 ô, cuộn gần cuối mới dựng thêm (IntersectionObserver).
     • Cỡ thumbnail theo màn hình thật (@/lib/use-img-width) — mốc cố định nên
       cache trình duyệt / CDN của Google vẫn trúng.
     • Hàng đầu xin trước với ưu tiên cao; ô chưa có ảnh "thở" nhẹ.
     • Mở trước kết nối tới máy chủ ảnh của Google (preconnect).
     • Khung xem lớn hiện ngay thumbnail đã có trong cache làm nền rồi mới
       thay bằng ảnh nét, và tải trước ±2 ảnh bên cạnh.
   ═══════════════════════════════════════════════════════════════════════════ */

export type GridPhoto = { id: string; drive_file_id: string; name: string };

const STEP = 48;

export default function PortalPhotoGrid({
  photos,
  canDownload,
  watermark,
  toast,
}: {
  photos: GridPhoto[];
  canDownload: boolean;
  watermark: string | null;
  toast: (m: string) => void;
}) {
  const gridW = useGridThumbWidth(2, 5, 1180);
  const fullW = useFullImageWidth();
  const [shown, setShown] = useState(STEP);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);

  // /api/img chuyển hướng sang máy chủ ảnh của Google — bắt tay TLS sẵn từ lúc
  // này thì ảnh đầu tiên không phải đợi thêm một vòng kết nối.
  preconnect("https://drive.google.com");
  preconnect("https://lh3.googleusercontent.com");

  useEffect(() => {
    const el = sentinel.current;
    if (!el || shown >= photos.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => Math.min(photos.length, n + STEP));
      },
      { rootMargin: "900px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, photos.length]);

  const download = useCallback(
    async (p: GridPhoto) => {
      if (busy) return;
      setBusy(p.id);
      try {
        await downloadImage(p.drive_file_id, p.name, watermark);
        if (watermark) toast("Đã lưu ảnh về máy.");
      } catch {
        toast("Chưa tải được ảnh này — thử lại sau ít phút nhé.");
      } finally {
        setBusy(null);
      }
    },
    [busy, watermark, toast]
  );

  return (
    <>
      <div className="grid gap-2 sm:gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(158px, 44vw), 1fr))" }}>
        {photos.slice(0, shown).map((p, i) => (
          <div
            key={p.id}
            className="o-anh-cho-toi group relative overflow-hidden rounded-[12px]"
            style={{ aspectRatio: "4 / 5", border: `1px solid ${LINE}` }}
          >
            <button type="button" onClick={() => setOpen(i)} className="block h-full w-full" aria-label={`Xem ảnh ${p.name}`}>
              <img
                src={thumbnailUrl(p.drive_file_id, gridW)}
                alt={p.name}
                loading={i < 12 ? "eager" : "lazy"}
                fetchPriority={i < 6 ? "high" : "auto"}
                decoding="async"
                draggable={false}
                ref={(im) => { if (im?.complete && im.naturalWidth > 0) im.style.opacity = "1"; }}
                onLoad={(e) => { e.currentTarget.style.opacity = "1"; }}
                onError={retryViaProxy}
                className="h-full w-full object-cover transition-[opacity,transform] duration-300 group-hover:scale-[1.02]"
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
                className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full transition-opacity focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                style={{ background: "rgba(10,8,11,.62)", color: "#fff", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
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

function Lightbox({
  photos,
  index,
  setIndex,
  gridW,
  fullW,
  canDownload,
  busy,
  onDownload,
}: {
  photos: GridPhoto[];
  index: number;
  setIndex: (i: number | null) => void;
  gridW: number;
  fullW: number;
  canDownload: boolean;
  busy: boolean;
  onDownload: (p: GridPhoto) => void;
}) {
  const p = photos[index];
  const touchX = useRef<number | null>(null);
  const go = useCallback(
    (d: number) => setIndex(Math.max(0, Math.min(photos.length - 1, index + d))),
    [index, photos.length, setIndex]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndex(null);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, setIndex]);

  // Khoá cuộn trang phía sau trong lúc xem ảnh.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Tải trước ảnh nét hai bên để bấm/vuốt sang là có ngay.
  useEffect(() => {
    for (const off of [1, -1, 2]) {
      const n = photos[index + off];
      if (n) { const im = new Image(); im.src = fullImageUrl(n.drive_file_id, fullW); }
    }
  }, [index, photos, fullW]);

  const navBtn = "absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full sm:flex";
  const glass = { background: "rgba(255,255,255,.1)", color: "#fff" } as const;

  return (
    // Portal ra <body>: khung xem ảnh phải phủ đúng khung nhìn, không phụ
    // thuộc phần tử cha nào (xem ghi chú trong components/studio/Modal.tsx).
    <Portal>
      <div
        className="fixed inset-0 z-[160] flex flex-col"
        style={{ background: "rgba(8,6,9,.96)" }}
        onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          const x0 = touchX.current;
          touchX.current = null;
          const x1 = e.changedTouches[0]?.clientX;
          if (x0 == null || x1 == null) return;
          if (x1 - x0 > 50) go(-1);
          else if (x0 - x1 > 50) go(1);
        }}
      >
        <div className="flex flex-none items-center gap-2 px-3 py-3 sm:px-5">
          <p className="tnum min-w-0 flex-1 truncate text-[12.5px]" style={{ color: DIM }}>
            <span className="font-bold text-white">{index + 1}</span> / {photos.length}
            <span className="ml-2 hidden sm:inline">· {p.name}</span>
          </p>
          {canDownload && (
            <button
              type="button"
              onClick={() => onDownload(p)}
              disabled={busy}
              className="flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold"
              style={{ background: "#fff", color: "#141215" }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Tải ảnh
            </button>
          )}
          <button type="button" onClick={() => setIndex(null)} className="flex h-10 w-10 items-center justify-center rounded-full" style={glass} aria-label="Đóng">
            <XIcon size={18} />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 sm:px-16" onClick={() => setIndex(null)}>
          <img
            key={p.id}
            src={fullImageUrl(p.drive_file_id, fullW)}
            alt={p.name}
            decoding="async"
            onError={retryViaProxy}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full select-none rounded-[6px] object-contain"
            style={{
              // Thumbnail đã nằm trong cache từ lưới → hiện ngay làm nền mờ, ảnh
              // nét tải xong tự đè lên. Không còn màn đen chờ.
              backgroundImage: `url(${thumbnailUrl(p.drive_file_id, gridW)})`,
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              minWidth: "min(60vw, 420px)",
              minHeight: "min(50vh, 420px)",
            }}
            draggable={false}
          />
          {index > 0 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} className={`${navBtn} left-3`} style={glass} aria-label="Ảnh trước">
              <ChevronLeft size={20} />
            </button>
          )}
          {index < photos.length - 1 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} className={`${navBtn} right-3`} style={glass} aria-label="Ảnh sau">
              <ChevronRight size={20} />
            </button>
          )}
        </div>
        <p className="flex-none pb-3 text-center text-[11px] sm:hidden" style={{ color: DIM }}>Vuốt sang trái / phải để xem ảnh khác</p>
      </div>
    </Portal>
  );
}
