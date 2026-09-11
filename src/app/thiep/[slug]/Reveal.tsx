"use client";

import { useEffect, useRef, useState } from "react";

type Anim = "up" | "zoom" | "left" | "right" | "fade" | "blur" | "rotate" | "clip";

/**
 * Scroll-reveal wrapper: children start hidden and animate in when they enter
 * the viewport (IntersectionObserver). Pure CSS transition — no library.
 */
export default function Reveal({
  children,
  anim = "up",
  delay = 0,
  className = "",
  style,
}: {
  children: React.ReactNode;
  anim?: Anim;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Không có IntersectionObserver (trình duyệt cũ) → hiện luôn, đừng giấu nội dung.
    if (typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) { setShown(true); io.disconnect(); }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    // Chốt chặn: thiệp cưới KHÔNG được phép mất chữ. Nếu vì lý do nào đó
    // observer không bắn (khối cao hơn màn hình, trình duyệt lạ, khung cuộn
    // đặc biệt) thì sau 2,5 giây cứ hiện ra.
    const cuu = setTimeout(() => { setShown(true); io.disconnect(); }, 2500);
    return () => { clearTimeout(cuu); io.disconnect(); };
  }, []);

  const hidden: Record<Anim, string> = {
    up: "translateY(34px)",
    zoom: "scale(0.94)",
    left: "translateX(-40px)",
    right: "translateX(40px)",
    fade: "none",
    // Ba kiểu thêm cho bộ thiệp điện thoại: mực loang, dán lệch, và kéo màn ảnh.
    blur: "translateY(18px)",
    rotate: "rotate(-3.5deg) translateY(26px) scale(.97)",
    clip: "none",
  };

  return (
    <div
      ref={ref}
      className={`wed-reveal ${className}`.trim()}
      style={{
        ...style,
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : hidden[anim],
        filter: anim === "blur" && !shown ? "blur(9px)" : undefined,
        clipPath: anim === "clip" ? (shown ? "inset(0 0 0 0)" : "inset(0 0 100% 0)") : undefined,
        transition:
          `opacity .7s ease ${delay}ms, transform .8s cubic-bezier(.16,.8,.3,1) ${delay}ms,`
          + ` filter .8s ease ${delay}ms, clip-path .9s cubic-bezier(.16,.8,.3,1) ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
