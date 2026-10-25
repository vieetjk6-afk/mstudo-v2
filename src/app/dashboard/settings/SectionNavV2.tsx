"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   Mục lục bên trái của các màn CẤU HÌNH dài ở giao diện mới (Cấu hình mstudo,
   Cài đặt hệ thống): máy tính là cột dính khi cuộn, mục đang xem được tô;
   điện thoại là một hàng nhãn cuộn ngang ở đầu trang. Bấm là cuộn tới khối.
   ═══════════════════════════════════════════════════════════════════════════ */

export type NavItem = { id: string; label: string; icon: LucideIcon; badge?: React.ReactNode };

function go(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  // Chừa chỗ cho thanh đầu trang dính (64px) + một khoảng thở.
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 84, behavior: "smooth" });
  history.replaceState(null, "", `#${id}`);
}

/** Khối nào đang ở đầu vùng nhìn. */
function useActive(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  const key = ids.join("|");
  useEffect(() => {
    const els = key.split("|").map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = els.find((el) => seen.get(el.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-90px 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [key]);
  return [active, setActive] as const;
}

export function SectionNavV2({ items, footer }: { items: NavItem[]; footer?: React.ReactNode }) {
  const [active, setActive] = useActive(items.map((i) => i.id));
  return (
    <>
      {/* Điện thoại / máy tính bảng: hàng nhãn cuộn ngang */}
      {/* Bọc div: .v2-tabs tự đặt display (độ ưu tiên cao hơn lg:hidden). */}
      <div className="min-w-0 lg:hidden">
      <nav aria-label="Các mục" className="v2-tabs">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => {
              setActive(it.id);
              go(it.id);
            }}
            className={`v2-tab ${active === it.id ? "is-on" : ""}`}
          >
            {it.label}
          </button>
        ))}
      </nav>
      </div>

      {/* Máy tính: cột trái dính */}
      <aside className="hidden lg:block">
        <nav aria-label="Các mục" className="sticky top-[84px] flex flex-col gap-0.5">
          {items.map((it) => {
            const on = active === it.id;
            const Icon = it.icon;
            return (
              <button
                key={it.id}
                type="button"
                aria-current={on ? "true" : undefined}
                onClick={() => {
                  setActive(it.id);
                  go(it.id);
                }}
                className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[13.5px] transition-colors hover:bg-[var(--sf2)]"
                style={on ? { background: "var(--acS)", color: "var(--ac)", fontWeight: 650 } : { color: "var(--tx2)", fontWeight: 500 }}
              >
                <Icon size={16} className="flex-none" />
                <span className="min-w-0 flex-1 truncate">{it.label}</span>
                {it.badge}
              </button>
            );
          })}
          {footer ? <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--bd2)" }}>{footer}</div> : null}
        </nav>
      </aside>
    </>
  );
}
