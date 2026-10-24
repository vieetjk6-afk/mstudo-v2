"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { isNavActive, type NavGroup, type NavItem } from "@/lib/studio-nav";

/**
 * Thanh tab đáy của giao diện mới (chỉ hiện dưới lg).
 *
 * Năm tab cố định thay vì dải cuộn ngang của khung cũ: lấy 5 màn đầu tiên trong
 * danh sách ưu tiên mà người này ĐƯỢC THẤY (lọc sẵn theo gói + vai trò qua
 * `groups`), nên không bao giờ có tab dẫn tới trang bị chặn. Màn còn lại nằm ở
 * menu ☰ trên topbar. Nút + nổi mở bảng tạo nhanh.
 */
const PRIORITY: [string, string][] = [
  ["/dashboard/studio", "Tổng quan"],
  ["/staff", "Của tôi"],
  ["/dashboard/studio/contracts", "Hợp đồng"],
  ["/dashboard/studio/calendar", "Lịch"],
  ["/dashboard/albums", "Album"],
  ["/dashboard/studio/reports", "Tài chính"],
  ["/dashboard/studio/clients", "Khách"],
  ["/dashboard/studio/quotes", "Báo giá"],
  ["/dashboard/tools", "Công cụ"],
];

export default function MobileTabBarV2({ groups, pathname, creates }: {
  groups: NavGroup[];
  pathname: string;
  creates: NavItem[];
}) {
  const all = groups.flatMap((g) => g.items);
  const tabs = PRIORITY
    .map(([href, label]) => {
      const it = all.find((x) => x.href === href);
      return it ? { it, label } : null;
    })
    .filter((t): t is { it: NavItem; label: string } => !!t)
    .slice(0, 5);

  // Sáng tab ngay lúc chạm, không đợi server trả trang (cảm giác "đơ").
  const [pending, setPending] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  useEffect(() => { setPending(null); setSheet(false); }, [pathname]);

  return (
    <div className="lg:hidden">
      {sheet && (
        <div className="fixed inset-0 z-50" style={{ background: "rgba(10,18,30,.45)" }} onClick={() => setSheet(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="ck-panel absolute inset-x-0 bottom-0 rounded-t-[22px] px-4 pt-3"
            style={{ background: "var(--sf)", paddingBottom: "max(20px, env(safe-area-inset-bottom, 0px))" }}
            role="dialog"
            aria-label="Tạo mới"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: "var(--bd)" }} />
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[16px] font-bold">Tạo mới</p>
              <button type="button" onClick={() => setSheet(false)} aria-label="Đóng" className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
                <X size={17} />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {creates.map((c) => (
                <Link key={c.href} href={c.href} className="v2-menu flex items-center gap-3 rounded-[12px] px-2 py-3">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[12px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                    <c.icon size={19} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold">{c.label}</span>
                    {c.sub && <span className="block text-[12.5px]" style={{ color: "var(--tx3)" }}>{c.sub}</span>}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-30"
        style={{
          background: "var(--topbar)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderTop: "1px solid var(--bd)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        aria-label="Điều hướng nhanh"
      >
        {creates.length > 0 && (
          <button
            type="button"
            onClick={() => setSheet(true)}
            aria-label="Tạo mới"
            className="v2-primary absolute -top-[68px] right-4 flex h-[52px] w-[52px] items-center justify-center rounded-[16px]"
            style={{ boxShadow: "0 10px 24px -8px color-mix(in srgb, var(--ac) 70%, transparent)" }}
          >
            <Plus size={24} strokeWidth={2.4} />
          </button>
        )}
        <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.max(tabs.length, 1)}, minmax(0, 1fr))` }}>
          {tabs.map(({ it, label }) => {
            const active = pending ? pending === it.href : isNavActive(it, pathname);
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setPending(it.href)}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center gap-1 pb-2 pt-2"
                style={{ color: active ? "var(--ac)" : "var(--tx3)" }}
              >
                <span
                  className="flex h-8 w-12 items-center justify-center rounded-full transition-colors"
                  style={{ background: active ? "var(--acS)" : "transparent" }}
                >
                  <it.icon size={20} strokeWidth={active ? 2.2 : 1.9} />
                </span>
                <span className="text-[11px]" style={{ fontWeight: active ? 650 : 500 }}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
