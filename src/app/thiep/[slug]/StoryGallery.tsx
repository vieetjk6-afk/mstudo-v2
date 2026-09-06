"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

const DURATION = 4000; // ms per slide

/** Instagram-stories style gallery: full-bleed slides, progress bars, tap nav. */
export default function StoryGallery({ images }: { images: string[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const startRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);
  const n = images.length;

  useEffect(() => {
    if (paused || n <= 1) return;
    startRef.current = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - startRef.current) / DURATION);
      setProgress(p);
      if (p >= 1) { setI((v) => (v + 1) % n); setProgress(0); }
      else rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [i, paused, n]);

  if (n === 0) return null;
  const go = (d: number) => { setI((v) => (v + d + n) % n); setProgress(0); };

  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-sm overflow-hidden rounded-3xl bg-black shadow-2xl select-none">
      {images.map((src, idx) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={idx}
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
          style={{ opacity: idx === i ? 1 : 0 }}
          loading={idx <= 1 ? "eager" : "lazy"}
        />
      ))}

      {/* progress bars */}
      <div className="absolute inset-x-3 top-3 z-20 flex gap-1">
        {images.map((_, idx) => (
          <div key={idx} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35">
            <div className="h-full bg-white" style={{ width: `${idx < i ? 100 : idx === i ? progress * 100 : 0}%` }} />
          </div>
        ))}
      </div>

      {/* tap zones */}
      <button aria-label="Trước" className="absolute inset-y-0 left-0 z-10 w-1/3" onClick={() => go(-1)} />
      <button aria-label="Sau" className="absolute inset-y-0 right-0 z-10 w-1/3" onClick={() => go(1)} />

      {/* controls */}
      <div className="absolute inset-x-0 bottom-4 z-20 flex items-center justify-center gap-6 text-white">
        <button onClick={() => go(-1)} aria-label="Ảnh trước" className="rounded-full bg-black/30 p-2 backdrop-blur"><ChevronLeft size={18} /></button>
        <button onClick={() => setPaused((p) => !p)} aria-label={paused ? "Tiếp tục" : "Tạm dừng"} className="rounded-full bg-black/30 p-2 backdrop-blur">{paused ? <Play size={18} /> : <Pause size={18} />}</button>
        <button onClick={() => go(1)} aria-label="Ảnh sau" className="rounded-full bg-black/30 p-2 backdrop-blur"><ChevronRight size={18} /></button>
      </div>
    </div>
  );
}
