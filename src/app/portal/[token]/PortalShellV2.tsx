"use client";

import Link from "next/link";
import { CalendarHeart, Images, LayoutDashboard, Loader2, Lock, Wallet, type LucideIcon } from "lucide-react";
import { CustomerHeaderV2, CustomerRootV2 } from "@/components/v2/customer";
import { Callout, btn, inputCls } from "@/components/v2/kit";
import type { StudioBrandInfo } from "@/lib/studio-brand";

/* ═══════════════════════════════════════════════════════════════════════════
   KHUNG CHUNG của cổng khách giao diện mới — dùng cho cả cổng hợp đồng
   (/portal/<token>) lẫn kế hoạch cưới (/portal/<token>/ke-hoach), để hai trang
   đọc như MỘT app: cùng đầu trang thương hiệu, cùng cổng nhập SĐT, cùng thanh
   tab đáy trên điện thoại (Tổng quan · Thanh toán · Ảnh & video · Kế hoạch).
   ═══════════════════════════════════════════════════════════════════════════ */

export type PortalTabKey = "home" | "pay" | "media" | "plan";

/** Mục tab ↔ phần băm trên URL: tab đáy ở trang kế hoạch mở đúng tab cổng khách. */
export const PORTAL_TAB_HASH: Record<Exclude<PortalTabKey, "plan">, string> = {
  home: "",
  pay: "#thanh-toan",
  media: "#anh-video",
};

export const PORTAL_TAB_DEF: Record<PortalTabKey, { label: string; short: string; icon: LucideIcon }> = {
  home: { label: "Tổng quan", short: "Tổng quan", icon: LayoutDashboard },
  pay: { label: "Thanh toán", short: "Thanh toán", icon: Wallet },
  media: { label: "Ảnh & video", short: "Ảnh & video", icon: Images },
  plan: { label: "Kế hoạch cưới", short: "Kế hoạch", icon: CalendarHeart },
};

/** Màn chờ khi đang tự mở bằng số đã nhớ trên máy. */
export function PortalLoadingV2({ brand, theme, text }: { brand: StudioBrandInfo; theme: "light" | "dark"; text: string }) {
  return (
    <CustomerRootV2 theme={theme}>
      <CustomerHeaderV2 brand={brand} />
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4">
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--ac)" }} />
        <p className="text-[13.5px]" style={{ color: "var(--tx3)" }}>{text}</p>
      </div>
    </CustomerRootV2>
  );
}

/** Cổng nhập số điện thoại — một việc duy nhất, một nút chính. */
export function PortalGateV2({
  brand, theme, icon: Icon = Lock, title, desc, phone, setPhone, err, loading, onSubmit, submitLabel, note, footer,
}: {
  brand: StudioBrandInfo;
  theme: "light" | "dark";
  icon?: LucideIcon;
  title: string;
  desc: string;
  phone: string;
  setPhone: (v: string) => void;
  err: string | null;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  note?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <CustomerRootV2 theme={theme}>
      <CustomerHeaderV2 brand={brand} />
      <main
        className="mx-auto flex w-full max-w-[440px] flex-col justify-center pb-16 pt-10 sm:pt-16"
        style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}
      >
        <form onSubmit={onSubmit} className="v2-card v2-card-pad flex flex-col gap-4 sm:!px-7 sm:!py-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
            <Icon size={22} />
          </span>
          <div>
            <h1 className="text-[21px] font-bold" style={{ letterSpacing: "-.4px" }}>{title}</h1>
            <p className="mt-1 text-[14px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{desc}</p>
          </div>
          <label className="v2-field">
            <span className="v2-label">Số điện thoại</span>
            <input
              className={`${inputCls} !h-12 text-[16px] font-semibold tracking-wide`}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="09xx xxx xxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          {err ? <Callout tone="red" title={err} /> : null}
          <button type="submit" disabled={loading} className={btn("primary", "lg", "w-full")}>
            {loading ? <Loader2 size={17} className="animate-spin" /> : null}
            {loading ? "Đang mở…" : submitLabel}
          </button>
          {note ? <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--tx3)" }}>{note}</p> : null}
        </form>
        {footer ? <div className="mt-4 flex justify-center">{footer}</div> : null}
      </main>
    </CustomerRootV2>
  );
}

/**
 * Thanh tab đáy (chỉ trên điện thoại / máy tính bảng nhỏ). Mỗi mục là nút
 * (đổi tab trong trang) hoặc link (sang trang kia của cùng app).
 */
export function PortalTabBarV2({
  items,
}: {
  items: { key: string; label: string; icon: LucideIcon; active: boolean; href?: string; onClick?: () => void }[];
}) {
  return (
    <>
      {/* Chừa chỗ cho thanh đáy để nội dung cuối trang không bị che. */}
      <div className="h-[64px] md:hidden" aria-hidden />
      <nav
        className="fixed inset-x-0 bottom-0 z-30 md:hidden"
        style={{
          background: "var(--topbar)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderTop: "1px solid var(--bd)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        aria-label="Các phần của trang"
      >
        <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}>
          {items.map((it) => {
            const inner = (
              <>
                <span
                  className="flex h-8 w-12 items-center justify-center rounded-full transition-colors"
                  style={{ background: it.active ? "var(--acS)" : "transparent" }}
                >
                  <it.icon size={20} strokeWidth={it.active ? 2.2 : 1.9} />
                </span>
                <span className="max-w-full truncate px-0.5 text-[11px]" style={{ fontWeight: it.active ? 650 : 500 }}>{it.label}</span>
              </>
            );
            const cls = "flex min-w-0 flex-col items-center gap-1 pb-2 pt-2";
            const style = { color: it.active ? "var(--ac)" : "var(--tx3)" };
            return it.href ? (
              <Link key={it.key} href={it.href} className={cls} style={style} aria-current={it.active ? "page" : undefined}>
                {inner}
              </Link>
            ) : (
              <button key={it.key} type="button" onClick={it.onClick} className={cls} style={style} aria-current={it.active ? "page" : undefined}>
                {inner}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

/** Thanh tab trên máy tính (từ md trở lên): nút đổi tab + link sang trang kia. */
export function PortalTopTabsV2({
  items,
}: {
  items: { key: string; label: string; icon: LucideIcon; active: boolean; href?: string; onClick?: () => void; count?: number }[];
}) {
  return (
    <div className="v2-tabs" role="tablist" aria-label="Các phần của trang">
      {items.map((it) =>
        it.href ? (
          <Link key={it.key} href={it.href} className={`v2-tab ${it.active ? "is-on" : ""}`} aria-current={it.active ? "page" : undefined}>
            <it.icon size={16} /> {it.label}
          </Link>
        ) : (
          <button key={it.key} type="button" role="tab" aria-selected={it.active} onClick={it.onClick} className={`v2-tab ${it.active ? "is-on" : ""}`}>
            <it.icon size={16} /> {it.label}
            {it.count !== undefined ? <span className="v2-tab-count">{it.count}</span> : null}
          </button>
        ),
      )}
    </div>
  );
}
