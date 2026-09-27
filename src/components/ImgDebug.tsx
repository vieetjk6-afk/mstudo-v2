"use client";

import { useEffect, useState } from "react";

/**
 * Bảng chẩn đoán ảnh trong khung xem — chỉ hiện khi URL có `?imgdebug=1`.
 *
 * Để biết trên máy khách (iPhone, webview Zalo…) ảnh đang HIỆN THẬT là bản cỡ
 * nào: liệt kê từng <img> trong khung, bề rộng yêu cầu (w=… trong địa chỉ) và
 * bề rộng GIẢI MÃ thật (naturalWidth). Mờ mà naturalWidth nhỏ → lỗi nguồn ảnh;
 * naturalWidth lớn mà vẫn mờ → lỗi cách vẽ khi phóng to.
 */
export default function ImgDebug({ stageRef }: { stageRef: React.RefObject<HTMLElement | null> }) {
  const [on, setOn] = useState(false);
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    setOn(new URLSearchParams(window.location.search).get("imgdebug") === "1");
  }, []);

  useEffect(() => {
    if (!on) return;
    const tick = () => {
      const stage = stageRef.current;
      const out = [`dpr ${window.devicePixelRatio} · vw ${window.innerWidth}`];
      stage?.querySelectorAll("img").forEach((im, i) => {
        const u = im.currentSrc || im.src;
        const q = u.includes("?") ? u.slice(u.indexOf("?") + 1).replace(/id=[^&]+&?/, "") : u.slice(-40);
        const bg = im.style.backgroundImage ? " +bg" : "";
        out.push(
          `#${i} ${q || "-"} → ${im.complete ? (im.naturalWidth ? `${im.naturalWidth}×${im.naturalHeight}` : "LỖI") : "đang tải"} · hiện ${Math.round(im.getBoundingClientRect().width)}px · op ${getComputedStyle(im).opacity}${bg}`
        );
      });
      setLines(out);
    };
    tick();
    const t = setInterval(tick, 700);
    return () => clearInterval(t);
  }, [on, stageRef]);

  if (!on) return null;
  return (
    <div
      className="pointer-events-none absolute left-1 top-1 z-30 max-w-[95%] whitespace-pre-wrap break-all rounded px-2 py-1 font-mono text-[10px] leading-snug"
      style={{ background: "rgba(0,0,0,.75)", color: "#7CFC00" }}
    >
      {lines.join("\n")}
    </div>
  );
}
