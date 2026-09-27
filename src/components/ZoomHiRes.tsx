"use client";

import { useState } from "react";

/**
 * Lớp ảnh ĐỘ PHÂN GIẢI CAO phủ lên ảnh trong khung xem khi khách phóng to.
 *
 * Ảnh thường trong lightbox chỉ đủ nét ở mức 1 (bề ngang màn hình × DPR).
 * Chụm ngón phóng 2–5 lần thì cần gấp mấy lần số điểm ảnh — nhưng tải sẵn bản
 * to cho mọi ảnh thì tốn mạng vô ích với khách chỉ lướt qua. Nên chỉ khi khách
 * phóng to lần đầu mới gọi bản lớn, và chỉ hiện nó khi đã tải xong: trong lúc
 * chờ, ảnh cũ vẫn nằm bên dưới nên không chớp trắng.
 *
 * Đặt BÊN TRONG khung PhotoZoom (cùng khung `relative` với ảnh gốc) để bị thu
 * phóng/kéo cùng ảnh; `inset-0 object-contain` trùng khít ảnh bên dưới.
 */
export default function ZoomHiRes({ src, active, className }: { src: string; active: boolean; className?: string }) {
  // Đã phóng to một lần thì giữ bản lớn — thu nhỏ về 1 vẫn nét, và lần phóng
  // sau không phải tải lại.
  const [wanted, setWanted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (active && !wanted) setWanted(true);
  if (!wanted) return null;
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onContextMenu={(e) => e.preventDefault()}
      className={`pointer-events-none absolute inset-0 h-full w-full select-none object-contain ${className ?? ""}`}
      style={{ opacity: loaded ? 1 : 0, transition: "opacity .2s ease" }}
    />
  );
}
