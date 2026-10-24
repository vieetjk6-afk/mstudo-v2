"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sun, Moon, MonitorSmartphone, LogOut, Menu, X as XIcon, Gift, Link2, UserCircle,
  MessageSquare, Bell, Crown, Sparkles,
} from "lucide-react";
import UiSuggestCard from "@/components/v2/UiSuggestCard";
import { setUiVersion } from "@/components/v2/ui-switch";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import StudioCommandK from "@/components/StudioCommandK";
import BranchSwitcher, { type SwitcherBranch } from "@/components/BranchSwitcher";
import StudioFooterNav from "@/components/StudioFooterNav";
import SidebarDriveStatus from "@/components/SidebarDriveStatus";
import DownloadAppButton from "@/components/DownloadAppButton";
import SyncControlButton from "@/components/SyncControlButton";
import { createClient } from "@/lib/supabase/client";
import { THEME_OPTIONS, nextPref, useTheme } from "@/lib/theme";
import { roleLabel } from "@/lib/studio-roles";
import { APP_VERSION } from "@/lib/version";
import { pageTitle } from "@/lib/studio-titles";
import { useNavBadges } from "@/lib/use-nav-badges";
import {
  isNavActive, visibleGroups,
  type NavAccess, type NavBadges, type NavGroup, type NavItem, type StudioTier,
} from "@/lib/studio-nav";
import type { ChromeProfile } from "@/lib/types";

/** Icon của từng lựa chọn giao diện — vẽ LỰA CHỌN hiện tại, không phải cái
 *  sắp tới, để nhìn nút là biết đang ở chế độ nào. */
const THEME_ICON = { light: Sun, dark: Moon, system: MonitorSmartphone } as const;

// Zalo support group for studios using the app.
const ZALO_SUPPORT_URL = "https://zalo.me/g/rycw0pqcgss14ib6u2xj";

/** Xem-như: chủ studio thử giao diện của vai trò khác (chỉ LỌC bớt, không cấp quyền).
 *  KHÔNG có "Toàn quyền chi nhánh" ở đây: vai trò đó ghim phạm vi DỮ LIỆU ở phía
 *  server, nên xem-như chỉ lọc menu sẽ vẽ ra một bức tranh sai — chủ studio tưởng
 *  mình đang thấy đúng những gì người kia thấy. */
const VIEW_ROLES: [string, string][] = [["owner", "Chủ"], ["manager", "Quản lý"], ["staff", "Nhân sự"]];

type NavProps = {
  groups: NavGroup[];
  pathname: string;
  badges: NavBadges;
  comingSoon: string[];
  isAdmin: boolean;
};

const SOON_CHIP = (
  <span className="ml-auto flex-none rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ color: "var(--ac)", background: "var(--acS)" }}>
    Sắp ra mắt
  </span>
);

/**
 * Một mục nav. `dense` = sidebar desktop (bản thiết kế: 8px 10px, chữ 13.5px);
 * ngược lại là ngăn kéo điện thoại (hit target ≥44px).
 */
function NavRow({ it, dense, pathname, badges, comingSoon, isAdmin }: NavProps & { it: NavItem; dense: boolean }) {
  const active = isNavActive(it, pathname);
  const flagged = comingSoon.includes(it.href);
  const locked = flagged && !isAdmin;
  const count = it.badge ? badges[it.badge] ?? 0 : 0;

  const cls = `nav-item mb-px flex w-full items-center rounded-[9px] ${
    dense ? "gap-2.5 px-2.5 py-2 text-[13.5px]" : "gap-3 px-3 py-2.5 text-[14.5px]"
  }${active ? " nav-active" : ""}`;
  const style: React.CSSProperties = {
    color: active ? "var(--ac)" : "var(--tx2)",
    fontWeight: active ? 700 : 550,
  };

  const inner = (
    <>
      <it.icon size={dense ? 19 : 20} style={{ flex: "none" }} />
      <span className="min-w-0 flex-1 truncate">{it.label}</span>
      {flagged ? SOON_CHIP : count > 0 ? (
        <span
          className="flex-none whitespace-nowrap rounded-[20px] px-[5px] py-[1.5px] text-center text-[10.5px] font-bold"
          style={{
            minWidth: 18,
            background: active ? "var(--ac)" : "var(--amS)",
            color: active ? "#fff" : "var(--am)",
          }}
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </>
  );

  if (locked) {
    return <div className={cls} style={{ ...style, opacity: 0.55, cursor: "not-allowed" }} title="Tính năng sắp ra mắt">{inner}</div>;
  }
  return (
    <Link href={it.href} className={cls} style={style} aria-current={active ? "page" : undefined}>
      {inner}
    </Link>
  );
}

function NavGroups({ dense, ...nav }: NavProps & { dense: boolean }) {
  return (
    <>
      {nav.groups.map((g) => (
        <div key={g.label || "root"} className={dense ? "mb-3.5" : "mb-4"}>
          {g.label && (
            <p className="mb-[5px] px-2.5 text-[10px] font-extrabold uppercase" style={{ letterSpacing: ".8px", color: "var(--tx3)" }}>
              {g.label}
            </p>
          )}
          {g.items.map((it) => <NavRow key={it.href} it={it} dense={dense} {...nav} />)}
        </div>
      ))}
    </>
  );
}

export default function StudioShell({
  profile,
  tier,
  role,
  comingSoon = [],
  hiddenNav = [],
  branches = [],
  branchSelected = null,
  branchCookie,
  branchLocked = false,
  suggestNewUi = false,
  children,
}: {
  profile: ChromeProfile;
  tier: StudioTier;
  role: string;
  comingSoon?: string[];
  hiddenNav?: string[]; // mục ẨN HOÀN TOÀN với non-admin (chưa xuất bản)
  /** Chi nhánh của studio. Rỗng → ô chọn chi nhánh không hiện gì. */
  branches?: SwitcherBranch[];
  /** null = xem gộp · "none" = chưa gán · id = một cơ sở. */
  branchSelected?: string | null;
  branchCookie?: string;
  /** Phạm vi bị vai trò ghim — ô chọn hiện dạng khoá, không bấm ra danh sách. */
  branchLocked?: boolean;
  /** Được dùng giao diện mới mà đang ở bản cũ → hiện thẻ gợi ý + mục trong menu. */
  suggestNewUi?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, pref: themePref, setTheme } = useTheme();
  // Nhãn nút giao diện trên topbar: nói cả chế độ đang dùng và chế độ sắp
  // chuyển sang, vì nút chỉ có một icon nên chữ phải gánh phần giải thích.
  const ThemeIcon = THEME_ICON[themePref];
  const themeBtnLabel = `Giao diện: ${THEME_OPTIONS.find((o) => o.pref === themePref)!.label} — bấm để chuyển sang ${THEME_OPTIONS.find((o) => o.pref === nextPref(themePref))!.label.toLowerCase()}`;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  // null = đang xem bằng đúng vai trò thật của mình.
  const [viewAs, setViewAs] = useState<string | null>(null);

  // Close drawer + avatar menu on route change
  useEffect(() => { setDrawerOpen(false); setAvatarOpen(false); }, [pathname]);

  // Chỉ chủ studio / admin mới xem-như được, và chỉ để THU HẸP những gì mình
  // thấy — quyền thật vẫn do server quyết định (xem README, mục "Phân quyền").
  const canViewAs = role === "owner" || role === "admin";
  /** Chủ studio: người duy nhất thấy gói phần mềm và affiliate trong menu avatar. */
  const isOwner = role === "owner" || role === "admin";
  const effectiveRole = canViewAs && viewAs && viewAs !== "owner" ? viewAs : role;

  const access = useMemo<NavAccess>(
    () => ({ tier, role: effectiveRole, comingSoon, hiddenNav }),
    // comingSoon/hiddenNav là mảng mới mỗi lần render ở phía cha → so bằng nội dung.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tier, effectiveRole, comingSoon.join("|"), hiddenNav.join("|")],
  );
  const groups = useMemo(() => visibleGroups(access), [access]);
  // Lối tải MStudo Desktop: gói Plus/Studio, chỉ chủ studio (trang tải chặn nhân
  // viên), và trang chưa bị ẩn vì chưa xuất bản.
  const desktopOk =
    (tier === "plus" || tier === "full") &&
    isOwner &&
    (role === "admin" || !hiddenNav.includes("/dashboard/studio/desktop"));

  const badges = useNavBadges(pathname);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const [title, sub] = pageTitle(pathname);

  const initials = (profile.full_name || profile.email || "?")
    .split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const navProps = { groups, pathname, badges, comingSoon, isAdmin: role === "admin" };

  const brandChip = (
    <span className="ml-auto flex-none rounded-[5px] px-1.5 py-[3px] text-[9.5px] font-extrabold" style={{ letterSpacing: ".6px", color: "var(--ac)", background: "var(--acS)" }}>
      {tier === "full" ? "STUDIO" : "PRO"}
    </span>
  );

  /* Menu avatar = TOÀN BỘ cụm tài khoản. Trước đây những mục này còn có thêm
     một nhóm "Tài khoản" 6 dòng ở đáy sidebar — thứ mở vài lần một tháng mà
     chiếm chỗ ngang với việc làm hằng ngày, lại trùng y hệt menu này. Sidebar
     giờ chỉ giữ việc điều hành studio; hồ sơ, gói, hoa hồng nằm ở đây. */
  const accountMenu = (
    <>
      <div className="mb-1 px-3 py-2" style={{ borderBottom: "1px solid var(--bd2)" }}>
        <p className="truncate text-[13px] font-semibold">{profile.full_name || "Tài khoản"}</p>
        <p className="truncate text-[11px]" style={{ color: "var(--tx3)" }}>{profile.email}</p>
        <p className="mt-0.5 text-[11px] font-semibold" style={{ color: "var(--ac)" }}>{roleLabel(role)}</p>
      </div>
      <Link href="/dashboard/account" className="nav-item flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium" style={{ color: "var(--tx)" }}>
        <UserCircle size={15} style={{ color: "var(--ac)" }} /> Tài khoản & bảo mật
      </Link>
      <Link href="/dashboard/studio/notifications" className="nav-item flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium" style={{ color: "var(--tx)" }}>
        <Bell size={15} style={{ color: "var(--ac)" }} /> Thông báo
        {(badges.notifications ?? 0) > 0 && (
          <span className="ml-auto rounded-[20px] px-[6px] py-[1.5px] text-[10.5px] font-bold" style={{ background: "var(--amS)", color: "var(--am)" }}>
            {(badges.notifications ?? 0) > 99 ? "99+" : badges.notifications}
          </span>
        )}
      </Link>
      <Link href="/dashboard/connections" className="nav-item flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium" style={{ color: "var(--tx)" }}>
        <Link2 size={15} style={{ color: "var(--ac)" }} /> Kết nối Calendar
      </Link>
      {/* Gói và hoa hồng chỉ CHỦ studio thấy — đúng `roles: OWNER_OK` của hai
          mục này trong studio-nav.ts. Trước đây menu avatar hiện "Gói phần mềm"
          cho cả nhân viên, bấm vào là trang chặn. */}
      {isOwner && (
        <>
          <Link href="/dashboard/upgrade" className="nav-item flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium" style={{ color: "var(--tx)" }}>
            <Crown size={15} style={{ color: "var(--am)" }} /> Gói phần mềm
          </Link>
          <Link href="/dashboard/affiliate" className="nav-item flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium" style={{ color: "var(--tx)" }}>
            <Gift size={15} style={{ color: "var(--am)" }} /> Affiliate
          </Link>
        </>
      )}
      <a href={ZALO_SUPPORT_URL} target="_blank" rel="noreferrer" className="nav-item flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium" style={{ color: "var(--tx)" }}>
        <MessageSquare size={15} style={{ color: "var(--ac)" }} /> Nhóm Zalo hỗ trợ
      </a>
      {/* Đổi ngôn ngữ nằm trong menu tài khoản: topbar của bản thiết kế chỉ có
          6 phần tử, nhét thêm một cụm nút nữa là vỡ bố cục ở màn hẹp. */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] font-medium">
        <span style={{ color: "var(--tx2)" }}>Ngôn ngữ</span>
        <LanguageSwitcher />
      </div>
      {suggestNewUi && (
        <button
          onClick={() => { setUiVersion("v2"); router.refresh(); }}
          className="nav-item flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-semibold"
          style={{ color: "#0b5cc4" }}
        >
          <Sparkles size={15} /> Dùng giao diện mới
        </button>
      )}
      <div className="my-1" style={{ borderTop: "1px solid var(--bd2)" }} />
      <button onClick={signOut} className="nav-item flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium" style={{ color: "var(--rd)" }}>
        <LogOut size={15} /> Đăng xuất
      </button>
      <p className="px-3 pt-1.5 text-[11px]" style={{ color: "var(--tx3)" }}>Phiên bản {APP_VERSION}</p>
    </>
  );

  return (
    <div className="studio-shell" data-theme={theme} style={{ background: "var(--bg)", color: "var(--tx)" }}>
      <div className="min-h-screen lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">

        {/* ── Mobile drawer overlay ──────────────────────────────── */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setDrawerOpen(false)} />
        )}

        {/* ── Mobile slide-in drawer ─────────────────────────────── */}
        <div
          className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-y-auto px-3 pb-8 pt-4 transition-transform duration-300 lg:hidden"
          style={{
            background: "var(--sf)",
            borderRight: "1px solid var(--bd)",
            transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
          }}
        >
          <div className="mb-4 flex items-center gap-2.5 px-2">
            {/* Hai ảnh, CSS chọn theo giao diện — xem .logo-on-dark ở globals.css. */}
            <img src="/logo-wordmark.svg" alt="mstudo" className="logo-on-light h-8 w-auto" />
            <img src="/logo-wordmark-dark.svg" alt="mstudo" className="logo-on-dark h-8 w-auto" />
            {brandChip}
            <button
              onClick={() => setDrawerOpen(false)}
              className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px]"
              style={{ background: "var(--sf2)", color: "var(--tx2)" }}
              aria-label="Đóng menu"
            >
              <XIcon size={16} />
            </button>
          </div>

          <div className="mb-4 flex items-center gap-3 rounded-[12px] px-3 py-3" style={{ background: "var(--sf2)" }}>
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-extrabold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{profile.full_name || profile.email}</p>
              <p className="truncate text-[11px]" style={{ color: "var(--tx3)" }}>{roleLabel(role)}</p>
            </div>
          </div>

          <NavGroups dense={false} {...navProps} />

          <div className="mt-auto flex flex-col gap-2 pt-6">
            {/* Cụm tài khoản đã rời sidebar sang menu avatar. Trên điện thoại
                nút avatar vẫn ở topbar, nhưng người mở ngăn kéo thì đang tìm
                "menu" — nên để lại một lối vào ở đây thay vì bắt họ đóng ngăn
                kéo rồi mới bấm avatar. */}
            <Link
              href="/dashboard/account"
              className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-semibold"
              style={{ background: "var(--sf2)", color: "var(--tx)" }}
            >
              <UserCircle size={18} style={{ color: "var(--ac)" }} />
              Tài khoản & bảo mật
            </Link>
            <a
              href={ZALO_SUPPORT_URL}
              target="_blank"
              rel="noreferrer"
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-semibold"
              style={{ background: "var(--sf2)", color: "var(--tx)" }}
            >
              <MessageSquare size={18} style={{ color: "var(--ac)" }} />
              Nhóm Zalo hỗ trợ
            </a>
            <DownloadAppButton desktop={desktopOk} />
            <SyncControlButton />
            {/* Giao diện: ba lựa chọn hiện HẾT thành một dải, không phải một nút
                xoay vòng — trong ngăn kéo có chỗ, và "theo máy" mà nấp sau
                nhiều lần bấm thì gần như không ai tìm ra. */}
            <div>
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--tx3)" }}>
                Giao diện
              </p>
              <div className="flex rounded-[10px] p-1" style={{ background: "var(--sf2)" }}>
                {THEME_OPTIONS.map((o) => {
                  const on = themePref === o.pref;
                  const Icon = THEME_ICON[o.pref];
                  return (
                    <button
                      key={o.pref}
                      onClick={() => setTheme(o.pref)}
                      aria-pressed={on}
                      title={o.title}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-[7px] px-2 py-2 text-[12.5px]"
                      style={
                        on
                          ? { background: "var(--sf)", border: "1px solid var(--bd)", color: "var(--ac)", fontWeight: 700 }
                          : { border: "1px solid transparent", color: "var(--tx2)", fontWeight: 600 }
                      }
                    >
                      <Icon size={15} /> {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-semibold"
              style={{ background: "var(--rdS)", color: "var(--rd)" }}
            >
              <LogOut size={18} />
              Đăng xuất
            </button>
            <p className="px-1 pt-1 text-[11px]" style={{ color: "var(--tx3)" }}>Phiên bản {APP_VERSION}</p>
          </div>
        </div>

        {/* ── Sidebar (desktop) — 250px, cố định ─────────────────── */}
        <aside
          className="sticky top-0 hidden h-screen flex-col px-3 pb-3 pt-3.5 lg:flex"
          style={{ background: "var(--sf)", borderRight: "1px solid var(--bd)" }}
        >
          <Link href="/dashboard/studio" className="mb-3.5 flex items-center gap-2.5 px-2 pb-0.5">
            {/* Hai ảnh, CSS chọn theo giao diện — xem .logo-on-dark ở globals.css. */}
            <img src="/logo-wordmark.svg" alt="mstudo" className="logo-on-light h-[26px] w-auto" />
            <img src="/logo-wordmark-dark.svg" alt="mstudo" className="logo-on-dark h-[26px] w-auto" />
            {brandChip}
          </Link>

          <nav className="min-h-0 flex-1 overflow-y-auto pb-2">
            <NavGroups dense {...navProps} />
          </nav>

          <div className="flex flex-col gap-2 pt-2.5" style={{ borderTop: "1px solid var(--bd2)" }}>
            <SidebarDriveStatus desktop={desktopOk} />
            <SyncControlButton />
            <p className="px-2 text-[10.5px]" style={{ color: "var(--tx3)" }}>Phiên bản {APP_VERSION}</p>
          </div>
        </aside>

        {/* ── Main column ───────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col">
          {/* Topbar */}
          <header
            // gap-2 dưới 640px: trên máy 360px, topbar phải chứa hamburger + ô
            // chi nhánh + ⌘K + sáng/tối + chuông + avatar; ở gap-3 tổng bề rộng
            // vượt màn hình vài pixel và nút ngoài cùng bên phải bị đẩy khuất.
            className="sticky top-0 z-30 flex items-center gap-2 px-4 py-[11px] sm:gap-3 sm:px-6"
            style={{
              background: "var(--topbar)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderBottom: "1px solid var(--bd)",
            }}
          >
            {/* Mobile: hamburger */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] lg:hidden"
              style={{ background: "var(--sf2)", color: "var(--tx)" }}
              aria-label="Mở menu"
            >
              <Menu size={18} />
            </button>

            <div className="min-w-0 flex-1 overflow-hidden">
              <h1 className="truncate text-[16.5px] font-bold" style={{ letterSpacing: "-.3px" }}>{title}</h1>
              {sub ? <p className="mt-px hidden truncate text-[11.5px] sm:block" style={{ color: "var(--tx3)" }}>{sub}</p> : null}
            </div>

            {/* Chi nhánh đang xem — chỉ hiện khi studio khai từ 1 cơ sở trở lên.
                Đứng TRƯỚC ô ⌘K vì nó đổi PHẠM VI của mọi thứ bên dưới, nên phải
                đọc được trước khi người dùng tìm trong phạm vi đó. */}
            {branchCookie && (
              <BranchSwitcher branches={branches} selected={branchSelected} cookieName={branchCookie} locked={branchLocked} />
            )}

            {/* Ô lệnh ⌘K — thay ô tìm kiếm cũ, tìm cả màn, hợp đồng, khách, nhân sự. */}
            <StudioCommandK access={access} />

            {/* Nền sáng / nền tối */}
            <button
              onClick={() => setTheme(nextPref(themePref))}
              className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px]"
              style={{ border: "1px solid var(--bd)", background: "var(--sf)", color: "var(--tx2)" }}
              title={themeBtnLabel}
              aria-label={themeBtnLabel}
            >
              <ThemeIcon size={17} />
            </button>

            {/* Chuông thông báo — chấm đỏ khi còn thông báo chưa đọc. */}
            <Link
              href="/dashboard/studio/notifications"
              className="relative flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px]"
              style={{ border: "1px solid var(--bd)", background: "var(--sf)", color: "var(--tx2)" }}
              aria-label="Thông báo"
            >
              <Bell size={17} />
              {(badges.notifications ?? 0) > 0 && (
                <span
                  className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full"
                  style={{ background: "var(--rd)", border: "1.5px solid var(--sf)" }}
                />
              )}
            </Link>


            {/* Xem-như vai trò khác — ẩn dưới 1120px (bản thiết kế). */}
            {canViewAs && (
              <div
                className="hidden flex-none items-center gap-0.5 rounded-[9px] p-[3px] min-[1120px]:flex"
                style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}
                title="Xem giao diện theo quyền"
              >
                {VIEW_ROLES.map(([key, label]) => {
                  const on = (viewAs ?? "owner") === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setViewAs(key === "owner" ? null : key)}
                      className="whitespace-nowrap rounded-[7px] px-[9px] py-1 text-[11px] font-semibold"
                      style={{
                        color: on ? "var(--tx)" : "var(--tx3)",
                        background: on ? "var(--sf)" : "transparent",
                        boxShadow: on ? "0 1px 3px rgba(0,0,0,.10)" : "none",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Avatar → menu tài khoản */}
            <div className="relative flex-none">
              <button
                onClick={() => setAvatarOpen((v) => !v)}
                className="nav-item flex items-center gap-2 rounded-[10px] py-1 pl-3 pr-2 text-left"
                style={{ borderLeft: "1px solid var(--bd)" }}
                aria-label="Tài khoản"
              >
                <span className="flex h-[31px] w-[31px] flex-none items-center justify-center rounded-full text-[11.5px] font-extrabold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                  {initials}
                </span>
                <span className="hidden leading-[1.25] min-[1000px]:block">
                  <span className="block max-w-[120px] truncate text-[12.5px] font-semibold">{profile.full_name || "Tài khoản"}</span>
                  <span className="block text-[10.5px]" style={{ color: "var(--tx3)" }}>{roleLabel(role)}</span>
                </span>
              </button>

              {avatarOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAvatarOpen(false)} />
                  <div
                    className="absolute right-0 top-full z-50 mt-2 w-60 rounded-[14px] p-1.5"
                    style={{ background: "var(--sf)", border: "1px solid var(--bd)", boxShadow: "0 18px 44px rgba(20,15,25,.16)" }}
                  >
                    {accountMenu}
                  </div>
                </>
              )}
            </div>
          </header>

          {/* Page content
              overflow-x-clip: chặn một phần tử quá rộng nới cả trang ra rồi đẩy
              mọi thứ lệch khỏi màn hình điện thoại. Dùng `clip` chứ không phải
              `hidden` vì clip KHÔNG tạo scroll container → các phần tử sticky
              bên trong (topbar, thanh hành động) vẫn dính theo viewport, và
              trục dọc vẫn `visible`. Nội dung rộng thật (bảng, khối code) phải
              tự bọc `overflow-x-auto` để còn cuộn xem được. */}
          <main className="page-in min-w-0 overflow-x-clip px-4 pb-28 pt-[22px] sm:px-6 lg:pb-14">{children}</main>
        </div>
      </div>

      {suggestNewUi && <UiSuggestCard />}

      {/* Mobile bottom nav (sidebar is hidden below lg) */}
      <div className="lg:hidden">
        <StudioFooterNav tier={tier} role={role} />
      </div>
    </div>
  );
}
