"use client";

import { useEffect, useState } from "react";

/**
 * Xem ảnh lớn của album tham khảo: chỉ số ảnh đang mở + phím ← → Esc. Dùng
 * chung cho bản cũ (ShowcaseAlbum) và giao diện mới (ShowcaseAlbumV2).
 */
export function useShowcaseLightbox(count: number) {
  const [lbIdx, setLbIdx] = useState<number | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (lbIdx === null) return;
      if (e.key === "ArrowRight") setLbIdx((i) => (i === null ? i : Math.min(count - 1, i + 1)));
      else if (e.key === "ArrowLeft") setLbIdx((i) => (i === null ? i : Math.max(0, i - 1)));
      else if (e.key === "Escape") setLbIdx(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lbIdx, count]);

  return { lbIdx, setLbIdx };
}
