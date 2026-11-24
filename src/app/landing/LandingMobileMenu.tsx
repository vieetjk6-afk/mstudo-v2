"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { lockBodyScroll } from "@/lib/scroll-lock";

type NavItem = { href: string; label: string };

/**
 * Menu điều hướng cho mobile (≤860px) của trang chủ marketing. Nav ngang và các
 * nút CTA bị ẩn trên màn nhỏ (globals.css) — island này thay thế bằng nút
 * hamburger mở danh sách liên kết + nút "Website riêng" / "Bắt đầu".
 */
export default function LandingMobileMenu({
  items,
  loginUrl,
  websiteHref,
  websiteLabel,
  startLabel,
}: {
  items: NavItem[];
  loginUrl: string;
  websiteHref: string;
  websiteLabel: string;
  startLabel: string;
}) {
  const [open, setOpen] = useState(false);

  // Đóng bằng Esc; khoá cuộn nền khi menu mở.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    const unlockScroll = lockBodyScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlockScroll();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mở menu"
        aria-expanded={open}
        className="ms-burger-btn"
        style={{
          display: "none",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--fg)",
          cursor: "pointer",
        }}
      >
        <Menu size={20} />
      </button>

      {open && (
        <div
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(0,0,0,.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <nav
            style={{
              width: "min(84vw, 320px)",
              height: "100%",
              background: "var(--bg)",
              borderLeft: "1px solid var(--border)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              overflowY: "auto",
              animation: "vkFade .25s ease both",
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng menu"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--fg)",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>
            {items.map((it) => (
              <a
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                style={{
                  padding: "13px 12px",
                  borderRadius: 10,
                  color: "var(--fg)",
                  textDecoration: "none",
                  fontSize: 15.5,
                  fontWeight: 600,
                }}
              >
                {it.label}
              </a>
            ))}
            <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
            <Link
              href={websiteHref}
              onClick={() => setOpen(false)}
              style={{
                padding: "13px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                color: "var(--fg)",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              {websiteLabel}
            </Link>
            <Link
              href={loginUrl}
              onClick={() => setOpen(false)}
              style={{
                padding: "14px 12px",
                borderRadius: 10,
                background: "var(--accent)",
                color: "var(--accentFg)",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 700,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              {startLabel}
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
