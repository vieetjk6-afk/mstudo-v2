"use client";

import { useEffect, useMemo, useState } from "react";
import { Heart } from "lucide-react";
import { useMasonry } from "@/lib/masonry";
import { watermarkLayer } from "@/lib/album-watermark";
import { ICON_HALO } from "@/lib/album-icon";

/**
 * LƯỚI ẢNH ALBUM — bài kiểm tra "cuộn sâu có lag không" (dữ liệu giả).
 *
 * Album cưới thật 1500–3000 tấm không mở được ở máy dev (cần Drive + Supabase),
 * mà đúng chỗ đó mới lòi ra cái lag: ảnh đã cuộn qua vẫn nằm trong RAM, cuộn
 * càng sâu máy càng đuối. Màn này dựng thẳng `useMasonry` với 1200 ô ảnh giả
 * (SVG data URI, đủ tỉ lệ ngang/dọc/vuông) và KHÔNG có cửa sổ dựng dần như
 * album thật — nên thứ duy nhất giữ bộ nhớ khỏi phình là cơ chế nhả ảnh của
 * chính `useMasonry`.
 *
 * Dòng số liệu ở đầu trang là chỗ đọc kết quả: cuộn xuống sâu mà "đang giữ
 * byte ảnh" vẫn đứng ở một con số nhỏ (≈ vài chục) là cơ chế chạy đúng; nó bò
 * lên gần bằng tổng số ô là hỏng.
 */

const TOTAL = 1200;
/** Tỉ lệ (rộng × cao) lặp vòng — giống album thật: đủ ngang, dọc và vuông. */
const SIZES: [number, number][] = [
  [400, 600],
  [600, 400],
  [500, 500],
  [400, 700],
  [700, 400],
];

function fakePhoto(i: number): { id: string; src: string } {
  const [w, h] = SIZES[i % SIZES.length];
  const hue = (i * 37) % 360;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect width="100%" height="100%" fill="hsl(${hue} 45% 62%)"/>` +
    `<text x="50%" y="50%" font-family="sans-serif" font-size="${Math.round(w / 5)}"` +
    ` fill="rgba(255,255,255,.85)" text-anchor="middle" dominant-baseline="middle">${i + 1}</text>` +
    `</svg>`;
  return { id: `p${i}`, src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` };
}

export default function LuoiAnhDemo() {
  const masonry = useMasonry(2, 4);
  const photos = useMemo(() => Array.from({ length: TOTAL }, (_, i) => fakePhoto(i)), []);
  const [held, setHeld] = useState<number | null>(null);
  const [nodes, setNodes] = useState<number | null>(null);
  // `?wm=1` bật lớp watermark — album có watermark là ô nặng nhất, phải đo được.
  const [wm, setWm] = useState(false);
  useEffect(() => {
    setWm(new URLSearchParams(window.location.search).get("wm") === "1");
  }, []);

  // Đếm số ảnh CÒN GIỮ byte: ảnh đã nhả mang dấu `data-mst-src` (chỗ cất src cũ).
  useEffect(() => {
    const tick = () => {
      const all = document.querySelectorAll<HTMLImageElement>("#luoi-anh-demo img");
      let n = 0;
      all.forEach((im) => { if (!im.dataset.mstSrc) n++; });
      setHeld(n);
      setNodes(document.querySelectorAll("#luoi-anh-demo *").length);
    };
    tick();
    const t = setInterval(tick, 400);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <div
        className="sticky top-0 z-10 mb-3 rounded-xl px-3.5 py-2.5 text-[13px]"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <b>{TOTAL}</b> ô ảnh{wm ? " (có watermark)" : ""} · đang giữ byte ảnh:{" "}
        <b data-test="giu">{held ?? "…"}</b> · thẻ HTML: <b data-test="nut">{nodes ?? "…"}</b>
        <span className="ml-2" style={{ color: "var(--text3)" }}>
          cuộn xuống sâu — con số này phải đứng yên ở mức thấp
        </span>
      </div>

      <div id="luoi-anh-demo" ref={masonry.ref}>
        <div className="grid grid-cols-2 md:grid-cols-4" style={masonry.gridStyle}>
          {photos.map((p) => (
            <div
              key={p.id}
              ref={masonry.tileRef(p.id)}
              className="relative overflow-hidden"
              style={{ background: "var(--surface)", ...masonry.tileStyle(p.id) }}
            >
              <img
                {...masonry.imgProps(p.id)}
                src={p.src}
                alt={p.id}
                loading="lazy"
                decoding="async"
                className="block h-full w-full object-cover"
              />
              {/* Hai thứ này có trong ô album THẬT — đo mà bỏ chúng đi là đo thiếu. */}
              {wm && (
                <div className="pointer-events-none absolute inset-0 z-[2] opacity-20" style={watermarkLayer("Studio ABC")} />
              )}
              <button
                type="button"
                aria-label="Chọn ảnh"
                className="absolute right-1 top-1 z-[4] flex h-7 w-7 items-center justify-center"
                style={{ color: "#fff", filter: ICON_HALO }}
              >
                <Heart size={16} strokeWidth={2.2} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
