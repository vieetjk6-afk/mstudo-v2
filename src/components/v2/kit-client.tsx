"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { MoreHorizontal, Search, X, type LucideIcon } from "lucide-react";

/* Phần CÓ TƯƠNG TÁC của bộ khối giao diện mới — xem ./kit.tsx cho luật chung. */

function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(" ");
}

/* ── Menu ⋯ ──────────────────────────────────────────────────────────────── */
export type MenuItem =
  | {
      label: React.ReactNode;
      icon?: LucideIcon;
      onClick?: () => void;
      href?: string;
      /** Mở tab mới (link ra trang khách). */
      external?: boolean;
      danger?: boolean;
      disabled?: boolean;
      hint?: React.ReactNode;
    }
  | "divider";

/**
 * Menu thả xuống cho thao tác phụ. Mặc định nút kích hoạt là "⋯"; truyền
 * `trigger` để dùng nút khác (vd nút "Tạo mới ▾").
 */
export function Menu({
  items,
  label = "Thêm thao tác",
  trigger,
  align = "right",
  width = 220,
}: {
  items: MenuItem[];
  label?: string;
  trigger?: (p: { open: boolean; toggle: () => void }) => React.ReactNode;
  align?: "left" | "right";
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const toggle = () => setOpen((v) => !v);
  return (
    <div ref={ref} className="relative inline-flex flex-none">
      {trigger ? (
        trigger({ open, toggle })
      ) : (
        <button type="button" onClick={toggle} aria-label={label} title={label} aria-expanded={open} className="v2-icon-btn">
          <MoreHorizontal size={18} />
        </button>
      )}
      {open && (
        <div
          role="menu"
          className="v2-menu-pop"
          style={{ width, [align === "right" ? "right" : "left"]: 0 }}
        >
          {items.map((it, i) => {
            if (it === "divider") return <div key={i} className="v2-menu-div" />;
            const Icon = it.icon;
            const body = (
              <>
                {Icon ? <Icon size={16} className="flex-none" /> : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{it.label}</span>
                  {it.hint ? <span className="v2-menu-hint">{it.hint}</span> : null}
                </span>
              </>
            );
            const cls = cx("v2-menu-item", it.danger && "is-danger");
            if (it.href && !it.disabled)
              return it.external ? (
                <a key={i} role="menuitem" href={it.href} target="_blank" rel="noopener noreferrer" className={cls} onClick={() => setOpen(false)}>
                  {body}
                </a>
              ) : (
                <Link key={i} role="menuitem" href={it.href} className={cls} onClick={() => setOpen(false)}>
                  {body}
                </Link>
              );
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={it.disabled}
                className={cls}
                onClick={() => {
                  setOpen(false);
                  it.onClick?.();
                }}
              >
                {body}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Nút chọn nhóm (segmented) ───────────────────────────────────────────── */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; count?: number }[];
  label?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="tablist" aria-label={label} className={cx("v2-seg", size === "sm" && "v2-seg-sm")}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(o.value)} className={cx("v2-seg-btn", on && "is-on")}>
            {o.label}
            {o.count !== undefined ? <span className="v2-seg-count">{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/* ── Tab gạch chân (chia phần lớn của một trang chi tiết) ────────────────── */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; count?: number; icon?: LucideIcon }[];
  label?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="v2-tabs">
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button key={o.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(o.value)} className={cx("v2-tab", on && "is-on")}>
            {Icon ? <Icon size={16} /> : null}
            {o.label}
            {o.count !== undefined ? <span className="v2-tab-count">{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/* ── Ô tìm kiếm ──────────────────────────────────────────────────────────── */
export function SearchInput({
  value,
  onChange,
  placeholder = "Tìm…",
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className={cx("v2-search", className)}>
      <Search size={16} className="flex-none" style={{ color: "var(--tx3)" }} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
      />
      {value ? (
        <button type="button" onClick={() => onChange("")} aria-label="Xoá tìm kiếm" className="flex-none" style={{ color: "var(--tx3)" }}>
          <X size={15} />
        </button>
      ) : null}
    </label>
  );
}

/* ── Công tắc ────────────────────────────────────────────────────────────── */
export function Switch({
  checked,
  onChange,
  label,
  desc,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  desc?: React.ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="v2-switch-row">
      {label ? (
        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
          <span className="block text-[13.5px] font-medium">{label}</span>
          {desc ? <span className="block text-[12px]" style={{ color: "var(--tx3)" }}>{desc}</span> : null}
        </label>
      ) : null}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx("v2-switch", checked && "is-on")}
      >
        <span />
      </button>
    </div>
  );
}

/* ── Lớp phủ dùng chung cho Drawer / Modal ───────────────────────────────── */
function useOverlay(open: boolean, onClose: () => void) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  return mounted;
}

/**
 * Ngăn kéo bên phải (điện thoại: trượt từ đáy lên). Dùng để XEM NHANH một dòng
 * hoặc chứa bộ lọc phụ — không bắt người dùng rời trang danh sách.
 *
 * Render qua portal ra <body> nhưng vẫn mang lớp `studio-shell ui-v2` để nhận
 * đúng token màu (portal nằm ngoài khung nên không tự thừa hưởng).
 */
export function Drawer({
  open,
  onClose,
  title,
  desc,
  children,
  footer,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  desc?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  const mounted = useOverlay(open, onClose);
  if (!mounted || !open) return null;
  const theme = document.documentElement.dataset.theme;
  const ac = getComputedStyle(document.querySelector(".ui-v2") ?? document.documentElement).getPropertyValue("--ac-base");
  return createPortal(
    <div className="studio-shell ui-v2 v2-overlay" data-theme={theme} style={ac ? ({ ["--ac-base" as string]: ac } as React.CSSProperties) : undefined}>
      <div className="v2-overlay-bg" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} className="v2-drawer" style={{ ["--w" as string]: `${width}px` }}>
        <header className="v2-drawer-head">
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-semibold">{title}</h3>
            {desc ? <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>{desc}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="v2-icon-btn">
            <X size={18} />
          </button>
        </header>
        <div className="v2-drawer-body">{children}</div>
        {footer ? <footer className="v2-drawer-foot">{footer}</footer> : null}
      </aside>
    </div>,
    document.body,
  );
}

/** Hộp thoại giữa màn (điện thoại: bảng trượt từ đáy). */
export function Modal({
  open,
  onClose,
  title,
  desc,
  icon: Icon,
  children,
  footer,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  desc?: React.ReactNode;
  icon?: LucideIcon;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  const mounted = useOverlay(open, onClose);
  if (!mounted || !open) return null;
  const theme = document.documentElement.dataset.theme;
  const ac = getComputedStyle(document.querySelector(".ui-v2") ?? document.documentElement).getPropertyValue("--ac-base");
  return createPortal(
    <div className="studio-shell ui-v2 v2-overlay v2-overlay-center" data-theme={theme} style={ac ? ({ ["--ac-base" as string]: ac } as React.CSSProperties) : undefined}>
      <div className="v2-overlay-bg" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} className="v2-modal" style={{ maxWidth: width }}>
        <div className="flex items-start gap-3">
          {Icon ? (
            <span className="v2-section-icon" style={{ width: 40, height: 40 }}>
              <Icon size={19} />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] font-semibold">{title}</h3>
            {desc ? <p className="mt-1 text-[13.5px]" style={{ color: "var(--tx2)" }}>{desc}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="v2-icon-btn -mr-1 -mt-1">
            <X size={18} />
          </button>
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
        {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
