"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

type NavItem = { id: string; label: string };

/**
 * Menu cho website studio (SiteRenderer) — bố cục tham khảo vieetjk.com:
 *  - Header dán trên (kính mờ), nội dung căn giữa theo bề rộng trang.
 *  - Desktop: logo trái · link giữa (mục đang xem có gạch chân màu nhấn) · nút Đặt lịch.
 *  - Mobile: logo · nút ☰ mở bảng menu tràn ngang, mỗi mục một dòng có kẻ mảnh.
 * Mục đang xem được dò bằng IntersectionObserver nên menu luôn phản ánh vị trí
 * cuộn thực tế của khách.
 */
export default function SiteNav({
  items, bookingHref, logo, name, bottom = false, fontVar, maxWidth,
}: {
  items: NavItem[];
  bookingHref?: string | null;
  logo?: string | null;
  name: string;
  bottom?: boolean;
  fontVar?: string;
  /** Bề rộng khối nội dung của trang (khớp menu với thân trang). */
  maxWidth?: number | string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  // Dò khối đang hiển thị để bật gạch chân đúng mục đang xem.
  useEffect(() => {
    if (!items.length || typeof IntersectionObserver === "undefined") return;
    const nodes = items
      .map((n) => document.getElementById(`sec-${n.id}`))
      .filter((el): el is HTMLElement => !!el);
    if (!nodes.length) return;
    const seen = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        let best: string | null = null, ratio = 0;
        for (const [id, r] of seen) if (r > ratio) { ratio = r; best = id; }
        if (best) setActive(best.replace(/^sec-/, ""));
      },
      { rootMargin: "-25% 0px -55% 0px", threshold: [0, 0.15, 0.4, 0.75, 1] },
    );
    nodes.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  const brand = logo ? (
    <img src={logo} alt={name} />
  ) : (
    <span className="s-brand-name" style={{ fontFamily: fontVar }}>{name}</span>
  );

  const link = (n: NavItem, onClick?: () => void) => (
    <a
      key={n.id}
      href={`#sec-${n.id}`}
      className={`s-navlink${active === n.id ? " is-active" : ""}`}
      onClick={onClick}
    >
      {n.label}
    </a>
  );

  return (
    <header className={`s-hdr${bottom ? " s-hdr--bottom" : ""}`} style={maxWidth ? ({ "--s-navw": typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth } as React.CSSProperties) : undefined}>
      <div className="s-hdr-in">
        <a href="#top" className="s-brand" aria-label={name}>{brand}</a>

        <nav className="s-nav-desktop">{items.map((n) => link(n))}</nav>

        <div className="s-hdr-right">
          {bookingHref && <a href={bookingHref} className="s-cta">Đặt lịch</a>}
          {items.length > 0 && (
            <button type="button" className="s-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="s-mobile-menu">
          {items.map((n) => link(n, () => setOpen(false)))}
          {bookingHref && <a href={bookingHref} className="s-cta" onClick={() => setOpen(false)}>Đặt lịch</a>}
        </div>
      )}
    </header>
  );
}
