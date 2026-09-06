"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X, ArrowLeft } from "lucide-react";
import Brand from "@/components/Brand";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { thumbnailUrl, fullImageUrl } from "@/lib/drive";

interface Photo {
  id: string;
  fileId: string;
  name: string;
}

export default function ShowcaseAlbum({
  title,
  kind,
  description,
  photos,
}: {
  title: string;
  kind: string;
  description: string | null;
  photos: Photo[];
}) {
  const [lbIdx, setLbIdx] = useState<number | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (lbIdx === null) return;
      if (e.key === "ArrowRight") setLbIdx((i) => (i === null ? i : Math.min(photos.length - 1, i + 1)));
      else if (e.key === "ArrowLeft") setLbIdx((i) => (i === null ? i : Math.max(0, i - 1)));
      else if (e.key === "Escape") setLbIdx(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lbIdx, photos.length]);

  const lb = lbIdx !== null ? photos[lbIdx] : null;

  return (
    <main className="min-h-screen pb-24">
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-6 py-3.5 md:px-10"
        style={{
          background: "color-mix(in srgb, var(--bg) 80%, transparent)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Brand />
        <LanguageSwitcher />
      </header>

      <div className="mx-auto max-w-[1500px] px-6 pt-7 md:px-10">
        <Link href="/" className="mb-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px]" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}>
          <ArrowLeft size={15} /> Trang chủ
        </Link>
        <div className="animate-[vkFade_.5s_ease_both]">
          <p className="mb-2 text-[12px] uppercase tracking-[0.2em]" style={{ color: "var(--text3)" }}>
            Album tham khảo · chỉ để xem
          </p>
          <h1 className="font-serif text-[clamp(32px,5vw,52px)] font-medium leading-none">{title}</h1>
          <p className="mt-2 text-[13.5px]" style={{ color: "var(--text2)" }}>
            {kind} · {photos.length} ảnh{description ? ` · ${description}` : ""}
          </p>
        </div>

        <div className="mt-7 grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
          {photos.map((p, idx) => (
            <div
              key={p.id}
              className="aspect-square overflow-hidden rounded-xl animate-[vkPop_.45s_ease_both]"
              style={{ background: "var(--surface)" }}
            >
              <img
                src={thumbnailUrl(p.fileId, 600)}
                alt={p.name}
                loading="lazy"
                role="button"
                tabIndex={0}
                aria-label={`Xem ${p.name}`}
                onClick={() => setLbIdx(idx)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLbIdx(idx); } }}
                className="h-full w-full cursor-zoom-in object-cover transition-transform duration-700 hover:scale-[1.03]"
              />
            </div>
          ))}
        </div>

        {photos.length === 0 && (
          <p className="py-20 text-center text-sm" style={{ color: "var(--text3)" }}>
            Album này chưa có ảnh.
          </p>
        )}
      </div>

      {/* Lightbox (view-only) */}
      {lb && lbIdx !== null && (
        <div className="fixed inset-0 z-[80] flex flex-col animate-[vkOverlay_.3s_ease_both]" style={{ background: "rgba(6,6,8,.93)", backdropFilter: "blur(8px)" }}>
          <div className="flex flex-shrink-0 items-center gap-3 px-4 py-3.5 md:px-7" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-[13px]" style={{ color: "var(--text2)" }}>{lbIdx + 1} / {photos.length}</span>
            <div className="flex-1" />
            <button onClick={() => setLbIdx(null)} aria-label="Đóng" className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
              <X size={17} />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 md:p-10">
            <button onClick={() => setLbIdx(Math.max(0, lbIdx - 1))} disabled={lbIdx === 0} aria-label="Ảnh trước" className="absolute left-3.5 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full transition-opacity disabled:pointer-events-none disabled:opacity-25" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
              <ChevronLeft size={22} />
            </button>
            <img src={fullImageUrl(lb.fileId, 1600)} alt={lb.name} className="max-h-[82vh] max-w-full rounded object-contain animate-[vkPop_.35s_ease_both]" style={{ boxShadow: "0 30px 80px rgba(0,0,0,.6)" }} />
            <button onClick={() => setLbIdx(Math.min(photos.length - 1, lbIdx + 1))} disabled={lbIdx >= photos.length - 1} aria-label="Ảnh sau" className="absolute right-3.5 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full transition-opacity disabled:pointer-events-none disabled:opacity-25" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
              <ChevronRight size={22} />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
