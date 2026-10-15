"use client";

import { useEffect, useRef, useState } from "react";

type Anim = "up" | "zoom" | "left" | "right" | "fade" | "blur" | "rotate" | "clip" | "wipe" | "iris" | "focus";

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
    // Ba kiểu cho ẢNH: kéo màn ngang, mở tròn từ giữa, và lấy nét (ảnh phóng to
    // mờ nhoè rồi thu về nét căng như ống kính vừa bắt nét).
    wipe: "none",
    iris: "none",
    focus: "scale(1.06)",
  };
  const mask: Partial<Record<Anim, [string, string]>> = {
    clip: ["inset(0 0 100% 0)", "inset(0 0 0 0)"],
    wipe: ["inset(0 100% 0 0)", "inset(0 0 0 0)"],
    iris: ["circle(0% at 50% 50%)", "circle(75% at 50% 50%)"],
  };

  return (
    <div
      ref={ref}
      className={`wed-reveal ${className}`.trim()}
      style={{
        ...style,
        transform: shown ? "none" : hidden[anim],
        opacity: shown || anim === "wipe" || anim === "iris" ? 1 : 0,
        filter: (anim === "blur" || anim === "focus") && !shown ? `blur(${anim === "focus" ? 12 : 9}px)` : undefined,
        clipPath: mask[anim] ? mask[anim]![shown ? 1 : 0] : undefined,
        transition:
          `opacity .7s ease ${delay}ms, transform ${anim === "focus" ? 1.3 : 0.8}s cubic-bezier(.16,.8,.3,1) ${delay}ms,`
          + ` filter ${anim === "focus" ? 1.1 : 0.8}s ease ${delay}ms, clip-path ${anim === "iris" ? 1.2 : 0.9}s cubic-bezier(.16,.8,.3,1) ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
