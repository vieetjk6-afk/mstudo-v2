"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sun, Moon, MonitorSmartphone, LogOut, Menu, X as XIcon, Gift, Link2, UserCircle,
  MessageSquare, Bell, Crown, Plus, ChevronDown, Check, Undo2, Palette,
  Pin, PinOff, SlidersHorizontal, ArrowUp, ArrowDown, RotateCcw,
} from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import StudioCommandK from "@/components/StudioCommandK";
import BranchSwitcher, { type SwitcherBranch } from "@/components/BranchSwitcher";
import SidebarDriveStatus from "@/components/SidebarDriveStatus";
import DownloadAppButton from "@/components/DownloadAppButton";
import SyncControlButton from "@/components/SyncControlButton";
import MobileTabBarV2 from "@/components/v2/MobileTabBarV2";
import { UiV2Provider } from "@/components/v2/UiV2Context";
import { setAccentCookie, setNavPinsCookie, setUiVersion } from "@/components/v2/ui-switch";
import { Drawer } from "@/components/v2/kit-client";
import { btn, iconBtn } from "@/components/v2/kit";
import { DEFAULT_PINS, MAX_PINS } from "@/lib/nav-pins";
import { createClient } from "@/lib/supabase/client";
import { THEME_OPTIONS, useTheme } from "@/lib/theme";
import { roleLabel } from "@/lib/studio-roles";
import { APP_VERSION } from "@/lib/version";
import { pageTitle } from "@/lib/studio-titles";
import { useNavBadges } from "@/lib/use-nav-badges";
import { ACCENTS, accentHex, type AccentKey } from "@/lib/ui-version";
import {
  EXTRA_COMMANDS, canSee, isNavActive, visibleGroups,
  type NavAccess, type NavBadges, type NavGroup, type NavItem, type StudioTier,
} from "@/lib/studio-nav";
import type { ChromeProfile } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   KHUNG GIAO DIỆN MỚI (thử nghiệm) — thay StudioShell khi người dùng bật công
   tắc (xem @/lib/ui-version). Nội dung từng màn vẫn là component cũ: khung này
   chỉ đổi menu, topbar, thanh tab điện thoại và bộ màu (lớp .ui-v2 ở
   globals.css), nên mọi dữ liệu và chức năng giữ nguyên.

   Khác khung cũ ở chỗ:
     • Menu trái: phần "Hay dùng" do studio tự ghim (rê chuột vào mục → nút ghim,
       hoặc "Tùy chỉnh" để chọn và sắp xếp; lưu theo máy, xem @/lib/nav-pins);
       mọi mục còn lại nằm trong nhóm thu gọn, chỉ mở nhóm đang dùng (mở thêm
       thì nhớ lại cho lần sau).
     • Topbar: một nút chính "Tạo mới"; sáng/tối, màu chủ đạo, ngôn ngữ, xem-như
       vai trò dồn vào menu tài khoản.
     • Điện thoại: thanh 5 tab dưới đáy + nút + nổi để tạo nhanh.
   ═══════════════════════════════════════════════════════════════════════════ */

const THEME_ICON = { light: Sun, dark: Moon, system: MonitorSmartphone } as const;
const ZALO_SUPPORT_URL = "https://zalo.me/g/rycw0pqcgss14ib6u2xj";
const VIEW_ROLES: [string, string][] = [["owner", "Chủ"], ["manager", "Quản lý"], ["staff", "Nhân sự"]];

/** Nhãn ngắn khi một màn nằm trong phần ghim — tên đầy đủ vẫn ở tiêu đề trang. */
const SHORT: Record<string, string> = {
  "/dashboard/studio/contracts": "Hợp đồng",
  "/dashboard/studio/calendar": "Lịch làm việc",
  "/dashboard/albums": "Album",
  "/dashboard/studio/reports": "Thu chi",
};

/** Lệnh tạo nhanh — nút "Tạo mới" trên topbar và nút + nổi trên điện thoại. */
const CREATE_HREFS = [
  "/dashboard/studio/contracts/new",
  "/dashboard/studio/quotes/new",
  "/dashboard/albums/new",
];

const OPEN_KEY = "mstudo_v2_nav_open";

function readOpen(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(OPEN_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

type NavCtx = {
  pathname: string;
  badges: NavBadges;
  comingSoon: string[];
  isAdmin: boolean;
  /** Ngăn kéo điện thoại: hàng cao hơn cho dễ bấm. */
  roomy?: boolean;
};

type PinCtl = { pinned: boolean; full: boolean; onToggle: () => void };

function NavRow({ it, label, ctx, pin }: { it: NavItem; label?: string; ctx: NavCtx; pin?: PinCtl }) {
  const active = isNavActive(it, ctx.pathname);
  const flagged = ctx.comingSoon.includes(it.href);
  const locked = flagged && !ctx.isAdmin;
  const count = it.badge ? ctx.badges[it.badge] ?? 0 : 0;

  const cls = `v2-nav flex w-full items-center gap-2.5 rounded-[10px] px-2.5 ${
    ctx.roomy ? "py-2.5 text-[14.5px]" : "py-[7px] text-[13.5px]"
  }${active ? " is-active" : ""}${pin ? " pr-9" : ""}`;

  // Số đếm nhường chỗ cho nút ghim khi rê chuột (chỉ ở sidebar máy tính).
  const hideOnHover = pin ? " group-hover/nav:invisible" : "";
  const inner = (
    <>
      <it.icon size={ctx.roomy ? 19 : 18} className="flex-none" strokeWidth={active ? 2.2 : 1.9} />
      <span className="min-w-0 flex-1 truncate">{label ?? it.label}</span>
      {flagged ? (
        <span className={`flex-none rounded-[6px] px-1.5 py-px text-[10px] font-semibold${hideOnHover}`} style={{ color: "var(--tx3)", background: "var(--sf2)" }}>
          Sắp có
        </span>
      ) : count > 0 ? (
        <span className={`v2-count flex-none${hideOnHover}`}>{count > 99 ? "99+" : count}</span>
      ) : null}
    </>
  );

  const row = locked ? (
    <div className={cls} style={{ opacity: 0.5, cursor: "not-allowed" }} title="Tính năng sắp ra mắt">{inner}</div>
  ) : (
    <Link href={it.href} className={cls} aria-current={active ? "page" : undefined}>
      {inner}
    </Link>
  );
  if (!pin) return row;

  const disabled = !pin.pinned && pin.full;
  const PinIcon = pin.pinned ? PinOff : Pin;
  return (
    <div className="group/nav relative">
      {row}
      <button
        type="button"
        onClick={pin.onToggle}
        disabled={disabled}
        aria-label={pin.pinned ? `Bỏ ghim ${it.label}` : `Ghim ${it.label} lên đầu menu`}
        title={disabled ? `Đã ghim tối đa ${MAX_PINS} mục` : pin.pinned ? "Bỏ ghim" : "Ghim lên phần hay dùng"}
        className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[8px] opacity-0 transition-opacity hover:bg-[var(--sf)] focus-visible:opacity-100 group-hover/nav:opacity-100 disabled:cursor-not-allowed disabled:opacity-0 disabled:group-hover/nav:opacity-40"
        style={{ color: "var(--tx3)" }}
      >
        <PinIcon size={14} />
      </button>
    </div>
  );
}

/**
 * Menu: phần "Hay dùng" (studio tự ghim) + các nhóm thu gọn chứa mọi mục còn
 * lại. Dùng cho cả sidebar và ngăn kéo điện thoại. Nút ghim nhanh chỉ hiện ở
 * sidebar máy tính (rê chuột); trên điện thoại dùng "Tùy chỉnh".
 */
function NavTree({ groups, ctx, open, toggle, pins, onTogglePin, onCustomize, quickPin }: {
  groups: NavGroup[];
  ctx: NavCtx;
  open: string[];
  toggle: (label: string) => void;
  pins: string[];
  onTogglePin: (href: string) => void;
  onCustomize: () => void;
  quickPin: boolean;
}) {
  const all = groups.flatMap((g) => g.items);
  const pinned = pins.map((h) => all.find((it) => it.href === h)).filter(Boolean) as NavItem[];
  const full = pins.length >= MAX_PINS;
  const rest = groups
    .map((g) => ({ label: g.label || "Khác", items: g.items.filter((it) => !pins.includes(it.href)) }))
    .filter((g) => g.items.length > 0);
  const pinOf = (href: string, isPinned: boolean): PinCtl | undefined =>
    quickPin ? { pinned: isPinned, full, onToggle: () => onTogglePin(href) } : undefined;

  return (
    <div className="flex flex-col gap-px">
      <div className="flex items-center gap-2 px-2.5 pb-1">
        <span className="flex-1 text-[11.5px] font-semibold" style={{ color: "var(--tx3)" }}>Hay dùng</span>
        <button
          type="button"
          onClick={onCustomize}
          className="v2-group flex items-center gap-1 rounded-[7px] px-1.5 py-0.5 text-[11.5px] font-semibold"
          title="Chọn và sắp xếp mục hay dùng"
        >
          <SlidersHorizontal size={12} /> Tùy chỉnh
        </button>
      </div>
      {pinned.length === 0 ? (
        <button
          type="button"
          onClick={onCustomize}
          className="mx-1 rounded-[10px] px-3 py-2.5 text-left text-[12.5px]"
          style={{ border: "1px dashed var(--bd)", color: "var(--tx3)" }}
        >
          Chưa ghim mục nào. Bấm để chọn màn hay dùng.
        </button>
      ) : (
        pinned.map((it) => <NavRow key={it.href} it={it} label={SHORT[it.href]} ctx={ctx} pin={pinOf(it.href, true)} />)
      )}

      <div className="my-2.5 h-px" style={{ background: "var(--bd2)" }} />

      {rest.map((g) => {
        const hasActive = g.items.some((it) => isNavActive(it, ctx.pathname));
        const isOpen = hasActive || open.includes(g.label);
        const pending = g.items.reduce((n, it) => n + (it.badge ? ctx.badges[it.badge] ?? 0 : 0), 0);
        return (
          <div key={g.label}>
            <button
              type="button"
              onClick={() => toggle(g.label)}
              disabled={hasActive}
              aria-expanded={isOpen}
              className="v2-group flex w-full items-center gap-2 rounded-[8px] px-2.5 py-[7px] text-left text-[12px] font-semibold"
            >
              <span className="flex-1 truncate">{g.label}</span>
              {!isOpen && pending > 0 && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--am)" }} aria-label="Có việc chờ" />}
              <ChevronDown size={14} className="flex-none transition-transform" style={{ transform: isOpen ? "rotate(0)" : "rotate(-90deg)", opacity: hasActive ? 0.35 : 0.8 }} />
            </button>
            {isOpen && (
              <div className="mb-1.5 flex flex-col gap-px">
                {g.items.map((it) => <NavRow key={it.href} it={it} ctx={ctx} pin={pinOf(it.href, false)} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Ngăn "Tùy chỉnh menu": danh sách đang ghim (đổi thứ tự, bỏ ghim) và mọi mục
 * còn lại theo nhóm (ghim thêm). Dùng được cả trên điện thoại — nơi không có rê
 * chuột để hiện nút ghim nhanh.
 */
function CustomizeNavDrawer({ open, onClose, groups, pins, setPins }: {
  open: boolean;
  onClose: () => void;
  groups: NavGroup[];
  pins: string[];
  setPins: (next: string[]) => void;
}) {
  const all = groups.flatMap((g) => g.items);
  const pinned = pins.map((h) => all.find((it) => it.href === h)).filter(Boolean) as NavItem[];
  const full = pins.length >= MAX_PINS;
  const move = (i: number, d: -1 | 1) => {
    const next = [...pins];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setPins(next);
  };
  const isDefault = pins.join("|") === DEFAULT_PINS.join("|");

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Tùy chỉnh menu"
      desc={`Chọn tối đa ${MAX_PINS} màn hay dùng để luôn nằm trên cùng. Các màn khác vẫn ở trong nhóm thu gọn bên dưới.`}
      width={440}
      footer={
        <>
          <button type="button" className={btn("ghost")} disabled={isDefault} onClick={() => setPins([...DEFAULT_PINS])}>
            <RotateCcw size={15} /> Khôi phục mặc định
          </button>
          <button type="button" className={btn("primary")} onClick={onClose}>
            Xong
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <p className="v2-label">
            Hay dùng <span style={{ color: "var(--tx3)", fontWeight: 500 }}>· {pinned.length}/{MAX_PINS}</span>
          </p>
          {pinned.length === 0 ? (
            <p className="rounded-[10px] px-3 py-3 text-[13px]" style={{ background: "var(--sf2)", color: "var(--tx3)" }}>
              Chưa ghim mục nào. Bấm “Ghim” ở danh sách bên dưới.
            </p>
          ) : (
            <div className="v2-card overflow-hidden" style={{ boxShadow: "none" }}>
              {pinned.map((it, i) => (
                <div key={it.href} className="flex items-center gap-2.5 px-3 py-2" style={{ borderTop: i ? "1px solid var(--bd2)" : undefined }}>
                  <it.icon size={17} className="flex-none" style={{ color: "var(--tx2)" }} />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{it.label}</span>
                  <button type="button" className={iconBtn()} style={{ width: 30, height: 30 }} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Đưa ${it.label} lên`}>
                    <ArrowUp size={15} />
                  </button>
                  <button type="button" className={iconBtn()} style={{ width: 30, height: 30 }} disabled={i === pinned.length - 1} onClick={() => move(i, 1)} aria-label={`Đưa ${it.label} xuống`}>
                    <ArrowDown size={15} />
                  </button>
                  <button type="button" className={iconBtn()} style={{ width: 30, height: 30 }} onClick={() => setPins(pins.filter((h) => h !== it.href))} aria-label={`Bỏ ghim ${it.label}`}>
                    <PinOff size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {groups.map((g) => {
          const items = g.items.filter((it) => !pins.includes(it.href));
          if (!items.length) return null;
          return (
            <section key={g.label || "khac"} className="flex flex-col gap-2">
              <p className="v2-label">{g.label || "Khác"}</p>
              <div className="v2-card overflow-hidden" style={{ boxShadow: "none" }}>
                {items.map((it, i) => (
                  <div key={it.href} className="flex items-center gap-2.5 px-3 py-2" style={{ borderTop: i ? "1px solid var(--bd2)" : undefined }}>
                    <it.icon size={17} className="flex-none" style={{ color: "var(--tx3)" }} />
                    <span className="min-w-0 flex-1 truncate text-[13.5px]" style={{ color: "var(--tx2)" }}>{it.label}</span>
                    <button
                      type="button"
                      className={btn("secondary", "sm")}
                      disabled={full}
                      title={full ? `Đã ghim tối đa ${MAX_PINS} mục` : undefined}
                      onClick={() => setPins([...pins, it.href])}
                    >
                      <Pin size={14} /> Ghim
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Drawer>
  );
}

export default function StudioShellV2({
  profile,
  tier,
  role,
  comingSoon = [],
  hiddenNav = [],
  branches = [],
  branchSelected = null,
  branchCookie,
  branchLocked = false,
  accent: accentInit,
  navPins = null,
  previewPath,
  children,
}: {
  profile: ChromeProfile;
  tier: StudioTier;
  role: string;
  comingSoon?: string[];
  hiddenNav?: string[];
  branches?: SwitcherBranch[];
  branchSelected?: string | null;
  branchCookie?: string;
  branchLocked?: boolean;
  accent: AccentKey;
  /** Mục ghim menu trái đọc từ cookie ở layout; null = bộ mặc định. */
  navPins?: string[] | null;
  /** Chỉ cho /uipreview: giả như đang mở route này để menu và tiêu đề sáng đúng. */
  previewPath?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const realPath = usePathname();
  const pathname = previewPath ?? realPath;
  const { theme, pref: themePref, setTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewAs, setViewAs] = useState<string | null>(null);
  const [accent, setAccent] = useState<AccentKey>(accentInit);
  const [open, setOpen] = useState<string[]>([]);
  const [switching, setSwitching] = useState(false);
  const [pins, setPinsState] = useState<string[]>(() => navPins ?? [...DEFAULT_PINS]);
  const [customizing, setCustomizing] = useState(false);
  const setPins = (next: string[]) => {
    const clean = next.filter((h, i) => next.indexOf(h) === i).slice(0, MAX_PINS);
    setPinsState(clean);
    setNavPinsCookie(clean);
  };
  const togglePin = (href: string) =>
    setPins(pins.includes(href) ? pins.filter((h) => h !== href) : [...pins, href]);

  useEffect(() => { setOpen(readOpen()); }, []);
  useEffect(() => { setDrawerOpen(false); setAvatarOpen(false); setCreateOpen(false); }, [pathname]);

  const toggleGroup = (label: string) => {
    setOpen((cur) => {
      const next = cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label];
      try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const canViewAs = role === "owner" || role === "admin";
  const isOwner = role === "owner" || role === "admin";
  const effectiveRole = canViewAs && viewAs && viewAs !== "owner" ? viewAs : role;

  const access = useMemo<NavAccess>(
    () => ({ tier, role: effectiveRole, comingSoon, hiddenNav }),
    // comingSoon/hiddenNav là mảng mới mỗi lần render ở phía cha → so bằng nội dung.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tier, effectiveRole, comingSoon.join("|"), hiddenNav.join("|")],
  );
  const groups = useMemo(() => visibleGroups(access), [access]);
  const creates = useMemo(
    () => CREATE_HREFS.map((h) => EXTRA_COMMANDS.find((c) => c.href === h)).filter((c): c is NavItem => !!c && canSee(c, access)),
    [access],
  );
  const desktopOk =
    (tier === "plus" || tier === "full") &&
    isOwner &&
    (role === "admin" || !hiddenNav.includes("/dashboard/studio/desktop"));

  const badges = useNavBadges(pathname);
  const [title, sub] = pageTitle(pathname);
  const initials = (profile.full_name || profile.email || "?")
    .split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const ctx: NavCtx = { pathname, badges, comingSoon, isAdmin: role === "admin" };

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function pickAccent(k: AccentKey) {
    setAccent(k);
    setAccentCookie(k);
  }

  function backToOld() {
    setSwitching(true);
    setUiVersion("v1");
    router.refresh();
  }

  const menuLink = "v2-menu flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium";

  const accountMenu = (
    <>
      <div className="flex items-center gap-3 px-3 pb-3 pt-2" style={{ borderBottom: "1px solid var(--bd2)" }}>
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[13px] font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">{profile.full_name || "Tài khoản"}</p>
          <p className="truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>{profile.email}</p>
          <p className="text-[11.5px] font-semibold" style={{ color: "var(--ac)" }}>{roleLabel(role)}</p>
        </div>
      </div>

      <div className="py-1.5">
        <Link href="/dashboard/account" className={menuLink}><UserCircle size={16} /> Tài khoản & bảo mật</Link>
        <Link href="/dashboard/connections" className={menuLink}><Link2 size={16} /> Kết nối Calendar</Link>
        {isOwner && (
          <>
            <Link href="/dashboard/upgrade" className={menuLink}><Crown size={16} /> Gói phần mềm</Link>
            <Link href="/dashboard/affiliate" className={menuLink}><Gift size={16} /> Affiliate</Link>
          </>
        )}
        <a href={ZALO_SUPPORT_URL} target="_blank" rel="noreferrer" className={menuLink}><MessageSquare size={16} /> Nhóm Zalo hỗ trợ</a>
      </div>

      <div className="flex flex-col gap-2.5 px-3 py-3" style={{ borderTop: "1px solid var(--bd2)" }}>
        <div>
          <p className="mb-1.5 text-[11.5px] font-semibold" style={{ color: "var(--tx3)" }}>Chế độ hiển thị</p>
          <div className="flex rounded-[10px] p-[3px]" style={{ background: "var(--sf2)" }}>
            {THEME_OPTIONS.map((o) => {
              const on = themePref === o.pref;
              const Icon = THEME_ICON[o.pref];
              return (
                <button
                  key={o.pref}
                  type="button"
                  onClick={() => setTheme(o.pref)}
                  aria-pressed={on}
                  title={o.title}
                  className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-[8px] px-1.5 py-1.5 text-[12px]"
                  style={on ? { background: "var(--sf)", color: "var(--tx)", fontWeight: 600, boxShadow: "0 1px 2px rgba(15,25,40,.12)" } : { color: "var(--tx2)", fontWeight: 500 }}
                >
                  <Icon size={14} /> {o.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: "var(--tx3)" }}>
            <Palette size={13} /> Màu chủ đạo
          </p>
          <div className="grid grid-cols-8 gap-1.5">
            {ACCENTS.map((a) => {
              const on = a.key === accent;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => pickAccent(a.key)}
                  aria-label={a.label}
                  aria-pressed={on}
                  title={a.label}
                  className="flex aspect-square items-center justify-center rounded-full"
                  style={{ background: a.hex, boxShadow: on ? `0 0 0 2px var(--sf), 0 0 0 4px ${a.hex}` : "none" }}
                >
                  {on && <Check size={13} color="#fff" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>

        {canViewAs && (
          <div>
            <p className="mb-1.5 text-[11.5px] font-semibold" style={{ color: "var(--tx3)" }}>Xem menu theo vai trò</p>
            <div className="flex rounded-[10px] p-[3px]" style={{ background: "var(--sf2)" }}>
              {VIEW_ROLES.map(([key, label]) => {
                const on = (viewAs ?? "owner") === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setViewAs(key === "owner" ? null : key)}
                    aria-pressed={on}
                    className="flex-1 rounded-[8px] px-2 py-1.5 text-[12px]"
                    style={on ? { background: "var(--sf)", color: "var(--tx)", fontWeight: 600, boxShadow: "0 1px 2px rgba(15,25,40,.12)" } : { color: "var(--tx2)", fontWeight: 500 }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-[12.5px] font-medium">
          <span style={{ color: "var(--tx2)" }}>Ngôn ngữ</span>
          <LanguageSwitcher />
        </div>
      </div>

      <div className="py-1.5" style={{ borderTop: "1px solid var(--bd2)" }}>
        <button type="button" onClick={backToOld} disabled={switching} className={`${menuLink} w-full disabled:opacity-60`}>
          <Undo2 size={16} /> {switching ? "Đang chuyển…" : "Về giao diện cũ"}
        </button>
        <button type="button" onClick={signOut} className={`${menuLink} w-full`} style={{ color: "var(--rd)" }}>
          <LogOut size={16} /> Đăng xuất
        </button>
        <p className="px-3 pt-1 text-[11px]" style={{ color: "var(--tx3)" }}>Giao diện mới (thử nghiệm) · {APP_VERSION}</p>
      </div>
    </>
  );

  const createMenu = (
    <div className="flex flex-col gap-0.5 p-1.5">
      {creates.map((c) => (
        <Link key={c.href} href={c.href} className="v2-menu flex items-center gap-3 rounded-[10px] px-3 py-2.5">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
            <c.icon size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13.5px] font-semibold">{c.label}</span>
            {c.sub && <span className="block text-[11.5px]" style={{ color: "var(--tx3)" }}>{c.sub}</span>}
          </span>
        </Link>
      ))}
    </div>
  );

  return (
    <div
      className="studio-shell ui-v2"
      data-theme={theme}
      style={{ ["--ac-base" as string]: accentHex(accent), background: "var(--bg)", color: "var(--tx)" }}
    >
      <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">

        {/* ── Ngăn kéo điện thoại ───────────────────────────────── */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" style={{ background: "rgba(10,18,30,.45)" }} onClick={() => setDrawerOpen(false)} />
        )}
        <div
          className="fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-[320px] flex-col overflow-y-auto px-3 pb-8 pt-4 transition-transform duration-300 lg:hidden"
          style={{
            background: "var(--sf)",
            borderRight: "1px solid var(--bd)",
            transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
            paddingTop: "max(16px, env(safe-area-inset-top, 0px))",
          }}
          aria-hidden={!drawerOpen}
        >
          <div className="mb-4 flex items-center gap-2.5 px-1.5">
            <img src="/logo-wordmark.svg" alt="mstudo" className="logo-on-light h-7 w-auto" />
            <img src="/logo-wordmark-dark.svg" alt="mstudo" className="logo-on-dark h-7 w-auto" />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="ml-auto flex h-9 w-9 flex-none items-center justify-center rounded-full"
              style={{ background: "var(--sf2)", color: "var(--tx2)" }}
              aria-label="Đóng menu"
            >
              <XIcon size={17} />
            </button>
          </div>
          <NavTree groups={groups} ctx={{ ...ctx, roomy: true }} open={open} toggle={toggleGroup} pins={pins} onTogglePin={togglePin} onCustomize={() => setCustomizing(true)} quickPin={false} />
          <div className="mt-auto flex flex-col gap-2 pt-6">
            <DownloadAppButton desktop={desktopOk} />
            <SyncControlButton />
          </div>
        </div>

        {/* ── Sidebar máy tính ──────────────────────────────────── */}
        <aside className="v2-side sticky top-0 hidden h-screen flex-col px-3 pb-3 pt-4 lg:flex">
          <Link href="/dashboard/studio" className="mb-4 flex items-center gap-2.5 px-2">
            <img src="/logo-wordmark.svg" alt="mstudo" className="logo-on-light h-[26px] w-auto" />
            <img src="/logo-wordmark-dark.svg" alt="mstudo" className="logo-on-dark h-[26px] w-auto" />
            <span className="ml-auto rounded-[6px] px-1.5 py-[2px] text-[10px] font-bold" style={{ letterSpacing: ".04em", color: "var(--ac)", background: "var(--acS)" }}>
              {tier === "full" ? "STUDIO" : "PRO"}
            </span>
          </Link>
          <nav className="min-h-0 flex-1 overflow-y-auto pb-2 pr-0.5" aria-label="Menu chính">
            <NavTree groups={groups} ctx={ctx} open={open} toggle={toggleGroup} pins={pins} onTogglePin={togglePin} onCustomize={() => setCustomizing(true)} quickPin />
          </nav>
          <div className="flex flex-col gap-2 pt-2.5" style={{ borderTop: "1px solid var(--bd2)" }}>
            <SidebarDriveStatus desktop={desktopOk} />
            <SyncControlButton />
          </div>
        </aside>

        {/* ── Cột nội dung ──────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col">
          <header
            className="sticky top-0 z-30 flex h-[60px] items-center gap-2 px-3 sm:gap-3 sm:px-6"
            style={{ background: "var(--topbar)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid var(--bd)" }}
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full lg:hidden"
              style={{ color: "var(--tx)" }}
              aria-label="Mở menu"
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[16px] font-bold sm:text-[17px]" style={{ letterSpacing: "-.2px" }}>{title}</h1>
              {sub ? <p className="hidden truncate text-[12px] sm:block" style={{ color: "var(--tx3)" }}>{sub}</p> : null}
            </div>

            {branchCookie && (
              <BranchSwitcher branches={branches} selected={branchSelected} cookieName={branchCookie} locked={branchLocked} />
            )}

            <StudioCommandK access={access} />

            {creates.length > 0 && (
              <div className="relative hidden flex-none sm:block">
                <button
                  type="button"
                  onClick={() => setCreateOpen((v) => !v)}
                  aria-expanded={createOpen}
                  className="v2-primary flex h-9 items-center gap-1.5 rounded-[10px] px-3.5 text-[13px] font-semibold"
                >
                  <Plus size={16} strokeWidth={2.4} /> Tạo mới
                </button>
                {createOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setCreateOpen(false)} />
                    <div className="v2-pop absolute right-0 top-full z-50 mt-2 w-72">{createMenu}</div>
                  </>
                )}
              </div>
            )}

            <Link
              href="/dashboard/studio/notifications"
              className="v2-icon relative flex h-9 w-9 flex-none items-center justify-center rounded-full"
              aria-label="Thông báo"
            >
              <Bell size={18} />
              {(badges.notifications ?? 0) > 0 && (
                <span className="absolute right-[7px] top-[7px] h-2 w-2 rounded-full" style={{ background: "var(--rd)", boxShadow: "0 0 0 2px var(--sf)" }} />
              )}
            </Link>

            <div className="relative flex-none">
              <button
                type="button"
                onClick={() => setAvatarOpen((v) => !v)}
                aria-expanded={avatarOpen}
                aria-label="Tài khoản"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold"
                style={{ background: "var(--acS)", color: "var(--ac)" }}
              >
                {initials}
              </button>
              {avatarOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAvatarOpen(false)} />
                  <div className="v2-pop absolute right-0 top-full z-50 mt-2 max-h-[calc(100vh-80px)] w-[300px] max-w-[calc(100vw-24px)] overflow-y-auto">
                    {accountMenu}
                  </div>
                </>
              )}
            </div>
          </header>

          <main className="page-in mx-auto w-full min-w-0 max-w-[1440px] overflow-x-clip px-4 pb-32 pt-5 sm:px-6 lg:px-8 lg:pb-14 lg:pt-7">
            <UiV2Provider>{children}</UiV2Provider>
          </main>
        </div>
      </div>

      {/* ── Điện thoại: thanh tab + nút tạo nhanh ─────────────── */}
      <MobileTabBarV2 groups={groups} pathname={pathname} creates={creates} pins={pins} />

      <CustomizeNavDrawer open={customizing} onClose={() => setCustomizing(false)} groups={groups} pins={pins} setPins={setPins} />
    </div>
  );
}
