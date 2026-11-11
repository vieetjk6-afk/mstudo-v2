"use client";

import { useMemo, useRef, useState } from "react";
import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";
import type { CollageDoc } from "@/lib/collage/types";
import { formatById } from "@/lib/collage/formats";
import { pageSlides } from "@/lib/collage/render";
import type { SignSpec } from "@/lib/collage/brand";
import { PageView, type ImgUrl } from "./PageView";
import { Sheet, useViewport } from "./ui";

/* ═══════════════════════════════════════════════════════════════════════════
   XEM TRƯỚC NHƯ BÀI ĐĂNG INSTAGRAM — khách vuốt thử cả bộ (carousel liền mạch
   thì vuốt từng slide) với caption gợi ý, trước khi tải về. Chỉ là khung giả
   lập trên máy, không đăng đi đâu.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function PostPreview({
  doc,
  img,
  driveOf,
  fontsReady,
  watermark,
  sign,
  handle,
  caption,
  onClose,
}: {
  doc: CollageDoc;
  img: ImgUrl;
  driveOf: (id: string) => string | undefined;
  fontsReady: number;
  watermark: string | null;
  sign: SignSpec | null;
  /** Tên hiện trên đầu bài đăng (vd. "lan.minh"). */
  handle: string;
  caption: string;
  onClose: () => void;
}) {
  const vp = useViewport();
  const f = formatById(doc.formatId);
  const w = Math.min(460, vp.w - 24);
  const h = Math.round((w * f.h) / f.w);
  // Mỗi ảnh đăng = một slide: trang thường 1 slide, carousel `span` slide.
  const slides = useMemo(() => doc.pages.flatMap((p, pi) => Array.from({ length: pageSlides(p) }, (_, si) => ({ pi, si, span: pageSlides(p) }))), [doc.pages]);
  const [at, setAt] = useState(0);
  const [more, setMore] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);
  return (
    <Sheet title="Xem trước như trên Instagram" tall onClose={onClose}>
      <div className="mx-auto mb-3 overflow-hidden rounded-[14px]" style={{ width: w, background: "#fff", color: "#111", border: "1px solid #e6e6e6", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold" style={{ background: "linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)", color: "#fff" }}>
            {handle.slice(0, 1).toUpperCase()}
          </span>
          <span className="text-[13.5px] font-semibold">{handle}</span>
        </div>
        <div
          ref={scroller}
          className="flex snap-x snap-mandatory overflow-x-auto"
          style={{ width: w, scrollbarWidth: "none" }}
          onScroll={(e) => setAt(Math.round(e.currentTarget.scrollLeft / w))}
        >
          {slides.map(({ pi, si, span }) => (
            <div key={`${pi}-${si}`} className="relative flex-none snap-start overflow-hidden" style={{ width: w, height: h }}>
              <div className="absolute top-0" style={{ left: -si * w }}>
                <PageView doc={doc} page={doc.pages[pi]} width={w * span} img={img} driveOf={driveOf} fontsReady={fontsReady} watermark={watermark} sign={sign} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3.5 px-3 pt-2.5">
          <Heart size={23} />
          <MessageCircle size={23} />
          <Send size={22} />
          {slides.length > 1 ? (
            <div className="flex flex-1 justify-center gap-1">
              {slides.slice(0, 20).map((_, i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i === at ? "#0095f6" : "#c7c7c7" }} />
              ))}
            </div>
          ) : (
            <span className="flex-1" />
          )}
          <Bookmark size={22} />
        </div>
        <p className="px-3 pt-2 text-[13px] font-semibold">1.234 lượt thích</p>
        <p className="whitespace-pre-line px-3 pb-3 pt-1 text-[13px] leading-snug">
          <b>{handle}</b> {more || caption.length < 110 ? caption : `${caption.slice(0, 100)}… `}
          {!more && caption.length >= 110 ? (
            <button type="button" onClick={() => setMore(true)} style={{ color: "#8e8e8e" }}>
              xem thêm
            </button>
          ) : null}
        </p>
      </div>
      <p className="px-4 pb-3 text-center text-[12px]" style={{ color: "var(--tx3)" }}>
        Vuốt ngang để xem từng ảnh — đăng đúng thứ tự này. {slides.length} ảnh · {f.label}
      </p>
    </Sheet>
  );
}
