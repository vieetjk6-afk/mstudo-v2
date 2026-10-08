"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

export type NavItem = { href: string; label: string; active?: boolean };

/** Nút ☰ + bảng menu trên điện thoại. Bấm một mục là tự đóng. */
export default function MobileNav({ items, cta }: { items: NavItem[]; cta: NavItem }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="va-burger"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="va-mobnav"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && (
        <nav id="va-mobnav" className="va-mobnav" aria-label="Main menu">
          {items.map((it) => (
            <a key={it.href} href={it.href} className={it.active ? "active" : undefined} onClick={() => setOpen(false)}>
              {it.label}
            </a>
          ))}
          <a href={cta.href} className="va-btn va-btn-primary" onClick={() => setOpen(false)}>
            {cta.label}
          </a>
        </nav>
      )}
    </>
  );
}
