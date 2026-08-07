"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, CalendarDays, Wallet, MoreHorizontal, X,
  ReceiptText, Users, Images, UsersRound, Banknote, Bell, Clock, Wand2,
  type LucideIcon,
} from "lucide-react";

interface Props {
  tier: string;
  role: string;
}

// Rank + minTier của từng mục soi theo StudioShell để thanh đáy không bao giờ
// dẫn tới trang mà gói của tài khoản chưa mở (tránh link chết).
const TIER_RANK: Record<string, number> = { none: 0, booking: 1, plus: 2, full: 3 };

type Item = { href: string; icon: LucideIcon; label: string; minTier: string };

/**
 * Thanh tab đáy 5 mục theo bản mobile của bản thiết kế:
 *   Trang chủ · Lịch · Hợp đồng · Tiền · Thêm
 * Mục thứ 5 mở bảng "Thêm" gồm những màn còn lại — trước đây cả 9 mục nhét
 * vào một dải cuộn ngang, mục cuối luôn bị khuất và không ai biết là cuộn được.
 */
const MAIN: Item[] = [
  { href: "/dashboard/studio", icon: LayoutDashboard, label: "Trang chủ", minTier: "booking" },
  { href: "/dashboard/studio/calendar", icon: CalendarDays, label: "Lịch", minTier: "booking" },
  { href: "/dashboard/studio/contracts", icon: FileText, label: "Hợp đồng", minTier: "plus" },
  { href: "/dashboard/studio/reports", icon: Wallet, label: "Tiền", minTier: "full" },
];

/** Bảng "Thêm" — phần còn lại, đúng danh sách bản thiết kế liệt kê. */
const MORE: Item[] = [
  { href: "/dashboard/studio/quotes", icon: ReceiptText, label: "Báo giá", minTier: "plus" },
  { href: "/dashboard/studio/clients", icon: Users, label: "Khách hàng", minTier: "booking" },
  { href: "/dashboard/albums", icon: Images, label: "Album", minTier: "booking" },
  { href: "/dashboard/studio/crew", icon: UsersRound, label: "Đội ngũ", minTier: "full" },
  { href: "/dashboard/studio/payroll", icon: Banknote, label: "Đối soát", minTier: "full" },
  { href: "/dashboard/studio/bookings", icon: Clock, label: "Đặt lịch", minTier: "booking" },
  { href: "/dashboard/studio/production", icon: Wand2, label: "Xử lý ảnh", minTier: "full" },
  { href: "/dashboard/studio/notifications", icon: Bell, label: "Thông báo", minTier: "full" },
];

export default function StudioFooterNav({ tier, role: _role }: Props) {
  const pathname = usePathname();
  const rank = TIER_RANK[tier] ?? 0;
  const allow = (it: Item) => rank >= (TIER_RANK[it.minTier] ?? 0);
  const main = MAIN.filter(allow);
  const more = MORE.filter(allow);

  const [pending, setPending] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  useEffect(() => { setPending(null); setSheet(false); }, [pathname]);

  function isActive(href: string) {
    const onPath = pathname === href || (href !== "/dashboard/studio" && pathname.startsWith(href + "/"));
    return pending ? pending === href : onPath;
  }
  const moreActive = more.some((it) => isActive(it.href));

  return (
    <>
      {/* Bảng "Thêm" — trượt lên từ đáy, chạm nền tối để đóng. */}
      {sheet && (
        <div className="fixed inset-0 z-50" onClick={() => setSheet(false)} style={{ background: "rgba(24,18,28,.42)", backdropFilter: "blur(2px)" }}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="ck-panel absolute inset-x-0 bottom-0 rounded-t-[18px] px-4 pb-6 pt-4"
            style={{ background: "var(--sf)", borderTop: "1px solid var(--bd)" }}
          >
            <div className="mb-3 flex items-center">
              <p className="text-[14px] font-bold">Tất cả mục</p>
              <button
                onClick={() => setSheet(false)}
                aria-label="Đóng"
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-[9px]"
                style={{ background: "var(--sf2)", color: "var(--tx2)" }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {more.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setPending(it.href)}
                  className="flex flex-col items-center gap-1.5 rounded-[12px] px-1 py-3 text-center"
                  style={{ background: "var(--sf2)", minHeight: 76 }}
                >
                  <it.icon size={20} style={{ color: "var(--ac)" }} />
                  <span className="text-[11px] font-semibold leading-tight">{it.label}</span>
                </Link>
              ))}
            </div>
            <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-40"
        style={{ background: "var(--topbar)", backdropFilter: "blur(12px)", borderTop: "1px solid var(--bd)" }}
      >
        <div className="flex">
          {main.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setPending(item.href)}
                // Hit target ≥44px theo bản mobile của bản thiết kế.
                className="flex flex-1 flex-col items-center justify-center gap-1 pb-2 pt-2"
                style={{ color: active ? "var(--ac)" : "var(--tx3)", minHeight: 52 }}
              >
                <item.icon size={21} strokeWidth={active ? 2.2 : 1.8} />
                <span className="text-[10px] font-bold leading-none">{item.label}</span>
              </Link>
            );
          })}
          {more.length > 0 && (
            <button
              onClick={() => setSheet(true)}
              className="flex flex-1 flex-col items-center justify-center gap-1 pb-2 pt-2"
              style={{ color: moreActive || sheet ? "var(--ac)" : "var(--tx3)", minHeight: 52 }}
              aria-expanded={sheet}
            >
              <MoreHorizontal size={21} strokeWidth={moreActive || sheet ? 2.2 : 1.8} />
              <span className="text-[10px] font-bold leading-none">Thêm</span>
            </button>
          )}
        </div>
        <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </nav>
    </>
  );
}
