"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Một dòng chữ KHÔNG BAO GIỜ rớt xuống dòng: dài hơn bề ngang thì tự thu nhỏ cỡ
 * chữ cho vừa, ngắn thì giữ nguyên cỡ `size`.
 *
 * Vì sao cần: tên cô dâu chú rể / tên khách dài ngắn khác nhau ("Đức Linh &
 * Uyên Phương" dài gần gấp rưỡi "Tú & Hà"). Đặt một cỡ chữ cố định thì tên dài
 * bị bẻ làm hai hàng, chữ "Phương" rơi lẻ loi xuống dòng dưới — trông như lỗi.
 *
 * Đo bằng chính chữ đã dựng (phông thật, giãn chữ thật) chứ không ước lượng
 * theo số ký tự; đo lại khi khung đổi bề ngang (xoay máy) và khi phông web tải
 * xong (phông dự phòng hẹp/rộng hơn phông thật).
 *
 * Khung ngoài phải có bề ngang xác định (khối thường, hoặc có `width`): nếu nó
 * co theo nội dung (vd. phần tử con của flex không đặt bề ngang) thì dòng chữ
 * không bao giờ "dài hơn khung" và sẽ không thu nhỏ.
 */
export default function FitLine({
  text, size, min = 10, style, className,
}: {
  text: string;
  /** Cỡ chữ lớn nhất (px) — khi tên đủ ngắn thì giữ đúng cỡ này. */
  size: number;
  /** Cỡ chữ nhỏ nhất (px) — tên dài bất thường thì thà tràn còn hơn đọc không nổi. */
  min?: number;
  /** Style của khung (phông, màu, căn lề, khoảng cách…); `fontSize` ở đây bị bỏ qua. */
  style?: CSSProperties;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const [fs, setFs] = useState(size);

  useLayoutEffect(() => {
    const fit = () => {
      const b = box.current, t = line.current;
      if (!b || !t) return;
      const room = b.clientWidth;
      if (!room) return;
      let s = size;
      t.style.fontSize = `${s}px`;
      // Vài vòng là đủ: giãn chữ tính bằng px không co theo cỡ chữ nên lần đầu có thể còn dư.
      for (let i = 0; i < 4 && t.scrollWidth > room && s > min; i++) {
        s = Math.max(min, Math.floor(((s * room) / t.scrollWidth) * 10) / 10 - 0.3);
        t.style.fontSize = `${s}px`;
      }
      setFs(s);
    };
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    if (box.current) ro?.observe(box.current);
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) fit(); });
    return () => { alive = false; ro?.disconnect(); };
  }, [text, size, min]);

  return (
    <div ref={box} className={className} style={{ ...style, fontSize: undefined }}>
      <span ref={line} style={{ display: "inline-block", verticalAlign: "top", whiteSpace: "nowrap", fontSize: fs }}>{text}</span>
    </div>
  );
}
