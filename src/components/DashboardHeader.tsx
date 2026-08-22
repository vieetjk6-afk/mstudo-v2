"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, ChevronDown, LayoutDashboard, UserCircle, Settings, Gift, LogOut, ShieldCheck } from "lucide-react";
import Brand from "@/components/Brand";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import StudioSearch from "@/components/StudioSearch";
import { useLang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { appUrl, mainUrl } from "@/lib/hosts";
import { effectivePlan, studioTier, STUDIO_TIER_RANK, type StudioTier } from "@/lib/plans";
import { APP_VERSION } from "@/lib/version";
import type { Profile } from "@/lib/types";

interface NavLink {
  href: string;
  label: string;
  external?: boolean;
  tier?: StudioTier; // min studio tier needed to see this item (default "full")
}
interface NavGroup {
  label: string;
  children: NavLink[];
  tier?: StudioTier; // min studio tier needed to see this group (default "full")
}
const isGroup = (x: NavLink | NavGroup): x is NavGroup => "children" in x;

export default function DashboardHeader({
  profile,
  kind = "app",
}: {
  profile: Profile;
  kind?: "app" | "img" | "admin";
}) {
  const { t } = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  // Đóng menu thả xuống khi chuyển trang (tránh dropdown "kẹt" mở).
  useEffect(() => {
    setOpenGroup(null);
  }, [pathname]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Studio-module access level. Staff belong to a full Studio account, so they
  // inherit the full tier; otherwise it's derived from the user's own plan.
  const tier: StudioTier = profile.studio_owner_id
    ? "full"
    : studioTier(effectivePlan(profile.plan, profile.plan_expires_at), profile.role === "admin");
  // Photographer = booking tier (đặt lịch / bảng giá / lịch chụp), Studio = full.
  const hasStudio = tier !== "none";

  // Personal site builder: photographer + studio plans (and admins).
  const hasSite =
    profile.role === "admin" ||
    ["photographer", "photographer_plus", "studio"].includes(effectivePlan(profile.plan, profile.plan_expires_at));

  // Effective studio role of the logged-in user (for menu gating).
  const studioRole = profile.studio_owner_id
    ? profile.studio_role || "staff"
    : profile.role === "admin"
    ? "admin"
    : "owner";

  // Studio nav grouped into dropdowns to keep the bar tidy. Each group/link
  // carries the minimum tier needed to see it (booking = Photographer plan).
  const studioNav: (NavLink | NavGroup)[] = [
    { href: "/dashboard/studio", label: "Tổng quan", tier: "booking" },
    {
      label: "Đặt lịch & Khách",
      tier: "booking",
      children: [
        { href: "/dashboard/studio/bookings", label: "Đặt lịch" },
        { href: "/dashboard/studio/calendar", label: "Lịch chụp" },
        { href: "/dashboard/studio/pricing", label: "Bảng giá" },
        { href: "/dashboard/studio/quotes", label: "Báo giá" },
        { href: "/dashboard/studio/clients", label: "Khách hàng" },
        { href: "/dashboard/studio/leads", label: "Lead website" },
        { href: "/dashboard/studio/chatbox", label: "Cấu hình chatbox" },
        { href: "/dashboard/albums", label: "Thư viện album" },
      ],
    },
    { href: "/dashboard/studio/board", label: "Bảng" },
    {
      label: "Hợp đồng",
      children: [
        { href: "/dashboard/studio/contracts", label: "Hợp đồng" },
        { href: "/dashboard/studio/production", label: "Xử lý hình ảnh" },
        { href: "/dashboard/studio/services", label: "Dịch vụ & mẫu HĐ" },
      ],
    },
    {
      label: "Tài chính",
      children: [
        { href: "/dashboard/studio/payroll", label: "Bảng lương" },
        { href: "/dashboard/studio/reports", label: "Thu chi" },
      ],
    },
    {
      label: "Đội ngũ",
      children: [
        { href: "/dashboard/studio/team", label: "Lịch đội" },
        { href: "/dashboard/studio/staff?tab=crew", label: "Sổ thợ" },
        { href: "/dashboard/studio/ranking", label: "Xếp hạng" },
        { href: "/dashboard/studio/messages", label: "Mẫu tin" },
        ...(studioRole === "owner" || studioRole === "admin"
          ? [{ href: "/dashboard/studio/staff", label: "Nhân viên" }]
          : []),
      ],
    },
    {
      label: "Công cụ",
      tier: "booking",
      children: [
        { href: "/dashboard/albums", label: t("myAlbums") },
        { href: "/dashboard/create", label: t("newAlbum") },
        { href: "/dashboard/filter", label: t("filterPhotos") },
        { href: "/dashboard/compress", label: t("compressPhotos") },
      ],
    },
    ...(hasSite ? [{ href: "/dashboard/site", label: "Trang web riêng", tier: "booking" as const }] : []),
  ];

  // Visibility: by tier (Photographer only sees booking-tier items), then by
  // role (accountant → overview + finance only; staff → hide finance).
  const studioVisible = studioNav.filter((item) => {
    if (STUDIO_TIER_RANK[item.tier ?? "full"] > STUDIO_TIER_RANK[tier]) return false;
    const label = item.label;
    if (studioRole === "accountant") return label === "Tổng quan" || label === "Tài chính";
    if (studioRole === "staff") return label !== "Tài chính";
    return true;
  });

  // Show studio nav when browsing any studio path (regardless of host) — but
  // only for accounts that actually have a studio tier. Free/Basic have no
  // studio access, so on shared paths like /dashboard/albums they must keep the
  // standard tools nav (albums, create, filter, compress); otherwise the
  // tier-filtered studio nav renders empty and their menu disappears.
  const isOnStudio =
    hasStudio &&
    (pathname.startsWith("/dashboard/studio") || pathname.startsWith("/dashboard/albums"));

  // Album / filter / compress grouped under one "Công cụ" dropdown inside the
  // studio nav (visible when isOnStudio). On the album side the links stay flat.
  const appToolsGroup: NavGroup = {
    label: "Công cụ",
    children: [
      { href: "/dashboard/albums", label: t("myAlbums") },
      { href: "/dashboard/create", label: t("newAlbum") },
      { href: "/dashboard/filter", label: t("filterPhotos") },
      { href: "/dashboard/compress", label: t("compressPhotos") },
    ],
  };

  // Build the link set for this host. Cross-host links use absolute URLs.
  // Album page always keeps a flat list — "Quản lý" is a separate button.
  const links: NavLink[] =
    kind === "img"
      ? [
          { href: "/dashboard/compress", label: t("compressPhotos") },
          { href: "/dashboard/create", label: t("newAlbum") },
          { href: "/dashboard/filter", label: t("filterPhotos") },
          { href: appUrl("/dashboard/albums"), label: t("myAlbums"), external: true },
        ]
      : kind === "admin"
      ? [
          { href: "/dashboard/admin", label: t("admin") },
          { href: "/dashboard/settings", label: t("settings") },
          { href: appUrl("/dashboard/albums"), label: t("myAlbums"), external: true },
        ]
      : [
          { href: "/dashboard/albums", label: t("myAlbums") },
          { href: "/dashboard/create", label: t("newAlbum") },
          { href: "/dashboard/filter", label: t("filterPhotos") },
          { href: "/dashboard/compress", label: t("compressPhotos") },
          ...(hasSite ? [{ href: "/dashboard/site", label: "Trang web" }] : []),
          ...(profile.role !== "admin" ? [{ href: "/dashboard/upgrade", label: t("upgrade") }] : []),
          ...(profile.role === "admin"
            ? [
                { href: "/dashboard/admin", label: t("admin") },
                { href: "/dashboard/settings", label: t("settings") },
              ]
            : []),
        ];

  function renderLink(l: NavLink, onClick?: () => void) {
    const active = !l.external && pathname === l.href;
    const cls = `text-sm transition-colors ${active ? "text-accent" : "text-accent-muted hover:text-accent"}`;
    if (l.external) {
      return (
        <a key={l.href} href={l.href} onClick={onClick} className={cls}>
          {l.label}
        </a>
      );
    }
    return (
      <Link key={l.href} href={l.href} onClick={onClick} className={cls}>
        {l.label}
      </Link>
    );
  }

  function renderGroup(g: NavGroup) {
    const active = g.children.some((c) => pathname === c.href);
    const isOpen = openGroup === g.label;
    return (
      <div key={g.label} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => setOpenGroup((cur) => (cur === g.label ? null : g.label))}
          className={`flex items-center gap-1 text-sm transition-colors ${active || isOpen ? "text-accent" : "text-accent-muted hover:text-accent"}`}
        >
          {g.label}
          <ChevronDown size={13} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
        {isOpen && (
          <>
            {/* Lớp phủ vô hình để bấm ra ngoài là đóng (giống menu avatar). */}
            <div className="fixed inset-0 z-30" onClick={() => setOpenGroup(null)} />
            <div className="absolute left-0 top-full z-40 pt-2">
              <div className="grid min-w-[180px] gap-1 rounded-xl p-2 shadow-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                {g.children.map((c) => {
                  const cls = `rounded-lg px-3 py-1.5 text-sm transition-colors ${pathname === c.href ? "text-accent" : "text-accent-muted hover:bg-[var(--surface2)] hover:text-accent"}`;
                  return c.external ? (
                    <a key={c.href} href={c.href} onClick={() => setOpenGroup(null)} className={cls}>{c.label}</a>
                  ) : (
                    <Link key={c.href} href={c.href} onClick={() => setOpenGroup(null)} className={cls}>{c.label}</Link>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <header className="sticky top-0 z-20 border-b border-ink-800 bg-ink-950/80 px-6 py-4 backdrop-blur md:px-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Brand href={kind === "img" ? "/" : isOnStudio ? "/dashboard/studio" : "/dashboard"} />
          <nav className="hidden items-center gap-x-5 gap-y-1.5 md:flex md:flex-wrap">
            {isOnStudio
              ? studioVisible.map((item) => (isGroup(item) ? renderGroup(item) : renderLink(item)))
              : links.map((l) => renderLink(l))}
          </nav>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          {/* Separate management button so studio/photographer users can jump to
              the studio workspace from the album & other pages at a glance. */}
          {hasStudio && !isOnStudio && (
            <a
              href={mainUrl("/dashboard/studio")}
              className="btn-primary hidden px-3 py-1.5 text-xs sm:inline-flex"
            >
              <LayoutDashboard size={14} /> {tier === "full" ? "Quản lý Studio" : "Quản lý"}
            </a>
          )}
          {isOnStudio && (
            <div className="hidden sm:block">
              <StudioSearch />
            </div>
          )}
          {isOnStudio && <NotificationBell />}
          <span className="hidden text-xs text-accent-muted sm:inline">
            {profile.full_name || profile.email}
            {profile.role === "admin" && (
              <span className="ml-2 rounded bg-accent-gold/20 px-1.5 py-0.5 text-[10px] uppercase text-accent-gold">
                admin
              </span>
            )}
          </span>
          {/* Thông báo "giao diện 2.0 sắp ra mắt" (và là nút chuyển khi đã mở) */}
          <LanguageSwitcher />
          <ThemeToggle />

          {/* Avatar dropdown */}
          <div ref={avatarRef} className="relative">
            <button
              onClick={() => setAvatarOpen((o) => !o)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
              aria-label="Tài khoản"
            >
              {(profile.full_name || profile.email || "?").charAt(0).toUpperCase()}
            </button>
            {avatarOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setAvatarOpen(false)} />
                <div
                  className="absolute right-0 top-full z-40 mt-2 min-w-[200px] rounded-xl p-1.5 shadow-xl"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="mb-1 border-b px-3 pb-2 pt-1" style={{ borderColor: "var(--border)" }}>
                    <p className="text-[13px] font-medium">{profile.full_name || profile.email}</p>
                    {profile.full_name && <p className="text-[11px]" style={{ color: "var(--text3)" }}>{profile.email}</p>}
                  </div>
                  {[
                    { href: "/dashboard/affiliate", label: "Affiliate", icon: Gift, external: false },
                    { href: "/dashboard/settings", label: t("settings"), icon: Settings, external: false },
                    ...(profile.role === "admin" ? [{ href: "/dashboard/admin/system", label: "Hệ thống", icon: ShieldCheck, external: false }, { href: "/dashboard/admin/affiliate", label: "Quản lý Affiliate", icon: ShieldCheck, external: false }] : []),
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setAvatarOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-[var(--surface2)]"
                      style={{ color: "var(--text2)" }}
                    >
                      <Icon size={14} />
                      {label}
                    </Link>
                  ))}
                  <div className="mt-1 border-t pt-1" style={{ borderColor: "var(--border)" }}>
                    <button
                      onClick={() => { setAvatarOpen(false); signOut(); }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-[var(--surface2)]"
                      style={{ color: "var(--text2)" }}
                    >
                      <LogOut size={14} />
                      {t("logout")}
                    </button>
                  </div>
                  <p className="px-3 pt-1.5 text-[11px]" style={{ color: "var(--text3)" }}>
                    Phiên bản {APP_VERSION}
                  </p>
                </div>
              </>
            )}
          </div>
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="btn-ghost p-1.5 md:hidden"
            aria-label="Menu"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <nav className="mt-3 grid gap-1 border-t border-ink-800 pt-3 md:hidden">
          {isOnStudio
            ? studioVisible.map((item) =>
                isGroup(item) ? (
                  <div key={item.label} className="py-1.5">
                    <p className="mb-1 text-[11px] uppercase tracking-wide" style={{ color: "var(--text3)" }}>{item.label}</p>
                    <div className="grid gap-1.5 pl-3">
                      {item.children.map((c) => renderLink(c, () => setMenuOpen(false)))}
                    </div>
                  </div>
                ) : (
                  <div key={item.href} className="py-1.5">{renderLink(item, () => setMenuOpen(false))}</div>
                )
              )
            : (
              <>
                {hasStudio && (
                  <a
                    href={mainUrl("/dashboard/studio")}
                    onClick={() => setMenuOpen(false)}
                    className="mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
                    style={{ background: "var(--brand, var(--accent))", color: "var(--brandFg, var(--accentInk))" }}
                  >
                    <LayoutDashboard size={15} /> {tier === "full" ? "Quản lý Studio" : "Quản lý"}
                  </a>
                )}
                {links.map((l) => (
                  <div key={l.href} className="py-1.5">
                    {renderLink(l, () => setMenuOpen(false))}
                  </div>
                ))}
              </>
            )}
        </nav>
      )}
    </header>
  );
}
