"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lớp ảnh GỐC phủ lên ảnh trong khung xem khi khách phóng to.
 *
 * Ảnh thường trong lightbox chỉ đủ nét ở mức 1 (bề ngang màn hình × DPR).
 * Chụm ngón phóng 2–5 lần thì cần gấp mấy lần số điểm ảnh — nhưng tải sẵn bản
 * to cho mọi ảnh thì tốn mạng vô ích với khách chỉ lướt qua. Nên chỉ khi khách
 * phóng to lần đầu mới gọi bản lớn, và chỉ hiện nó khi đã tải xong: trong lúc
 * chờ, ảnh cũ vẫn nằm bên dưới nên không chớp trắng.
 *
 * `srcs` thử lần lượt: ảnh gốc trước (nét nhất, không bị Google nén lại), hỏng
 * thì lùi sang bản render lớn. Trước đây chỉ có một địa chỉ — hỏng là lớp này
 * im lặng không hiện và khách cứ nhìn ảnh nhỏ bên dưới.
 *
 * Đặt BÊN TRONG khung PhotoZoom (cùng khung `relative` với ảnh gốc) để bị thu
 * phóng/kéo cùng ảnh; `inset-0 object-contain` trùng khít ảnh bên dưới.
 */
export default function ZoomHiRes({
  srcs,
  active,
  className,
  onLoadingChange,
}: {
  srcs: string[];
  active: boolean;
  className?: string;
  /** Báo đang tải bản gốc (true) / xong hoặc bỏ cuộc (false) — để hiện chỉ báo. */
  onLoadingChange?: (loading: boolean) => void;
}) {
  // Đã phóng to một lần thì giữ bản lớn — thu nhỏ về 1 vẫn nét, và lần phóng
  // sau không phải tải lại.
  const [wanted, setWanted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [idx, setIdx] = useState(0);
  if (active && !wanted) setWanted(true);
  // Báo cho cha trong effect — gọi setState của cha ngay lúc render là React cảnh báo.
  const report = useRef(onLoadingChange);
  report.current = onLoadingChange;
  useEffect(() => {
    if (wanted) report.current?.(true);
  }, [wanted]);
  if (!wanted || idx >= srcs.length) return null;
  return (
    <img
      key={srcs[idx]}
      src={srcs[idx]}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      onLoad={() => {
        setLoaded(true);
        report.current?.(false);
      }}
      onError={() => {
        if (idx + 1 >= srcs.length) report.current?.(false);
        setIdx(idx + 1);
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={`pointer-events-none absolute inset-0 h-full w-full select-none object-contain ${className ?? ""}`}
      style={{ opacity: loaded ? 1 : 0, transition: "opacity .2s ease" }}
    />
  );
}
